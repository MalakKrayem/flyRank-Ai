import { fileURLToPath } from 'node:url';

// Every path and setting the app reads from its environment, in one place, so no
// other file has to know where the project root is or which variables exist.
// Paths are resolved against this file rather than the shell's working directory,
// so `node server.js` behaves the same no matter where it is started from.

export const PORT = process.env.PORT || 3000;

// DB_FILE overrides the location — the tests point it at a throwaway file.
export const DB_FILE = process.env.DB_FILE ?? fileURLToPath(new URL('../tasks.db', import.meta.url));

export const OPENAPI_FILE = fileURLToPath(new URL('../openapi.json', import.meta.url));
