import { ButtonInteraction, TextChannel } from 'discord.js';
import { startExploration } from '../services/explorationService';
import { getBiome, getDurationMultiplier } from '../services/rng';
import { getCooldownRemaining } from '../services/cooldownService';
import { getExplorationStartMessage } from '../utils/messageVariations';
import { HOURS_TO_MILLISECONDS } from '../constants';
import { safeDeferUpdate, safeEditReply, safeFollowUp } from '../utils/interactionHelpers';

// Track processing interactions to prevent duplicates
const processingInteractions = new Set<string>();
const processingUsers = new Map<string, number>(); // Map user ID to timestamp

/**
 * Handle duration selection button click
 */
export async function handleDurationSelect(interaction: ButtonInteraction): Promise<void> {
  // Prevent duplicate processing of the same interaction
  if (processingInteractions.has(interaction.id)) {
    console.log(`⏱️ [DURATION_SELECT] Interaction ${interaction.id} already being processed, ignoring duplicate`);
    return;
  }

  // Prevent duplicate processing for the same user (race condition protection)
  const userId = interaction.user.id;
  const now = Date.now();
  const userProcessingTime = processingUsers.get(userId);
  
  // Check if user is currently processing (within last 5 seconds)
  if (userProcessingTime && (now - userProcessingTime) < 5000) {
    console.log(`⏱️ [DURATION_SELECT] User ${userId} already has an exploration being started (${now - userProcessingTime}ms ago), ignoring duplicate`);
    try {
      await safeDeferUpdate(interaction);
      await safeEditReply(interaction, {
        content: '⚠️ An exploration is already being started. Please wait a moment.',
        components: [],
      });
    } catch (error) {
      // Ignore errors if interaction expired
    }
    return;
  }

  try {
    // Mark as processing
    processingInteractions.add(interaction.id);
    processingUsers.set(userId, Date.now());
    
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

    // CRITICAL: Final check right before creating exploration to prevent race conditions
    // Check database directly for any active exploration
    const { getDb } = await import('../db/connection');
    const { getActiveExploration } = await import('../db/models');
    const db = getDb();
    const now = new Date();
    
    // Check if user has any active exploration in database
    const activeCheck = await db.query(
      `SELECT id FROM explorations 
       WHERE user_id = $1 AND ends_at > $2 AND completed = FALSE 
       LIMIT 1`,
      [userId, now]
    );
    
    if (activeCheck.rows.length > 0) {
      console.log(`⏱️ [DURATION_SELECT] ⚠️ User ${userId} already has active exploration ${activeCheck.rows[0].id} in database, preventing duplicate`);
      await safeEditReply(interaction, {
        content: '⚠️ You already have an active exploration. Please wait for it to complete.',
        components: [],
      });
      return;
    }

    // Start exploration
    console.log(`⏱️ [DURATION_SELECT] Starting exploration for user ${userId}, biome ${biomeId}, duration ${durationHours}h`);
    await startExploration(userId, biomeId, durationHours);
    console.log(`⏱️ [DURATION_SELECT] ✅ Exploration started successfully`);
    
    // CRITICAL: Verify only ONE exploration was created
    const verifyCheck = await db.query(
      `SELECT id FROM explorations 
       WHERE user_id = $1 AND ends_at > $2 AND completed = FALSE 
       ORDER BY created_at DESC`,
      [userId, now]
    );
    
    if (verifyCheck.rows.length > 1) {
      console.error(`⏱️ [DURATION_SELECT] ❌ CRITICAL: User ${userId} has ${verifyCheck.rows.length} active explorations! This should not happen.`);
      console.error(`⏱️ [DURATION_SELECT] Active exploration IDs:`, verifyCheck.rows.map((r: any) => r.id));
    } else {
      console.log(`⏱️ [DURATION_SELECT] ✅ Verified: User ${userId} has exactly ${verifyCheck.rows.length} active exploration(s)`);
    }

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

    // Send public message to the channel (only once)
    const channelId = process.env.DISCORD_CHANNEL_ID;
    if (channelId && interaction.channel) {
      try {
        const publicChannel = await interaction.client.channels.fetch(channelId);
        if (publicChannel && publicChannel.isTextBased()) {
          const userMention = `<@${userId}>`;
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
  } finally {
    // Always clear processing flags
    processingInteractions.delete(interaction.id);
    // Clear user processing flag after a delay to prevent race conditions
    // Keep it longer (5 seconds) to catch interactions that come in slightly delayed
    setTimeout(() => {
      processingUsers.delete(userId);
      console.log(`⏱️ [DURATION_SELECT] Cleared processing flag for user ${userId}`);
    }, 5000); // 5 second cooldown to prevent race conditions from delayed interactions
  }
}
