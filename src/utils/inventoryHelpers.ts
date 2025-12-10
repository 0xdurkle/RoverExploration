import { getAllBiomes } from '../services/rng';
import { ItemFound } from '../db/models';
import { getRarityEmoji } from '../services/rng';
import { getRarityDisplayName, getRarityColor } from './rarityColors';
import { RARITY_ORDER } from '../constants';

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

  if (!Array.isArray(itemsFound)) {
    console.error('❌ countUserItems: itemsFound is not an array!', typeof itemsFound);
    return counts;
  }

  itemsFound.forEach((item) => {
    if (!item || !item.name) {
      console.error('❌ countUserItems: Invalid item:', item);
      return;
    }
    const currentCount = counts.get(item.name) || 0;
    counts.set(item.name, currentCount + 1);
  });

  return counts;
}

/**
 * Build item count list with all items (including 0 counts)
 * IMPORTANT: Uses rarity from stored itemsFound data, not from biome lookup
 * This ensures the rarity matches what was actually discovered
 * Also includes items found by the user even if they're not in the biome data
 */
export function buildItemCounts(itemsFound: ItemFound[]): ItemCount[] {
  // Validate input
  if (!Array.isArray(itemsFound)) {
    console.error('❌ buildItemCounts: itemsFound is not an array!', typeof itemsFound, itemsFound);
    return [];
  }
  
  // Count items directly from user's found items
  const userCounts = countUserItems(itemsFound);
  
  // Create a map of item name -> stored rarity and biome from user's found items
  // Use the stored rarity, not the biome data rarity
  const storedRarities = new Map<string, string>();
  const storedBiomes = new Map<string, string>();
  
  itemsFound.forEach((item) => {
    if (!item || !item.name) {
      console.error('❌ buildItemCounts: Invalid item found:', item);
      return;
    }
    // Store the rarity that was actually discovered (most recent if multiple)
    storedRarities.set(item.name, item.rarity);
    storedBiomes.set(item.name, item.biome);
  });
  
  const itemCounts: ItemCount[] = [];
  const processedItemNames = new Set<string>();

  // FIRST: Show all items the user has actually found (simplified approach)
  // This ensures user's items always show up
  userCounts.forEach((count, itemName) => {
    if (count > 0) {
      const rarity = storedRarities.get(itemName);
      const biome = storedBiomes.get(itemName);
      
      if (rarity && biome) {
        itemCounts.push({
          name: itemName,
          count,
          rarity: rarity,
          biome: biome,
          emoji: getRarityEmoji(rarity as 'uncommon' | 'rare' | 'legendary'),
        });
        processedItemNames.add(itemName);
      } else {
        console.error(`❌ buildItemCounts: Missing rarity/biome for item "${itemName}"`);
      }
    }
  });

  // THEN: Add biome items that user hasn't found yet (for 0 counts)
  // This allows showing all available items
  const allItems = getAllItems();
  allItems.forEach((item) => {
    if (!processedItemNames.has(item.name)) {
      itemCounts.push({
        name: item.name,
        count: 0,
        rarity: item.rarity,
        biome: item.biome,
        emoji: getRarityEmoji(item.rarity as 'uncommon' | 'rare' | 'legendary'),
      });
      processedItemNames.add(item.name);
    }
  });

  return itemCounts;
}

/**
 * Get highest rarity from items found
 */
export function getHighestRarity(itemsFound: ItemFound[]): string | null {
  if (itemsFound.length === 0) return null;

  let highest = itemsFound[0].rarity;

  itemsFound.forEach((item) => {
    if ((RARITY_ORDER[item.rarity] ?? 999) < (RARITY_ORDER[highest] ?? 999)) {
      highest = item.rarity;
    }
  });

  return highest;
}

/**
 * Build biome progress data
 * IMPORTANT: Uses rarity from stored itemsFound data, not from biome lookup
 */
export function buildBiomeProgress(itemsFound: ItemFound[]): BiomeProgress[] {
  const biomes = getAllBiomes();
  const userCounts = countUserItems(itemsFound);
  
  // Create a map of item name -> stored rarity from user's found items
  const storedRarities = new Map<string, string>();
  itemsFound.forEach((item) => {
    // Store the rarity that was actually discovered (most recent if multiple)
    if (!storedRarities.has(item.name)) {
      storedRarities.set(item.name, item.rarity);
    }
  });
  
  const biomeProgress: BiomeProgress[] = [];

  biomes.forEach((biome) => {
    const items: ItemCount[] = [];
    let itemsFoundCount = 0;

    biome.items.forEach((item) => {
      const count = userCounts.get(item.name) || 0;
      if (count > 0) itemsFoundCount++;

      // Use stored rarity if user has found this item, otherwise use biome data rarity
      const rarity = storedRarities.get(item.name) || item.rarity;

      items.push({
        name: item.name,
        count,
        rarity: rarity,
        biome: biome.name,
        emoji: getRarityEmoji(rarity as 'uncommon' | 'rare' | 'legendary'),
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

