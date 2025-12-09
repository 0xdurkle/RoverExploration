import {
  ButtonInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { getBiome } from '../services/rng';

/**
 * Handle biome selection button click
 */
export async function handleBiomeSelect(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferUpdate();

  const biomeId = interaction.customId.replace('biome_', '');
  const biome = getBiome(biomeId);

  if (!biome) {
    await interaction.followUp({
      content: '❌ Invalid biome selected.',
      ephemeral: true,
    });
    return;
  }

  // Show duration selection buttons
  const durations = [1, 3, 6, 12];
  const buttons = durations.map((hours) =>
    new ButtonBuilder()
      .setCustomId(`duration_${biomeId}_${hours}`)
      .setLabel(`${hours}h`)
      .setStyle(ButtonStyle.Secondary)
  );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);

  await interaction.editReply({
    content: `⏱️ **Choose exploration duration for ${biome.name}:**`,
    components: [row],
  });
}
