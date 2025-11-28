/**
 * Parlay-related interfaces for the frontend
 */

import { BetSelection } from './bet';

export interface ParlaySelection {
  id: string;
  bet: {
    id: string;
    displayText: string;
    betType: string;
    config?: any;
  };
  selectedSide: string;
  status?: string;
  outcome?: string;
  game: {
    id: string;
    homeTeam: string;
    awayTeam: string;
    startTime: string;
    status?: string;
    sport?: string;
    homeScore?: number | null;
    awayScore?: number | null;
    metadata?: any;
  };
}

export interface Parlay {
  id: string;
  betCount: number;
  parlayValue: number;
  insured: boolean;
  insuranceCost: number;
  status: string;
  lockedAt?: string;
  resolvedAt?: string;
  selections: ParlaySelection[];
  createdAt: string;
}

