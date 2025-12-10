import { ButtonInteraction, TextChannel } from 'discord.js';
import { startExploration } from '../services/explorationService';
import { getBiome, getDurationMultiplier } from '../services/rng';
import { getCooldownRemaining } from '../services/cooldownService';
import { getExplorationStartMessage } from '../utils/messageVariations';
import { HOURS_TO_MILLISECONDS } from '../constants';
import { safeDeferUpdate, safeEditReply, safeFollowUp } from '../utils/interactionHelpers';

/**
 * Handle duration selection button click
 */
export async function handleDurationSelect(interaction: ButtonInteraction): Promise<void> {
  try {
    console.log(`⏱️ [DURATION_SELECT] Handling duration selection for interaction ${interaction.id}`);
    
    // Safely defer the update IMMEDIATELY
    const deferred = await safeDeferUpdate(interaction);
    if (!deferred && !interaction.deferred && !interaction.replied) {
      console.error(`⏱️ [DURATION_SELECT] Failed to defer interaction ${interaction.id}`);
      return;
    }
    console.log(`⏱️ [DURATION_SELECT] ✅ Interaction ${interaction.id} deferred, processing...`);

  // Parse customId: duration_{biomeId}_{hours}
  // Biome IDs contain underscores (e.g., "crystal_caverns"), so we need to split from the end
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

    // Double-check cooldown (user might have clicked multiple times)
    console.log(`⏱️ [DURATION_SELECT] Checking cooldown for user ${interaction.user.id}...`);
    const remaining = await getCooldownRemaining(interaction.user.id);
    if (remaining && remaining > 0) {
      console.log(`⏱️ [DURATION_SELECT] User ${interaction.user.id} has active cooldown: ${remaining}ms`);
      await safeEditReply(interaction, {
        content: '⚠️ You already have an active exploration. Please wait for it to complete.',
        components: [],
      });
      return;
    }

    // Start exploration
    console.log(`⏱️ [DURATION_SELECT] Starting exploration for user ${interaction.user.id}, biome ${biomeId}, duration ${durationHours}h`);
    await startExploration(interaction.user.id, biomeId, durationHours);
    console.log(`⏱️ [DURATION_SELECT] ✅ Exploration started successfully`);

    const multiplier = getDurationMultiplier(durationHours);
    const multiplierText = multiplier > 1 ? ` (${multiplier}x item odds)` : '';
    
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

    // Send private ephemeral message to user
    const editSuccess = await safeEditReply(interaction, {
      content: `🚀 You set off into the **${biome.name}** for **${durationText}**${multiplierText}.\n\nI'll notify you when you return!`,
      components: [],
    });

    if (editSuccess) {
      console.log(`⏱️ [DURATION_SELECT] ✅ Successfully updated interaction ${interaction.id}`);
    } else {
      console.error(`⏱️ [DURATION_SELECT] ⚠️ Failed to update interaction ${interaction.id}, but exploration was started`);
    }

    // Send public message to the channel
    const channelId = process.env.DISCORD_CHANNEL_ID;
    if (channelId && interaction.channel) {
      try {
        const publicChannel = await interaction.client.channels.fetch(channelId);
        if (publicChannel && publicChannel.isTextBased()) {
          const userMention = `<@${interaction.user.id}>`;
          const message = getExplorationStartMessage(userMention, `**${biome.name}**`, `**${durationText}**`);
          await (publicChannel as TextChannel).send(message);
          console.log(`⏱️ [DURATION_SELECT] ✅ Sent public exploration start message`);
        }
      } catch (error) {
        console.error(`⏱️ [DURATION_SELECT] ❌ Error sending public exploration start message:`, error);
        // Don't fail the exploration if the public message fails
      }
    }
  } catch (error) {
    console.error(`⏱️ [DURATION_SELECT] ❌ Error starting exploration:`, error);
    console.error(`⏱️ [DURATION_SELECT] Error stack:`, error instanceof Error ? error.stack : String(error));
    
    // Try to send error message
    const errorSent = await safeEditReply(interaction, {
      content: '❌ An error occurred while starting your exploration. Please try again.',
      components: [],
    });
    
    if (!errorSent) {
      // If editReply failed, try followUp
      await safeFollowUp(interaction, {
        content: '❌ An error occurred while starting your exploration. Please try again.',
        ephemeral: true,
      });
    }
  }
}
