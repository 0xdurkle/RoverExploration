import { Client, TextChannel } from 'discord.js';
import { completeExploration } from '../db/models';
import { getReturnWithItemMessage, getReturnEmptyMessage } from '../utils/messageVariations';

/**
 * Check for completed party expeditions and post results
 * This runs as a cron job every 30 seconds
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

    // Mark all party explorations as completed with the same item
    for (const explorationId of explorationIds) {
      try {
        await completeExploration(explorationId, itemFound);
      } catch (error) {
        console.error(`Error completing exploration ${explorationId} for party ${partyId}:`, error);
      }
    }

    console.log(`✅ Completed party expedition ${partyId}. Item: ${itemFound ? itemFound.name : 'None'}`);

    // Post final result using message variations
    const partySize = party.joinedUsers.length;
    
    if (itemFound) {
      const emoji = getRarityEmoji(itemFound.rarity);
      
      if (partySize === 1) {
        // Solo exploration
        const userMention = `<@${party.joinedUsers[0].userId}>`;
        const message = getReturnWithItemMessage(emoji, userMention, party.biomeName, itemFound.name, itemFound.rarity);
        await (channel as TextChannel).send(message);
      } else {
        // Party exploration - combine all user mentions
        const userMentions = party.joinedUsers.map((u) => `<@${u.userId}>`).join(' ');
        const message = getReturnWithItemMessage(emoji, userMentions, party.biomeName, itemFound.name, itemFound.rarity);
        await (channel as TextChannel).send(message);
      }
    } else {
      if (partySize === 1) {
        // Solo exploration
        const userMention = `<@${party.joinedUsers[0].userId}>`;
        const message = getReturnEmptyMessage(userMention, party.biomeName);
        await (channel as TextChannel).send(message);
      } else {
        // Party exploration
        const userMentions = party.joinedUsers.map((u) => `<@${u.userId}>`).join(' ');
        const message = getReturnEmptyMessage(userMentions, party.biomeName);
        await (channel as TextChannel).send(message);
      }
    }

    // Mark party as completed
    party.completed = true;
    
    // Cleanup after a delay
    setTimeout(() => {
      removeParty(partyId);
    }, 300000); // Remove after 5 minutes
  } catch (error) {
    console.error(`Error completing party expedition ${partyId}:`, error);
  }
}

