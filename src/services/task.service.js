import * as tasks from '../repositories/task.repository.js';
import { badRequest, notFound } from '../errors.js';

// The rules of the application, stated once. This file knows what makes a task
// valid and what "that task does not exist" means, but not what a request or a
// status code is, and not what SQL looks like. It is the layer you would keep if
// the API were replaced by a CLI, and the layer you would keep if SQLite were
// replaced by Postgres.

const requireTitle = (title, { optional = false } = {}) => {
  if (optional && title === undefined) return undefined;

  if (typeof title !== 'string' || title.trim() === '') {
    throw badRequest(
      optional
        ? 'Field "title" must be a non-empty string'
        : 'Field "title" is required and must be a non-empty string',
    );
  }

  return title.trim();
};

export const list = (options) => tasks.findAll(options);

export const stats = () => tasks.countByState();

export const get = (id) => {
  const task = tasks.findById(id);
  if (task === undefined) throw notFound(`Task ${id} not found`);
  return task;
};

export const create = (body) => tasks.insert(requireTitle(body?.title));

export const update = (id, body) => {
  // Existence is checked before the body is validated, so a bad id on a bad body
  // is still a 404 rather than a 400 — the same order of answers A1 gave.
  const current = get(id);

  const { title, done } = body ?? {};
  if (title === undefined && done === undefined) {
    throw badRequest('Body must contain "title" and/or "done"');
  }
  if (done !== undefined && typeof done !== 'boolean') {
    throw badRequest('Field "done" must be true or false');
  }

  // PUT accepts partial bodies: whatever the caller left out is filled in from
  // the row as it stands, so the repository can always write both columns.
  return tasks.update(id, {
    title: requireTitle(title, { optional: true }) ?? current.title,
    done: done ?? current.done,
  });
};

export const remove = (id) => {
  if (!tasks.remove(id)) throw notFound(`Task ${id} not found`);
};

export const reset = () => tasks.reset();
