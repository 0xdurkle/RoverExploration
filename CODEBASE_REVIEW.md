# Rover Exploration Codebase Review

## Executive Summary

This is a Discord bot game called "Underlog Exploration" where users explore biomes, find rare items, and compete asynchronously. The project consists of:

1. **Discord Bot** (`src/`) - Main game logic, commands, and services
2. **Dashboard API** (`dashboard-api/`) - Express API server for dashboard data
3. **Dashboard Frontend** (`dashboard/`) - React-based admin dashboard

## Architecture Overview

### Bot Architecture

**Entry Point**: `src/index.ts`
- Discord.js client initialization
- Command registration (guild-specific or global)
- Cron jobs for exploration completion (every 10 seconds)
- Interaction handlers for commands and buttons

**Core Components**:

1. **Commands** (`src/commands/`)
   - `/explore` - Start exploration expeditions
   - `/inventory` - View user's collected items and stats
   - `/wallet` - Link Ethereum wallet for airdrops
   - `/party` - Create party expeditions (up to 5 players)
   - `/how` - Field guide with navigation
   - `/endall` - Admin command to end all active explorations

2. **Services** (`src/services/`)
   - `explorationService.ts` - Exploration lifecycle management
   - `rng.ts` - Item discovery RNG with rarity checks
   - `streakService.ts` - Daily streak tracking
   - `cooldownService.ts` - Active exploration checks
   - `partyService.ts` - Party state management (in-memory)
   - `partyLootService.ts` - Shared loot rolls with party bonuses

3. **Database** (`src/db/`)
   - PostgreSQL connection pool
   - Models: explorations, user_profiles, user_wallets
   - Unique constraint prevents duplicate active explorations
   - Transactions ensure atomicity

4. **Jobs** (`src/jobs/`)
   - `checkExplorations.ts` - Processes completed solo explorations
   - `checkPartyExplorations.ts` - Processes completed party expeditions

5. **Handlers** (`src/handlers/`)
   - `howNavigation.ts` - Field guide page navigation
   - `partyJoin.ts` - Party join button interactions

### Dashboard Architecture

**API Server** (`dashboard-api/src/index.ts`):
- Express server on port 3001
- Endpoints:
  - `GET /api/users` - All users with profiles and wallets
  - `GET /api/actions` - Exploration action logs
  - `GET /api/items` - All items from biomes.json
  - `PUT /api/items/:itemName/rarity` - Update item base probability
  - `GET /api/biomes` - Biome data
- Uses same PostgreSQL database as bot
- Discord client for fetching usernames

**Frontend** (`dashboard/src/`):
- React + TypeScript + Vite
- Two main views:
  - `Dashboard.tsx` - User table with search, filtering, CSV export
  - `RarityEditor.tsx` - Edit item base probabilities in real-time

## Key Features

### Game Mechanics

1. **Explorations**:
   - Choose biome (Crystal Caverns, Withered Woods, Rainforest Ruins)
   - Choose duration (30s, 1h, 3h, 6h, 12h)
   - Duration multipliers affect item discovery odds
   - Unique constraint prevents multiple active explorations per user
   - Results posted to Discord channel when complete

2. **Item Discovery**:
   - Rarity tiers: Uncommon, Rare, Legendary, Epic (Fragments)
   - Base probabilities per item
   - Duration multipliers (0.5x to 4.0x)
   - Party bonuses (additional players increase odds)
   - Special test probabilities for 30-second explorations

3. **Party System**:
   - Up to 5 players per party
   - 60-second join window
   - Shared loot result (all members get same item or nothing)
   - Party bonuses: +2% uncommon, +1% rare, +0.25% legendary, +0.0625% epic per additional member
   - In-memory storage (lost on restart)

4. **User Profiles**:
   - Total explorations count
   - Items found (stored as JSONB array)
   - Last exploration end time
   - Streak tracking (current and longest)

5. **Wallet Linking**:
   - Ethereum address validation
   - One wallet per Discord account
   - One Discord account per wallet
   - Used for future airdrops

### Data Flow

1. **Exploration Start**:
   - User runs `/explore` → Command handler validates → Creates DB record → Sends public message

2. **Exploration Completion**:
   - Cron job (every 10s) checks `explorations` table
   - Finds completed explorations (`ends_at <= NOW()`)
   - Rolls for item using RNG service
   - Updates exploration record
   - Updates user profile
   - Posts result to Discord channel

3. **Party Flow**:
   - Creator runs `/party create` → Public message with join button
   - Users click join → Updates party state
   - After 60s → Starts expedition → Creates exploration for each member
   - When complete → All members get same result

## Database Schema

### Tables

1. **explorations**
   - `id` (SERIAL PRIMARY KEY)
   - `user_id` (VARCHAR(20))
   - `biome` (VARCHAR(50))
   - `duration_hours` (DECIMAL(10,6))
   - `started_at` (TIMESTAMP)
   - `ends_at` (TIMESTAMP)
   - `completed` (BOOLEAN)
   - `item_found` (JSONB)
   - Unique index on `user_id` WHERE `completed = FALSE AND ends_at > NOW()`

2. **user_profiles**
   - `user_id` (VARCHAR(20) PRIMARY KEY)
   - `total_explorations` (INTEGER)
   - `items_found` (JSONB array)
   - `last_exploration_end` (TIMESTAMP)
   - `created_at` (TIMESTAMP)

3. **user_wallets**
   - `id` (SERIAL PRIMARY KEY)
   - `discord_id` (VARCHAR(20) UNIQUE)
   - `wallet_address` (VARCHAR(42) UNIQUE)
   - `updated_at` (TIMESTAMP)
   - `created_at` (TIMESTAMP)

## Strengths

1. **Well-structured codebase** - Clear separation of concerns
2. **Race condition protection** - Unique constraints prevent duplicate explorations
3. **Transaction safety** - Database transactions ensure atomicity
4. **Error handling** - Comprehensive try-catch blocks and error logging
5. **Message variations** - Rich, lore-friendly message system
6. **Dashboard integration** - Admin tools for monitoring and configuration
7. **Type safety** - TypeScript throughout
8. **Modular design** - Services are well-separated and testable

## Issues & Concerns

### Critical Issues

1. **Party State Loss on Restart** ⚠️
   - Parties stored in-memory (`partyService.ts`)
   - Server restart loses all active parties
   - **Impact**: Active party expeditions will fail to complete
   - **Recommendation**: Store parties in database or use Redis

2. **No Party Cleanup on Bot Restart** ⚠️
   - If bot restarts during party expedition, explorations exist but party state is lost
   - `checkPartyExplorations.ts` won't find the party to complete
   - **Impact**: Party members' explorations may never complete
   - **Recommendation**: Add database table for parties or recovery logic

3. **30-Second Test Mode Hardcoded** ⚠️
   - Special probabilities for 30s explorations are hardcoded
   - Could be confusing if users expect normal probabilities
   - **Recommendation**: Make test mode explicit or remove

### Medium Priority Issues

4. **Cron Job Frequency** ⚠️
   - Checking every 10 seconds may be excessive
   - Could cause database load with many users
   - **Recommendation**: Consider 30-60 second intervals

5. **No Rate Limiting** ⚠️
   - API endpoints have no rate limiting
   - Dashboard could be abused
   - **Recommendation**: Add rate limiting middleware

6. **Biome Data Path Resolution** ⚠️
   - Dashboard API tries multiple paths for `biomes.json`
   - Could fail in production if paths differ
   - **Recommendation**: Use environment variable or absolute path

7. **Error Messages to Users** ⚠️
   - Some error messages are technical
   - Could expose internal details
   - **Recommendation**: User-friendly error messages

8. **No Input Validation on Duration** ⚠️
   - Party command accepts string duration, parses manually
   - Could be more robust
   - **Recommendation**: Use same validation as `/explore`

### Low Priority / Improvements

9. **Code Duplication**
   - Party completion logic duplicated in `party.ts` and `checkPartyExplorations.ts`
   - **Recommendation**: Extract to shared function

10. **Missing Tests**
    - No unit tests or integration tests
    - **Recommendation**: Add test suite

11. **Logging**
    - Console.log throughout, no structured logging
    - **Recommendation**: Use winston or similar

12. **Environment Variables**
    - No validation of required env vars at startup
    - **Recommendation**: Add validation

13. **Dashboard API CORS**
    - CORS enabled for all origins
    - **Recommendation**: Restrict to specific origins in production

14. **No Pagination**
    - Dashboard API returns all users/actions
    - Could be slow with many users
    - **Recommendation**: Add pagination

15. **Streak Calculation**
    - Streak logic is complex and could have edge cases
    - **Recommendation**: Add tests and simplify if possible

## Code Quality Observations

### Good Practices

- TypeScript for type safety
- Clear function names and structure
- Good separation of concerns
- Transaction usage for data integrity
- Defensive programming (null checks, error handling)

### Areas for Improvement

- Some functions are quite long (e.g., `handleExploreCommand`)
- Magic numbers (e.g., `0.008333` for 30 seconds)
- Inconsistent error handling patterns
- Some duplicate code between party and solo exploration

## Dependencies

### Bot
- `discord.js@^14.14.1` - Discord API
- `pg@^8.11.3` - PostgreSQL client
- `ethers@^6.16.0` - Ethereum address validation
- `node-cron@^3.0.3` - Scheduled jobs
- `dotenv@^16.3.1` - Environment variables

### Dashboard API
- `express@^4.18.2` - Web server
- `cors@^2.8.5` - CORS middleware
- `discord.js@^14.14.1` - Username fetching
- `pg@^8.11.3` - Database

### Dashboard Frontend
- `react@^18.2.0` - UI framework
- `vite@^5.0.8` - Build tool

## Security Considerations

1. **No Authentication** - Dashboard has no auth
2. **SQL Injection** - Using parameterized queries (good)
3. **XSS** - React escapes by default (good)
4. **CORS** - Open to all origins (should restrict)
5. **Rate Limiting** - None on API endpoints
6. **Environment Variables** - Sensitive data (tokens, DB URLs) should be secured

## Performance Considerations

1. **Database Queries** - Generally efficient with indexes
2. **Cron Frequency** - Every 10 seconds may be excessive
3. **Party State** - In-memory is fast but not persistent
4. **Dashboard Refresh** - Every 5 seconds could be optimized
5. **No Caching** - Could cache biome data, user profiles

## Recommendations for Updates

### Immediate (Before Production)

1. **Persist Party State** - Move to database
2. **Add Party Recovery** - Handle bot restarts gracefully
3. **Environment Variable Validation** - Fail fast on missing vars
4. **Rate Limiting** - Add to API endpoints
5. **CORS Configuration** - Restrict origins

### Short Term

1. **Reduce Cron Frequency** - 30-60 seconds instead of 10
2. **Add Logging Library** - Structured logging
3. **Error Message Improvements** - User-friendly messages
4. **Add Tests** - Unit and integration tests
5. **Dashboard Authentication** - Protect admin features

### Long Term

1. **Monitoring & Alerts** - Add health checks and monitoring
2. **Performance Optimization** - Caching, query optimization
3. **Documentation** - API docs, architecture diagrams
4. **CI/CD** - Automated testing and deployment
5. **Analytics** - Track usage patterns

## File Structure Summary

```
RoverExploration/
├── src/                    # Bot source code
│   ├── commands/           # Slash command handlers
│   ├── handlers/           # Button/interaction handlers
│   ├── services/           # Business logic
│   ├── db/                 # Database models
│   ├── jobs/               # Cron jobs
│   ├── data/               # Game data (biomes.json)
│   ├── types/              # TypeScript types
│   └── utils/              # Utility functions
├── dashboard-api/          # Express API server
│   └── src/
│       ├── index.ts        # API routes
│       └── db.ts           # Database connection
├── dashboard/              # React frontend
│   └── src/
│       ├── App.tsx         # Main app
│       └── components/    # React components
└── package.json           # Root package.json
```

## Conclusion

This is a well-architected Discord bot game with a solid foundation. The main concerns are around party state persistence and error recovery. The codebase is maintainable and follows good practices overall. With the recommended improvements, especially around party persistence, this would be production-ready.

---

**Review Date**: 2024
**Reviewed By**: AI Code Review
**Status**: Ready for updates with recommended improvements
