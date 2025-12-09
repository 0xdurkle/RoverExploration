import { getActiveExploration } from '../db/models';

/**
 * Check if user has an active exploration (cooldown)
 * Returns time remaining in milliseconds, or null if no active exploration
 */
export async function getCooldownRemaining(userId: string): Promise<number | null> {
  const activeExploration = await getActiveExploration(userId);

  if (!activeExploration) {
    return null;
  }

  const now = new Date();
  const endsAt = new Date(activeExploration.ends_at);
  const remaining = endsAt.getTime() - now.getTime();

  return remaining > 0 ? remaining : 0;
}

/**
 * Format time remaining as human-readable string
 */
export function formatTimeRemaining(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}
