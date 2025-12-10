import {
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { getCooldownRemaining, formatTimeRemaining } from '../services/cooldownService';
import { getActiveExploration } from '../db/models';
import { getAllBiomes } from '../services/rng';
import { safeDeferReply, safeEditReply } from '../utils/interactionHelpers';

/**
 * Handle /explore command
 */
export async function handleExploreCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    console.log(`🌍 [EXPLORE] Handling /explore command for user ${interaction.user.id}`);
    
    // Safely defer the reply
    const deferred = await safeDeferReply(interaction, { ephemeral: true });
    if (!deferred && !interaction.deferred && !interaction.replied) {
      console.error(`🌍 [EXPLORE] Failed to defer interaction ${interaction.id}, interaction may have expired`);
      // Try to send a follow-up if possible
      try {
        if (interaction.isRepliable()) {
          await interaction.followUp({
            content: '⚠️ The interaction expired. Please try the command again.',
            ephemeral: true,
          });
        }
      } catch (followUpError) {
        console.error(`🌍 [EXPLORE] Failed to send follow-up:`, followUpError);
      }
      return;
    }

  const userId = interaction.user.id;

  // Check for active exploration (cooldown)
  const activeExploration = await getActiveExploration(userId);

  if (activeExploration) {
    const remaining = await getCooldownRemaining(userId);
    if (remaining && remaining > 0) {
      const timeRemaining = formatTimeRemaining(remaining);
      await interaction.editReply({
        content: `You are already exploring the **${activeExploration.biome}**.\nYou'll return in ${timeRemaining}.`,
      });
      return;
    }
  }

  // Show biome selection buttons
  const biomes = getAllBiomes();
  const buttons = biomes.map((biome) =>
    new ButtonBuilder()
      .setCustomId(`biome_${biome.id}`)
      .setLabel(biome.name)
      .setStyle(ButtonStyle.Primary)
  );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);

    const success = await safeEditReply(interaction, {
      content: '🌍 **Choose your biome:**',
      components: [row],
    });

    if (success) {
      console.log(`🌍 [EXPLORE] ✅ Successfully sent biome selection to user ${interaction.user.id}`);
    } else {
      console.error(`🌍 [EXPLORE] ⚠️ Failed to send biome selection, but exploration check completed`);
    }
  } catch (error) {
    console.error(`🌍 [EXPLORE] ❌ Error handling /explore command:`, error);
    console.error(`🌍 [EXPLORE] Error stack:`, error instanceof Error ? error.stack : String(error));
    
    // Try to send error message
    try {
      if (interaction.isRepliable() && !interaction.replied) {
        await interaction.followUp({
          content: '❌ An error occurred. Please try again.',
          ephemeral: true,
        });
      }
    } catch (followUpError) {
      console.error(`🌍 [EXPLORE] Failed to send error message:`, followUpError);
    }
  }
}
