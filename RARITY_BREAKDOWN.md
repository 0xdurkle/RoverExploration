# Item Rarity & Probability Breakdown

## Overview
Item discovery is calculated independently for each player. The system checks items in order from rarest to most common: **Legendary → Rare → Uncommon**. The first item that succeeds its probability roll is the item discovered.

## Formula
```
Adjusted Probability = Base Probability × Duration Multiplier
```

## Rarity Tiers
- **💚 Uncommon** (Most Common)
- **💠 Rare** (Medium)
- **💎 Legendary** (Rarest)

---

## Duration Multipliers

| Duration | Multiplier | Effect |
|----------|-----------|--------|
| 1 hour   | 1.0x      | Base odds (no change) |
| 3 hours  | 1.25x     | +25% to all probabilities |
| 6 hours  | 1.5x      | +50% to all probabilities |
| 12 hours | 2.0x      | Double all probabilities |

---

## Crystal Caverns

### 💚 Shard of Echoing Quartz (Uncommon)
- **Base Probability:** 7.0% (0.07)
- **1 hour:** 7.0% chance
- **3 hours:** 8.75% chance (0.07 × 1.25)
- **6 hours:** 10.5% chance (0.07 × 1.5)
- **12 hours:** 14.0% chance (0.07 × 2.0)

### 💠 Resonant Geode Core (Rare)
- **Base Probability:** 2.0% (0.02)
- **1 hour:** 2.0% chance
- **3 hours:** 2.5% chance (0.02 × 1.25)
- **6 hours:** 3.0% chance (0.02 × 1.5)
- **12 hours:** 4.0% chance (0.02 × 2.0)

### 💎 Aurora Heart Crystal (Legendary)
- **Base Probability:** 0.25% (0.0025)
- **1 hour:** 0.25% chance
- **3 hours:** 0.3125% chance (0.0025 × 1.25)
- **6 hours:** 0.375% chance (0.0025 × 1.5)
- **12 hours:** 0.5% chance (0.0025 × 2.0)

---

## Withered Woods

### 💚 Hollowwood Husk (Uncommon)
- **Base Probability:** 8.0% (0.08)
- **1 hour:** 8.0% chance
- **3 hours:** 10.0% chance (0.08 × 1.25)
- **6 hours:** 12.0% chance (0.08 × 1.5)
- **12 hours:** 16.0% chance (0.08 × 2.0)

### 💠 Spore-Touched Carapace (Rare)
- **Base Probability:** 2.0% (0.02)
- **1 hour:** 2.0% chance
- **3 hours:** 2.5% chance (0.02 × 1.25)
- **6 hours:** 3.0% chance (0.02 × 1.5)
- **12 hours:** 4.0% chance (0.02 × 2.0)

### 💎 The Rootmind Branch (Legendary)
- **Base Probability:** 0.2% (0.002)
- **1 hour:** 0.2% chance
- **3 hours:** 0.25% chance (0.002 × 1.25)
- **6 hours:** 0.3% chance (0.002 × 1.5)
- **12 hours:** 0.4% chance (0.002 × 2.0)

---

## Rainforest Ruins

### 💚 Moss-Veiled Relic (Uncommon)
- **Base Probability:** 7.0% (0.07)
- **1 hour:** 7.0% chance
- **3 hours:** 8.75% chance (0.07 × 1.25)
- **6 hours:** 10.5% chance (0.07 × 1.5)
- **12 hours:** 14.0% chance (0.07 × 2.0)

### 💠 Ancient Stone Glyph (Rare)
- **Base Probability:** 1.5% (0.015)
- **1 hour:** 1.5% chance
- **3 hours:** 1.875% chance (0.015 × 1.25)
- **6 hours:** 2.25% chance (0.015 × 1.5)
- **12 hours:** 3.0% chance (0.015 × 2.0)

### 💎 The Echo Crown (Legendary)
- **Base Probability:** 0.15% (0.0015)
- **1 hour:** 0.15% chance
- **3 hours:** 0.1875% chance (0.0015 × 1.25)
- **6 hours:** 0.225% chance (0.0015 × 1.5)
- **12 hours:** 0.3% chance (0.0015 × 2.0)

---

## How Discovery Works

1. **Sequential Check System**: Items are checked in rarity order (Legendary → Rare → Uncommon)
2. **First Success Wins**: The first item that passes its probability check is discovered
3. **No Multiple Items**: Only one item can be discovered per exploration
4. **Empty-Handed Possible**: If all items fail their checks, the player returns empty-handed

**Example Flow:**
1. Check Legendary item (e.g., 0.25% chance)
2. If that fails, check Rare item (e.g., 2.0% chance)
3. If that fails, check Uncommon item (e.g., 7.0% chance)
4. If all fail, return empty-handed

---

## Party Mechanics

**Current Implementation:** ❌ **NO PARTY BONUS**

- Each player's exploration is calculated **independently**
- Party size does **not** affect item discovery probabilities
- All players use the same base probabilities and duration multipliers
- Players in a party may find the same item or different items, but each discovery is independent

**Note:** While players can explore together and their results may be grouped in messages (if they find the same item), there is no mechanical benefit or penalty for being in a party. Each player's chances are identical whether they explore solo or with others.

---

## Summary Statistics

### Average Discovery Rates (12-hour expeditions)
- **Any Item:** ~20-25% chance (varies by biome)
- **Uncommon Items:** ~14-16% chance
- **Rare Items:** ~3-4% chance  
- **Legendary Items:** ~0.3-0.5% chance

### Best Odds Overall
- **Best for Uncommon:** Withered Woods (8% base → 16% at 12h)
- **Best for Rare:** Crystal Caverns & Withered Woods (2% base → 4% at 12h)
- **Best for Legendary:** Crystal Caverns (0.25% base → 0.5% at 12h)

