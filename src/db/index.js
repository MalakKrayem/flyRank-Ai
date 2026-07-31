import db from './connection.js';
import { applySchema, makeSeeder } from './schema.js';

// The database's startup sequence, and the reason it is its own module: importing
// this file is what guarantees the table exists before anybody queries it. The
// repository imports `db` from here rather than from connection.js, so the import
// graph itself enforces the ordering — there is no way to get a connection that
// has not been through the schema.

applySchema(db);

export const insertSeeds = makeSeeder(db);

// Counting first is what stops the examples multiplying on every restart.
const seedIfEmpty = db.transaction(() => {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM tasks').get();
  if (count === 0) insertSeeds();
});

seedIfEmpty();

export default db;
