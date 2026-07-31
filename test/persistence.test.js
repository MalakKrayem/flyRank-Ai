import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { client, makeWorkDir, removeWorkDir, startServer, stopServer } from './helpers.js';

// Everything Assignment 1 could not do. Each test here stops the server and
// starts a new one against the same database file — the in-memory version fails
// all of them by design, which is exactly what Week 3 set out to change.

const PORT = Number(process.env.TEST_PORT ?? 3101);
const { api, post, put } = client(PORT);

let server;
let workDir;

// One database file, many server lifetimes.
const restart = async () => {
  await stopServer(server);
  server = await startServer({ port: PORT, workDir });
};

before(async () => {
  workDir = makeWorkDir();
  server = await startServer({ port: PORT, workDir });
});

after(async () => {
  await stopServer(server);
  removeWorkDir(workDir);
});

describe('what the database bought us', () => {
  it('seeds three tasks on the first run and never again', async () => {
    await restart();
    await restart();
    await restart();

    const { body } = await api('/tasks');
    assert.equal(body.length, 3, 'four starts, still three tasks — the seed ran once');
  });

  it('keeps created tasks across a restart', async () => {
    const { body: created } = await api('/tasks', post({ title: 'Survive the restart' }));

    await restart();

    const { status, body } = await api(`/tasks/${created.id}`);
    assert.equal(status, 200);
    assert.equal(body.title, 'Survive the restart');
  });

  it('keeps updates and deletions across a restart', async () => {
    const { body: created } = await api('/tasks', post({ title: 'Doomed' }));
    await api(`/tasks/${created.id}`, put({ done: true }));

    await restart();
    const afterUpdate = await api(`/tasks/${created.id}`);
    assert.equal(afterUpdate.body.done, true, 'the update outlived the process');

    await api(`/tasks/${created.id}`, { method: 'DELETE' });

    await restart();
    const afterDelete = await api(`/tasks/${created.id}`);
    assert.equal(afterDelete.status, 404, 'and so did the deletion');
  });

  it('never reuses the id of a deleted task', async () => {
    const { body: first } = await api('/tasks', post({ title: 'First' }));
    await api(`/tasks/${first.id}`, { method: 'DELETE' });

    await restart();

    const { body: second } = await api('/tasks', post({ title: 'Second' }));
    assert.ok(second.id > first.id, `${second.id} should be past the deleted ${first.id}`);
  });

  it('stamps created_at once and moves updated_at on every change', async () => {
    const { body: created } = await api('/tasks', post({ title: 'Timestamped' }));

    assert.match(created.created_at, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    assert.equal(created.created_at, created.updated_at, 'a new task has never been updated');

    // The stamps have one-second resolution, so a change inside the same second
    // is indistinguishable from no change at all.
    await new Promise((resolve) => setTimeout(resolve, 1100));
    const { body: updated } = await api(`/tasks/${created.id}`, put({ done: true }));

    assert.equal(updated.created_at, created.created_at, 'created_at is set once and left alone');
    assert.ok(updated.updated_at > created.updated_at, 'updated_at moved forward');
  });

  it('sorts by title case-insensitively when asked', async () => {
    await api('/reset', post({}));
    await api('/tasks', post({ title: 'apple pie' }));
    await api('/tasks', post({ title: 'Zebra' }));

    const { body } = await api('/tasks?sort=title');
    const titles = body.map((t) => t.title);

    assert.equal(titles[0], 'apple pie', 'lowercase must not sort after every capital');
    assert.deepEqual(titles, [...titles].sort((a, b) => a.localeCompare(b)));

    const { status } = await api('/tasks?sort=colour');
    assert.equal(status, 400, 'an unknown sort column is rejected, never interpolated');
  });

  it('treats % and _ in a search as text, not wildcards', async () => {
    await api('/reset', post({}));
    await api('/tasks', post({ title: 'Buy milk (50% off)' }));
    await api('/tasks', post({ title: 'Plain milk' }));

    const wildcard = await api(`/tasks?search=${encodeURIComponent('%')}`);
    assert.equal(wildcard.body.length, 1, 'a bare % must not match every task');
    assert.equal(wildcard.body[0].title, 'Buy milk (50% off)');
  });
});
