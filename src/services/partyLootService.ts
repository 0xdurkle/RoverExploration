/**
 * Party loot roll service
 * Handles shared loot rolls for party expeditions with bonuses
 */

import biomesData from '../data/biomes.json';
import { applyPartyBonus } from './partyService';
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
  const is30Second = Math.abs(durationHours - DURATION_30_SECONDS_HOURS) < FLOAT_COMPARISON_TOLERANCE;

  // Get duration multiplier
  interface DurationConfig {
    hours: number;
    multiplier: number;
  }

  let durationMultiplier = 1.0;
  if (!is30Second) {
    const durations = biomesData.durations as DurationConfig[];
    const duration = durations.find(
      (d) => Math.abs(d.hours - durationHours) < FLOAT_COMPARISON_TOLERANCE
    );
    durationMultiplier = duration?.multiplier || 1.0;
  }

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

