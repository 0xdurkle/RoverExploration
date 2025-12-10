import { Client, TextChannel } from 'discord.js';
import { getCompletedExplorations, Exploration } from '../db/models';
import { finishExploration } from '../services/explorationService';
import { getRarityEmoji } from '../services/rng';
import { getBiome } from '../services/rng';
import { getReturnWithItemMessage, getReturnEmptyMessage } from '../utils/messageVariations';

/**
 * Check for completed explorations and post results
 * This runs as a cron job every 1-5 minutes
 */
export async function checkAndProcessExplorations(client: Client): Promise<void> {
  try {
    const completed = await getCompletedExplorations();

    if (completed.length === 0) {
      return; // No completed explorations
    }

    const channelId = process.env.DISCORD_CHANNEL_ID;
    if (!channelId) {
      console.error('❌ DISCORD_CHANNEL_ID not set');
      return;
    }

    const channel = (await client.channels.fetch(channelId)) as TextChannel;
    if (!channel) {
      console.error(`❌ Channel ${channelId} not found`);
      return;
    }

    // Process each completed exploration
    for (const exploration of completed) {
      await processExploration(exploration, channel);
    }

    console.log(`✅ Processed ${completed.length} completed exploration(s)`);
  } catch (error) {
    console.error('❌ Error checking explorations:', error);
  }
}

/**
 * Process a single completed exploration
 */
async function processExploration(exploration: Exploration, channel: TextChannel): Promise<void> {
  try {
    console.log(`🔄 processExploration: Starting for exploration ${exploration.id}, user ${exploration.user_id}, biome ${exploration.biome}`);
    const biome = getBiome(exploration.biome);
    const biomeName = biome?.name || exploration.biome;

    // Finish exploration and determine item found
    const itemFound = await finishExploration(
      exploration.id,
      exploration.user_id,
      exploration.biome,
      exploration.duration_hours
    );
    console.log(`   ✅ finishExploration completed, itemFound:`, itemFound ? `${itemFound.name} (${itemFound.rarity})` : 'null');

    // CRITICAL: Verify item was saved to user profile BEFORE sending Discord message
    if (itemFound) {
      const { getDb } = await import('../db/connection');
      const db = getDb();
      
      // Verify item is in explorations table
      const verifyExploration = await db.query(
        `SELECT item_found, completed FROM explorations WHERE id = $1`,
        [exploration.id]
      );
      
      if (!verifyExploration.rows[0] || !verifyExploration.rows[0].completed) {
        console.error(`   ❌ CRITICAL: Exploration ${exploration.id} was not marked as completed!`);
        throw new Error(`Exploration ${exploration.id} was not properly completed`);
      }
      
      const savedItem = verifyExploration.rows[0].item_found;
      if (!savedItem) {
        console.error(`   ❌ CRITICAL: Item was discovered but NOT saved in explorations table!`);
        throw new Error(`Item was not saved to explorations table for exploration ${exploration.id}`);
      }
      
      const itemData = typeof savedItem === 'string' ? JSON.parse(savedItem) : savedItem;
      console.log(`   ✅ Verified: Item saved in explorations table: ${itemData.name}`);
      
      // CRITICAL: Verify item is in user profile inventory
      const verifyProfile = await db.query(
        `SELECT items_found FROM user_profiles WHERE user_id = $1`,
        [exploration.user_id]
      );
      
      if (!verifyProfile.rows[0]) {
        console.error(`   ❌ CRITICAL: User profile not found for user ${exploration.user_id}!`);
        throw new Error(`User profile not found for user ${exploration.user_id}`);
      }
      
      const savedItems = verifyProfile.rows[0].items_found;
      const itemsArray = Array.isArray(savedItems) ? savedItems : [];
      const itemExists = itemsArray.some((item: any) => 
        item && item.name === itemFound.name && item.rarity === itemFound.rarity
      );
      
      if (!itemExists) {
        console.error(`   ❌ CRITICAL: Item "${itemFound.name}" was NOT saved to user ${exploration.user_id}'s inventory!`);
        console.error(`   User has ${itemsArray.length} items in inventory, but "${itemFound.name}" is missing!`);
        throw new Error(`Item "${itemFound.name}" was not saved to user profile inventory`);
      }
      
      console.log(`   ✅ Verified: Item "${itemFound.name}" is in user ${exploration.user_id}'s inventory`);
    }

    // Get user mention
    const user = await channel.client.users.fetch(exploration.user_id);
    const userMention = user ? `<@${exploration.user_id}>` : `User ${exploration.user_id}`;

    // Post result message (only after verification)
    if (itemFound) {
      const emoji = getRarityEmoji(itemFound.rarity);
      const message = getReturnWithItemMessage(
        emoji,
        userMention,
        `**${biomeName}**`,
        `**${itemFound.name}**`,
        itemFound.rarity
      );
      await channel.send(message);
      console.log(`   ✅ Sent Discord message for item: ${itemFound.name} (${itemFound.rarity})`);
    } else {
      const message = getReturnEmptyMessage(userMention, `**${biomeName}**`);
      await channel.send(message);
      console.log(`   ✅ Sent Discord message: no item found`);
    }
  } catch (error) {
    console.error(`   ❌ Error processing exploration ${exploration.id}:`, error);
    console.error(`   Error stack:`, error instanceof Error ? error.stack : String(error));
    
    // Try to send error message to user
    try {
      const user = await channel.client.users.fetch(exploration.user_id);
      const userMention = user ? `<@${exploration.user_id}>` : `User ${exploration.user_id}`;
      await channel.send(`❌ An error occurred processing ${userMention}'s exploration. Please try again.`);
    } catch (sendError) {
      console.error(`   ❌ Failed to send error message:`, sendError);
    }
  }
}
