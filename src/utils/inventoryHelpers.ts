import { getAllBiomes } from '../services/rng';
import { ItemFound } from '../db/models';
import { getRarityEmoji } from '../services/rng';
import { getRarityDisplayName, getRarityColor } from './rarityColors';

export interface ItemCount {
  name: string;
  count: number;
  rarity: string;
  biome: string;
  emoji: string;
}

export interface BiomeProgress {
  biomeId: string;
  biomeName: string;
  itemsFound: number;
  totalItems: number;
  items: ItemCount[];
}

/**
 * Get all items from all biomes
 */
export function getAllItems(): Array<{
  name: string;
  rarity: string;
  biome: string;
  biomeId: string;
}> {
  const biomes = getAllBiomes();
  const allItems: Array<{
    name: string;
    rarity: string;
    biome: string;
    biomeId: string;
  }> = [];

  biomes.forEach((biome) => {
    biome.items.forEach((item) => {
      allItems.push({
        name: item.name,
        rarity: item.rarity,
        biome: biome.name,
        biomeId: biome.id,
      });
    });
  });

  return allItems;
}

/**
 * Count items from user's found items
 */
export function countUserItems(itemsFound: ItemFound[]): Map<string, number> {
  const counts = new Map<string, number>();

  itemsFound.forEach((item) => {
    const currentCount = counts.get(item.name) || 0;
    counts.set(item.name, currentCount + 1);
  });

  return counts;
}

/**
 * Build item count list with all items (including 0 counts)
 */
export function buildItemCounts(itemsFound: ItemFound[]): ItemCount[] {
  const allItems = getAllItems();
  const userCounts = countUserItems(itemsFound);
  const itemCounts: ItemCount[] = [];

  allItems.forEach((item) => {
    const count = userCounts.get(item.name) || 0;
    itemCounts.push({
      name: item.name,
      count,
      rarity: item.rarity,
      biome: item.biome,
      emoji: getRarityEmoji(item.rarity as 'uncommon' | 'rare' | 'legendary'),
    });
  });

  return itemCounts;
}

/**
 * Get highest rarity from items found
 */
export function getHighestRarity(itemsFound: ItemFound[]): string | null {
  if (itemsFound.length === 0) return null;

  const rarityOrder: Record<string, number> = { legendary: 0, rare: 1, uncommon: 2 };
  let highest = itemsFound[0].rarity;

  itemsFound.forEach((item) => {
    if ((rarityOrder[item.rarity] ?? 999) < (rarityOrder[highest] ?? 999)) {
      highest = item.rarity;
    }
  });

  return highest;
}

/**
 * Build biome progress data
 */
export function buildBiomeProgress(itemsFound: ItemFound[]): BiomeProgress[] {
  const biomes = getAllBiomes();
  const userCounts = countUserItems(itemsFound);
  const biomeProgress: BiomeProgress[] = [];

  biomes.forEach((biome) => {
    const items: ItemCount[] = [];
    let itemsFoundCount = 0;

    biome.items.forEach((item) => {
      const count = userCounts.get(item.name) || 0;
      if (count > 0) itemsFoundCount++;

      items.push({
        name: item.name,
        count,
        rarity: item.rarity,
        biome: biome.name,
        emoji: getRarityEmoji(item.rarity as 'uncommon' | 'rare' | 'legendary'),
      });
    });

    biomeProgress.push({
      biomeId: biome.id,
      biomeName: biome.name,
      itemsFound: itemsFoundCount,
      totalItems: biome.items.length,
      items,
    });
  });

  return biomeProgress;
}

/**
 * Format item line for embed
 */
export function formatItemLine(item: ItemCount): string {
  const rarityName = getRarityDisplayName(item.rarity);
  return `${item.emoji} ${item.name} (${rarityName}) — ${item.count}x`;
}

