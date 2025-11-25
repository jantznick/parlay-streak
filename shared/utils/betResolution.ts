/**
 * Bet resolution utilities
 * Pure functions for resolving bets from game data
 */

import { BetConfig, ComparisonConfig, Participant, TimePeriod } from '../types/bets';
import { SportConfig, BetEndPointKey } from '../config/sports/basketball';

export interface ResolutionResult {
  resolved: boolean;
  outcome?: 'win' | 'loss' | 'push' | 'void';
  resolutionEventTime?: Date;
  resolutionUTCTime?: Date;
  resolutionQuarter?: string;
  resolutionStatSnapshot?: object;
  reason?: string;
}

/**
 * Get a value from a nested object using a dot-notation path
 * Supports filtering arrays with filter parameter
 */
function getNestedValue(obj: any, path: string, filter?: { arrayPath: string; filterKey: string; filterValuePath: string }): any {
  console.log(`[getNestedValue] Looking up path: ${path}`, filter ? `with filter: ${JSON.stringify(filter)}` : '');
  
  // If we have a filter, apply it first
  if (filter) {
    const filterValue = getNestedValue(obj, filter.filterValuePath);
    console.log(`[getNestedValue] Filter value from ${filter.filterValuePath}: ${filterValue}`);
    
    const arrayPathParts = filter.arrayPath.split(/[\.\[\]]/).filter(p => p);
    let arrayObj = obj;
    for (const part of arrayPathParts) {
      if (arrayObj === null || arrayObj === undefined) {
        console.log(`[getNestedValue] Filter array path ${filter.arrayPath} failed at part "${part}"`);
        return undefined;
      }
      arrayObj = arrayObj[part];
    }
    
    if (!Array.isArray(arrayObj)) {
      console.log(`[getNestedValue] Filter array path ${filter.arrayPath} did not resolve to an array`);
      return undefined;
    }
    
    const filteredItem = arrayObj.find((item: any) => String(item[filter.filterKey]) === String(filterValue));
    if (!filteredItem) {
      console.log(`[getNestedValue] No item found in array matching ${filter.filterKey}=${filterValue}`);
      return undefined;
    }
    
    console.log(`[getNestedValue] Found filtered item with ${filter.filterKey}=${filterValue}`);
    
    // Now resolve the rest of the path relative to the filtered item
    // Remove the array path from the full path and resolve from filtered item
    const remainingPath = path.replace(filter.arrayPath + '.', '').replace(filter.arrayPath, '');
    if (remainingPath) {
      return getNestedValue(filteredItem, remainingPath);
    }
    return filteredItem;
  }
  
  // Normal path resolution
  const parts = path.split(/[\.\[\]]/).filter(p => p);
  let current = obj;
  
  for (const part of parts) {
    if (current === null || current === undefined) {
      console.log(`[getNestedValue] Path ${path} failed at part "${part}" - value is ${current}`);
      return undefined;
    }
    current = current[part];
  }
  
  console.log(`[getNestedValue] Path ${path} resolved to:`, current);
  return current;
}

/**
 * Check if a bet end point has been reached
 */
function checkBetEndPoint(gameData: any, betEndPointKey: BetEndPointKey): boolean {
  // If using play-by-play check (for quarter endings)
  if (betEndPointKey.playByPlayCheck) {
    const { eventTypeId, periodNumber } = betEndPointKey.playByPlayCheck;
    console.log(`[checkBetEndPoint] Checking play-by-play for eventTypeId=${eventTypeId}, periodNumber=${periodNumber}`);
    
    const plays = gameData?.plays;
    if (!plays || !Array.isArray(plays)) {
      console.log(`[checkBetEndPoint] ❌ No plays array found in gameData`);
      return false;
    }
    
    // Find if there's an "End Period" event for this quarter
    const endPeriodEvent = plays.find((play: any) => 
      play.type?.id === eventTypeId && 
      play.period?.number === periodNumber
    );
    
    const result = !!endPeriodEvent;
    console.log(`[checkBetEndPoint] Play-by-play check: ${result} (found end period event: ${!!endPeriodEvent})`);
    if (endPeriodEvent) {
      console.log(`[checkBetEndPoint] Found end period event:`, {
        id: endPeriodEvent.id,
        text: endPeriodEvent.text,
        wallclock: endPeriodEvent.wallclock,
        period: endPeriodEvent.period
      });
    }
    return result;
  }
  
  // Otherwise use path-based check
  if (!betEndPointKey.path) {
    console.log(`[checkBetEndPoint] ❌ No path or playByPlayCheck provided`);
    return false;
  }
  
  console.log(`[checkBetEndPoint] Checking path: ${betEndPointKey.path}, expected: ${JSON.stringify(betEndPointKey.expectedValue)}`);
  const value = getNestedValue(gameData, betEndPointKey.path, betEndPointKey.filter);
  
  if (betEndPointKey.expectedValue === 'exists') {
    const result = value !== undefined && value !== null;
    console.log(`[checkBetEndPoint] Path exists check: ${result} (value: ${JSON.stringify(value)})`);
    return result;
  }
  
  const result = value === betEndPointKey.expectedValue;
  console.log(`[checkBetEndPoint] Value comparison: ${result} (got: ${JSON.stringify(value)}, expected: ${JSON.stringify(betEndPointKey.expectedValue)})`);
  return result;
}

/**
 * Compare two IDs (handles both string and number)
 */
function compareIds(id1: string | number, id2: string | number): boolean {
  return String(id1) === String(id2);
}

/**
 * Get stat value for a participant
 */
function getParticipantStat(
  gameData: any,
  participant: Participant,
  sportConfig: SportConfig
): number | null {
  console.log(`[getParticipantStat] Getting stat for participant:`, {
    subject_type: participant.subject_type,
    subject_id: participant.subject_id,
    subject_name: participant.subject_name,
    metric: participant.metric,
    time_period: participant.time_period
  });
  
  const metric = sportConfig.metrics.find(m => m.value === participant.metric);
  if (!metric) {
    console.log(`[getParticipantStat] Metric "${participant.metric}" not found in sport config`);
    return null;
  }
  
  if (!metric.endGameStatFetchKey) {
    console.log(`[getParticipantStat] Metric "${participant.metric}" has no endGameStatFetchKey configured`);
    return null;
  }
  
  // If it's a function, call it
  if (typeof metric.endGameStatFetchKey === 'function') {
    console.log(`[getParticipantStat] Calling function for metric "${participant.metric}"`);
    const result = metric.endGameStatFetchKey(gameData, participant.subject_id, participant.subject_type, participant.time_period);
    console.log(`[getParticipantStat] Function returned: ${result}`);
    return result;
  }
  
  // Otherwise, treat it as a path
  console.log(`[getParticipantStat] Using path for metric "${participant.metric}": ${metric.endGameStatFetchKey}`);
  const result = getNestedValue(gameData, metric.endGameStatFetchKey);
  console.log(`[getParticipantStat] Path returned: ${result}`);
  return result;
}

/**
 * Resolve a comparison bet (moneyline, spread, etc.)
 */
function resolveComparisonBet(
  bet: ComparisonConfig,
  gameData: any,
  sportConfig: SportConfig
): ResolutionResult {
  console.log('\n[resolveComparisonBet] ===== Starting comparison bet resolution =====');
  console.log('[resolveComparisonBet] Bet config:', JSON.stringify(bet, null, 2));
  
  // Get bet end points for both participants
  const period1 = sportConfig.time_periods.find(tp => tp.value === bet.participant_1.time_period);
  const period2 = sportConfig.time_periods.find(tp => tp.value === bet.participant_2.time_period);
  
  console.log(`[resolveComparisonBet] Period 1 config:`, period1);
  console.log(`[resolveComparisonBet] Period 2 config:`, period2);
  
  if (!period1?.betEndPointKey || !period2?.betEndPointKey) {
    const reason = `Missing bet end point configuration for time periods: ${bet.participant_1.time_period}, ${bet.participant_2.time_period}`;
    console.log(`[resolveComparisonBet] ❌ ${reason}`);
    return {
      resolved: false,
      reason
    };
  }
  
  // Check if both periods have ended
  console.log(`[resolveComparisonBet] Checking if period 1 (${bet.participant_1.time_period}) is complete...`);
  const period1Complete = checkBetEndPoint(gameData, period1.betEndPointKey);
  console.log(`[resolveComparisonBet] Checking if period 2 (${bet.participant_2.time_period}) is complete...`);
  const period2Complete = checkBetEndPoint(gameData, period2.betEndPointKey);
  
  console.log(`[resolveComparisonBet] Period completion status: period1=${period1Complete}, period2=${period2Complete}`);
  
  if (!period1Complete || !period2Complete) {
    const reason = `Periods not complete: ${bet.participant_1.time_period}=${period1Complete}, ${bet.participant_2.time_period}=${period2Complete}`;
    console.log(`[resolveComparisonBet] ❌ ${reason}`);
    return {
      resolved: false,
      reason
    };
  }
  
  // Get stat values for both participants
  console.log(`[resolveComparisonBet] Extracting stat for participant 1...`);
  const stat1 = getParticipantStat(gameData, bet.participant_1, sportConfig);
  console.log(`[resolveComparisonBet] Extracting stat for participant 2...`);
  const stat2 = getParticipantStat(gameData, bet.participant_2, sportConfig);
  
  console.log(`[resolveComparisonBet] Extracted stats: participant_1=${stat1}, participant_2=${stat2}`);
  
  if (stat1 === null || stat2 === null) {
    const reason = `Could not extract stats: participant_1=${stat1}, participant_2=${stat2}`;
    console.log(`[resolveComparisonBet] ❌ ${reason}`);
    return {
      resolved: false,
      reason
    };
  }
  
  // Apply spread if exists
  let adjustedStat1 = stat1;
  let adjustedStat2 = stat2;
  
  if (bet.spread) {
    console.log(`[resolveComparisonBet] Applying spread: ${bet.spread.direction}${bet.spread.value}`);
    if (bet.spread.direction === '+') {
      adjustedStat1 += bet.spread.value;
    } else {
      adjustedStat1 -= bet.spread.value;
    }
    console.log(`[resolveComparisonBet] Adjusted stats: participant_1=${adjustedStat1} (was ${stat1}), participant_2=${adjustedStat2}`);
  }
  
  // Determine outcome based on operator
  let outcome: 'win' | 'loss' | 'push';
  
  console.log(`[resolveComparisonBet] Comparing with operator: ${bet.operator}`);
  console.log(`[resolveComparisonBet] Comparison: ${adjustedStat1} ${bet.operator} ${adjustedStat2}`);
  
  if (bet.operator === 'GREATER_THAN') {
    if (adjustedStat1 > adjustedStat2) {
      outcome = 'win';
    } else if (adjustedStat1 < adjustedStat2) {
      outcome = 'loss';
    } else {
      outcome = 'push';
    }
  } else if (bet.operator === 'GREATER_EQUAL') {
    if (adjustedStat1 >= adjustedStat2) {
      outcome = 'win';
    } else {
      outcome = 'loss';
    }
  } else {
    const reason = `Unsupported operator: ${bet.operator}`;
    console.log(`[resolveComparisonBet] ❌ ${reason}`);
    return {
      resolved: false,
      reason
    };
  }
  
  console.log(`[resolveComparisonBet] ✅ Outcome determined: ${outcome}`);
  
  // Get resolution event time and completion time from game data
  // Filter competition by matching id to header.id (same as we do for stat extraction)
  const headerId = gameData?.header?.id;
  const competition = gameData?.header?.competitions?.find((c: any) => String(c.id) === String(headerId));
  
  // resolutionEventTime: When the event (game/period) actually happened (start time for the period)
  const resolutionEventTime = competition?.date ? new Date(competition.date) : new Date();
  
  console.log(`[resolveComparisonBet] resolutionEventTime: ${resolutionEventTime.toISOString()}`);
  
  // resolutionUTCTime: When the event actually completed (end time)
  // Use meta.lastPlayWallClock which contains the UTC time of the last play (game end)
  let resolutionUTCTime: Date | undefined;
  
  if (gameData?.meta?.lastPlayWallClock) {
    resolutionUTCTime = new Date(gameData.meta.lastPlayWallClock);
    console.log(`[resolveComparisonBet] Found resolutionUTCTime from meta.lastPlayWallClock: ${gameData.meta.lastPlayWallClock} (UTC)`);
  } else {
    console.log(`[resolveComparisonBet] ⚠️  meta.lastPlayWallClock not found, using event date as fallback`);
    resolutionUTCTime = resolutionEventTime;
  }
  
  const result = {
    resolved: true,
    outcome,
    resolutionEventTime,
    resolutionUTCTime,
    resolutionQuarter: bet.participant_1.time_period,
    resolutionStatSnapshot: {
      participant_1: {
        stat: stat1,
        adjustedStat: adjustedStat1,
        metric: bet.participant_1.metric,
        time_period: bet.participant_1.time_period
      },
      participant_2: {
        stat: stat2,
        adjustedStat: adjustedStat2,
        metric: bet.participant_2.metric,
        time_period: bet.participant_2.time_period
      },
      operator: bet.operator,
      spread: bet.spread
    }
  };
  
  console.log(`[resolveComparisonBet] ===== Resolution complete =====\n`);
  return result;
}

/**
 * Main resolution function
 */
export function resolveBet(
  betConfig: BetConfig,
  gameData: any,
  sportConfig: SportConfig
): ResolutionResult {
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('[resolveBet] Starting bet resolution');
  console.log('[resolveBet] Bet type:', betConfig.type);
  console.log('[resolveBet] Sport config:', sportConfig.sport_key);
  console.log('═══════════════════════════════════════════════════════════\n');
  
  if (betConfig.type === 'COMPARISON') {
    return resolveComparisonBet(betConfig, gameData, sportConfig);
  }
  
  // TODO: Implement THRESHOLD and EVENT bet types
  const reason = `Bet type ${betConfig.type} not yet implemented`;
  console.log(`[resolveBet] ❌ ${reason}`);
  return {
    resolved: false,
    reason
  };
}

