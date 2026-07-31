import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

// Resolved against this file, not the shell's working directory, so `node server.js`
// always finds the same database no matter where it is started from.
// DB_FILE overrides it — the tests point at a throwaway file.
const DB_FILE = process.env.DB_FILE ?? fileURLToPath(new URL('./tasks.db', import.meta.url));

// Opening a SQLite file that does not exist creates it. That one line is the whole
// "install the database" step: a fresh clone gets its tasks.db on the first run.
const db = new Database(DB_FILE);

// AUTOINCREMENT, not a bare INTEGER PRIMARY KEY: without it SQLite reuses the id of
// the highest deleted row, and A1 promised ids are never handed out twice.
// done is 0/1 — SQLite has no boolean type — and the CHECK keeps anything else out.
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT    NOT NULL,
    done  INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1))
  );
`);

const SEED_TASKS = [
  { title: 'Read the assignment', done: 1 },
  { title: 'Build the Task API', done: 0 },
  { title: 'Push it to GitHub', done: 0 },
];

// Counting first is what stops the examples multiplying on every restart.
// Wrapped in a transaction so the three inserts are all-or-nothing: a crash halfway
// through can't leave the table holding one and a half seeds, which would then look
// "not empty" and never be completed.
const seedIfEmpty = db.transaction(() => {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM tasks').get();
  if (count > 0) return;

  const insert = db.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)');
  for (const task of SEED_TASKS) insert.run(task.title, task.done);
});

seedIfEmpty();

// SQLite has no boolean type, so `done` comes back as 0 or 1. The API promised
// true/false in A1, so every row is translated on its way out — the one place
// that knows about the 0/1 representation is this file.
const toTask = (row) => (row === undefined ? undefined : { ...row, done: Boolean(row.done) });

export const listTasks = () => db.prepare('SELECT * FROM tasks ORDER BY id').all().map(toTask);

// The ? is a parameterized placeholder: the id travels beside the query, never
// inside its text, so nothing a client sends can be read as SQL.
export const getTask = (id) => toTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));

// The database hands out the id, so nothing in the app has to track "the next
// one" any more. lastInsertRowid is the id it chose; the row is read straight
// back so the response carries whatever the table actually stored.
export const createTask = (title) => {
  const { lastInsertRowid } = db
    .prepare('INSERT INTO tasks (title, done) VALUES (?, ?)')
    .run(title, 0);
  return getTask(lastInsertRowid);
};

export default db;
