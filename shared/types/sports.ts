/**
 * Sport configuration types
 */

import { TimePeriod } from './bets';

export interface SportMetric {
  value: string;
  label: string;
  team: boolean;
  player: boolean;
  api_path_team?: string;
  api_path_player?: string;
  resolvable: boolean;
  endGameStatFetchKey?: string | ((gameData: any, subjectId: string, subjectType: 'TEAM' | 'PLAYER', period?: TimePeriod) => number | null);
}

export interface BetEndPointKey {
  path?: string; // JSON path to check, supports filtering with [filter:key=value] syntax
  expectedValue?: any; // Expected value when period is complete (e.g., true, "post")
  filter?: {
    arrayPath: string; // Path to the array to filter (e.g., "header.competitions")
    filterKey: string; // Key to filter by (e.g., "id")
    filterValuePath: string; // Path to get the filter value (e.g., "header.id")
  };
  // For play-by-play based checks (e.g., quarter endings)
  playByPlayCheck?: {
    eventTypeId: string; // e.g., "412" for "End Period"
    periodNumber: number; // e.g., 1 for Q1, 2 for Q2, etc.
  };
}

export interface SportConfig {
  sport_key: string;
  display_name: string;
  time_periods: Array<{
    value: TimePeriod;
    label: string;
    api_key: string;
    betEndPointKey?: BetEndPointKey;
  }>;
  metrics: SportMetric[];
  /**
   * Get the resolution UTC time for a specific time period
   * This determines when a bet for that period was actually resolved
   * @param gameData The full game data object
   * @param timePeriod The time period to get resolution time for
   * @returns The UTC Date when that period ended, or undefined if not found
   */
  getResolutionUTCTime?: (gameData: any, timePeriod: TimePeriod) => Date | undefined;
}

