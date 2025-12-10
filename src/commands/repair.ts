import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { getDb } from '../db/connection';
import { ItemFound } from '../db/models';

/**
 * Repair command to recover missing items from explorations table
 */
export async function handleRepairCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  try {
    const userId = interaction.user.id;
    const db = getDb();

    // Get all completed explorations for this user that have items
    const explorationsResult = await db.query(
      `SELECT id, biome, item_found, completed, ends_at 
       FROM explorations 
       WHERE user_id = $1 AND completed = TRUE AND item_found IS NOT NULL
       ORDER BY ends_at ASC`,
      [userId]
    );

    if (explorationsResult.rows.length === 0) {
      await interaction.editReply({
        content: '❌ No completed explorations with items found.',
      });
      return;
    }

    // Get current user profile
    const profileResult = await db.query(
      `SELECT items_found FROM user_profiles WHERE user_id = $1`,
      [userId]
    );

    let currentItems: ItemFound[] = [];
    if (profileResult.rows[0]?.items_found) {
      const raw = profileResult.rows[0].items_found;
      if (Array.isArray(raw)) {
        currentItems = raw;
      } else if (typeof raw === 'string') {
        currentItems = JSON.parse(raw);
      }
    }

    // Collect all items from explorations (keep ALL instances, including duplicates)
    const itemsFromExplorations: ItemFound[] = [];
    
    explorationsResult.rows.forEach((exp) => {
      if (exp.item_found) {
        let itemData: ItemFound;
        if (typeof exp.item_found === 'string') {
          itemData = JSON.parse(exp.item_found);
        } else {
          itemData = exp.item_found;
        }
        
        itemsFromExplorations.push({
          name: itemData.name,
          rarity: itemData.rarity,
          biome: itemData.biome || exp.biome,
          found_at: itemData.found_at ? new Date(itemData.found_at) : new Date(exp.ends_at),
        });
      }
    });

    console.log(`🔧 Repair: Found ${itemsFromExplorations.length} items in explorations table for user ${userId}`);
    console.log(`🔧 Repair: User currently has ${currentItems.length} items in profile`);

    // Count items by name
    const shouldHaveCounts = new Map<string, number>();
    itemsFromExplorations.forEach(item => {
      shouldHaveCounts.set(item.name, (shouldHaveCounts.get(item.name) || 0) + 1);
    });

    const currentCounts = new Map<string, number>();
    currentItems.forEach(item => {
      currentCounts.set(item.name, (currentCounts.get(item.name) || 0) + 1);
    });

    // Find missing items
    const missingItems: ItemFound[] = [];
    
    shouldHaveCounts.forEach((shouldHaveCount, itemName) => {
      const currentCount = currentCounts.get(itemName) || 0;
      const missingCount = shouldHaveCount - currentCount;
      
      if (missingCount > 0) {
        console.log(`🔧 Repair: Item "${itemName}" should have ${shouldHaveCount}, has ${currentCount}, missing ${missingCount}`);
        
        // Find the item from explorations to get its data
        const itemTemplate = itemsFromExplorations.find(i => i.name === itemName);
        if (itemTemplate) {
          // Add the missing instances
          for (let i = 0; i < missingCount; i++) {
            missingItems.push({
              name: itemTemplate.name,
              rarity: itemTemplate.rarity,
              biome: itemTemplate.biome,
              found_at: new Date(), // Use current date for recovered items
            });
          }
        }
      }
    });

    if (missingItems.length === 0) {
      await interaction.editReply({
        content: '✅ All items are already in your inventory. No repair needed!',
      });
      return;
    }

    // Add missing items
    const allItems = [...currentItems, ...missingItems];
    
    // Update profile
    await db.query(
      `UPDATE user_profiles 
       SET items_found = $1::jsonb 
       WHERE user_id = $2`,
      [JSON.stringify(allItems), userId]
    );

    const itemList = missingItems.map(item => `${item.name} (${item.rarity})`).join(', ');
    
    await interaction.editReply({
      content: `✅ Repair complete! Added ${missingItems.length} missing item(s):\n${itemList}\n\nRun \`/inventory\` to see your updated inventory.`,
    });

    console.log(`🔧 Repair: Added ${missingItems.length} missing items to user ${userId}`);
  } catch (error) {
    console.error('Error in repair command:', error);
    await interaction.editReply({
      content: `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

/**
 * Get repair command builder
 */
export function getRepairCommandBuilder(): SlashCommandBuilder {
  return new SlashCommandBuilder()
    .setName('repair')
    .setDescription('Repair your inventory - recover missing items from explorations');
}

