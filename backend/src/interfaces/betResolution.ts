/**
 * Bet resolution service interfaces for the backend
 */

export type BetConfig = {
  type: 'COMPARISON' | 'THRESHOLD' | 'EVENT';
  [key: string]: any;
};

export type SportConfig = {
  sport_key: string;
  display_name: string;
  time_periods: Array<{
    value: any;
    label: string;
    api_key: string;
    betEndPointKey?: any;
  }>;
  metrics: any[];
  getResolutionUTCTime?: (gameData: any, timePeriod: any) => Date | undefined;
};

