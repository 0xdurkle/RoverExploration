import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';

/**
 * Handle /roverswill command
 */
export async function handleRoversWillCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.reply({
    content: 'save us',
    ephemeral: false, // Make response visible to everyone in the channel
  });
}

/**
 * Get roverswill command builder
 */
export function getRoversWillCommandBuilder(): SlashCommandBuilder {
  return new SlashCommandBuilder()
    .setName('roverswill')
    .setDescription('A mysterious command');
}

