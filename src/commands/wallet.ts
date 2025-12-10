import { ChatInputCommandInteraction, SlashCommandBuilder, SlashCommandSubcommandsOnlyBuilder } from 'discord.js';
import { ethers } from 'ethers';
import { saveUserWallet, getUserWallet } from '../db/models';

/**
 * Handle /wallet set command
 */
export async function handleWalletSet(
  interaction: ChatInputCommandInteraction,
  address: string
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  try {
    // Validate Ethereum address
    if (!ethers.isAddress(address)) {
      await interaction.editReply({
        content: '❌ That wallet address is invalid. Please enter a valid checksum Ethereum address.',
      });
      return;
    }

    // Get checksum address (properly formatted)
    const checksumAddress = ethers.getAddress(address);

    // Save to database
    await saveUserWallet(interaction.user.id, checksumAddress);

    // Reply with confirmation
    await interaction.editReply({
      content: `🔗 Your airdrop address has been updated to \`${checksumAddress}\`\n\nThis will be used for future reward drops.`,
    });
  } catch (error) {
    console.error('Error saving wallet:', error);
    await interaction.editReply({
      content: '❌ An error occurred while saving your wallet address. Please try again.',
    });
  }
}

/**
 * Handle /wallet view command
 */
export async function handleWalletView(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  try {
    const wallet = await getUserWallet(interaction.user.id);

    if (!wallet) {
      await interaction.editReply({
        content: "You don't have a wallet linked yet. Use `/wallet set` to add one.",
      });
      return;
    }

    // Format the updated timestamp
    const updatedAt = new Date(wallet.updated_at);
    const formattedDate = updatedAt.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    await interaction.editReply({
      content: `Your linked wallet: \`${wallet.wallet_address}\`\n\nLast updated: ${formattedDate}`,
    });
  } catch (error) {
    console.error('Error retrieving wallet:', error);
    await interaction.editReply({
      content: '❌ An error occurred while retrieving your wallet address. Please try again.',
    });
  }
}

/**
 * Get wallet command builder for registration
 */
export function getWalletCommandBuilder(): SlashCommandSubcommandsOnlyBuilder {
  return new SlashCommandBuilder()
    .setName('wallet')
    .setDescription('Manage your Ethereum wallet address for airdrops')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('set')
        .setDescription('Set your Ethereum wallet address for airdrops')
        .addStringOption((option) =>
          option
            .setName('address')
            .setDescription('Your Ethereum wallet address')
            .setRequired(true)
        )
    )
    .addSubcommand((subcommand) =>
      subcommand.setName('view').setDescription('View your linked Ethereum wallet address')
    );
}

