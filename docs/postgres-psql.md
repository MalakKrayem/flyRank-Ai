# The database, by hand

The A2 version of this document ([`stage4-sql.md`](stage4-sql.md)) opened `tasks.db` in a GUI. There
is no file to open now — the database is a server in a container — so the tool changes and nothing
else does. `psql` is already inside the `db` image:

```bash
docker compose exec db psql -U postgres -d tasks
```

Everything below is real output from that session, with the API running in another terminal the whole
time.

## `\dt` — what tables exist

```console
tasks=# \dt
         List of relations
 Schema | Name  | Type  |  Owner
--------+-------+-------+----------
 public | tasks | table | postgres
(1 row)
```

One table, created by the app on startup. Nobody typed a `CREATE TABLE` to get it.

## `\d tasks` — the shape the app asked for

```console
tasks=# \d tasks
                                       Table "public.tasks"
   Column   |           Type           | Collation | Nullable |              Default
------------+--------------------------+-----------+----------+-----------------------------------
 id         | integer                  |           | not null | nextval('tasks_id_seq'::regclass)
 title      | text                     |           | not null |
 done       | boolean                  |           | not null | false
 created_at | timestamp with time zone |           | not null | now()
 updated_at | timestamp with time zone |           | not null | now()
Indexes:
    "tasks_pkey" PRIMARY KEY, btree (id)
    "idx_tasks_done" btree (done)
    "idx_tasks_title" btree (lower(title), id)
```

This is `SERIAL` with its mask off. There is no `serial` type in the output, because there never was
one: `SERIAL` is shorthand for "an integer whose default is the next value of a sequence I made for
you", and `nextval('tasks_id_seq')` is that sequence. It is also why a deleted id is never reissued —
a sequence only ever counts forwards, and knows nothing about which rows still exist.

## `SELECT * FROM tasks;` — the seeded rows

```console
tasks=# SELECT * FROM tasks;
 id |        title        | done |          created_at           |          updated_at
----+---------------------+------+-------------------------------+-------------------------------
  1 | Read the assignment | t    | 2026-07-31 20:14:09.437812+00 | 2026-07-31 20:14:09.437812+00
  2 | Build the Task API  | f    | 2026-07-31 20:14:09.437812+00 | 2026-07-31 20:14:09.437812+00
  3 | Push it to GitHub   | f    | 2026-07-31 20:14:09.437812+00 | 2026-07-31 20:14:09.437812+00
(3 rows)
```

`t` and `f` — a real boolean, not the `0`/`1` A2 had to translate. Note also that the timestamps have
microseconds and a `+00` offset here, while `GET /tasks` shows `2026-07-31T20:14:09Z`. The column
stores an instant; the API formats it on the way out with `to_char(...)`, so the shape it has
promised since A2 does not move.

## `SELECT * FROM tasks WHERE done = true;` — the query behind `?done=true`

```console
tasks=# SELECT * FROM tasks WHERE done = true;
 id |        title        | done |          created_at           |          updated_at
----+---------------------+------+-------------------------------+-------------------------------
  1 | Read the assignment | t    | 2026-07-31 20:14:09.437812+00 | 2026-07-31 20:14:09.437812+00
(1 row)
```

One row, because it is the only seeded task that is done. `GET /tasks?done=true` runs that same
`WHERE`, which is not a coincidence — the endpoint *is* that query, with the value travelling as `$1`.

## Two windows onto one database

The part worth doing yourself. With the API still running and untouched:

```console
$ curl -s localhost:3000/tasks
  1  done=true   Read the assignment
  2  done=false  Build the Task API
  3  done=false  Push it to GitHub

tasks=# UPDATE tasks SET done = true;
UPDATE 3

$ curl -s localhost:3000/tasks
  1  done=true   Read the assignment
  2  done=true   Build the Task API
  3  done=true   Push it to GitHub

$ curl -s localhost:3000/stats
{"total":3,"done":3,"open":0}
```

No restart, no cache to clear, no syncing step. psql and the API are not two copies of the data;
they are two clients of one server, and that is the difference between this week and last week. In
A2 the API held the file open and a GUI was a second program reading the same bytes. Here neither
program holds anything — Postgres does, and both are just asking it questions.

## `EXPLAIN ANALYZE` — do the indexes actually do anything?

`EXPLAIN ANALYZE` runs the query and reports the plan the database really used, with real timings. It
is the only way to know an index is being *used* rather than merely existing.

Three seed rows are too few to measure anything, so this ran against 50,000 generated rows (~10% of
them done), with `ANALYZE tasks` after each change so the planner had fresh statistics.

### `idx_tasks_title` — a large win

The query behind `GET /tasks?sort=title&limit=10`:

```console
tasks=# EXPLAIN ANALYZE SELECT * FROM tasks ORDER BY lower(title), id LIMIT 10;

-- with the index
 Limit  (cost=0.41..1.36 rows=10 width=73) (actual time=0.238..0.370 rows=10 loops=1)
   ->  Index Scan using idx_tasks_title on tasks  (actual time=0.234..0.364 rows=10 loops=1)
 Execution Time: 0.509 ms

-- after DROP INDEX idx_tasks_title
 Limit  (cost=2172.58..2172.61 rows=10 width=73) (actual time=28.732..28.734 rows=10 loops=1)
   ->  Sort  (actual time=28.730..28.731 rows=10 loops=1)
         Sort Key: (lower(title)), id
         Sort Method: top-N heapsort  Memory: 27kB
         ->  Seq Scan on tasks  (actual time=0.013..17.172 rows=50003 loops=1)
 Execution Time: 28.854 ms
```

**0.5 ms against 28.9 ms — about 57× — and the plan says why.** Without the index the database has to
read all 50,003 rows and sort them before it can know which ten come first. With it, the rows are
*already* in that order, so `LIMIT 10` reads ten and stops.

This only works because the index is declared on exactly the expression the query sorts by:
`lower(title), id`. An index sorted one way cannot answer a query that wants another — in A2 this
same index was first written without the collation and the planner silently ignored it.

### `idx_tasks_done` — an honest non-result

The query behind `GET /tasks?done=true`, same table:

```console
tasks=# EXPLAIN ANALYZE SELECT * FROM tasks WHERE done = true;

-- with the index
 Bitmap Heap Scan on tasks  (cost=58.72..575.31 rows=4959 width=41) (actual time=0.260..1.179 rows=5003 loops=1)
   Recheck Cond: done
   Heap Blocks: exact=467
   ->  Bitmap Index Scan on idx_tasks_done  (actual time=0.211..0.211 rows=5003 loops=1)
 Execution Time: 1.366 ms

-- after DROP INDEX idx_tasks_done
 Seq Scan on tasks  (cost=0.00..967.03 rows=5055 width=41) (actual time=0.010..2.502 rows=5003 loops=1)
   Filter: done
   Rows Removed by Filter: 45000
 Execution Time: 2.660 ms
```

1.4 ms against 2.7 ms. Barely a win, and worth writing down rather than quietly leaving out.

The reason is in the plan: `Heap Blocks: exact=467`. An index tells the database *which* rows match,
but the rows themselves still have to be fetched from the table, and 5,003 matches are scattered
across 467 blocks — most of the table's blocks. Having found them via the index, it reads nearly as
much of the table as scanning it would have. An index earns its keep when it eliminates most of the
work, and a boolean column where a tenth of the rows match does not eliminate very much.

The general lesson is the one the numbers make unavoidable: **an index is a guess about which
questions will be asked, and `EXPLAIN ANALYZE` is how you find out whether the guess was right.** An
index that is never used is not free — every `INSERT`, `UPDATE` and `DELETE` maintains it. Keeping
this one is defensible at three rows and a judgement call at fifty thousand; what is not defensible
is never having looked.
