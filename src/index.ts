import { Client, GatewayIntentBits, Collection, Events } from 'discord.js';
import { config } from 'dotenv';
import * as cron from 'node-cron';
import { initDatabase, closeDatabase } from './db/connection';
import { handleExploreCommand, getExploreCommandBuilder } from './commands/explore';
import { handleHowCommand } from './commands/how';
import { handlePartyCreate, getPartyCommandBuilder } from './commands/party';
import { handleEndAllCommand, getEndAllCommandBuilder } from './commands/endAll';
import { handleInventoryCommand, getInventoryCommandBuilder } from './commands/inventory';
import { handleWalletSet, handleWalletView, getWalletCommandBuilder } from './commands/wallet';
import { handleHowNavigation } from './handlers/howNavigation';
import { handlePartyJoin } from './handlers/partyJoin';
import { checkAndProcessExplorations } from './jobs/checkExplorations';
import { checkAndProcessPartyExplorations } from './jobs/checkPartyExplorations';

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
      getExploreCommandBuilder().toJSON(),
      {
        name: 'how',
        description: 'Show a field guide explaining how The Underlog works',
      },
      getInventoryCommandBuilder().toJSON(),
      getWalletCommandBuilder().toJSON(),
      getPartyCommandBuilder().toJSON(),
      getEndAllCommandBuilder().toJSON(),
    ];

    // Log explore command structure for debugging
    const exploreCmd = commands.find(cmd => cmd.name === 'explore');
    if (exploreCmd) {
      console.log('📋 [COMMAND_REGISTRATION] Explore command structure:', JSON.stringify(exploreCmd, null, 2));
      console.log(`📋 [COMMAND_REGISTRATION] Explore command has ${exploreCmd.options?.length || 0} options`);
      if (exploreCmd.options) {
        exploreCmd.options.forEach((opt: any) => {
          console.log(`   - Option: ${opt.name} (required: ${opt.required}, choices: ${opt.choices?.length || 0})`);
        });
      }
    }

    if (guildId) {
      // Register commands to specific guild (instant)
      const guild = await readyClient.guilds.fetch(guildId);
      await guild.commands.set(commands);
      console.log(`✅ Slash commands registered to guild ${guildId}`);
      console.log(`   Registered ${commands.length} commands`);
    } else {
      // Register commands globally (may take up to 1 hour)
      await readyClient.application?.commands.set(commands);
      console.log('✅ Slash commands registered globally');
      console.log(`   Registered ${commands.length} commands`);
      console.log('   ⚠️  Note: Global command updates may take up to 1 hour to propagate');
    }
  } catch (error) {
    console.error('❌ Error registering commands:', error);
  }

  // Start cron job to check completed explorations every 10 seconds for fastest response times
  cron.schedule('*/10 * * * * *', () => {
    checkAndProcessExplorations(client).catch((error) => {
      console.error('❌ Error in exploration check job:', error);
    });
  });

  // Start cron job to check completed party expeditions every 10 seconds
  cron.schedule('*/10 * * * * *', () => {
    checkAndProcessPartyExplorations(client).catch((error) => {
      console.error('❌ Error in party exploration check job:', error);
    });
  });

  console.log('✅ Cron jobs started (checking every 10 seconds)');
});

// Handle slash commands and interactions
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'explore') {
      await handleExploreCommand(interaction);
    } else if (interaction.commandName === 'how') {
      await handleHowCommand(interaction);
    } else if (interaction.commandName === 'inventory') {
      await handleInventoryCommand(interaction);
    } else if (interaction.commandName === 'wallet') {
      const subcommand = interaction.options.getSubcommand();
      if (subcommand === 'set') {
        const address = interaction.options.getString('address', true);
        await handleWalletSet(interaction, address);
      } else if (subcommand === 'view') {
        await handleWalletView(interaction);
      }
    } else if (interaction.commandName === 'party') {
      const subcommand = interaction.options.getSubcommand();
      if (subcommand === 'create') {
        await handlePartyCreate(interaction);
      }
    } else if (interaction.commandName === 'endall') {
      await handleEndAllCommand(interaction);
    }
  } else if (interaction.isButton()) {
    if (interaction.customId.startsWith('how_nav_')) {
      await handleHowNavigation(interaction);
    } else if (interaction.customId.startsWith('party_join_')) {
      await handlePartyJoin(interaction);
    }
  }
});

// Handle errors
client.on(Events.Error, (error) => {
  console.error('❌ Discord client error:', error);
});

process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  await closeDatabase();
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down...');
  await closeDatabase();
  client.destroy();
  process.exit(0);
});

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
