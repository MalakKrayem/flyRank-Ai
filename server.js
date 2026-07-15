import express from 'express';

const app = express();
const PORT = process.env.PORT || 3000;

// The "database": an in-memory list. Everything here is lost on restart.
let tasks = [
  { id: 1, title: 'Read the assignment', done: true },
  { id: 2, title: 'Build the Task API', done: false },
  { id: 3, title: 'Push it to GitHub', done: false },
];

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

app.listen(PORT, () => {
  console.log(`Task API listening on http://localhost:${PORT}`);
});
