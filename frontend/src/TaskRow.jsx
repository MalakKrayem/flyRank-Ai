import { useEffect, useState } from 'react';

export default function TaskRow({ task, onToggle, onRename, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);

  // If the task changes underneath us (a reset, say), drop the stale draft.
  useEffect(() => setDraft(task.title), [task.title]);

  const commit = (event) => {
    event.preventDefault();
    setEditing(false);
    if (draft.trim() !== task.title) onRename(draft);
  };

  const cancel = () => {
    setDraft(task.title);
    setEditing(false);
  };

  return (
    <li className={task.done ? 'row row--done' : 'row'}>
      <input
        type="checkbox"
        checked={task.done}
        onChange={onToggle}
        aria-label={`Mark "${task.title}" as ${task.done ? 'not done' : 'done'}`}
      />

      {editing ? (
        <form className="row__edit" onSubmit={commit}>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Escape' && cancel()}
            aria-label="Edit task title"
          />
        </form>
      ) : (
        <button type="button" className="row__title" onClick={() => setEditing(true)}>
          {task.title}
        </button>
      )}

      <span className="row__id">#{task.id}</span>
      <button type="button" className="row__delete" onClick={onDelete} aria-label={`Delete "${task.title}"`}>
        ×
      </button>
    </li>
  );
}
