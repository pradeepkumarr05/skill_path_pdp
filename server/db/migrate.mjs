import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import 'dotenv/config';
import { pool } from './pool.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const sql = await readFile(path.join(__dirname, 'schema.sql'), 'utf8');
  console.log('Applying server/db/schema.sql ...');
  await pool.query(sql);
  console.log('Database schema is up to date.');
  await pool.end();
}

migrate().catch((error) => {
  console.error('Migration failed:', error);
  process.exitCode = 1;
});
