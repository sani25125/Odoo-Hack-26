import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './pool.js';

const currentFile = fileURLToPath(import.meta.url);
const migrationPath = path.join(path.dirname(currentFile), 'migrations', '001_initial_schema.sql');

try {
  const sql = await fs.readFile(migrationPath, 'utf8');
  await pool.query(sql);
  console.log('Database migration completed');
} finally {
  await pool.end();
}
