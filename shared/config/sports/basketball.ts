/**
 * Basketball sport configuration
 * Defines available metrics, time periods, and bet templates
 */

import { TimePeriod } from '../../types/bets';

export interface SportMetric {
  value: string;
  label: string;
  team: boolean;
  player: boolean;
  api_path_team?: string;
  api_path_player?: string;
  resolvable: boolean;
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

export const BASKETBALL_CONFIG: SportConfig = {
  sport_key: 'basketball',
  display_name: 'Basketball',
  
  time_periods: [
    { value: 'FULL_GAME', label: 'Full Game', api_key: 'game' },
    { value: 'Q1', label: '1st Quarter', api_key: 'quarter_1' },
    { value: 'Q2', label: '2nd Quarter', api_key: 'quarter_2' },
    { value: 'Q3', label: '3rd Quarter', api_key: 'quarter_3' },
    { value: 'Q4', label: '4th Quarter', api_key: 'quarter_4' },
    { value: 'H1', label: '1st Half', api_key: 'half_1' },
    { value: 'H2', label: '2nd Half', api_key: 'half_2' },
    { value: 'OT', label: 'Overtime', api_key: 'overtime' },
  ],
  
  metrics: [
    {
      value: 'points',
      label: 'Points',
      team: true,
      player: true,
      resolvable: true
    },
    {
      value: 'rebounds',
      label: 'Rebounds',
      team: true,
      player: true,
      resolvable: true
    },
    {
      value: 'assists',
      label: 'Assists',
      team: true,
      player: true,
      resolvable: true
    },
    {
      value: 'steals',
      label: 'Steals',
      team: true,
      player: true,
      resolvable: true
    },
    {
      value: 'blocks',
      label: 'Blocks',
      team: true,
      player: true,
      resolvable: true
    },
    {
      value: 'turnovers',
      label: 'Turnovers',
      team: true,
      player: true,
      resolvable: true
    },
    {
      value: 'field_goals_made',
      label: 'Field Goals Made',
      team: true,
      player: true,
      resolvable: true
    },
    {
      value: 'field_goals_attempted',
      label: 'Field Goals Attempted',
      team: true,
      player: true,
      resolvable: true
    },
    {
      value: 'three_pointers_made',
      label: '3-Pointers Made',
      team: true,
      player: true,
      resolvable: true
    },
    {
      value: 'free_throws_made',
      label: 'Free Throws Made',
      team: true,
      player: true,
      resolvable: true
    },
  ]
};

// Export registry for all sports
export const SPORT_CONFIGS: Record<string, SportConfig> = {
  basketball: BASKETBALL_CONFIG,
  // Add more sports here as they're implemented
};

