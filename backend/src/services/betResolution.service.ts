/**
 * Bet resolution service
 * Wraps the shared bet resolution logic for use in the backend
 */

// Import from root shared folder (relative path from backend/src/services)
// The shared folder is at the repo root level
const { resolveBet } = require('@shared/utils/betResolution');
const { SPORT_CONFIGS } = require('@shared/config/sports/basketball');

// Type import for TypeScript (using require for runtime)
import type { SportConfig } from '@shared/types/sports';

/**
 * Get sport config by sport key
 * Normalizes the sport key to lowercase for lookup since configs use lowercase keys
 */
function getSportConfig(sportKey: string): SportConfig {
  // Normalize to lowercase since SPORT_CONFIGS uses lowercase keys (e.g., 'basketball' not 'BASKETBALL')
  const normalizedKey = sportKey.toLowerCase();
  const config = SPORT_CONFIGS[normalizedKey];
  
  if (!config) {
    const availableSports = Object.keys(SPORT_CONFIGS).join(', ');
    throw new Error(`Sport config not found for: ${sportKey} (normalized: ${normalizedKey}). Available sports: ${availableSports}`);
  }
  
  return config;
}

/**
 * Extract live game information from ESPN API gameData using sport-specific config
 * This is called after bet resolution (even if it failed) to update game status and live info
 * Returns data ready to be saved to the database
 */
export function extractLiveGameInfo(
  gameData: any,
  sportConfig: SportConfig
): {
  status: string;
  homeScore: number | null;
  awayScore: number | null;
  period: number | null;
  displayClock: string | null;
  periodDisplay: string | null;
} {
  // Find the competition using the same logic as bet resolution
  // Try header.competitions first (sample file structure), then top-level competitions (API structure)
  const gameId = gameData?.id || gameData?.header?.id;
  const competitions = gameData?.header?.competitions || gameData?.competitions;
  
  if (!competitions || !Array.isArray(competitions)) {
    return {
      status: 'scheduled',
      homeScore: null,
      awayScore: null,
      period: null,
      displayClock: null,
      periodDisplay: null,
    };
  }

  // Find competition by matching id to game id (same as bet resolution)
  const competition = competitions.find((c: any) => String(c.id) === String(gameId)) || competitions[0];

  if (!competition) {
    return {
      status: 'scheduled',
      homeScore: null,
      awayScore: null,
      period: null,
      displayClock: null,
      periodDisplay: null,
    };
  }

  // Get status from competition
  const statusState = competition?.status?.type?.state || 'pre';
  
  // Map ESPN status to our status
  let status = 'scheduled';
  if (statusState === 'in') {
    status = 'in_progress';
  } else if (statusState === 'post' || statusState === 'final') {
    status = 'completed';
  } else if (statusState === 'pre') {
    status = 'scheduled';
  }

  // Get scores from competitors (same structure as bet resolution)
  const competitors = competition?.competitors || [];
  const homeTeam = competitors.find((c: any) => c.homeAway === 'home');
  const awayTeam = competitors.find((c: any) => c.homeAway === 'away');

  const homeScore = homeTeam?.score ? parseInt(homeTeam.score, 10) : null;
  const awayScore = awayTeam?.score ? parseInt(awayTeam.score, 10) : null;

  // Get period and clock information from competition status
  const statusInfo = competition?.status;
  const period = statusInfo?.period || null;
  // Try displayClock first, then shortDetail, then detail
  const displayClock = statusInfo?.displayClock || statusInfo?.type?.shortDetail || statusInfo?.type?.detail || null;

  // Format period display using sport-specific config
  let periodDisplay: string | null = null;
  if (status === 'completed') {
    periodDisplay = 'Final';
  } else if (status === 'in_progress' && period) {
    // Find period config by matching period number to time period value
    // ESPN period numbers map to our time period values (e.g., 1 = Q1, 2 = Q2)
    const periodConfig = sportConfig.time_periods.find(tp => {
      const tpValue = String(tp.value).toUpperCase();
      // Try to match period number to time period value
      // Q1, Q2, Q3, Q4 for quarters
      // H1, H2 for halves
      // OT for overtime
      if (tpValue === `Q${period}` || tpValue === `QUARTER_${period}`) {
        return true;
      }
      // For halves: period 1-2 might be H1, period 3-4 might be H2
      if (period <= 2 && (tpValue === 'H1' || tpValue === 'HALF_1')) {
        return true;
      }
      if (period > 2 && period <= 4 && (tpValue === 'H2' || tpValue === 'HALF_2')) {
        return true;
      }
      // Overtime periods (period > 4 for basketball/football)
      if (period > 4 && (tpValue === 'OT' || tpValue === 'OVERTIME')) {
        return true;
      }
      // Fallback: check if label contains the period number
      return tp.label.toLowerCase().includes(`${period}`);
    });
    
    const periodLabel = periodConfig?.label;
    
    if (displayClock) {
      periodDisplay = `${displayClock} ${periodLabel}`;
    } else {
      periodDisplay = periodLabel;
    }
  }

  return {
    status,
    homeScore,
    awayScore,
    period,
    displayClock,
    periodDisplay,
  };
}

export { resolveBet, getSportConfig };

