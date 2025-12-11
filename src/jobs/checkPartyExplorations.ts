import { Client, TextChannel } from 'discord.js';
import { completeExploration } from '../db/models';
import { getReturnWithItemMessage, getReturnEmptyMessage } from '../utils/messageVariations';

/**
 * Check for completed party expeditions and post results
 * This runs as a cron job every 10 seconds
 */
export async function checkAndProcessPartyExplorations(client: Client): Promise<void> {
  try {
    // Get all parties that have started but not completed
    const { getExpiredParties } = await import('../services/partyService');
    const allParties = Array.from((await import('../services/partyService')).getAllParties?.() || []);
    
    // Filter parties that have ended (endsAt is in the past) and not completed
    const now = new Date();
    const completedParties = allParties.filter(
      (party) => party.started && !party.completed && party.endsAt && party.endsAt <= now
    );

    if (completedParties.length === 0) {
      return; // No completed party expeditions
    }

    for (const party of completedParties) {
      await completePartyExpedition(client, party.id);
    }

    console.log(`✅ Processed ${completedParties.length} completed party expedition(s)`);
  } catch (error) {
    console.error('❌ Error checking party explorations:', error);
  }
}

/**
 * Complete party expedition and post results
 */
async function completePartyExpedition(client: Client, partyId: string): Promise<void> {
  const { getParty, removeParty } = await import('../services/partyService');
  const { getRarityEmoji } = await import('../services/rng');

  const party = getParty(partyId);
  if (!party) {
    console.log(`Party ${partyId} not found for completion`);
    return;
  }

  // Prevent duplicate processing
  if (party.completed) {
    return;
  }

  // Mark party as completed IMMEDIATELY to prevent race conditions
  // This ensures checkExplorations.ts won't process these explorations
  party.completed = true;

  try {
    const channelId = party.channelId;
    if (!channelId) {
      console.log(`No channel ID for party ${partyId}`);
      return;
    }

    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased() || channel.isDMBased()) {
      console.log(`Channel ${channelId} not found or invalid for party ${partyId}`);
      return;
    }

    // Get the loot result that was stored when party started
    const lootResult = party.lootResult;
    const explorationIds = party.explorationIds || [];

    // Create item found object if loot was discovered
    const itemFound = lootResult
      ? {
          name: lootResult.name,
          rarity: lootResult.rarity,
          biome: party.biome,
          found_at: new Date(),
        }
      : null;

    // CRITICAL: Mark all party explorations as completed with the same item FIRST
    // This must happen before posting messages to prevent checkExplorations.ts from processing them
    for (const explorationId of explorationIds) {
      try {
        await completeExploration(explorationId, itemFound);
      } catch (error) {
        console.error(`Error completing exploration ${explorationId} for party ${partyId}:`, error);
      }
    }

    console.log(`✅ Completed party expedition ${partyId}. Item: ${itemFound ? itemFound.name : 'None'}`);

    // Post ONE final result message for the entire party
    const partySize = party.joinedUsers.length;
    const userMentions = party.joinedUsers.map((u) => `<@${u.userId}>`).join(' ');
    
    if (itemFound) {
      const emoji = getRarityEmoji(itemFound.rarity);
      const message = getReturnWithItemMessage(emoji, userMentions, party.biomeName, itemFound.name, itemFound.rarity);
      await (channel as TextChannel).send(message);
    } else {
      const message = getReturnEmptyMessage(userMentions, party.biomeName);
      await (channel as TextChannel).send(message);
    }
    
    // Cleanup after a delay
    setTimeout(() => {
      removeParty(partyId);
    }, 300000); // Remove after 5 minutes
  } catch (error) {
    console.error(`Error completing party expedition ${partyId}:`, error);
  }
}

