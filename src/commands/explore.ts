import {
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { getCooldownRemaining, formatTimeRemaining } from '../services/cooldownService';
import { getActiveExploration } from '../db/models';
import { getAllBiomes } from '../services/rng';

/**
 * Handle /explore command
 */
export async function handleExploreCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

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

  await interaction.editReply({
    content: '🌍 **Choose your biome:**',
    components: [row],
  });
}
