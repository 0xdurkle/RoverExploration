import { getDb } from './connection';
import { HOURS_TO_MILLISECONDS } from '../constants';

export interface Exploration {
  id: number;
  user_id: string;
  biome: string;
  duration_hours: number;
  started_at: Date;
  ends_at: Date;
  completed: boolean;
  item_found: ItemFound | null;
  created_at: Date;
}

export interface ItemFound {
  name: string;
  rarity: 'uncommon' | 'rare' | 'legendary';
  biome: string;
  found_at: Date;
}

export interface UserProfile {
  user_id: string;
  total_explorations: number;
  items_found: ItemFound[];
  last_exploration_end: Date | null;
  created_at: Date;
}

export interface UserWallet {
  id: number;
  discord_id: string;
  wallet_address: string;
  updated_at: Date;
  created_at: Date;
}

/**
 * Create a new exploration session
 */
export async function createExploration(
  userId: string,
  biome: string,
  durationHours: number
): Promise<Exploration> {
  const db = getDb();
  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + durationHours * HOURS_TO_MILLISECONDS);

  const result = await db.query(
    `INSERT INTO explorations (user_id, biome, duration_hours, started_at, ends_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, biome, durationHours, startedAt, endsAt]
  );

  return result.rows[0];
}

/**
 * Get active exploration for a user
 */
export async function getActiveExploration(userId: string): Promise<Exploration | null> {
  const db = getDb();
  const now = new Date();

  const result = await db.query(
    `SELECT * FROM explorations
     WHERE user_id = $1 AND ends_at > $2 AND completed = FALSE
     ORDER BY ends_at DESC
     LIMIT 1`,
    [userId, now]
  );

  return result.rows[0] || null;
}

/**
 * Get all completed explorations that need processing
 */
export async function getCompletedExplorations(): Promise<Exploration[]> {
  const db = getDb();
  const now = new Date();

  const result = await db.query(
    `SELECT * FROM explorations
     WHERE ends_at <= $1 AND completed = FALSE
     ORDER BY ends_at ASC`,
    [now]
  );

  return result.rows;
}

/**
 * Mark exploration as completed and store item found
 */
export async function completeExploration(
  explorationId: number,
  itemFound: ItemFound | null
): Promise<void> {
  const db = getDb();

  try {
    console.log(`🔧 completeExploration: Starting for exploration ${explorationId}, itemFound:`, itemFound ? JSON.stringify(itemFound) : 'null');
    
    // Use a transaction to ensure atomicity
    await db.query('BEGIN');
    
    try {
      // First, update the exploration record
      const updateResult = await db.query(
        `UPDATE explorations
         SET completed = TRUE, item_found = $1
         WHERE id = $2 AND completed = FALSE
         RETURNING user_id, ends_at`,
        [itemFound ? JSON.stringify(itemFound) : null, explorationId]
      );
      
      if (updateResult.rows.length === 0) {
        // Exploration was already completed, check what's in there
        const existing = await db.query(
          `SELECT item_found, completed FROM explorations WHERE id = $1`,
          [explorationId]
        );
        if (existing.rows[0]?.completed) {
          console.log(`   ⚠️ Exploration ${explorationId} was already completed, skipping`);
          await db.query('COMMIT');
          return;
        }
        throw new Error(`Exploration ${explorationId} not found or already processing`);
      }
      
      console.log(`   ✅ Updated exploration ${explorationId} in database`);
      
      const { user_id, ends_at } = updateResult.rows[0];
      
      // Then update user profile (this must succeed or we rollback)
      try {
        await updateUserProfile(user_id, ends_at, itemFound);
        console.log(`   ✅ User profile updated successfully`);
      } catch (profileError) {
        console.error(`   ❌ Error updating user profile:`, profileError);
        throw profileError; // This will trigger rollback
      }
      
      await db.query('COMMIT');
      console.log(`   ✅ Transaction committed for exploration ${explorationId}`);
    } catch (error) {
      console.error(`   ❌ Error in transaction for exploration ${explorationId}, rolling back:`, error);
      console.error(`   Error stack:`, error instanceof Error ? error.stack : String(error));
      await db.query('ROLLBACK').catch(rollbackError => {
        console.error(`   ❌ Failed to rollback transaction:`, rollbackError);
      });
      throw error;
    }

    // Update user profile
    const exploration = await db.query(
      `SELECT user_id, ends_at FROM explorations WHERE id = $1`,
      [explorationId]
    );

    if (exploration.rows[0]) {
      const { user_id, ends_at } = exploration.rows[0];
      console.log(`   📝 Updating profile for user ${user_id} with item:`, itemFound ? `${itemFound.name} (${itemFound.rarity})` : 'none');
      await updateUserProfile(user_id, ends_at, itemFound);
      console.log(`   ✅ Successfully updated profile for user ${user_id}`);
    } else {
      console.error(`   ❌ No exploration found with id ${explorationId}`);
    }
  } catch (error) {
    console.error(`   ❌ Error in completeExploration for ${explorationId}:`, error);
    throw error;
  }
}

/**
 * Update or create user profile
 */
async function updateUserProfile(
  userId: string,
  lastExplorationEnd: Date,
  itemFound: ItemFound | null
): Promise<void> {
  const db = getDb();

  try {
    console.log(`🔧 updateUserProfile: Starting for user ${userId}, itemFound:`, itemFound ? JSON.stringify(itemFound) : 'null');
    
    // Check if profile exists
    const existing = await db.query(
      `SELECT * FROM user_profiles WHERE user_id = $1`,
      [userId]
    );

    if (existing.rows[0]) {
      console.log(`   📋 Profile exists for user ${userId}, current items:`, existing.rows[0].items_found);
    // Update existing profile
    // PostgreSQL JSONB is automatically parsed, but handle null/undefined cases
    let itemsFound: any[] = [];
    const rawItemsFound = existing.rows[0].items_found;
    
    if (Array.isArray(rawItemsFound)) {
      itemsFound = [...rawItemsFound]; // Create a copy to avoid mutating
    } else if (rawItemsFound && typeof rawItemsFound === 'string') {
      // Handle case where it's still a string (shouldn't happen but be safe)
      itemsFound = JSON.parse(rawItemsFound);
    } else if (rawItemsFound) {
      // Handle other cases
      itemsFound = [rawItemsFound];
    }

    if (itemFound) {
      // Validate rarity before saving
      const validRarities: Array<'uncommon' | 'rare' | 'legendary'> = ['uncommon', 'rare', 'legendary'];
      if (!validRarities.includes(itemFound.rarity)) {
        console.error(`❌ Invalid rarity "${itemFound.rarity}" for item "${itemFound.name}" when saving to database`);
        throw new Error(`Invalid rarity "${itemFound.rarity}" for item "${itemFound.name}"`);
      }
      
      // Ensure itemFound has all required fields
      const itemToSave: ItemFound = {
        name: itemFound.name,
        rarity: itemFound.rarity,
        biome: itemFound.biome,
        found_at: itemFound.found_at instanceof Date ? itemFound.found_at : new Date(itemFound.found_at),
      };
      itemsFound.push(itemToSave);
      console.log(`✅ Adding item "${itemToSave.name}" (${itemToSave.rarity}) from ${itemToSave.biome} to user ${userId}'s inventory. Total items: ${itemsFound.length}`);
      console.log(`   Full items array:`, JSON.stringify(itemsFound, null, 2));
    }

    const itemsJson = JSON.stringify(itemsFound);
    console.log(`   💾 Saving to database: ${itemsFound.length} items, JSON length: ${itemsJson.length}`);
    
    const updateResult = await db.query(
      `UPDATE user_profiles
       SET total_explorations = total_explorations + 1,
           items_found = $1::jsonb,
           last_exploration_end = $2
       WHERE user_id = $3
       RETURNING items_found, total_explorations`,
      [itemsJson, lastExplorationEnd, userId]
    );
    
    if (updateResult.rows[0]) {
      const savedItems = updateResult.rows[0].items_found;
      const savedCount = Array.isArray(savedItems) ? savedItems.length : 0;
      console.log(`   ✅ Updated profile for user ${userId}. Total explorations: ${updateResult.rows[0].total_explorations}, Items saved: ${savedCount}`);
      
      if (savedCount !== itemsFound.length) {
        console.error(`   ⚠️ WARNING: Expected ${itemsFound.length} items but database has ${savedCount}!`);
        console.error(`   Expected items:`, JSON.stringify(itemsFound));
        console.error(`   Saved items:`, JSON.stringify(savedItems));
      }
    } else {
      console.error(`   ❌ Update query returned no rows for user ${userId}`);
    }
    } else {
      // Create new profile
      console.log(`   📝 Creating NEW profile for user ${userId}`);
      const itemsFound = itemFound ? [itemFound] : [];

      if (itemFound) {
        console.log(`   ✅ Creating new profile for user ${userId} with item "${itemFound.name}"`);
      } else {
        console.log(`   ✅ Creating new profile for user ${userId} (no item found)`);
      }

      const insertResult = await db.query(
        `INSERT INTO user_profiles (user_id, total_explorations, items_found, last_exploration_end)
         VALUES ($1, 1, $2::jsonb, $3)
         RETURNING items_found, total_explorations`,
        [userId, JSON.stringify(itemsFound), lastExplorationEnd]
      );
      
      if (insertResult.rows[0]) {
        const savedItems = insertResult.rows[0].items_found;
        console.log(`   ✅ Created profile for user ${userId} with ${Array.isArray(savedItems) ? savedItems.length : 0} items`);
      }
    }
  } catch (error) {
    console.error(`   ❌ Error in updateUserProfile for user ${userId}:`, error);
    console.error(`   Error details:`, error instanceof Error ? error.stack : String(error));
    throw error;
  }
}

/**
 * Get user profile
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const db = getDb();

  const result = await db.query(
    `SELECT * FROM user_profiles WHERE user_id = $1`,
    [userId]
  );

  if (!result.rows[0]) {
    console.log(`📭 No profile found for user ${userId}`);
    return null;
  }

  const profile = result.rows[0];
  
  // Log RAW database data first
  console.log(`🔍 DEBUG getUserProfile for user ${userId}:`);
  console.log(`   Raw items_found type: ${typeof profile.items_found}`);
  console.log(`   Raw items_found isArray: ${Array.isArray(profile.items_found)}`);
  console.log(`   Raw items_found value:`, profile.items_found);
  console.log(`   Raw items_found JSON:`, JSON.stringify(profile.items_found));
  
  // Ensure items_found is always an array
  let itemsFound: ItemFound[] = [];
  if (Array.isArray(profile.items_found)) {
    itemsFound = profile.items_found;
    console.log(`   ✅ Parsed as array: ${itemsFound.length} items`);
  } else if (profile.items_found && typeof profile.items_found === 'string') {
    try {
      itemsFound = JSON.parse(profile.items_found);
      console.log(`   ✅ Parsed from string: ${itemsFound.length} items`);
    } catch (e) {
      console.error(`   ❌ Error parsing items_found JSON for user ${userId}:`, e);
      console.error(`   ❌ Raw string value:`, profile.items_found);
      itemsFound = [];
    }
  } else if (profile.items_found) {
    itemsFound = [profile.items_found];
    console.log(`   ⚠️  Treated as single item object`);
  } else {
    console.log(`   ⚠️  items_found is null/undefined, using empty array`);
  }
  
  // Log what we retrieved
  console.log(`📥 Retrieved profile for user ${userId}: ${itemsFound.length} items from database`);

  // Parse dates in items_found
  itemsFound = itemsFound.map((item: any, index: number) => {
    if (!item || typeof item !== 'object') {
      console.error(`❌ Invalid item at index ${index} in database for user ${userId}:`, item);
      return null;
    }
    const parsedItem = {
      ...item,
      found_at: item.found_at instanceof Date ? item.found_at : new Date(item.found_at),
    };
    console.log(`   Item ${index}: ${parsedItem.name} (${parsedItem.rarity}) from ${parsedItem.biome}`);
    return parsedItem;
  }).filter(item => item !== null) as ItemFound[];

  console.log(`   ✅ Final parsed items count: ${itemsFound.length}`);

  return {
    ...profile,
    items_found: itemsFound,
    last_exploration_end: profile.last_exploration_end || null,
  };
}

/**
 * Save or update a user's wallet address
 */
export async function saveUserWallet(discordId: string, walletAddress: string): Promise<UserWallet> {
  const db = getDb();

  const result = await db.query(
    `INSERT INTO user_wallets (discord_id, wallet_address, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (discord_id) 
     DO UPDATE SET wallet_address = $2, updated_at = NOW()
     RETURNING *`,
    [discordId, walletAddress]
  );

  return result.rows[0];
}

/**
 * Get user's wallet address
 */
export async function getUserWallet(discordId: string): Promise<UserWallet | null> {
  const db = getDb();

  const result = await db.query(
    `SELECT * FROM user_wallets WHERE discord_id = $1`,
    [discordId]
  );

  return result.rows[0] || null;
}

/**
 * Get wallet by address (to check if already linked)
 */
export async function getUserWalletByAddress(walletAddress: string): Promise<UserWallet | null> {
  const db = getDb();

  const result = await db.query(
    `SELECT * FROM user_wallets WHERE wallet_address = $1`,
    [walletAddress]
  );

  return result.rows[0] || null;
}
