import { ButtonInteraction, ChatInputCommandInteraction, Interaction } from 'discord.js';

/**
 * Safely defer an interaction update
 * Prevents "already acknowledged" errors
 */
export async function safeDeferUpdate(interaction: ButtonInteraction): Promise<boolean> {
  try {
    if (interaction.deferred || interaction.replied) {
      console.log(`⚠️ [INTERACTION] Interaction ${interaction.id} already deferred/replied, skipping`);
      return false;
    }
    await interaction.deferUpdate();
    return true;
  } catch (error: any) {
    // Ignore "already acknowledged" errors - they're harmless
    if (error.code === 40060 || error.code === 10062) {
      console.log(`⚠️ [INTERACTION] Interaction ${interaction.id} already acknowledged (code ${error.code}), continuing`);
      return false;
    }
    console.error(`❌ [INTERACTION] Error deferring update for interaction ${interaction.id}:`, error);
    throw error;
  }
}

/**
 * Safely edit a reply
 * Handles already replied/deferred interactions
 */
export async function safeEditReply(
  interaction: ButtonInteraction | ChatInputCommandInteraction,
  options: Parameters<typeof interaction.editReply>[0]
): Promise<boolean> {
  try {
    if (!interaction.deferred && !interaction.replied) {
      console.log(`⚠️ [INTERACTION] Interaction ${interaction.id} not deferred, deferring first...`);
      if (interaction.isButton()) {
        await interaction.deferUpdate();
      } else {
        await interaction.deferReply({ ephemeral: true });
      }
    }
    await interaction.editReply(options);
    return true;
  } catch (error: any) {
    // Ignore "already acknowledged" and "unknown interaction" errors
    if (error.code === 40060 || error.code === 10062) {
      console.log(`⚠️ [INTERACTION] Interaction ${interaction.id} expired/already handled (code ${error.code})`);
      return false;
    }
    console.error(`❌ [INTERACTION] Error editing reply for interaction ${interaction.id}:`, error);
    // Try followUp as fallback
    try {
      if (interaction.isButton() || (interaction.isChatInputCommand() && interaction.ephemeral)) {
        await interaction.followUp({ ...options, ephemeral: true });
        return true;
      }
    } catch (followUpError) {
      console.error(`❌ [INTERACTION] FollowUp also failed:`, followUpError);
    }
    return false;
  }
}

/**
 * Safely send a follow-up message
 */
export async function safeFollowUp(
  interaction: Interaction,
  options: Parameters<typeof interaction.followUp>[0]
): Promise<boolean> {
  try {
    await interaction.followUp(options);
    return true;
  } catch (error: any) {
    if (error.code === 40060 || error.code === 10062) {
      console.log(`⚠️ [INTERACTION] Interaction ${interaction.id} expired/already handled (code ${error.code})`);
      return false;
    }
    console.error(`❌ [INTERACTION] Error sending followUp for interaction ${interaction.id}:`, error);
    return false;
  }
}

/**
 * Check if interaction is still valid (not expired)
 */
export function isInteractionValid(interaction: Interaction): boolean {
  // Discord interactions expire after 3 seconds if not acknowledged
  // or 15 minutes if acknowledged
  // We can't check this directly, but we can check if it's already been handled
  if (interaction.replied && !interaction.deferred) {
    // If replied but not deferred, it might be expired
    return false;
  }
  return true;
}
