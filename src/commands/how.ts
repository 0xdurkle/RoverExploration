import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { getInitialHowDisplay } from '../handlers/howNavigation';

/**
 * Handle /how command - displays field guide with navigation
 */
export async function handleHowCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const { embed, buttons } = getInitialHowDisplay();

  // Reply with first embed and navigation buttons (ephemeral - only visible to the user)
  await interaction.reply({
    embeds: [embed],
    components: [buttons],
    ephemeral: true,
  });
}

/**
 * Get how command builder
 */
export function getHowCommandBuilder(): SlashCommandBuilder {
  return new SlashCommandBuilder()
    .setName('how')
    .setDescription('Show a field guide explaining how The Underlog works');
}

