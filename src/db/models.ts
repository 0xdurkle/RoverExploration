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
    console.log(`\n🔧 [COMPLETE_EXPLORATION] ==========================================`);
    console.log(`🔧 [COMPLETE_EXPLORATION] Starting for exploration ${explorationId}`);
    console.log(`🔧 [COMPLETE_EXPLORATION] itemFound:`, itemFound ? JSON.stringify(itemFound, null, 2) : 'null');
    console.log(`🔧 [COMPLETE_EXPLORATION] itemFound type:`, typeof itemFound);
    if (itemFound) {
      console.log(`🔧 [COMPLETE_EXPLORATION] Item details: name="${itemFound.name}", rarity="${itemFound.rarity}", biome="${itemFound.biome}"`);
    }
    
    // Use a transaction to ensure atomicity
    console.log(`🔧 [COMPLETE_EXPLORATION] Beginning transaction...`);
    await db.query('BEGIN');
    
    try {
      // First, update the exploration record
      const itemJson = itemFound ? JSON.stringify(itemFound) : null;
      console.log(`🔧 [COMPLETE_EXPLORATION] Updating explorations table with itemJson:`, itemJson);
      
      const updateResult = await db.query(
        `UPDATE explorations
         SET completed = TRUE, item_found = $1
         WHERE id = $2 AND completed = FALSE
         RETURNING user_id, ends_at`,
        [itemJson, explorationId]
      );
      
      console.log(`🔧 [COMPLETE_EXPLORATION] Update query result:`, {
        rowsReturned: updateResult.rows.length,
        rowData: updateResult.rows[0] || null
      });
      
      if (updateResult.rows.length === 0) {
        // Exploration was already completed, check what's in there
        console.log(`🔧 [COMPLETE_EXPLORATION] No rows updated, checking if already completed...`);
        const existing = await db.query(
          `SELECT item_found, completed FROM explorations WHERE id = $1`,
          [explorationId]
        );
        console.log(`🔧 [COMPLETE_EXPLORATION] Existing exploration data:`, existing.rows[0]);
        if (existing.rows[0]?.completed) {
          console.log(`   ⚠️ [COMPLETE_EXPLORATION] Exploration ${explorationId} was already completed, skipping`);
          await db.query('COMMIT');
          return;
        }
        throw new Error(`Exploration ${explorationId} not found or already processing`);
      }
      
      const { user_id, ends_at } = updateResult.rows[0];
      console.log(`🔧 [COMPLETE_EXPLORATION] ✅ Updated exploration ${explorationId} in database`);
      console.log(`🔧 [COMPLETE_EXPLORATION] User ID: ${user_id}, Ends at: ${ends_at}`);
      
      // Then update user profile (this must succeed or we rollback)
      try {
        console.log(`🔧 [COMPLETE_EXPLORATION] Calling updateUserProfile for user ${user_id}...`);
        await updateUserProfile(user_id, ends_at, itemFound);
        console.log(`🔧 [COMPLETE_EXPLORATION] ✅ User profile updated successfully`);
      } catch (profileError) {
        console.error(`🔧 [COMPLETE_EXPLORATION] ❌ Error updating user profile:`, profileError);
        console.error(`🔧 [COMPLETE_EXPLORATION] Error details:`, profileError instanceof Error ? profileError.stack : String(profileError));
        throw profileError; // This will trigger rollback
      }
      
      console.log(`🔧 [COMPLETE_EXPLORATION] Committing transaction...`);
      await db.query('COMMIT');
      console.log(`🔧 [COMPLETE_EXPLORATION] ✅ Transaction committed for exploration ${explorationId}`);
      console.log(`🔧 [COMPLETE_EXPLORATION] ==========================================\n`);
    } catch (error) {
      console.error(`🔧 [COMPLETE_EXPLORATION] ❌ Error in transaction for exploration ${explorationId}, rolling back:`, error);
      console.error(`🔧 [COMPLETE_EXPLORATION] Error stack:`, error instanceof Error ? error.stack : String(error));
      await db.query('ROLLBACK').catch(rollbackError => {
        console.error(`🔧 [COMPLETE_EXPLORATION] ❌ Failed to rollback transaction:`, rollbackError);
      });
      throw error;
    }
  } catch (error) {
    console.error(`🔧 [COMPLETE_EXPLORATION] ❌ Error in completeExploration for ${explorationId}:`, error);
    console.error(`🔧 [COMPLETE_EXPLORATION] Error type:`, error instanceof Error ? error.constructor.name : typeof error);
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
    console.log(`\n📋 [UPDATE_USER_PROFILE] ==========================================`);
    console.log(`📋 [UPDATE_USER_PROFILE] Starting for user ${userId}`);
    console.log(`📋 [UPDATE_USER_PROFILE] lastExplorationEnd:`, lastExplorationEnd);
    console.log(`📋 [UPDATE_USER_PROFILE] itemFound:`, itemFound ? JSON.stringify(itemFound, null, 2) : 'null');
    
    // Get existing profile to build the items array
    console.log(`📋 [UPDATE_USER_PROFILE] Getting existing profile for user ${userId}...`);
    const existing = await db.query(
      `SELECT items_found, total_explorations FROM user_profiles WHERE user_id = $1`,
      [userId]
    );
    
    // Build items array from existing profile or start fresh
    let itemsFound: any[] = [];
    let oldExplorationCount = 0;
    
    if (existing.rows[0]) {
      console.log(`📋 [UPDATE_USER_PROFILE] ✅ Profile exists for user ${userId}`);
      oldExplorationCount = existing.rows[0].total_explorations || 0;
      console.log(`📋 [UPDATE_USER_PROFILE] Current total_explorations: ${oldExplorationCount}`);
      
      const rawItemsFound = existing.rows[0].items_found;
      console.log(`📋 [UPDATE_USER_PROFILE] Current items_found type:`, typeof rawItemsFound);
      
      // Parse existing items
      if (Array.isArray(rawItemsFound)) {
        itemsFound = [...rawItemsFound];
        console.log(`📋 [UPDATE_USER_PROFILE] Parsed as array: ${itemsFound.length} items`);
      } else if (rawItemsFound && typeof rawItemsFound === 'string') {
        itemsFound = JSON.parse(rawItemsFound);
        console.log(`📋 [UPDATE_USER_PROFILE] Parsed from string: ${itemsFound.length} items`);
      } else if (rawItemsFound) {
        itemsFound = [rawItemsFound];
        console.log(`📋 [UPDATE_USER_PROFILE] Treated as single item object`);
      }
    } else {
      console.log(`📋 [UPDATE_USER_PROFILE] 📝 Profile doesn't exist yet, will be created`);
    }
    
    console.log(`📋 [UPDATE_USER_PROFILE] Current items count: ${itemsFound.length}`);
    if (itemsFound.length > 0) {
      console.log(`📋 [UPDATE_USER_PROFILE] Current items:`, itemsFound.map((i: any) => `${i?.name || 'NO_NAME'} (${i?.rarity || 'NO_RARITY'})`).join(', '));
    }

    // Add new item if found
    if (itemFound) {
      console.log(`📋 [UPDATE_USER_PROFILE] Processing item to add:`, JSON.stringify(itemFound, null, 2));
      
      // Validate rarity
      const validRarities: Array<'uncommon' | 'rare' | 'legendary'> = ['uncommon', 'rare', 'legendary'];
      if (!validRarities.includes(itemFound.rarity)) {
        console.error(`📋 [UPDATE_USER_PROFILE] ❌ Invalid rarity "${itemFound.rarity}" for item "${itemFound.name}"`);
        throw new Error(`Invalid rarity "${itemFound.rarity}" for item "${itemFound.name}"`);
      }
      
      // CRITICAL: Normalize biome - ensure it's stored as name, not ID
      // This ensures consistency with getUserProfile normalization
      let biomeName = itemFound.biome || 'Unknown';
      if (biomeName.includes('_')) {
        // Likely a biome ID, convert to name
        const { getBiome } = await import('../services/rng');
        const biomeData = getBiome(biomeName);
        biomeName = biomeData?.name || biomeName;
        console.log(`📋 [UPDATE_USER_PROFILE] Normalized biome from ID "${itemFound.biome}" to name "${biomeName}"`);
      }
      
      // Ensure itemFound has all required fields with normalized biome
      const itemToSave: ItemFound = {
        name: itemFound.name,
        rarity: itemFound.rarity,
        biome: biomeName, // Use normalized biome name
        found_at: itemFound.found_at instanceof Date ? itemFound.found_at : new Date(itemFound.found_at),
      };
      console.log(`📋 [UPDATE_USER_PROFILE] Item to save:`, JSON.stringify(itemToSave, null, 2));
      
      // Check if item already exists (prevent duplicates)
      const itemExists = itemsFound.some((item: any) => 
        item && item.name === itemToSave.name && item.rarity === itemToSave.rarity
      );
      
      if (itemExists) {
        console.log(`📋 [UPDATE_USER_PROFILE] ⚠️ Item "${itemToSave.name}" already exists, skipping duplicate`);
      } else {
        itemsFound.push(itemToSave);
        console.log(`📋 [UPDATE_USER_PROFILE] ✅ Added item "${itemToSave.name}" (${itemToSave.rarity})`);
      }
    } else {
      console.log(`📋 [UPDATE_USER_PROFILE] No item found, only incrementing exploration count`);
    }

    const itemsJson = JSON.stringify(itemsFound);
    console.log(`📋 [UPDATE_USER_PROFILE] 💾 Preparing to save: ${itemsFound.length} items`);
    console.log(`📋 [UPDATE_USER_PROFILE] Old exploration count: ${oldExplorationCount}, will set to: ${oldExplorationCount + 1}`);
    
    // Use INSERT ... ON CONFLICT to handle both create and update atomically
    // This prevents race conditions and ensures the update always succeeds
    const result = await db.query(
      `INSERT INTO user_profiles (user_id, total_explorations, items_found, last_exploration_end)
       VALUES ($1, 1, $2::jsonb, $3)
       ON CONFLICT (user_id) 
       DO UPDATE SET 
         total_explorations = user_profiles.total_explorations + 1,
         items_found = $2::jsonb,
         last_exploration_end = $3
       RETURNING items_found, total_explorations`,
      [userId, itemsJson, lastExplorationEnd]
    );
    
    console.log(`📋 [UPDATE_USER_PROFILE] Upsert query executed, rows returned: ${result.rows.length}`);
    
    if (result.rows.length === 0) {
      console.error(`📋 [UPDATE_USER_PROFILE] ❌ Upsert query returned no rows for user ${userId}`);
      throw new Error(`Failed to upsert user profile for user ${userId}`);
    }
    
    const savedItems = result.rows[0].items_found;
    const savedItemsArray = Array.isArray(savedItems) ? savedItems : [];
    const savedCount = savedItemsArray.length;
    const newExplorationCount = result.rows[0].total_explorations;
    
    console.log(`📋 [UPDATE_USER_PROFILE] ✅ Profile upserted for user ${userId}`);
    console.log(`📋 [UPDATE_USER_PROFILE] Total explorations: ${oldExplorationCount} → ${newExplorationCount}`);
    console.log(`📋 [UPDATE_USER_PROFILE] Items saved: ${savedCount} (expected: ${itemsFound.length})`);
    
    // CRITICAL: Verify exploration count was incremented
    if (newExplorationCount !== oldExplorationCount + 1) {
      console.error(`📋 [UPDATE_USER_PROFILE] ❌ CRITICAL: Exploration count mismatch! Expected ${oldExplorationCount + 1}, got ${newExplorationCount}`);
      throw new Error(`Failed to increment exploration count for user ${userId}`);
    }
    
    // CRITICAL: Verify item count matches (if item was supposed to be added)
    if (itemFound && savedCount !== itemsFound.length) {
      console.error(`📋 [UPDATE_USER_PROFILE] ❌ CRITICAL: Item count mismatch! Expected ${itemsFound.length}, got ${savedCount}`);
      throw new Error(`Failed to save all items for user ${userId}`);
    }
    
    // CRITICAL: If item was found, verify it's actually in the saved items array
    if (itemFound) {
      console.log(`📋 [UPDATE_USER_PROFILE] Verifying item "${itemFound.name}" is in saved items...`);
      const itemExists = savedItemsArray.some((item: any) => 
        item && item.name === itemFound.name && item.rarity === itemFound.rarity
      );
      
      if (!itemExists) {
        console.error(`📋 [UPDATE_USER_PROFILE] ❌ CRITICAL: Item "${itemFound.name}" was NOT found in saved items!`);
        console.error(`📋 [UPDATE_USER_PROFILE] Expected item:`, JSON.stringify(itemFound, null, 2));
        console.error(`📋 [UPDATE_USER_PROFILE] Saved items:`, JSON.stringify(savedItemsArray, null, 2));
        throw new Error(`Item "${itemFound.name}" was not saved to user profile inventory for user ${userId}`);
      }
      console.log(`📋 [UPDATE_USER_PROFILE] ✅ Verified: Item "${itemFound.name}" is in saved items`);
    }
    
    console.log(`📋 [UPDATE_USER_PROFILE] ==========================================\n`);
  } catch (error) {
    console.error(`📋 [UPDATE_USER_PROFILE] ❌ Error in updateUserProfile for user ${userId}:`, error);
    console.error(`📋 [UPDATE_USER_PROFILE] Error type:`, error instanceof Error ? error.constructor.name : typeof error);
    console.error(`📋 [UPDATE_USER_PROFILE] Error details:`, error instanceof Error ? error.stack : String(error));
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

  // Parse dates in items_found and normalize biome (convert ID to name)
  const { getBiome } = await import('../services/rng');
  itemsFound = itemsFound.map((item: any, index: number) => {
    if (!item || typeof item !== 'object') {
      console.error(`❌ Invalid item at index ${index} in database for user ${userId}:`, item);
      return null;
    }
    
    // Normalize biome - convert ID to name if needed
    let biomeName = item.biome || 'Unknown';
    if (biomeName.includes('_')) {
      // Likely a biome ID, convert to name
      const biomeData = getBiome(biomeName);
      biomeName = biomeData?.name || biomeName;
    }
    
    const parsedItem = {
      ...item,
      biome: biomeName,
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

/**
 * End all active explorations (mark as completed)
 * This is useful for resetting the system or clearing stuck explorations
 * Finds all explorations that are not completed, regardless of whether they've passed their end time
 */
export async function endAllExplorations(): Promise<{ count: number; explorations: Exploration[] }> {
  const db = getDb();
  const now = new Date();

  try {
    console.log(`\n🛑 [END_ALL_EXPLORATIONS] ==========================================`);
    console.log(`🛑 [END_ALL_EXPLORATIONS] Starting to end all active explorations...`);
    console.log(`🛑 [END_ALL_EXPLORATIONS] Current time: ${now.toISOString()}`);
    
    // First, get all incomplete explorations (both active and past-due)
    const getIncomplete = await db.query(
      `SELECT * FROM explorations 
       WHERE completed = FALSE 
       ORDER BY id ASC`
    );
    
    console.log(`🛑 [END_ALL_EXPLORATIONS] Found ${getIncomplete.rows.length} incomplete explorations in database`);
    
    if (getIncomplete.rows.length === 0) {
      console.log(`🛑 [END_ALL_EXPLORATIONS] No incomplete explorations to end`);
      console.log(`🛑 [END_ALL_EXPLORATIONS] ==========================================\n`);
      return { count: 0, explorations: [] };
    }

    // Separate active (ends_at > now) from past-due (ends_at <= now)
    const activeExplorations: Exploration[] = [];
    const pastDueExplorations: Exploration[] = [];
    
    getIncomplete.rows.forEach((exp) => {
      const endsAt = new Date(exp.ends_at);
      if (endsAt > now) {
        activeExplorations.push(exp);
        console.log(`🛑 [END_ALL_EXPLORATIONS] Active: ID=${exp.id}, User=${exp.user_id}, Biome=${exp.biome}, EndsAt=${endsAt.toISOString()}`);
      } else {
        pastDueExplorations.push(exp);
        console.log(`🛑 [END_ALL_EXPLORATIONS] Past-due: ID=${exp.id}, User=${exp.user_id}, Biome=${exp.biome}, EndsAt=${endsAt.toISOString()}`);
      }
    });

    console.log(`🛑 [END_ALL_EXPLORATIONS] Active explorations: ${activeExplorations.length}`);
    console.log(`🛑 [END_ALL_EXPLORATIONS] Past-due explorations: ${pastDueExplorations.length}`);

    // Mark all incomplete explorations as completed
    // If they don't have an item_found, set it to NULL
    const updateResult = await db.query(
      `UPDATE explorations 
       SET completed = TRUE, 
           item_found = COALESCE(item_found, NULL)
       WHERE completed = FALSE
       RETURNING *`
    );

    console.log(`🛑 [END_ALL_EXPLORATIONS] ✅ Updated ${updateResult.rows.length} explorations`);
    console.log(`🛑 [END_ALL_EXPLORATIONS] ==========================================\n`);

    return {
      count: updateResult.rows.length,
      explorations: updateResult.rows as Exploration[]
    };
  } catch (error) {
    console.error(`🛑 [END_ALL_EXPLORATIONS] ❌ Error ending all explorations:`, error);
    console.error(`🛑 [END_ALL_EXPLORATIONS] Error stack:`, error instanceof Error ? error.stack : String(error));
    throw error;
  }
}
