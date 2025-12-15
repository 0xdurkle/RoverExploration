# RoverExploration Project Status

**Last Updated:** December 15, 2025  
**Status:** ✅ Fully operational - Dashboard, API, and Bot running on Railway with auto-sync enabled

---

## 🏗️ Project Architecture

This is a Discord bot game with a web dashboard for managing game data. The project consists of three main components:

### 1. **Discord Bot** (`src/`)
- **Location:** `src/index.ts`
- **Purpose:** Core game logic, Discord interactions, exploration mechanics
- **Database:** PostgreSQL (shared with dashboard-api)
- **Status:** ✅ Running on Railway (Main Service)
- **Sync Server:** HTTP server on port 3000 (or `SYNC_PORT`) for receiving biomes.json updates
- **Endpoints:**
  - `POST /api/sync/biomes` - Receives biomes.json updates from dashboard-api (requires `SYNC_API_KEY`)
  - `GET /health` - Health check endpoint

### 2. **Dashboard API** (`dashboard-api/`)
- **Location:** `dashboard-api/src/index.ts`
- **Purpose:** REST API backend for the dashboard
- **Port:** 3001 (default) or `DASHBOARD_API_PORT`
- **Database:** PostgreSQL (shared with bot)
- **Status:** ✅ Running on Railway
- **Railway Service:** `RoverExploration` with `Root Directory = /dashboard-api`
- **Public URL:** `https://roverexploration-production.up.railway.app`

**Endpoints:**
- `GET /api/users` - Get all users with profiles and wallets
- `GET /api/actions` - Get exploration action logs
- `GET /api/items` - Get all items from biomes.json
- `PUT /api/items/:itemName` - Update item (name, rarity, biome, probability) - **Auto-syncs to bot**
- `POST /api/biomes/:biomeId/items` - Create new item in a biome - **Auto-syncs to bot**
- `DELETE /api/items/:itemName` - Delete an item - **Auto-syncs to bot**
- `GET /api/biomes` - Get biomes data
- `PUT /api/items/:itemName/rarity` - Update item rarity/probability (legacy)

### 3. **Dashboard Frontend** (`dashboard/`)
- **Location:** `dashboard/src/`
- **Framework:** React + TypeScript + Vite
- **Status:** ✅ Running on Railway
- **Railway Service:** `Dashboard-Web` with `Root Directory = /dashboard`
- **Public URL:** `https://dashboard-web-production-2adc.up.railway.app`
- **Port:** 4173 (Vite preview server)
- **Build Command:** `cd dashboard && npm install && npm run build`
- **Start Command:** `cd dashboard && npm run preview -- --host 0.0.0.0 --port $PORT`

**Tabs:**
- **Dashboard:** View users, wallets, inventory, action logs
  - Removed Discord ID column (only shows Discord name)
  - Single dropdown constraint (only one dropdown open at a time)
  - Dropdowns flip upward when near bottom of viewport
  - Dropdowns have max-height with internal scrolling
- **Item Manager:** Edit existing items and create new items (full CRUD)
  - Edit item name, rarity, biome, and probability
  - Create new items with modal dialog
  - Delete items with confirmation warning
  - Rarity dropdown order: Uncommon, Rare, Legendary, Epic

---

## 🗄️ Database

- **Type:** PostgreSQL
- **Hosting:** Railway
- **Connection:** Uses `DATABASE_URL` (external connection string)
- **Tables:**
  - `user_profiles` - User exploration data (includes `items_found` JSONB array)
  - `user_wallets` - Wallet addresses linked to Discord IDs
  - `explorations` - Exploration action logs (includes `item_found` JSONB object)

**Important:** When item names are changed via the dashboard, the database automatically updates:
- All `user_profiles.items_found` entries
- All `explorations.item_found` entries

---

## 🔧 Configuration

### Environment Variables

#### Dashboard API (Railway)
- `DATABASE_URL` = Database connection string (external)
- `DISCORD_BOT_TOKEN` = Bot token for Discord username lookups
- `DASHBOARD_API_PORT` = 3001 (optional, defaults to 3001)
- `BOT_SYNC_URL` = Bot service public URL (e.g., `https://your-bot-service.up.railway.app`)
- `SYNC_API_KEY` = Secret key for authenticating sync requests (must match bot service)

#### Dashboard Web (Railway)
- `VITE_API_BASE_URL` = `https://roverexploration-production.up.railway.app` (Dashboard API URL)

#### Bot Service (Railway)
- `DATABASE_URL` = Database connection string
- `DISCORD_BOT_TOKEN` = Bot token
- `SYNC_API_KEY` = Secret key for authenticating sync requests (must match dashboard-api)
- `SYNC_PORT` = 3000 (optional, defaults to 3000)
- Other bot-specific env vars (DISCORD_GUILD_ID, DISCORD_CHANNEL_ID, etc.)

---

## 🔄 Auto-Sync System

**Status:** ✅ Enabled and working

When items are created, edited, or deleted in the dashboard:
1. Dashboard API saves changes to its local `biomes.json`
2. Dashboard API calls bot's `/api/sync/biomes` endpoint
3. Bot receives sync request, updates its `biomes.json`, and reloads it in memory
4. Database entries are updated when item names change

**Key Files:**
- `src/data/biomesLoader.ts` - Dynamic biomes.json loader with hot-reload capability
- `src/index.ts` - Bot sync HTTP server endpoint
- `dashboard-api/src/index.ts` - Sync client that calls bot endpoint

**See `AUTO_SYNC_SETUP.md` for detailed setup instructions.**

---

## 📁 Key Files

### Backend
- `dashboard-api/src/index.ts` - Main API server with auto-sync
- `dashboard-api/src/db.ts` - Database connection (manually parses DATABASE_URL)
- `dashboard-api/data/biomes.json` - Item definitions (bundled with API, synced to bot)
- `src/db/models.ts` - Database models including `updateItemNameInUserProfiles` function

### Frontend
- `dashboard/src/App.tsx` - Main app with tab navigation (Dashboard, Item Manager)
- `dashboard/src/components/Dashboard.tsx` - User dashboard view with single dropdown constraint
- `dashboard/src/components/ItemManager.tsx` - Item CRUD interface
- `dashboard/src/components/ItemManager.css` - Styles for Item Manager
- `dashboard/src/components/Dashboard.css` - Styles for Dashboard (dropdown positioning)
- `dashboard/src/config.ts` - API base URL configuration

### Bot
- `src/index.ts` - Bot entry point with sync HTTP server
- `src/data/biomes.json` - Item definitions (source of truth, auto-synced from dashboard-api)
- `src/data/biomesLoader.ts` - Dynamic biomes.json loader
- `src/services/rng.ts` - Item discovery logic (uses dynamic loader)
- `src/services/partyLootService.ts` - Party loot logic (uses dynamic loader)
- `src/utils/inventoryHelpers.ts` - Inventory and biome progress calculation with fuzzy matching

---

## 🚀 Deployment Status

### Railway Services

1. **Postgres** (Database)
   - Status: ✅ Online
   - Provides `DATABASE_URL` for connections

2. **RoverExploration** (Bot)
   - Status: ✅ Online
   - Root Directory: None (uses repo root)
   - Runs the Discord bot + sync HTTP server
   - Port: 3000 (sync server) + Railway-assigned port

3. **RoverExploration** (Dashboard API)
   - Status: ✅ Online
   - Root Directory: `/dashboard-api`
   - Build: `npm run build`
   - Start: `npm start`
   - Port: 3001

4. **Dashboard-Web** (Frontend)
   - Status: ✅ Online
   - Root Directory: `/dashboard`
   - Build: `cd dashboard && npm install && npm run build`
   - Start: `cd dashboard && npm run preview -- --host 0.0.0.0 --port $PORT`
   - Port: 4173 (configured in Railway Networking)

---

## 🔄 Recent Changes (December 2025)

### Auto-Sync System (NEW)
- ✅ Added HTTP sync server to bot (`/api/sync/biomes` endpoint)
- ✅ Refactored biomes.json loading to be dynamic and reloadable
- ✅ Dashboard API now automatically syncs changes to bot service
- ✅ Database entries automatically update when item names change
- ✅ Bot reloads biomes.json in memory without restart

### UI Improvements
- ✅ Removed Discord ID column from dashboard (only shows Discord name)
- ✅ Single dropdown constraint (only one dropdown can be open at a time)
- ✅ Dropdowns flip upward when near bottom of viewport
- ✅ Dropdowns have max-height (`min(400px, calc(100vh - 200px))`) with internal scrolling
- ✅ Removed misleading status dots from user table
- ✅ Split Item Manager into separate tab from Rarity Editor
- ✅ Removed redundant Rarity Editor tab (Item Manager has full functionality)
- ✅ Moved "Create New Item" to plus icon button in header with modal
- ✅ Made left and right panels same height in Item Manager
- ✅ Rarity dropdown order: Uncommon, Rare, Legendary, Epic

### Features Added
- ✅ Full item CRUD (create, edit name/rarity/biome/probability, delete)
- ✅ Delete item functionality with confirmation modal
- ✅ Discord username lookup in dashboard (requires `DISCORD_BOT_TOKEN`)
- ✅ Database inventory updates when item names change
- ✅ Fuzzy item name matching for biome progress (handles name changes)

### Bug Fixes
- ✅ Fixed `/api/users` 500 error (Discord client initialization)
- ✅ Fixed database connection (using external connection string)
- ✅ Fixed dashboard API build (added `tsconfig.json` and bundled `biomes.json`)
- ✅ Fixed dashboard build (added Vite env types, fixed CSS imports)
- ✅ Fixed Vite preview host restrictions (allowed all hosts)
- ✅ Fixed biome progress calculation (added biome verification for fuzzy matching)
- ✅ Fixed collection progress showing incorrect percentages

---

## ⚠️ Important Notes

1. **Auto-Sync Configuration:** 
   - Both dashboard-api and bot service need `SYNC_API_KEY` set to the same value
   - Dashboard-api needs `BOT_SYNC_URL` pointing to bot's public domain
   - Bot needs `SYNC_PORT` set (defaults to 3000)
   - See `AUTO_SYNC_SETUP.md` for detailed setup

2. **Biomes.json Sync:** 
   - `src/data/biomes.json` - Bot's copy (auto-updated via sync endpoint)
   - `dashboard-api/data/biomes.json` - Dashboard API's copy (source for edits)
   - Changes made in dashboard automatically sync to bot via HTTP endpoint
   - Bot reloads biomes.json in memory without requiring restart

3. **Database Updates:**
   - When item names are changed, all user inventories are automatically updated
   - Both `user_profiles.items_found` and `explorations.item_found` are updated
   - Updates happen atomically with biomes.json changes

4. **Item Name Matching:**
   - Uses fuzzy matching to handle name changes (e.g., "Resonant Geode" matches "Resonant Geode Core")
   - Verifies biome matches before fuzzy matching to prevent cross-biome false positives
   - Matching order: exact → normalized → substring → word-based fuzzy

5. **Build Requirements:**
   - Dashboard API needs `tsconfig.json` in `dashboard-api/`
   - Dashboard needs `vite-env.d.ts` for TypeScript env types
   - Bot needs `express` and `@types/express` for sync server
   - All dependencies are committed to git

6. **Port Configuration:**
   - Dashboard API: Uses `DASHBOARD_API_PORT` or defaults to 3001
   - Dashboard Web: Uses Vite preview on port 4173 (configured in Railway Networking)
   - Bot Sync Server: Uses `SYNC_PORT` or defaults to 3000

7. **Git Structure:**
   - All three components are in the same repo
   - Railway services use Root Directory to isolate each component
   - Main branch is `main`

---

## 🐛 Known Issues / Future Improvements

- [ ] Consider adding authentication to dashboard (currently anyone with URL can access)
- [ ] Dashboard API Discord username lookup requires bot token - consider caching or alternative
- [ ] Sync endpoint has no rate limiting (currently relies on Railway's infrastructure)
- [ ] Could add webhook notifications when items are created/edited/deleted

---

## 📝 Quick Reference

### To Deploy Changes

1. **Dashboard API:**
   ```bash
   git add dashboard-api/
   git commit -m "Your message"
   git push
   # Railway auto-deploys or manually redeploy
   ```

2. **Dashboard Frontend:**
   ```bash
   git add dashboard/
   git commit -m "Your message"
   git push
   # Railway auto-deploys or manually redeploy
   ```

3. **Bot:**
   ```bash
   git add src/
   git commit -m "Your message"
   git push
   # Railway auto-deploys or manually redeploy
   ```

### To Test Locally

1. **Dashboard API:**
   ```bash
   cd dashboard-api
   npm install
   npm run dev  # Runs on port 3001
   ```

2. **Dashboard Frontend:**
   ```bash
   cd dashboard
   npm install
   # Create .env.local with: VITE_API_BASE_URL=http://localhost:3001
   npm run dev  # Runs on port 3003 (or next available)
   ```

3. **Bot:**
   ```bash
   npm install
   npm run build
   npm start
   ```

### To Enable Auto-Sync

1. **On Bot Service (Railway):**
   - Add `SYNC_API_KEY` = your secret key (e.g., `my-secret-key-123`)
   - Add `SYNC_PORT` = `3000` (or any port)

2. **On Dashboard API Service (Railway):**
   - Add `BOT_SYNC_URL` = bot service public URL (e.g., `https://your-bot-service.up.railway.app`)
   - Add `SYNC_API_KEY` = same secret key as bot service

3. **Find Bot Service URL:**
   - Railway → Bot Service → Settings → Networking → Public Domain
   - Copy the URL (without port or path)

---

## 🔗 Useful Links

- **Dashboard:** https://dashboard-web-production-2adc.up.railway.app
- **Dashboard API:** https://roverexploration-production.up.railway.app
- **API Users Endpoint:** https://roverexploration-production.up.railway.app/api/users
- **API Items Endpoint:** https://roverexploration-production.up.railway.app/api/items
- **Bot Health Check:** `https://your-bot-service.up.railway.app/health`

---

## 📞 Support

If you encounter issues:
1. Check Railway deployment logs for the relevant service
2. Verify environment variables are set correctly (especially `BOT_SYNC_URL` and `SYNC_API_KEY`)
3. Ensure database connection string is correct
4. Check that ports match between service config and Railway Networking settings
5. Verify auto-sync is configured (see `AUTO_SYNC_SETUP.md`)
6. Check bot logs for sync messages when making item changes

---

## 📚 Related Documentation

- `AUTO_SYNC_SETUP.md` - Detailed auto-sync configuration guide
- `README.md` - General project overview
- `DEPLOYMENT_PLAN.md` - Deployment instructions
