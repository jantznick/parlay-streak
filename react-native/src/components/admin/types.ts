export interface Game {
  id: string;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  metadata?: any;
}

export interface Player {
  id: string;
  displayName?: string;
  fullName?: string;
  jersey?: string;
  jerseyNumber?: string;
  position?: {
    displayName?: string;
    name?: string;
    abbreviation?: string;
  };
  team: 'home' | 'away';
}

export type SubjectType = 'TEAM' | 'PLAYER';

