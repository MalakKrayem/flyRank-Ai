# Task API

A small CRUD API that manages a to-do list — create, read, update and delete tasks — with interactive
Swagger UI documentation at `/docs`.

Built for **FlyRank Internship · Backend Track** — the API and Swagger UI in A1, its storage moved
onto a real database in A2, and in A3 that database became **PostgreSQL running in a container**,
with the app beside it. JavaScript lane: Node.js + Express + Postgres + Docker Compose.

The whole stack — API and database — starts with **one command**:

```bash
cp .env.example .env && docker compose up
```

![Swagger UI listing every endpoint of the Task API](docs/swagger-ui.png)

## The point of this one

Storage has climbed a ladder, and the API on top never noticed:

| Assignment | Where tasks live | What runs it | Survives |
| --- | --- | --- | --- |
| A1 | an array in memory | the Node process | nothing |
| A2 | a `tasks.db` file | SQLite, inside the process | a restart of the app |
| **A3 (this)** | rows in Postgres | **a container — a real database server** | a restart of the app *and* of the database |

Same five endpoints, same request and response shapes, same status codes, three completely different
things underneath. That is not a coincidence — it is what the layers were for, and
[the tests prove it](#why-the-tests-didnt-change).

## Requirements

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) or [Podman](https://podman.io) —
  `docker --version` to check.

That is the entire list. **You do not install Postgres and you do not install Node.** Both arrive as
containers, described by [`compose.yaml`](compose.yaml) and [`Dockerfile`](Dockerfile), and both are
thrown away when you are finished with them.

Node.js 20.12+ is needed only if you want to run the app or the tests directly on your machine
instead of in a container.

## Install & run

```bash
cp .env.example .env
docker compose up
```

The first run builds the API image and downloads Postgres, so it takes a minute. Every run after that
is a few seconds. What happens:

1. `db` starts the official `postgres:17-alpine` image and creates an empty `tasks` database.
2. `api` waits for the database's healthcheck to pass — not just for its container to exist.
3. The app connects, creates the `tasks` table if it is missing, and seeds three example tasks if the
   table is empty.
4. The port opens. **<http://localhost:3000>** is a working, populated API.

Timed on a clean clone with the images already downloaded, that whole sequence takes **20 seconds**,
and there is no database to install at either end of it. Leave `.env` out and compose refuses to
start rather than quietly bringing up a database with a blank password:

```console
$ docker compose up
error while interpolating services.db.environment.POSTGRES_PASSWORD:
required variable POSTGRES_PASSWORD is missing a value: set POSTGRES_PASSWORD in .env — copy .env.example
```

Open **<http://localhost:3000/docs>** for Swagger UI, where every endpoint below can be run with the
**Try it out** button — no curl required.

```bash
docker compose up -d          # start in the background
docker compose logs -f api    # follow the app's logs
docker compose down           # stop everything — the data stays in the volume
docker compose down -v        # stop everything and delete the data too
```

### Configuration

Every setting lives in `.env`, which is **git-ignored**. [`.env.example`](.env.example) is committed
in its place with the same keys and placeholder values, so a clone knows what to set without being
told a secret.

| Variable | What it is | Default in `.env.example` |
| --- | --- | --- |
| `POSTGRES_USER` | Database user, created by the `db` container | `postgres` |
| `POSTGRES_PASSWORD` | Its password. **Compose refuses to start without one.** | `dev` |
| `POSTGRES_DB` | Database created on first start | `tasks` |
| `PORT` | Host port the API is published on | `3000` |
| `DATABASE_URL` | The whole connection as one string — used when you run the app *outside* compose (`npm start`, `npm test`) | `postgres://postgres:dev@localhost:5432/tasks` |

Under `docker compose up` the api service does not read `DATABASE_URL` from `.env`: compose builds
one for it pointing at `db`, the database's *service name*, because inside the compose network
`localhost` means "this container" and nothing is listening on 5432 there.

### Running it without Docker

If you would rather run Node on your machine and keep only the database in a container:

```bash
docker compose up -d db   # just the database
npm install
npm start                 # reads DATABASE_URL from .env — localhost, not db
```

`npm run dev` does the same with auto-reload. `npm test` needs the database running the same way, and
creates (and drops) its own throwaway databases beside it.

### The database without compose

Before there was a `compose.yaml` there was one long `docker run`, and it is worth keeping around
because it is compose's whole job written out by hand:

```bash
docker run --name taskdb \
  -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=tasks \
  -p 5432:5432 -v taskdata:/var/lib/postgresql/data \
  -d postgres:17-alpine
```

Run the official image, name the container `taskdb`, set a password and a database called `tasks`,
publish port 5432 to this machine, mount the named volume `taskdata` where Postgres keeps its data,
and detach. `docker stop taskdb` when you are done — the port has to be free before
`docker compose up` can claim it.

Every one of those flags reappears in [`compose.yaml`](compose.yaml) as a line of YAML. That is what
compose is: the same arguments, written down instead of retyped, for more than one container at once.

## The React client (optional extra)

The assignment only asks for the API and Swagger UI. This repo also includes a small React app that
uses the same endpoints, so the CRUD cycle can be driven from a real UI instead of a docs page.

![The React client listing tasks, with total/open/done counts and filters](docs/react-client.png)

With the API already running, in a second terminal:

```bash
npm install --prefix frontend
npm run dev --prefix frontend
```

Then open **<http://localhost:5173>**. It lists tasks, adds them, renames them inline, ticks them off,
deletes them, filters by state, searches, and shows the live counts from `/stats`.

The API sends no CORS headers and does not need to: the Vite dev server proxies `/tasks`, `/stats`,
`/reset` and `/health` to port 3000, so the browser only ever talks to one origin.

## Containers, in the smallest number of words

- An **image** is a frozen recipe: a program plus everything it needs to run.
- A **container** is a running copy of an image. Throw it away and make another; they are identical.
- A **volume** is disk that Docker keeps *outside* the container, so it outlives it.
- **Compose** is one file describing several containers and the network they share.

Which maps onto this repo as:

| Thing | Here |
| --- | --- |
| Image | `postgres:17-alpine`, and the one [`Dockerfile`](Dockerfile) builds from this source |
| Container | `db` and `api`, started together |
| Volume | `taskdata` — where the rows live, and why they survive `docker compose down` |
| Compose | [`compose.yaml`](compose.yaml) |

The two containers reach each other by service name on a private network compose creates for them.
The only doors to the outside are the ones `ports:` opens: 3000 for the API, 5432 for the database
so psql and a GUI can get in. In a real deployment that second one would be deleted.

## The database

### Why Postgres

- **It is a server, not a library.** SQLite ran *inside* the Node process; Postgres is its own
  program, on its own port, that many applications can talk to at once. That is the difference
  between one app with a file and a database several services share.
- **It handles concurrent writers.** The exact thing SQLite is bad at, and the reason projects
  eventually move.
- **It has real types.** `BOOLEAN` is a boolean and `TIMESTAMPTZ` is an instant — so the 0/1
  translation A2 needed in the repository is simply gone.
- **It is what FlyRank runs.** Stores, content and SEO reports are Postgres rows exactly like these.

The driver is [`pg`](https://node-postgres.com) — the standard, no-magic Node client. Its one visible
consequence is in [`task.repository.js`](src/repositories/task.repository.js): every function is now
`async`, because a query crosses a socket to another program instead of reading a local file.

### Where the data lives

Not in the repo, and not in the container. In a **named Docker volume** called `taskdata`, mounted at
`/var/lib/postgresql/data` inside the `db` container.

That single line in [`compose.yaml`](compose.yaml) is what makes the data outlive everything around
it. The container is disposable; the volume is not.

```bash
docker volume ls                  # taskdata is in the list
docker compose down && docker compose up   # containers replaced, rows still there
docker compose down -v            # -v deletes the volume: back to the three seeds
```

### The schema

```sql
CREATE TABLE tasks (
  id         SERIAL      PRIMARY KEY,
  title      TEXT        NOT NULL,
  done       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tasks_done  ON tasks (done);
CREATE INDEX idx_tasks_title ON tasks (lower(title), id);
```

Three things are worth pointing at, because each one replaced a workaround from A2:

- **`SERIAL`** is a sequence handing out the next number and never looking back, so a deleted id is
  never reissued. A1 kept that promise with a `Math.max`; A2 needed SQLite's `AUTOINCREMENT` keyword
  to stop it reusing ids. Here it is just how the column works.
- **`BOOLEAN`** means `done` is `true`/`false` all the way down. SQLite had no boolean type, so A2
  stored 0/1 and translated on the way out. That translation is deleted.
- **`TIMESTAMPTZ`** stores an instant the database understands rather than a string it can only
  compare alphabetically. The API still promises `"2026-07-31T18:23:49Z"`, so every read formats the
  two stamps with `to_char(...)` on the way out — which is why the queries name their columns instead
  of saying `SELECT *`.

The `?search=` filter changed too, and it is the kind of difference that only shows up when you run
the tests: SQLite's `LIKE` ignores case for ASCII by itself, Postgres's does not. `?search=GITHUB`
keeps finding "GitHub" because the query now says **`ILIKE`**.

**What the indexes are for.** An index is a sorted lookup structure the database keeps beside the
table, so it can jump to matching rows instead of reading every one — the difference between using a
book's index and reading the book.

The title one is an **expression index** on `lower(title), id`, matching the sort exactly. An index
sorted one way cannot answer a query that wants another: in A2 this was declared without the
collation and the planner silently ignored it. Neither index helps `?search=`: `ILIKE '%milk%'`
starts with a wildcard, and an index is only useful when you know how a value begins.

Both were checked with `EXPLAIN ANALYZE` against 50,000 rows, and the two answers were not the same.
`?sort=title&limit=10` went from **28.9 ms to 0.5 ms** with `idx_tasks_title`, because the rows are
already in that order and the query can read ten and stop. `?done=true` went from 2.7 ms to only
1.4 ms with `idx_tasks_done` — a tenth of the table matches, so having found those rows via the index
Postgres still has to read 467 of the table's blocks to fetch them. [The numbers and the plans are in
the psql session](docs/postgres-psql.md#explain-analyze--do-the-indexes-actually-do-anything). An
index is a guess about which questions will be asked, and it is not free — every write maintains it.

**What the transactions are for.** Seeding is one `INSERT` guarded by an "is the table empty?" count,
and both run inside a transaction that takes a lock first — so two copies of the app starting at the
same moment cannot both read "empty" and both seed. `POST /reset` is wrapped for the same reason: it
truncates the table and re-inserts, and a failure in between would otherwise leave you with nothing.

### Seeing it with your own eyes

`psql` is already inside the database container — nothing to install:

```bash
docker compose exec db psql -U postgres -d tasks
```

<!-- Replace this line with the screenshot: ![The tasks table in psql](docs/postgres-psql.png) -->
**Screenshot: `docs/postgres-psql.png` — the two commands below, run in a terminal.**

```console
tasks=# \dt
         List of relations
 Schema | Name  | Type  |  Owner
--------+-------+-------+----------
 public | tasks | table | postgres
(1 row)

tasks=# SELECT * FROM tasks;
 id |        title        | done |          created_at           |          updated_at
----+---------------------+------+-------------------------------+-------------------------------
  1 | Read the assignment | t    | 2026-07-31 20:14:09.437812+00 | 2026-07-31 20:14:09.437812+00
  2 | Build the Task API  | f    | 2026-07-31 20:14:09.437812+00 | 2026-07-31 20:14:09.437812+00
  3 | Push it to GitHub   | f    | 2026-07-31 20:14:09.437812+00 | 2026-07-31 20:14:09.437812+00
(3 rows)
```

`t` and `f` — a real boolean, not the `0`/`1` A2 had to translate on the way out.

The [full psql session](docs/postgres-psql.md) has the rest: `\d tasks` with `SERIAL`'s mask off,
`EXPLAIN ANALYZE` showing one index earning a 57× speed-up and the other earning almost nothing, and
the moment that makes the whole assignment click — running `UPDATE tasks SET done = true;` by hand
and watching `GET /tasks` report every task as done, with no restart and no syncing step. psql and
the API are not two copies of the data. They are two clients of one server.

## Endpoints

| Method | Path | What it does | Success | Errors |
| --- | --- | --- | --- | --- |
| `GET` | `/` | Describes the API | `200` | — |
| `GET` | `/health` | Liveness check — **runs `SELECT 1` against Postgres** | `200` | `503` database unreachable |
| `GET` | `/tasks` | Lists all tasks. Supports `?done=`, `?search=`, `?sort=`, `?limit=`, `?offset=` | `200` | `400` invalid query |
| `GET` | `/tasks/:id` | Returns one task | `200` | `404` unknown id |
| `POST` | `/tasks` | Creates a task from `{"title":"..."}` | `201` | `400` missing/empty title |
| `PUT` | `/tasks/:id` | Updates `title` and/or `done` | `200` | `400` empty/invalid body · `404` unknown id |
| `DELETE` | `/tasks/:id` | Removes a task, empty body | `204` | `404` unknown id |
| `GET` | `/stats` | Counts tasks by state | `200` | — |
| `POST` | `/reset` | Restores the three seed tasks | `200` | — |
| `GET` | `/docs` | Swagger UI | `200` | — |
| `GET` | `/openapi.json` | The raw OpenAPI 3.0 spec | `200` | — |

Every error response is JSON in the shape `{ "error": "..." }` — including the ones no route asked
for. An unknown URL answers `404 {"error":"Cannot GET /nope"}` rather than falling through to
Express's built-in HTML error page.

### The task shape

```json
{
  "id": 1,
  "title": "Read the assignment",
  "done": true,
  "created_at": "2026-07-31T18:23:49Z",
  "updated_at": "2026-07-31T18:23:50Z"
}
```

Byte for byte what A1 and A2 returned.

### A health check that checks something

`GET /health` used to answer `{"status":"ok"}` from the process alone, which only ever proved that
Node was running. It now runs a real `SELECT 1`:

```json
{ "status": "ok", "db": "ok" }
```

Stopping the database out from under a running API, and starting it again:

```console
$ docker compose stop db
$ curl -s -o /dev/null -w '%{http_code}' localhost:3000/health
503  {"status":"degraded","db":"unreachable","error":"getaddrinfo ENOTFOUND db"}

$ docker compose start db
$ curl -s localhost:3000/health
200  {"status":"ok","db":"ok"}

$ curl -s -o /dev/null -w '%{http_code}' localhost:3000/tasks
200
```

The API process never restarted. The pool discarded the dead connections, opened new ones when the
database came back, and `/tasks` answered as if nothing had happened.

That is the endpoint a **load balancer** polls, and the reason the status code matters more than the
body. A load balancer sits in front of several copies of an app and sends each request to one of
them; it polls this endpoint on every copy and takes any instance that stops answering 200 out of
rotation, without paging anyone. An API that cannot reach its database is not "up" — it is a 500
waiting for its first visitor, and this is how it says so.

## Example requests

A successful create, and a 404 — real output, headers included:

```console
$ curl -i -X POST http://localhost:3000/tasks \
    -H "Content-Type: application/json" \
    -d '{"title":"Buy milk"}'
HTTP/1.1 201 Created
X-Powered-By: Express
Content-Type: application/json; charset=utf-8
Content-Length: 112
ETag: W/"70-v5lnWM3IOJBZOMl4uX98/uFAyAs"
Date: Fri, 31 Jul 2026 20:13:19 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"id":4,"title":"Buy milk","done":false,"created_at":"2026-07-31T20:13:19Z","updated_at":"2026-07-31T20:13:19Z"}

$ curl -i http://localhost:3000/tasks/99
HTTP/1.1 404 Not Found
X-Powered-By: Express
Content-Type: application/json; charset=utf-8
Content-Length: 29
ETag: W/"1d-kQQdPQ+i/Wk9IgXh55Kh5auGltk"
Date: Fri, 31 Jul 2026 20:13:19 GMT
Connection: keep-alive
Keep-Alive: timeout=5

{"error":"Task 99 not found"}
```

Nothing in that output is new. It is the same 201 and the same 404 A1 produced from an array in
memory — which is the whole idea.

The full CRUD cycle:

```bash
curl -i -X POST http://localhost:3000/tasks -H "Content-Type: application/json" -d '{"title":"Buy milk"}'   # 201
curl -i http://localhost:3000/tasks                                                                        # 200
curl -i -X PUT http://localhost:3000/tasks/4 -H "Content-Type: application/json" -d '{"done":true}'        # 200
curl -i -X DELETE http://localhost:3000/tasks/4                                                            # 204
curl -i http://localhost:3000/tasks/4                                                                      # 404
```

Filtering, search, sorting and pagination — every one of them a clause in the SQL, not a loop in
JavaScript:

```bash
curl "http://localhost:3000/tasks?done=true"        # WHERE done = $1
curl "http://localhost:3000/tasks?search=milk"      # WHERE title ILIKE $1 ESCAPE '\'
curl "http://localhost:3000/tasks?sort=title"       # ORDER BY lower(title), id
curl "http://localhost:3000/tasks?limit=2&offset=2" # LIMIT $1 OFFSET $2
curl "http://localhost:3000/stats"                  # COUNT(*) FILTER (WHERE done)
```

Real APIs never return "everything" from a list endpoint: the list only grows, so an unbounded
`GET /tasks` sends a response whose size and cost nobody controls. `limit`/`offset` make the cost of a
request predictable regardless of how much data exists — and doing it in SQL means the database sends
two rows rather than the app fetching every row and discarding most of them.

## Swagger UI

`/docs` is not just a list — every endpoint has a **Try it out** button that sends a real request.
Here is `POST /tasks` being executed from the page itself, with the server's live `201` and the
created task coming back:

![POST /tasks executed from Swagger UI, returning 201 Created and the new task](docs/swagger-try-it-out.png)

The whole CRUD cycle — create, list, update, delete — works this way without touching curl.

## The mortality experiment, third edition

A1's README ended with an experiment: create a few tasks, stop the server, start it again, watch them
be gone. A2 repeated it and they survived, because they were in a file. A3 raises the stakes — this
time the *database itself* is destroyed and recreated:

```bash
curl -X POST http://localhost:3000/tasks -H "Content-Type: application/json" -d '{"title":"Survive the container"}'
docker compose down     # both containers are deleted, not stopped
docker compose up       # brand-new containers, built from the same images
curl http://localhost:3000/tasks   # "Survive the container" is still there
```

Nothing about the API changed. The task survived because the rows were never *in* the container —
they were in the `taskdata` volume, which Docker keeps outside it.

**And the version that fails.** Delete the volume too and the same sequence loses everything:

```bash
docker compose down -v && docker compose up
curl http://localhost:3000/tasks   # three seeded tasks, and nothing else
```

That is what a volume is for, in one command each way. A container's own filesystem is scratch space
that dies with it; a volume is the part you meant to keep. Forgetting the `volumes:` line is the most
common way to build a stack that works perfectly all afternoon and is empty tomorrow morning.

## Why the tests didn't change

`test/api.test.js` describes the API as A1 left it — the endpoints, the request and response shapes,
the status codes. Outside of one comment at the top explaining why, the words SQLite, Postgres,
container, table and query do not appear in it. It talks to the server over HTTP, exactly like any
other client.

**Not one assertion in it changed for this assignment.** The only edit was five lines of fixture in
`before`/`after`: A2's "make a throwaway directory" became "create a throwaway database", because
that is what a storage engine with no directories needs. Every `it(...)` block is untouched, and they
all pass.

That is the proof the assignment is really about. A test that passes against three completely
different storage layers — an array, a file, a server in a container — is a test that was never
testing the storage layer. It was testing the promise the API makes to its clients. **Storage is an
implementation detail precisely because you can swap it and the tests cannot tell.**

The reverse holds too. `test/persistence.test.js` — the suite that restarts the server mid-test —
fails 5 of its 7 tests against the in-memory version. Those five failures are the exact value the
database added, written down as assertions, and they now hold across a swapped-out database *server*
as well as a restarted process.

This is also the argument for **A15 — Layered architecture**, one assignment early. The migration was
small because `services/` and above deal in task objects and never mention a table: moving from
SQLite to Postgres meant rewriting `repositories/` and `db/`, adding `await` where the layers above
call them, and leaving the rules, the routes and the error handling exactly as they were.

```bash
npm test    # 19 tests, the same 19 that passed against SQLite
```

## Project layout

```
compose.yaml                 the whole stack: api + db + volume + healthcheck
Dockerfile                   how the api image is built (multi-stage)
.dockerignore                what never goes into the image — including .env
.env.example                 the keys, with placeholder values. Committed.
.env                         the real values. Git-ignored, never committed.
server.js                    entry point: ready the database, then start listening
src/
  app.js                     assembles the Express app from the layers
  config.js                  PORT, DATABASE_URL, OPENAPI_FILE — all env reading
  errors.js                  HttpError + badRequest/notFound
  openapi.js                 reads the spec once at startup
  routes/                    URL -> controller. The map of the API.
    task.routes.js
    meta.routes.js
  controllers/               HTTP in, HTTP out: parse req, pick status code
    task.controller.js
    meta.controller.js
  services/                  the rules: validation, "does this exist"
    task.service.js
  repositories/              the only file containing SQL
    task.repository.js
  db/
    connection.js            the pg pool, the transaction helper, the startup retry
    schema.js                table, indexes, seed rows
    index.js                 initDatabase(): wait, apply schema, seed if empty
  middleware/
    not-found.js             unmatched URL -> a JSON 404
    error-handler.js         thrown error -> a JSON response
openapi.json                 the OpenAPI 3.0 spec Swagger UI renders at /docs
test/
  helpers.js                 spawns a server against a throwaway database
  api.test.js                the A1 contract — passes against all three engines
  persistence.test.js        what the database bought: survives restarts, seeds once
docs/
  postgres-psql.md           the by-hand psql session and what each query returned
  stage4-sql.md              the same session from A2, against SQLite
frontend/
  vite.config.js             dev-server proxy to the API on port 3000
  src/api.js                 fetch wrapper — unwraps the { error } bodies
  src/App.jsx                the task list, filters and stats
  src/TaskRow.jsx            one row: toggle, inline rename, delete
```

### How the layers divide the work

A request falls straight down and the answer comes straight back up:

```
HTTP  ->  routes  ->  controller  ->  service  ->  repository  ->  Postgres
          which     translates      the rules     the queries     (another
          handler   req/res                                        container)
```

The rule that keeps it honest is that **each layer may only know about the one below it**:

| Layer | Knows about | Must not know about |
| --- | --- | --- |
| `routes/` | which controller handles which URL | anything else |
| `controllers/` | `req`, `res`, status codes, query strings | SQL, tables, connection strings |
| `services/` | what makes a task valid, what "missing" means | HTTP, status codes, SQL |
| `repositories/` | tables, columns, `$1` placeholders | HTTP, validation |

The payoff is visible in `task.controller.js`: there is not one `try`/`catch` in it, even now that
every handler is `async`. Express 5 forwards a rejected promise to the error handler exactly as it
forwards a thrown one, so a database that says no arrives at the same place a bad title does — and a
single [error handler](src/middleware/error-handler.js) is still the only file that decides a 400
looks different from a 404.

## Notes on design

A few decisions worth calling out:

- **The password is never in the repo.** `DATABASE_URL` comes from the environment, `.env` is
  git-ignored, `.env.example` is committed with placeholders, and `.dockerignore` keeps `.env` out of
  the image as well. A password that reaches Git is public even after you delete it — the commit that
  added it is still in the history.
- **The app waits for the database, twice.** `depends_on: condition: service_healthy` waits for
  Postgres's own healthcheck before starting the api, and the app retries the connection itself on
  top of that. The first covers a cold start; the second covers a database that goes away and comes
  back while the app is running, without needing a human to restart anything.
- **The port opens last.** `server.js` awaits `initDatabase()` before `app.listen()`, so there is no
  window in which the API is reachable but the table it queries does not exist yet.
- **`PUT` accepts partial bodies.** Sending `{"done":true}` leaves `title` alone. Strict REST would
  call this `PATCH`, but the assignment specifies `PUT` for "title and/or done".
- **Every value goes in as a `$n` parameter.** No user input is ever concatenated into SQL. Where a
  query varies in *shape* rather than in values — `?sort=title` — the column name is looked up in a
  fixed table of allowed columns and an unknown one is a `400`, because a placeholder cannot stand in
  for a column name.
- **`%` and `_` in a search are text, not wildcards.** They are escaped before reaching `ILIKE`, so
  `?search=50%` finds titles containing "50%" instead of matching everything.
- **`/tasks/abc` is a 404, not a 500** — and so is `/tasks/99999999999`. `id` is a 32-bit `SERIAL`,
  and Postgres answers an out-of-range id with an error rather than an empty result, so both kinds of
  impossible id are turned away by the controller before they reach a query.
- **The image runs as a non-root user and starts `node` directly.** No `npm` in `CMD`: it would sit
  between Docker and Node as an extra process, and the SIGTERM that stops the container would go to
  npm instead of to the server.

### The image, and why it is built in two stages

[`Dockerfile`](Dockerfile) installs dependencies in one stage and copies only `node_modules` into the
final image. Nothing that was needed to *build* the image ends up inside it.

Built both ways from this same source, on this machine:

| Dockerfile | Image size |
| --- | --- |
| Single stage — `npm install`, then `COPY . .` | **263 MB** |
| Multi-stage — install in one stage, copy only `node_modules` | **250 MB** |

13 MB, and it is worth being honest about where it comes from and why it is not more. `docker history`
puts the single-stage `RUN npm install` layer at 25.9 MB while `node_modules` itself is 17.3 MB; the
difference is npm's own cache, 5.6 MB of `/root/.npm` that got written in the same layer and can never
be deleted from it afterwards, because a later `RUN rm -rf` only adds a layer that hides files the
earlier one still contains. In the multi-stage build that cache is left behind in a stage nobody ships.

The remaining 250 MB is almost entirely `node:22-alpine`. This project has no build step and no
devDependencies, so there is nothing else to leave behind — the technique earns its keep on a
TypeScript or bundled app, where the compiler, the type definitions and the source are all needed to
produce a `dist/` that is the only thing worth shipping. The habit is still right at this size: what
was needed to build the image should not be inside it.

The other half of the saving is `npm ci --omit=dev` and a `.dockerignore` that keeps
`node_modules`, `.git`, `test/`, `docs/`, `frontend/` and `.env` out of the build context entirely.

### What was awkward this time

In A2 it was the migration. Here it was **asynchrony**, and it spread further than expected.
better-sqlite3 read a local file and could answer in the same tick, so `findAll()` returned an array
and the service could just hand it back. `pg` returns a promise, and a promise handed to
`res.json()` serialises as `{}` — silently, with a 200. The fix is one `await` per call site, but the
call sites are in three layers, and the failure mode is not an error: it is an empty object where a
task used to be.

The second surprise was the startup sequence. Under SQLite, `import './db/index.js'` *was* the schema
step — opening a file is instant, so "import it and the table exists" was true, and the import graph
enforced the ordering by itself. A server can be slow, absent, or still booting, so that guarantee had
to become something explicit: an `initDatabase()` the entry point awaits before it opens the port.
Same promise, now written down instead of implied by module evaluation order.
