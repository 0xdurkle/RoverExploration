import { ButtonInteraction, TextChannel } from 'discord.js';
import { startExploration } from '../services/explorationService';
import { getBiome, getDurationMultiplier } from '../services/rng';
import { getCooldownRemaining } from '../services/cooldownService';
import { getExplorationStartMessage } from '../utils/messageVariations';
import { HOURS_TO_MILLISECONDS } from '../constants';
import { safeDeferUpdate, safeEditReply, safeFollowUp } from '../utils/interactionHelpers';
import { markStartMessageSent } from '../db/models';

/**
 * Handle duration selection button click
 * NEW APPROACH: Use database-level atomic operations to prevent duplicates
 */
export async function handleDurationSelect(interaction: ButtonInteraction): Promise<void> {
  const userId = interaction.user.id;
  
  try {
    console.log(`⏱️ [DURATION_SELECT] Handling duration selection for interaction ${interaction.id}, user ${userId}`);
    
    // Safely defer the update
    await safeDeferUpdate(interaction);
    
    // Parse customId: duration_{biomeId}_{hours}
    const withoutPrefix = interaction.customId.replace('duration_', '');
    const lastUnderscoreIndex = withoutPrefix.lastIndexOf('_');
    const biomeId = withoutPrefix.substring(0, lastUnderscoreIndex);
    const durationHours = parseFloat(withoutPrefix.substring(lastUnderscoreIndex + 1));

    const biome = getBiome(biomeId);
    if (!biome) {
      console.error(`⏱️ [DURATION_SELECT] Invalid biome ID: ${biomeId}`);
      await safeFollowUp(interaction, {
        content: '❌ Invalid biome selected.',
        ephemeral: true,
      });
      return;
    }

    // Check cooldown
    const remaining = await getCooldownRemaining(userId);
    if (remaining && remaining > 0) {
      await safeEditReply(interaction, {
        content: '⚠️ You already have an active exploration. Please wait for it to complete.',
        components: [],
      });
      return;
    }

    // Create exploration
    console.log(`⏱️ [DURATION_SELECT] Creating exploration for user ${userId}, biome ${biomeId}, duration ${durationHours}h`);
    const exploration = await startExploration(userId, biomeId, durationHours);
    console.log(`⏱️ [DURATION_SELECT] ✅ Exploration created: ID ${exploration.id}`);

    // Format duration display
    let durationText: string;
    if (durationHours < 1) {
      const seconds = Math.round(durationHours * (HOURS_TO_MILLISECONDS / 1000));
      durationText = `${seconds}s`;
    } else if (durationHours === 1) {
      durationText = '1 hour';
    } else {
      durationText = `${durationHours} hours`;
    }

    const multiplier = getDurationMultiplier(durationHours);
    const multiplierText = multiplier > 1 ? ` (${multiplier}x item odds)` : '';

    // Send private message to user
    await safeEditReply(interaction, {
      content: `🚀 You set off into the **${biome.name}** for **${durationText}**${multiplierText}.\n\nI'll notify you when you return!`,
      components: [],
    });

    // CRITICAL: Use database-level atomic operation to send public message
    // This ensures only ONE message is sent, even if handler is called multiple times
    const channelId = process.env.DISCORD_CHANNEL_ID;
    if (channelId) {
      // Atomically mark message as sent in database
      // This will return true only if message wasn't already sent
      const shouldSendMessage = await markStartMessageSent(exploration.id);
      
      if (shouldSendMessage) {
        // We successfully marked it as sent - send the message
        try {
          console.log(`⏱️ [DURATION_SELECT] Sending public message for exploration ${exploration.id}`);
          const publicChannel = await interaction.client.channels.fetch(channelId);
          if (publicChannel && publicChannel.isTextBased()) {
            const userMention = `<@${userId}>`;
            const message = getExplorationStartMessage(userMention, `**${biome.name}**`, `**${durationText}**`);
            await (publicChannel as TextChannel).send(message);
            console.log(`⏱️ [DURATION_SELECT] ✅ Sent public message for exploration ${exploration.id}`);
          }
        } catch (error) {
          console.error(`⏱️ [DURATION_SELECT] ❌ Error sending public message:`, error);
          // Don't fail the exploration if message fails
        }
      } else {
        // Message was already sent by another handler call - skip
        console.log(`⏱️ [DURATION_SELECT] ⚠️ Message already sent for exploration ${exploration.id}, skipping duplicate`);
      }
    }
  } catch (error: any) {
    console.error(`⏱️ [DURATION_SELECT] ❌ Error:`, error);
    
    // Handle specific errors
    if (error.message && error.message.includes('already has an active exploration')) {
      await safeEditReply(interaction, {
        content: '⚠️ You already have an active exploration. Please wait for it to complete.',
        components: [],
      });
      return;
    }
    
    // Generic error message
    const errorSent = await safeEditReply(interaction, {
      content: '❌ An error occurred while starting your exploration. Please try again.',
      components: [],
    });
    
    if (!errorSent) {
      await safeFollowUp(interaction, {
        content: '❌ An error occurred while starting your exploration. Please try again.',
        ephemeral: true,
      });
    }
  }
}
