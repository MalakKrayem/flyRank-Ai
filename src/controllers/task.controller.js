import * as taskService from '../services/task.service.js';
import { badRequest, notFound } from '../errors.js';

// The translation layer between HTTP and the application. It reads req, calls one
// service function, and picks the success status code. It does not decide whether
// a title is valid or whether a task exists — when the service throws, the error
// middleware turns that into the response, which is why there is not a single
// try/catch in this file.
//
// What it does own is the fact that a request arrives as text: `?limit=2` is the
// string "2" and `/tasks/abc` is the string "abc". Turning those into values the
// service can use, and rejecting the ones that cannot be turned into anything, is
// an HTTP concern and stops here.

// `/tasks/abc` used to become NaN and simply miss every list entry. A NaN handed
// to a SQL parameter is a different kind of nothing, so bad ids are caught here
// and answered with the same 404 as an id that is merely unused.
//
// The upper bound is the same idea one step further. `id` is a SERIAL, which is a
// 32-bit integer, and Postgres answers a request for /tasks/99999999999 with an
// out-of-range error — a 500 for what is plainly just an id that does not exist.
// A number no id can ever be is a 404 like any other.
const MAX_ID = 2_147_483_647;

const parseId = (raw) => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id < 1 || id > MAX_ID) throw notFound(`Task ${raw} not found`);
  return id;
};

const parseListQuery = ({ done, search, sort, limit, offset }) => {
  const options = {};

  if (done !== undefined) {
    if (done !== 'true' && done !== 'false') {
      throw badRequest('Query parameter "done" must be true or false');
    }
    options.done = done === 'true';
  }

  if (search !== undefined) {
    options.search = String(search);
  }

  if (sort !== undefined) {
    if (sort !== 'id' && sort !== 'title') {
      throw badRequest('Query parameter "sort" must be id or title');
    }
    options.sort = sort;
  }

  if (offset !== undefined) {
    const skip = Number(offset);
    if (!Number.isInteger(skip) || skip < 0) {
      throw badRequest('Query parameter "offset" must be an integer >= 0');
    }
    options.offset = skip;
  }

  if (limit !== undefined) {
    const take = Number(limit);
    if (!Number.isInteger(take) || take < 1) {
      throw badRequest('Query parameter "limit" must be an integer >= 1');
    }
    options.limit = take;
  }

  return options;
};

// Every handler is async now, and there is still not one try/catch: Express 5
// forwards a rejected promise to the error handler exactly as it forwards a
// thrown error, so a database that says no arrives at the same place a bad title
// does. That is the whole cost of moving from a synchronous file to a server.

export const list = async (req, res) => {
  res.json(await taskService.list(parseListQuery(req.query)));
};

export const getOne = async (req, res) => {
  res.json(await taskService.get(parseId(req.params.id)));
};

export const create = async (req, res) => {
  res.status(201).json(await taskService.create(req.body));
};

export const update = async (req, res) => {
  res.json(await taskService.update(parseId(req.params.id), req.body));
};

export const remove = async (req, res) => {
  await taskService.remove(parseId(req.params.id));
  res.status(204).end();
};
