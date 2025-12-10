import { Client, GatewayIntentBits, Collection, Events } from 'discord.js';
import { config } from 'dotenv';
import * as cron from 'node-cron';
import { initDatabase, closeDatabase } from './db/connection';
import { handleExploreCommand } from './commands/explore';
import { handleWalletSet, handleWalletView, getWalletCommandBuilder } from './commands/wallet';
import { handleInventoryCommand, getInventoryCommandBuilder } from './commands/inventory';
import { handlePartyCreate, getPartyCommandBuilder } from './commands/party';
import { handleDebugCommand, getDebugCommandBuilder } from './commands/debug';
import { handleRepairCommand, getRepairCommandBuilder } from './commands/repair';
import { handleEndAllCommand, getEndAllCommandBuilder } from './commands/endAll';
import { handleEndCommand, getEndCommandBuilder } from './commands/end';
import { handleBiomeSelect } from './handlers/biomeSelect';
import { handleDurationSelect } from './handlers/durationSelect';
import { handlePartyJoin } from './handlers/partyJoin';
import { checkAndProcessExplorations } from './jobs/checkExplorations';
import { SlashCommandBuilder } from 'discord.js';

// Load environment variables
config();

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Register slash commands
client.once(Events.ClientReady, async (readyClient) => {
  console.log(`✅ Bot logged in as ${readyClient.user.tag}`);

  // Initialize database
  try {
    await initDatabase();
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    process.exit(1);
  }

  // Register slash commands
  try {
    const guildId = process.env.DISCORD_GUILD_ID;
    if (!guildId) {
      console.warn('⚠️  DISCORD_GUILD_ID not set. Commands will be registered globally (may take up to 1 hour).');
    }

    const commands = [
      new SlashCommandBuilder()
        .setName('explore')
        .setDescription('Start an exploration expedition in a biome')
        .toJSON(),
      getWalletCommandBuilder().toJSON(),
      getInventoryCommandBuilder().toJSON(),
      getPartyCommandBuilder().toJSON(),
      getDebugCommandBuilder().toJSON(),
      getRepairCommandBuilder().toJSON(),
      getEndAllCommandBuilder().toJSON(),
      getEndCommandBuilder().toJSON(),
    ];

    if (guildId) {
      // Register commands to specific guild (instant)
      const guild = await readyClient.guilds.fetch(guildId);
      await guild.commands.set(commands);
      console.log('✅ Slash commands registered to guild');
    } else {
      // Register commands globally (may take up to 1 hour)
      await readyClient.application?.commands.set(commands);
      console.log('✅ Slash commands registered globally');
    }
  } catch (error) {
    console.error('❌ Error registering commands:', error);
  }

  // Start frequent check job (every 10 seconds for near real-time results)
  cron.schedule('*/10 * * * * *', () => {
    checkAndProcessExplorations(client).catch((error) => {
      console.error('❌ Error in exploration check job:', error);
    });
  });

  console.log('✅ Exploration checker started (checking every 10 seconds)');
});

// Handle slash commands and button interactions
client.on(Events.InteractionCreate, async (interaction) => {
  // Add error handling wrapper
  try {
    // Log all interactions for debugging
    if (interaction.isButton()) {
      console.log(`🔘 [INTERACTION] Button interaction: ${interaction.customId}, User: ${interaction.user.id}, Deferred: ${interaction.deferred}, Replied: ${interaction.replied}`);
    } else if (interaction.isChatInputCommand()) {
      console.log(`💬 [INTERACTION] Command: ${interaction.commandName}, User: ${interaction.user.id}`);
    }

  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'explore') {
      await handleExploreCommand(interaction);
    } else if (interaction.commandName === 'wallet') {
      const subcommand = interaction.options.getSubcommand();
      if (subcommand === 'set') {
        const address = interaction.options.getString('address', true);
        await handleWalletSet(interaction, address);
      } else if (subcommand === 'view') {
        await handleWalletView(interaction);
      }
    } else if (interaction.commandName === 'inventory') {
      await handleInventoryCommand(interaction);
    } else if (interaction.commandName === 'party') {
      const subcommand = interaction.options.getSubcommand();
      if (subcommand === 'create') {
        await handlePartyCreate(interaction);
      }
    } else if (interaction.commandName === 'debug') {
      await handleDebugCommand(interaction);
    } else if (interaction.commandName === 'repair') {
      await handleRepairCommand(interaction);
    } else if (interaction.commandName === 'endall') {
      await handleEndAllCommand(interaction);
    } else if (interaction.commandName === 'end') {
      await handleEndCommand(interaction);
    }
  } else if (interaction.isButton()) {
    if (interaction.customId.startsWith('biome_')) {
      await handleBiomeSelect(interaction);
    } else if (interaction.customId.startsWith('duration_')) {
      await handleDurationSelect(interaction);
    } else if (interaction.customId.startsWith('party_join_')) {
      await handlePartyJoin(interaction);
    }
  }
  } catch (error) {
    console.error(`❌ [INTERACTION] Unhandled error in interaction handler:`, error);
    console.error(`❌ [INTERACTION] Error stack:`, error instanceof Error ? error.stack : String(error));
    
    // Try to respond to the interaction if it's still valid
    try {
      if (interaction.isButton() && !interaction.replied && !interaction.deferred) {
        await interaction.deferUpdate().catch(() => {});
      } else if (interaction.isChatInputCommand() && !interaction.replied && !interaction.deferred) {
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
        await interaction.editReply({ content: '❌ An error occurred. Please try again.' }).catch(() => {});
      }
    } catch (responseError) {
      console.error(`❌ [INTERACTION] Failed to send error response:`, responseError);
    }
  }
});

// Handle errors
client.on(Events.Error, (error) => {
  console.error('❌ Discord client error:', error);
});

/**
 * Graceful shutdown handler
 */
async function shutdown(signal: string): Promise<void> {
  console.log(`\n🛑 Received ${signal}, shutting down gracefully...`);
  try {
    await closeDatabase();
    client.destroy();
    console.log('✅ Shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Login
const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error('❌ DISCORD_BOT_TOKEN not found in environment variables');
  process.exit(1);
}

client.login(token).catch((error) => {
  console.error('❌ Failed to login:', error);
  process.exit(1);
});
