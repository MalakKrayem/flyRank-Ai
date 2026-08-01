import { useCallback, useEffect, useState } from 'react';
import * as api from './api.js';
import TaskRow from './TaskRow.jsx';

// Everything that used to live in App.jsx. It moved out for one structural
// reason: App is now the gate, and a gate cannot conditionally run hooks. Left
// where it was, this component's data-fetching effect would fire on the login
// screen too — requesting tasks for a visitor who is not allowed past the door
// yet, and flashing their errors onto a form that has nothing to do with them.
// A component that only mounts once you are signed in cannot make that mistake.

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'done', label: 'Done' },
];

// The filter maps onto the API's ?done= query rather than being applied here,
// so the list on screen is always whatever the server actually returned.
const doneParam = (filter) => (filter === 'all' ? undefined : String(filter === 'done'));

export default function TaskList() {
  const [tasks, setTasks] = useState([]);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [list, counts] = await Promise.all([
        api.listTasks({ done: doneParam(filter), search: search.trim() }),
        api.getStats(),
      ]);
      setTasks(list);
      setStats(counts);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [filter, search]);

  // Debounced so typing in the search box doesn't fire a request per keystroke.
  useEffect(() => {
    const id = setTimeout(refresh, 150);
    return () => clearTimeout(id);
  }, [refresh]);

  const run = async (action) => {
    try {
      await action();
      setError(null);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAdd = (event) => {
    event.preventDefault();
    // Deliberately not blocked client-side: the server owns this rule, and
    // submitting an empty title shows its 400 coming back through the UI.
    run(async () => {
      await api.createTask(title);
      setTitle('');
    });
  };

  return (
    <>
      {stats && (
        <dl className="stats" aria-label="Task counts">
          <div>
            <dt>Total</dt>
            <dd>{stats.total}</dd>
          </div>
          <div>
            <dt>Open</dt>
            <dd>{stats.open}</dd>
          </div>
          <div>
            <dt>Done</dt>
            <dd>{stats.done}</dd>
          </div>
        </dl>
      )}

      <form className="add" onSubmit={handleAdd}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          aria-label="New task title"
        />
        <button type="submit">Add task</button>
      </form>

      <div className="controls">
        <div className="filters" role="group" aria-label="Filter tasks">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={filter === f.key ? 'chip chip--active' : 'chip'}
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          className="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search titles…"
          aria-label="Search tasks"
        />
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="empty">Loading…</p>
      ) : tasks.length === 0 ? (
        <p className="empty">
          {search.trim() || filter !== 'all'
            ? 'No tasks match this view.'
            : 'Nothing here yet. Add your first task above.'}
        </p>
      ) : (
        <ul className="list">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onToggle={() => run(() => api.updateTask(task.id, { done: !task.done }))}
              onRename={(newTitle) => run(() => api.updateTask(task.id, { title: newTitle }))}
              onDelete={() => run(() => api.deleteTask(task.id))}
            />
          ))}
        </ul>
      )}

      <footer className="footer">
        <span>
          Data lives in Postgres, in a container — it survives a restart of the app and of the
          database. Reset puts the three seed tasks back.
        </span>
        <button type="button" className="link" onClick={() => run(api.resetTasks)}>
          Reset
        </button>
      </footer>
    </>
  );
}
