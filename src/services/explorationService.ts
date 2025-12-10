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
  // Discover item using RNG
  const discovered = discoverItem(biome, durationHours);

  let itemFound: ItemFound | null = null;

  if (discovered) {
    itemFound = {
      name: discovered.name,
      rarity: discovered.rarity,
      biome: biome,
      found_at: new Date(),
    };
    console.log(`🎁 Item discovered: ${itemFound.name} (${itemFound.rarity}) for user ${userId} in ${biome}`);
  } else {
    console.log(`📭 No item found for user ${userId} in ${biome}`);
  }

  // Mark exploration as completed
  await completeExploration(explorationId, itemFound);

  return itemFound;
}
