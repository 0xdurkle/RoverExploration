/**
 * Party expedition service
 * Manages party state and party bonuses
 */

import { Party, PartyMember } from '../types/party';
import { getBiome } from './rng';

// Store active parties in memory (auto-cleanup after completion)
const activeParties = new Map<string, Party>();

const MAX_PARTY_SIZE = 5;
const PARTY_JOIN_TIMEOUT_MS = 60000; // 60 seconds

/**
 * Create a new party
 */
export function createParty(
  creatorId: string,
  biomeId: string,
  durationHours: number,
  durationText: string,
  messageId: string,
  channelId: string
): Party {
  const biome = getBiome(biomeId);
  if (!biome) {
    throw new Error(`Invalid biome: ${biomeId}`);
  }

  const partyId = `${creatorId}_${Date.now()}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + PARTY_JOIN_TIMEOUT_MS);

  const party: Party = {
    id: partyId,
    creatorId,
    biome: biomeId,
    biomeName: biome.name,
    durationHours,
    durationText,
    joinedUsers: [{ userId: creatorId, joinedAt: now }],
    createdAt: now,
    expiresAt,
    messageId,
    channelId,
    started: false,
  };

  activeParties.set(partyId, party);
  return party;
}

/**
 * Get party by ID
 */
export function getParty(partyId: string): Party | undefined {
  return activeParties.get(partyId);
}

/**
 * Get party by message ID
 */
export function getPartyByMessageId(messageId: string): Party | undefined {
  for (const party of activeParties.values()) {
    if (party.messageId === messageId) {
      return party;
    }
  }
  return undefined;
}

/**
 * Join a party
 */
export function joinParty(partyId: string, userId: string): { success: boolean; message: string; party?: Party } {
  const party = activeParties.get(partyId);

  if (!party) {
    return { success: false, message: '❌ This party no longer exists or has already started.' };
  }

  if (party.started) {
    return { success: false, message: '❌ This expedition has already departed!' };
  }

  if (Date.now() > party.expiresAt.getTime()) {
    return { success: false, message: '❌ The join window has closed. This expedition is departing!' };
  }

  // Check if user already joined
  if (party.joinedUsers.some((member) => member.userId === userId)) {
    return { success: false, message: '❌ You have already joined this party!' };
  }

  // Check party size
  if (party.joinedUsers.length >= MAX_PARTY_SIZE) {
    return { success: false, message: `❌ Party is full! Maximum ${MAX_PARTY_SIZE} explorers.` };
  }

  // Add user to party
  party.joinedUsers.push({ userId, joinedAt: new Date() });
  activeParties.set(partyId, party);

  return { success: true, message: '✅ You joined the party!', party };
}

/**
 * Check if party is expired and should start
 */
export function isPartyExpired(party: Party): boolean {
  return Date.now() >= party.expiresAt.getTime();
}

/**
 * Mark party as started
 */
export function startParty(partyId: string): void {
  const party = activeParties.get(partyId);
  if (party) {
    party.started = true;
    activeParties.set(partyId, party);
  }
}

/**
 * Remove completed party
 */
export function removeParty(partyId: string): void {
  activeParties.delete(partyId);
}

/**
 * Get all expired parties that need to start
 */
export function getExpiredParties(): Party[] {
  const now = Date.now();
  return Array.from(activeParties.values()).filter(
    (party) => !party.started && now >= party.expiresAt.getTime()
  );
}

/**
 * Cleanup old completed parties (older than 1 hour)
 */
export function cleanupOldParties(): void {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  for (const [partyId, party] of activeParties.entries()) {
    if (party.completed && party.createdAt.getTime() < oneHourAgo) {
      activeParties.delete(partyId);
    }
  }
}

/**
 * Calculate party bonuses based on party size
 * Each additional person (beyond creator) adds:
 * - +1% base to all rarities
 * - +1% uncommon
 * - +0.5% rare
 * - +0.25% legendary
 */
export function calculatePartyBonus(partySize: number, rarity: string): number {
  // Additional members = partySize - 1 (excluding creator)
  const additionalMembers = Math.max(0, partySize - 1);
  const maxAdditional = 4; // Max 5 total = 4 additional
  const effectiveAdditional = Math.min(additionalMembers, maxAdditional);

  if (effectiveAdditional === 0) {
    return 0; // No bonus if only creator
  }

  // Base bonus: +1% per additional member (applies to all rarities)
  const baseBonus = effectiveAdditional * 0.01;

  // Rarity-specific bonuses
  const rarityBonuses: Record<string, number> = {
    uncommon: 0.01, // +1% per additional member
    rare: 0.005, // +0.5% per additional member
    legendary: 0.0025, // +0.25% per additional member
  };

  const rarityBonus = (rarityBonuses[rarity.toLowerCase()] || 0) * effectiveAdditional;

  return baseBonus + rarityBonus;
}

/**
 * Apply party bonuses to base probability
 */
export function applyPartyBonus(baseProbability: number, rarity: string, partySize: number): number {
  const bonus = calculatePartyBonus(partySize, rarity);
  return baseProbability + bonus;
}

