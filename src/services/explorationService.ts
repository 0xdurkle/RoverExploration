import { createExploration, getActiveExploration, completeExploration } from '../db/models';
import { discoverItem } from './rng';
import { ItemFound } from '../db/models';

/**
 * Start a new exploration for a user
 * This MUST succeed even if Discord interaction fails
 */
export async function startExploration(
  userId: string,
  biome: string,
  durationHours: number
): Promise<void> {
  try {
    console.log(`🚀 [START_EXPLORATION] Starting exploration for user ${userId}`);
    console.log(`🚀 [START_EXPLORATION] Biome: ${biome}, Duration: ${durationHours} hours`);
    
    const exploration = await createExploration(userId, biome, durationHours);
    
    console.log(`🚀 [START_EXPLORATION] ✅ Exploration created successfully`);
    console.log(`🚀 [START_EXPLORATION] Exploration ID: ${exploration.id}`);
    console.log(`🚀 [START_EXPLORATION] Ends at: ${exploration.ends_at}`);
    
    // Verify it was saved
    const { getDb } = await import('../db/connection');
    const db = getDb();
    const verify = await db.query(
      `SELECT id, completed, ends_at FROM explorations WHERE id = $1`,
      [exploration.id]
    );
    
    if (verify.rows[0]) {
      console.log(`🚀 [START_EXPLORATION] ✅ Verified exploration ${exploration.id} in database`);
      console.log(`🚀 [START_EXPLORATION] Completed: ${verify.rows[0].completed}, Ends at: ${verify.rows[0].ends_at}`);
    } else {
      console.error(`🚀 [START_EXPLORATION] ❌ CRITICAL: Exploration ${exploration.id} not found in database after creation!`);
      throw new Error(`Exploration ${exploration.id} was not saved to database`);
    }
  } catch (error) {
    console.error(`🚀 [START_EXPLORATION] ❌ Error starting exploration:`, error);
    console.error(`🚀 [START_EXPLORATION] Error stack:`, error instanceof Error ? error.stack : String(error));
    throw error; // Re-throw to let caller handle it
  }
}

/**
 * Process a completed exploration and determine rewards
 */
export async function processCompletedExploration(explorationId: number): Promise<{
  userId: string;
  biome: string;
  itemFound: ItemFound | null;
}> {
  // Get exploration details (we'll fetch this in the job)
  // For now, we'll handle this in the job file

  // This function will be called from the cron job
  // The actual exploration data will be passed from there
  throw new Error('This function should be called with exploration data');
}

/**
 * Complete an exploration and determine item found
 */
export async function finishExploration(
  explorationId: number,
  userId: string,
  biome: string,
  durationHours: number
): Promise<ItemFound | null> {
  console.log(`\n🎯 [FINISH_EXPLORATION] ==========================================`);
  console.log(`🎯 [FINISH_EXPLORATION] Starting for exploration ${explorationId}`);
  console.log(`🎯 [FINISH_EXPLORATION] User ID: ${userId}`);
  console.log(`🎯 [FINISH_EXPLORATION] Biome: ${biome}`);
  console.log(`🎯 [FINISH_EXPLORATION] Duration: ${durationHours} hours`);
  
  // CRITICAL: Check if exploration already has an item determined
  // This prevents re-rolling if the cron job processes it multiple times
  const { getDb } = await import('../db/connection');
  const db = getDb();
  console.log(`🎯 [FINISH_EXPLORATION] Checking if exploration already has item...`);
  const existingExploration = await db.query(
    `SELECT item_found, completed FROM explorations WHERE id = $1`,
    [explorationId]
  );
  console.log(`🎯 [FINISH_EXPLORATION] Existing exploration query result:`, {
    found: existingExploration.rows.length > 0,
    completed: existingExploration.rows[0]?.completed,
    hasItem: !!existingExploration.rows[0]?.item_found
  });

  if (existingExploration.rows[0]) {
    const existing = existingExploration.rows[0];
    
    // If already completed, return the existing item
    if (existing.completed && existing.item_found) {
      const itemData = typeof existing.item_found === 'string' 
        ? JSON.parse(existing.item_found) 
        : existing.item_found;
      
      // Normalize biome - convert ID to name if needed
      const { getBiome } = await import('./rng');
      let biomeName = itemData.biome || biome;
      // If biome is an ID (contains underscore), convert to name
      if (biomeName.includes('_')) {
        const biomeData = getBiome(biomeName);
        biomeName = biomeData?.name || biomeName;
      }
      
      console.log(`🎯 [FINISH_EXPLORATION] ⚠️ Exploration ${explorationId} already completed with item: ${itemData.name} (${itemData.rarity})`);
      console.log(`🎯 [FINISH_EXPLORATION] Returning existing item, skipping discovery`);
      console.log(`🎯 [FINISH_EXPLORATION] ==========================================\n`);
      return {
        name: itemData.name,
        rarity: itemData.rarity,
        biome: biomeName,
        found_at: itemData.found_at ? new Date(itemData.found_at) : new Date(),
      };
    }
    
    // If item was already determined but not completed, use it
    if (existing.item_found && !existing.completed) {
      console.log(`🎯 [FINISH_EXPLORATION] Item already determined but not completed, completing now...`);
      const itemData = typeof existing.item_found === 'string' 
        ? JSON.parse(existing.item_found) 
        : existing.item_found;
      // Normalize biome - convert ID to name if needed
      const { getBiome } = await import('./rng');
      let biomeName = itemData.biome || biome;
      // If biome is an ID (contains underscore), convert to name
      if (biomeName.includes('_')) {
        const biomeData = getBiome(biomeName);
        biomeName = biomeData?.name || biomeName;
      }
      
      console.log(`🎯 [FINISH_EXPLORATION] ⚠️ Exploration ${explorationId} already has item determined: ${itemData.name} (${itemData.rarity}), completing now...`);
      await completeExploration(explorationId, {
        name: itemData.name,
        rarity: itemData.rarity,
        biome: biomeName,
        found_at: itemData.found_at ? new Date(itemData.found_at) : new Date(),
      });
      console.log(`🎯 [FINISH_EXPLORATION] ✅ Completed exploration with existing item`);
      console.log(`🎯 [FINISH_EXPLORATION] ==========================================\n`);
      return {
        name: itemData.name,
        rarity: itemData.rarity,
        biome: biomeName,
        found_at: itemData.found_at ? new Date(itemData.found_at) : new Date(),
      };
    }
  }

  // Discover item using RNG (only if not already determined)
  console.log(`🎯 [FINISH_EXPLORATION] No existing item found, discovering new item...`);
  const discovered = discoverItem(biome, durationHours);
  console.log(`🎯 [FINISH_EXPLORATION] Discovery result:`, discovered ? `${discovered.name} (${discovered.rarity})` : 'null');

  let itemFound: ItemFound | null = null;

  if (discovered) {
    console.log(`🎯 [FINISH_EXPLORATION] Item discovered, validating...`);
    // Validate that the discovered rarity is valid
    const validRarities: Array<'uncommon' | 'rare' | 'legendary'> = ['uncommon', 'rare', 'legendary'];
    if (!validRarities.includes(discovered.rarity)) {
      console.error(`🎯 [FINISH_EXPLORATION] ❌ Invalid rarity "${discovered.rarity}" for item "${discovered.name}"`);
      throw new Error(`Invalid rarity "${discovered.rarity}" for item "${discovered.name}"`);
    }
    
    // Get biome name from biome ID for consistent storage
    const { getBiome } = await import('./rng');
    const biomeData = getBiome(biome);
    const biomeName = biomeData?.name || biome; // Fallback to ID if biome not found
    console.log(`🎯 [FINISH_EXPLORATION] Biome name: ${biomeName}`);
    
    itemFound = {
      name: discovered.name,
      rarity: discovered.rarity,
      biome: biomeName, // Store biome name, not ID
      found_at: new Date(),
    };
    console.log(`🎯 [FINISH_EXPLORATION] 🎁 Item discovered: ${itemFound.name} (${itemFound.rarity}) for user ${userId} in ${biomeName}`);
    console.log(`🎯 [FINISH_EXPLORATION] Item object:`, JSON.stringify(itemFound, null, 2));
  } else {
    console.log(`🎯 [FINISH_EXPLORATION] 📭 No item found for user ${userId} in ${biome}`);
  }

  // Mark exploration as completed
  console.log(`🎯 [FINISH_EXPLORATION] Calling completeExploration...`);
  await completeExploration(explorationId, itemFound);
  console.log(`🎯 [FINISH_EXPLORATION] ✅ completeExploration finished`);
  console.log(`🎯 [FINISH_EXPLORATION] ==========================================\n`);

  return itemFound;
}
