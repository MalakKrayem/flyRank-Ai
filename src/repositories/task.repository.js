import db, { insertSeeds } from '../db/index.js';
import { NOW } from '../db/schema.js';

// The only file in the project that contains SQL. Everything above it deals in
// task objects and knows nothing about tables, columns or 0/1 — which is what
// makes "swap the storage" a change to one directory rather than to the app.
//
// Nothing here validates or decides: it is told what to do and does it. A missing
// row is reported as `undefined`, not as a 404, because status codes are two
// layers up and this file has no opinion about HTTP.

// SQLite has no boolean type, so `done` comes back as 0 or 1. The API promised
// true/false in A1, so every row is translated on its way out.
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

// Filtering, searching, sorting and paging all happen in the database. The clauses
// are assembled from a fixed vocabulary — column names from SORT_COLUMNS, never
// from the request — and every value the client sent travels as a ? parameter, so
// the shape of the query cannot be changed by what a client types.
export const findAll = ({ done, search, sort, limit, offset } = {}) => {
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
export const findById = (id) => toTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));

// One row of numbers instead of every task, counted by the database. SUM over an
// empty table is NULL rather than 0, hence the COALESCE.
export const countByState = () =>
  db
    .prepare(
      `SELECT COUNT(*)                    AS total,
              COALESCE(SUM(done), 0)      AS done,
              COALESCE(SUM(done = 0), 0)  AS open
       FROM tasks`,
    )
    .get();

// The database hands out the id, so nothing in the app has to track "the next
// one". lastInsertRowid is the id it chose; the row is read straight back so the
// caller gets whatever the table actually stored.
export const insert = (title) => {
  const { lastInsertRowid } = db
    .prepare(`INSERT INTO tasks (title, done, created_at, updated_at) VALUES (?, ?, ${NOW}, ${NOW})`)
    .run(title, 0);
  return findById(lastInsertRowid);
};

// The statement always writes both columns; merging a partial update onto the
// current row is the service's decision, not this file's.
export const update = (id, { title, done }) => {
  db.prepare(`UPDATE tasks SET title = ?, done = ?, updated_at = ${NOW} WHERE id = ?`)
    .run(title, Number(done), id);
  return findById(id);
};

// `changes` is how many rows the statement actually touched — 0 means there was
// no such id, which is what the service turns into a 404.
export const remove = (id) => db.prepare('DELETE FROM tasks WHERE id = ?').run(id).changes > 0;

// Empties the table and puts the three examples back. Clearing the sqlite_sequence
// row matters: AUTOINCREMENT remembers the highest id ever issued, so without it a
// reset would hand the seeds ids 6, 7, 8 instead of 1, 2, 3.
export const reset = db.transaction(() => {
  db.prepare('DELETE FROM tasks').run();
  db.prepare('DELETE FROM sqlite_sequence WHERE name = ?').run('tasks');
  insertSeeds();
  return findAll();
});
