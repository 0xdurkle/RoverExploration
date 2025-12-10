import { getDb } from '../db/connection';

/**
 * Calculate longest exploration streak for a user
 * Streak = consecutive days with at least one completed exploration
 */
export async function getLongestStreak(userId: string): Promise<number> {
  const db = getDb();

  try {
    // Get all completed explorations ordered by date
    const result = await db.query(
      `SELECT DISTINCT DATE(ends_at) as exploration_date
       FROM explorations
       WHERE user_id = $1 AND completed = TRUE
       ORDER BY exploration_date ASC`,
      [userId]
    );

    if (result.rows.length === 0) return 0;

    const dates = result.rows.map((row) => new Date(row.exploration_date));
    
    if (dates.length === 0) return 0;

    let longestStreak = 1;
    let currentStreak = 1;

    for (let i = 1; i < dates.length; i++) {
      const prevDate = dates[i - 1];
      const currDate = dates[i];
      
      // Calculate days between
      const daysDiff = Math.floor(
        (currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff === 1) {
        // Consecutive day
        currentStreak++;
        longestStreak = Math.max(longestStreak, currentStreak);
      } else {
        // Streak broken
        currentStreak = 1;
      }
    }

    return longestStreak;
  } catch (error) {
    console.error('Error calculating streak:', error);
    return 0;
  }
}

