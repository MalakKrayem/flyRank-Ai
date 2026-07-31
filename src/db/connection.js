import pg from 'pg';
import { DATABASE_URL } from '../config.js';

// SQLite was a file this process opened. Postgres is a server this process talks
// to over a socket, which changes two things and only two: every query is now
// asynchronous, and the connection can fail — the database is a separate program
// that might not be listening yet.
//
// This file does nothing but hold the connection. Defining what is inside the
// database is a separate job — see schema.js — so either can be read on its own.

if (!DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Copy .env.example to .env, or start the stack with `docker compose up`.',
  );
}

// A pool, not a single connection. Every request that touches the database
// borrows a connection and gives it back, so concurrent requests share a handful
// of sockets instead of opening one each — and instead of queueing behind one.
const pool = new pg.Pool({ connectionString: DATABASE_URL });

// The pool emits an error for a connection that dies while idle (the database
// restarted, a network blip). Without a listener Node treats that as an unhandled
// error and kills the process; with one, the pool just discards the dead socket.
pool.on('error', (err) => {
  console.error('Idle database connection lost:', err.message);
});

// The one function the rest of the app calls. `text` is the SQL, `params` are the
// values that fill its $1, $2, … placeholders — kept apart, never glued together.
export const query = (text, params) => pool.query(text, params);

// Runs several statements on one connection inside a transaction, and puts the
// connection back whatever happens. The callback is handed a `query` of the same
// shape as the one above, so nothing written against it has to know it is inside
// a transaction.
export const transaction = async (fn) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn((text, params) => client.query(text, params));
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// `docker compose up` starts the app and the database in the same second, and
// Postgres takes a moment to begin accepting connections. compose.yaml already
// waits on the db healthcheck, but a database can also go away and come back
// while the app is running, and that should not need a human to restart the app.
// So: try, wait, try again — and give up only once the delay has stopped looking
// like a slow start and started looking like a wrong address.
export const waitForDatabase = async ({ attempts = 15, delayMs = 1000 } = {}) => {
  for (let attempt = 1; ; attempt++) {
    try {
      await query('SELECT 1');
      return;
    } catch (err) {
      if (attempt >= attempts) throw err;
      console.log(`Database not ready (${err.message}) — retrying in ${delayMs}ms`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
};

export default pool;
