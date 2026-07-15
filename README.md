# Task API

A small CRUD API that manages a to-do list — create, read, update and delete tasks — with interactive
Swagger UI documentation at `/docs`.

Built for **FlyRank Internship · Backend Track · Week 2 · Assignment A1**, JavaScript lane
(Node.js + Express). Tasks live in an in-memory list: there is no database, and the list resets to its
three seed tasks every time the server restarts. That is deliberate — see
[The mortality experiment](#the-mortality-experiment) below.

![Swagger UI listing every endpoint of the Task API](docs/swagger-ui.png)

## Requirements

- [Node.js](https://nodejs.org) 18 or newer (`node -v` to check)

## Install & run

```bash
npm install
npm start
```

The server starts on **<http://localhost:3000>**. Open **<http://localhost:3000/docs>** for Swagger UI,
where every endpoint below can be run with the **Try it out** button — no curl required.

To run with auto-reload while editing: `npm run dev`.
To use a different port: `PORT=4000 npm start`.

### The React client (optional extra)

The assignment only asks for the API and Swagger UI. This repo also includes a small React app that uses
the same endpoints, so the CRUD cycle can be driven from a real UI instead of a docs page.

![The React client listing tasks, with total/open/done counts and filters](docs/react-client.png)

Task **#4** above is the one created by the Swagger screenshot further down — same server, same in-memory
list, viewed through a different client.

With the API already running in one terminal, in a second terminal:

```bash
npm install --prefix frontend
npm run dev --prefix frontend
```

Then open **<http://localhost:5173>**. It lists tasks, adds them, renames them inline, ticks them off,
deletes them, filters by state, searches, and shows the live counts from `/stats`.

The API sends no CORS headers and does not need to: the Vite dev server proxies `/tasks`, `/stats`,
`/reset` and `/health` to port 3000, so the browser only ever talks to one origin.

## Endpoints

| Method | Path | What it does | Success | Errors |
| --- | --- | --- | --- | --- |
| `GET` | `/` | Describes the API | `200` | — |
| `GET` | `/health` | Liveness check — returns `{"status":"ok"}` | `200` | — |
| `GET` | `/tasks` | Lists all tasks. Supports `?done=`, `?search=`, `?limit=`, `?offset=` | `200` | `400` invalid query |
| `GET` | `/tasks/:id` | Returns one task | `200` | `404` unknown id |
| `POST` | `/tasks` | Creates a task from `{"title":"..."}` | `201` | `400` missing/empty title |
| `PUT` | `/tasks/:id` | Updates `title` and/or `done` | `200` | `400` empty/invalid body · `404` unknown id |
| `DELETE` | `/tasks/:id` | Removes a task, empty body | `204` | `404` unknown id |
| `GET` | `/stats` | Counts tasks by state | `200` | — |
| `POST` | `/reset` | Restores the three seed tasks | `200` | — |
| `GET` | `/docs` | Swagger UI | `200` | — |
| `GET` | `/openapi.json` | The raw OpenAPI 3.0 spec | `200` | — |

Every error response is JSON in the shape `{ "error": "..." }`.

### The task shape

```json
{ "id": 1, "title": "Read the assignment", "done": true }
```

## Example requests

A successful create, and a 404 — real output, headers included:

```console
$ curl -i -X POST http://localhost:3000/tasks \
    -H "Content-Type: application/json" \
    -d '{"title":"Buy milk"}'
HTTP/1.1 201 Created
X-Powered-By: Express
Content-Type: application/json; charset=utf-8
Content-Length: 40
ETag: ...
Date: ...
Connection: keep-alive
Keep-Alive: timeout=5

{"id":4,"title":"Buy milk","done":false}

$ curl -i http://localhost:3000/tasks/99
HTTP/1.1 404 Not Found
X-Powered-By: Express
Content-Type: application/json; charset=utf-8
Content-Length: 29
ETag: ...
Date: ...
Connection: keep-alive
Keep-Alive: timeout=5

{"error":"Task 99 not found"}
```

The full CRUD cycle:

```bash
curl -i -X POST http://localhost:3000/tasks -H "Content-Type: application/json" -d '{"title":"Buy milk"}'   # 201
curl -i http://localhost:3000/tasks                                                                        # 200
curl -i -X PUT http://localhost:3000/tasks/4 -H "Content-Type: application/json" -d '{"done":true}'        # 200
curl -i -X DELETE http://localhost:3000/tasks/4                                                            # 204
curl -i http://localhost:3000/tasks/4                                                                      # 404
```

Filtering, search and pagination:

```bash
curl "http://localhost:3000/tasks?done=true"        # only finished tasks
curl "http://localhost:3000/tasks?search=milk"      # titles containing "milk" (case-insensitive)
curl "http://localhost:3000/tasks?limit=2&offset=2" # page through the list
curl "http://localhost:3000/stats"                  # {"total":3,"done":1,"open":2}
```

Real APIs never return "everything" from a list endpoint: the list only grows, so an unbounded `GET /tasks`
sends a response whose size and cost nobody controls — slow for the client, expensive for the server, and
liable to fall over exactly when the app becomes popular. `limit`/`offset` make the cost of a request
predictable regardless of how much data exists.

## Swagger UI

`/docs` is not just a list — every endpoint has a **Try it out** button that sends a real request. Here is
`POST /tasks` being executed from the page itself, with the server's live `201` and the created task coming
back:

![POST /tasks executed from Swagger UI, returning 201 Created and the new task](docs/swagger-try-it-out.png)

The whole CRUD cycle — create, list, update, delete — works this way without touching curl.

## The mortality experiment

Create a few tasks, stop the server, start it again, then `GET /tasks`: the tasks you added are gone and the
original three are back. Nothing is broken — the list only ever existed in the server process's memory, so
quitting the process threw it away, and the seed data is rebuilt from scratch on the next start.

Keeping data past a restart means writing it somewhere outside the process — a file, or a database. That is
what next week is for.

## Project layout

```
server.js        the whole API — routes, validation, in-memory list
openapi.json     the OpenAPI 3.0 spec that Swagger UI renders at /docs
frontend/
  vite.config.js dev-server proxy to the API on port 3000
  src/api.js     fetch wrapper — unwraps the { error } bodies
  src/App.jsx    the task list, filters and stats
  src/TaskRow.jsx one row: toggle, inline rename, delete
```

## Notes on design

A few decisions worth calling out:

- **`PUT` accepts partial bodies.** Sending `{"done":true}` leaves `title` alone. Strict REST would call this
  `PATCH`, but the assignment specifies `PUT` for "title and/or done", so that is what it does.
- **Ids are never reused.** The next id is one past the highest currently in use, so deleting the newest task
  does not hand its id to the next one created.
- **Unparseable JSON returns a JSON error.** Express's default handler answers with an HTML error page, which
  would break the "every error is JSON" rule, so there is an explicit handler for it.
- **Whitespace-only titles are rejected.** `{"title":"   "}` is a `400`, not a task named `"   "`.
- **The React client does not re-validate.** Submitting an empty title sends the request anyway and shows the
  server's `400` message, because the server is the thing that owns that rule.
