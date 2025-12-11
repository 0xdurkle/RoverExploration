import { ButtonInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { joinParty, getPartyByMessageId } from '../services/partyService';

/**
 * Handle party join button click
 */
export async function handlePartyJoin(interaction: ButtonInteraction): Promise<void> {
  await interaction.deferUpdate();

  const messageId = interaction.message.id;
  const party = getPartyByMessageId(messageId);

  if (!party) {
    await interaction.followUp({
      content: '❌ This party no longer exists or has already started.',
      ephemeral: true,
    });
    return;
  }

  const result = joinParty(party.id, interaction.user.id);

  if (!result.success) {
    await interaction.followUp({
      content: result.message,
      ephemeral: true,
    });
    return;
  }

  // Update the party embed to show current members
  try {
    const updatedParty = result.party!;
    const memberList = updatedParty.joinedUsers.map((member, index) => {
      const isCreator = member.userId === party.creatorId;
      return `${index + 1}. ${isCreator ? '👑' : '👤'} <@${member.userId}>`;
    }).join('\n');

    const slotsRemaining = 5 - updatedParty.joinedUsers.length;
    const countdownSeconds = Math.max(0, Math.ceil((updatedParty.expiresAt.getTime() - Date.now()) / 1000));

    const embed = new EmbedBuilder()
      .setTitle('🛡️ Exploration Party Forming!')
      .setDescription(
        `<@${updatedParty.creatorId}> is assembling an expedition to the **${updatedParty.biomeName}** for **${updatedParty.durationText}**!\n\n**Party Members (${updatedParty.joinedUsers.length}/5):**\n${memberList}\n\n${slotsRemaining > 0 ? `**${slotsRemaining}** slot${slotsRemaining !== 1 ? 's' : ''} remaining.` : '**Party is full!**'} Expedition departs in **${countdownSeconds}** seconds.`
      )
      .setColor(0x5865f2)
      .setTimestamp();

    const joinButton = new ButtonBuilder()
      .setCustomId(`party_join_${messageId}`)
      .setLabel(slotsRemaining > 0 ? 'Join Party' : 'Party Full')
      .setStyle(slotsRemaining > 0 ? ButtonStyle.Primary : ButtonStyle.Secondary)
      .setDisabled(slotsRemaining === 0);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(joinButton);

    await interaction.editReply({
      embeds: [embed],
      components: [row],
    });

    await interaction.followUp({
      content: '✅ You joined the party!',
      ephemeral: true,
    });
  } catch (error) {
    console.error('Error updating party message:', error);
  }
}

