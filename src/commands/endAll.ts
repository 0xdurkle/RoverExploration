import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { endAllExplorations } from '../db/models';
import { initDatabase } from '../db/connection';

/**
 * Admin command to end all active explorations
 */
export async function handleEndAllCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  try {
    // Initialize database if needed
    await initDatabase();

    // End all active explorations
    const result = await endAllExplorations();

    if (result.count === 0) {
      await interaction.editReply({
        content: '✅ No active explorations to end. All explorations are already completed.',
      });
      return;
    }

    let response = `✅ Successfully ended ${result.count} active exploration(s).\n\n`;
    response += `**Details:**\n`;
    response += `- Total ended: ${result.count}\n`;
    
    // Group by user
    const byUser = new Map<string, number>();
    result.explorations.forEach((exp) => {
      byUser.set(exp.user_id, (byUser.get(exp.user_id) || 0) + 1);
    });
    
    if (byUser.size > 0) {
      response += `\n**By User:**\n`;
      byUser.forEach((count, userId) => {
        response += `- <@${userId}>: ${count} exploration(s)\n`;
      });
    }

    await interaction.editReply({
      content: response,
    });
  } catch (error) {
    console.error('Error in endAll command:', error);
    await interaction.editReply({
      content: `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

/**
 * Get endAll command builder for registration
 */
export function getEndAllCommandBuilder(): SlashCommandBuilder {
  return new SlashCommandBuilder()
    .setName('endall')
    .setDescription('End all active explorations (admin command)');
}
