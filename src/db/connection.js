import Database from 'better-sqlite3';
import { DB_FILE } from '../config.js';

// Opening a SQLite file that does not exist creates it. That one line is the whole
// "install the database" step: a fresh clone gets its tasks.db on the first run.
//
// This file does nothing else. Opening the connection and defining what is inside
// it are separate jobs — see schema.js — so that either can be read on its own.
const db = new Database(DB_FILE);

export default db;
