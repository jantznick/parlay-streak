import type { Parlay } from './parlay';
import type { BetSelection } from './bet';

export interface StreakEvent {
  id: string;
  type: 'parlay_win' | 'parlay_loss' | 'insurance_deducted' | 'bet_win' | 'bet_loss';
  pointsChange: number;
  resultingStreak: number;
  date: string;
  parlay?: Parlay; 
  betSelection?: BetSelection; // Use proper type
}

export interface StreakGroup {
  id: string;
  status: 'active' | 'ended';
  peakStreak: number;
  startDate: string;
  endDate?: string; // undefined if active
  finalStreak: number; // 0 if lost, current if active
  events: StreakEvent[];
}

