import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { getUserProfile } from '../db/models';
import { getCurrentStreak, getLongestStreak } from '../services/streakService';
import {
  buildItemCounts,
  buildBiomeProgress,
  formatItemLine,
} from '../utils/inventoryHelpers';
import { getRarityColor } from '../utils/rarityColors';
import { generateProgressBar, calculatePercentage } from '../utils/progressBar';
import { RARITY_ORDER } from '../constants';

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
    const currentStreak = await getCurrentStreak(userId);
    const longestStreak = await getLongestStreak(userId);

    // Debug logging - RAW DATA
    console.log(`📦 Inventory check for user ${userId}:`);
    console.log(`   Total explorations: ${totalExplorations}`);
    console.log(`   Items found count: ${itemsFound.length}`);
    console.log(`   Items array type: ${Array.isArray(itemsFound) ? 'ARRAY' : typeof itemsFound}`);
    console.log(`   Raw items:`, JSON.stringify(itemsFound, null, 2));
    if (itemsFound.length > 0) {
      console.log(`   Items:`, itemsFound.map(i => `${i?.name || 'NO NAME'} (${i?.rarity || 'NO RARITY'}) from ${i?.biome || 'NO BIOME'}`).join(', '));
    }

    // Build item counts (includes all items, even if count is 0)
    const itemCounts = buildItemCounts(itemsFound);
    
    // Debug logging - AFTER BUILD
    console.log(`   Built ${itemCounts.length} item counts`);
    itemCounts.forEach(item => {
      if (item.count > 0) {
        console.log(`     - ${item.name}: ${item.count}x (${item.rarity})`);
      }
    });

    // Sort items by rarity (legendary first, then rare, then uncommon)
    itemCounts.sort((a, b) => {
      const rarityDiff = (RARITY_ORDER[a.rarity] ?? 999) - (RARITY_ORDER[b.rarity] ?? 999);
      if (rarityDiff !== 0) return rarityDiff;
      return a.name.localeCompare(b.name);
    });

    // Build embed
    const embed = new EmbedBuilder()
      .setTitle('Your Underlog Inventory')
      .setColor(getRarityColor('uncommon'))
      .setTimestamp();

    // Filter out items with 0 count for display
    const itemsToDisplay = itemCounts.filter(item => item.count > 0);
    
    console.log(`📦 Inventory: Filtered to ${itemsToDisplay.length} items with count > 0`);
    itemsToDisplay.forEach((item, idx) => {
      console.log(`   Display item ${idx}: ${item.name} x${item.count} (${item.rarity})`);
    });
    
    if (itemsToDisplay.length === 0) {
      console.log(`   ⚠️ No items to display - showing empty message`);
      embed.setDescription('You have no items yet. Go explore to find some!');
    } else {
      // Build item list
      const itemLines = itemsToDisplay.map(formatItemLine);
      embed.setDescription(itemLines.join('\n'));
      
      // Debug logging
      console.log(`   ✅ Displaying ${itemsToDisplay.length} items with count > 0`);
      console.log(`   Item lines:`, itemLines);
    }

    // Add stats
    const stats: string[] = [];
    stats.push(`**Total Explorations:** ${totalExplorations}`);
    stats.push(`**Current Streak:** ${currentStreak} day${currentStreak !== 1 ? 's' : ''}`);
    stats.push(`**Longest Streak:** ${longestStreak} day${longestStreak !== 1 ? 's' : ''}`);

    embed.addFields({
      name: 'Stats',
      value: stats.join('\n'),
      inline: false,
    });

    // Add biome collections
    const biomeProgress = buildBiomeProgress(itemsFound);
    
    // Biome emoji mapping
    const biomeEmojis: Record<string, string> = {
      'Crystal Caverns': '💠',
      'Withered Woods': '🌲',
      'Rainforest Ruins': '🏺',
    };
    
    const biomeFields = biomeProgress.map((biome) => {
      const percentage = calculatePercentage(biome.itemsFound, biome.totalItems);
      const progressBar = generateProgressBar(biome.itemsFound, biome.totalItems, 10);
      const biomeEmoji = biomeEmojis[biome.biomeName] || '🌍';
      return {
        name: `${biomeEmoji} ${biome.biomeName} Collection — ${biome.itemsFound}/${biome.totalItems}`,
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

