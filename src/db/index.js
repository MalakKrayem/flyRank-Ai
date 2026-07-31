import { waitForDatabase } from './connection.js';
import { applySchema, seedIfEmpty } from './schema.js';

// The database's startup sequence, in the order it has to happen: reach the
// server, make sure the table is there, put the examples in if it is empty.
//
// Under SQLite this ran the moment the module was imported — opening a file is
// instant, so "import it and the schema is applied" was true. Talking to a server
// is not instant and can fail, so the sequence is now a function the entry point
// awaits before it starts listening. That is the honest version of the same
// guarantee: no request can arrive before the table exists, because the port is
// not open until this has finished.
export const initDatabase = async () => {
  await waitForDatabase();
  await applySchema();
  await seedIfEmpty();
};
