import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const SERVER = fileURLToPath(new URL('../server.js', import.meta.url));

// Where the tests find a Postgres to work against: the same DATABASE_URL the rest
// of the project uses, which means the database has to be running before
// `npm test` — `docker compose up -d db` is enough.
const ADMIN_URL = process.env.DATABASE_URL;

if (!ADMIN_URL) {
  throw new Error(
    'DATABASE_URL is not set — copy .env.example to .env and start the database first.',
  );
}

const onAdmin = async (sql) => {
  const client = new pg.Client({ connectionString: ADMIN_URL });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
};

// A2 gave each run a throwaway directory so the tests never touched the real
// tasks.db. A database server has no directories, so the equivalent is a
// throwaway *database* — created before the suite, dropped after, named uniquely
// so two suites running at once cannot collide. Same guarantee as before: every
// run starts empty and gets the three seeds.
export const createStore = async () => {
  const name = `tasks_test_${randomBytes(6).toString('hex')}`;
  await onAdmin(`CREATE DATABASE "${name}"`);

  const url = new URL(ADMIN_URL);
  url.pathname = `/${name}`;

  return { name, DATABASE_URL: url.toString() };
};

// WITH (FORCE) evicts whatever is still connected. Without it, a pool connection
// left over from a killed server would keep the database alive, the drop would
// fail, and every run would leave debris behind.
export const destroyStore = async (store) => {
  if (!store) return;
  await onAdmin(`DROP DATABASE IF EXISTS "${store.name}" WITH (FORCE)`);
};

export const startServer = async ({ port, store }) => {
  const server = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: String(port), DATABASE_URL: store.DATABASE_URL },
    stdio: 'ignore',
  });

  const deadline = Date.now() + 30_000;
  for (;;) {
    try {
      const res = await fetch(`http://localhost:${port}/health`);
      if (res.ok) return server;
    } catch {
      // Not listening yet — the server does not open the port until the schema
      // is applied and the seeds are in.
    }

    if (Date.now() > deadline) throw new Error('server did not start in time');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
};

export const stopServer = async (server) => {
  if (!server || server.exitCode !== null) return;
  const exited = new Promise((resolve) => server.once('exit', resolve));
  server.kill();
  await exited;
};

// A tiny client so the tests read like requests rather than like fetch plumbing.
export const client = (port) => {
  const base = `http://localhost:${port}`;

  const api = async (path, options) => {
    const res = await fetch(base + path, options);
    const text = await res.text();
    return { status: res.status, body: text === '' ? undefined : JSON.parse(text) };
  };

  const json = (method) => (body) => ({
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  return { api, post: json('POST'), put: json('PUT'), del: { method: 'DELETE' } };
};
