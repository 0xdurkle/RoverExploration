import { ButtonInteraction, TextChannel } from 'discord.js';
import { startExploration } from '../services/explorationService';
import { getBiome, getDurationMultiplier } from '../services/rng';
import { getCooldownRemaining } from '../services/cooldownService';
import { getExplorationStartMessage } from '../utils/messageVariations';
import { HOURS_TO_MILLISECONDS } from '../constants';
import { safeDeferUpdate, safeEditReply, safeFollowUp } from '../utils/interactionHelpers';

// Track which exploration IDs have had their public message sent
// This prevents duplicate messages even if handler is called multiple times
const sentMessages = new Set<number>();

// Clean up old sent message tracking periodically
setInterval(() => {
  if (sentMessages.size > 100) {
    sentMessages.clear();
    console.log(`🧹 [DURATION_SELECT] Cleared sent messages cache`);
  }
}, 60000); // Every minute

/**
 * Handle duration selection button click
 * Note: Duplicate prevention is handled at the index.ts level via atomic interaction tracking
 */
export async function handleDurationSelect(interaction: ButtonInteraction): Promise<void> {
  const userId = interaction.user.id;
  
  try {
    console.log(`⏱️ [DURATION_SELECT] Handling duration selection for interaction ${interaction.id}, user ${userId}`);
    
    // Safely defer the update IMMEDIATELY
    const deferred = await safeDeferUpdate(interaction);
    if (!deferred && !interaction.deferred && !interaction.replied) {
      console.error(`⏱️ [DURATION_SELECT] Failed to defer interaction ${interaction.id} - interaction may have expired`);
      // Interaction expired, but we should still try to save the exploration
      // Don't return early - continue to save the exploration even if Discord interaction failed
      console.log(`⏱️ [DURATION_SELECT] ⚠️ Continuing to save exploration despite expired interaction`);
    } else {
      console.log(`⏱️ [DURATION_SELECT] ✅ Interaction ${interaction.id} deferred, processing...`);
    }

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
    console.log(`⏱️ [DURATION_SELECT] Checking cooldown for user ${userId}...`);
    const remaining = await getCooldownRemaining(userId);
    if (remaining && remaining > 0) {
      console.log(`⏱️ [DURATION_SELECT] User ${userId} has active cooldown: ${remaining}ms`);
      await safeEditReply(interaction, {
        content: '⚠️ You already have an active exploration. Please wait for it to complete.',
        components: [],
      });
      return;
    }

    // Start exploration (createExploration now uses transaction with row-level locking)
    // This prevents race conditions at the database level
    console.log(`⏱️ [DURATION_SELECT] Starting exploration for user ${userId}, biome ${biomeId}, duration ${durationHours}h`);
    
    let exploration: any = null;
    try {
      exploration = await startExploration(userId, biomeId, durationHours);
      console.log(`⏱️ [DURATION_SELECT] ✅ Exploration started successfully, ID: ${exploration.id}`);
    } catch (error: any) {
      // If error indicates user already has active exploration, handle gracefully
      if (error.message && error.message.includes('already has an active exploration')) {
        console.log(`⏱️ [DURATION_SELECT] ⚠️ User ${userId} already has active exploration, preventing duplicate`);
        await safeEditReply(interaction, {
          content: '⚠️ You already have an active exploration. Please wait for it to complete.',
          components: [],
        });
        return;
      }
      // Re-throw other errors
      throw error;
    }

    // CRITICAL: Only proceed if exploration was actually created
    if (!exploration || !exploration.id) {
      console.error(`⏱️ [DURATION_SELECT] ❌ No exploration returned, aborting message sending`);
      throw new Error('Exploration was not created');
    }
    
    const explorationId = exploration.id;

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
      console.error(`⏱️ [DURATION_SELECT] ⚠️ Failed to update interaction ${interaction.id}, but exploration ${explorationId} was started`);
    }

    // CRITICAL: Send public message ONLY ONCE per exploration ID
    // Check if message was already sent for this exploration ID (atomic check)
    const channelId = process.env.DISCORD_CHANNEL_ID;
    if (channelId && explorationId) {
      // Double-check: verify exploration exists and was just created
      const { getDb } = await import('../db/connection');
      const db = getDb();
      const verifyExploration = await db.query(
        `SELECT id, created_at FROM explorations WHERE id = $1`,
        [explorationId]
      );
      
      if (verifyExploration.rows.length === 0) {
        console.error(`⏱️ [DURATION_SELECT] ❌ Exploration ${explorationId} not found in database, not sending message`);
        return;
      }
      
      // Check if message was already sent for this exploration ID
      if (sentMessages.has(explorationId)) {
        console.log(`⏱️ [DURATION_SELECT] ⚠️ Message already sent for exploration ${explorationId}, skipping duplicate`);
        return;
      }
      
      // Mark as sent BEFORE sending (prevents race condition)
      sentMessages.add(explorationId);
      
      try {
        console.log(`⏱️ [DURATION_SELECT] Sending public message for exploration ${explorationId}`);
        const publicChannel = await interaction.client.channels.fetch(channelId);
        if (publicChannel && publicChannel.isTextBased()) {
          const userMention = `<@${userId}>`;
          const message = getExplorationStartMessage(userMention, `**${biome.name}**`, `**${durationText}**`);
          await (publicChannel as TextChannel).send(message);
          console.log(`⏱️ [DURATION_SELECT] ✅ Sent public exploration start message for exploration ${explorationId}`);
        }
      } catch (error) {
        console.error(`⏱️ [DURATION_SELECT] ❌ Error sending public exploration start message:`, error);
        // Remove from sent set on error so it can be retried if needed
        sentMessages.delete(explorationId);
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
