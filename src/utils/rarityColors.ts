/**
 * Rarity color mappings for Discord embeds
 */

export const RARITY_COLORS: Record<string, number> = {
  uncommon: 0x22c55e, // Green
  rare: 0x3b82f6, // Blue
  legendary: 0xa855f7, // Purple
  epic: 0xffd700, // Gold
};

/**
 * Get color for a rarity
 */
export function getRarityColor(rarity: string): number {
  return RARITY_COLORS[rarity.toLowerCase()] || 0x6b7280; // Default gray
}

/**
 * Get rarity display name with proper capitalization
 */
export function getRarityDisplayName(rarity: string): string {
  const rarityLower = rarity.toLowerCase();
  return rarityLower.charAt(0).toUpperCase() + rarityLower.slice(1);
}

