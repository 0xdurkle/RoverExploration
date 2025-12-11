/**
 * Party loot roll service
 * Handles shared loot rolls for party expeditions with bonuses
 */

import biomesData from '../data/biomes.json';
import { applyPartyBonus } from './partyService';

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

/**
 * Roll for item discovery with party bonuses
 * All party members get the same result
 */
export function rollPartyLoot(biomeId: string, durationHours: number, partySize: number): {
  name: string;
  rarity: 'uncommon' | 'rare' | 'legendary';
} | null {
  const biome = (biomesData.biomes as Biome[]).find((b) => b.id === biomeId);
  if (!biome) {
    throw new Error(`Biome ${biomeId} not found`);
  }

  // Check if this is a 30-second exploration (for testing with special probabilities)
  const is30Second = Math.abs(durationHours - 0.008333) < 0.0001;

  // Special probabilities for 30-second testing
  const testProbabilities = {
    uncommon: 0.25, // 25%
    rare: 0.125, // 12.5%
    legendary: 0.05, // 5%
  };

  // Get duration multiplier
  let durationMultiplier = 1.0;
  if (!is30Second) {
    const duration = (biomesData.durations as any[]).find((d) => Math.abs(d.hours - durationHours) < 0.0001);
    durationMultiplier = duration?.multiplier || 1.0;
  }

  // Sort items by rarity (legendary first, then rare, then uncommon)
  const sortedItems = [...biome.items].sort((a, b) => {
    const rarityOrder = { legendary: 0, rare: 1, uncommon: 2 };
    return rarityOrder[a.rarity] - rarityOrder[b.rarity];
  });

  // Check each item in order (rarest first)
  for (const item of sortedItems) {
    let adjustedProbability: number;

    if (is30Second) {
      // Use special test probabilities for 30-second explorations
      adjustedProbability = testProbabilities[item.rarity];
    } else {
      // Use normal multiplier system for other durations
      adjustedProbability = item.baseProbability * durationMultiplier;
    }

    // Apply party bonus (scales with party size)
    adjustedProbability = applyPartyBonus(adjustedProbability, item.rarity, partySize);

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

