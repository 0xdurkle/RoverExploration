import {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  TextChannel,
} from 'discord.js';
import { startExploration } from '../services/explorationService';
import { getAllBiomes, getBiome, getDurationMultiplier } from '../services/rng';
import { getCooldownRemaining, formatTimeRemaining } from '../services/cooldownService';
import { safeDeferReply, safeEditReply } from '../utils/interactionHelpers';
import { getExplorationStartMessage } from '../utils/messageVariations';

/**
 * Get command builder for /explore
 */
export function getExploreCommandBuilder(): SlashCommandOptionsOnlyBuilder {
  const biomes = getAllBiomes();
  
  return new SlashCommandBuilder()
    .setName('explore')
    .setDescription('Start an exploration expedition in a biome')
    .addStringOption((option) =>
      option
        .setName('biome')
        .setDescription('The biome to explore')
        .setRequired(true)
        .addChoices(...biomes.map((b) => ({ name: b.name, value: b.id })))
    )
    .addStringOption((option) =>
      option
        .setName('duration')
        .setDescription('How long to explore')
        .setRequired(true)
        .addChoices(
          { name: '30 seconds', value: '30s' },
          { name: '1 hour', value: '1h' },
          { name: '3 hours', value: '3h' },
          { name: '6 hours', value: '6h' },
          { name: '12 hours', value: '12h' }
        )
    );
}

/**
 * Handle /explore command
 * Uses slash command options (dropdown menus) for biome and duration selection
 * Atomic database operation prevents duplicate messages
 */
export async function handleExploreCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  try {
    const userId = interaction.user.id;
    console.log(`🌍 [EXPLORE] User ${userId} starting exploration`);
    
    // Validate that this is the correct command format (dropdown menus, not buttons)
    // Log all options to help debug any command registration issues
    const allOptions = interaction.options.data;
    console.log(`🌍 [EXPLORE] Command options received:`, allOptions.map(o => ({ name: o.name, type: o.type, value: o.value })));
    
    // Defer reply immediately (ephemeral for user confirmation)
    await safeDeferReply(interaction, { ephemeral: true });
    
    // Get options (with defensive checks)
    const biomeOption = interaction.options.get('biome');
    const durationOption = interaction.options.get('duration');
    
    // CRITICAL: Ensure both required options exist - if not, this is an old command format
    if (!biomeOption || !durationOption) {
      console.error(`🌍 [EXPLORE] ❌ Invalid command format detected - missing required options. This suggests Discord is serving an old cached command.`);
      console.error(`🌍 [EXPLORE] Received options:`, allOptions);
      await safeEditReply(interaction, {
        content: '❌ **Command Format Error**: The `/explore` command format appears to be outdated. Please wait a moment and try again, or contact an admin. The command should have dropdown menus for biome and duration selection.',
      });
      return;
    }
    
    if (!biomeOption) {
      console.error(`🌍 [EXPLORE] ❌ Biome option not found. Available options:`, interaction.options.data.map(o => o.name));
      await safeEditReply(interaction, {
        content: '❌ The biome option was not found. This might be because the command needs to be re-registered. Please wait a moment and try again, or contact an admin.',
      });
      return;
    }
    
    if (!durationOption) {
      console.error(`🌍 [EXPLORE] ❌ Duration option not found. Available options:`, interaction.options.data.map(o => o.name));
      await safeEditReply(interaction, {
        content: '❌ The duration option was not found. This might be because the command needs to be re-registered. Please wait a moment and try again, or contact an admin.',
      });
      return;
    }
    
    const biomeId = biomeOption.value as string;
    const durationText = durationOption.value as string;
    
    // Validate biome
    const biome = getBiome(biomeId);
    if (!biome) {
      await safeEditReply(interaction, {
        content: '❌ Invalid biome selected.',
      });
      return;
    }
    
    // Parse duration
    let durationHours: number;
    if (durationText === '30s') {
      durationHours = 0.008333;
    } else if (durationText === '1h') {
      durationHours = 1;
    } else if (durationText === '3h') {
      durationHours = 3;
    } else if (durationText === '6h') {
      durationHours = 6;
    } else if (durationText === '12h') {
      durationHours = 12;
    } else {
      await safeEditReply(interaction, {
        content: '❌ Invalid duration selected.',
      });
      return;
    }
    
    // Check cooldown
    const remaining = await getCooldownRemaining(userId);
    if (remaining && remaining > 0) {
      const timeRemaining = formatTimeRemaining(remaining);
      await safeEditReply(interaction, {
        content: `You are already exploring. You'll return in ${timeRemaining}.`,
      });
      return;
    }
    
    // Create exploration in database
    console.log(`🌍 [EXPLORE] Creating exploration: user=${userId}, biome=${biomeId}, duration=${durationHours}h`);
    await startExploration(userId, biomeId, durationHours);
    console.log(`🌍 [EXPLORE] ✅ Exploration created`);
    
    // Format duration for display (add multiplier to durationText if applicable)
    const multiplier = getDurationMultiplier(durationHours);
    let displayDuration = durationText;
    if (multiplier > 1) {
      displayDuration = `${durationText} (${multiplier}x item odds)`;
    }
    
    // Get random exploration start message variation
    const userMention = `<@${userId}>`;
    const message = getExplorationStartMessage(userMention, biome.name, displayDuration);
    
    // Send ephemeral confirmation to user first
    await safeEditReply(interaction, {
      content: '✅ Exploration started!',
    });
    
    // Then send public message to channel (not as a reply, standalone comment)
    try {
      const channel = interaction.channel;
      if (channel && channel.isTextBased() && !channel.isDMBased()) {
        await (channel as TextChannel).send(message);
      } else {
        console.warn(`🌍 [EXPLORE] Could not send public message: channel is not available or is a DM`);
      }
    } catch (sendError) {
      // Log error but don't fail the exploration - it's already created
      console.error(`🌍 [EXPLORE] Failed to send public exploration message:`, sendError);
      // Exploration is still created successfully, user got ephemeral confirmation
    }
  } catch (error: any) {
    console.error(`🌍 [EXPLORE] ❌ Error:`, error);
    console.error(`🌍 [EXPLORE] ❌ Error stack:`, error?.stack);
    console.error(`🌍 [EXPLORE] ❌ Error message:`, error?.message);
    console.error(`🌍 [EXPLORE] ❌ Error code:`, error?.code);
    
    if (error.message && error.message.includes('already has an active exploration')) {
      await safeEditReply(interaction, {
        content: '⚠️ You already have an active exploration. Please wait for it to complete.',
      });
      return;
    }
    
    await safeEditReply(interaction, {
      content: '❌ An error occurred while starting your exploration. Please try again.',
    });
  }
}
