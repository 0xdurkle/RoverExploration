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

  // Log the connection attempt (without sensitive info)
  const urlForLogging = databaseUrl.replace(/:[^:@]+@/, ':****@'); // Hide password
  console.log(`🔌 Attempting to connect to database: ${urlForLogging.substring(0, 50)}...`);

  // Determine SSL settings
  // Supabase and Railway always require SSL, localhost never needs it
  const isLocalhost = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');
  const isSupabase = databaseUrl.includes('supabase');
  const isRailway = databaseUrl.includes('railway.app') || databaseUrl.includes('railway.internal');
  const needsSSL = isSupabase || isRailway || (!isLocalhost && process.env.NODE_ENV === 'production');

  // Create PostgreSQL connection pool
  pool = new Pool({
    connectionString: databaseUrl,
    ssl: needsSSL ? { rejectUnauthorized: false } : false,
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
        duration_hours NUMERIC(10, 6) NOT NULL,
        started_at TIMESTAMP NOT NULL,
        ends_at TIMESTAMP NOT NULL,
        completed BOOLEAN DEFAULT FALSE,
        item_found JSONB,
        start_message_sent BOOLEAN DEFAULT FALSE,
        distance_km NUMERIC(10, 2),
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Add start_message_sent column if it doesn't exist (migration)
    try {
      await pool.query(`
        ALTER TABLE explorations 
        ADD COLUMN IF NOT EXISTS start_message_sent BOOLEAN DEFAULT FALSE
      `);
      console.log('✅ Added start_message_sent column to explorations table');
    } catch (error: any) {
      // Column might already exist - that's fine
      if (!error.message.includes('already exists') && !error.message.includes('duplicate')) {
        console.log('ℹ️  start_message_sent column check:', error.message);
      }
    }
    
    // Add distance_km column if it doesn't exist (migration)
    try {
      await pool.query(`
        ALTER TABLE explorations 
        ADD COLUMN IF NOT EXISTS distance_km NUMERIC(10, 2)
      `);
      console.log('✅ Added distance_km column to explorations table');
    } catch (error: any) {
      // Column might already exist - that's fine
      if (!error.message.includes('already exists') && !error.message.includes('duplicate')) {
        console.log('ℹ️  distance_km column check:', error.message);
      }
    }

    // User profiles table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_profiles (
        user_id VARCHAR(20) PRIMARY KEY,
        total_explorations INTEGER DEFAULT 0,
        items_found JSONB DEFAULT '[]',
        last_exploration_end TIMESTAMP,
        total_distance_km NUMERIC(10, 2) DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    // Add total_distance_km column if it doesn't exist (migration)
    try {
      await pool.query(`
        ALTER TABLE user_profiles 
        ADD COLUMN IF NOT EXISTS total_distance_km NUMERIC(10, 2) DEFAULT 0
      `);
      console.log('✅ Added total_distance_km column to user_profiles table');
    } catch (error: any) {
      // Column might already exist - that's fine
      if (!error.message.includes('already exists') && !error.message.includes('duplicate')) {
        console.log('ℹ️  total_distance_km column check:', error.message);
      }
    }

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

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_user_wallets_discord_id 
      ON user_wallets(discord_id)
    `);

    // Add unique constraint on wallet_address if it doesn't exist (migration)
    try {
      await pool.query(`
        ALTER TABLE user_wallets 
        ADD CONSTRAINT user_wallets_wallet_address_unique UNIQUE (wallet_address)
      `);
      console.log('✅ Added unique constraint on wallet_address');
    } catch (error: any) {
      // Constraint might already exist or column might not exist yet - that's fine
      if (!error.message.includes('already exists') && !error.message.includes('does not exist')) {
        console.log('ℹ️  Wallet address uniqueness check:', error.message);
      }
    }

    // Migrate duration_hours from INTEGER to NUMERIC if needed (for 30s support)
    try {
      await pool.query(`
        ALTER TABLE explorations 
        ALTER COLUMN duration_hours TYPE NUMERIC(10, 6) 
        USING duration_hours::NUMERIC(10, 6)
      `);
      console.log('✅ Migrated duration_hours column to support decimals');
    } catch (error: any) {
      // Column might already be NUMERIC or error is fine
      if (!error.message.includes('does not exist') && !error.message.includes('already exists')) {
        console.log('ℹ️  duration_hours column type check:', error.message);
      }
    }

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
