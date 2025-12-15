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

// --- Discord username lookup -------------------------------------------------

let discordClient: Client | null = null;

if (process.env.DISCORD_BOT_TOKEN) {
  try {
    discordClient = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
      ],
    });

    discordClient.login(process.env.DISCORD_BOT_TOKEN).catch((error) => {
      console.error('⚠️ Failed to login Discord client for dashboard usernames:', error?.message || error);
      discordClient = null;
    });
  } catch (error) {
    console.error('⚠️ Error initialising Discord client for dashboard usernames:', error);
    discordClient = null;
  }
} else {
  console.warn('⚠️ DISCORD_BOT_TOKEN is not set for dashboard-api; falling back to raw IDs for usernames.');
}

async function getDiscordUsername(userId: string): Promise<string> {
  // If we don't have a working Discord client, just show the raw ID.
  if (!discordClient || !discordClient.isReady()) {
    return userId;
  }

  try {
    const user = await discordClient.users.fetch(userId);
    return user.username || userId;
  } catch (error) {
    console.error(`⚠️ Failed to fetch Discord username for ${userId}:`, (error as any)?.message || error);
    return userId;
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
    
    // Debug: Check if wallets table has any data
    if (hasWalletsTable) {
      try {
        const walletCount = await db.query('SELECT COUNT(*) as count FROM user_wallets');
        console.log(`📊 Total wallets in database: ${walletCount.rows[0].count}`);
        if (parseInt(walletCount.rows[0].count) > 0) {
          const sampleWallets = await db.query('SELECT discord_id, wallet_address FROM user_wallets LIMIT 5');
          console.log('📊 Sample wallets:', sampleWallets.rows);
        }
      } catch (e) {
        console.error('Error checking wallet count:', e);
      }
    }
    
    // Get all users with a FULL OUTER JOIN to include both profiles and wallets
    let allUsers: any[] = [];
    
    if (hasWalletsTable) {
      // Use FULL OUTER JOIN to get all users from both tables
      // This ensures we get:
      // 1. Users with both profile and wallet
      // 2. Users with wallet but no profile
      // 3. Users with profile but no wallet
      const allUsersResult = await db.query(`
        SELECT 
          COALESCE(up.user_id, uw.discord_id) as user_id,
          uw.wallet_address,
          COALESCE(up.total_explorations, 0) as total_explorations,
          COALESCE(up.items_found, '[]'::JSONB) as items_found,
          up.last_exploration_end,
          COALESCE(up.created_at, uw.created_at) as created_at
        FROM user_profiles up
        FULL OUTER JOIN user_wallets uw ON up.user_id = uw.discord_id
        ORDER BY COALESCE(up.created_at, uw.created_at) DESC
      `);
      
      allUsers = allUsersResult.rows;
      console.log(`✅ Found ${allUsers.length} total users (profiles + wallets combined)`);
      
      // Log wallet information
      const usersWithWallets = allUsers.filter((u: any) => u.wallet_address);
      console.log(`✅ Found ${usersWithWallets.length} users with wallets`);
      usersWithWallets.slice(0, 5).forEach((row: any) => {
        console.log(`  - User ${row.user_id}: wallet = ${row.wallet_address}`);
      });
    } else {
      // No wallets table, just get profiles
      const profilesResult = await db.query(`
        SELECT 
          user_id,
          total_explorations,
          items_found,
          last_exploration_end,
          created_at
        FROM user_profiles
        ORDER BY created_at DESC
      `);
      allUsers = profilesResult.rows;
      console.log(`✅ Found ${profilesResult.rows.length} user profiles (no wallets table)`);
    }

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
      
      // Get wallet address from the result
      // Handle both null and empty string cases
      let walletAddress = row.wallet_address;
      if (walletAddress === '' || walletAddress === null || walletAddress === undefined) {
        walletAddress = null;
      }
      
      // Debug logging for all users
      console.log(`  - User ${row.user_id} (${discordName}): wallet = ${walletAddress || 'null'}`);

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
    res.status(500).json({
      error: 'Failed to fetch users',
      // Expose full stack so we can see exactly where the error comes from
      details: error.stack || error.message || String(error),
    });
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
    // Use local biomes data bundled with the dashboard-api service
    const possiblePaths = [
      join(process.cwd(), 'data/biomes.json'),
      join(__dirname, '../data/biomes.json'),
    ];
    let biomesPath = possiblePaths.find(p => existsSync(p));
    if (!biomesPath) {
      throw new Error(`biomes.json not found. Tried: ${possiblePaths.join(', ')}`);
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
  } catch (error: any) {
    console.error('Error fetching items:', error);
    res.status(500).json({
      error: 'Failed to fetch items',
      details: error.stack || error.message || String(error),
    });
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

    const possiblePaths = [
      join(process.cwd(), 'data/biomes.json'),
      join(__dirname, '../data/biomes.json'),
    ];
    let biomesPath = possiblePaths.find(p => existsSync(p));
    if (!biomesPath) {
      throw new Error(`biomes.json not found. Tried: ${possiblePaths.join(', ')}`);
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

// Update item details (name, rarity, baseProbability, biome)
app.put('/api/items/:itemName', (req, res) => {
  try {
    const { itemName } = req.params;
    const { name, rarity, baseProbability, biomeId } = req.body;

    if (baseProbability !== undefined) {
      if (typeof baseProbability !== 'number' || baseProbability < 0 || baseProbability > 1) {
        return res.status(400).json({ error: 'baseProbability must be a number between 0 and 1' });
      }
    }

    if (name !== undefined && (typeof name !== 'string' || !name.trim())) {
      return res.status(400).json({ error: 'name must be a non-empty string' });
    }

    if (rarity !== undefined && typeof rarity !== 'string') {
      return res.status(400).json({ error: 'rarity must be a string' });
    }

    // Load biomes data
    const possiblePaths = [
      join(process.cwd(), 'data/biomes.json'),
      join(__dirname, '../data/biomes.json'),
    ];
    let biomesPath = possiblePaths.find(p => existsSync(p));
    if (!biomesPath) {
      throw new Error(`biomes.json not found. Tried: ${possiblePaths.join(', ')}`);
    }
    const biomesData = JSON.parse(readFileSync(biomesPath, 'utf-8'));

    let found = false;
    let targetBiome: any = null;
    let targetItem: any = null;

    // Find the item by its current name
    for (const biome of biomesData.biomes) {
      for (const item of biome.items) {
        if (item.name === itemName) {
          found = true;
          targetBiome = biome;
          targetItem = item;
          break;
        }
      }
      if (found) break;
    }

    if (!found) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Apply updates on the found item
    if (name !== undefined) {
      targetItem.name = name;
    }
    if (rarity !== undefined) {
      targetItem.rarity = rarity;
    }
    if (baseProbability !== undefined) {
      targetItem.baseProbability = baseProbability;
    }

    // Move to a different biome if biomeId is provided and different
    if (biomeId && biomeId !== targetBiome.id) {
      const newBiome = biomesData.biomes.find((b: any) => b.id === biomeId);
      if (!newBiome) {
        return res.status(400).json({ error: 'Invalid biomeId' });
      }
      // Remove from old biome
      targetBiome.items = targetBiome.items.filter((i: any) => i !== targetItem);
      // Add to new biome
      newBiome.items.push(targetItem);
      targetBiome = newBiome;
    }

    writeFileSync(biomesPath, JSON.stringify(biomesData, null, 2), 'utf-8');

    res.json({
      success: true,
      item: {
        name: targetItem.name,
        rarity: targetItem.rarity,
        baseProbability: targetItem.baseProbability,
        biome: targetBiome.name,
        biomeId: targetBiome.id,
      },
    });
  } catch (error) {
    console.error('Error updating item:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// Create a new item in a specific biome
app.post('/api/biomes/:biomeId/items', (req, res) => {
  try {
    const { biomeId } = req.params;
    const { name, rarity, baseProbability } = req.body;

    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required and must be a non-empty string' });
    }

    if (typeof rarity !== 'string' || !rarity.trim()) {
      return res.status(400).json({ error: 'rarity is required and must be a string' });
    }

    if (typeof baseProbability !== 'number' || baseProbability < 0 || baseProbability > 1) {
      return res.status(400).json({ error: 'baseProbability must be a number between 0 and 1' });
    }

    const possiblePaths = [
      join(process.cwd(), 'data/biomes.json'),
      join(__dirname, '../data/biomes.json'),
    ];
    let biomesPath = possiblePaths.find(p => existsSync(p));
    if (!biomesPath) {
      throw new Error(`biomes.json not found. Tried: ${possiblePaths.join(', ')}`);
    }
    const biomesData = JSON.parse(readFileSync(biomesPath, 'utf-8'));

    const biome = biomesData.biomes.find((b: any) => b.id === biomeId);
    if (!biome) {
      return res.status(400).json({ error: 'Invalid biomeId' });
    }

    if (biome.items.some((i: any) => i.name === name)) {
      return res.status(409).json({ error: 'An item with that name already exists in this biome' });
    }

    const newItem = {
      name,
      rarity,
      baseProbability,
    };

    biome.items.push(newItem);

    writeFileSync(biomesPath, JSON.stringify(biomesData, null, 2), 'utf-8');

    res.status(201).json({
      success: true,
      item: {
        name,
        rarity,
        baseProbability,
        biome: biome.name,
        biomeId: biome.id,
      },
    });
  } catch (error) {
    console.error('Error creating item:', error);
    res.status(500).json({ error: 'Failed to create item' });
  }
});

// Get biomes data
app.get('/api/biomes', (req, res) => {
  try {
    const possiblePaths = [
      join(process.cwd(), 'data/biomes.json'),
      join(__dirname, '../data/biomes.json'),
    ];
    let biomesPath = possiblePaths.find(p => existsSync(p));
    if (!biomesPath) {
      throw new Error(`biomes.json not found. Tried: ${possiblePaths.join(', ')}`);
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
