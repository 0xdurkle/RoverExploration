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
  
  console.log(`🔍 buildItemCounts: Input has ${itemsFound.length} items`);
  itemsFound.forEach((item, idx) => {
    console.log(`   Input item ${idx}:`, JSON.stringify(item));
  });
  
  // Count items directly from user's found items
  const userCounts = countUserItems(itemsFound);
  console.log(`🔍 buildItemCounts: userCounts has ${userCounts.size} unique items`);
  userCounts.forEach((count, name) => {
    console.log(`   Counted: ${name} = ${count}x`);
  });
  
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
    console.log(`   Stored mapping: ${item.name} -> rarity: ${item.rarity}, biome: ${item.biome}`);
  });
  
  const itemCounts: ItemCount[] = [];
  const processedItemNames = new Set<string>();

  // FIRST: Show all items the user has actually found (simplified approach)
  // This ensures user's items always show up
  console.log(`🔍 buildItemCounts: Processing ${userCounts.size} unique items from userCounts`);
  userCounts.forEach((count, itemName) => {
    console.log(`   Checking item: "${itemName}" with count: ${count}`);
    if (count > 0) {
      const rarity = storedRarities.get(itemName);
      const biome = storedBiomes.get(itemName);
      
      console.log(`     Stored rarity: ${rarity}, stored biome: ${biome}`);
      
      // Try to find the item in biome data to get display name and validate biome
      const allItems = getAllItems();
      const biomeItem = allItems.find(item => item.name === itemName);
      console.log(`     Found in biome data: ${biomeItem ? 'YES' : 'NO'}`);
      if (biomeItem) {
        console.log(`     Biome data item:`, JSON.stringify(biomeItem));
      }
      
      // Use stored rarity if available, otherwise try biome data, default to 'uncommon'
      const finalRarity = rarity || biomeItem?.rarity || 'uncommon';
      // Use stored biome if available and valid, otherwise try biome data, otherwise use stored or 'Unknown'
      // Normalize biome - if stored biome is an ID (contains underscore), prefer biome data name
      let finalBiome = biome || biomeItem?.biome || 'Unknown';
      if (finalBiome.includes('_') && biomeItem) {
        // Stored biome is an ID but we have biome data, use the name from biome data
        finalBiome = biomeItem.biome;
        console.log(`     Normalized biome from ID to name: ${biome} -> ${finalBiome}`);
      }
      
      // Validate rarity is valid
      const validRarities = ['uncommon', 'rare', 'legendary'];
      const safeRarity = validRarities.includes(finalRarity) ? finalRarity : 'uncommon';
      
      console.log(`     Final values - rarity: ${safeRarity}, biome: ${finalBiome}`);
      
      const itemToAdd = {
        name: itemName,
        count,
        rarity: safeRarity,
        biome: finalBiome,
        emoji: getRarityEmoji(safeRarity as 'uncommon' | 'rare' | 'legendary'),
      };
      
      console.log(`     ✅ Adding item:`, JSON.stringify(itemToAdd));
      itemCounts.push(itemToAdd);
      processedItemNames.add(itemName);
    } else {
      console.log(`     ⚠️ Skipping item with count 0`);
    }
  });
  
  console.log(`🔍 buildItemCounts: After processing user items, have ${itemCounts.length} items in itemCounts`);

  // THEN: Add biome items that user hasn't found yet (for 0 counts)
  // This allows showing all available items
  // (Note: getAllItems was already called above, but we call it again here for clarity)
  const allItemsForDisplay = getAllItems();
  console.log(`🔍 buildItemCounts: Adding ${allItemsForDisplay.length} items from biome data for 0 counts`);
  allItemsForDisplay.forEach((item) => {
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

  console.log(`🔍 buildItemCounts: Final result - ${itemCounts.length} total items`);
  itemCounts.forEach((item, idx) => {
    if (item.count > 0) {
      console.log(`   Final item ${idx}: ${item.name} x${item.count} (${item.rarity})`);
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
 * Format: {biome-emoji}{rarity-emoji} Item Name (rarity) — count
 */
export function formatItemLine(item: ItemCount): string {
  const rarityName = getRarityDisplayName(item.rarity);
  
  // Biome emoji mapping
  const biomeEmojis: Record<string, string> = {
    'Crystal Caverns': '💠',
    'Withered Woods': '🌲',
    'Rainforest Ruins': '🏺',
  };
  
  const biomeEmoji = biomeEmojis[item.biome] || '';
  
  return `${biomeEmoji}${item.emoji} ${item.name} (${rarityName}) — ${item.count}x`;
}

