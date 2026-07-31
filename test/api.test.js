import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { client, createStore, destroyStore, startServer, stopServer } from './helpers.js';

// These tests describe the API exactly as Assignment 1 left it: endpoints,
// request shapes, response shapes, status codes. Not one line of this file
// mentions SQLite, Postgres, a table, or a query — which is the point. They were
// written against the in-memory version and they pass, unchanged, against both
// database-backed ones. See the README section "Why the tests didn't change".
//
// Run them with: npm test

const PORT = Number(process.env.TEST_PORT ?? 3100);
const { api, post, put, del } = client(PORT);

let server;
let store;

before(async () => {
  store = await createStore();
  server = await startServer({ port: PORT, store });
});

after(async () => {
  await stopServer(server);
  await destroyStore(store);
});

describe('the API contract carried over from Assignment 1', () => {
  it('starts from exactly three seeded tasks', async () => {
    await api('/reset', post({}));
    const { status, body } = await api('/tasks');

    assert.equal(status, 200);
    assert.equal(body.length, 3);
    assert.deepEqual(
      body.map((t) => t.title),
      ['Read the assignment', 'Build the Task API', 'Push it to GitHub'],
    );
  });

  it('returns done as a real boolean', async () => {
    const { body } = await api('/tasks/1');
    assert.equal(typeof body.done, 'boolean');
    assert.equal(body.done, true);
  });

  it('creates a task with 201 and an id the client did not choose', async () => {
    const { status, body } = await api('/tasks', post({ title: 'Buy milk' }));

    assert.equal(status, 201);
    assert.equal(body.title, 'Buy milk');
    assert.equal(body.done, false);
    assert.ok(Number.isInteger(body.id));

    const fetched = await api(`/tasks/${body.id}`);
    assert.equal(fetched.status, 200);
    assert.deepEqual(fetched.body, body);
  });

  it('rejects a missing, non-string or whitespace-only title with 400', async () => {
    for (const bad of [{}, { title: '' }, { title: '   ' }, { title: 42 }]) {
      const { status, body } = await api('/tasks', post(bad));
      assert.equal(status, 400, `expected 400 for ${JSON.stringify(bad)}`);
      assert.match(body.error, /title/);
    }
  });

  it('trims the title it stores', async () => {
    const { body } = await api('/tasks', post({ title: '  Water the plants  ' }));
    assert.equal(body.title, 'Water the plants');
  });

  it('updates a partial body, leaving the other field alone', async () => {
    const { body: created } = await api('/tasks', post({ title: 'Walk the dog' }));

    const toggled = await api(`/tasks/${created.id}`, put({ done: true }));
    assert.equal(toggled.status, 200);
    assert.equal(toggled.body.done, true);
    assert.equal(toggled.body.title, 'Walk the dog');

    const renamed = await api(`/tasks/${created.id}`, put({ title: 'Walk the cat' }));
    assert.equal(renamed.body.title, 'Walk the cat');
    assert.equal(renamed.body.done, true, 'done should survive a title-only update');
  });

  it('rejects an empty or invalid update body with 400', async () => {
    for (const bad of [{}, { title: '' }, { done: 'yes' }]) {
      const { status } = await api('/tasks/1', put(bad));
      assert.equal(status, 400, `expected 400 for ${JSON.stringify(bad)}`);
    }
  });

  it('deletes with 204 and an empty body, then 404s on the same id', async () => {
    const { body: created } = await api('/tasks', post({ title: 'Temporary' }));

    const deleted = await api(`/tasks/${created.id}`, del);
    assert.equal(deleted.status, 204);
    assert.equal(deleted.body, undefined);

    const gone = await api(`/tasks/${created.id}`);
    assert.equal(gone.status, 404);
    assert.match(gone.body.error, /not found/);
  });

  it('404s an unknown id on every route that takes one', async () => {
    const requests = [
      ['/tasks/9999', undefined],
      ['/tasks/9999', put({ done: true })],
      ['/tasks/9999', del],
      ['/tasks/not-a-number', undefined],
    ];

    for (const [path, options] of requests) {
      const { status, body } = await api(path, options);
      assert.equal(status, 404, `expected 404 for ${options?.method ?? 'GET'} ${path}`);
      assert.equal(typeof body.error, 'string', 'errors are JSON, never HTML');
    }
  });

  it('answers unparseable JSON with a 400 in JSON', async () => {
    const { status, body } = await api('/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ not json',
    });

    assert.equal(status, 400);
    assert.equal(typeof body.error, 'string');
  });

  it('filters, searches and pages', async () => {
    await api('/reset', post({}));

    const done = await api('/tasks?done=true');
    assert.equal(done.body.length, 1);
    assert.ok(done.body.every((t) => t.done === true));

    const search = await api('/tasks?search=GITHUB');
    assert.equal(search.body.length, 1, 'search should be case-insensitive');

    const page = await api('/tasks?limit=2&offset=1');
    assert.deepEqual(
      page.body.map((t) => t.id),
      [2, 3],
    );

    for (const bad of ['?done=maybe', '?limit=0', '?offset=-1']) {
      const { status } = await api(`/tasks${bad}`);
      assert.equal(status, 400, `expected 400 for ${bad}`);
    }
  });

  it('counts tasks by state', async () => {
    await api('/reset', post({}));
    const { body } = await api('/stats');
    assert.deepEqual(body, { total: 3, done: 1, open: 2 });
  });
});
