import { query, transaction } from './connection.js';

// Everything that defines the shape of the database: the table, the indexes, and
// the example rows. Nothing here answers a request — that is the repository's job.

export const SEED_TASKS = [
  { title: 'Read the assignment', done: true },
  { title: 'Build the Task API', done: false },
  { title: 'Push it to GitHub', done: false },
];

// The API has promised `"created_at": "2026-07-31T18:23:49Z"` since A2, and the
// column underneath is now a real timestamptz rather than SQLite's text. Every
// read therefore names its columns instead of saying SELECT *, so the two stamps
// can be formatted on their way out and the shape the client sees never moves.
//
// A fixed piece of SQL, never user input, which is why it is interpolated.
export const TASK_COLUMNS = `
  id,
  title,
  done,
  to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
  to_char(updated_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS updated_at
`;

// SERIAL is Postgres's "the database picks the id": a sequence object hands out
// the next number and never looks back, so a deleted id is never issued again —
// the promise A1 made with a Math.max, kept here by the engine. And `done` is a
// real BOOLEAN, so the 0/1 translation A2 needed is simply gone.
//
// timestamptz, not text: an instant the database understands rather than a string
// it can only compare alphabetically. now() is the transaction's start time, so
// both stamps on a new row are identical to the microsecond.
const createTable = () =>
  query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id         SERIAL      PRIMARY KEY,
      title      TEXT        NOT NULL,
      done       BOOLEAN     NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

// An index is a sorted lookup structure the database keeps beside the table so it
// can find matching rows without reading every one of them. These two cover the
// WHERE done = $1 filter and the ORDER BY title sort.
//
// An index sorted one way cannot answer a query that wants another, so the second
// one is declared on exactly the expression the sort uses — lower(title), then id
// as the tiebreaker. Postgres calls that an expression index, and it is the
// direct translation of A2's `title COLLATE NOCASE, id`.
//
// Neither index helps ?search=: ILIKE '%milk%' has a leading wildcard, and an
// index is only useful when you know how a value starts.
const createIndexes = () =>
  query(`
    CREATE INDEX IF NOT EXISTS idx_tasks_done  ON tasks (done);
    CREATE INDEX IF NOT EXISTS idx_tasks_title ON tasks (lower(title), id);
  `);

export const applySchema = async () => {
  await createTable();
  await createIndexes();
};

// The three examples, inserted as one statement so they are all-or-nothing: a
// failure partway through would otherwise leave the table holding one seed — no
// longer empty, so the "is it empty?" count would never fire again and the
// database would be permanently stuck one-third seeded.
//
// The placeholder list is generated rather than typed out, but it is generated
// from SEED_TASKS.length — a number this file owns — and every actual value still
// travels as a parameter. Nothing a client sends comes anywhere near it.
export const insertSeeds = (run = query) => {
  const rows = SEED_TASKS.map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`).join(', ');
  const params = SEED_TASKS.flatMap((task) => [task.title, task.done]);

  return run(`INSERT INTO tasks (title, done) VALUES ${rows}`, params);
};

// Counting first is what stops the examples multiplying on every restart, and the
// count and the insert share one transaction so two copies of the app starting at
// the same moment cannot both read "empty" and both seed.
export const seedIfEmpty = () =>
  transaction(async (run) => {
    // An exclusive lock held until COMMIT: the second starter waits here, then
    // reads a table that is no longer empty. Cheap, because this runs once at
    // startup and blocks nothing else.
    await run('LOCK TABLE tasks IN EXCLUSIVE MODE');

    const { rows } = await run('SELECT COUNT(*)::int AS count FROM tasks');
    if (rows[0].count === 0) await insertSeeds(run);
  });
