import biomesData from '../data/biomes.json';

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
 * Checks items in order: Epic → Legendary → Rare → Uncommon
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
  const is30Second = Math.abs(durationHours - 0.008333) < 0.0001;

  // Special probabilities for 30-second testing
  const testProbabilities = {
    uncommon: 0.33, // 33%
    rare: 0.15, // 15%
    legendary: 0.07, // 7%
    epic: 0.03, // 3% (Fragment)
  };

  // Get duration multiplier
  let durationMultiplier = 1.0;
  if (!is30Second) {
    const duration = (biomesData.durations as Duration[]).find(d => Math.abs(d.hours - durationHours) < 0.0001);
    if (!duration) {
      throw new Error(`Duration ${durationHours} hours not found`);
    }
    durationMultiplier = duration.multiplier;
  }

  // Sort items by rarity (epic first, then legendary, then rare, then uncommon)
  const sortedItems = [...biome.items].sort((a, b) => {
    const rarityOrder = { epic: 0, legendary: 1, rare: 2, uncommon: 3 };
    return rarityOrder[a.rarity] - rarityOrder[b.rarity];
  });

  // Check each item in order (rarest first)
  for (const item of sortedItems) {
    let adjustedProbability: number;

    if (is30Second) {
      // Use special test probabilities for 30-second explorations
      adjustedProbability = testProbabilities[item.rarity] || 0;
    } else {
      // Apply duration multiplier to base probability
      adjustedProbability = item.baseProbability * durationMultiplier;
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
  const duration = (biomesData.durations as Duration[]).find(d => d.hours === durationHours);
  return duration?.multiplier || 1.0;
}

/**
 * Get rarity emoji
 */
export function getRarityEmoji(rarity: 'uncommon' | 'rare' | 'legendary' | 'epic'): string {
  // Map epic to fragment emoji
  const rarityKey = rarity === 'epic' ? 'epic' : rarity;
  return biomesData.rarityEmojis[rarityKey] || '⚪';
}
