import biomesData from '../data/biomes.json';
import {
  DURATION_30_SECONDS_HOURS,
  FLOAT_COMPARISON_TOLERANCE,
  RARITY_ORDER,
  TEST_PROBABILITIES,
} from '../constants';

interface Biome {
  id: string;
  name: string;
  items: Item[];
}

interface Item {
  name: string;
  rarity: 'uncommon' | 'rare' | 'legendary' | 'epic';
  baseProbability: number;
}

interface Duration {
  hours: number;
  multiplier: number;
}

/**
 * Calculate item discovery based on RNG
 * Checks items in order: Legendary → Rare → Uncommon
 * Returns null if nothing found
 */
export function discoverItem(biomeId: string, durationHours: number): {
  name: string;
  rarity: 'uncommon' | 'rare' | 'legendary' | 'epic';
} | null {
  const biome = (biomesData.biomes as Biome[]).find(b => b.id === biomeId);
  if (!biome) {
    throw new Error(`Biome ${biomeId} not found`);
  }

  // Check if this is a 30-second exploration (for testing with special probabilities)
  const is30Second = Math.abs(durationHours - DURATION_30_SECONDS_HOURS) < FLOAT_COMPARISON_TOLERANCE;

  // Sort items by rarity (legendary first, then rare, then uncommon)
  const sortedItems = [...biome.items].sort((a, b) => {
    return RARITY_ORDER[a.rarity] - RARITY_ORDER[b.rarity];
  });

  // Check each item in order (rarest first)
  for (const item of sortedItems) {
    let adjustedProbability: number;
    
    if (is30Second) {
      // Use special test probabilities for 30-second explorations
      adjustedProbability = TEST_PROBABILITIES[item.rarity];
    } else {
      // Use normal multiplier system for other durations
      const duration = (biomesData.durations as Duration[]).find(d => 
        Math.abs(d.hours - durationHours) < FLOAT_COMPARISON_TOLERANCE
      );
      if (!duration) {
        throw new Error(`Duration ${durationHours} hours not found`);
      }
      adjustedProbability = item.baseProbability * duration.multiplier;
    }
    
    const roll = Math.random();

    if (roll < adjustedProbability) {
      return {
        name: item.name,
        rarity: item.rarity,
      };
    }
  }

  // Nothing found
  return null;
}

/**
 * Get biome data by ID
 */
export function getBiome(biomeId: string): Biome | undefined {
  return (biomesData.biomes as Biome[]).find(b => b.id === biomeId);
}

/**
 * Get all biomes
 */
export function getAllBiomes(): Biome[] {
  return biomesData.biomes as Biome[];
}

/**
 * Get duration multiplier
 */
export function getDurationMultiplier(durationHours: number): number {
  // Find duration (use approximate match for floating point comparison)
  const duration = (biomesData.durations as Duration[]).find(d => 
    Math.abs(d.hours - durationHours) < FLOAT_COMPARISON_TOLERANCE
  );
  return duration?.multiplier || 1.0;
}

/**
 * Get rarity emoji
 */
export function getRarityEmoji(rarity: 'uncommon' | 'rare' | 'legendary' | 'epic'): string {
  return biomesData.rarityEmojis[rarity] || '⚪';
}
