/**
 * Sport configuration index
 * Central export for all sport configs and types
 */

import { TimePeriod } from '../../types/bets';
import { BASKETBALL_CONFIG } from './basketball';
import { HOCKEY_CONFIG } from './hockey';

// Export shared types
export interface SportMetric {
  value: string;
  label: string;
  team: boolean;
  player: boolean;
  api_path_team?: string;
  api_path_player?: string;
  resolvable: boolean;
  // Optional: restrict which time periods are available for this metric
  // If not specified, all time periods are available
  timePeriods?: TimePeriod[];
}

export interface SportConfig {
  sport_key: string;
  display_name: string;
  time_periods: Array<{
    value: TimePeriod;
    label: string;
    api_key: string;
  }>;
  metrics: SportMetric[];
}

// Export registry for all sports
export const SPORT_CONFIGS: Record<string, SportConfig> = {
  basketball: BASKETBALL_CONFIG,
  hockey: HOCKEY_CONFIG,
  // Add more sports here as they're implemented
};

