import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { endAllExplorations } from '../db/models';
import { initDatabase, getDb } from '../db/connection';

/**
 * Admin command to end all active explorations
 * This command allows administrators to end all currently active explorations
 */
export async function handleEndAllCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  try {
    // Initialize database if needed
    await initDatabase();

    // First, check what's actually in the database for debugging
    const db = getDb();
    const now = new Date();
    const checkQuery = await db.query(
      `SELECT id, user_id, biome, ends_at, completed, created_at 
       FROM explorations 
       WHERE completed = FALSE 
       ORDER BY id ASC`
    );
    
    console.log(`🛑 [ENDALL_COMMAND] Found ${checkQuery.rows.length} incomplete explorations before ending`);
    if (checkQuery.rows.length > 0) {
      checkQuery.rows.forEach((exp) => {
        const endsAt = new Date(exp.ends_at);
        const isActive = endsAt > now;
        console.log(`🛑 [ENDALL_COMMAND] Exploration ID=${exp.id}, User=${exp.user_id}, Biome=${exp.biome}, EndsAt=${endsAt.toISOString()}, Active=${isActive}`);
      });
    }

    // End all active explorations
    const result = await endAllExplorations();

    if (result.count === 0) {
      // Double-check if there really are none
      const verifyQuery = await db.query(
        `SELECT COUNT(*) as count FROM explorations WHERE completed = FALSE`
      );
      const actualCount = parseInt(verifyQuery.rows[0]?.count || '0', 10);
      
      if (actualCount > 0) {
        await interaction.editReply({
          content: `⚠️ Found ${actualCount} incomplete exploration(s) but failed to end them. Check logs for details.`,
        });
        return;
      }
      
      await interaction.editReply({
        content: '✅ No active explorations to end. All explorations are already completed.',
      });
      return;
    }

    let response = `✅ Successfully ended ${result.count} exploration(s).\n\n`;
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
    console.error('❌ [ENDALL_COMMAND] Error in endAll command:', error);
    console.error('❌ [ENDALL_COMMAND] Error stack:', error instanceof Error ? error.stack : String(error));
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
