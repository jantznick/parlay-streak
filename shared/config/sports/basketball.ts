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
}

/**
 * Helper function to extract player stat from boxscore
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

export const BASKETBALL_CONFIG: SportConfig = {
  sport_key: 'basketball',
  display_name: 'Basketball',
  
  time_periods: [
    {
      value: 'FULL_GAME',
      label: 'Full Game',
      api_key: 'game',
      betEndPointKey: {
        path: 'status.type.completed',
        expectedValue: true,
        filter: {
          arrayPath: 'header.competitions',
          filterKey: 'id',
          filterValuePath: 'header.id'
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
          arrayPath: 'header.competitions',
          filterKey: 'id',
          filterValuePath: 'header.id'
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
          arrayPath: 'header.competitions',
          filterKey: 'id',
          filterValuePath: 'header.id'
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
          // Filter competition by matching id to header.id
          const headerId = gameData?.header?.id;
          if (!headerId) {
            console.log(`[points stat] ❌ No header.id found in gameData`);
            return null;
          }
          const competition = gameData?.header?.competitions?.find((c: any) => String(c.id) === String(headerId));
          if (!competition) {
            console.log(`[points stat] ❌ No competition found matching header.id=${headerId}`);
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
          // For player points, look in boxscore.players
          console.log(`[points stat] Looking for player with id=${subjectId} in boxscore.players`);
          
          // Find the player in boxscore.players
          const playerGroup = gameData?.boxscore?.players?.find((p: any) => {
            const stats = p.statistics?.[0];
            if (!stats || !stats.athletes) return false;
            return stats.athletes.some((a: any) => String(a.athlete?.id) === String(subjectId));
          });
          
          if (!playerGroup) {
            console.log(`[points stat] ❌ Player ${subjectId} not found in boxscore.players`);
            return null;
          }
          
          const stats = playerGroup.statistics?.[0];
          if (!stats || !stats.athletes) {
            console.log(`[points stat] ❌ No statistics found for player group`);
            return null;
          }
          
          const athlete = stats.athletes.find((a: any) => String(a.athlete?.id) === String(subjectId));
          if (!athlete) {
            console.log(`[points stat] ❌ Player ${subjectId} not found in athletes array`);
            return null;
          }
          
          // Find the index of "points" in the keys array
          const pointsIndex = stats.keys?.indexOf('points');
          if (pointsIndex === -1 || !athlete.stats || !athlete.stats[pointsIndex]) {
            console.log(`[points stat] ❌ Points stat not found for player (index: ${pointsIndex})`);
            return null;
          }
          
          const result = parseInt(athlete.stats[pointsIndex]);
          console.log(`[points stat] ✅ Player points: ${result} (from stats[${pointsIndex}])`);
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
      endGameStatFetchKey: (gameData: any, subjectId: string, subjectType: 'TEAM' | 'PLAYER') => {
        console.log(`[rebounds stat] Extracting rebounds for subjectId=${subjectId}, subjectType=${subjectType}`);
        
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
      endGameStatFetchKey: (gameData: any, subjectId: string, subjectType: 'TEAM' | 'PLAYER') => {
        console.log(`[assists stat] Extracting assists for subjectId=${subjectId}, subjectType=${subjectType}`);
        
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
      endGameStatFetchKey: (gameData: any, subjectId: string, subjectType: 'TEAM' | 'PLAYER') => {
        console.log(`[steals stat] Extracting steals for subjectId=${subjectId}, subjectType=${subjectType}`);
        
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
      endGameStatFetchKey: (gameData: any, subjectId: string, subjectType: 'TEAM' | 'PLAYER') => {
        console.log(`[blocks stat] Extracting blocks for subjectId=${subjectId}, subjectType=${subjectType}`);
        
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
      endGameStatFetchKey: (gameData: any, subjectId: string, subjectType: 'TEAM' | 'PLAYER') => {
        console.log(`[turnovers stat] Extracting turnovers for subjectId=${subjectId}, subjectType=${subjectType}`);
        
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
      endGameStatFetchKey: (gameData: any, subjectId: string, subjectType: 'TEAM' | 'PLAYER') => {
        console.log(`[field_goals_made stat] Extracting field goals made for subjectId=${subjectId}, subjectType=${subjectType}`);
        
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
      endGameStatFetchKey: (gameData: any, subjectId: string, subjectType: 'TEAM' | 'PLAYER') => {
        console.log(`[field_goals_attempted stat] Extracting field goals attempted for subjectId=${subjectId}, subjectType=${subjectType}`);
        
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
      endGameStatFetchKey: (gameData: any, subjectId: string, subjectType: 'TEAM' | 'PLAYER') => {
        console.log(`[three_pointers_made stat] Extracting three pointers made for subjectId=${subjectId}, subjectType=${subjectType}`);
        
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
      endGameStatFetchKey: (gameData: any, subjectId: string, subjectType: 'TEAM' | 'PLAYER') => {
        console.log(`[free_throws_made stat] Extracting free throws made for subjectId=${subjectId}, subjectType=${subjectType}`);
        
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

