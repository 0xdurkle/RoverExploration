import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  TextChannel,
} from 'discord.js';
import { startExploration } from '../services/explorationService';
import { getAllBiomes, getBiome, getDurationMultiplier } from '../services/rng';
import { getCooldownRemaining, formatTimeRemaining } from '../services/cooldownService';
import { getExplorationStartMessage } from '../utils/messageVariations';
import { HOURS_TO_MILLISECONDS } from '../constants';
import { markStartMessageSent } from '../db/models';
import { safeDeferReply, safeEditReply } from '../utils/interactionHelpers';

/**
 * Get command builder for /explore
 */
export function getExploreCommandBuilder(): SlashCommandBuilder {
  const biomes = getAllBiomes();
  
  return new SlashCommandBuilder()
    .setName('explore')
    .setDescription('Start an exploration expedition in a biome')
    .addStringOption((option) =>
      option
        .setName('biome')
        .setDescription('The biome to explore')
        .setRequired(true)
        .addChoices(...biomes.map((b) => ({ name: b.name, value: b.id })))
    )
    .addStringOption((option) =>
      option
        .setName('duration')
        .setDescription('How long to explore')
        .setRequired(true)
        .addChoices(
          { name: '30 seconds', value: '30s' },
          { name: '1 hour', value: '1h' },
          { name: '3 hours', value: '3h' },
          { name: '6 hours', value: '6h' },
          { name: '12 hours', value: '12h' }
        )
    );
}

/**
 * Handle /explore command
 * NEW APPROACH: Single command with options, no buttons, atomic message sending
 */
export async function handleExploreCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    const userId = interaction.user.id;
    console.log(`🌍 [EXPLORE] User ${userId} starting exploration`);
    
    // Defer reply immediately
    await safeDeferReply(interaction, { ephemeral: true });
    
    // Get options
    const biomeId = interaction.options.getString('biome', true);
    const durationText = interaction.options.getString('duration', true);
    
    // Validate biome
    const biome = getBiome(biomeId);
    if (!biome) {
      await safeEditReply(interaction, {
        content: '❌ Invalid biome selected.',
      });
      return;
    }
    
    // Parse duration
    let durationHours: number;
    if (durationText === '30s') {
      durationHours = 0.008333;
    } else if (durationText === '1h') {
      durationHours = 1;
    } else if (durationText === '3h') {
      durationHours = 3;
    } else if (durationText === '6h') {
      durationHours = 6;
    } else if (durationText === '12h') {
      durationHours = 12;
    } else {
      await safeEditReply(interaction, {
        content: '❌ Invalid duration selected.',
      });
      return;
    }
    
    // Check cooldown
    const remaining = await getCooldownRemaining(userId);
    if (remaining && remaining > 0) {
      const timeRemaining = formatTimeRemaining(remaining);
      await safeEditReply(interaction, {
        content: `You are already exploring. You'll return in ${timeRemaining}.`,
      });
      return;
    }
    
    // Create exploration in database
    console.log(`🌍 [EXPLORE] Creating exploration: user=${userId}, biome=${biomeId}, duration=${durationHours}h`);
    const exploration = await startExploration(userId, biomeId, durationHours);
    console.log(`🌍 [EXPLORE] ✅ Exploration created: ID ${exploration.id}`);
    
    // Format duration for display
    const multiplier = getDurationMultiplier(durationHours);
    const multiplierText = multiplier > 1 ? ` (${multiplier}x item odds)` : '';
    
    // Send private confirmation to user
    await safeEditReply(interaction, {
      content: `🚀 You set off into the **${biome.name}** for **${durationText}**${multiplierText}.\n\nI'll notify you when you return!`,
    });
    
    // CRITICAL: Atomic database operation to send public message
    // Only ONE handler can successfully mark message as sent
    const channelId = process.env.DISCORD_CHANNEL_ID;
    if (channelId) {
      const shouldSendMessage = await markStartMessageSent(exploration.id);
      
      if (shouldSendMessage) {
        // We got the lock - send the ONE message
        try {
          console.log(`🌍 [EXPLORE] Sending public message for exploration ${exploration.id}`);
          const publicChannel = await interaction.client.channels.fetch(channelId);
          if (publicChannel && publicChannel.isTextBased()) {
            const userMention = `<@${userId}>`;
            const message = getExplorationStartMessage(userMention, `**${biome.name}**`, `**${durationText}**`);
            await (publicChannel as TextChannel).send(message);
            console.log(`🌍 [EXPLORE] ✅ Sent public message for exploration ${exploration.id}`);
          }
        } catch (error) {
          console.error(`🌍 [EXPLORE] ❌ Error sending public message:`, error);
          // Don't fail exploration if message fails
        }
      } else {
        // Message already sent by another call - this should never happen with slash commands
        // but we handle it gracefully
        console.log(`🌍 [EXPLORE] ⚠️ Message already sent for exploration ${exploration.id} (unexpected)`);
      }
    }
  } catch (error: any) {
    console.error(`🌍 [EXPLORE] ❌ Error:`, error);
    
    if (error.message && error.message.includes('already has an active exploration')) {
      await safeEditReply(interaction, {
        content: '⚠️ You already have an active exploration. Please wait for it to complete.',
      });
      return;
    }
    
    await safeEditReply(interaction, {
      content: '❌ An error occurred while starting your exploration. Please try again.',
    });
  }
}
