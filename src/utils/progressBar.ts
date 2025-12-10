/**
 * Generate a text-based progress bar
 */

export function generateProgressBar(current: number, total: number, length: number = 10): string {
  if (total === 0) {
    return '░'.repeat(length);
  }

  const filled = Math.round((current / total) * length);
  const empty = length - filled;

  return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Calculate percentage
 */
export function calculatePercentage(current: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((current / total) * 100);
}

