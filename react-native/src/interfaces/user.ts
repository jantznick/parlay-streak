/**
 * User-related interfaces for the mobile app
 */

export interface User {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
  currentStreak: number;
  longestStreak: number;
  totalPointsEarned: number;
  insuranceLocked: boolean;
  leaderboardRank?: number;
  isAdmin?: boolean;
}

