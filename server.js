import { readFileSync } from 'node:fs';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { listTasks, getTask } from './db.js';

const openapiSpec = JSON.parse(readFileSync(new URL('./openapi.json', import.meta.url)));

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// express.json() throws on unparseable bodies; without this the client gets
// Express's default HTML error page instead of our JSON error shape.
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Request body is not valid JSON' });
  }
  next(err);
});

// Migration in progress: reads come from SQLite (see db.js), while the write
// endpoints below still push onto this list. They move to SQL in Stages 2 and 3.
const seedTasks = () => [
  { id: 1, title: 'Read the assignment', done: true },
  { id: 2, title: 'Build the Task API', done: false },
  { id: 3, title: 'Push it to GitHub', done: false },
];

let tasks = seedTasks();

const nextId = () => (tasks.length ? Math.max(...tasks.map((t) => t.id)) + 1 : 1);

// `/tasks/abc` used to become NaN and simply miss every list entry. A NaN handed
// to a SQL parameter is a different kind of nothing, so bad ids are caught here
// and answered with the same 404 as an id that is merely unused.
const parseId = (raw) => {
  const id = Number(raw);
  return Number.isInteger(id) ? id : undefined;
};

app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec, { customSiteTitle: 'Task API — docs' }));

app.get('/openapi.json', (req, res) => {
  res.json(openapiSpec);
});

app.get('/', (req, res) => {
  res.json({
    name: 'Task API',
    version: '1.0',
    endpoints: ['/tasks'],
    docs: '/docs',
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/tasks', (req, res) => {
  const { done, search, limit, offset } = req.query;
  let result = listTasks();

  if (done !== undefined) {
    if (done !== 'true' && done !== 'false') {
      return res.status(400).json({ error: 'Query parameter "done" must be true or false' });
    }
    result = result.filter((t) => t.done === (done === 'true'));
  }

  if (search !== undefined) {
    const needle = String(search).toLowerCase();
    result = result.filter((t) => t.title.toLowerCase().includes(needle));
  }

  // Pagination is applied last, so limit/offset page through the filtered set.
  if (offset !== undefined) {
    const skip = Number(offset);
    if (!Number.isInteger(skip) || skip < 0) {
      return res.status(400).json({ error: 'Query parameter "offset" must be an integer >= 0' });
    }
    result = result.slice(skip);
  }

  if (limit !== undefined) {
    const take = Number(limit);
    if (!Number.isInteger(take) || take < 1) {
      return res.status(400).json({ error: 'Query parameter "limit" must be an integer >= 1' });
    }
    result = result.slice(0, take);
  }

  res.json(result);
});

app.get('/stats', (req, res) => {
  const all = listTasks();
  const done = all.filter((t) => t.done).length;
  res.json({ total: all.length, done, open: all.length - done });
});

app.post('/reset', (req, res) => {
  tasks = seedTasks();
  res.json(tasks);
});

app.get('/tasks/:id', (req, res) => {
  const id = parseId(req.params.id);
  const task = id === undefined ? undefined : getTask(id);
  if (!task) {
    return res.status(404).json({ error: `Task ${req.params.id} not found` });
  }
  res.json(task);
});

app.post('/tasks', (req, res) => {
  const { title } = req.body ?? {};
  if (typeof title !== 'string' || title.trim() === '') {
    return res.status(400).json({ error: 'Field "title" is required and must be a non-empty string' });
  }
  const task = { id: nextId(), title: title.trim(), done: false };
  tasks.push(task);
  res.status(201).json(task);
});

app.put('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const task = tasks.find((t) => t.id === id);
  if (!task) {
    return res.status(404).json({ error: `Task ${req.params.id} not found` });
  }

  const { title, done } = req.body ?? {};
  if (title === undefined && done === undefined) {
    return res.status(400).json({ error: 'Body must contain "title" and/or "done"' });
  }
  if (title !== undefined && (typeof title !== 'string' || title.trim() === '')) {
    return res.status(400).json({ error: 'Field "title" must be a non-empty string' });
  }
  if (done !== undefined && typeof done !== 'boolean') {
    return res.status(400).json({ error: 'Field "done" must be true or false' });
  }

  if (title !== undefined) task.title = title.trim();
  if (done !== undefined) task.done = done;
  res.json(task);
});

app.delete('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const index = tasks.findIndex((t) => t.id === id);
  if (index === -1) {
    return res.status(404).json({ error: `Task ${req.params.id} not found` });
  }
  tasks.splice(index, 1);
  res.status(204).end();
});

app.listen(PORT, () => {
  console.log(`Task API listening on http://localhost:${PORT}`);
});
