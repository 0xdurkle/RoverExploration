import { 
  ButtonInteraction, 
  ChatInputCommandInteraction, 
  Interaction,
  RepliableInteraction 
} from 'discord.js';

/**
 * Safely defer an interaction update
 * Prevents "already acknowledged" and "unknown interaction" errors
 */
export async function safeDeferUpdate(interaction: ButtonInteraction): Promise<boolean> {
  try {
    // Check if already handled
    if (interaction.deferred || interaction.replied) {
      console.log(`⚠️ [INTERACTION] Interaction ${interaction.id} already deferred/replied, skipping`);
      return false;
    }
    
    // Try to defer - this must happen within 3 seconds of interaction creation
    await interaction.deferUpdate();
    console.log(`✅ [INTERACTION] Successfully deferred interaction ${interaction.id}`);
    return true;
  } catch (error: any) {
    // Ignore "already acknowledged" and "unknown interaction" errors - they're harmless
    // Unknown interaction (10062) means the interaction expired (3 second window passed)
    // Already acknowledged (40060) means we tried to respond twice
    if (error.code === 40060 || error.code === 10062) {
      console.log(`⚠️ [INTERACTION] Interaction ${interaction.id} expired/already acknowledged (code ${error.code}), continuing without defer`);
      return false;
    }
    console.error(`❌ [INTERACTION] Unexpected error deferring update for interaction ${interaction.id}:`, error);
    // Don't throw - let the caller continue even if defer failed
    return false;
  }
}

/**
 * Safely defer a reply for chat input commands
 */
export async function safeDeferReply(
  interaction: ChatInputCommandInteraction,
  options?: { ephemeral?: boolean }
): Promise<boolean> {
  try {
    // Check if already handled
    if (interaction.deferred || interaction.replied) {
      console.log(`⚠️ [INTERACTION] Interaction ${interaction.id} already deferred/replied, skipping`);
      return false;
    }
    
    // Try to defer - this must happen within 3 seconds of interaction creation
    await interaction.deferReply(options || { ephemeral: true });
    console.log(`✅ [INTERACTION] Successfully deferred reply for interaction ${interaction.id}`);
    return true;
  } catch (error: any) {
    // Ignore "already acknowledged" and "unknown interaction" errors
    if (error.code === 40060 || error.code === 10062) {
      console.log(`⚠️ [INTERACTION] Interaction ${interaction.id} expired/already acknowledged (code ${error.code}), continuing without defer`);
      return false;
    }
    console.error(`❌ [INTERACTION] Unexpected error deferring reply for interaction ${interaction.id}:`, error);
    // Don't throw - let the caller continue even if defer failed
    return false;
  }
}

/**
 * Safely edit a reply
 * Handles already replied/deferred interactions
 */
export async function safeEditReply(
  interaction: ButtonInteraction | ChatInputCommandInteraction,
  options: Parameters<ButtonInteraction['editReply']>[0]
): Promise<boolean> {
  try {
    if (!interaction.deferred && !interaction.replied) {
      console.log(`⚠️ [INTERACTION] Interaction ${interaction.id} not deferred, deferring first...`);
      if (interaction.isButton()) {
        await interaction.deferUpdate();
      } else if (interaction.isChatInputCommand()) {
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
    // Try followUp as fallback (only for repliable interactions)
    try {
      if (interaction.isRepliable()) {
        // Extract only the properties we need for followUp
        // Filter out null values since InteractionReplyOptions doesn't accept null
        const content = typeof options === 'object' && options && 'content' in options 
          ? (options.content === null ? undefined : options.content)
          : undefined;
        const embeds = typeof options === 'object' && options && 'embeds' in options 
          ? options.embeds 
          : undefined;
        const components = typeof options === 'object' && options && 'components' in options 
          ? options.components 
          : undefined;
        
        const followUpOptions: Parameters<RepliableInteraction['followUp']>[0] = {
          ...(content !== undefined ? { content } : {}),
          ...(embeds !== undefined ? { embeds } : {}),
          ...(components !== undefined ? { components } : {}),
          ephemeral: true,
        };
        await interaction.followUp(followUpOptions);
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
  interaction: RepliableInteraction,
  options: Parameters<RepliableInteraction['followUp']>[0]
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
  if (interaction.isRepliable()) {
    if (interaction.replied && !interaction.deferred) {
      // If replied but not deferred, it might be expired
      return false;
    }
  }
  return true;
}
