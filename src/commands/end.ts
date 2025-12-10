import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { getActiveExploration, completeExploration } from '../db/models';
import { initDatabase } from '../db/connection';

/**
 * Player command to end their own active exploration
 * TESTING ONLY - will be removed before going public
 */
export async function handleEndCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  try {
    // Initialize database if needed
    await initDatabase();

    const userId = interaction.user.id;

    // Get the user's active exploration
    const activeExploration = await getActiveExploration(userId);

    if (!activeExploration) {
      await interaction.editReply({
        content: '❌ You don\'t have an active exploration to end.',
      });
      return;
    }

    console.log(`🛑 [END_COMMAND] User ${userId} ending exploration ${activeExploration.id}`);

    // Mark the exploration as completed (no item found since ending early)
    await completeExploration(activeExploration.id, null);

    // Get biome name for display
    const { getBiome } = await import('../services/rng');
    const biome = getBiome(activeExploration.biome);
    const biomeName = biome?.name || activeExploration.biome;

    await interaction.editReply({
      content: `✅ Successfully ended your exploration of **${biomeName}**.\n\n*This command is for testing only and will be removed before launch.*`,
    });
  } catch (error) {
    console.error('❌ [END_COMMAND] Error in end command:', error);
    console.error('❌ [END_COMMAND] Error stack:', error instanceof Error ? error.stack : String(error));
    await interaction.editReply({
      content: `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}

/**
 * Get end command builder for registration
 */
export function getEndCommandBuilder(): SlashCommandBuilder {
  return new SlashCommandBuilder()
    .setName('end')
    .setDescription('End your current active exploration (testing only)');
}
