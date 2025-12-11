import biomesData from '../data/biomes.json';

interface Biome {
  id: string;
  name: string;
  items: Item[];
}

interface Item {
  name: string;
  rarity: 'uncommon' | 'rare' | 'legendary';
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
  rarity: 'uncommon' | 'rare' | 'legendary';
} | null {
  const biome = (biomesData.biomes as Biome[]).find(b => b.id === biomeId);
  if (!biome) {
    throw new Error(`Biome ${biomeId} not found`);
  }

  const duration = (biomesData.durations as Duration[]).find(d => d.hours === durationHours);
  if (!duration) {
    throw new Error(`Duration ${durationHours} hours not found`);
  }

  // Sort items by rarity (legendary first, then rare, then uncommon)
  const sortedItems = [...biome.items].sort((a, b) => {
    const rarityOrder = { legendary: 0, rare: 1, uncommon: 2 };
    return rarityOrder[a.rarity] - rarityOrder[b.rarity];
  });

  // Check each item in order (rarest first)
  for (const item of sortedItems) {
    const adjustedProbability = item.baseProbability * duration.multiplier;
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
  return biomesData.rarityEmojis[rarity] || '⚪';
}
