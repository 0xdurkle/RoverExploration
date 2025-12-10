import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { getDb } from '../db/connection';

/**
 * Debug command to check user's raw database data
 */
export async function handleDebugCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  try {
    const userId = interaction.user.id;
    const db = getDb();

    // Get raw profile data
    const profileResult = await db.query(
      `SELECT * FROM user_profiles WHERE user_id = $1`,
      [userId]
    );

    if (!profileResult.rows[0]) {
      await interaction.editReply({
        content: '❌ No profile found in database.',
      });
      return;
    }

    const profile = profileResult.rows[0];
    
    // Get explorations
    const explorationsResult = await db.query(
      `SELECT id, biome, item_found, completed, ends_at 
       FROM explorations 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 10`,
      [userId]
    );

    let debugInfo = `**Debug Info for User ${userId}**\n\n`;
    
    debugInfo += `**Profile:**\n`;
    debugInfo += `- Total Explorations: ${profile.total_explorations}\n`;
    debugInfo += `- items_found type: ${typeof profile.items_found}\n`;
    debugInfo += `- items_found isArray: ${Array.isArray(profile.items_found)}\n`;
    
    // Check items_found
    let itemsFound: any[] = [];
    if (Array.isArray(profile.items_found)) {
      itemsFound = profile.items_found;
    } else if (profile.items_found && typeof profile.items_found === 'string') {
      try {
        itemsFound = JSON.parse(profile.items_found);
      } catch (e) {
        debugInfo += `- JSON Parse Error: ${e instanceof Error ? e.message : String(e)}\n`;
        itemsFound = [];
      }
    } else if (profile.items_found) {
      itemsFound = [profile.items_found];
    }
    
    debugInfo += `- Items count: ${itemsFound.length}\n`;
    if (itemsFound.length > 0) {
      debugInfo += `\n**Items in Database:**\n`;
      itemsFound.forEach((item, i) => {
        debugInfo += `${i + 1}. ${item?.name || 'NO NAME'} (${item?.rarity || 'NO RARITY'}) from ${item?.biome || 'NO BIOME'}\n`;
      });
    }
    
    debugInfo += `\n**Recent Explorations (last 10):**\n`;
    explorationsResult.rows.forEach((exp, i) => {
      let itemInfo = 'None';
      if (exp.item_found) {
        try {
          // item_found might already be an object (JSONB) or a string
          let itemData: any;
          if (typeof exp.item_found === 'string') {
            itemData = JSON.parse(exp.item_found);
          } else {
            itemData = exp.item_found;
          }
          itemInfo = `${itemData?.name || 'Unknown'} (${itemData?.rarity || 'Unknown'})`;
        } catch (e) {
          itemInfo = `Parse Error: ${e instanceof Error ? e.message : String(e)}`;
        }
      }
      debugInfo += `${i + 1}. ${exp.biome} - Completed: ${exp.completed} - Item: ${itemInfo}\n`;
    });

    await interaction.editReply({
      content: `\`\`\`${debugInfo}\`\`\``,
    });
  } catch (error) {
    console.error('Error in debug command:', error);
    await interaction.editReply({
      content: `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

/**
 * Get debug command builder
 */
export function getDebugCommandBuilder(): SlashCommandBuilder {
  return new SlashCommandBuilder()
    .setName('debug')
    .setDescription('Debug command to check your database data');
}

