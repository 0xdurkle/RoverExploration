import { Client, TextChannel } from 'discord.js';
import { getCompletedExplorations, Exploration } from '../db/models';
import { finishExploration } from '../services/explorationService';
import { getRarityEmoji } from '../services/rng';
import { getBiome } from '../services/rng';
import { getReturnWithItemMessage, getReturnEmptyMessage } from '../utils/messageVariations';

/**
 * Check for completed explorations and post results
 * This runs as a cron job every 10 seconds
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

    // Finish all explorations first and collect results
    const explorationResults = new Map<number, { exploration: Exploration; itemFound: Awaited<ReturnType<typeof finishExploration>> }>();
    
    for (const exploration of completed) {
      const itemFound = await finishExploration(
        exploration.id,
        exploration.user_id,
        exploration.biome,
        exploration.duration_hours
      );
      explorationResults.set(exploration.id, { exploration, itemFound });
    }

    // Group explorations by biome and item
    const grouped = new Map<string, { 
      explorations: Exploration[]; 
      biome: string; 
      itemName: string | null; 
      itemRarity: 'uncommon' | 'rare' | 'legendary' | 'epic' | null 
    }>();
    
    for (const { exploration, itemFound } of explorationResults.values()) {
      const biome = getBiome(exploration.biome);
      const biomeName = biome?.name || exploration.biome;
      const key = `${biomeName}|${itemFound?.name || 'empty'}`;
      
      if (!grouped.has(key)) {
        grouped.set(key, {
          explorations: [],
          biome: biomeName,
          itemName: itemFound?.name || null,
          itemRarity: itemFound?.rarity || null,
        });
      }
      
      grouped.get(key)!.explorations.push(exploration);
    }

    // Process grouped explorations
    for (const group of grouped.values()) {
      await processGroupedExplorations(group, channel);
    }

    console.log(`✅ Processed ${completed.length} completed exploration(s)`);
  } catch (error) {
    console.error('❌ Error checking explorations:', error);
  }
}

/**
 * Process grouped explorations (multiple users finding the same item)
 */
async function processGroupedExplorations(
  group: { 
    explorations: Exploration[]; 
    biome: string; 
    itemName: string | null; 
    itemRarity: 'uncommon' | 'rare' | 'legendary' | 'epic' | null 
  },
  channel: TextChannel
): Promise<void> {
  try {
    // Get user mentions
    const userMentions = await Promise.all(
      group.explorations.map(async (exploration) => {
        try {
          const user = await channel.client.users.fetch(exploration.user_id);
          return user ? `<@${exploration.user_id}>` : `User ${exploration.user_id}`;
        } catch {
          return `User ${exploration.user_id}`;
        }
      })
    );

    const usersText = userMentions.join(' ');

    // Post result message using random variations
    if (group.itemName && group.itemRarity) {
      // Item found - use random message variation
      const emoji = getRarityEmoji(group.itemRarity);
      const message = getReturnWithItemMessage(
        emoji,
        usersText,
        group.biome,
        group.itemName,
        group.itemRarity
      );
      await channel.send(message);
    } else {
      // Empty-handed - use random message variation
      const message = getReturnEmptyMessage(usersText, group.biome);
      await channel.send(message);
    }
  } catch (error) {
    console.error(`❌ Error processing grouped explorations:`, error);
  }
}

/**
 * Process a single completed exploration (kept for backward compatibility, but not currently used)
 */
async function processExploration(exploration: Exploration, channel: TextChannel): Promise<void> {
  try {
    const biome = getBiome(exploration.biome);
    const biomeName = biome?.name || exploration.biome;

    // Finish exploration and determine item found
    const itemFound = await finishExploration(
      exploration.id,
      exploration.user_id,
      exploration.biome,
      exploration.duration_hours
    );

    // Get user mention
    const user = await channel.client.users.fetch(exploration.user_id);
    const userMention = user ? `<@${exploration.user_id}>` : `User ${exploration.user_id}`;

    // Post result message using random variations
    if (itemFound) {
      const emoji = getRarityEmoji(itemFound.rarity);
      const message = getReturnWithItemMessage(
        emoji,
        userMention,
        biomeName,
        itemFound.name,
        itemFound.rarity
      );
      await channel.send(message);
    } else {
      const message = getReturnEmptyMessage(userMention, biomeName);
      await channel.send(message);
    }
  } catch (error) {
    console.error(`❌ Error processing exploration ${exploration.id}:`, error);
  }
}
