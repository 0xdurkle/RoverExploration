import { Pool } from 'pg';

let pool: Pool | null = null;

export function initDb(): void {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  // Manually parse the DATABASE_URL instead of letting pg parse it.
  // Normalise the scheme to "http" so Node's URL parser is always happy,
  // then extract the connection pieces. This avoids the earlier
  // "Cannot read properties of undefined (reading 'searchParams')" error
  // coming from pg-connection-string.
  const normalised = databaseUrl.replace(/^postgres(ql)?:\/\//, 'http://');
  const url = new URL(normalised);

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

