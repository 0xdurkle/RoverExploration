import { ButtonInteraction } from 'discord.js';
import { startExploration } from '../services/explorationService';
import { getBiome, getDurationMultiplier } from '../services/rng';
import { getCooldownRemaining } from '../services/cooldownService';

/**
 * Handle duration selection button click
 */
export async function handleDurationSelect(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferUpdate();

  // Parse customId: duration_{biomeId}_{hours}
  const parts = interaction.customId.replace('duration_', '').split('_');
  const biomeId = parts[0];
  const durationHours = parseInt(parts[1], 10);

  const biome = getBiome(biomeId);
  if (!biome) {
    await interaction.followUp({
      content: '❌ Invalid biome selected.',
      ephemeral: true,
    });
    return;
  }

  // Double-check cooldown (user might have clicked multiple times)
  const remaining = await getCooldownRemaining(interaction.user.id);
  if (remaining && remaining > 0) {
    await interaction.editReply({
      content: '⚠️ You already have an active exploration. Please wait for it to complete.',
      components: [],
    });
    return;
  }

  try {
    // Start exploration
    await startExploration(interaction.user.id, biomeId, durationHours);

    const multiplier = getDurationMultiplier(durationHours);
    const multiplierText = multiplier > 1 ? ` (${multiplier}x item odds)` : '';

    await interaction.editReply({
      content: `🚀 You set off into the **${biome.name}** for **${durationHours} hour${durationHours > 1 ? 's' : ''}**${multiplierText}.\n\nI'll notify you when you return!`,
      components: [],
    });
  } catch (error) {
    console.error('Error starting exploration:', error);
    await interaction.editReply({
      content: '❌ An error occurred while starting your exploration. Please try again.',
      components: [],
    });
  }
}
