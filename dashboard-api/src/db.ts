import { Pool } from 'pg';

let pool: Pool | null = null;

export function initDb(): void {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  // Manually parse the DATABASE_URL instead of letting pg parse it.
  // This avoids the "Cannot read properties of undefined (reading 'searchParams')"
  // error coming from pg-connection-string in some hosted environments.
  const url = new URL(databaseUrl);

  const ssl =
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false;

  pool = new Pool({
    host: url.hostname,
    port: url.port ? parseInt(url.port, 10) : 5432,
    user: url.username,
    password: url.password,
    database: url.pathname.replace(/^\//, ''),
    ssl,
  });
}

export function getDb(): Pool {
  if (!pool) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return pool;
}

