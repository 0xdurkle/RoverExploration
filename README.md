# Underlog Exploration - Discord Bot Game

An asynchronous, single-player exploration game for Discord where users explore biomes, find rare items, and compete on their own schedule.

## 🎮 Game Overview

Players use `/explore` to choose a biome and exploration duration. After the cooldown period, they receive results (empty-handed or with a discovered item). Each biome has unique items with different rarity tiers (Uncommon, Rare, Legendary).

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- A Discord bot application (see [Discord Bot Setup](#discord-bot-setup))
- PostgreSQL database (or SQLite for local dev)

### Installation

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your Discord bot token and IDs
   ```

3. **Build the project:**
   ```bash
   npm run build
   ```

4. **Run the bot:**
   ```bash
   npm start
   # Or for development with auto-reload:
   npm run dev
   ```

## 📋 Discord Bot Setup

1. **Create a Discord Application:**
   - Go to https://discord.com/developers/applications
   - Click "New Application"
   - Name it "Underlog Exploration"
   - Go to "Bot" section → "Add Bot"
   - Copy the Bot Token (keep it secret!)

2. **Enable Intents:**
   - In Bot section, enable:
     - Message Content Intent (if needed)
     - Server Members Intent (optional)

3. **Invite Bot to Server:**
   - Go to "OAuth2" → "URL Generator"
   - Select scopes: `bot`, `applications.commands`
   - Select permissions: Send Messages, Use Slash Commands, Read Message History, Embed Links
   - Copy URL and open it to invite bot

4. **Get Required IDs:**
   - Enable Developer Mode in Discord (Settings → Advanced)
   - Right-click your server → Copy Server ID → Paste in `DISCORD_GUILD_ID`
   - Right-click #underlog-exploration channel → Copy Channel ID → Paste in `DISCORD_CHANNEL_ID`

## 🗄️ Database Setup

### Local Development (SQLite)
The bot will automatically use SQLite for local development if no `DATABASE_URL` is provided.

### Production (PostgreSQL on Railway)
1. Create a Railway account at https://railway.app
2. Create a new project
3. Add a PostgreSQL database
4. Copy the `DATABASE_URL` from Railway
5. Paste it into your `.env` file

The database tables will be created automatically on first run.

## 📁 Project Structure

```
src/
├── commands/          # Slash commands
├── handlers/          # Button interaction handlers
├── services/          # Core game logic
├── db/               # Database models and connection
├── data/             # Game data (biomes, items)
├── jobs/             # Scheduled tasks (cron jobs)
└── index.ts          # Bot entry point
```

## 🛠️ Development

- **Build TypeScript:** `npm run build`
- **Run in dev mode:** `npm run dev` (uses ts-node)
- **Watch mode:** `npm run watch` (auto-rebuilds on changes)

## 🚢 Deployment

### Railway (Recommended)

1. Push your code to GitHub
2. Go to https://railway.app
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Add environment variables:
   - `DISCORD_BOT_TOKEN`
   - `DISCORD_GUILD_ID`
   - `DISCORD_CHANNEL_ID`
   - `DATABASE_URL` (Railway provides this automatically)
6. Railway will auto-deploy on every push!

### Other Platforms

See `DEPLOYMENT_PLAN.md` for detailed deployment instructions for other platforms.

## 📖 Documentation

- [Deployment Plan](./DEPLOYMENT_PLAN.md) - Complete setup and deployment guide
- [PRD](./PRD.md) - Product Requirements Document

## 🐛 Troubleshooting

**Bot doesn't respond:**
- Check bot token is correct
- Verify bot has permissions in your server
- Check bot is online in Discord

**Commands not showing:**
- Commands may take a few minutes to register
- Try restarting the bot
- Check `DISCORD_GUILD_ID` is correct

**Database errors:**
- Verify `DATABASE_URL` is correct
- Check database is accessible
- Ensure tables are created (run bot once)

## 📝 License

MIT
