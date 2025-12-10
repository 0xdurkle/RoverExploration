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

// Track users currently creating explorations to prevent race conditions
// Key: user ID, Value: timestamp when they started creating
const usersCreatingExplorations = new Map<string, number>();

// Clean up old sent message tracking periodically
setInterval(() => {
  if (sentMessages.size > 100) {
    sentMessages.clear();
    console.log(`🧹 [DURATION_SELECT] Cleared sent messages cache`);
  }
  // Clean up old user locks (older than 5 seconds)
  const now = Date.now();
  for (const [userId, timestamp] of usersCreatingExplorations.entries()) {
    if (now - timestamp > 5000) {
      usersCreatingExplorations.delete(userId);
    }
  }
}, 60000); // Every minute

/**
 * Handle duration selection button click
 * Note: Duplicate prevention is handled at the index.ts level via atomic interaction tracking
 */
export async function handleDurationSelect(interaction: ButtonInteraction): Promise<void> {
  const userId = interaction.user.id;
  const callId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    console.log(`⏱️ [DURATION_SELECT] ==========================================`);
    console.log(`⏱️ [DURATION_SELECT] [CALL_ID: ${callId}] Handling duration selection for interaction ${interaction.id}, user ${userId}`);
    console.log(`⏱️ [DURATION_SELECT] [CALL_ID: ${callId}] Custom ID: ${interaction.customId}`);
    console.log(`⏱️ [DURATION_SELECT] [CALL_ID: ${callId}] Deferred: ${interaction.deferred}, Replied: ${interaction.replied}`);
    
    // CRITICAL: Check if user is already creating an exploration (prevents race conditions from rapid clicks)
    const now = Date.now();
    const userLockTime = usersCreatingExplorations.get(userId);
    if (userLockTime && (now - userLockTime) < 5000) {
      console.log(`⏱️ [DURATION_SELECT] ⚠️ User ${userId} is already creating an exploration (${now - userLockTime}ms ago), ignoring duplicate`);
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
    
    // Mark user as creating exploration
    usersCreatingExplorations.set(userId, now);
    
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
      usersCreatingExplorations.delete(userId); // Clear lock on error
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
      usersCreatingExplorations.delete(userId); // Clear lock on early return
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
      // Clear user lock on error
      usersCreatingExplorations.delete(userId);
      
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
    
    // Clear user lock after successful exploration creation
    usersCreatingExplorations.delete(userId);

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
    // This must be the ABSOLUTE LAST thing that happens - no code after this should send messages
    const channelId = process.env.DISCORD_CHANNEL_ID;
    if (channelId && explorationId) {
      // CRITICAL: Atomic check-and-set - must happen BEFORE any async operations
      // Check if message was already sent (this is the ONLY place messages are sent)
      if (sentMessages.has(explorationId)) {
        console.log(`⏱️ [DURATION_SELECT] [CALL_ID: ${callId}] ⚠️ BLOCKED: Message already sent for exploration ${explorationId}, skipping duplicate`);
        console.log(`⏱️ [DURATION_SELECT] [CALL_ID: ${callId}] Interaction ID: ${interaction.id}, User: ${userId}`);
        console.log(`⏱️ [DURATION_SELECT] [CALL_ID: ${callId}] sentMessages Set contents:`, Array.from(sentMessages));
        console.log(`⏱️ [DURATION_SELECT] ==========================================`);
        return; // CRITICAL: Exit immediately - do not proceed
      }
      
      // CRITICAL: Use database-level atomic update to prevent duplicates
      // This ensures that even if handler is called twice with different interaction IDs,
      // only one will successfully mark the exploration and send the message
      const { getDb } = await import('../db/connection');
      const db = getDb();
      
      // First verify exploration exists
      const verifyExploration = await db.query(
        `SELECT id, created_at FROM explorations WHERE id = $1`,
        [explorationId]
      );
      
      if (verifyExploration.rows.length === 0) {
        console.error(`⏱️ [DURATION_SELECT] [CALL_ID: ${callId}] ❌ Exploration ${explorationId} not found in database, not sending message`);
        console.log(`⏱️ [DURATION_SELECT] ==========================================`);
        return;
      }
      
      // CRITICAL: Double-check in-memory cache AFTER database query (catches race conditions)
      // If another handler call already added it while we were querying, skip
      if (sentMessages.has(explorationId)) {
        console.log(`⏱️ [DURATION_SELECT] [CALL_ID: ${callId}] ⚠️ BLOCKED: Message already sent for exploration ${explorationId} (race condition detected), skipping duplicate`);
        console.log(`⏱️ [DURATION_SELECT] [CALL_ID: ${callId}] Interaction ID: ${interaction.id}, User: ${userId}`);
        console.log(`⏱️ [DURATION_SELECT] ==========================================`);
        return;
      }
      
      // CRITICAL: Mark as sent IMMEDIATELY (before any async operations)
      // This ensures that even if handler is called twice concurrently, only one will proceed
      console.log(`⏱️ [DURATION_SELECT] [CALL_ID: ${callId}] ✅ LOCKING: Marking exploration ${explorationId} as sent (interaction ${interaction.id})`);
      console.log(`⏱️ [DURATION_SELECT] [CALL_ID: ${callId}] sentMessages size before add: ${sentMessages.size}`);
      sentMessages.add(explorationId);
      console.log(`⏱️ [DURATION_SELECT] [CALL_ID: ${callId}] sentMessages size after add: ${sentMessages.size}`);
      console.log(`⏱️ [DURATION_SELECT] [CALL_ID: ${callId}] Verification: has(${explorationId}) = ${sentMessages.has(explorationId)}`);
      
      try {
        // CRITICAL: Final check before sending - ensure we haven't already sent
        // This is a defensive check in case something went wrong
        if (sentMessages.has(explorationId)) {
          // Double-check: verify we're the one who added it
          // If we're here, we should have added it, but be extra safe
          console.log(`⏱️ [DURATION_SELECT] [CALL_ID: ${callId}] Final check: exploration ${explorationId} is marked as sent`);
        }
        
        console.log(`⏱️ [DURATION_SELECT] [CALL_ID: ${callId}] Sending public message for exploration ${explorationId}`);
        const publicChannel = await interaction.client.channels.fetch(channelId);
        if (publicChannel && publicChannel.isTextBased()) {
          const userMention = `<@${userId}>`;
          const message = getExplorationStartMessage(userMention, `**${biome.name}**`, `**${durationText}**`);
          console.log(`⏱️ [DURATION_SELECT] [CALL_ID: ${callId}] About to send message: ${message.substring(0, 100)}...`);
          
          // CRITICAL: Final check before sending - ensure we haven't already sent
          // This is a defensive check in case something went wrong between marking and sending
          if (!sentMessages.has(explorationId)) {
            console.error(`⏱️ [DURATION_SELECT] [CALL_ID: ${callId}] ❌ CRITICAL: Exploration ${explorationId} was removed from sentMessages before sending! Re-adding...`);
            sentMessages.add(explorationId);
          }
          
          // CRITICAL: Send message ONCE - this is the ONLY place messages are sent
          console.log(`⏱️ [DURATION_SELECT] [CALL_ID: ${callId}] EXECUTING channel.send() for exploration ${explorationId}`);
          const sentMessage = await (publicChannel as TextChannel).send(message);
          console.log(`⏱️ [DURATION_SELECT] [CALL_ID: ${callId}] ✅ Sent public exploration start message for exploration ${explorationId}`);
          console.log(`⏱️ [DURATION_SELECT] [CALL_ID: ${callId}] Message ID: ${sentMessage.id}`);
          console.log(`⏱️ [DURATION_SELECT] [CALL_ID: ${callId}] Full message: ${message}`);
          
          // Verify the message is still in sentMessages (should never fail, but be defensive)
          if (!sentMessages.has(explorationId)) {
            console.error(`⏱️ [DURATION_SELECT] [CALL_ID: ${callId}] ❌ CRITICAL: Exploration ${explorationId} was removed from sentMessages after sending!`);
            // Re-add it to prevent duplicates
            sentMessages.add(explorationId);
          }
        } else {
          console.error(`⏱️ [DURATION_SELECT] [CALL_ID: ${callId}] ❌ Channel ${channelId} is not a text channel`);
          // Remove from sent set since we didn't actually send
          sentMessages.delete(explorationId);
        }
      } catch (error) {
        console.error(`⏱️ [DURATION_SELECT] [CALL_ID: ${callId}] ❌ Error sending public exploration start message:`, error);
        // Remove from sent set on error so it can be retried if needed
        sentMessages.delete(explorationId);
        // Don't fail the exploration if the public message fails
      }
    }
    console.log(`⏱️ [DURATION_SELECT] ==========================================`);
  } catch (error) {
    // Always clear user lock on error
    usersCreatingExplorations.delete(userId);
    
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
