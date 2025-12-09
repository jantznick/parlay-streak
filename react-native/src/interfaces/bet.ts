/**
 * Bet-related interfaces for the mobile app
 */

export interface Bet {
  id: string;
  betType: string;
  displayText: string;
  priority: number;
  outcome?: string;
  config?: any;
  displayTextOverride?: string;
}

export interface BetSelection {
  id: string;
  betId: string;
  bet: Bet;
  selectedSide: string;
  status?: string;
  outcome?: string;
  game: {
    id: string;
    externalId?: string;
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

