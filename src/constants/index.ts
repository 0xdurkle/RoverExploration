/**
 * Application-wide constants
 */

// Exploration duration constants
export const DURATION_30_SECONDS_HOURS = 0.008333; // 30 seconds in hours
export const HOURS_TO_MILLISECONDS = 60 * 60 * 1000;

// Party constants
export const MAX_PARTY_SIZE = 5;
export const PARTY_JOIN_TIMEOUT_MS = 60000; // 60 seconds
export const PARTY_CLEANUP_DELAY_MS = 300000; // 5 minutes

// Floating point comparison tolerance
export const FLOAT_COMPARISON_TOLERANCE = 0.0001;

// Rarity order for sorting
export const RARITY_ORDER: Record<string, number> = {
  legendary: 0,
  rare: 1,
  uncommon: 2,
};

// Test probabilities for 30-second explorations
export const TEST_PROBABILITIES = {
  uncommon: 0.25, // 25%
  rare: 0.125, // 12.5%
  legendary: 0.05, // 5%
};

