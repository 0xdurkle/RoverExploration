import { ChatInputCommandInteraction, GuildMember, PermissionFlagsBits } from 'discord.js';

/**
 * Check if a user has admin permissions
 * Checks both Discord permissions and environment variable ADMIN_USER_IDS
 */
export async function isAdmin(interaction: ChatInputCommandInteraction): Promise<boolean> {
  // Check environment variable for admin user IDs (comma-separated)
  const adminUserIds = process.env.ADMIN_USER_IDS;
  if (adminUserIds) {
    const adminIds = adminUserIds.split(',').map(id => id.trim());
    if (adminIds.includes(interaction.user.id)) {
      return true;
    }
  }

  // Check Discord permissions (Administrator or Manage Guild)
  if (interaction.member instanceof GuildMember) {
    const member = interaction.member;
    if (
      member.permissions.has(PermissionFlagsBits.Administrator) ||
      member.permissions.has(PermissionFlagsBits.ManageGuild)
    ) {
      return true;
    }
  }

  return false;
}
