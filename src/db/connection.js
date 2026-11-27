import { mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const DEFAULT_DATABASE_PATH = fileURLToPath(
  new URL('../../data/ticketing.sqlite', import.meta.url)
);

const SCHEMA_PATH = fileURLToPath(
  new URL('./schema.sql', import.meta.url)
);

export function openDatabase(filename = DEFAULT_DATABASE_PATH) {
  mkdirSync(dirname(filename), { recursive: true });

  const database = new DatabaseSync(filename);

  database.exec('PRAGMA foreign_keys = ON');

  const schema = readFileSync(SCHEMA_PATH, 'utf8');
  database.exec(schema);

  return database;
}
