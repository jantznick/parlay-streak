/**
 * Bet Resolution Service
 * 
 * Pure function that resolves bets based on game data.
 * No database access - fully testable.
 */

import { BetConfig, ComparisonConfig, ThresholdConfig, EventConfig, Participant, TimePeriod } from '../../../shared/types/bets';
import { logger } from '../utils/logger';
import { StatExtractionConfig } from '../../../shared/config/sports/basketball-data-paths';

// ESPN Boxscore API Response Types
export interface EspnBoxscore {
  boxscore: {
    teams: Array<{
      team: {
        id: string;
        displayName: string;
      };
      statistics: Array<{
        name: string;
        displayValue: string;
        abbreviation?: string;
        label?: string;
      }>;
    }>;
    players: Array<{
      team: {
        id: string;
      };
      statistics: Array<{
        keys: string[];
        athletes: Array<{
          athlete: {
            id: string;
            displayName: string;
          };
          stats: string[];
        }>;
      }>;
    }>;
  };
  // Competitors and status are at root level, not in boxscore
  competitors?: Array<{
    id?: string;
    team?: {
      id: string;
    };
    score?: string;
    linescores?: Array<{
      displayValue: string;
    }>;
  }>;
  statusType?: {
    state: string;
    completed: boolean;
    description: string;
  };
  plays?: Array<{
      id: string;
      period: {
        number: number;
        displayValue: string;
      };
      team?: {
        id: string;
      };
      participants?: Array<{
        athlete?: {
          id: string;
        };
      }>;
      scoringPlay?: boolean;
      scoreValue?: number;
      shootingPlay?: boolean;
      pointsAttempted?: number;
      shortDescription?: string;
      text?: string;
      type?: {
        id: string;
        text: string;
      };
      wallclock?: string;
    }>;
}

export interface ResolutionResult {
  resolved: boolean;
  outcome?: 'win' | 'loss' | 'push' | 'void';
  resolutionEventTime?: Date;
  resolutionUTCTime?: Date;
  resolutionQuarter?: string;
  resolutionStatSnapshot?: Record<string, any>;
  reason?: string;
}

/**
 * Main resolution function
 * Pure function: takes bet config, game data, and stat extraction config
 * Returns resolution result
 */
export function resolveBet(
  betConfig: BetConfig,
  gameData: EspnBoxscore,
  statExtractionConfig: Record<string, StatExtractionConfig>,
  getPeriodNumbers: (timePeriod: TimePeriod, gameData?: any) => number[]
): ResolutionResult {
  try {
    // Check if game/period is complete
    const periodCheck = checkPeriodComplete(betConfig, gameData, getPeriodNumbers);
    if (!periodCheck.complete) {
      return {
        resolved: false,
        reason: periodCheck.reason || 'Period not complete'
      };
    }

    // Extract stats and resolve based on bet type
    let outcome: 'win' | 'loss' | 'push' | 'void';
    let statSnapshot: Record<string, any> = {};

    if (betConfig.type === 'COMPARISON') {
      const result = resolveComparison(betConfig, gameData, statExtractionConfig, getPeriodNumbers);
      outcome = result.outcome;
      statSnapshot = result.statSnapshot;
    } else if (betConfig.type === 'THRESHOLD') {
      const result = resolveThreshold(betConfig, gameData, statExtractionConfig, getPeriodNumbers);
      outcome = result.outcome;
      statSnapshot = result.statSnapshot;
    } else if (betConfig.type === 'EVENT') {
      const result = resolveEvent(betConfig, gameData, statExtractionConfig, getPeriodNumbers);
      outcome = result.outcome;
      statSnapshot = result.statSnapshot;
    } else {
      return {
        resolved: false,
        reason: `Unknown bet type: ${(betConfig as any).type}`
      };
    }

    // Get resolution timing info
    const timing = getResolutionTiming(betConfig, gameData, getPeriodNumbers);

    return {
      resolved: true,
      outcome,
      resolutionEventTime: timing.eventTime,
      resolutionUTCTime: new Date(), // Current UTC time
      resolutionQuarter: timing.quarter,
      resolutionStatSnapshot: statSnapshot
    };
  } catch (error) {
    logger.error('Error resolving bet', { error, betConfig });
    return {
      resolved: false,
      reason: `Resolution error: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Check if the period/game required for the bet is complete
 */
function checkPeriodComplete(
  betConfig: BetConfig,
  gameData: EspnBoxscore,
  getPeriodNumbers: (timePeriod: TimePeriod, gameData?: any) => number[]
): { complete: boolean; reason?: string } {
  // Try to get status from statusType at root, or assume complete if we have plays
  const gameStatus = gameData.statusType;
  const hasPlays = gameData.plays && gameData.plays.length > 0;
  
  // If we have plays, we can assume the game has at least started
  // For a completed game file, we can assume it's complete
  if (!gameStatus && !hasPlays) {
    return { complete: false, reason: 'No game data found' };
  }
  
  // Get the time period from the bet config
  let timePeriod: TimePeriod;
  if (betConfig.type === 'COMPARISON') {
    timePeriod = betConfig.participant_1.time_period;
  } else if (betConfig.type === 'THRESHOLD') {
    timePeriod = betConfig.participant.time_period;
  } else {
    timePeriod = betConfig.time_period;
  }

  // Full game - check if game is complete
  if (timePeriod === 'FULL_GAME') {
    // If statusType says completed, or if we have plays (assume completed game file)
    if (gameStatus?.completed === true || gameStatus?.state === 'post' || hasPlays) {
      return { complete: true };
    }
    return { complete: false, reason: 'Game not complete' };
  }

  // Period-specific - check if period is complete
  // Use period numbers from config to check if period is complete
  const periodNumbers = getPeriodNumbers(timePeriod, gameData);
  if (periodNumbers.length > 0) {
    const competitor = gameData.competitors?.[0];
    
    // For multi-period bets (H1, H2), check if all required periods are complete
    const maxPeriodNumber = Math.max(...periodNumbers);
    
    // Check if linescores exist for all required periods
    if (competitor?.linescores && competitor.linescores.length >= maxPeriodNumber) {
      // All required periods are complete
      return { complete: true };
    }
    
    // Also check if game is complete (all periods done) or if we have plays
    if (gameStatus?.completed === true || hasPlays) {
      return { complete: true };
    }
    
    return { complete: false, reason: `Period ${timePeriod} not complete` };
  }

  return { complete: false, reason: `Unknown time period: ${timePeriod}` };
}

/**
 * Resolve COMPARISON bet (Moneyline, Spread, Player vs Player)
 */
function resolveComparison(
  config: ComparisonConfig,
  gameData: EspnBoxscore,
  statExtractionConfig: Record<string, StatExtractionConfig>,
  getPeriodNumbers: (timePeriod: TimePeriod, gameData?: any) => number[]
): { outcome: 'win' | 'loss' | 'push' | 'void'; statSnapshot: Record<string, any> } {
  const value1 = extractStatValue(config.participant_1, gameData, statExtractionConfig, getPeriodNumbers);
  const value2 = extractStatValue(config.participant_2, gameData, statExtractionConfig, getPeriodNumbers);

  const statSnapshot = {
    participant_1: {
      value: value1,
      participant: config.participant_1
    },
    participant_2: {
      value: value2,
      participant: config.participant_2
    }
  };

  if (value1 === null || value2 === null) {
    return { outcome: 'void', statSnapshot };
  }

  // Apply spread if exists
  let adjustedValue1 = value1;
  if (config.spread) {
    const spreadAmount = config.spread.direction === '+' 
      ? config.spread.value 
      : -config.spread.value;
    adjustedValue1 = value1 + spreadAmount;
    statSnapshot['spread'] = {
      direction: config.spread.direction,
      value: config.spread.value,
      adjusted_value_1: adjustedValue1
    };
  }

  // Compare values
  if (config.operator === 'GREATER_THAN') {
    if (adjustedValue1 > value2) {
      return { outcome: 'win', statSnapshot };
    } else if (adjustedValue1 < value2) {
      return { outcome: 'loss', statSnapshot };
    } else {
      // Exact tie - check if spread exists (shouldn't happen with half-point spreads)
      return { outcome: 'push', statSnapshot };
    }
  } else if (config.operator === 'GREATER_EQUAL') {
    if (adjustedValue1 >= value2) {
      return { outcome: 'win', statSnapshot };
    } else {
      return { outcome: 'loss', statSnapshot };
    }
  }

  return { outcome: 'void', statSnapshot };
}

/**
 * Resolve THRESHOLD bet (Over/Under)
 */
function resolveThreshold(
  config: ThresholdConfig,
  gameData: EspnBoxscore,
  statExtractionConfig: Record<string, StatExtractionConfig>,
  getPeriodNumbers: (timePeriod: TimePeriod, gameData?: any) => number[]
): { outcome: 'win' | 'loss' | 'push' | 'void'; statSnapshot: Record<string, any> } {
  const value = extractStatValue(config.participant, gameData, statExtractionConfig, getPeriodNumbers);

  const statSnapshot = {
    participant: {
      value,
      participant: config.participant
    },
    threshold: config.threshold,
    operator: config.operator
  };

  if (value === null) {
    return { outcome: 'void', statSnapshot };
  }

  if (config.operator === 'OVER') {
    if (value > config.threshold) {
      return { outcome: 'win', statSnapshot };
    } else if (value < config.threshold) {
      return { outcome: 'loss', statSnapshot };
    } else {
      // Exact match - push
      return { outcome: 'push', statSnapshot };
    }
  } else if (config.operator === 'UNDER') {
    if (value < config.threshold) {
      return { outcome: 'win', statSnapshot };
    } else if (value > config.threshold) {
      return { outcome: 'loss', statSnapshot };
    } else {
      // Exact match - push
      return { outcome: 'push', statSnapshot };
    }
  }

  return { outcome: 'void', statSnapshot };
}

/**
 * Resolve EVENT bet (Binary events)
 */
function resolveEvent(
  config: EventConfig,
  gameData: EspnBoxscore,
  statExtractionConfig: Record<string, StatExtractionConfig>,
  getPeriodNumbers: (timePeriod: TimePeriod, gameData?: any) => number[]
): { outcome: 'win' | 'loss' | 'push' | 'void'; statSnapshot: Record<string, any> } {
  const statSnapshot: Record<string, any> = {
    participant: config.participant,
    event_type: config.event_type
  };

  // For basketball, we'll implement common events
  // More events can be added as needed
  if (config.event_type === 'DOUBLE_DOUBLE') {
    const points = extractStatValue({ ...config.participant, metric: 'points' }, gameData, statExtractionConfig, getPeriodNumbers);
    const rebounds = extractStatValue({ ...config.participant, metric: 'rebounds' }, gameData, statExtractionConfig, getPeriodNumbers);
    const assists = extractStatValue({ ...config.participant, metric: 'assists' }, gameData, statExtractionConfig, getPeriodNumbers);

    statSnapshot['stats'] = { points, rebounds, assists };

    if (points === null || rebounds === null || assists === null) {
      return { outcome: 'void', statSnapshot };
    }

    // Double-double: at least 10 in two categories
    const categories = [points, rebounds, assists].filter(v => v >= 10);
    const hasDoubleDouble = categories.length >= 2;

    return {
      outcome: hasDoubleDouble ? 'win' : 'loss',
      statSnapshot
    };
  }

  if (config.event_type === 'TRIPLE_DOUBLE') {
    const points = extractStatValue({ ...config.participant, metric: 'points' }, gameData, statExtractionConfig, getPeriodNumbers);
    const rebounds = extractStatValue({ ...config.participant, metric: 'rebounds' }, gameData, statExtractionConfig, getPeriodNumbers);
    const assists = extractStatValue({ ...config.participant, metric: 'assists' }, gameData, statExtractionConfig, getPeriodNumbers);

    statSnapshot['stats'] = { points, rebounds, assists };

    if (points === null || rebounds === null || assists === null) {
      return { outcome: 'void', statSnapshot };
    }

    // Triple-double: at least 10 in three categories
    const hasTripleDouble = points >= 10 && rebounds >= 10 && assists >= 10;

    return {
      outcome: hasTripleDouble ? 'win' : 'loss',
      statSnapshot
    };
  }

  // For other event types, return void for now (can be implemented later)
  return { outcome: 'void', statSnapshot };
}


/**
 * Extract stat value for a participant from game data
 * Handles both full game stats (from boxscore) and period-specific stats (from play-by-play)
 */
function extractStatValue(
  participant: Participant,
  gameData: EspnBoxscore,
  statExtractionConfig: Record<string, StatExtractionConfig>,
  getPeriodNumbers: (timePeriod: TimePeriod, gameData?: any) => number[]
): number | null {
  const { subject_type, subject_id, metric, time_period } = participant;

  // For full game stats, use boxscore
  if (time_period === 'FULL_GAME') {
    if (subject_type === 'TEAM') {
      return extractTeamStat(subject_id, metric, gameData, statExtractionConfig);
    } else {
      return extractPlayerStat(subject_id, metric, gameData, statExtractionConfig);
    }
  }

  // For period-specific stats, use play-by-play
  return extractPeriodStat(participant, gameData, statExtractionConfig, getPeriodNumbers);
}

/**
 * Extract team stat from boxscore (full game only)
 * Uses config to determine where to find the stat
 */
function extractTeamStat(
  teamId: string,
  metric: string,
  gameData: EspnBoxscore,
  statExtractionConfig: Record<string, StatExtractionConfig>
): number | null {
  const config = statExtractionConfig[metric];
  if (!config?.boxscore?.team) {
    return null;
  }

  const boxscore = gameData.boxscore;
  const team = boxscore.teams?.find(t => t.team.id === teamId);
  
  if (!team) {
    return null;
  }

  const teamConfig = config.boxscore.team;

  // Special handling for points - use score from competitors or calculate from plays
  if (teamConfig.special === 'score') {
    // Try to get from competitors first
    const competitor = gameData.competitors?.find(c => 
      c.id === teamId || c.team?.id === teamId
    );
    if (competitor?.score) {
      return parseInt(competitor.score, 10);
    }
    
    // Fallback: calculate from plays if available
    if (gameData.plays && gameData.plays.length > 0) {
      return gameData.plays
        .filter(play => play.scoringPlay === true && play.team?.id === teamId)
        .reduce((sum, play) => sum + (play.scoreValue || 0), 0);
    }
    
    return null;
  }

  // Special handling for team goals against - sum all goalie goals against
  if (teamConfig.special === 'sum_goalie_goals_against') {
    const boxscore = gameData.boxscore;
    let totalGoalsAgainst = 0;
    
    // Find all goalies for this team and sum their goals against
    for (const team of boxscore.players || []) {
      if (team.team?.id !== teamId) {
        continue;
      }
      
      for (const statGroup of team.statistics || []) {
        // Only look at goalies stat group
        if ((statGroup as any).name !== 'goalies') {
          continue;
        }
        
        const keys = statGroup.keys || [];
        const goalsAgainstIndex = keys.indexOf('goalsAgainst');
        
        if (goalsAgainstIndex === -1) {
          continue;
        }
        
        for (const athlete of statGroup.athletes || []) {
          if (athlete.stats && athlete.stats[goalsAgainstIndex]) {
            const goalsAgainst = parseInt(athlete.stats[goalsAgainstIndex], 10) || 0;
            totalGoalsAgainst += goalsAgainst;
          }
        }
      }
    }
    
    return totalGoalsAgainst > 0 ? totalGoalsAgainst : null;
  }

  // Find stat in statistics array using config field name
  const fieldName = teamConfig.fieldName || metric;
  const stat = team.statistics?.find(s => 
    s.name === fieldName || s.name === fieldName.toLowerCase()
  );

  if (!stat) {
    return null;
  }

  // Parse the value (handles combined stats if needed)
  const value = parseStatValue(stat.displayValue, metric, teamConfig.combinedStatPart);
  return value;
}

/**
 * Extract player stat from boxscore (full game only)
 * Uses config to determine which key to use
 */
function extractPlayerStat(
  playerId: string,
  metric: string,
  gameData: EspnBoxscore,
  statExtractionConfig: Record<string, StatExtractionConfig>
): number | null {
  const config = statExtractionConfig[metric];
  if (!config?.boxscore?.player) {
    return null;
  }

  const boxscore = gameData.boxscore;
  const playerConfig = config.boxscore.player;
  const keyName = playerConfig.keyName || metric;
  const statGroupName = (playerConfig as any).statGroup; // For hockey: 'forwards' or 'goalies'
  
  // Find player in players array
  for (const team of boxscore.players || []) {
    for (const statGroup of team.statistics || []) {
      // For hockey, filter by stat group name if specified
      if (statGroupName && (statGroup as any).name !== statGroupName) {
        continue;
      }
      
      for (const athlete of statGroup.athletes || []) {
        if (athlete.athlete.id === playerId) {
          // Get stat index from keys array using config
          const keys = statGroup.keys || [];
          const statIndex = keys.indexOf(keyName);

          if (statIndex === -1 || !athlete.stats || !athlete.stats[statIndex]) {
            // For points in hockey, calculate from goals + assists if not directly available
            if (metric === 'points') {
              const goals = extractPlayerStat(playerId, 'goals', gameData, statExtractionConfig);
              const assists = extractPlayerStat(playerId, 'assists', gameData, statExtractionConfig);
              if (goals !== null && assists !== null) {
                return goals + assists;
              }
            }
            return null;
          }

          // Parse the stat value (handles combined stats if needed)
          const statValue = athlete.stats[statIndex];
          return parseStatValue(statValue, metric, playerConfig.combinedStatPart);
        }
      }
    }
  }

  return null;
}

/**
 * Extract period-specific stat from play-by-play data
 */
function extractPeriodStat(
  participant: Participant,
  gameData: EspnBoxscore,
  statExtractionConfig: Record<string, StatExtractionConfig>,
  getPeriodNumbers: (timePeriod: TimePeriod, gameData?: any) => number[]
): number | null {
  const { subject_type, subject_id, metric, time_period } = participant;
  const plays = gameData.plays || [];

  // Map time period to period numbers using config function (pass gameData for dynamic OT detection)
  const periodNumbers = getPeriodNumbers(time_period, gameData);
  if (periodNumbers.length === 0) {
    return null;
  }

  // Filter plays by period
  const periodPlays = plays.filter(play => 
    periodNumbers.includes(play.period?.number || 0)
  );

  if (subject_type === 'TEAM') {
    return extractTeamPeriodStat(subject_id, metric, periodPlays, gameData, statExtractionConfig);
  } else {
    return extractPlayerPeriodStat(subject_id, metric, periodPlays, gameData, statExtractionConfig);
  }
}

/**
 * Extract team period-specific stat from plays using config
 */
function extractTeamPeriodStat(
  teamId: string,
  metric: string,
  plays: any[],
  gameData: EspnBoxscore,
  statExtractionConfig: Record<string, StatExtractionConfig>
): number | null {
  const config = statExtractionConfig[metric];
  if (!config?.playByPlay) {
    return null;
  }

  const playConfig = config.playByPlay;
  
  // Get all team IDs to determine opponent (for steals/blocks)
  const teamIds = gameData.competitors?.map(c => c.id || c.team?.id).filter(Boolean) || [];
  const opponentId = teamIds.find(id => id !== teamId);

  // Filter plays based on config
  let filteredPlays = plays.filter(play => {
    // Apply all filters from config
    for (const filter of playConfig.filters) {
      const fieldValue = getNestedField(play, filter.field);
      const match = evaluateFilter(fieldValue, filter.value, filter.operator, filter.negate);
      if (!match) {
        return false;
      }
    }

    // Check team match
    if (playConfig.checkParticipantTeam) {
      // For steals/blocks, need to check participant's team
      if (play.participants && play.participants.length > (playConfig.participantIndex || 0)) {
        const participantId = play.participants[playConfig.participantIndex || 0]?.athlete?.id;
        if (!isPlayerOnTeam(participantId, teamId, gameData)) {
          return false;
        }
        // Also check that play.team is opponent (for steals/blocks)
        if (play.team?.id !== opponentId) {
          return false;
        }
      }
    } else {
      // Regular team check
      if (play.team?.id !== teamId) {
        return false;
      }
    }

    // Check participant index if specified
    if (playConfig.participantIndex !== undefined) {
      if (!play.participants || play.participants.length <= playConfig.participantIndex) {
        return false;
      }
    }

    return true;
  });

  // Apply extraction type
  if (playConfig.type === 'sum') {
    return filteredPlays.reduce((sum, play) => {
      const value = playConfig.sumField ? getNestedField(play, playConfig.sumField) : 0;
      return sum + (typeof value === 'number' ? value : 0);
    }, 0);
  } else if (playConfig.type === 'count') {
    return filteredPlays.length;
  }

  return null;
}

/**
 * Extract player period-specific stat from plays using config
 */
function extractPlayerPeriodStat(
  playerId: string,
  metric: string,
  plays: any[],
  gameData: EspnBoxscore,
  statExtractionConfig: Record<string, StatExtractionConfig>
): number | null {
  const config = statExtractionConfig[metric];
  if (!config?.playByPlay) {
    return null;
  }

  const playConfig = config.playByPlay;

  // Filter plays based on config
  let filteredPlays = plays.filter(play => {
    // Apply all filters from config
    for (const filter of playConfig.filters) {
      const fieldValue = getNestedField(play, filter.field);
      const match = evaluateFilter(fieldValue, filter.value, filter.operator, filter.negate);
      if (!match) {
        return false;
      }
    }

    // Check participant index matches player
    if (playConfig.participantIndex !== undefined) {
      if (!play.participants || play.participants.length <= playConfig.participantIndex) {
        return false;
      }
      const participantId = play.participants[playConfig.participantIndex]?.athlete?.id;
      if (participantId !== playerId) {
        return false;
      }
    } else {
      // Default to first participant
      if (!play.participants || play.participants.length === 0) {
        return false;
      }
      if (play.participants[0]?.athlete?.id !== playerId) {
        return false;
      }
    }

    return true;
  });

  // Apply extraction type
  if (playConfig.type === 'sum') {
    return filteredPlays.reduce((sum, play) => {
      const value = playConfig.sumField ? getNestedField(play, playConfig.sumField) : 0;
      return sum + (typeof value === 'number' ? value : 0);
    }, 0);
  } else if (playConfig.type === 'count') {
    return filteredPlays.length;
  }

  return null;
}

/**
 * Helper: Check if a player is on a specific team
 */
function isPlayerOnTeam(
  playerId: string | undefined,
  teamId: string,
  gameData: EspnBoxscore
): boolean {
  if (!playerId) return false;

  const boxscore = gameData.boxscore;
  for (const team of boxscore.players || []) {
    if (team.team.id === teamId) {
      for (const statGroup of team.statistics || []) {
        for (const athlete of statGroup.athletes || []) {
          if (athlete.athlete.id === playerId) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

/**
 * Helper: Get nested field value from object using dot notation
 */
function getNestedField(obj: any, path: string): any {
  const parts = path.split('.');
  let value = obj;
  for (const part of parts) {
    if (value === null || value === undefined) {
      return undefined;
    }
    value = value[part];
  }
  return value;
}

/**
 * Helper: Evaluate a filter condition
 */
function evaluateFilter(
  fieldValue: any,
  expectedValue: any,
  operator?: string,
  negate?: boolean
): boolean {
  let result = false;

  switch (operator) {
    case 'equals':
      if (Array.isArray(expectedValue)) {
        result = expectedValue.includes(fieldValue);
      } else {
        result = fieldValue === expectedValue;
      }
      break;
    case 'includes':
      if (typeof fieldValue === 'string' && typeof expectedValue === 'string') {
        result = fieldValue.toLowerCase().includes(expectedValue.toLowerCase());
      }
      break;
    case 'startsWith':
      if (typeof fieldValue === 'string' && typeof expectedValue === 'string') {
        result = fieldValue.startsWith(expectedValue);
      }
      break;
    case 'greaterThan':
      result = Number(fieldValue) > Number(expectedValue);
      break;
    case 'lessThan':
      result = Number(fieldValue) < Number(expectedValue);
      break;
    default:
      // Default to equals
      result = fieldValue === expectedValue;
  }

  return negate ? !result : result;
}

/**
 * Helper: Parse stat value from display string
 */
function parseStatValue(
  displayValue: string, 
  metric: string, 
  combinedStatPart?: 'first' | 'second'
): number | null {
  if (!displayValue) return null;

  // Handle combined stats like "49-88" (made-attempted)
  if (displayValue.includes('-')) {
    const parts = displayValue.split('-');
    if (combinedStatPart === 'first') {
      return parseInt(parts[0], 10) || null;
    } else if (combinedStatPart === 'second') {
      return parseInt(parts[1], 10) || null;
    }
    // Fallback to old logic if combinedStatPart not provided
    if (metric === 'field_goals_made' || 
        metric === 'three_pointers_made' || 
        metric === 'free_throws_made') {
      return parseInt(parts[0], 10) || null;
    } else if (metric === 'field_goals_attempted' || 
               metric === 'three_pointers_attempted' || 
               metric === 'free_throws_attempted') {
      return parseInt(parts[1], 10) || null;
    }
  }

  // Parse regular number
  const parsed = parseInt(displayValue, 10);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Helper: Get quarter numbers for a time period
 */

/**
 * Helper: Get resolution timing info
 */
function getResolutionTiming(
  betConfig: BetConfig,
  gameData: EspnBoxscore,
  getPeriodNumbers: (timePeriod: TimePeriod, gameData?: any) => number[]
): { eventTime?: Date; quarter?: string } {
  // Get time period
  let timePeriod: TimePeriod;
  if (betConfig.type === 'COMPARISON') {
    timePeriod = betConfig.participant_1.time_period;
  } else if (betConfig.type === 'THRESHOLD') {
    timePeriod = betConfig.participant.time_period;
  } else {
    timePeriod = betConfig.time_period;
  }

  // Get last play in the period for event time
  const plays = gameData.plays || [];
  const periodNumbers = getPeriodNumbers(timePeriod, gameData);
  
  if (periodNumbers.length > 0) {
    const periodPlays = plays.filter(play => 
      periodNumbers.includes(play.period?.number || 0)
    );
    
    if (periodPlays.length > 0) {
      const lastPlay = periodPlays[periodPlays.length - 1];
      if (lastPlay.wallclock) {
        return {
          eventTime: new Date(lastPlay.wallclock),
          quarter: lastPlay.period?.displayValue || timePeriod
        };
      }
    }
  }

  // Fallback to game completion time
  return {
    quarter: timePeriod
  };
}

