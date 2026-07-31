import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SERVER = fileURLToPath(new URL('../server.js', import.meta.url));

// A throwaway database directory per run, so the tests never touch the real
// tasks.db and always start from the three seeds.
export const makeWorkDir = () => mkdtempSync(join(tmpdir(), 'task-api-test-'));

export const removeWorkDir = (dir) => rmSync(dir, { recursive: true, force: true });

export const startServer = async ({ port, workDir }) => {
  const server = spawn(process.execPath, [SERVER], {
    env: { ...process.env, PORT: String(port), DB_FILE: join(workDir, 'tasks.db') },
    stdio: 'ignore',
  });

  const deadline = Date.now() + 10_000;
  for (;;) {
    try {
      const res = await fetch(`http://localhost:${port}/health`);
      if (res.ok) return server;
    } catch {
      if (Date.now() > deadline) throw new Error('server did not start in time');
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
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
