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

    // Get user mention
    const user = await channel.client.users.fetch(exploration.user_id);
    const userMention = user ? `<@${exploration.user_id}>` : `User ${exploration.user_id}`;

    // Post result message
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
    } else {
      const message = getReturnEmptyMessage(userMention, `**${biomeName}**`);
      await channel.send(message);
    }
  } catch (error) {
    console.error(`❌ Error processing exploration ${exploration.id}:`, error);
  }
}
