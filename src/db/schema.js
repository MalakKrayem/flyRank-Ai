// Everything that defines the shape of the database: the table, the indexes, the
// migration that brings older files up to date, and the example rows. Nothing
// here answers a request — that is the repository's job.

// An ISO-8601 timestamp from the database's own clock rather than the app's, so
// every row is stamped by one authority. It is a fixed piece of SQL, never user
// input, which is why it can be interpolated into statements.
export const NOW = `strftime('%Y-%m-%dT%H:%M:%SZ', 'now')`;

export const SEED_TASKS = [
  { title: 'Read the assignment', done: 1 },
  { title: 'Build the Task API', done: 0 },
  { title: 'Push it to GitHub', done: 0 },
];

// AUTOINCREMENT, not a bare INTEGER PRIMARY KEY: without it SQLite reuses the id of
// the highest deleted row, and A1 promised ids are never handed out twice.
// done is 0/1 — SQLite has no boolean type — and the CHECK keeps anything else out.
const createTable = (db) =>
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
const migrateTimestamps = (db) =>
  db.transaction(() => {
    const columns = db.prepare('PRAGMA table_info(tasks)').all().map((c) => c.name);

    for (const column of ['created_at', 'updated_at']) {
      if (columns.includes(column)) continue;
      db.exec(`ALTER TABLE tasks ADD COLUMN ${column} TEXT NOT NULL DEFAULT ''`);
      db.exec(`UPDATE tasks SET ${column} = ${NOW} WHERE ${column} = ''`);
    }
  })();

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
const createIndexes = (db) =>
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tasks_done  ON tasks(done);
    CREATE INDEX IF NOT EXISTS idx_tasks_title ON tasks(title COLLATE NOCASE, id);
  `);

export const applySchema = (db) => {
  createTable(db);
  migrateTimestamps(db);
  createIndexes(db);
};

// A transaction so the three inserts are all-or-nothing: a crash halfway through
// can't leave the table holding one and a half seeds, which would then look
// "not empty" to the count in db/index.js and never be completed.
export const makeSeeder = (db) =>
  db.transaction(() => {
    const insert = db.prepare('INSERT INTO tasks (title, done) VALUES (?, ?)');
    for (const task of SEED_TASKS) insert.run(task.title, task.done);
  });
