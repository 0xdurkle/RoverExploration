import { getDb } from './connection';

export interface Exploration {
  id: number;
  user_id: string;
  biome: string;
  duration_hours: number;
  started_at: Date;
  ends_at: Date;
  completed: boolean;
  item_found: ItemFound | null;
  created_at: Date;
}

export interface ItemFound {
  name: string;
  rarity: 'uncommon' | 'rare' | 'legendary' | 'epic';
  biome: string;
  found_at: Date;
}

export interface UserProfile {
  user_id: string;
  total_explorations: number;
  items_found: ItemFound[];
  last_exploration_end: Date | null;
  created_at: Date;
}

/**
 * Create a new exploration session
 */
export async function createExploration(
  userId: string,
  biome: string,
  durationHours: number
): Promise<Exploration> {
  const db = getDb();
  const startedAt = new Date();
  const endsAt = new Date(startedAt.getTime() + durationHours * 60 * 60 * 1000);

  const result = await db.query(
    `INSERT INTO explorations (user_id, biome, duration_hours, started_at, ends_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, biome, durationHours, startedAt, endsAt]
  );

  return result.rows[0];
}

/**
 * Get active exploration for a user
 */
export async function getActiveExploration(userId: string): Promise<Exploration | null> {
  const db = getDb();
  const now = new Date();

  const result = await db.query(
    `SELECT * FROM explorations
     WHERE user_id = $1 AND ends_at > $2 AND completed = FALSE
     ORDER BY ends_at DESC
     LIMIT 1`,
    [userId, now]
  );

  return result.rows[0] || null;
}

/**
 * Get all completed explorations that need processing
 */
export async function getCompletedExplorations(): Promise<Exploration[]> {
  const db = getDb();
  const now = new Date();

  const result = await db.query(
    `SELECT * FROM explorations
     WHERE ends_at <= $1 AND completed = FALSE
     ORDER BY ends_at ASC`,
    [now]
  );

  return result.rows;
}

/**
 * Mark exploration as completed and store item found
 */
export async function completeExploration(
  explorationId: number,
  itemFound: ItemFound | null
): Promise<void> {
  const db = getDb();

  await db.query(
    `UPDATE explorations
     SET completed = TRUE, item_found = $1
     WHERE id = $2`,
    [itemFound ? JSON.stringify(itemFound) : null, explorationId]
  );

  // Update user profile
  const exploration = await db.query(
    `SELECT user_id, ends_at FROM explorations WHERE id = $1`,
    [explorationId]
  );

  if (exploration.rows[0]) {
    const { user_id, ends_at } = exploration.rows[0];
    await updateUserProfile(user_id, ends_at, itemFound);
  }
}

/**
 * Update or create user profile
 */
async function updateUserProfile(
  userId: string,
  lastExplorationEnd: Date,
  itemFound: ItemFound | null
): Promise<void> {
  const db = getDb();

  // Check if profile exists
  const existing = await db.query(
    `SELECT * FROM user_profiles WHERE user_id = $1`,
    [userId]
  );

  if (existing.rows[0]) {
    // Update existing profile
    const itemsFound = existing.rows[0].items_found || [];
    if (itemFound) {
      itemsFound.push(itemFound);
    }

    await db.query(
      `UPDATE user_profiles
       SET total_explorations = total_explorations + 1,
           items_found = $1,
           last_exploration_end = $2
       WHERE user_id = $3`,
      [JSON.stringify(itemsFound), lastExplorationEnd, userId]
    );
  } else {
    // Create new profile
    const itemsFound = itemFound ? [itemFound] : [];

    await db.query(
      `INSERT INTO user_profiles (user_id, total_explorations, items_found, last_exploration_end)
       VALUES ($1, 1, $2, $3)`,
      [userId, JSON.stringify(itemsFound), lastExplorationEnd]
    );
  }
}

/**
 * Get user profile
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const db = getDb();

  const result = await db.query(
    `SELECT * FROM user_profiles WHERE user_id = $1`,
    [userId]
  );

  if (!result.rows[0]) {
    return null;
  }

  const profile = result.rows[0];
  return {
    ...profile,
    items_found: profile.items_found || [],
    last_exploration_end: profile.last_exploration_end || null,
  };
}
