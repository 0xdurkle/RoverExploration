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
        
        // Verify the update actually happened by querying again
        const verifyUpdate = await db.query(
          `SELECT total_explorations, items_found FROM user_profiles WHERE user_id = $1`,
          [user_id]
        );
        
        if (verifyUpdate.rows[0]) {
          console.log(`🔧 [COMPLETE_EXPLORATION] Verification: Profile has ${verifyUpdate.rows[0].total_explorations} explorations`);
          if (itemFound) {
            const items = Array.isArray(verifyUpdate.rows[0].items_found) 
              ? verifyUpdate.rows[0].items_found 
              : (verifyUpdate.rows[0].items_found ? JSON.parse(verifyUpdate.rows[0].items_found) : []);
            const hasItem = items.some((item: any) => 
              item && item.name === itemFound.name && item.rarity === itemFound.rarity
            );
            if (!hasItem) {
              console.error(`🔧 [COMPLETE_EXPLORATION] ❌ CRITICAL: Item "${itemFound.name}" not found in profile after update!`);
              console.error(`🔧 [COMPLETE_EXPLORATION] This is a critical error - rolling back transaction`);
              throw new Error(`Item "${itemFound.name}" was not saved to user profile`);
            }
            console.log(`🔧 [COMPLETE_EXPLORATION] ✅ Verified: Item "${itemFound.name}" is in profile`);
          }
        } else {
          console.error(`🔧 [COMPLETE_EXPLORATION] ❌ CRITICAL: Profile not found after update!`);
          throw new Error(`User profile was not created/updated for user ${user_id}`);
        }
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
    
    // Check if profile exists
    console.log(`📋 [UPDATE_USER_PROFILE] Checking if profile exists for user ${userId}...`);
    const existing = await db.query(
      `SELECT * FROM user_profiles WHERE user_id = $1`,
      [userId]
    );
    console.log(`📋 [UPDATE_USER_PROFILE] Profile query result:`, {
      found: existing.rows.length > 0,
      rowCount: existing.rows.length
    });

    if (existing.rows[0]) {
      console.log(`📋 [UPDATE_USER_PROFILE] ✅ Profile exists for user ${userId}`);
      console.log(`📋 [UPDATE_USER_PROFILE] Current total_explorations:`, existing.rows[0].total_explorations);
      console.log(`📋 [UPDATE_USER_PROFILE] Current items_found type:`, typeof existing.rows[0].items_found);
      console.log(`📋 [UPDATE_USER_PROFILE] Current items_found isArray:`, Array.isArray(existing.rows[0].items_found));
      console.log(`📋 [UPDATE_USER_PROFILE] Current items_found value:`, existing.rows[0].items_found);
      
      // Update existing profile
      // PostgreSQL JSONB is automatically parsed, but handle null/undefined cases
      let itemsFound: any[] = [];
      const rawItemsFound = existing.rows[0].items_found;
    
      console.log(`📋 [UPDATE_USER_PROFILE] Parsing existing items_found...`);
      if (Array.isArray(rawItemsFound)) {
        itemsFound = [...rawItemsFound]; // Create a copy to avoid mutating
        console.log(`📋 [UPDATE_USER_PROFILE] Parsed as array: ${itemsFound.length} items`);
      } else if (rawItemsFound && typeof rawItemsFound === 'string') {
        // Handle case where it's still a string (shouldn't happen but be safe)
        console.log(`📋 [UPDATE_USER_PROFILE] Parsing from string...`);
        itemsFound = JSON.parse(rawItemsFound);
        console.log(`📋 [UPDATE_USER_PROFILE] Parsed from string: ${itemsFound.length} items`);
      } else if (rawItemsFound) {
        // Handle other cases
        console.log(`📋 [UPDATE_USER_PROFILE] Treating as single item object...`);
        itemsFound = [rawItemsFound];
        console.log(`📋 [UPDATE_USER_PROFILE] Created array with 1 item`);
      } else {
        console.log(`📋 [UPDATE_USER_PROFILE] rawItemsFound is null/undefined, starting with empty array`);
      }
      
      console.log(`📋 [UPDATE_USER_PROFILE] Current items count: ${itemsFound.length}`);
      if (itemsFound.length > 0) {
        console.log(`📋 [UPDATE_USER_PROFILE] Current items:`, itemsFound.map((i: any) => `${i?.name || 'NO_NAME'} (${i?.rarity || 'NO_RARITY'})`).join(', '));
      }

      if (itemFound) {
        console.log(`📋 [UPDATE_USER_PROFILE] Processing item to add:`, JSON.stringify(itemFound, null, 2));
        // Validate rarity before saving
        const validRarities: Array<'uncommon' | 'rare' | 'legendary'> = ['uncommon', 'rare', 'legendary'];
        if (!validRarities.includes(itemFound.rarity)) {
          console.error(`📋 [UPDATE_USER_PROFILE] ❌ Invalid rarity "${itemFound.rarity}" for item "${itemFound.name}" when saving to database`);
          throw new Error(`Invalid rarity "${itemFound.rarity}" for item "${itemFound.name}"`);
        }
        
        // Ensure itemFound has all required fields
        const itemToSave: ItemFound = {
          name: itemFound.name,
          rarity: itemFound.rarity,
          biome: itemFound.biome,
          found_at: itemFound.found_at instanceof Date ? itemFound.found_at : new Date(itemFound.found_at),
        };
        console.log(`📋 [UPDATE_USER_PROFILE] Item to save:`, JSON.stringify(itemToSave, null, 2));
        
        // Check if item already exists (prevent duplicates from retries)
        const itemExists = itemsFound.some((item: any) => 
          item && item.name === itemToSave.name && item.rarity === itemToSave.rarity
        );
        
        if (itemExists) {
          console.log(`📋 [UPDATE_USER_PROFILE] ⚠️ Item "${itemToSave.name}" already exists in inventory, skipping duplicate`);
        } else {
          itemsFound.push(itemToSave);
          console.log(`📋 [UPDATE_USER_PROFILE] ✅ Added item "${itemToSave.name}" (${itemToSave.rarity}) from ${itemToSave.biome}`);
        }
        
        console.log(`📋 [UPDATE_USER_PROFILE] New total items: ${itemsFound.length}`);
        console.log(`📋 [UPDATE_USER_PROFILE] Full items array:`, JSON.stringify(itemsFound, null, 2));
      } else {
        console.log(`📋 [UPDATE_USER_PROFILE] No item found, only incrementing exploration count`);
      }

      const itemsJson = JSON.stringify(itemsFound);
      console.log(`📋 [UPDATE_USER_PROFILE] 💾 Preparing to save: ${itemsFound.length} items, JSON length: ${itemsJson.length}`);
      console.log(`📋 [UPDATE_USER_PROFILE] JSON to save:`, itemsJson.substring(0, 500) + (itemsJson.length > 500 ? '...' : ''));
      
      const oldExplorationCount = existing.rows[0].total_explorations;
      console.log(`📋 [UPDATE_USER_PROFILE] Old exploration count: ${oldExplorationCount}, will increment to: ${oldExplorationCount + 1}`);
      
      // Use a more explicit update to ensure it succeeds
      const updateResult = await db.query(
        `UPDATE user_profiles
         SET total_explorations = COALESCE(total_explorations, 0) + 1,
             items_found = $1::jsonb,
             last_exploration_end = $2
         WHERE user_id = $3
         RETURNING items_found, total_explorations`,
        [itemsJson, lastExplorationEnd, userId]
      );
      
      console.log(`📋 [UPDATE_USER_PROFILE] Update query executed, rows returned: ${updateResult.rows.length}`);
      
      if (updateResult.rows.length === 0) {
        console.error(`📋 [UPDATE_USER_PROFILE] ❌ Update query returned no rows for user ${userId}`);
        throw new Error(`Failed to update user profile for user ${userId} - user may not exist`);
      }
      
      const savedItems = updateResult.rows[0].items_found;
      const savedCount = Array.isArray(savedItems) ? savedItems.length : 0;
      const newExplorationCount = updateResult.rows[0].total_explorations;
      
      console.log(`📋 [UPDATE_USER_PROFILE] ✅ Updated profile for user ${userId}`);
      console.log(`📋 [UPDATE_USER_PROFILE] Total explorations: ${oldExplorationCount} → ${newExplorationCount}`);
      console.log(`📋 [UPDATE_USER_PROFILE] Items saved: ${savedCount}`);
      console.log(`📋 [UPDATE_USER_PROFILE] Saved items_found type:`, typeof savedItems);
      console.log(`📋 [UPDATE_USER_PROFILE] Saved items_found isArray:`, Array.isArray(savedItems));
      
      // Verify the count was actually incremented (log warning but don't throw - data is saved)
      if (newExplorationCount !== oldExplorationCount + 1) {
        console.error(`📋 [UPDATE_USER_PROFILE] ⚠️ WARNING: Exploration count increment mismatch!`);
        console.error(`📋 [UPDATE_USER_PROFILE] Expected: ${oldExplorationCount + 1}, Got: ${newExplorationCount}`);
        // Don't throw - the count was incremented, just not by exactly 1 (might be a concurrency issue)
      } else {
        console.log(`📋 [UPDATE_USER_PROFILE] ✅ Exploration count incremented correctly: ${oldExplorationCount} → ${newExplorationCount}`);
      }
      
      // Verify item count (log warning but don't throw - might have duplicates or other edge cases)
      if (savedCount !== itemsFound.length) {
        console.error(`📋 [UPDATE_USER_PROFILE] ⚠️ WARNING: Item count mismatch!`);
        console.error(`📋 [UPDATE_USER_PROFILE] Expected ${itemsFound.length} items but database has ${savedCount}`);
        console.error(`📋 [UPDATE_USER_PROFILE] Expected items:`, JSON.stringify(itemsFound, null, 2));
        console.error(`📋 [UPDATE_USER_PROFILE] Saved items:`, JSON.stringify(savedItems, null, 2));
        // Don't throw - items might have been saved, just count is off (could be duplicates)
      } else {
        console.log(`📋 [UPDATE_USER_PROFILE] ✅ Item count matches: ${savedCount} items`);
      }
      
      // Note: Verification of items is now done in checkExplorations.ts after transaction commits
      // This ensures we're reading the committed data
    } else {
      // Create new profile
      console.log(`📋 [UPDATE_USER_PROFILE] 📝 Creating NEW profile for user ${userId}`);
      const itemsFound = itemFound ? [itemFound] : [];

      if (itemFound) {
        console.log(`📋 [UPDATE_USER_PROFILE] ✅ Creating new profile for user ${userId} with item "${itemFound.name}"`);
        console.log(`📋 [UPDATE_USER_PROFILE] Item to save:`, JSON.stringify(itemFound, null, 2));
      } else {
        console.log(`📋 [UPDATE_USER_PROFILE] ✅ Creating new profile for user ${userId} (no item found)`);
      }

      const itemsJson = JSON.stringify(itemsFound);
      console.log(`📋 [UPDATE_USER_PROFILE] 💾 Inserting profile with ${itemsFound.length} items`);
      console.log(`📋 [UPDATE_USER_PROFILE] JSON to insert:`, itemsJson);

      const insertResult = await db.query(
        `INSERT INTO user_profiles (user_id, total_explorations, items_found, last_exploration_end)
         VALUES ($1, 1, $2::jsonb, $3)
         RETURNING items_found, total_explorations`,
        [userId, itemsJson, lastExplorationEnd]
      );
      
      console.log(`📋 [UPDATE_USER_PROFILE] Insert query executed, rows returned: ${insertResult.rows.length}`);
      
      if (insertResult.rows[0]) {
        const savedItems = insertResult.rows[0].items_found;
        const savedCount = Array.isArray(savedItems) ? savedItems.length : 0;
        console.log(`📋 [UPDATE_USER_PROFILE] ✅ Created profile for user ${userId}`);
        console.log(`📋 [UPDATE_USER_PROFILE] Total explorations: ${insertResult.rows[0].total_explorations}`);
        console.log(`📋 [UPDATE_USER_PROFILE] Items saved: ${savedCount}`);
        console.log(`📋 [UPDATE_USER_PROFILE] Saved items:`, JSON.stringify(savedItems, null, 2));
      } else {
        console.error(`📋 [UPDATE_USER_PROFILE] ❌ Insert query returned no rows!`);
        throw new Error(`Failed to create user profile for user ${userId}`);
      }
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
