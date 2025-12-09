import { ButtonInteraction, TextChannel } from 'discord.js';
import { startExploration } from '../services/explorationService';
import { getBiome, getDurationMultiplier } from '../services/rng';
import { getCooldownRemaining } from '../services/cooldownService';
import { getExplorationStartMessage } from '../utils/messageVariations';

/**
 * Handle duration selection button click
 */
export async function handleDurationSelect(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferUpdate();

  // Parse customId: duration_{biomeId}_{hours}
  // Biome IDs contain underscores (e.g., "crystal_caverns"), so we need to split from the end
  const withoutPrefix = interaction.customId.replace('duration_', '');
  const lastUnderscoreIndex = withoutPrefix.lastIndexOf('_');
  const biomeId = withoutPrefix.substring(0, lastUnderscoreIndex);
  const durationHours = parseFloat(withoutPrefix.substring(lastUnderscoreIndex + 1));

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
    
    // Format duration display
    let durationText: string;
    if (durationHours < 1) {
      const seconds = Math.round(durationHours * 3600);
      durationText = `${seconds}s`;
    } else if (durationHours === 1) {
      durationText = '1 hour';
    } else {
      durationText = `${durationHours} hours`;
    }

    // Send private ephemeral message to user
    await interaction.editReply({
      content: `🚀 You set off into the **${biome.name}** for **${durationText}**${multiplierText}.\n\nI'll notify you when you return!`,
      components: [],
    });

    // Send public message to the channel
    const channelId = process.env.DISCORD_CHANNEL_ID;
    if (channelId && interaction.channel) {
      try {
        const publicChannel = await interaction.client.channels.fetch(channelId);
        if (publicChannel && publicChannel.isTextBased()) {
          const userMention = `<@${interaction.user.id}>`;
          const message = getExplorationStartMessage(userMention, `**${biome.name}**`, `**${durationText}**`);
          await (publicChannel as TextChannel).send(message);
        }
      } catch (error) {
        console.error('Error sending public exploration start message:', error);
        // Don't fail the exploration if the public message fails
      }
    }
  } catch (error) {
    console.error('Error starting exploration:', error);
    await interaction.editReply({
      content: '❌ An error occurred while starting your exploration. Please try again.',
      components: [],
    });
  }
}
