import { createExploration, getActiveExploration, completeExploration } from '../db/models';
import { discoverItem } from './rng';
import { ItemFound } from '../db/models';

/**
 * Start a new exploration for a user
 */
export async function startExploration(
  userId: string,
  biome: string,
  durationHours: number
): Promise<void> {
  await createExploration(userId, biome, durationHours);
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
  // CRITICAL: Check if exploration already has an item determined
  // This prevents re-rolling if the cron job processes it multiple times
  const { getDb } = await import('../db/connection');
  const db = getDb();
  const existingExploration = await db.query(
    `SELECT item_found, completed FROM explorations WHERE id = $1`,
    [explorationId]
  );

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
      
      console.log(`⚠️ Exploration ${explorationId} already completed with item: ${itemData.name} (${itemData.rarity})`);
      return {
        name: itemData.name,
        rarity: itemData.rarity,
        biome: biomeName,
        found_at: itemData.found_at ? new Date(itemData.found_at) : new Date(),
      };
    }
    
    // If item was already determined but not completed, use it
    if (existing.item_found && !existing.completed) {
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
      
      console.log(`⚠️ Exploration ${explorationId} already has item determined: ${itemData.name} (${itemData.rarity}), completing now...`);
      await completeExploration(explorationId, {
        name: itemData.name,
        rarity: itemData.rarity,
        biome: biomeName,
        found_at: itemData.found_at ? new Date(itemData.found_at) : new Date(),
      });
      return {
        name: itemData.name,
        rarity: itemData.rarity,
        biome: biomeName,
        found_at: itemData.found_at ? new Date(itemData.found_at) : new Date(),
      };
    }
  }

  // Discover item using RNG (only if not already determined)
  const discovered = discoverItem(biome, durationHours);

  let itemFound: ItemFound | null = null;

  if (discovered) {
    // Validate that the discovered rarity is valid
    const validRarities: Array<'uncommon' | 'rare' | 'legendary'> = ['uncommon', 'rare', 'legendary'];
    if (!validRarities.includes(discovered.rarity)) {
      console.error(`❌ Invalid rarity "${discovered.rarity}" for item "${discovered.name}"`);
      throw new Error(`Invalid rarity "${discovered.rarity}" for item "${discovered.name}"`);
    }
    
    // Get biome name from biome ID for consistent storage
    const { getBiome } = await import('./rng');
    const biomeData = getBiome(biome);
    const biomeName = biomeData?.name || biome; // Fallback to ID if biome not found
    
    itemFound = {
      name: discovered.name,
      rarity: discovered.rarity,
      biome: biomeName, // Store biome name, not ID
      found_at: new Date(),
    };
    console.log(`🎁 Item discovered: ${itemFound.name} (${itemFound.rarity}) for user ${userId} in ${biomeName}`);
  } else {
    console.log(`📭 No item found for user ${userId} in ${biome}`);
  }

  // Mark exploration as completed
  await completeExploration(explorationId, itemFound);

  return itemFound;
}
