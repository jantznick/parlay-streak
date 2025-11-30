/**
 * Basketball sport configuration
 * Defines available metrics, time periods, and bet templates
 */

import { TimePeriod } from '../../types/bets';
import type { SportMetric, BetEndPointKey, SportConfig } from '../../types/sports';

// Re-export types for backward compatibility
export type { SportMetric, BetEndPointKey, SportConfig } from '../../types/sports';

/**
 * Helper function to extract player stat from boxscore (full game only)
 */
function getPlayerStat(gameData: any, playerId: string, statKey: string): number | null {
  const playerGroup = gameData?.boxscore?.players?.find((p: any) => {
    const stats = p.statistics?.[0];
    if (!stats || !stats.athletes) return false;
    return stats.athletes.some((a: any) => String(a.athlete?.id) === String(playerId));
  });
  
  if (!playerGroup) {
    return null;
  }
  
  const stats = playerGroup.statistics?.[0];
  if (!stats || !stats.athletes) {
    return null;
  }
  
  const athlete = stats.athletes.find((a: any) => String(a.athlete?.id) === String(playerId));
  if (!athlete || !athlete.stats) {
    return null;
  }
  
  const statIndex = stats.keys?.indexOf(statKey);
  if (statIndex === -1 || athlete.stats[statIndex] === undefined) {
    return null;
  }
  
  // Handle compound stats like "fieldGoalsMade-fieldGoalsAttempted" - extract first part
  if (statKey.includes('-')) {
    const value = athlete.stats[statIndex];
    if (typeof value === 'string' && value.includes('-')) {
      return parseInt(value.split('-')[0]);
    }
  }
  
  return parseInt(athlete.stats[statIndex]);
}

/**
 * Helper function to filter plays by period(s)
 * @param plays Array of play objects
 * @param period TimePeriod to filter by (Q1, Q2, H1, etc.)
 * @returns Filtered array of plays for the specified period
 */
function filterPlaysByPeriod(plays: any[], period: TimePeriod): any[] {
  if (!plays || !Array.isArray(plays)) {
    return [];
  }

  // Map period to period numbers
  let periodNumbers: number[] = [];
  
  switch (period) {
    case 'Q1':
      periodNumbers = [1];
      break;
    case 'Q2':
      periodNumbers = [2];
      break;
    case 'Q3':
      periodNumbers = [3];
      break;
    case 'Q4':
      periodNumbers = [4];
      break;
    case 'H1':
      periodNumbers = [1, 2]; // First half = Q1 + Q2
      break;
    case 'H2':
      periodNumbers = [3, 4]; // Second half = Q3 + Q4
      break;
    case 'OT':
      // Overtime periods start at 5
      periodNumbers = plays
        .map(p => p.period?.number)
        .filter((num): num is number => num !== undefined && num >= 5)
        .filter((num, index, arr) => arr.indexOf(num) === index); // unique values
      break;
    case 'FULL_GAME':
      // Return all plays
      return plays;
    default:
      return [];
  }

  return plays.filter(play => {
    const playPeriod = play.period?.number;
    return playPeriod !== undefined && periodNumbers.includes(playPeriod);
  });
}

/**
 * Helper function to calculate period-specific player stat from play-by-play
 * @param gameData Full game data object
 * @param playerId Player ID to calculate stats for
 * @param statKey Stat to calculate ('points', 'rebounds', 'assists', 'steals', 'blocks', 'turnovers')
 * @param period TimePeriod to filter by
 * @returns Accumulated stat value for the period, or null if unable to calculate
 */
function getPlayerStatFromPlays(
  gameData: any,
  playerId: string,
  statKey: string,
  period: TimePeriod
): number | null {
  console.log(`[getPlayerStatFromPlays] Calculating ${statKey} for player ${playerId} in period ${period}`);
  
  const plays = gameData?.plays;
  if (!plays || !Array.isArray(plays)) {
    console.log(`[getPlayerStatFromPlays] ❌ No plays array found`);
    return null;
  }

  // Filter plays by period
  const periodPlays = filterPlaysByPeriod(plays, period);
  console.log(`[getPlayerStatFromPlays] Found ${periodPlays.length} plays for period ${period}`);

  let total = 0;

  for (const play of periodPlays) {
    const participants = play.participants || [];
    if (participants.length === 0) continue;

    const playerIdStr = String(playerId);

    switch (statKey) {
      case 'points':
        // Points: Check if this is a scoring play and the first participant is our player
        if (play.scoringPlay && play.scoreValue > 0) {
          const scorer = participants[0]?.athlete?.id;
          if (String(scorer) === playerIdStr) {
            total += play.scoreValue || 0;
            console.log(`[getPlayerStatFromPlays] +${play.scoreValue} points for player ${playerId}`);
          }
        }
        break;

      case 'rebounds':
        // Rebounds: Type 155 = Defensive Rebound, Type 156 = Offensive Rebound
        const reboundTypeId = play.type?.id;
        if (reboundTypeId === '155' || reboundTypeId === '156') {
          const rebounder = participants[0]?.athlete?.id;
          if (String(rebounder) === playerIdStr) {
            total += 1;
            console.log(`[getPlayerStatFromPlays] +1 rebound for player ${playerId} (${play.type?.text})`);
          }
        }
        break;

      case 'assists':
        // Assists: Second participant in scoring plays (when text mentions "assists")
        if (play.scoringPlay && play.text && play.text.toLowerCase().includes('assists')) {
          if (participants.length >= 2) {
            const assister = participants[1]?.athlete?.id;
            if (String(assister) === playerIdStr) {
              total += 1;
              console.log(`[getPlayerStatFromPlays] +1 assist for player ${playerId}`);
            }
          }
        }
        break;

      case 'steals':
        // Steals: Look for "steal" in text or specific type ID
        if (play.text && play.text.toLowerCase().includes('steal')) {
          // The player who steals is typically the first participant
          const stealer = participants[0]?.athlete?.id;
          if (String(stealer) === playerIdStr) {
            total += 1;
            console.log(`[getPlayerStatFromPlays] +1 steal for player ${playerId}`);
          }
        }
        break;

      case 'blocks':
        // Blocks: Look for "blocks" in text
        if (play.text && play.text.toLowerCase().includes('blocks')) {
          // The blocker is typically the first participant
          const blocker = participants[0]?.athlete?.id;
          if (String(blocker) === playerIdStr) {
            total += 1;
            console.log(`[getPlayerStatFromPlays] +1 block for player ${playerId}`);
          }
        }
        break;

      case 'turnovers':
        // Turnovers: Look for "turnover" in text
        if (play.text && play.text.toLowerCase().includes('turnover')) {
          // The player who turned it over is typically the first participant
          const turnoverPlayer = participants[0]?.athlete?.id;
          if (String(turnoverPlayer) === playerIdStr) {
            total += 1;
            console.log(`[getPlayerStatFromPlays] +1 turnover for player ${playerId}`);
          }
        }
        break;

      case 'field_goals_made':
        // Field goals made: Any scoring play (2 or 3 points) by this player
        if (play.scoringPlay && (play.scoreValue === 2 || play.scoreValue === 3)) {
          const scorer = participants[0]?.athlete?.id;
          if (String(scorer) === playerIdStr) {
            total += 1;
            console.log(`[getPlayerStatFromPlays] +1 field goal made for player ${playerId}`);
          }
        }
        break;

      case 'field_goals_attempted':
        // Field goals attempted: Any shooting play (pointsAttempted > 0) by this player
        if (play.shootingPlay && play.pointsAttempted > 0) {
          const shooter = participants[0]?.athlete?.id;
          if (String(shooter) === playerIdStr) {
            total += 1;
            console.log(`[getPlayerStatFromPlays] +1 field goal attempted for player ${playerId}`);
          }
        }
        break;

      case 'three_pointers_made':
        // Three pointers made: Scoring plays with 3 points
        if (play.scoringPlay && play.scoreValue === 3) {
          const scorer = participants[0]?.athlete?.id;
          if (String(scorer) === playerIdStr) {
            total += 1;
            console.log(`[getPlayerStatFromPlays] +1 three pointer made for player ${playerId}`);
          }
        }
        break;

      case 'free_throws_made':
        // Free throws made: Scoring plays with 1 point (free throws)
        if (play.scoringPlay && play.scoreValue === 1) {
          const scorer = participants[0]?.athlete?.id;
          if (String(scorer) === playerIdStr) {
            total += 1;
            console.log(`[getPlayerStatFromPlays] +1 free throw made for player ${playerId}`);
          }
        }
        break;
    }
  }

  console.log(`[getPlayerStatFromPlays] ✅ Total ${statKey} for player ${playerId} in period ${period}: ${total}`);
  return total;
}

/**
 * Get the resolution UTC time for a specific time period in basketball
 * For period-specific bets, finds the "End Period" event in play-by-play
 * For FULL_GAME, uses the game's lastPlayWallClock
 */
function getBasketballResolutionUTCTime(gameData: any, timePeriod: TimePeriod): Date | undefined {
  console.log(`[getBasketballResolutionUTCTime] Getting resolution time for period: ${timePeriod}`);
  
  // For full game, use the game's last play wallclock
  if (timePeriod === 'FULL_GAME') {
    if (gameData?.meta?.lastPlayWallClock) {
      const result = new Date(gameData.meta.lastPlayWallClock);
      console.log(`[getBasketballResolutionUTCTime] Full game resolution time: ${result.toISOString()}`);
      return result;
    }
    console.log(`[getBasketballResolutionUTCTime] ⚠️  No lastPlayWallClock found for FULL_GAME`);
    return undefined;
  }
  
  // For period-specific bets, find the "End Period" event in play-by-play
  const plays = gameData?.plays;
  if (!plays || !Array.isArray(plays)) {
    console.log(`[getBasketballResolutionUTCTime] ❌ No plays array found`);
    return undefined;
  }
  
  // Map period to period number(s)
  let periodNumbers: number[] = [];
  switch (timePeriod) {
    case 'Q1':
      periodNumbers = [1];
      break;
    case 'Q2':
      periodNumbers = [2];
      break;
    case 'Q3':
      periodNumbers = [3];
      break;
    case 'Q4':
      periodNumbers = [4];
      break;
    case 'H1':
      // H1 ends when Q2 ends
      periodNumbers = [2];
      break;
    case 'H2':
      // H2 ends when the game ends (use last period that ended)
      // Find the highest period number that has an "End Period" event
      const endPeriodPlays = plays.filter((p: any) => p.type?.id === '412');
      if (endPeriodPlays.length > 0) {
        const maxPeriod = Math.max(...endPeriodPlays.map((p: any) => p.period?.number || 0));
        periodNumbers = [maxPeriod];
        console.log(`[getBasketballResolutionUTCTime] H2 ends with period ${maxPeriod}`);
      } else {
        // Fallback to game end
        if (gameData?.meta?.lastPlayWallClock) {
          return new Date(gameData.meta.lastPlayWallClock);
        }
        return undefined;
      }
      break;
    case 'OT':
      // OT ends when the game ends (use last period that ended)
      const otEndPlays = plays.filter((p: any) => p.type?.id === '412');
      if (otEndPlays.length > 0) {
        const maxPeriod = Math.max(...otEndPlays.map((p: any) => p.period?.number || 0));
        periodNumbers = [maxPeriod];
        console.log(`[getBasketballResolutionUTCTime] OT ends with period ${maxPeriod}`);
      } else {
        // Fallback to game end
        if (gameData?.meta?.lastPlayWallClock) {
          return new Date(gameData.meta.lastPlayWallClock);
        }
        return undefined;
      }
      break;
    default:
      console.log(`[getBasketballResolutionUTCTime] ❌ Unknown period: ${timePeriod}`);
      return undefined;
  }
  
  // Find the "End Period" event (type.id === "412") for the specified period
  for (const periodNum of periodNumbers) {
    const endPeriodPlay = plays.find((p: any) => 
      p.type?.id === '412' && p.period?.number === periodNum
    );
    
    if (endPeriodPlay?.wallclock) {
      const result = new Date(endPeriodPlay.wallclock);
      console.log(`[getBasketballResolutionUTCTime] Found end period event for period ${periodNum}: ${result.toISOString()}`);
      return result;
    }
  }
  
  console.log(`[getBasketballResolutionUTCTime] ⚠️  No "End Period" event found for period ${timePeriod}, falling back to game end`);
  // Fallback to game end if period end not found
  if (gameData?.meta?.lastPlayWallClock) {
    return new Date(gameData.meta.lastPlayWallClock);
  }
  
  return undefined;
}

export const BASKETBALL_CONFIG: SportConfig = {
  sport_key: 'basketball',
  display_name: 'Basketball',
  getResolutionUTCTime: getBasketballResolutionUTCTime,
  
  time_periods: [
    {
      value: 'FULL_GAME',
      label: 'Full Game',
      api_key: 'game',
      betEndPointKey: {
        path: 'status.type.completed',
        expectedValue: true,
        filter: {
          arrayPath: 'header.competitions', // API structure - checkBetEndPoint will try header.competitions as fallback
          filterKey: 'id',
          filterValuePath: 'header.id' // API structure - checkBetEndPoint will try header.id as fallback
        }
      }
    },
    {
      value: 'Q1',
      label: '1st Quarter',
      api_key: 'quarter_1',
      betEndPointKey: {
        playByPlayCheck: {
          eventTypeId: '412', // "End Period" event type
          periodNumber: 1 // 1st Quarter
        }
      }
    },
    {
      value: 'Q2',
      label: '2nd Quarter',
      api_key: 'quarter_2',
      betEndPointKey: {
        playByPlayCheck: {
          eventTypeId: '412', // "End Period" event type
          periodNumber: 2 // 2nd Quarter
        }
      }
    },
    {
      value: 'Q3',
      label: '3rd Quarter',
      api_key: 'quarter_3',
      betEndPointKey: {
        playByPlayCheck: {
          eventTypeId: '412', // "End Period" event type
          periodNumber: 3 // 3rd Quarter
        }
      }
    },
    {
      value: 'Q4',
      label: '4th Quarter',
      api_key: 'quarter_4',
      betEndPointKey: {
        playByPlayCheck: {
          eventTypeId: '412', // "End Period" event type
          periodNumber: 4 // 4th Quarter
        }
      }
    },
    {
      value: 'H1',
      label: '1st Half',
      api_key: 'half_1',
      betEndPointKey: {
        playByPlayCheck: {
          eventTypeId: '412', // "End Period" event type
          periodNumber: 2 // H1 is complete when Q2 ends
        }
      }
    },
    {
      value: 'H2',
      label: '2nd Half',
      api_key: 'half_2',
      betEndPointKey: {
        path: 'status.type.completed',
        expectedValue: true,
        filter: {
          arrayPath: 'header.competitions', // API structure - checkBetEndPoint will try header.competitions as fallback
          filterKey: 'id',
          filterValuePath: 'header.id' // API structure - checkBetEndPoint will try header.id as fallback
        }
      }
    },
    {
      value: 'OT',
      label: 'Overtime',
      api_key: 'overtime',
      betEndPointKey: {
        path: 'status.type.completed',
        expectedValue: true,
        filter: {
          arrayPath: 'competitions', // API structure - checkBetEndPoint will try header.competitions as fallback
          filterKey: 'id',
          filterValuePath: 'id' // API structure - checkBetEndPoint will try header.id as fallback
        }
      }
    },
  ],
  
  metrics: [
    {
      value: 'points',
      label: 'Points',
      team: true,
      player: true,
      resolvable: true,
      endGameStatFetchKey: (gameData: any, subjectId: string, subjectType: 'TEAM' | 'PLAYER', period?: TimePeriod) => {
        console.log(`[points stat] Extracting points for subjectId=${subjectId}, subjectType=${subjectType}, period=${period || 'FULL_GAME'}`);
        
        if (subjectType === 'TEAM') {
          // For team points, use the score from competitors
          // Filter competition by matching id to game id (check both top-level and header.id)
          const gameId = gameData?.header?.id;
          if (!gameId) {
            console.log(`[points stat] ❌ No game id found in gameData`);
            return null;
          }
          // Try header.competitions first (sample file structure), then top-level competitions (API structure)
          const competitions = gameData?.header?.competitions || gameData?.competitions;
          if (!competitions || !Array.isArray(competitions)) {
            console.log(`[points stat] ❌ No competitions array found in gameData`);
            return null;
          }
          const competition = competitions.find((c: any) => String(c.id) === String(gameId));
          if (!competition) {
            console.log(`[points stat] ❌ No competition found matching game.id=${gameId}`);
            return null;
          }
          
          console.log(`[points stat] Found competition, looking for team with id=${subjectId}`);
          console.log(`[points stat] Available competitors:`, competition.competitors?.map((c: any) => ({ id: c.team?.id, name: c.team?.displayName })));
          
          const competitor = competition.competitors?.find((c: any) => String(c.team?.id) === String(subjectId));
          if (!competitor) {
            console.log(`[points stat] ❌ Team ${subjectId} not found in competitors`);
            return null;
          }
          
          console.log(`[points stat] Found competitor:`, { id: competitor.team?.id, name: competitor.team?.displayName, score: competitor.score });
          
          // For full game, return total score
          if (!period || period === 'FULL_GAME') {
            const result = competitor.score ? parseInt(competitor.score) : null;
            console.log(`[points stat] ✅ Full game points: ${result}`);
            return result;
          }
          
          // For quarters, use linescores
          const quarterIndex = period === 'Q1' ? 0 : period === 'Q2' ? 1 : period === 'Q3' ? 2 : period === 'Q4' ? 3 : -1;
          if (quarterIndex >= 0 && competitor.linescores?.[quarterIndex]) {
            const result = parseInt(competitor.linescores[quarterIndex].displayValue);
            console.log(`[points stat] ✅ ${period} points: ${result}`);
            return result;
          }
          
          // For halves, sum quarters
          if (period === 'H1') {
            const q1 = competitor.linescores?.[0]?.displayValue ? parseInt(competitor.linescores[0].displayValue) : 0;
            const q2 = competitor.linescores?.[1]?.displayValue ? parseInt(competitor.linescores[1].displayValue) : 0;
            const result = q1 + q2;
            console.log(`[points stat] ✅ H1 points: ${result} (Q1: ${q1}, Q2: ${q2})`);
            return result;
          }
          
          if (period === 'H2') {
            const q3 = competitor.linescores?.[2]?.displayValue ? parseInt(competitor.linescores[2].displayValue) : 0;
            const q4 = competitor.linescores?.[3]?.displayValue ? parseInt(competitor.linescores[3].displayValue) : 0;
            const result = q3 + q4;
            console.log(`[points stat] ✅ H2 points: ${result} (Q3: ${q3}, Q4: ${q4})`);
            return result;
          }
          
          console.log(`[points stat] ❌ Unsupported period: ${period}`);
          return null;
        } else if (subjectType === 'PLAYER') {
          // For player points, use play-by-play for period-specific stats, boxscore for full game
          if (period && period !== 'FULL_GAME') {
            console.log(`[points stat] Using play-by-play for period-specific player points`);
            return getPlayerStatFromPlays(gameData, subjectId, 'points', period);
          }
          
          // For full game, use boxscore
          console.log(`[points stat] Looking for player with id=${subjectId} in boxscore.players`);
          const result = getPlayerStat(gameData, subjectId, 'points');
          console.log(`[points stat] ${result !== null ? '✅' : '❌'} Player points: ${result}`);
          return result;
        }
        
        console.log(`[points stat] ❌ Unsupported subject type: ${subjectType}`);
        return null;
      }
    },
    {
      value: 'rebounds',
      label: 'Rebounds',
      team: true,
      player: true,
      resolvable: true,
      endGameStatFetchKey: (gameData: any, subjectId: string, subjectType: 'TEAM' | 'PLAYER', period?: TimePeriod) => {
        console.log(`[rebounds stat] Extracting rebounds for subjectId=${subjectId}, subjectType=${subjectType}, period=${period || 'FULL_GAME'}`);
        
        if (subjectType === 'TEAM') {
          const team = gameData?.boxscore?.teams?.find((t: any) => String(t.team?.id) === String(subjectId));
          if (!team) {
            console.log(`[rebounds stat] ❌ Team ${subjectId} not found in boxscore.teams`);
            return null;
          }
          const stat = team.statistics?.find((s: any) => s.name === 'totalRebounds');
          if (!stat) {
            console.log(`[rebounds stat] ❌ totalRebounds stat not found for team ${subjectId}`);
            return null;
          }
          const result = stat?.displayValue ? parseInt(stat.displayValue) : null;
          console.log(`[rebounds stat] ✅ Team rebounds: ${result}`);
          return result;
        } else {
          if (period && period !== 'FULL_GAME') {
            return getPlayerStatFromPlays(gameData, subjectId, 'rebounds', period);
          }
          const result = getPlayerStat(gameData, subjectId, 'rebounds');
          console.log(`[rebounds stat] ${result !== null ? '✅' : '❌'} Player rebounds: ${result}`);
          return result;
        }
      }
    },
    {
      value: 'assists',
      label: 'Assists',
      team: true,
      player: true,
      resolvable: true,
      endGameStatFetchKey: (gameData: any, subjectId: string, subjectType: 'TEAM' | 'PLAYER', period?: TimePeriod) => {
        console.log(`[assists stat] Extracting assists for subjectId=${subjectId}, subjectType=${subjectType}, period=${period || 'FULL_GAME'}`);
        
        if (subjectType === 'TEAM') {
          const team = gameData?.boxscore?.teams?.find((t: any) => String(t.team?.id) === String(subjectId));
          if (!team) {
            console.log(`[assists stat] ❌ Team ${subjectId} not found in boxscore.teams`);
            return null;
          }
          const stat = team.statistics?.find((s: any) => s.name === 'assists');
          if (!stat) {
            console.log(`[assists stat] ❌ assists stat not found for team ${subjectId}`);
            return null;
          }
          const result = stat?.displayValue ? parseInt(stat.displayValue) : null;
          console.log(`[assists stat] ✅ Team assists: ${result}`);
          return result;
        } else {
          if (period && period !== 'FULL_GAME') {
            return getPlayerStatFromPlays(gameData, subjectId, 'assists', period);
          }
          const result = getPlayerStat(gameData, subjectId, 'assists');
          console.log(`[assists stat] ${result !== null ? '✅' : '❌'} Player assists: ${result}`);
          return result;
        }
      }
    },
    {
      value: 'steals',
      label: 'Steals',
      team: true,
      player: true,
      resolvable: true,
      endGameStatFetchKey: (gameData: any, subjectId: string, subjectType: 'TEAM' | 'PLAYER', period?: TimePeriod) => {
        console.log(`[steals stat] Extracting steals for subjectId=${subjectId}, subjectType=${subjectType}, period=${period || 'FULL_GAME'}`);
        
        if (subjectType === 'TEAM') {
          const team = gameData?.boxscore?.teams?.find((t: any) => String(t.team?.id) === String(subjectId));
          if (!team) {
            console.log(`[steals stat] ❌ Team ${subjectId} not found in boxscore.teams`);
            return null;
          }
          const stat = team.statistics?.find((s: any) => s.name === 'steals');
          if (!stat) {
            console.log(`[steals stat] ❌ steals stat not found for team ${subjectId}`);
            return null;
          }
          const result = stat?.displayValue ? parseInt(stat.displayValue) : null;
          console.log(`[steals stat] ✅ Team steals: ${result}`);
          return result;
        } else {
          if (period && period !== 'FULL_GAME') {
            return getPlayerStatFromPlays(gameData, subjectId, 'steals', period);
          }
          const result = getPlayerStat(gameData, subjectId, 'steals');
          console.log(`[steals stat] ${result !== null ? '✅' : '❌'} Player steals: ${result}`);
          return result;
        }
      }
    },
    {
      value: 'blocks',
      label: 'Blocks',
      team: true,
      player: true,
      resolvable: true,
      endGameStatFetchKey: (gameData: any, subjectId: string, subjectType: 'TEAM' | 'PLAYER', period?: TimePeriod) => {
        console.log(`[blocks stat] Extracting blocks for subjectId=${subjectId}, subjectType=${subjectType}, period=${period || 'FULL_GAME'}`);
        
        if (subjectType === 'TEAM') {
          const team = gameData?.boxscore?.teams?.find((t: any) => String(t.team?.id) === String(subjectId));
          if (!team) {
            console.log(`[blocks stat] ❌ Team ${subjectId} not found in boxscore.teams`);
            return null;
          }
          const stat = team.statistics?.find((s: any) => s.name === 'blocks');
          if (!stat) {
            console.log(`[blocks stat] ❌ blocks stat not found for team ${subjectId}`);
            return null;
          }
          const result = stat?.displayValue ? parseInt(stat.displayValue) : null;
          console.log(`[blocks stat] ✅ Team blocks: ${result}`);
          return result;
        } else {
          if (period && period !== 'FULL_GAME') {
            return getPlayerStatFromPlays(gameData, subjectId, 'blocks', period);
          }
          const result = getPlayerStat(gameData, subjectId, 'blocks');
          console.log(`[blocks stat] ${result !== null ? '✅' : '❌'} Player blocks: ${result}`);
          return result;
        }
      }
    },
    {
      value: 'turnovers',
      label: 'Turnovers',
      team: true,
      player: true,
      resolvable: true,
      endGameStatFetchKey: (gameData: any, subjectId: string, subjectType: 'TEAM' | 'PLAYER', period?: TimePeriod) => {
        console.log(`[turnovers stat] Extracting turnovers for subjectId=${subjectId}, subjectType=${subjectType}, period=${period || 'FULL_GAME'}`);
        
        if (subjectType === 'TEAM') {
          const team = gameData?.boxscore?.teams?.find((t: any) => String(t.team?.id) === String(subjectId));
          if (!team) {
            console.log(`[turnovers stat] ❌ Team ${subjectId} not found in boxscore.teams`);
            return null;
          }
          const stat = team.statistics?.find((s: any) => s.name === 'turnovers');
          if (!stat) {
            console.log(`[turnovers stat] ❌ turnovers stat not found for team ${subjectId}`);
            return null;
          }
          const result = stat?.displayValue ? parseInt(stat.displayValue) : null;
          console.log(`[turnovers stat] ✅ Team turnovers: ${result}`);
          return result;
        } else {
          if (period && period !== 'FULL_GAME') {
            return getPlayerStatFromPlays(gameData, subjectId, 'turnovers', period);
          }
          const result = getPlayerStat(gameData, subjectId, 'turnovers');
          console.log(`[turnovers stat] ${result !== null ? '✅' : '❌'} Player turnovers: ${result}`);
          return result;
        }
      }
    },
    {
      value: 'field_goals_made',
      label: 'Field Goals Made',
      team: true,
      player: true,
      resolvable: true,
      endGameStatFetchKey: (gameData: any, subjectId: string, subjectType: 'TEAM' | 'PLAYER', period?: TimePeriod) => {
        console.log(`[field_goals_made stat] Extracting field goals made for subjectId=${subjectId}, subjectType=${subjectType}, period=${period || 'FULL_GAME'}`);
        
        if (subjectType === 'TEAM') {
          const team = gameData?.boxscore?.teams?.find((t: any) => String(t.team?.id) === String(subjectId));
          if (!team) {
            console.log(`[field_goals_made stat] ❌ Team ${subjectId} not found in boxscore.teams`);
            return null;
          }
          const stat = team.statistics?.find((s: any) => s.name === 'fieldGoalsMade-fieldGoalsAttempted');
          if (!stat?.displayValue) {
            console.log(`[field_goals_made stat] ❌ fieldGoalsMade-fieldGoalsAttempted stat not found or has no displayValue`);
            return null;
          }
          // Format is "49-88", extract first number
          const made = stat.displayValue.split('-')[0];
          const result = parseInt(made);
          console.log(`[field_goals_made stat] ✅ Team field goals made: ${result} (from "${stat.displayValue}")`);
          return result;
        } else {
          if (period && period !== 'FULL_GAME') {
            return getPlayerStatFromPlays(gameData, subjectId, 'field_goals_made', period);
          }
          const result = getPlayerStat(gameData, subjectId, 'fieldGoalsMade-fieldGoalsAttempted');
          console.log(`[field_goals_made stat] ${result !== null ? '✅' : '❌'} Player field goals made: ${result}`);
          return result;
        }
      }
    },
    {
      value: 'field_goals_attempted',
      label: 'Field Goals Attempted',
      team: true,
      player: true,
      resolvable: true,
      endGameStatFetchKey: (gameData: any, subjectId: string, subjectType: 'TEAM' | 'PLAYER', period?: TimePeriod) => {
        console.log(`[field_goals_attempted stat] Extracting field goals attempted for subjectId=${subjectId}, subjectType=${subjectType}, period=${period || 'FULL_GAME'}`);
        
        if (subjectType === 'TEAM') {
          const team = gameData?.boxscore?.teams?.find((t: any) => String(t.team?.id) === String(subjectId));
          if (!team) {
            console.log(`[field_goals_attempted stat] ❌ Team ${subjectId} not found in boxscore.teams`);
            return null;
          }
          const stat = team.statistics?.find((s: any) => s.name === 'fieldGoalsMade-fieldGoalsAttempted');
          if (!stat?.displayValue) {
            console.log(`[field_goals_attempted stat] ❌ fieldGoalsMade-fieldGoalsAttempted stat not found or has no displayValue`);
            return null;
          }
          // Format is "49-88", extract second number
          const attempted = stat.displayValue.split('-')[1];
          const result = parseInt(attempted);
          console.log(`[field_goals_attempted stat] ✅ Team field goals attempted: ${result} (from "${stat.displayValue}")`);
          return result;
        } else {
          if (period && period !== 'FULL_GAME') {
            return getPlayerStatFromPlays(gameData, subjectId, 'field_goals_attempted', period);
          }
          // For players, need to extract second part of compound stat
          const playerGroup = gameData?.boxscore?.players?.find((p: any) => {
            const stats = p.statistics?.[0];
            if (!stats || !stats.athletes) return false;
            return stats.athletes.some((a: any) => String(a.athlete?.id) === String(subjectId));
          });
          if (!playerGroup) return null;
          const stats = playerGroup.statistics?.[0];
          if (!stats || !stats.athletes) return null;
          const athlete = stats.athletes.find((a: any) => String(a.athlete?.id) === String(subjectId));
          if (!athlete || !athlete.stats) return null;
          const statIndex = stats.keys?.indexOf('fieldGoalsMade-fieldGoalsAttempted');
          if (statIndex === -1 || !athlete.stats[statIndex]) return null;
          const value = athlete.stats[statIndex];
          if (typeof value === 'string' && value.includes('-')) {
            const result = parseInt(value.split('-')[1]);
            console.log(`[field_goals_attempted stat] ✅ Player field goals attempted: ${result}`);
            return result;
          }
          return null;
        }
      }
    },
    {
      value: 'three_pointers_made',
      label: '3-Pointers Made',
      team: true,
      player: true,
      resolvable: true,
      endGameStatFetchKey: (gameData: any, subjectId: string, subjectType: 'TEAM' | 'PLAYER', period?: TimePeriod) => {
        console.log(`[three_pointers_made stat] Extracting three pointers made for subjectId=${subjectId}, subjectType=${subjectType}, period=${period || 'FULL_GAME'}`);
        
        if (subjectType === 'TEAM') {
          const team = gameData?.boxscore?.teams?.find((t: any) => String(t.team?.id) === String(subjectId));
          if (!team) {
            console.log(`[three_pointers_made stat] ❌ Team ${subjectId} not found in boxscore.teams`);
            return null;
          }
          const stat = team.statistics?.find((s: any) => s.name === 'threePointFieldGoalsMade-threePointFieldGoalsAttempted');
          if (!stat?.displayValue) {
            console.log(`[three_pointers_made stat] ❌ threePointFieldGoalsMade-threePointFieldGoalsAttempted stat not found or has no displayValue`);
            return null;
          }
          // Format is "12-31", extract first number
          const made = stat.displayValue.split('-')[0];
          const result = parseInt(made);
          console.log(`[three_pointers_made stat] ✅ Team three pointers made: ${result} (from "${stat.displayValue}")`);
          return result;
        } else {
          if (period && period !== 'FULL_GAME') {
            return getPlayerStatFromPlays(gameData, subjectId, 'three_pointers_made', period);
          }
          const result = getPlayerStat(gameData, subjectId, 'threePointFieldGoalsMade-threePointFieldGoalsAttempted');
          console.log(`[three_pointers_made stat] ${result !== null ? '✅' : '❌'} Player three pointers made: ${result}`);
          return result;
        }
      }
    },
    {
      value: 'free_throws_made',
      label: 'Free Throws Made',
      team: true,
      player: true,
      resolvable: true,
      endGameStatFetchKey: (gameData: any, subjectId: string, subjectType: 'TEAM' | 'PLAYER', period?: TimePeriod) => {
        console.log(`[free_throws_made stat] Extracting free throws made for subjectId=${subjectId}, subjectType=${subjectType}, period=${period || 'FULL_GAME'}`);
        
        if (subjectType === 'TEAM') {
          const team = gameData?.boxscore?.teams?.find((t: any) => String(t.team?.id) === String(subjectId));
          if (!team) {
            console.log(`[free_throws_made stat] ❌ Team ${subjectId} not found in boxscore.teams`);
            return null;
          }
          const stat = team.statistics?.find((s: any) => s.name === 'freeThrowsMade-freeThrowsAttempted');
          if (!stat?.displayValue) {
            console.log(`[free_throws_made stat] ❌ freeThrowsMade-freeThrowsAttempted stat not found or has no displayValue`);
            return null;
          }
          // Format is "16-17", extract first number
          const made = stat.displayValue.split('-')[0];
          const result = parseInt(made);
          console.log(`[free_throws_made stat] ✅ Team free throws made: ${result} (from "${stat.displayValue}")`);
          return result;
        } else {
          if (period && period !== 'FULL_GAME') {
            return getPlayerStatFromPlays(gameData, subjectId, 'free_throws_made', period);
          }
          const result = getPlayerStat(gameData, subjectId, 'freeThrowsMade-freeThrowsAttempted');
          console.log(`[free_throws_made stat] ${result !== null ? '✅' : '❌'} Player free throws made: ${result}`);
          return result;
        }
      }
    },
  ]
};

// Export registry for all sports
export const SPORT_CONFIGS: Record<string, SportConfig> = {
  basketball: BASKETBALL_CONFIG,
  // Add more sports here as they're implemented
};

