# Public Discord Messages

This document lists all public messages sent by the bot to the configured channel.

---

## 1. Exploration Start Message

**Location:** `src/commands/explore.ts` (line 127)

**Current Message:**
```
{userMention} has begun an exploration to **{biomeName}** for **{durationText}**. Good luck and gRove!
```

**Variables:**
- `{userMention}` - Discord user mention (e.g., `@username`)
- `{biomeName}` - Name of the biome (e.g., "Crystal Caverns")
- `{durationText}` - Formatted duration (e.g., "30s", "1 hour", "3 hours", "6 hours", "12 hours")

**Example Output:**
```
@durkle has begun an exploration to **Crystal Caverns** for **30s**. Good luck and gRove!
```

---

## 2. Exploration Return - Item Found

**Location:** `src/jobs/checkExplorations.ts` (line 66)

**Current Message:**
```
{emoji} {userMention} returns from the **{biomeName}** and discovered the **{itemName}** ({rarity})!
```

**Variables:**
- `{emoji}` - Rarity emoji (🟢 for uncommon, 🔵 for rare, 🟣 for legendary)
- `{userMention}` - Discord user mention (e.g., `@username`)
- `{biomeName}` - Name of the biome (e.g., "Crystal Caverns")
- `{itemName}` - Name of the discovered item (e.g., "Shard of Echoing Quartz")
- `{rarity}` - Rarity level (uncommon, rare, or legendary)

**Example Output:**
```
🟢 @durkle returns from the **Crystal Caverns** and discovered the **Shard of Echoing Quartz** (uncommon)!
```

---

## 3. Exploration Return - Empty Handed

**Location:** `src/jobs/checkExplorations.ts` (line 70)

**Current Message:**
```
🟤 {userMention} returns from the **{biomeName}** empty-handed.
```

**Variables:**
- `{userMention}` - Discord user mention (e.g., `@username`)
- `{biomeName}` - Name of the biome (e.g., "Crystal Caverns")

**Example Output:**
```
🟤 @durkle returns from the **Crystal Caverns** empty-handed.
```

---

## Summary

1. **Start Message:** `{userMention} has begun an exploration to **{biomeName}** for **{durationText}**. Good luck and gRove!`
2. **Return with Item:** `{emoji} {userMention} returns from the **{biomeName}** and discovered the **{itemName}** ({rarity})!`
3. **Return Empty:** `🟤 {userMention} returns from the **{biomeName}** empty-handed.`

---

## Variables Reference

- `{userMention}` - Always available (Discord mention format)
- `{biomeName}` - Always available
- `{durationText}` - Only in start message (30s, 1 hour, 3 hours, etc.)
- `{emoji}` - Only in item found message (🟢/🔵/🟣)
- `{itemName}` - Only in item found message
- `{rarity}` - Only in item found message (uncommon/rare/legendary)

