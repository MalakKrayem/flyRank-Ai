import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

// Resolved against this file, not the shell's working directory, so `node server.js`
// always finds the same database no matter where it is started from.
// DB_FILE overrides it — the tests point at a throwaway file.
const DB_FILE = process.env.DB_FILE ?? fileURLToPath(new URL('./tasks.db', import.meta.url));

// Opening a SQLite file that does not exist creates it. That one line is the whole
// "install the database" step: a fresh clone gets its tasks.db on the first run.
const db = new Database(DB_FILE);

// An ISO-8601 timestamp from the database's own clock rather than the app's, so
// every row is stamped by one authority. It is a fixed piece of SQL, never user
// input, which is why it can be interpolated into the statements below.
const NOW = `strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`;

// AUTOINCREMENT, not a bare INTEGER PRIMARY KEY: without it SQLite reuses the id of
// the highest deleted row, and A1 promised ids are never handed out twice.
// done is 0/1 — SQLite has no boolean type — and the CHECK keeps anything else out.
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT    NOT NULL,
    done       INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
    created_at TEXT    NOT NULL DEFAULT (${NOW}),
    updated_at TEXT    NOT NULL DEFAULT (${NOW})
  );
`);

// CREATE TABLE IF NOT EXISTS does nothing to a table that already exists, so a
// database created before the timestamps were added would never gain the columns.
// This is a migration: bring an old file up to the current schema without losing
// its rows. SQLite's ALTER TABLE ADD COLUMN insists on a constant default, so the
// column arrives empty and is backfilled in a second statement — the two together
// wrapped in a transaction so a half-migrated table is not a state that can exist.
const migrateTimestamps = db.transaction(() => {
  const columns = db.prepare('PRAGMA table_info(tasks)').all().map((c) => c.name);

  for (const column of ['created_at', 'updated_at']) {
    if (columns.includes(column)) continue;
    db.exec(`ALTER TABLE tasks ADD COLUMN ${column} TEXT NOT NULL DEFAULT ''`);
    db.exec(`UPDATE tasks SET ${column} = ${NOW} WHERE ${column} = ''`);
  }
});

migrateTimestamps();

// An index is a sorted lookup structure the database keeps beside the table so it
// can find matching rows without reading every one of them. These two cover the
// WHERE done = ? filter and the ORDER BY title sort.
//
// The title index has to be declared with the same COLLATE NOCASE and the same
// tiebreaker the sort uses: an index sorted one way cannot answer a query that
// wants another, and EXPLAIN QUERY PLAN quietly says SCAN when they disagree.
//
// Neither index helps ?search=: LIKE '%milk%' has a leading wildcard, and an index
// is only useful when you know how the value starts.
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_tasks_done  ON tasks(done);
  CREATE INDEX IF NOT EXISTS idx_tasks_title ON tasks(title COLLATE NOCASE, id);
`);

const SEED_TASKS = [
  { title: 'Read the assignment', done: 1 },
  { title: 'Build the Task API', done: 0 },
  { title: 'Push it to GitHub', done: 0 },
];

// A transaction so the three inserts are all-or-nothing: a crash halfway through
// can't leave the table holding one and a half seeds, which would then look
// "not empty" to the check below and never be completed.
const insertSeeds = db.transaction(() => {
  const insert = db.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)');
  for (const task of SEED_TASKS) insert.run(task.title, task.done);
});

// Counting first is what stops the examples multiplying on every restart.
const seedIfEmpty = db.transaction(() => {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM tasks').get();
  if (count === 0) insertSeeds();
});

seedIfEmpty();

// SQLite has no boolean type, so `done` comes back as 0 or 1. The API promised
// true/false in A1, so every row is translated on its way out — the one place
// that knows about the 0/1 representation is this file.
const toTask = (row) => (row === undefined ? undefined : { ...row, done: Boolean(row.done) });

// LIKE treats % and _ as wildcards, so a search for "50%" would otherwise match
// far more than the user asked for. Escaping them keeps ?search= a literal
// substring match, which is what it was when it filtered in JavaScript.
const likePattern = (search) => `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

const SORT_COLUMNS = {
  id: 'id',
  // COLLATE NOCASE so "apple" and "Apple" sort together instead of all the
  // capitals coming first; id breaks ties so the order is never arbitrary.
  title: 'title COLLATE NOCASE, id',
};

// Filtering, searching, sorting and paging all happen in the database now. The
// clauses are assembled from a fixed vocabulary — column names from SORT_COLUMNS,
// never from the request — and every value the client sent travels as a ?
// parameter, so the shape of the query cannot be changed by what a client types.
export const listTasks = ({ done, search, sort, limit, offset } = {}) => {
  const conditions = [];
  const params = [];

  if (done !== undefined) {
    conditions.push('done = ?');
    params.push(Number(done));
  }

  if (search !== undefined) {
    conditions.push(`title LIKE ? ESCAPE '\\'`);
    params.push(likePattern(search));
  }

  let sql = 'SELECT * FROM tasks';
  if (conditions.length) sql += ` WHERE ${conditions.join(' AND ')}`;
  sql += ` ORDER BY ${SORT_COLUMNS[sort] ?? SORT_COLUMNS.id}`;

  // SQLite will not accept OFFSET without LIMIT; -1 is its idiom for "no limit".
  if (limit !== undefined || offset !== undefined) {
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit ?? -1, offset ?? 0);
  }

  return db.prepare(sql).all(...params).map(toTask);
};

// The ? is a parameterized placeholder: the id travels beside the query, never
// inside its text, so nothing a client sends can be read as SQL.
export const getTask = (id) => toTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));

// One row of numbers instead of every task, counted by the database. SUM over an
// empty table is NULL rather than 0, hence the COALESCE.
export const taskStats = () =>
  db
    .prepare(
      `SELECT COUNT(*)                    AS total,
              COALESCE(SUM(done), 0)      AS done,
              COALESCE(SUM(done = 0), 0)  AS open
       FROM tasks`,
    )
    .get();

// The database hands out the id, so nothing in the app has to track "the next
// one" any more. lastInsertRowid is the id it chose; the row is read straight
// back so the response carries whatever the table actually stored.
export const createTask = (title) => {
  const { lastInsertRowid } = db
    .prepare(`INSERT INTO tasks (title, done, created_at, updated_at) VALUES (?, ?, ${NOW}, ${NOW})`)
    .run(title, 0);
  return getTask(lastInsertRowid);
};

// PUT accepts partial bodies, but the statement always writes both columns:
// whatever the caller left out is filled in from the row as it stands.
export const updateTask = (id, { title, done }) => {
  const current = getTask(id);
  if (current === undefined) return undefined;

  db.prepare(`UPDATE tasks SET title = ?, done = ?, updated_at = ${NOW} WHERE id = ?`)
    .run(title ?? current.title, Number(done ?? current.done), id);

  return getTask(id);
};

// `changes` is how many rows the statement actually touched — 0 means there was
// no such id, which is the 404 the route needs.
export const deleteTask = (id) => db.prepare('DELETE FROM tasks WHERE id = ?').run(id).changes > 0;

// Empties the table and puts the three examples back. Clearing the sqlite_sequence
// row matters: AUTOINCREMENT remembers the highest id ever issued, so without it a
// reset would hand the seeds ids 6, 7, 8 instead of 1, 2, 3.
export const resetTasks = db.transaction(() => {
  db.prepare('DELETE FROM tasks').run();
  db.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run('tasks');
  insertSeeds();
  return listTasks();
});

export default db;
