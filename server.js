import { readFileSync } from 'node:fs';
import express from 'express';
import swaggerUi from 'swagger-ui-express';

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

// Built fresh on every call so that PUT-ing a seed task and then POST /reset
// hands back the original wording rather than the mutated copy.
const seedTasks = () => [
  { id: 1, title: 'Read the assignment', done: true },
  { id: 2, title: 'Build the Task API', done: false },
  { id: 3, title: 'Push it to GitHub', done: false },
];

// The "database": an in-memory list. Everything here is lost on restart.
let tasks = seedTasks();

// Next free id: one past the highest in use, so deleting the last task
// doesn't hand its id to the next one created.
const nextId = () => (tasks.length ? Math.max(...tasks.map((t) => t.id)) + 1 : 1);

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
  let result = tasks;

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
  const done = tasks.filter((t) => t.done).length;
  res.json({ total: tasks.length, done, open: tasks.length - done });
});

app.post('/reset', (req, res) => {
  tasks = seedTasks();
  res.json(tasks);
});

app.get('/tasks/:id', (req, res) => {
  const id = Number(req.params.id);
  const task = tasks.find((t) => t.id === id);
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
