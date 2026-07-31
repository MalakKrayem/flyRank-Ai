import { query, transaction } from '../db/connection.js';
import { TASK_COLUMNS, insertSeeds } from '../db/schema.js';

// The only file in the project that contains SQL. Everything above it deals in
// task objects and knows nothing about tables, columns or placeholders — which is
// what makes "swap the storage" a change to one directory rather than to the app.
// This is the third engine those layers above have not noticed: an array in A1, a
// SQLite file in A2, a Postgres server now.
//
// Nothing here validates or decides: it is told what to do and does it. A missing
// row is reported as `undefined`, not as a 404, because status codes are two
// layers up and this file has no opinion about HTTP.
//
// Every function is async, and that is the one thing Postgres genuinely changed.
// better-sqlite3 read a local file and could answer in the same tick; a query now
// crosses a socket to another program, so the answer arrives as a promise.

// A2 needed a toTask() here to turn 0/1 into true/false. Postgres has a real
// BOOLEAN and `pg` hands it back as a JavaScript boolean, so the translation is
// gone — the row the driver returns is already the shape the API promised.
const firstRow = ({ rows }) => rows[0];

// LIKE treats % and _ as wildcards, so a search for "50%" would otherwise match
// far more than the user asked for. Escaping them keeps ?search= a literal
// substring match, which is what it was when it filtered in JavaScript.
const likePattern = (search) => `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

const SORT_COLUMNS = {
  id: 'id',
  // lower(title) so "apple" and "Apple" sort together instead of every capital
  // coming first — Postgres's answer to A2's COLLATE NOCASE — and id breaks ties
  // so the order is never arbitrary. idx_tasks_title is declared on exactly this
  // expression, because an index sorted one way cannot answer a different sort.
  title: 'lower(title), id',
};

// Filtering, searching, sorting and paging all happen in the database. The clauses
// are assembled from a fixed vocabulary — column names from SORT_COLUMNS, never
// from the request — and every value the client sent travels as a $n parameter,
// so the shape of the query cannot be changed by what a client types.
export const findAll = async ({ done, search, sort, limit, offset } = {}) => {
  const conditions = [];
  const params = [];

  // $1, $2, … are numbered rather than positional like SQLite's ?, so the
  // placeholder is written from how many parameters have been collected so far.
  const placeholder = (value) => `$${params.push(value)}`;

  if (done !== undefined) {
    conditions.push(`done = ${placeholder(done)}`);
  }

  if (search !== undefined) {
    // ILIKE, not LIKE. SQLite's LIKE ignored case for ASCII all by itself;
    // Postgres's does not, and ?search=GITHUB has to keep finding "GitHub".
    conditions.push(`title ILIKE ${placeholder(likePattern(search))} ESCAPE '\\'`);
  }

  let sql = `SELECT ${TASK_COLUMNS} FROM tasks`;
  if (conditions.length) sql += ` WHERE ${conditions.join(' AND ')}`;
  sql += ` ORDER BY ${SORT_COLUMNS[sort] ?? SORT_COLUMNS.id}`;

  // Postgres is happy with OFFSET on its own, and reads LIMIT NULL as "no limit"
  // — so both clauses can always be appended and the absent one says nothing.
  sql += ` LIMIT ${placeholder(limit ?? null)} OFFSET ${placeholder(offset ?? 0)}`;

  const { rows } = await query(sql, params);
  return rows;
};

// The $1 is a parameterized placeholder: the id travels beside the query, never
// inside its text, so nothing a client sends can be read as SQL.
export const findById = async (id) =>
  firstRow(await query(`SELECT ${TASK_COLUMNS} FROM tasks WHERE id = $1`, [id]));

// One row of numbers instead of every task, counted by the database. FILTER is
// Postgres's way of counting a subset in the same pass — one scan, three answers
// — and ::int is there because COUNT returns a bigint, which `pg` would otherwise
// hand back as a string to avoid losing precision it does not have to lose.
export const countByState = async () =>
  firstRow(
    await query(
      `SELECT COUNT(*)::int                             AS total,
              (COUNT(*) FILTER (WHERE done))::int       AS done,
              (COUNT(*) FILTER (WHERE NOT done))::int   AS open
       FROM tasks`,
    ),
  );

// RETURNING is the clause that makes this one statement instead of two: Postgres
// hands back the row it just wrote, id and both timestamps included, so nothing
// in the app has to ask "what id did you give it?" and nothing has to guess at
// the values the column defaults filled in.
export const insert = async (title) =>
  firstRow(await query(`INSERT INTO tasks (title) VALUES ($1) RETURNING ${TASK_COLUMNS}`, [title]));

// The statement always writes both columns; merging a partial update onto the
// current row is the service's decision, not this file's.
export const update = async (id, { title, done }) =>
  firstRow(
    await query(
      `UPDATE tasks SET title = $1, done = $2, updated_at = now()
       WHERE id = $3
       RETURNING ${TASK_COLUMNS}`,
      [title, done, id],
    ),
  );

// rowCount is how many rows the statement actually touched — 0 means there was no
// such id, which is what the service turns into a 404.
export const remove = async (id) =>
  (await query('DELETE FROM tasks WHERE id = $1', [id])).rowCount > 0;

// The cheapest possible question: is the database there and answering? It touches
// no table, so it stays true even on an empty database, and it is what GET /health
// reports on.
export const ping = async () => {
  await query('SELECT 1');
};

// Empties the table and puts the three examples back. RESTART IDENTITY is the
// part that matters: the sequence behind `id SERIAL` remembers the highest number
// it ever issued, so without it a reset would hand the seeds ids 6, 7, 8 instead
// of 1, 2, 3. TRUNCATE and the re-insert share one transaction, so there is no
// moment in which the table is visibly empty.
export const reset = () =>
  transaction(async (run) => {
    await run('TRUNCATE tasks RESTART IDENTITY');
    await insertSeeds(run);

    const { rows } = await run(`SELECT ${TASK_COLUMNS} FROM tasks ORDER BY id`);
    return rows;
  });
