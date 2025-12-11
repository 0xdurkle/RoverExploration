import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { initDb, getDb } from './db';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Client, GatewayIntentBits } from 'discord.js';

config();

const app = express();
const PORT = process.env.DASHBOARD_API_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
initDb();

// Initialize Discord client for fetching usernames
let discordClient: Client | null = null;
if (process.env.DISCORD_BOT_TOKEN) {
  discordClient = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
    ],
  });
  
  discordClient.login(process.env.DISCORD_BOT_TOKEN).catch((error) => {
    console.error('⚠️ Failed to login Discord client for username fetching:', error.message);
    discordClient = null;
  });
}

// Helper function to fetch Discord username
async function getDiscordUsername(userId: string): Promise<string> {
  if (!discordClient || !discordClient.isReady()) {
    return `User ${userId}`;
  }
  
  try {
    const user = await discordClient.users.fetch(userId);
    return user.username;
  } catch (error) {
    return `User ${userId}`;
  }
}

// Get all users with their data
app.get('/api/users', async (req, res) => {
  try {
    const db = getDb();
    
    // Check if tables exist first
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_profiles'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      console.log('⚠️ user_profiles table does not exist yet');
      return res.json([]); // Return empty array if tables don't exist yet
    }
    
    // Check if user_wallets table exists
    const walletsTableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'user_wallets'
      );
    `);
    
    const hasWalletsTable = walletsTableCheck.rows[0].exists;
    
    // Get all user profiles with wallets
    let profilesResult;
    if (hasWalletsTable) {
      profilesResult = await db.query(`
        SELECT 
          up.user_id,
          up.total_explorations,
          up.items_found,
          up.last_exploration_end,
          up.created_at,
          uw.wallet_address
        FROM user_profiles up
        LEFT JOIN user_wallets uw ON up.user_id = uw.discord_id
        ORDER BY up.created_at DESC
      `);
    } else {
      profilesResult = await db.query(`
        SELECT 
          user_id,
          total_explorations,
          items_found,
          last_exploration_end,
          created_at
        FROM user_profiles
        ORDER BY created_at DESC
      `);
    }

    console.log(`✅ Found ${profilesResult.rows.length} user profiles`);

    // Also get all users who have wallets but no profile yet (for completeness)
    let walletOnlyUsers: any[] = [];
    if (hasWalletsTable) {
      try {
        const walletOnlyResult = await db.query(`
          SELECT 
            uw.discord_id as user_id,
            uw.wallet_address,
            NULL::INTEGER as total_explorations,
            '[]'::JSONB as items_found,
            NULL::TIMESTAMP as last_exploration_end,
            uw.created_at
          FROM user_wallets uw
          LEFT JOIN user_profiles up ON uw.discord_id = up.user_id
          WHERE up.user_id IS NULL
        `);
        walletOnlyUsers = walletOnlyResult.rows;
        console.log(`✅ Found ${walletOnlyUsers.length} users with wallets but no profile`);
      } catch (e) {
        console.error('Error fetching wallet-only users:', e);
      }
    }

    // Combine profiles and wallet-only users
    const allUsers = [...profilesResult.rows, ...walletOnlyUsers];

    // Fetch Discord usernames and wallets
    const users = await Promise.all(allUsers.map(async (row) => {
      // Parse items_found if it's a string
      let inventory = row.items_found;
      if (typeof inventory === 'string') {
        try {
          inventory = JSON.parse(inventory);
        } catch (e) {
          inventory = [];
        }
      }
      if (!Array.isArray(inventory)) {
        inventory = [];
      }

      // Get Discord username
      const discordName = await getDiscordUsername(row.user_id);
      
      // Get wallet address from the joined result
      let walletAddress = row.wallet_address || null;

      return {
        discordId: row.user_id,
        discordName: discordName,
        walletAddress: walletAddress,
        totalExplorations: row.total_explorations || 0,
        inventory: inventory,
        lastActivity: row.last_exploration_end,
        createdAt: row.created_at,
      };
    }));

    res.json(users);
  } catch (error: any) {
    console.error('Error fetching users:', error);
    // If it's a table doesn't exist error, return empty array
    if (error.code === '42P01') {
      return res.json([]);
    }
    res.status(500).json({ error: 'Failed to fetch users', details: error.message });
  }
});

// Get action logs (from explorations table)
app.get('/api/actions', async (req, res) => {
  try {
    const db = getDb();
    const limit = parseInt(req.query.limit as string) || 1000;
    const offset = parseInt(req.query.offset as string) || 0;

    // Check if table exists
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'explorations'
      );
    `);
    
    if (!tableCheck.rows[0].exists) {
      return res.json([]); // Return empty array if table doesn't exist yet
    }

    const result = await db.query(`
      SELECT 
        id,
        user_id,
        biome,
        duration_hours,
        started_at,
        ends_at,
        completed,
        item_found,
        created_at
      FROM explorations
      WHERE completed = TRUE
      ORDER BY ends_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    const actions = result.rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      biome: row.biome,
      durationHours: parseFloat(row.duration_hours),
      startedAt: row.started_at,
      endedAt: row.ends_at,
      itemFound: row.item_found,
      createdAt: row.created_at,
    }));

    res.json(actions);
  } catch (error: any) {
    console.error('Error fetching actions:', error);
    // If it's a table doesn't exist error, return empty array
    if (error.code === '42P01') {
      return res.json([]);
    }
    res.status(500).json({ error: 'Failed to fetch actions', details: error.message });
  }
});

// Get all items from biomes.json
app.get('/api/items', (req, res) => {
  try {
    // Try multiple possible paths (dev vs production)
    const possiblePaths = [
      join(__dirname, '../../src/data/biomes.json'),
      join(process.cwd(), 'src/data/biomes.json'),
      join(__dirname, '../../../src/data/biomes.json'),
    ];
    let biomesPath = possiblePaths.find(p => existsSync(p));
    if (!biomesPath) {
      biomesPath = possiblePaths[0]; // Fallback to first path
    }
    const biomesData = JSON.parse(readFileSync(biomesPath, 'utf-8'));
    
    const allItems: Array<{
      name: string;
      rarity: string;
      baseProbability: number;
      biome: string;
      biomeId: string;
    }> = [];

    biomesData.biomes.forEach((biome: any) => {
      biome.items.forEach((item: any) => {
        allItems.push({
          name: item.name,
          rarity: item.rarity,
          baseProbability: item.baseProbability,
          biome: biome.name,
          biomeId: biome.id,
        });
      });
    });

    res.json(allItems);
  } catch (error) {
    console.error('Error fetching items:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
});

// Update item rarity (baseProbability)
app.put('/api/items/:itemName/rarity', (req, res) => {
  try {
    const { itemName } = req.params;
    const { baseProbability } = req.body;

    if (typeof baseProbability !== 'number' || baseProbability < 0 || baseProbability > 1) {
      return res.status(400).json({ error: 'baseProbability must be a number between 0 and 1' });
    }

    // Try multiple possible paths (dev vs production)
    const possiblePaths = [
      join(__dirname, '../../src/data/biomes.json'),
      join(process.cwd(), 'src/data/biomes.json'),
      join(__dirname, '../../../src/data/biomes.json'),
    ];
    let biomesPath = possiblePaths.find(p => existsSync(p));
    if (!biomesPath) {
      biomesPath = possiblePaths[0]; // Fallback to first path
    }
    const biomesData = JSON.parse(readFileSync(biomesPath, 'utf-8'));

    let found = false;
    biomesData.biomes.forEach((biome: any) => {
      biome.items.forEach((item: any) => {
        if (item.name === itemName) {
          item.baseProbability = baseProbability;
          found = true;
        }
      });
    });

    if (!found) {
      return res.status(404).json({ error: 'Item not found' });
    }

    writeFileSync(biomesPath, JSON.stringify(biomesData, null, 2), 'utf-8');

    res.json({ success: true, itemName, baseProbability });
  } catch (error) {
    console.error('Error updating item rarity:', error);
    res.status(500).json({ error: 'Failed to update item rarity' });
  }
});

// Get biomes data
app.get('/api/biomes', (req, res) => {
  try {
    // Try multiple possible paths (dev vs production)
    const possiblePaths = [
      join(__dirname, '../../src/data/biomes.json'),
      join(process.cwd(), 'src/data/biomes.json'),
      join(__dirname, '../../../src/data/biomes.json'),
    ];
    let biomesPath = possiblePaths.find(p => existsSync(p));
    if (!biomesPath) {
      biomesPath = possiblePaths[0]; // Fallback to first path
    }
    const biomesData = JSON.parse(readFileSync(biomesPath, 'utf-8'));
    res.json(biomesData);
  } catch (error) {
    console.error('Error fetching biomes:', error);
    res.status(500).json({ error: 'Failed to fetch biomes' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Dashboard API server running on port ${PORT}`);
});
