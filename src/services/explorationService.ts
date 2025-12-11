import { createExploration, getActiveExploration, completeExploration } from '../db/models';
import { discoverItem } from './rng';
import { ItemFound } from '../db/models';

/**
 * Start a new exploration for a user
 * Uses database unique constraint to prevent race conditions
 * Throws error if user already has an active exploration
 */
export async function startExploration(
  userId: string,
  biome: string,
  durationHours: number
): Promise<void> {
  try {
    await createExploration(userId, biome, durationHours);
  } catch (error: any) {
    // Check if error is due to unique constraint violation (race condition)
    if (error.code === '23505' && error.constraint === 'idx_user_active_exploration') {
      throw new Error(`User ${userId} already has an active exploration`);
    }
    // Re-throw other errors
    throw error;
  }
}

/**
 * Process a completed exploration and determine rewards
 * NOTE: This function is currently unused - exploration completion is handled
 * directly in checkExplorations.ts. Keeping for potential future use.
 */
export async function processCompletedExploration(explorationId: number): Promise<{
  userId: string;
  biome: string;
  itemFound: ItemFound | null;
}> {
  // This function is not currently used
  // Exploration completion is handled in checkExplorations.ts
  throw new Error('This function is not currently implemented. Use finishExploration() instead.');
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
  }

  // Mark exploration as completed
  await completeExploration(explorationId, itemFound);

  return itemFound;
}
