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

  // FIRST: Show all items the user has actually found
  userCounts.forEach((count, itemName) => {
    if (count > 0) {
      const rarity = storedRarities.get(itemName);
      const biome = storedBiomes.get(itemName);
      
      // Try to find the item in biome data to get display name and validate biome
      const allItems = getAllItems();
      const biomeItem = allItems.find(item => item.name === itemName);
      
      // Use stored rarity if available, otherwise try biome data, default to 'uncommon'
      const finalRarity = rarity || biomeItem?.rarity || 'uncommon';
      // Use stored biome if available and valid, otherwise try biome data, otherwise use stored or 'Unknown'
      // Normalize biome - if stored biome is an ID (contains underscore), prefer biome data name
      let finalBiome = biome || biomeItem?.biome || 'Unknown';
      if (finalBiome.includes('_') && biomeItem) {
        // Stored biome is an ID but we have biome data, use the name from biome data
        finalBiome = biomeItem.biome;
      }
      
      // Validate rarity is valid
      const validRarities = ['uncommon', 'rare', 'legendary', 'epic'];
      const safeRarity = validRarities.includes(finalRarity) ? finalRarity : 'uncommon';
      
      itemCounts.push({
        name: itemName,
        count,
        rarity: safeRarity,
        biome: finalBiome,
        emoji: getRarityEmoji(safeRarity as 'uncommon' | 'rare' | 'legendary' | 'epic'),
      });
      processedItemNames.add(itemName);
    }
  });

  // THEN: Add biome items that user hasn't found yet (for 0 counts)
  const allItemsForDisplay = getAllItems();
  allItemsForDisplay.forEach((item) => {
    if (!processedItemNames.has(item.name)) {
      itemCounts.push({
        name: item.name,
        count: 0,
        rarity: item.rarity,
        biome: item.biome,
        emoji: getRarityEmoji(item.rarity as 'uncommon' | 'rare' | 'legendary' | 'epic'),
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
  // Also create a normalized map (lowercase, trimmed) for fuzzy matching
  const normalizedUserItems = new Map<string, { originalName: string; count: number; rarity: string }>();
  
  // Debug: log all user items
  const uniqueUserItems = new Set<string>();
  itemsFound.forEach((item) => {
    if (!item || !item.name) return;
    uniqueUserItems.add(item.name);
    
    // Store the rarity that was actually discovered (most recent if multiple)
    if (!storedRarities.has(item.name)) {
      storedRarities.set(item.name, item.rarity);
    }
    
    // Create normalized version for fuzzy matching
    const normalized = item.name.toLowerCase().trim();
    const count = userCounts.get(item.name) || 0;
    if (!normalizedUserItems.has(normalized)) {
      normalizedUserItems.set(normalized, {
        originalName: item.name,
        count,
        rarity: item.rarity,
      });
    }
  });
  
  const biomeProgress: BiomeProgress[] = [];

  biomes.forEach((biome) => {
    const items: ItemCount[] = [];
    let itemsFoundCount = 0;
    
    // Debug logging for Crystal Caverns
    const isCrystalCaverns = biome.id === 'crystal_caverns';

    biome.items.forEach((item) => {
      // First try exact match
      let count = userCounts.get(item.name) || 0;
      let rarity = storedRarities.get(item.name) || item.rarity;
      
      if (isCrystalCaverns) {
        console.log(`🔍 Checking "${item.name}": exact match count = ${count}`);
      }
      
      // If no exact match, try normalized (case-insensitive, trimmed) match
      if (count === 0) {
        const normalized = item.name.toLowerCase().trim();
        const matched = normalizedUserItems.get(normalized);
        if (matched) {
          count = matched.count;
          rarity = matched.rarity;
          console.log(`✅ Matched item by normalized name: "${matched.originalName}" -> "${item.name}" (count: ${count})`);
        } else if (isCrystalCaverns) {
          console.log(`❌ No match for "${item.name}" (normalized: "${normalized}")`);
          console.log(`   Available normalized items: ${Array.from(normalizedUserItems.keys()).join(', ')}`);
        }
      }
      
      if (count > 0) itemsFoundCount++;

      items.push({
        name: item.name,
        count,
        rarity: rarity,
        biome: biome.name,
        emoji: getRarityEmoji(rarity as 'uncommon' | 'rare' | 'legendary' | 'epic'),
      });
    });
    
    if (isCrystalCaverns) {
      console.log(`📊 Crystal Caverns progress: ${itemsFoundCount}/${biome.items.length} items found`);
      console.log(`   User has these items: ${Array.from(uniqueUserItems).join(', ')}`);
    }

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
 * Format: {rarity-emoji} Item Name (rarity) — count
 */
export function formatItemLine(item: ItemCount): string {
  const rarityName = getRarityDisplayName(item.rarity);
  return `${item.emoji} ${item.name} (${rarityName}) — ${item.count}x`;
}


