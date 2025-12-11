/**
 * Message variations for public Discord messages
 * Randomly selects from lore-friendly variations
 */

const EXPLORATION_START_VARIATIONS = [
  "{userMention} slips into the **{biomeName}** for a **{durationText}** expedition. Safe travels, wanderer.",
  "{userMention} ventures into the **{biomeName}** for **{durationText}**. The Underlog stirs…",
  "{userMention} sets off toward the **{biomeName}** for a **{durationText}** trek. May the echoes guide you.",
  "{userMention} enters the **{biomeName}** for **{durationText}**. Signal steady… for now.",
  "{userMention} begins a **{durationText}** journey into the **{biomeName}**. Good luck and gRove!",
  "{userMention} disappears into the **{biomeName}** for **{durationText}**. The caverns whisper behind them.",
  "{userMention} breaks trail into the **{biomeName}**. Estimated return: **{durationText}**.",
  "{userMention} starts a **{durationText}** expedition into the **{biomeName}**. The path bends ahead.",
  "{userMention} wanders into the **{biomeName}** for **{durationText}**. Their beacon dims in the distance.",
  "{userMention} heads into the **{biomeName}**, planning to roam for **{durationText}**. Be vigilant.",
  "{userMention} charts a course to the **{biomeName}** for **{durationText}**. Terrain unknown, outcome uncertain.",
  "{userMention} enters the **{biomeName}** for **{durationText}**. Tracks vanish behind them.",
  "{userMention} begins exploring the **{biomeName}**. They'll return in **{durationText}**, if the ground allows.",
  "{userMention} steps into the **{biomeName}** for **{durationText}**. Signals fade…",
  "{userMention} marches into the **{biomeName}** for a **{durationText}** scavenge. The void listens.",
  "{userMention} ventures beyond the safe zone into the **{biomeName}**. Back in **{durationText}**.",
  "{userMention} initiates a **{durationText}** roam into the **{biomeName}**. Echoes ripple outward.",
  "{userMention} slips beneath the canopy of the **{biomeName}**. Expected to return in **{durationText}**.",
  "{userMention} begins a **{durationText}** dive into the **{biomeName}**. The air shifts around them.",
  "{userMention} fades into the **{biomeName}**, tether set for **{durationText}**. Good luck and gRove."
];

const RETURNED_WITH_ITEM_VARIATIONS = [
  "{emoji} {userMention} emerges from the **{biomeName}** carrying the **{itemName}** ({rarity})!",
  "{emoji} {userMention} returns from the **{biomeName}** clutching a **{itemName}** ({rarity})!",
  "{emoji} {userMention} steps out of the **{biomeName}** and reveals the **{itemName}** ({rarity}) they unearthed!",
  "{emoji} {userMention} returns, dusted in mystery, holding the **{itemName}** ({rarity})!",
  "{emoji} {userMention} comes back from the **{biomeName}** with the **{itemName}** ({rarity}) shimmering in hand!",
  "{emoji} {userMention} emerges victorious from the **{biomeName}** with a **{itemName}** ({rarity}) find!",
  "{emoji} {userMention} returns to camp, proudly revealing the **{itemName}** ({rarity})!",
  "{emoji} {userMention} surfaces from the **{biomeName}** cradling the **{itemName}** ({rarity}).",
  "{emoji} {userMention} returns with a rare glimpse of fortune — the **{itemName}** ({rarity})!",
  "{emoji} {userMention} steps out of the **{biomeName}** glowing with discovery: **{itemName}** ({rarity})!",
  "{emoji} {userMention} reappears from the **{biomeName}**, triumphant with the **{itemName}** ({rarity})!",
  "{emoji} {userMention} uncovers the **{itemName}** ({rarity}) and returns safely from the **{biomeName}**!",
  "{emoji} {userMention} found what many overlook — the **{itemName}** ({rarity})!",
  "{emoji} {userMention} carries the **{itemName}** ({rarity}) back from the **{biomeName}** like a trophy.",
  "{emoji} {userMention} has retrieved the **{itemName}** ({rarity}) from deep within the **{biomeName}**!",
  "{emoji} {userMention} brings home the **{itemName}** ({rarity}) from the depths of the **{biomeName}**.",
  "{emoji} {userMention} returns from the **{biomeName}**, discovery glinting: **{itemName}** ({rarity})!",
  "{emoji} {userMention} emerges battered but successful — **{itemName}** ({rarity}) secured!",
  "{emoji} {userMention} returns with a treasure from the **{biomeName}**: **{itemName}** ({rarity})!",
  "{emoji} {userMention} comes back from the **{biomeName}** with something extraordinary — the **{itemName}** ({rarity})!",
  "{emoji} {userMention} returns triumphant, raising the **{itemName}** ({rarity}) high!",
  "{emoji} {userMention} steps out from the **{biomeName}**, hands glowing around the **{itemName}** ({rarity})!",
  "{emoji} {userMention} returns carrying a relic of the **{biomeName}**: **{itemName}** ({rarity})!",
  "{emoji} {userMention} emerges from the **{biomeName}** with the **{itemName}** ({rarity}) tucked safely away.",
  "{emoji} {userMention} found the fabled **{itemName}** ({rarity}) within the **{biomeName}** and returns victorious!"
];

const RETURNED_EMPTY_VARIATIONS = [
  "❌ {userMention} returns from the **{biomeName}** empty-handed.",
  "❌ {userMention} emerges from the **{biomeName}** with nothing to show this time.",
  "❌ {userMention} returns from the **{biomeName}** carrying only dust and disappointment.",
  "❌ {userMention} comes back from the **{biomeName}** empty-handed — the path kept its secrets.",
  "❌ {userMention} returns with no discoveries from the **{biomeName}**.",
  "❌ {userMention} wandered the **{biomeName}** but found nothing this round.",
  "❌ {userMention} steps out of the **{biomeName}** empty-handed — some days are just echoes.",
  "❌ {userMention} returns from the **{biomeName}**, pockets quiet and empty.",
  "❌ {userMention} brings back nothing from the **{biomeName}**.",
  "❌ {userMention} returns empty-handed — the **{biomeName}** offered no treasures today.",
  "❌ {userMention} trudges out of the **{biomeName}** empty-handed.",
  "❌ {userMention} emerges with nothing but footprints from the **{biomeName}**.",
  "❌ {userMention} returns with empty hands — the **{biomeName}** held firm.",
  "❌ {userMention} found nothing in the **{biomeName}** but lingering air and silence.",
  "❌ {userMention} returns empty-handed — the **{biomeName}** gave them only time.",
  "❌ {userMention} wanders back from the **{biomeName}** with nothing but a story of quiet terrain.",
  "❌ {userMention} comes back without a single find — the **{biomeName}** kept all its mysteries.",
  "❌ {userMention} appears at the edge of the **{biomeName}** empty-handed once again.",
  "❌ {userMention} returns with nothing — the **{biomeName}** swallowed every clue.",
  "❌ {userMention} is back from the **{biomeName}**, but fate handed them no relics."
];

/**
 * Get a random exploration start message
 */
export function getExplorationStartMessage(userMention: string, biomeName: string, durationText: string): string {
  const variation = EXPLORATION_START_VARIATIONS[
    Math.floor(Math.random() * EXPLORATION_START_VARIATIONS.length)
  ];
  
  return variation
    .replace(/{userMention}/g, userMention)
    .replace(/{biomeName}/g, biomeName)
    .replace(/{durationText}/g, durationText);
}

/**
 * Get a random return with item message
 */
export function getReturnWithItemMessage(
  emoji: string,
  userMention: string,
  biomeName: string,
  itemName: string,
  rarity: string
): string {
  const variation = RETURNED_WITH_ITEM_VARIATIONS[
    Math.floor(Math.random() * RETURNED_WITH_ITEM_VARIATIONS.length)
  ];
  
  return variation
    .replace(/{emoji}/g, emoji)
    .replace(/{userMention}/g, userMention)
    .replace(/{biomeName}/g, biomeName)
    .replace(/{itemName}/g, itemName)
    .replace(/{rarity}/g, rarity);
}

/**
 * Get a random return empty-handed message
 */
export function getReturnEmptyMessage(userMention: string, biomeName: string): string {
  const variation = RETURNED_EMPTY_VARIATIONS[
    Math.floor(Math.random() * RETURNED_EMPTY_VARIATIONS.length)
  ];
  
  return variation
    .replace(/{userMention}/g, userMention)
    .replace(/{biomeName}/g, biomeName);
}

