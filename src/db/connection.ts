import { Pool } from 'pg';

let pool: Pool | null = null;

/**
 * Initialize database connection
 * Requires PostgreSQL (DATABASE_URL must be set)
 */
export async function initDatabase(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error(
      'DATABASE_URL environment variable is required.\n' +
      'For local development, install PostgreSQL and set DATABASE_URL=postgresql://user:password@localhost:5432/underlog\n' +
      'For production on Railway, DATABASE_URL is provided automatically.'
    );
  }

  if (!databaseUrl.startsWith('postgres')) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection string (starts with postgresql://)');
  }

  // Create PostgreSQL connection pool
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });

  // Test connection
  try {
    await pool.query('SELECT NOW()');
    console.log('✅ Connected to PostgreSQL database');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }

  // Create tables
  await createTables();
}

/**
 * Get database pool for queries
 */
export function getDb(): Pool {
  if (!pool) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return pool;
}

/**
 * Create database tables if they don't exist
 */
async function createTables(): Promise<void> {
  if (!pool) {
    throw new Error('Cannot create tables: database not connected');
  }

  try {
    // Explorations table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS explorations (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(20) NOT NULL,
        biome VARCHAR(50) NOT NULL,
        duration_hours INTEGER NOT NULL,
        started_at TIMESTAMP NOT NULL,
        ends_at TIMESTAMP NOT NULL,
        completed BOOLEAN DEFAULT FALSE,
        item_found JSONB,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // User profiles table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        user_id VARCHAR(20) PRIMARY KEY,
        total_explorations INTEGER DEFAULT 0,
        items_found JSONB DEFAULT '[]',
        last_exploration_end TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // User wallets table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_wallets (
        id SERIAL PRIMARY KEY,
        discord_id VARCHAR(20) UNIQUE NOT NULL,
        wallet_address VARCHAR(42) UNIQUE NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW(),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create index for faster queries
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_explorations_ends_at 
      ON explorations(ends_at) 
      WHERE completed = FALSE
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_explorations_user_id 
      ON explorations(user_id)
    `);

    console.log('✅ Database tables created/verified');
  } catch (error) {
    console.error('❌ Error creating tables:', error);
    throw error;
  }
}

/**
 * Close database connection
 */
export async function closeDatabase(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('✅ Database connection closed');
  }
}
