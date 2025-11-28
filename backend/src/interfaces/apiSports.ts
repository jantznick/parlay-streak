/**
 * API Sports service interfaces for the backend
 * ESPN API response types
 */

export interface EspnEvent {
  id: string;
  uid: string;
  date: string;
  name: string;
  shortName: string;
  status: {
    type: {
      id: string;
      name: string;
      state: string;
      completed: boolean;
      description: string;
      detail: string;
      shortDetail: string;
    };
    period: number;
    displayClock: string;
    clock: number;
  };
  competitions: Array<{
    id: string;
    date: string;
    attendance: number;
    type: {
      id: string;
      abbreviation: string;
    };
    timeValid: boolean;
    neutralSite: boolean;
    conferenceCompetition: boolean;
    playByPlayAvailable: boolean;
    recent: boolean;
    venue: {
      id: string;
      fullName: string;
      address: {
        city: string;
        state: string;
      };
    };
    competitors: Array<{
      id: string;
      uid: string;
      type: string;
      order: number;
      homeAway: 'home' | 'away';
      team: {
        id: string;
        uid: string;
        location: string;
        name: string;
        abbreviation: string;
        displayName: string;
        shortDisplayName: string;
        color: string;
        alternateColor: string;
        isActive: boolean;
        venue: {
          id: string;
        };
        links: Array<{
          rel: string[];
          href: string;
          text: string;
        }>;
      };
      score: string;
      linescores?: Array<{
        value: number;
      }>;
      statistics: any[];
      records: Array<{
        name: string;
        abbreviation?: string;
        type: string;
        summary: string;
      }>;
    }>;
    notes: any[];
    status: {
      type: {
        id: string;
        name: string;
        state: string;
        completed: boolean;
        description: string;
        detail: string;
        shortDetail: string;
      };
    };
    broadcasts: Array<{
      market: {
        id: string;
        type: string;
      };
      media: {
        shortName: string;
      };
      names: string[];
    }>;
    leaders?: any[];
    format: {
      regulation: {
        periods: number;
      };
    };
    startDate: string;
    geoBroadcasts: any[];
    headlines?: any[];
  }>;
  links: Array<{
    language: string;
    rel: string[];
    href: string;
    text: string;
    shortText?: string;
    isExternal: boolean;
    isPremium: boolean;
  }>;
  weather?: any;
}

export interface EspnLeague {
  id: string;
  uid: string;
  name: string;
  abbreviation: string;
  shortName: string;
  slug: string;
  events: EspnEvent[];
}

export interface EspnApiResponse {
  leagues: EspnLeague[];
}

export interface ApiSportsGame {
  id: string;
  externalId: string;
  date: string;
  timestamp: number;
  status: string;
  sport: string;
  league: {
    id: string;
    name: string;
    abbreviation: string;
  };
  teams: {
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
  scores: {
    home: number | null;
    away: number | null;
  };
  metadata: any;
}

