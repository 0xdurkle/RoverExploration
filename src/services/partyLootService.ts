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
  rarity: 'uncommon' | 'rare' | 'legendary' | 'epic';
  baseProbability: number;
}

/**
 * Roll for item discovery with party bonuses
 * All party members get the same result
 * Party bonuses are added to BASE probability, then duration multiplier is applied
 */
export function rollPartyLoot(biomeId: string, durationHours: number, partySize: number): {
  name: string;
  rarity: 'uncommon' | 'rare' | 'legendary' | 'epic';
} | null {
  const biome = (biomesData.biomes as Biome[]).find((b) => b.id === biomeId);
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
    const duration = (biomesData.durations as any[]).find((d) => Math.abs(d.hours - durationHours) < 0.0001);
    durationMultiplier = duration?.multiplier || 1.0;
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
      // Use special test probabilities for 30-second explorations (no party bonus for testing)
      adjustedProbability = testProbabilities[item.rarity] || 0;
    } else {
      // Apply party bonus to BASE probability first
      const baseWithBonus = applyPartyBonus(item.baseProbability, item.rarity, partySize);
      // Then apply duration multiplier
      adjustedProbability = baseWithBonus * durationMultiplier;
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

