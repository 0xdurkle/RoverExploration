# 🚀 Quick Start - Get Your Bot Running in 10 Minutes

## Fastest Path to Deployment

### 1. Install Dependencies (2 min)
```bash
npm install
```

### 2. Set Up Discord Bot (3 min)
1. Go to https://discord.com/developers/applications
2. Create new application → Add Bot → Copy token
3. Enable "Message Content Intent"
4. Invite bot to server (OAuth2 → URL Generator)
5. Get Server ID and Channel ID (enable Developer Mode)

### 3. Set Up Database (2 min)
**Easiest option:** Use Railway's free PostgreSQL
1. Go to https://railway.app → Sign up
2. New Project → Add PostgreSQL database
3. Copy `DATABASE_URL` from Railway

### 4. Configure Environment (1 min)
Create `.env` file:
```env
DISCORD_BOT_TOKEN=your_token_here
DISCORD_GUILD_ID=your_server_id
DISCORD_CHANNEL_ID=your_channel_id
DATABASE_URL=postgresql://...from_railway
NODE_ENV=development
```

### 5. Run Locally (1 min)
```bash
npm run build
npm start
```

### 6. Deploy to Railway (1 min)
1. Push code to GitHub
2. Railway → New Project → Deploy from GitHub
3. Add environment variables (same as `.env`)
4. Railway auto-deploys!

---

## ✅ What's Built

- ✅ Complete Discord bot with `/explore` command
- ✅ Biome selection (3 biomes: Crystal Caverns, Withered Woods, Rainforest Ruins)
- ✅ Duration selection (1h, 3h, 6h, 12h)
- ✅ Cooldown system (prevents multiple explorations)
- ✅ RNG item discovery (Uncommon, Rare, Legendary)
- ✅ Duration multipliers (longer = better odds)
- ✅ Automatic timer completion (cron job every 2 minutes)
- ✅ Public result messages in Discord channel
- ✅ PostgreSQL database with user profiles
- ✅ TypeScript for type safety

---

## 📁 Project Structure

```
src/
├── commands/explore.ts          # /explore slash command (with dropdown options)
├── handlers/
│   └── partyJoin.ts             # Party join button handler
├── services/
│   ├── rng.ts                   # Item discovery logic
│   ├── cooldownService.ts       # Cooldown checks
│   └── explorationService.ts    # Core game logic
├── db/
│   ├── connection.ts            # Database setup
│   └── models.ts                # Database models/queries
├── jobs/checkExplorations.ts    # Cron job for timers
├── data/biomes.json             # Game data (items, odds)
└── index.ts                     # Bot entry point
```

---

## 🎮 How It Works

1. User types `/explore` in Discord
2. User selects biome from dropdown menu
3. User selects duration from dropdown menu (30s, 1h, 3h, 6h, 12h)
4. Exploration starts immediately
5. Bot stores exploration in database with `ends_at` timestamp
6. Cron job checks every 10 seconds for completed explorations
7. When timer ends, bot:
   - Rolls RNG for item discovery
   - Posts result in #underlog-exploration channel
   - Updates user profile

---

## 🔧 Customization

### Change Item Probabilities
Edit `src/data/biomes.json`:
```json
{
  "name": "Crystal Caverns",
  "baseProbability": 0.07  // 7% chance
}
```

### Change Duration Multipliers
Edit `src/data/biomes.json`:
```json
{
  "hours": 12,
  "multiplier": 2.0  // 2x odds
}
```

### Change Check Frequency
Edit `src/index.ts`:
```typescript
cron.schedule('*/2 * * * *', ...)  // Every 2 minutes
// Change to '*/1 * * * *' for every 1 minute
```

### Add New Biomes
Add to `src/data/biomes.json` → `biomes` array

---

## 📚 Full Documentation

- **SETUP_GUIDE.md** - Detailed step-by-step setup
- **DEPLOYMENT_PLAN.md** - Architecture and deployment options
- **README.md** - Project overview
- **PRD.md** - Original product requirements

---

## 🆘 Need Help?

1. **Bot not responding?** Check token, permissions, and logs
2. **Commands not showing?** Wait up to 1 hour or check `DISCORD_GUILD_ID`
3. **Database errors?** Verify `DATABASE_URL` is correct
4. **Timer not working?** Check cron job logs and channel permissions

See **SETUP_GUIDE.md** for detailed troubleshooting!

---

**Ready to deploy?** Follow the 6 steps above! 🚀
