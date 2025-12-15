# Rover Exploration Dashboard

A Discord-styled dashboard for managing and viewing Rover Exploration bot data.

## Features

- **User Dashboard**: Searchable table with Discord names, wallet addresses, inventory, and action logs
- **Status Indicators**: Online/idle/offline status dots next to usernames
- **CSV Export**: Export selected rows and columns to CSV
- **Rarity Editor**: Update item rarity probabilities in real-time

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Make sure the API server is running on port 3001 (see `../dashboard-api/README.md`)

The dashboard will be available at `http://localhost:3000`

## Build

```bash
npm run build
```
