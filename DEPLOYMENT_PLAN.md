# Underlog Exploration - Deployment Plan

## 🎯 Project Overview
A Discord bot game where users explore biomes asynchronously, find items via RNG, and receive results after cooldown periods.

---

## 📚 Technology Stack Recommendations

### **Recommended: Node.js + TypeScript**
**Why:**
- ✅ Excellent Discord.js library (most mature Discord bot framework)
- ✅ Great TypeScript support (catches errors early)
- ✅ Large community and documentation
- ✅ Easy deployment options
- ✅ Good for async operations (timers, cooldowns)

**Alternative: Python + discord.py**
- ✅ Very beginner-friendly
- ✅ Simpler syntax
- ❌ Less performant for high-concurrency
- ❌ Fewer deployment options

**Our Choice: Node.js + TypeScript** (better long-term, still beginner-friendly)

---

## 🏗️ Infrastructure & Hosting

### **Recommended: Railway.app** ⭐
**Why:**
- ✅ **Free tier** (500 hours/month, $5 credit)
- ✅ **Zero-config PostgreSQL** database included
- ✅ **Auto-deploys** from GitHub
- ✅ **Simple setup** (just connect repo)
- ✅ **Built-in logging** and monitoring
- ✅ **HTTPS/domains** included

**Setup Time:** ~15 minutes

### **Alternative Options:**
1. **Render.com** - Similar to Railway, good free tier
2. **Heroku** - Classic but now paid ($5/month minimum)
3. **DigitalOcean App Platform** - $5/month, very reliable
4. **AWS/GCP** - Overkill for this project, complex setup

**Our Choice: Railway.app** (best balance of free + easy)

---

## 💾 Database Choice

### **PostgreSQL** (via Railway)
**Why:**
- ✅ Relational (perfect for user sessions, items)
- ✅ Free with Railway
- ✅ Industry standard
- ✅ Great Node.js support (Prisma, TypeORM, or raw pg)

**Alternative: SQLite** (for local dev only)

---

## 🔧 Core Dependencies

### Node.js Packages:
```json
{
  "discord.js": "^14.x",        // Discord API wrapper
  "typescript": "^5.x",         // Type safety
  "pg": "^8.x",                 // PostgreSQL client
  "node-cron": "^3.x",          // Scheduled jobs (check timers)
  "dotenv": "^16.x"             // Environment variables
}
```

---

## 📋 Implementation Plan

### **Phase 1: Project Setup** (Day 1)
- [ ] Initialize Node.js + TypeScript project
- [ ] Set up Discord bot application
- [ ] Configure environment variables
- [ ] Set up local database (SQLite for dev)
- [ ] Create project structure

### **Phase 2: Core Bot Setup** (Day 1-2)
- [ ] Discord bot connection & authentication
- [ ] Slash command registration (`/explore`)
- [ ] Button interaction handlers
- [ ] Ephemeral message system

### **Phase 3: Database & Models** (Day 2)
- [ ] Database schema design
- [ ] User session model
- [ ] User profile model
- [ ] Item discovery model
- [ ] Database connection setup

### **Phase 4: Game Logic** (Day 2-3)
- [ ] Biome selection system
- [ ] Duration selection system
- [ ] Cooldown enforcement
- [ ] RNG item discovery algorithm
- [ ] Duration multiplier system

### **Phase 5: Timer System** (Day 3)
- [ ] Exploration timer tracking
- [ ] Scheduled job system (check completed explorations)
- [ ] Result posting logic
- [ ] Cooldown calculation

### **Phase 6: Testing** (Day 3-4)
- [ ] Local testing with Discord test server
- [ ] Test all user flows
- [ ] Test edge cases (cooldowns, multiple users)
- [ ] Fix bugs

### **Phase 7: Deployment** (Day 4)
- [ ] Set up Railway account
- [ ] Connect GitHub repository
- [ ] Configure environment variables
- [ ] Deploy bot
- [ ] Test in production Discord server

---

## 🚀 Discord Bot Setup Steps

### 1. Create Discord Application
1. Go to https://discord.com/developers/applications
2. Click "New Application"
3. Name it "Underlog Exploration"
4. Go to "Bot" section
5. Click "Add Bot"
6. **Copy the Bot Token** (keep secret!)
7. Enable these Privileged Gateway Intents:
   - ✅ Message Content Intent (if needed)
   - ✅ Server Members Intent (optional)

### 2. Invite Bot to Server
1. Go to "OAuth2" → "URL Generator"
2. Select scopes:
   - `bot`
   - `applications.commands`
3. Select bot permissions:
   - Send Messages
   - Use Slash Commands
   - Read Message History
   - Embed Links
4. Copy the generated URL and open it
5. Select your server and authorize

### 3. Get Required IDs
- **Server ID**: Right-click server → Copy Server ID (enable Developer Mode in Discord settings)
- **Channel ID**: Right-click #underlog-exploration → Copy Channel ID

---

## 🔐 Environment Variables

Create `.env` file:
```env
DISCORD_BOT_TOKEN=your_bot_token_here
DISCORD_GUILD_ID=your_server_id_here
DISCORD_CHANNEL_ID=your_channel_id_here
DATABASE_URL=postgresql://... (Railway provides this)
NODE_ENV=production
```

---

## 📁 Project Structure

```
RoverExploration/
├── src/
│   ├── commands/
│   │   └── explore.ts          # /explore slash command
│   ├── handlers/
│   │   ├── biomeSelect.ts      # Biome button handler
│   │   └── durationSelect.ts   # Duration button handler
│   ├── services/
│   │   ├── explorationService.ts  # Core game logic
│   │   ├── cooldownService.ts     # Cooldown checks
│   │   └── rng.ts                 # Item discovery RNG
│   ├── db/
│   │   ├── models.ts              # Database models
│   │   └── connection.ts          # DB connection
│   ├── data/
│   │   └── biomes.json            # Biome/item definitions
│   ├── jobs/
│   │   └── checkExplorations.ts   # Cron job for timer checks
│   └── index.ts                   # Bot entry point
├── .env                          # Environment variables (gitignored)
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

---

## ⚙️ Key Technical Decisions

### **Timer System: Cron Job Approach**
- Every 1-5 minutes, check database for explorations where `ends_at <= now`
- Process completed explorations
- More reliable than in-memory timers (survives restarts)

### **Command Design**
- Use slash command options (dropdown menus) for user input
- Store exploration data in database immediately after command execution
- Atomic database operations prevent duplicate messages

### **Database Schema**
```sql
-- Explorations table
CREATE TABLE explorations (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(20) NOT NULL,
  biome VARCHAR(50) NOT NULL,
  duration_hours INTEGER NOT NULL,
  started_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  item_found JSONB,  -- null if nothing, or {name, rarity}
  created_at TIMESTAMP DEFAULT NOW()
);

-- User profiles table
CREATE TABLE user_profiles (
  user_id VARCHAR(20) PRIMARY KEY,
  total_explorations INTEGER DEFAULT 0,
  items_found JSONB DEFAULT '[]',
  last_exploration_end TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🧪 Testing Strategy

1. **Local Development:**
   - Use Discord test server
   - SQLite database for quick iteration
   - Test all button flows
   - Test cooldown logic

2. **Production Testing:**
   - Deploy to Railway
   - Test in your NFT project's Discord server
   - Monitor logs for errors
   - Test with multiple users

---

## 📊 Monitoring & Maintenance

### **What to Monitor:**
- Bot uptime (Railway dashboard)
- Error logs (Railway logs)
- Database size (Railway metrics)
- Response times

### **Common Issues:**
- Bot goes offline → Check Railway logs
- Commands not working → Verify bot permissions
- Database errors → Check connection string
- Timer not firing → Check cron job is running

---

## 🎓 Learning Resources

- **Discord.js Guide:** https://discordjs.guide/
- **TypeScript Handbook:** https://www.typescriptlang.org/docs/
- **Railway Docs:** https://docs.railway.app/
- **PostgreSQL Tutorial:** https://www.postgresql.org/docs/

---

## ✅ Next Steps

1. **Review this plan** - Make sure it aligns with your vision
2. **Set up Discord bot** - Create application and get token
3. **Initialize project** - We'll set up the codebase next
4. **Start coding** - Build feature by feature
5. **Deploy** - Push to Railway when ready

---

## 💡 Pro Tips

- **Start simple:** Get basic `/explore` working before adding complexity
- **Test frequently:** Test each feature as you build it
- **Use TypeScript:** It will catch errors before runtime
- **Keep secrets safe:** Never commit `.env` file
- **Version control:** Use Git from day one
- **Read errors:** Error messages usually tell you what's wrong

---

**Ready to start?** Let's begin with Phase 1: Project Setup! 🚀
