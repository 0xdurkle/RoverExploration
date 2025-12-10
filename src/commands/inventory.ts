import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { getUserProfile } from '../db/models';
import { getLongestStreak } from '../services/streakService';
import {
  buildItemCounts,
  getHighestRarity,
  buildBiomeProgress,
  formatItemLine,
} from '../utils/inventoryHelpers';
import { getRarityColor, getRarityDisplayName } from '../utils/rarityColors';
import { generateProgressBar, calculatePercentage } from '../utils/progressBar';

/**
 * Handle /inventory command
 */
export async function handleInventoryCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  try {
    const userId = interaction.user.id;
    const profile = await getUserProfile(userId);

    if (!profile || profile.total_explorations === 0) {
      await interaction.editReply({
        content: "You haven't completed any explorations yet. Use `/explore` to start exploring!",
      });
      return;
    }

    // Get user data
    const itemsFound = profile.items_found || [];
    const totalExplorations = profile.total_explorations;
    const longestStreak = await getLongestStreak(userId);
    const highestRarity = getHighestRarity(itemsFound);

    // Build item counts (includes all items, even if count is 0)
    const itemCounts = buildItemCounts(itemsFound);

    // Sort items by rarity (legendary first, then rare, then uncommon)
    const rarityOrder: Record<string, number> = { legendary: 0, rare: 1, uncommon: 2 };
    itemCounts.sort((a, b) => {
      const rarityDiff = (rarityOrder[a.rarity] ?? 999) - (rarityOrder[b.rarity] ?? 999);
      if (rarityDiff !== 0) return rarityDiff;
      return a.name.localeCompare(b.name);
    });

    // Build embed
    const embed = new EmbedBuilder()
      .setTitle('🌿 Your Underlog Inventory')
      .setColor(getRarityColor(highestRarity || 'uncommon'))
      .setTimestamp();

    // Build item list
    const itemLines = itemCounts.map(formatItemLine);
    embed.setDescription(itemLines.join('\n'));

    // Add stats
    const stats: string[] = [];
    stats.push(`📘 **Total Explorations:** ${totalExplorations}`);
    stats.push(`🔥 **Longest Streak:** ${longestStreak} day${longestStreak !== 1 ? 's' : ''}`);
    stats.push(
      `🏆 **Highest Rarity Found:** ${highestRarity ? getRarityDisplayName(highestRarity) : 'None'}`
    );

    embed.addFields({
      name: '📊 Stats',
      value: stats.join('\n'),
      inline: false,
    });

    // Add biome collections
    const biomeProgress = buildBiomeProgress(itemsFound);
    const biomeFields = biomeProgress.map((biome) => {
      const percentage = calculatePercentage(biome.itemsFound, biome.totalItems);
      const progressBar = generateProgressBar(biome.itemsFound, biome.totalItems, 10);
      return {
        name: `🌍 ${biome.biomeName} Collection — ${biome.itemsFound}/${biome.totalItems}`,
        value: `${progressBar} ${percentage}%`,
        inline: true,
      };
    });

    if (biomeFields.length > 0) {
      // Split into chunks of 3 (Discord embed limit is 3 fields per row)
      for (let i = 0; i < biomeFields.length; i += 3) {
        const chunk = biomeFields.slice(i, i + 3);
        embed.addFields(...chunk);
      }
    }

    await interaction.editReply({
      embeds: [embed],
    });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    await interaction.editReply({
      content: '❌ An error occurred while fetching your inventory. Please try again.',
    });
  }
}

/**
 * Get inventory command builder for registration
 */
export function getInventoryCommandBuilder(): SlashCommandBuilder {
  return new SlashCommandBuilder()
    .setName('inventory')
    .setDescription("View your discovered items and exploration stats");
}

