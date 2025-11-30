/**
 * Game-related interfaces for the frontend
 */

export interface Game {
  id: string;
  externalId?: string;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  status: string;
  homeScore?: number | null;
  awayScore?: number | null;
  metadata?: any;
}

export interface HistoricalGame extends Game {
  date: string;
  timestamp?: number;
  league?: {
    id: string;
    name: string;
    abbreviation: string;
  };
  teams?: {
    home: {
      id: string;
      name: string;
      abbreviation: string;
      displayName: string;
    };
    away: {
      id: string;
      name: string;
      abbreviation: string;
      displayName: string;
    };
  };
  scores?: {
    home: number | null;
    away: number | null;
  };
}

