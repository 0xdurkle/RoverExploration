# Setup Guide - Underlog Exploration Bot

This guide will walk you through setting up and deploying your Discord bot step-by-step.

## 📋 Prerequisites Checklist

- [ ] Node.js 18+ installed (check with `node --version`)
- [ ] A Discord account
- [ ] Access to a Discord server where you can test the bot
- [ ] A GitHub account (for deployment)

---

## Step 1: Create Discord Bot Application

1. **Go to Discord Developer Portal:**
   - Visit https://discord.com/developers/applications
   - Log in with your Discord account

2. **Create New Application:**
   - Click "New Application"
   - Name it "Underlog Exploration" (or any name you like)
   - Click "Create"

3. **Create Bot:**
   - Go to the "Bot" section in the left sidebar
   - Click "Add Bot" → "Yes, do it!"
   - **IMPORTANT:** Copy the "Token" (click "Reset Token" if needed)
   - **Save this token somewhere safe!** You'll need it later.

4. **Enable Privileged Gateway Intents:**
   - Still in the "Bot" section
   - Scroll down to "Privileged Gateway Intents"
   - Enable:
     - ✅ Message Content Intent
     - ✅ Server Members Intent (optional, but recommended)
   - Click "Save Changes"

5. **Get Your Server ID:**
   - In Discord, go to Settings → Advanced
   - Enable "Developer Mode"
   - Right-click your Discord server name
   - Click "Copy Server ID"
   - **Save this ID**

6. **Get Your Channel ID:**
   - Create a channel called `#underlog-exploration` (or use an existing one)
   - Right-click the channel
   - Click "Copy Channel ID"
   - **Save this ID**

7. **Invite Bot to Your Server:**
   - In Discord Developer Portal, go to "OAuth2" → "URL Generator"
   - Under "Scopes", select:
     - ✅ `bot`
     - ✅ `applications.commands`
   - Under "Bot Permissions", select:
     - ✅ Send Messages
     - ✅ Use Slash Commands
     - ✅ Read Message History
     - ✅ Embed Links
   - Copy the generated URL at the bottom
   - Open the URL in your browser
   - Select your server and click "Authorize"
   - Complete the CAPTCHA if prompted

---

## Step 2: Local Development Setup

### Install Dependencies

```bash
# Navigate to project directory
cd RoverExploration

# Install all packages
npm install
```

### Set Up Environment Variables

1. **Create `.env` file:**
   ```bash
   # On Mac/Linux:
   touch .env
   
   # Or just create it manually in your editor
   ```

2. **Add your Discord credentials:**
   ```env
   DISCORD_BOT_TOKEN=your_bot_token_from_step_1
   DISCORD_GUILD_ID=your_server_id_from_step_1
   DISCORD_CHANNEL_ID=your_channel_id_from_step_1
   DATABASE_URL=postgresql://user:password@localhost:5432/underlog
   NODE_ENV=development
   ```

### Set Up Local PostgreSQL Database

**Option A: Install PostgreSQL Locally**

1. **Mac (using Homebrew):**
   ```bash
   brew install postgresql@14
   brew services start postgresql@14
   createdb underlog
   ```

2. **Windows:**
   - Download from https://www.postgresql.org/download/windows/
   - Install and create a database named `underlog`

3. **Linux (Ubuntu/Debian):**
   ```bash
   sudo apt-get install postgresql postgresql-contrib
   sudo -u postgres createdb underlog
   ```

4. **Update DATABASE_URL:**
   ```env
   DATABASE_URL=postgresql://your_username@localhost:5432/underlog
   ```
   (Replace `your_username` with your PostgreSQL username)

**Option B: Use Railway Free Tier (Easier!)**

1. Go to https://railway.app
2. Sign up with GitHub
3. Create a new project
4. Click "New" → "Database" → "PostgreSQL"
5. Click on the PostgreSQL service
6. Go to "Variables" tab
7. Copy the `DATABASE_URL` value
8. Paste it into your local `.env` file

This way you can use the same database for local dev and production!

### Build and Run

```bash
# Build TypeScript
npm run build

# Run the bot
npm start
```

You should see:
```
✅ Bot logged in as YourBotName#1234
✅ Connected to PostgreSQL database
✅ Database tables created/verified
✅ Slash commands registered to guild
✅ Cron job started (checking every 2 minutes)
```

### Test the Bot

1. Go to your Discord server
2. Type `/explore` in any channel
3. You should see biome selection buttons
4. Click a biome, then select a duration
5. Wait for the timer (or modify the code to test with shorter times)

---

## Step 3: Deploy to Railway

### Prepare Your Code

1. **Make sure `.env` is in `.gitignore`** (it should be already)
2. **Commit your code:**
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Underlog Exploration bot"
   ```

3. **Push to GitHub:**
   - Create a new repository on GitHub
   - Push your code:
     ```bash
     git remote add origin https://github.com/yourusername/your-repo-name.git
     git branch -M main
     git push -u origin main
     ```

### Deploy on Railway

1. **Go to Railway:**
   - Visit https://railway.app
   - Sign in with GitHub

2. **Create New Project:**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository
   - Click "Deploy Now"

3. **Add PostgreSQL Database:**
   - In your Railway project, click "New"
   - Select "Database" → "PostgreSQL"
   - Railway will automatically create a database

4. **Configure Environment Variables:**
   - Click on your service (the one with your repo name)
   - Go to "Variables" tab
   - Add these variables:
     ```
     DISCORD_BOT_TOKEN=your_bot_token
     DISCORD_GUILD_ID=your_server_id
     DISCORD_CHANNEL_ID=your_channel_id
     NODE_ENV=production
     ```
   - **DATABASE_URL is automatically set by Railway** - you don't need to add it manually!

5. **Configure Build Settings:**
   - Go to "Settings" tab
   - Set "Build Command" to: `npm run build`
   - Set "Start Command" to: `npm start`
   - Set "Root Directory" to: `.` (or leave empty)

6. **Deploy:**
   - Railway will automatically deploy when you push to GitHub
   - Or click "Deploy" manually
   - Watch the logs to see if it starts successfully

### Verify Deployment

1. Check Railway logs - you should see:
   ```
   ✅ Bot logged in as YourBotName#1234
   ✅ Connected to PostgreSQL database
   ```

2. Go to your Discord server
3. Try `/explore` command
4. It should work exactly like local development!

---

## 🐛 Troubleshooting

### Bot Doesn't Respond

- **Check bot is online:** Look at your server's member list - bot should show as "Online"
- **Check token:** Verify `DISCORD_BOT_TOKEN` is correct (no extra spaces)
- **Check permissions:** Make sure bot has "Send Messages" permission in the channel
- **Check logs:** Look at Railway logs or terminal output for errors

### Commands Not Showing

- Commands can take up to 1 hour to appear globally
- For instant commands, make sure `DISCORD_GUILD_ID` is set correctly
- Try restarting the bot
- Check Railway logs for command registration errors

### Database Connection Errors

- **Local:** Make sure PostgreSQL is running (`brew services list` on Mac)
- **Railway:** Check that DATABASE_URL is set automatically (don't add it manually)
- **Connection string format:** Should be `postgresql://user:pass@host:port/dbname`

### "Cannot find module" Errors

- Run `npm install` again
- Make sure you're in the project directory
- Check that `node_modules` folder exists

### Timer Not Working

- Check cron job is running (should see logs every 2 minutes)
- Verify `DISCORD_CHANNEL_ID` is correct
- Check bot has permission to send messages in that channel

---

## 📚 Next Steps

- Customize biomes and items in `src/data/biomes.json`
- Adjust probabilities and duration multipliers
- Add more features (leaderboards, item collections, etc.)
- Monitor bot usage and performance

---

## 💡 Tips

- **Test locally first:** Always test changes locally before deploying
- **Use Git:** Commit frequently so you can roll back if needed
- **Check logs:** Railway logs show everything - use them for debugging
- **Start simple:** Get basic functionality working before adding features
- **Backup database:** Railway provides automatic backups, but export data if needed

---

**Need help?** Check the main README.md or DEPLOYMENT_PLAN.md for more details!
