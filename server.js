import express from 'express';

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

// The "database": an in-memory list. Everything here is lost on restart.
let tasks = [
  { id: 1, title: 'Read the assignment', done: true },
  { id: 2, title: 'Build the Task API', done: false },
  { id: 3, title: 'Push it to GitHub', done: false },
];

// Next free id: one past the highest in use, so deleting the last task
// doesn't hand its id to the next one created.
const nextId = () => (tasks.length ? Math.max(...tasks.map((t) => t.id)) + 1 : 1);

app.get('/', (req, res) => {
  res.json({
    name: 'Task API',
    version: '1.0',
    endpoints: ['/tasks'],
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/tasks', (req, res) => {
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
