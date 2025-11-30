/**
 * Bet resolution types
 */

export interface ResolutionResult {
  resolved: boolean;
  outcome?: 'win' | 'loss' | 'push' | 'void';
  resolutionEventTime?: Date;
  resolutionUTCTime?: Date;
  resolutionQuarter?: string;
  resolutionStatSnapshot?: object;
  reason?: string;
}

