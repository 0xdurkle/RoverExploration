import { Client, GatewayIntentBits, Collection, Events } from 'discord.js';
import { config } from 'dotenv';
import * as cron from 'node-cron';
import { initDatabase, closeDatabase } from './db/connection';
import { handleExploreCommand } from './commands/explore';
import { handleBiomeSelect } from './handlers/biomeSelect';
import { handleDurationSelect } from './handlers/durationSelect';
import { checkAndProcessExplorations } from './jobs/checkExplorations';

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
      {
        name: 'explore',
        description: 'Start an exploration expedition in a biome',
      },
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

  // Start cron job to check completed explorations every 2 minutes
  cron.schedule('*/2 * * * *', () => {
    checkAndProcessExplorations(client).catch((error) => {
      console.error('❌ Error in exploration check job:', error);
    });
  });

  console.log('✅ Cron job started (checking every 2 minutes)');
});

// Handle slash commands
client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'explore') {
      await handleExploreCommand(interaction);
    }
  } else if (interaction.isButton()) {
    if (interaction.customId.startsWith('biome_')) {
      await handleBiomeSelect(interaction);
    } else if (interaction.customId.startsWith('duration_')) {
      await handleDurationSelect(interaction);
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
