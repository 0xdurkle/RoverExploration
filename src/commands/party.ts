import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { createParty } from '../services/partyService';
import { getAllBiomes } from '../services/rng';
import { getCooldownRemaining } from '../services/cooldownService';

/**
 * Handle /party create command
 */
export async function handlePartyCreate(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  const biomeName = interaction.options.getString('biome', true);
  const durationText = interaction.options.getString('duration', true);

  // Validate biome
  const biomes = getAllBiomes();
  const biome = biomes.find((b) => b.name.toLowerCase() === biomeName.toLowerCase());

  if (!biome) {
    await interaction.editReply({
      content: `❌ Invalid biome. Available biomes: ${biomes.map((b) => b.name).join(', ')}`,
    });
    return;
  }

  // Parse duration
  let durationHours: number;
  if (durationText.toLowerCase() === '30s' || durationText === '30') {
    durationHours = 0.008333;
  } else if (durationText.toLowerCase().includes('h')) {
    const hours = parseInt(durationText.replace('h', '').trim(), 10);
    if (isNaN(hours) || hours <= 0) {
      await interaction.editReply({
        content: '❌ Invalid duration format. Use: 30s, 1h, 3h, 6h, or 12h',
      });
      return;
    }
    durationHours = hours;
  } else {
    const hours = parseInt(durationText, 10);
    if (isNaN(hours) || hours <= 0) {
      await interaction.editReply({
        content: '❌ Invalid duration format. Use: 30s, 1h, 3h, 6h, or 12h',
      });
      return;
    }
    durationHours = hours;
  }

  // Check creator's cooldown
  const remaining = await getCooldownRemaining(interaction.user.id);
  if (remaining && remaining > 0) {
    await interaction.editReply({
      content: `⚠️ You are currently on cooldown. You'll be ready in ${Math.ceil(remaining / 1000 / 60)} minutes.`,
    });
    return;
  }

  // Create party
  try {
    const channelId = process.env.DISCORD_CHANNEL_ID;
    if (!channelId) {
      await interaction.editReply({
        content: '❌ Channel not configured. Please contact an administrator.',
      });
      return;
    }

    const publicChannel = await interaction.client.channels.fetch(channelId);
    if (!publicChannel || !publicChannel.isTextBased()) {
      await interaction.editReply({
        content: '❌ Could not access the public channel.',
      });
      return;
    }

    // Create party embed
    const embed = new EmbedBuilder()
      .setTitle('🛡️ Exploration Party Forming!')
      .setDescription(
        `<@${interaction.user.id}> is assembling an expedition to the **${biome.name}** for **${durationText}**!\n\nClick Join Party to enter.\n\nExpedition departs in **60 seconds**.`
      )
      .setColor(0x5865f2)
      .setTimestamp();

    // Create join button (use a placeholder, we'll update it after creating party)
    const joinButton = new ButtonBuilder()
      .setCustomId(`party_join_placeholder`)
      .setLabel('Join Party')
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(joinButton);

    // Send public message first
    const message = await (publicChannel as any).send({
      embeds: [embed],
      components: [row],
    });

    // Create party and store message ID
    const party = createParty(
      interaction.user.id,
      biome.id,
      durationHours,
      durationText,
      message.id,
      channelId
    );

    // Update button with party message ID for tracking
    const updatedJoinButton = new ButtonBuilder()
      .setCustomId(`party_join_${message.id}`)
      .setLabel('Join Party')
      .setStyle(ButtonStyle.Primary);

    const updatedRow = new ActionRowBuilder<ButtonBuilder>().addComponents(updatedJoinButton);

    await message.edit({
      embeds: [embed],
      components: [updatedRow],
    });

    // Schedule party start after 60 seconds
    setTimeout(async () => {
      await startPartyExpedition(interaction.client, party.id);
    }, 60000);

    await interaction.editReply({
      content: '✅ Party expedition created! The join window is open for 60 seconds.',
    });
  } catch (error) {
    console.error('Error creating party:', error);
    await interaction.editReply({
      content: '❌ An error occurred while creating the party. Please try again.',
    });
  }
}

/**
 * Start party expedition after 60 seconds
 */
async function startPartyExpedition(client: any, partyId: string): Promise<void> {
  const { getParty, startParty, removeParty } = await import('../services/partyService');
  const { rollPartyLoot } = await import('../services/partyLootService');
  const { createExploration } = await import('../db/models');
  const { getRarityEmoji } = await import('../services/rng');

  const party = getParty(partyId);
  if (!party || party.started) {
    return;
  }

  startParty(partyId);

  try {
    const channel = await client.channels.fetch(party.channelId);
    if (!channel || !channel.isTextBased()) return;

    // Get party size (used throughout this function)
    const partySize = party.joinedUsers.length;

    // Disable join button
    let departureDescription: string;
    
    if (partySize === 1) {
      departureDescription = `**Expedition has departed!**\n\n<@${party.joinedUsers[0].userId}> is exploring the **${party.biomeName}**.`;
    } else {
      departureDescription = `**Expedition has departed!**\n\n${party.joinedUsers.map((u) => `<@${u.userId}>`).join(' ')} are exploring the **${party.biomeName}** together.`;
    }
    
    const embed = new EmbedBuilder()
      .setTitle('🛡️ Exploration Party Forming!')
      .setDescription(departureDescription)
      .setColor(0x5865f2)
      .setTimestamp();

    await (channel as any).messages.edit(party.messageId!, {
      embeds: [embed],
      components: [],
    });

    // Post departure message
    let departureMessage: string;
    
    if (partySize === 1) {
      // Solo exploration - treat as normal exploration
      departureMessage = `✨ <@${party.joinedUsers[0].userId}> ventures into the **${party.biomeName}** alone.`;
    } else {
      // Party exploration
      departureMessage = `✨ The party of **${partySize}** ventures into the **${party.biomeName}** together…`;
    }
    
    const departureEmbed = new EmbedBuilder()
      .setDescription(departureMessage)
      .setColor(0x5865f2);

    await (channel as any).send({ embeds: [departureEmbed] });

    // Roll for shared loot (do it once for the whole party)
    // If solo (partySize = 1), party bonuses will be 0, so it works like a normal exploration
    const lootResult = rollPartyLoot(party.biome, party.durationHours, partySize);

    // Calculate end time
    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + party.durationHours * 60 * 60 * 1000);

    // Store the loot result in the party for later
    (party as any).lootResult = lootResult;
    (party as any).endsAt = endsAt;

    // Create exploration for each party member
    const explorationIds: number[] = [];
    for (const member of party.joinedUsers) {
      const exploration = await createExploration(member.userId, party.biome, party.durationHours);
      explorationIds.push(exploration.id);
    }
    (party as any).explorationIds = explorationIds;

    // Store party completion data
    party.completed = false;

    // Schedule completion check
    const timeUntilCompletion = endsAt.getTime() - Date.now();
    if (timeUntilCompletion > 0) {
      setTimeout(async () => {
        await completePartyExpedition(client, partyId);
      }, timeUntilCompletion);
    } else {
      await completePartyExpedition(client, partyId);
    }
  } catch (error) {
    console.error(`Error starting party expedition ${partyId}:`, error);
  }
}

/**
 * Complete party expedition and post results
 */
async function completePartyExpedition(client: any, partyId: string): Promise<void> {
  const { getParty, removeParty } = await import('../services/partyService');
  const { completeExploration } = await import('../db/models');
  const { getRarityEmoji } = await import('../services/rng');

  const party = getParty(partyId);
  if (!party) {
    console.log(`Party ${partyId} not found for completion`);
    return;
  }

  try {
    const channel = await client.channels.fetch(party.channelId);
    if (!channel || !channel.isTextBased()) {
      console.log(`Channel ${party.channelId} not found for party ${partyId}`);
      return;
    }

    // Get the loot result that was stored when party started
    const lootResult = (party as any).lootResult;
    const explorationIds = (party as any).explorationIds || [];

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

    // Post final result
    const partySize = party.joinedUsers.length;
    
    if (itemFound) {
      const emoji = getRarityEmoji(itemFound.rarity);
      let message: string;
      
      if (partySize === 1) {
        // Solo exploration
        message = `${emoji} <@${party.joinedUsers[0].userId}> returns from the **${party.biomeName}** and discovered the **${itemFound.name}** (${itemFound.rarity})!`;
      } else {
        // Party exploration
        const userMentions = party.joinedUsers.map((u) => `<@${u.userId}>`).join(' ');
        message = `${emoji} ${userMentions} return from the **${party.biomeName}** and discovered the **${itemFound.name}** (${itemFound.rarity})!`;
      }
      
      await (channel as any).send(message);
    } else {
      let message: string;
      
      if (partySize === 1) {
        // Solo exploration
        message = `❌ <@${party.joinedUsers[0].userId}> returns from the **${party.biomeName}** empty-handed.`;
      } else {
        // Party exploration
        const userMentions = party.joinedUsers.map((u) => `<@${u.userId}>`).join(' ');
        message = `❌ ${userMentions} return from the **${party.biomeName}** empty-handed.`;
      }
      
      await (channel as any).send(message);
    }

    party.completed = true;
    
    // Cleanup after a delay
    setTimeout(() => {
      removeParty(partyId);
    }, 300000); // Remove after 5 minutes
  } catch (error) {
    console.error(`Error completing party expedition ${partyId}:`, error);
  }
}

/**
 * Get party command builder for registration
 */
import { SlashCommandSubcommandsOnlyBuilder } from 'discord.js';

export function getPartyCommandBuilder(): SlashCommandSubcommandsOnlyBuilder {
  return new SlashCommandBuilder()
    .setName('party')
    .setDescription('Create a party expedition with other explorers')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('create')
        .setDescription('Create a new party expedition')
        .addStringOption((option) =>
          option
            .setName('biome')
            .setDescription('Biome to explore')
            .setRequired(true)
            .addChoices(
              { name: 'Crystal Caverns', value: 'Crystal Caverns' },
              { name: 'Withered Woods', value: 'Withered Woods' },
              { name: 'Rainforest Ruins', value: 'Rainforest Ruins' }
            )
        )
        .addStringOption((option) =>
          option
            .setName('duration')
            .setDescription('Exploration duration')
            .setRequired(true)
            .addChoices(
              { name: '30 seconds', value: '30s' },
              { name: '1 hour', value: '1h' },
              { name: '3 hours', value: '3h' },
              { name: '6 hours', value: '6h' },
              { name: '12 hours', value: '12h' }
            )
        )
    );
}

