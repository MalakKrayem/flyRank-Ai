import { fileURLToPath } from 'node:url';

// Every setting the app reads from its environment, in one place, so no other
// file has to know which variables exist. Paths are resolved against this file
// rather than the shell's working directory, so `node server.js` behaves the same
// no matter where it is started from — and the same inside a container, where the
// working directory is /app.

export const PORT = process.env.PORT || 3000;

// The whole connection — host, port, user, password, database — as one string, so
// there is one variable to set and one secret to keep out of Git. It is never
// given a default: a missing DATABASE_URL should stop the server with a sentence
// you can act on, not start one that quietly connects somewhere unexpected.
// Where it comes from depends on how the app was started:
//   npm start        .env, loaded by --env-file-if-exists (see package.json)
//   docker compose   the api service's `environment:` block, pointing at `db`
export const DATABASE_URL = process.env.DATABASE_URL;

// Where the accounts live. Postgres above stores the tasks; Supabase stores the
// users, hashes their passwords and signs their tokens — this app never does any
// of those three things itself.
//
// The anon key is the public one: it is meant to be handed out, and on its own it
// can only do what an anonymous visitor may do. The service_role key, which
// bypasses every rule, is deliberately not read anywhere in this repo — there is
// no variable for it, so there is nothing to leak.
export const SUPABASE_URL = process.env.SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

export const OPENAPI_FILE = fileURLToPath(new URL('../openapi.json', import.meta.url));
