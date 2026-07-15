// Thin wrapper over fetch. Every endpoint reports failure the same way — a JSON
// { error } body — so unwrap that here and let callers just catch an Error.
async function request(path, options) {
  const res = await fetch(path, options);

  if (res.status === 204) return null;

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error ?? `Request failed with status ${res.status}`);
  }
  return body;
}

const json = (method, payload) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload),
});

export const listTasks = (params = {}) => {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== '' && v !== undefined),
  );
  return request(`/tasks${query.size ? `?${query}` : ''}`);
};

export const createTask = (title) => request('/tasks', json('POST', { title }));
export const updateTask = (id, changes) => request(`/tasks/${id}`, json('PUT', changes));
export const deleteTask = (id) => request(`/tasks/${id}`, { method: 'DELETE' });
export const getStats = () => request('/stats');
export const resetTasks = () => request('/reset', { method: 'POST' });
