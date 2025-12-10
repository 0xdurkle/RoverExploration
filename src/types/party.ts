/**
 * Party expedition types and interfaces
 */

export interface PartyMember {
  userId: string;
  joinedAt: Date;
}

export interface PartyLootResult {
  name: string;
  rarity: 'uncommon' | 'rare' | 'legendary';
}

export interface Party {
  id: string;
  creatorId: string;
  biome: string;
  biomeName: string;
  durationHours: number;
  durationText: string;
  joinedUsers: PartyMember[];
  createdAt: Date;
  expiresAt: Date;
  messageId?: string;
  channelId?: string;
  started: boolean;
  completed?: boolean;
  // Extended properties for party expedition lifecycle
  lootResult?: PartyLootResult | null;
  endsAt?: Date;
  explorationIds?: number[];
}

