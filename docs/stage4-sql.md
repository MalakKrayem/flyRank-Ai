# Stage 4 — talking to the database by hand

The five queries from the assignment, run straight against `tasks.db` while the API server was
still running, and what each one came back with. Any SQLite client works — [DB Browser for
SQLite](https://sqlitebrowser.org) has a visual **Execute SQL** tab; the transcript below is from
the `sqlite3` command line, which prints the same rows.

```bash
sqlite3 tasks.db
```

### `SELECT * FROM tasks;` — list every task

```
┌────┬─────────────────────┬──────┐
│ id │        title        │ done │
├────┼─────────────────────┼──────┤
│ 1  │ Read the assignment │ 1    │
│ 2  │ Build the Task API  │ 0    │
│ 3  │ Push it to GitHub   │ 0    │
└────┴─────────────────────┴──────┘
```

Three rows — the same three tasks `GET /tasks` serves, laid out as a table. Note `done` is `1`/`0`
here, not `true`/`false`: SQLite has no boolean type, and
`src/repositories/task.repository.js` is the one place that translates.

### `SELECT * FROM tasks WHERE done = 1;` — only completed tasks

```
┌────┬─────────────────────┬──────┐
│ id │        title        │ done │
├────┼─────────────────────┼──────┤
│ 1  │ Read the assignment │ 1    │
└────┴─────────────────────┴──────┘
```

One row. `WHERE` is the same filter `GET /tasks?done=true` performs.

### `SELECT COUNT(*) FROM tasks;` — how many tasks are there?

```
┌──────────┐
│ COUNT(*) │
├──────────┤
│ 3        │
└──────────┘
```

One row with one number, rather than the rows themselves — this is what `GET /stats` is built from.

### `UPDATE tasks SET done = 1;` — mark every task completed

No output, and no `WHERE` clause, so it hits **every** row. Calling `GET /tasks` immediately
afterwards — without restarting the server — returned all three tasks with `"done": true`.

### `DELETE FROM tasks WHERE done = 1;` — delete all completed tasks

Since the previous query had marked everything done, this emptied the table. `GET /tasks` then
returned `[]` and `GET /stats` returned `{"total":0,"done":0,"open":0}`.

`POST /reset` put the three examples back.

## What this stage actually proves

The API and the SQL client were both open at once, pointed at the same file, and the API picked up
a change made behind its back with no restart and no "sync" step. There is one copy of the data and
it lives in `tasks.db` — the server is a reader and writer of that file, not the owner of the truth.

The other lesson is how easy `UPDATE tasks SET done = 1;` is to type. A forgotten `WHERE` is not an
error — it is a valid query that means *every row*, and the database will do it instantly and
without asking.
