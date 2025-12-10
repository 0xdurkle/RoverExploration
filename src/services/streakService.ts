import { getDb } from '../db/connection';

/**
 * Calculate current exploration streak for a user
 * Current streak = consecutive days ending with today or most recent exploration
 */
export async function getCurrentStreak(userId: string): Promise<number> {
  const db = getDb();

  try {
    // Get all completed explorations ordered by date (most recent first)
    const result = await db.query(
      `SELECT DISTINCT DATE(ends_at) as exploration_date
       FROM explorations
       WHERE user_id = $1 AND completed = TRUE
       ORDER BY exploration_date DESC`,
      [userId]
    );

    if (result.rows.length === 0) return 0;

    const dates = result.rows.map((row) => new Date(row.exploration_date));
    
    if (dates.length === 0) return 0;

    // Get today's date (normalized to midnight)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get most recent exploration date
    const mostRecentDate = dates[0];
    mostRecentDate.setHours(0, 0, 0, 0);
    
    // If most recent exploration is not today or yesterday, streak is broken
    const daysSinceLast = Math.floor(
      (today.getTime() - mostRecentDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysSinceLast > 1) {
      // Streak is broken (more than 1 day since last exploration)
      return 0;
    }

    // Calculate current streak from most recent date backwards
    let currentStreak = 1;
    let expectedDate = new Date(mostRecentDate);
    
    for (let i = 1; i < dates.length; i++) {
      const prevDate = new Date(dates[i]);
      prevDate.setHours(0, 0, 0, 0);
      
      // Calculate days between
      const daysDiff = Math.floor(
        (expectedDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysDiff === 1) {
        // Consecutive day
        currentStreak++;
        expectedDate = prevDate;
      } else {
        // Streak broken
        break;
      }
    }

    return currentStreak;
  } catch (error) {
    console.error('Error calculating current streak:', error);
    return 0;
  }
}

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

