/**
 * Shared TypeScript types for Parlay Streak
 * These types should match the Prisma schema
 */

export type GameStatus = 'scheduled' | 'in_progress' | 'completed' | 'postponed' | 'canceled';
export type BetOutcome = 'pending' | 'win' | 'loss' | 'push' | 'void';
export type ParlayStatus = 'building' | 'locked' | 'pending' | 'won' | 'lost' | 'resolution_failed';
export type BetType = 'moneyline' | 'spread' | 'over_under' | 'player_prop' | 'team_prop' | 'game_prop';
export type Sport = 'NBA' | 'NFL' | 'NHL' | 'MLB' | 'EPL' | 'Champions League';

export interface User {
  id: string;
  username: string;
  email: string;
  currentStreak: number;
  longestStreak: number;
  totalPointsEarned: number;
  insuranceLocked: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Game {
  id: string;
  externalId?: string;
  sport: Sport;
  homeTeam: string;
  awayTeam: string;
  startTime: Date;
  endTime?: Date;
  status: GameStatus;
  homeScore?: number;
  awayScore?: number;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface Bet {
  id: string;
  gameId: string;
  betType: BetType;
  description: string;
  betValue: string;
  outcome: BetOutcome;
  priority: number;
  resolvedAt?: Date;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
  game?: Game;
}

export interface Parlay {
  id: string;
  userId: string;
  betCount: number;
  parlayValue: number;
  insured: boolean;
  insuranceCost: number;
  status: ParlayStatus;
  lockedAt?: Date;
  resolvedAt?: Date;
  lastGameEndTime?: Date;
  createdAt: Date;
  updatedAt: Date;
  bets?: Bet[];
}

export interface StreakHistory {
  id: string;
  userId: string;
  parlayId?: string;
  oldStreak: number;
  newStreak: number;
  changeAmount: number;
  changeType: 'parlay_win' | 'parlay_loss' | 'insurance_deducted';
  createdAt: Date;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
  };
}

// Leaderboard types
export interface LeaderboardEntry {
  userId: string;
  username: string;
  value: number; // streak or points
  rank: number;
}

