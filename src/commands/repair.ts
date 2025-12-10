import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { getDb } from '../db/connection';
import { ItemFound } from '../db/models';
import { getBiome } from '../services/rng';

/**
 * Repair command to recover missing items from explorations table
 */
export async function handleRepairCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  try {
    const userId = interaction.user.id;
    const db = getDb();

    // Get ALL completed explorations for this user (including ones with NULL items)
    const explorationsResult = await db.query(
      `SELECT id, biome, item_found, completed, ends_at, created_at
       FROM explorations 
       WHERE user_id = $1 AND completed = TRUE
       ORDER BY ends_at ASC`,
      [userId]
    );
    
    console.log(`🔧 Repair: Found ${explorationsResult.rows.length} completed explorations for user ${userId}`);

    if (explorationsResult.rows.length === 0) {
      await interaction.editReply({
        content: '❌ No completed explorations found.',
      });
      return;
    }
    
    // Log all explorations for debugging
    console.log(`🔧 Repair: All completed explorations:`);
    explorationsResult.rows.forEach((exp, idx) => {
      const itemInfo = exp.item_found 
        ? (typeof exp.item_found === 'string' ? JSON.parse(exp.item_found) : exp.item_found)
        : 'NULL';
      console.log(`   ${idx + 1}. ID: ${exp.id}, Biome: ${exp.biome}, Item: ${itemInfo?.name || 'None'}`);
    });

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
    const explorationsWithItems = explorationsResult.rows.filter(exp => exp.item_found !== null && exp.item_found !== undefined);
    
    console.log(`🔧 Repair: ${explorationsWithItems.length} out of ${explorationsResult.rows.length} explorations have items`);
    
    explorationsResult.rows.forEach((exp) => {
      if (exp.item_found) {
        try {
          let itemData: ItemFound;
          if (typeof exp.item_found === 'string') {
            itemData = JSON.parse(exp.item_found);
          } else {
            itemData = exp.item_found;
          }
          
          if (itemData && itemData.name && itemData.rarity) {
            // Normalize biome - convert ID to name if needed
            let biomeName = itemData.biome || exp.biome;
            if (biomeName.includes('_')) {
              // Likely a biome ID, convert to name
              const biomeData = getBiome(biomeName);
              biomeName = biomeData?.name || biomeName;
            }
            
            itemsFromExplorations.push({
              name: itemData.name,
              rarity: itemData.rarity,
              biome: biomeName,
              found_at: itemData.found_at ? new Date(itemData.found_at) : new Date(exp.ends_at),
            });
            console.log(`   ✅ Found item: ${itemData.name} (${itemData.rarity}) from exploration ${exp.id}`);
          } else {
            console.error(`   ❌ Invalid item data in exploration ${exp.id}:`, itemData);
          }
        } catch (e) {
          console.error(`   ❌ Error parsing item_found for exploration ${exp.id}:`, e);
        }
      } else {
        console.log(`   ⚠️ Exploration ${exp.id} (${exp.biome}) has no item_found`);
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
      let response = '✅ All items from explorations are in your inventory.\n\n';
      response += `**Summary:**\n`;
      response += `- Explorations checked: ${explorationsResult.rows.length}\n`;
      response += `- Explorations with items: ${explorationsWithItems.length}\n`;
      response += `- Items found: ${itemsFromExplorations.length}\n`;
      response += `- Items in inventory: ${currentItems.length}\n`;
      
      if (itemsFromExplorations.length < explorationsResult.rows.length) {
        response += `\n⚠️ Note: ${explorationsResult.rows.length - explorationsWithItems.length} exploration(s) have no item saved. These cannot be recovered.`;
      }
      
      await interaction.editReply({
        content: response,
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
    
    let response = `✅ Repair complete! Added ${missingItems.length} missing item(s):\n${itemList}\n\n`;
    response += `**Details:**\n`;
    response += `- Total explorations: ${explorationsResult.rows.length}\n`;
    response += `- Explorations with items in DB: ${explorationsWithItems.length}\n`;
    response += `- Items found in explorations table: ${itemsFromExplorations.length}\n`;
    response += `- Items in your inventory (before): ${currentItems.length}\n`;
    response += `- Items added: ${missingItems.length}\n`;
    response += `- Items in your inventory (after): ${allItems.length}\n\n`;
    
    if (itemsFromExplorations.length < explorationsResult.rows.length) {
      const missingFromDB = explorationsResult.rows.length - explorationsWithItems.length;
      response += `⚠️ **Warning:** ${missingFromDB} exploration(s) have no item saved in the database. These items cannot be recovered automatically.\n`;
      response += `If you saw Discord messages about items but they're missing, those items were never saved to the database.\n`;
    }
    
    response += `\nRun \`/inventory\` to see your updated inventory.`;
    
    await interaction.editReply({
      content: response,
    });

    console.log(`🔧 Repair: Added ${missingItems.length} missing items to user ${userId}`);
    console.log(`🔧 Repair: Full summary - Explorations: ${explorationsResult.rows.length}, With items: ${explorationsWithItems.length}, Recovered: ${missingItems.length}`);
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

