# Item Discovery Probability Breakdown

## How It Works

The system checks items **in order of rarity** (Legendary → Rare → Uncommon). Once an item is found, it stops checking.

**Formula:** `Adjusted Probability = Base Probability × Duration Multiplier`

The system rolls a random number (0-1) for each item. If the roll is **less than** the adjusted probability, that item is found.

---

## Duration Multipliers

| Duration | Multiplier | Effect |
|----------|------------|--------|
| 30 seconds | 0.5x | 50% of base odds (reduced for testing) |
| 1 hour | 1.0x | Base odds |
| 3 hours | 1.25x | +25% better odds |
| 6 hours | 1.5x | +50% better odds |
| 12 hours | 2.0x | +100% better odds (double) |

---

## Crystal Caverns

### Base Probabilities:
- **Uncommon**: 7% (0.07)
- **Rare**: 2% (0.02)
- **Legendary**: 0.25% (0.0025)

### Adjusted Probabilities by Duration:

| Duration | Uncommon | Rare | Legendary | Any Item | Nothing |
|----------|----------|------|-----------|----------|---------|
| **30s** | 3.5% | 1.0% | 0.125% | ~4.6% | ~95.4% |
| **1h** | 7.0% | 2.0% | 0.25% | ~9.2% | ~90.8% |
| **3h** | 8.75% | 2.5% | 0.3125% | ~11.5% | ~88.5% |
| **6h** | 10.5% | 3.0% | 0.375% | ~13.8% | ~86.2% |
| **12h** | 14.0% | 4.0% | 0.5% | ~18.4% | ~81.6% |

---

## Withered Woods

### Base Probabilities:
- **Uncommon**: 8% (0.08)
- **Rare**: 2% (0.02)
- **Legendary**: 0.2% (0.002)

### Adjusted Probabilities by Duration:

| Duration | Uncommon | Rare | Legendary | Any Item | Nothing |
|----------|----------|------|-----------|----------|---------|
| **30s** | 4.0% | 1.0% | 0.1% | ~5.1% | ~94.9% |
| **1h** | 8.0% | 2.0% | 0.2% | ~10.2% | ~89.8% |
| **3h** | 10.0% | 2.5% | 0.25% | ~12.7% | ~87.3% |
| **6h** | 12.0% | 3.0% | 0.3% | ~15.2% | ~84.8% |
| **12h** | 16.0% | 4.0% | 0.4% | ~20.3% | ~79.7% |

---

## Rainforest Ruins

### Base Probabilities:
- **Uncommon**: 7% (0.07)
- **Rare**: 1.5% (0.015)
- **Legendary**: 0.15% (0.0015)

### Adjusted Probabilities by Duration:

| Duration | Uncommon | Rare | Legendary | Any Item | Nothing |
|----------|----------|------|-----------|----------|---------|
| **30s** | 3.5% | 0.75% | 0.075% | ~4.3% | ~95.7% |
| **1h** | 7.0% | 1.5% | 0.15% | ~8.6% | ~91.4% |
| **3h** | 8.75% | 1.875% | 0.1875% | ~10.8% | ~89.2% |
| **6h** | 10.5% | 2.25% | 0.225% | ~12.9% | ~87.1% |
| **12h** | 14.0% | 3.0% | 0.3% | ~17.2% | ~82.8% |

---

## Important Notes

1. **Sequential Checking**: The system checks Legendary → Rare → Uncommon in order. If you find a Legendary, it stops there (you don't also get a Rare or Uncommon).

2. **"Any Item" Chance**: This is the probability of finding **at least one item** (not additive, calculated using probability math).

3. **Longer Duration = Better Odds**: 
   - 12-hour explorations have **double** the base probabilities
   - 30-second explorations have **half** the base probabilities (for testing)

4. **Best Biome for Items**: 
   - **Withered Woods** has the highest overall item discovery rate
   - **Rainforest Ruins** has the lowest legendary rate but still decent rates

5. **Time Investment vs Reward**:
   - **30s**: Fast testing, low success rate (~4-5%)
   - **1h**: Baseline, decent success rate (~9-10%)
   - **12h**: Best odds, but requires waiting (~18-20% success)

---

## Example Calculation (Crystal Caverns, 12 hours):

1. Check Legendary: 0.25% × 2.0 = **0.5%** chance
2. If not Legendary, check Rare: 2.0% × 2.0 = **4.0%** chance  
3. If not Rare, check Uncommon: 7.0% × 2.0 = **14.0%** chance
4. Overall chance of finding something: ~18.4%
5. Chance of finding nothing: ~81.6%

