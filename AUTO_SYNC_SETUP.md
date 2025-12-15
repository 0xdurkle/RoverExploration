# Auto-Sync Setup for Item Changes

This document explains how to configure automatic synchronization of item changes across the dashboard and Discord bot.

## Overview

When you make changes to items in the dashboard (name, rarity, biome, probability), the changes are now automatically synced to:
1. ✅ Dashboard API's `biomes.json` (local file)
2. ✅ Bot service's `biomes.json` (via HTTP sync endpoint)
3. ✅ Database user inventories (item name changes are updated in existing user profiles)

## How It Works

1. **Dashboard API** saves changes to its local `biomes.json` file
2. **Dashboard API** calls the bot's sync endpoint (`/api/sync/biomes`) with the updated data
3. **Bot service** receives the sync request, updates its `biomes.json`, and reloads it in memory
4. **Database** is updated when item names change (via `updateItemNameInUserProfiles`)

## Railway Configuration

To enable auto-sync, you need to configure these environment variables:

### Bot Service (Main Service)

Add these environment variables:

- `SYNC_API_KEY`: A secret key for authenticating sync requests (e.g., `your-secret-key-here`)
- `SYNC_PORT`: Port for the sync HTTP server (default: `3000`)

**Note**: Make sure `SYNC_PORT` doesn't conflict with Railway's default port. Railway will assign a public port automatically.

### Dashboard API Service

Add these environment variables:

- `BOT_SYNC_URL`: The public URL of your bot service's sync endpoint
  - Format: `http://your-bot-service.railway.app` (or `https://` if using custom domain)
  - **Important**: Do NOT include the port number or `/api/sync/biomes` path
  - Example: `https://rover-bot-production.up.railway.app`
  
- `SYNC_API_KEY`: The same secret key you set in the bot service

## Finding Your Bot Service URL

1. Go to Railway dashboard
2. Click on your **Main Service** (the bot service)
3. Go to the **Settings** tab
4. Scroll down to **Networking**
5. Copy the **Public Domain** URL (e.g., `rover-bot-production.up.railway.app`)
6. Use this as your `BOT_SYNC_URL` value

## Testing the Sync

After configuring the environment variables:

1. Make a change to an item in the dashboard (e.g., change an item name)
2. Check the Dashboard API logs - you should see:
   ```
   ✅ Synced biomes.json to bot service
   ```
3. Check the Bot service logs - you should see:
   ```
   ✅ Biomes.json synced from dashboard-api and reloaded
   ```
4. Test in Discord - the item name should be updated immediately in user inventories

## Troubleshooting

### Sync not working?

1. **Check environment variables**: Make sure `BOT_SYNC_URL` and `SYNC_API_KEY` are set in both services
2. **Check logs**: Look for warning messages like:
   - `⚠️ BOT_SYNC_URL or SYNC_API_KEY not set, skipping bot sync`
   - `⚠️ Failed to sync with bot service: [error]`
3. **Verify URL format**: `BOT_SYNC_URL` should be just the domain, no port or path
4. **Check Railway networking**: Make sure the bot service has a public domain assigned

### Item name changes not reflected in Discord?

1. The database update happens automatically when you change an item name
2. Check the Dashboard API logs for database update messages
3. If items still show old names, the database update may have failed - check logs for errors

## Security Notes

- The `SYNC_API_KEY` should be a strong, random string
- Never commit `SYNC_API_KEY` to git
- The sync endpoint is protected by API key authentication
- Only the dashboard-api service should know the sync key

