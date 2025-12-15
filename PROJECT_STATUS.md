# RoverExploration Project Status

**Last Updated:** December 15, 2025  
**Status:** ✅ Fully operational - Dashboard, API, and Bot running on Railway

---

## 🏗️ Project Architecture

This is a Discord bot game with a web dashboard for managing game data. The project consists of three main components:

### 1. **Discord Bot** (`src/`)
- **Location:** `src/index.ts`
- **Purpose:** Core game logic, Discord interactions, exploration mechanics
- **Database:** PostgreSQL (shared with dashboard-api)
- **Status:** ✅ Running on Railway (Main Service)

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
- `PUT /api/items/:itemName` - Update item (name, rarity, biome, probability)
- `POST /api/biomes/:biomeId/items` - Create new item in a biome
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
- **Item Manager:** Edit existing items and create new items (full CRUD)

---

## 🗄️ Database

- **Type:** PostgreSQL
- **Hosting:** Railway
- **Connection:** Uses `DATABASE_PUBLIC_URL` from Railway Postgres service
- **Tables:**
  - `user_profiles` - User exploration data
  - `user_wallets` - Wallet addresses linked to Discord IDs
  - `explorations` - Exploration action logs

**Important:** The dashboard-api uses `DATABASE_PUBLIC_URL` (external connection string), NOT `DATABASE_URL` (internal), because services need to connect across Railway's network.

---

## 🔧 Configuration

### Environment Variables

#### Dashboard API (Railway)
- `DATABASE_URL` = `DATABASE_PUBLIC_URL` from Postgres service (external connection string)
- `DISCORD_BOT_TOKEN` = Bot token for Discord username lookups
- `DASHBOARD_API_PORT` = 3001 (optional, defaults to 3001)

#### Dashboard Web (Railway)
- `VITE_API_BASE_URL` = `https://roverexploration-production.up.railway.app` (Dashboard API URL)

#### Bot Service (Railway)
- `DATABASE_URL` = Database connection string
- `DISCORD_BOT_TOKEN` = Bot token
- Other bot-specific env vars

---

## 📁 Key Files

### Backend
- `dashboard-api/src/index.ts` - Main API server
- `dashboard-api/src/db.ts` - Database connection (manually parses DATABASE_URL)
- `dashboard-api/data/biomes.json` - Item definitions (bundled with API)

### Frontend
- `dashboard/src/App.tsx` - Main app with tab navigation
- `dashboard/src/components/Dashboard.tsx` - User dashboard view
- `dashboard/src/components/ItemManager.tsx` - Item CRUD interface
- `dashboard/src/components/ItemManager.css` - Styles for Item Manager
- `dashboard/src/config.ts` - API base URL configuration

### Bot
- `src/index.ts` - Bot entry point
- `src/data/biomes.json` - Item definitions (source of truth, synced with dashboard-api)

---

## 🚀 Deployment Status

### Railway Services

1. **Postgres** (Database)
   - Status: ✅ Online
   - Provides `DATABASE_PUBLIC_URL` for external connections

2. **RoverExploration** (Bot)
   - Status: ✅ Online
   - Root Directory: None (uses repo root)
   - Runs the Discord bot

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

### Fixed Issues
- ✅ Fixed `/api/users` 500 error (Discord client initialization)
- ✅ Fixed database connection (using `DATABASE_PUBLIC_URL` instead of internal URL)
- ✅ Fixed dashboard API build (added `tsconfig.json` and bundled `biomes.json`)
- ✅ Fixed dashboard build (added Vite env types, fixed CSS imports)
- ✅ Fixed Vite preview host restrictions (allowed all hosts)

### UI Improvements
- ✅ Removed misleading status dots from user table
- ✅ Split Item Manager into separate tab from Rarity Editor
- ✅ Removed redundant Rarity Editor tab (Item Manager has full functionality)
- ✅ Moved "Create New Item" to plus icon button in header with modal
- ✅ Made left and right panels same height in Item Manager

### Features Added
- ✅ Full item CRUD (create, edit name/rarity/biome/probability)
- ✅ Discord username lookup in dashboard (requires `DISCORD_BOT_TOKEN`)

---

## ⚠️ Important Notes

1. **Database Connection:** Dashboard API must use `DATABASE_PUBLIC_URL` (external), not `DATABASE_URL` (internal), because Railway services need to connect across the network.

2. **Biomes.json Sync:** There are two copies of `biomes.json`:
   - `src/data/biomes.json` - Source of truth (used by bot)
   - `dashboard-api/data/biomes.json` - Bundled copy (used by dashboard API)
   - When items are edited via dashboard, only the dashboard-api copy is updated. Consider syncing or using a single source.

3. **Build Requirements:**
   - Dashboard API needs `tsconfig.json` in `dashboard-api/`
   - Dashboard needs `vite-env.d.ts` for TypeScript env types
   - Both are committed to git

4. **Port Configuration:**
   - Dashboard API: Uses `DASHBOARD_API_PORT` or defaults to 3001
   - Dashboard Web: Uses Vite preview on port 4173 (configured in Railway Networking)

5. **Git Structure:**
   - All three components are in the same repo
   - Railway services use Root Directory to isolate each component
   - Main branch is `main`

---

## 🐛 Known Issues / Future Improvements

- [ ] Consider syncing `biomes.json` between bot and dashboard-api (or use single source)
- [ ] Dashboard API Discord username lookup requires bot token - consider caching or alternative
- [ ] No authentication on dashboard (anyone with URL can access)
- [ ] Item edits don't sync back to bot's `src/data/biomes.json` automatically

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

---

## 🔗 Useful Links

- **Dashboard:** https://dashboard-web-production-2adc.up.railway.app
- **Dashboard API:** https://roverexploration-production.up.railway.app
- **API Users Endpoint:** https://roverexploration-production.up.railway.app/api/users
- **API Items Endpoint:** https://roverexploration-production.up.railway.app/api/items

---

## 📞 Support

If you encounter issues:
1. Check Railway deployment logs for the relevant service
2. Verify environment variables are set correctly
3. Ensure database connection string is the external `DATABASE_PUBLIC_URL`
4. Check that ports match between service config and Railway Networking settings

