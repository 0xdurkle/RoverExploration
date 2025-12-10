import { Client, TextChannel } from 'discord.js';
import { getCompletedExplorations, Exploration } from '../db/models';
import { finishExploration } from '../services/explorationService';
import { getRarityEmoji } from '../services/rng';
import { getBiome } from '../services/rng';
import { getReturnWithItemMessage, getReturnEmptyMessage } from '../utils/messageVariations';

/**
 * Check for completed explorations and post results
 * This runs as a cron job every 1-5 minutes
 */
export async function checkAndProcessExplorations(client: Client): Promise<void> {
  try {
    console.log(`\n🔄 [CHECK_EXPLORATIONS] ==========================================`);
    console.log(`🔄 [CHECK_EXPLORATIONS] Starting check for completed explorations...`);
    const completed = await getCompletedExplorations();
    console.log(`🔄 [CHECK_EXPLORATIONS] Found ${completed.length} completed exploration(s)`);

    if (completed.length === 0) {
      console.log(`🔄 [CHECK_EXPLORATIONS] No completed explorations, exiting`);
      return; // No completed explorations
    }

    completed.forEach((exp, idx) => {
      console.log(`🔄 [CHECK_EXPLORATIONS] Exploration ${idx + 1}: ID=${exp.id}, User=${exp.user_id}, Biome=${exp.biome}, EndsAt=${exp.ends_at}`);
    });

    const channelId = process.env.DISCORD_CHANNEL_ID;
    if (!channelId) {
      console.error('🔄 [CHECK_EXPLORATIONS] ❌ DISCORD_CHANNEL_ID not set');
      return;
    }

    const channel = (await client.channels.fetch(channelId)) as TextChannel;
    if (!channel) {
      console.error(`🔄 [CHECK_EXPLORATIONS] ❌ Channel ${channelId} not found`);
      return;
    }
    console.log(`🔄 [CHECK_EXPLORATIONS] ✅ Channel found: ${channelId}`);

    // Process each completed exploration
    for (const exploration of completed) {
      await processExploration(exploration, channel);
    }

    console.log(`🔄 [CHECK_EXPLORATIONS] ✅ Processed ${completed.length} completed exploration(s)`);
    console.log(`🔄 [CHECK_EXPLORATIONS] ==========================================\n`);
  } catch (error) {
    console.error('🔄 [CHECK_EXPLORATIONS] ❌ Error checking explorations:', error);
    console.error('🔄 [CHECK_EXPLORATIONS] Error stack:', error instanceof Error ? error.stack : String(error));
  }
}

/**
 * Process a single completed exploration
 */
async function processExploration(exploration: Exploration, channel: TextChannel): Promise<void> {
  try {
    console.log(`\n🔄 [PROCESS_EXPLORATION] ==========================================`);
    console.log(`🔄 [PROCESS_EXPLORATION] Starting for exploration ${exploration.id}`);
    console.log(`🔄 [PROCESS_EXPLORATION] User ID: ${exploration.user_id}`);
    console.log(`🔄 [PROCESS_EXPLORATION] Biome: ${exploration.biome}`);
    console.log(`🔄 [PROCESS_EXPLORATION] Duration: ${exploration.duration_hours} hours`);
    console.log(`🔄 [PROCESS_EXPLORATION] Ends at: ${exploration.ends_at}`);
    
    const biome = getBiome(exploration.biome);
    const biomeName = biome?.name || exploration.biome;
    console.log(`🔄 [PROCESS_EXPLORATION] Biome name: ${biomeName}`);

    // Finish exploration and determine item found
    console.log(`🔄 [PROCESS_EXPLORATION] Calling finishExploration...`);
    const itemFound = await finishExploration(
      exploration.id,
      exploration.user_id,
      exploration.biome,
      exploration.duration_hours
    );
    console.log(`🔄 [PROCESS_EXPLORATION] ✅ finishExploration completed`);
    console.log(`🔄 [PROCESS_EXPLORATION] itemFound:`, itemFound ? `${itemFound.name} (${itemFound.rarity})` : 'null');
    if (itemFound) {
      console.log(`🔄 [PROCESS_EXPLORATION] Item details:`, JSON.stringify(itemFound, null, 2));
    }

    // CRITICAL: Verify exploration was completed and stats were saved BEFORE sending Discord message
    console.log(`🔄 [PROCESS_EXPLORATION] Verifying exploration completion and stats...`);
    const { getDb } = await import('../db/connection');
    const db = getDb();
    
    // First, verify exploration was marked as completed
    console.log(`🔄 [PROCESS_EXPLORATION] Checking explorations table...`);
    const verifyExploration = await db.query(
      `SELECT item_found, completed FROM explorations WHERE id = $1`,
      [exploration.id]
    );
    console.log(`🔄 [PROCESS_EXPLORATION] Exploration query result:`, {
      found: verifyExploration.rows.length > 0,
      completed: verifyExploration.rows[0]?.completed,
      hasItem: !!verifyExploration.rows[0]?.item_found
    });
    
    // Verify exploration was completed
    if (!verifyExploration.rows[0] || !verifyExploration.rows[0].completed) {
      console.error(`🔄 [PROCESS_EXPLORATION] ❌ CRITICAL: Exploration ${exploration.id} was not marked as completed!`);
      console.error(`🔄 [PROCESS_EXPLORATION] This should not happen - finishExploration should have completed it`);
      // Don't send message if exploration wasn't completed
      return;
    }
    console.log(`🔄 [PROCESS_EXPLORATION] ✅ Verified: Exploration ${exploration.id} marked as completed`);
    
    // Verify user profile exists
    console.log(`🔄 [PROCESS_EXPLORATION] Checking user profile stats...`);
    const verifyProfile = await db.query(
      `SELECT items_found, total_explorations, last_exploration_end FROM user_profiles WHERE user_id = $1`,
      [exploration.user_id]
    );
    console.log(`🔄 [PROCESS_EXPLORATION] Profile query result:`, {
      found: verifyProfile.rows.length > 0,
      totalExplorations: verifyProfile.rows[0]?.total_explorations,
      itemsCount: Array.isArray(verifyProfile.rows[0]?.items_found) ? verifyProfile.rows[0].items_found.length : 'N/A',
      lastExplorationEnd: verifyProfile.rows[0]?.last_exploration_end
    });
    
    if (!verifyProfile.rows[0]) {
      console.error(`🔄 [PROCESS_EXPLORATION] ⚠️ WARNING: User profile not found for user ${exploration.user_id}!`);
      console.error(`🔄 [PROCESS_EXPLORATION] Profile should have been created during completeExploration`);
      // Continue anyway - might be a race condition, can be fixed with /repair
    }
    
    // Verify exploration count was incremented (should be at least 1)
    const totalExplorations = verifyProfile.rows[0].total_explorations || 0;
    if (totalExplorations < 1) {
      console.error(`🔄 [PROCESS_EXPLORATION] ⚠️ WARNING: User ${exploration.user_id} has ${totalExplorations} total explorations!`);
      console.error(`🔄 [PROCESS_EXPLORATION] This should not happen - exploration was completed but count is 0`);
      // Don't throw - continue to send message, but log the issue
    } else {
      console.log(`🔄 [PROCESS_EXPLORATION] ✅ Verified: User ${exploration.user_id} has ${totalExplorations} total exploration(s)`);
    }
    
    // If item was found, verify it's in the inventory
    if (itemFound) {
      console.log(`🔄 [PROCESS_EXPLORATION] Verifying item was saved to inventory...`);
      
      const savedItem = verifyExploration.rows[0].item_found;
      if (!savedItem) {
        console.error(`🔄 [PROCESS_EXPLORATION] ❌ CRITICAL: Item was discovered but NOT saved in explorations table!`);
        throw new Error(`Item was not saved to explorations table for exploration ${exploration.id}`);
      }
      
      const itemData = typeof savedItem === 'string' ? JSON.parse(savedItem) : savedItem;
      console.log(`🔄 [PROCESS_EXPLORATION] ✅ Verified: Item saved in explorations table: ${itemData.name}`);
      
      const savedItems = verifyProfile.rows[0].items_found;
      const itemsArray = Array.isArray(savedItems) ? savedItems : [];
      console.log(`🔄 [PROCESS_EXPLORATION] User has ${itemsArray.length} items in inventory`);
      console.log(`🔄 [PROCESS_EXPLORATION] Looking for item: name="${itemFound.name}", rarity="${itemFound.rarity}"`);
      
      const itemExists = itemsArray.some((item: any) => {
        const matches = item && item.name === itemFound.name && item.rarity === itemFound.rarity;
        if (matches) {
          console.log(`🔄 [PROCESS_EXPLORATION] Found matching item:`, JSON.stringify(item, null, 2));
        }
        return matches;
      });
      
      if (!itemExists) {
        console.error(`🔄 [PROCESS_EXPLORATION] ❌ CRITICAL: Item "${itemFound.name}" was NOT saved to user ${exploration.user_id}'s inventory!`);
        console.error(`🔄 [PROCESS_EXPLORATION] User has ${itemsArray.length} items in inventory, but "${itemFound.name}" is missing!`);
        console.error(`🔄 [PROCESS_EXPLORATION] All items in inventory:`, JSON.stringify(itemsArray, null, 2));
        console.error(`🔄 [PROCESS_EXPLORATION] Attempting to recover item by re-saving...`);
        
        // Try to recover by re-saving the item
        try {
          const { getDb } = await import('../db/connection');
          const db = getDb();
          const currentProfile = await db.query(
            `SELECT items_found FROM user_profiles WHERE user_id = $1`,
            [exploration.user_id]
          );
          
          if (currentProfile.rows[0]) {
            let currentItems: any[] = [];
            const raw = currentProfile.rows[0].items_found;
            if (Array.isArray(raw)) {
              currentItems = [...raw];
            } else if (raw && typeof raw === 'string') {
              currentItems = JSON.parse(raw);
            }
            
            // Add the missing item
            currentItems.push(itemFound);
            
            await db.query(
              `UPDATE user_profiles SET items_found = $1::jsonb WHERE user_id = $2`,
              [JSON.stringify(currentItems), exploration.user_id]
            );
            
            console.log(`🔄 [PROCESS_EXPLORATION] ✅ Recovered: Item "${itemFound.name}" re-added to inventory`);
          }
        } catch (recoveryError) {
          console.error(`🔄 [PROCESS_EXPLORATION] ❌ Failed to recover item:`, recoveryError);
          // Continue anyway - item is in explorations table, can be recovered with /repair
        }
      } else {
        console.log(`🔄 [PROCESS_EXPLORATION] ✅ Verified: Item "${itemFound.name}" is in user ${exploration.user_id}'s inventory`);
      }
    } else {
      console.log(`🔄 [PROCESS_EXPLORATION] No item found, but exploration count was verified`);
    }

    // Get user mention
    const user = await channel.client.users.fetch(exploration.user_id);
    const userMention = user ? `<@${exploration.user_id}>` : `User ${exploration.user_id}`;

    // Post result message (only after verification)
    if (itemFound) {
      console.log(`🔄 [PROCESS_EXPLORATION] Sending Discord message for item...`);
      const emoji = getRarityEmoji(itemFound.rarity);
      const message = getReturnWithItemMessage(
        emoji,
        userMention,
        `**${biomeName}**`,
        `**${itemFound.name}**`,
        itemFound.rarity
      );
      await channel.send(message);
      console.log(`🔄 [PROCESS_EXPLORATION] ✅ Sent Discord message for item: ${itemFound.name} (${itemFound.rarity})`);
    } else {
      console.log(`🔄 [PROCESS_EXPLORATION] Sending Discord message: no item found...`);
      const message = getReturnEmptyMessage(userMention, `**${biomeName}**`);
      await channel.send(message);
      console.log(`🔄 [PROCESS_EXPLORATION] ✅ Sent Discord message: no item found`);
    }
    console.log(`🔄 [PROCESS_EXPLORATION] ==========================================\n`);
  } catch (error) {
    console.error(`🔄 [PROCESS_EXPLORATION] ❌ Error processing exploration ${exploration.id}:`, error);
    console.error(`🔄 [PROCESS_EXPLORATION] Error type:`, error instanceof Error ? error.constructor.name : typeof error);
    console.error(`🔄 [PROCESS_EXPLORATION] Error stack:`, error instanceof Error ? error.stack : String(error));
    
    // Try to send error message to user
    try {
      const user = await channel.client.users.fetch(exploration.user_id);
      const userMention = user ? `<@${exploration.user_id}>` : `User ${exploration.user_id}`;
      await channel.send(`❌ An error occurred processing ${userMention}'s exploration. Please try again.`);
      console.log(`🔄 [PROCESS_EXPLORATION] Sent error message to user`);
    } catch (sendError) {
      console.error(`🔄 [PROCESS_EXPLORATION] ❌ Failed to send error message:`, sendError);
    }
    console.log(`🔄 [PROCESS_EXPLORATION] ==========================================\n`);
  }
}
