import { ChatInputCommandInteraction, SlashCommandBuilder, SlashCommandSubcommandsOnlyBuilder } from 'discord.js';
import { ethers } from 'ethers';
import { saveUserWallet, getUserWallet, getUserWalletByAddress, deleteUserWallet } from '../db/models';
import { isAdmin } from '../utils/adminHelpers';

/**
 * Handle /wallet set command
 */
export async function handleWalletSet(
  interaction: ChatInputCommandInteraction,
  address: string
): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  try {
    // Check if user already has a wallet
    const existingWallet = await getUserWallet(interaction.user.id);
    if (existingWallet) {
      await interaction.editReply({
        content: `❌ You already have a wallet linked: \`${existingWallet.wallet_address}\`\n\nOnce a wallet is set, it cannot be changed. Contact an admin if you need to reset your wallet.`,
      });
      return;
    }

    // Validate Ethereum address
    if (!ethers.isAddress(address)) {
      await interaction.editReply({
        content: '❌ That wallet address is invalid. Please enter a valid checksum Ethereum address.',
      });
      return;
    }

    // Get checksum address (properly formatted)
    const checksumAddress = ethers.getAddress(address);

    // Check if this wallet is already linked to a different Discord account
    const walletByAddress = await getUserWalletByAddress(checksumAddress);
    if (walletByAddress && walletByAddress.discord_id !== interaction.user.id) {
      await interaction.editReply({
        content: '❌ This wallet address is already linked to another Discord account. Each wallet can only be linked to one account.',
      });
      return;
    }

    // Save to database (INSERT only, no updates)
    await saveUserWallet(interaction.user.id, checksumAddress);

    // Reply with confirmation
    await interaction.editReply({
      content: `🔗 Your airdrop address has been set to \`${checksumAddress}\`\n\nThis will be used for future reward drops.\n\n⚠️ **Note:** Your wallet can only be set once. Contact an admin if you need to change it.`,
    });
  } catch (error: any) {
    console.error('Error saving wallet:', error);
    
    // Check for unique constraint violation (wallet already linked to another account)
    if (error.code === '23505') {
      if (error.constraint === 'user_wallets_wallet_address_unique') {
        await interaction.editReply({
          content: '❌ This wallet address is already linked to another Discord account. Each wallet can only be linked to one account.',
        });
        return;
      } else if (error.constraint === 'user_wallets_discord_id_unique') {
        await interaction.editReply({
          content: '❌ You already have a wallet linked. Contact an admin if you need to reset it.',
        });
        return;
      }
    }
    
    // Check for custom error from saveUserWallet
    if (error.message && error.message.includes('already exists')) {
      await interaction.editReply({
        content: '❌ You already have a wallet linked. Contact an admin if you need to reset it.',
      });
      return;
    }
    
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
 * Handle /wallet reset command
 */
export async function handleWalletReset(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ ephemeral: true });

  try {
    const targetUser = interaction.options.getUser('user', true);
    const targetUserId = targetUser.id;
    const requesterId = interaction.user.id;

    // Users can only reset their own wallet (unless they're an admin)
    const admin = await isAdmin(interaction);
    if (!admin && targetUserId !== requesterId) {
      await interaction.editReply({
        content: '❌ You can only reset your own wallet. Use `/wallet reset` and select yourself.',
      });
      return;
    }

    // Get target user's wallet
    const wallet = await getUserWallet(targetUserId);
    if (!wallet) {
      await interaction.editReply({
        content: `❌ ${targetUserId === requesterId ? 'You do not' : `User <@${targetUserId}> does not`} have a wallet linked.`,
      });
      return;
    }

    // Delete the wallet
    const deleted = await deleteUserWallet(targetUserId);
    if (!deleted) {
      await interaction.editReply({
        content: '❌ Failed to reset wallet. Please try again.',
      });
      return;
    }

    if (targetUserId === requesterId) {
      await interaction.editReply({
        content: `✅ Successfully reset your wallet.\n\nPrevious wallet: \`${wallet.wallet_address}\`\n\nYou can now set a new wallet using \`/wallet set\`.`,
      });
    } else {
      await interaction.editReply({
        content: `✅ Successfully reset wallet for <@${targetUserId}>.\n\nPrevious wallet: \`${wallet.wallet_address}\`\n\nThey can now set a new wallet using \`/wallet set\`.`,
      });
    }
  } catch (error) {
    console.error('Error resetting wallet:', error);
    await interaction.editReply({
      content: '❌ An error occurred while resetting the wallet. Please try again.',
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
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('reset')
        .setDescription('Reset your wallet address (or another user\'s if you\'re an admin)')
        .addUserOption((option) =>
          option
            .setName('user')
            .setDescription('The user whose wallet should be reset (defaults to you)')
            .setRequired(true)
        )
    );
}


