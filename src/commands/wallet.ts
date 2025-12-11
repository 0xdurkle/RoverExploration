import { ChatInputCommandInteraction, SlashCommandBuilder, SlashCommandSubcommandsOnlyBuilder } from 'discord.js';
import { ethers } from 'ethers';
import { saveUserWallet, getUserWallet, getUserWalletByAddress } from '../db/models';

/**
 * Handle /wallet set command
 */
export async function handleWalletSet(
  interaction: ChatInputCommandInteraction,
  address: string
): Promise<void> {
  try {
    await interaction.deferReply({ ephemeral: true });
  } catch (error: any) {
    console.error('Error deferring reply in wallet set:', error);
    // If defer fails, try to reply directly
    try {
      await interaction.reply({
        content: '❌ An error occurred. Please try again.',
        ephemeral: true,
      });
    } catch (replyError) {
      console.error('Error replying in wallet set:', replyError);
    }
    return;
  }

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
    console.error('Error stack:', error?.stack);
    console.error('Error details:', {
      code: error?.code,
      constraint: error?.constraint,
      message: error?.message,
    });
    
    try {
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
      
      // Generic error message
      await interaction.editReply({
        content: '❌ An error occurred while saving your wallet address. Please try again.',
      });
    } catch (replyError: any) {
      // If editReply fails, try followUp as fallback
      console.error('Error sending error reply:', replyError);
      try {
        await interaction.followUp({
          content: '❌ An error occurred while saving your wallet address. Please try again.',
          ephemeral: true,
        });
      } catch (followUpError) {
        console.error('Error sending followUp:', followUpError);
      }
    }
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


