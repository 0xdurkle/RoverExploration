# Rover Exploration Dashboard API

Express API server for the Rover Exploration dashboard.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set environment variables:
```bash
DATABASE_URL=postgresql://user:password@localhost:5432/underlog
DASHBOARD_API_PORT=3001  # Optional, defaults to 3001
```

3. Start the server:
```bash
npm run dev  # Development mode
# or
npm run build && npm start  # Production mode
```

## API Endpoints

- `GET /api/users` - Get all users with profiles and wallets
- `GET /api/actions` - Get action logs from explorations
- `GET /api/items` - Get all items from biomes.json
- `PUT /api/items/:itemName/rarity` - Update item base probability
- `GET /api/biomes` - Get biomes data

## Notes

- This API server is completely separate from the Discord bot
- It only reads from the database and updates biomes.json
- The bot code is not modified
