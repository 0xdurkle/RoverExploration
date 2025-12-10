import {
  ButtonInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { getBiome } from '../services/rng';
import { safeDeferUpdate, safeEditReply, safeFollowUp } from '../utils/interactionHelpers';

/**
 * Handle biome selection button click
 */
export async function handleBiomeSelect(interaction: ButtonInteraction): Promise<void> {
  try {
    console.log(`🔘 [BIOME_SELECT] Handling biome selection for interaction ${interaction.id}`);
    
    // Safely defer the update
    const deferred = await safeDeferUpdate(interaction);
    if (!deferred && !interaction.deferred && !interaction.replied) {
      console.error(`🔘 [BIOME_SELECT] Failed to defer interaction ${interaction.id}`);
      return;
    }

    const biomeId = interaction.customId.replace('biome_', '');
    const biome = getBiome(biomeId);

    if (!biome) {
      console.error(`🔘 [BIOME_SELECT] Invalid biome ID: ${biomeId}`);
      await safeFollowUp(interaction, {
        content: '❌ Invalid biome selected.',
        ephemeral: true,
      });
      return;
    }

    // Show duration selection buttons (0.008333 hours = 30 seconds)
    const durations = [
      { hours: 0.008333, label: '30s' },
      { hours: 1, label: '1h' },
      { hours: 3, label: '3h' },
      { hours: 6, label: '6h' },
      { hours: 12, label: '12h' }
    ];
    const buttons = durations.map((duration) =>
      new ButtonBuilder()
        .setCustomId(`duration_${biomeId}_${duration.hours}`)
        .setLabel(duration.label)
        .setStyle(ButtonStyle.Secondary)
    );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);

    const success = await safeEditReply(interaction, {
      content: `⏱️ **Choose exploration duration for ${biome.name}:**`,
      components: [row],
    });

    if (success) {
      console.log(`🔘 [BIOME_SELECT] ✅ Successfully updated interaction ${interaction.id} with duration buttons`);
    } else {
      console.error(`🔘 [BIOME_SELECT] ❌ Failed to update interaction ${interaction.id}`);
    }
  } catch (error) {
    console.error(`🔘 [BIOME_SELECT] ❌ Error handling biome selection:`, error);
    // Try to send error message if interaction is still valid
    try {
      if (interaction.isRepliable() && !interaction.replied) {
        await safeFollowUp(interaction, {
          content: '❌ An error occurred. Please try again.',
          ephemeral: true,
        });
      }
    } catch (followUpError) {
      console.error(`🔘 [BIOME_SELECT] Failed to send error message:`, followUpError);
    }
  }
}
