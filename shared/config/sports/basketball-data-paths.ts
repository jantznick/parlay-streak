/**
 * Basketball Data Path Configuration
 * 
 * Defines how to extract stat values from ESPN API responses
 * for both full game stats (boxscore) and period-specific stats (play-by-play)
 */

import { TimePeriod } from '../../types/bets';

/**
 * Maps time periods to period numbers for this sport
 * For OT and FULL_GAME, dynamically detects all periods from game data
 * For other periods, returns static period numbers
 */
export function getPeriodNumbers(timePeriod: TimePeriod, gameData?: any): number[] {
  switch (timePeriod) {
    case 'Q1':
      return [1];
    case 'Q2':
      return [2];
    case 'Q3':
      return [3];
    case 'Q4':
      return [4];
    case 'H1':
      return [1, 2];
    case 'H2':
      return [3, 4];
    case 'OT':
      // Dynamically detect all OT periods (periods > 4)
      if (gameData) {
        return getAllOTPeriods(gameData);
      }
      // Fallback: return common OT periods if no game data
      return [5, 6, 7, 8];
    case 'FULL_GAME':
      // Dynamically detect all periods in the game
      if (gameData) {
        return getAllPeriods(gameData);
      }
      // Fallback: return standard periods if no game data
      return [1, 2, 3, 4, 5, 6, 7, 8];
    default:
      return [];
  }
}

/**
 * Helper: Get all periods that exist in the game (from linescores or plays)
 */
function getAllPeriods(gameData: any): number[] {
  const periods = new Set<number>();
  
  // Get periods from linescores
  const competitor = gameData.competitors?.[0];
  if (competitor?.linescores) {
    for (let i = 0; i < competitor.linescores.length; i++) {
      periods.add(i + 1); // Periods are 1-indexed
    }
  }
  
  // Also check plays for any additional periods
  const plays = gameData.plays || [];
  for (const play of plays) {
    if (play.period?.number) {
      periods.add(play.period.number);
    }
  }
  
  // If we found periods, return sorted array
  if (periods.size > 0) {
    return Array.from(periods).sort((a, b) => a - b);
  }
  
  // Fallback to standard periods
  return [1, 2, 3, 4, 5, 6, 7, 8];
}

/**
 * Helper: Get all OT periods (periods > 4) from the game
 */
function getAllOTPeriods(gameData: any): number[] {
  const allPeriods = getAllPeriods(gameData);
  return allPeriods.filter(p => p > 4); // OT periods are 5+
}

export interface StatExtractionConfig {
  // For full game stats from boxscore
  boxscore?: {
    // Team stat extraction
    team?: {
      // Path to find the stat in team.statistics array
      // Can be a field name or a function to find it
      fieldName?: string;
      // For combined stats like "fieldGoalsMade-fieldGoalsAttempted"
      // which part to extract: 'first' or 'second'
      combinedStatPart?: 'first' | 'second';
      // Special handling: 'score' means use competitor.score instead of statistics
      // 'sum_goalie_goals_against' means sum all goalie goals against for team
      special?: 'score' | 'sum_goalie_goals_against';
    };
    // Player stat extraction
    player?: {
      // Key name in the keys array (e.g., "points", "rebounds")
      keyName?: string;
      // For combined stats, which part to extract
      combinedStatPart?: 'first' | 'second';
    };
  };
  // For period-specific stats from play-by-play
  playByPlay?: {
    // Type of extraction: 'count', 'sum', 'filter'
    type: 'count' | 'sum' | 'filter';
    // Filter conditions for plays
    filters: {
      // Field to check
      field: string;
      // Value to match (or function)
      value: any;
      // Operator: 'equals', 'includes', 'startsWith', 'greaterThan', etc.
      operator?: 'equals' | 'includes' | 'startsWith' | 'greaterThan' | 'lessThan';
      // If true, negate the condition (NOT)
      negate?: boolean;
    }[];
    // For 'sum' type, which field to sum
    sumField?: string;
    // For team stats, need to check participant team
    checkParticipantTeam?: boolean;
    // Participant index (0 = first, 1 = second, etc.)
    participantIndex?: number;
  };
}

/**
 * Basketball stat extraction configuration
 * Maps each metric to how to extract it from the API response
 */
export const BASKETBALL_STAT_PATHS: Record<string, StatExtractionConfig> = {
  // ===== FULL GAME STATS =====
  
  points: {
    boxscore: {
      team: {
        special: 'score', // Use competitor.score, not statistics array
      },
      player: {
        keyName: 'points',
      },
    },
    playByPlay: {
      type: 'sum',
      filters: [
        { field: 'scoringPlay', value: true, operator: 'equals' },
      ],
      sumField: 'scoreValue',
      participantIndex: 0, // Scorer is first participant
    },
  },

  rebounds: {
    boxscore: {
      team: {
        fieldName: 'totalRebounds',
      },
      player: {
        keyName: 'rebounds',
      },
    },
    playByPlay: {
      type: 'count',
      filters: [
        { field: 'shortDescription', value: 'Rebound', operator: 'equals' },
      ],
      participantIndex: 0, // Rebounder is first participant
    },
  },

  assists: {
    boxscore: {
      team: {
        fieldName: 'assists',
      },
      player: {
        keyName: 'assists',
      },
    },
    playByPlay: {
      type: 'count',
      filters: [
        { field: 'scoringPlay', value: true, operator: 'equals' },
        // Must have at least 2 participants (scorer + assister)
        { field: 'participants.length', value: 2, operator: 'greaterThan' },
      ],
      participantIndex: 1, // Assister is second participant
    },
  },

  steals: {
    boxscore: {
      team: {
        fieldName: 'steals',
      },
      player: {
        keyName: 'steals',
      },
    },
    playByPlay: {
      type: 'count',
      filters: [
        { field: 'text', value: 'steals', operator: 'includes' },
      ],
      participantIndex: 1, // Stealer is second participant
      checkParticipantTeam: true, // Need to verify stealer is on correct team
    },
  },

  blocks: {
    boxscore: {
      team: {
        fieldName: 'blocks',
      },
      player: {
        keyName: 'blocks',
      },
    },
    playByPlay: {
      type: 'count',
      filters: [
        { field: 'text', value: 'blocks', operator: 'includes' },
      ],
      participantIndex: 1, // Blocker is second participant
      checkParticipantTeam: true, // Need to verify blocker is on correct team
    },
  },

  turnovers: {
    boxscore: {
      team: {
        fieldName: 'turnovers',
      },
      player: {
        keyName: 'turnovers',
      },
    },
    playByPlay: {
      type: 'count',
      filters: [
        { field: 'shortDescription', value: 'Turnover', operator: 'equals' },
      ],
      participantIndex: 0, // Player with turnover is first participant
    },
  },

  field_goals_made: {
    boxscore: {
      team: {
        fieldName: 'fieldGoalsMade-fieldGoalsAttempted',
        combinedStatPart: 'first',
      },
      player: {
        keyName: 'fieldGoalsMade-fieldGoalsAttempted',
        combinedStatPart: 'first',
      },
    },
    playByPlay: {
      type: 'count',
      filters: [
        { field: 'scoringPlay', value: true, operator: 'equals' },
        { field: 'scoreValue', value: [2, 3], operator: 'equals' }, // 2 or 3 point shot
        { field: 'type.id', value: '9', operator: 'startsWith', negate: true }, // Not a free throw (negate means NOT startsWith)
      ],
      participantIndex: 0,
    },
  },

  field_goals_attempted: {
    boxscore: {
      team: {
        fieldName: 'fieldGoalsMade-fieldGoalsAttempted',
        combinedStatPart: 'second',
      },
      player: {
        keyName: 'fieldGoalsMade-fieldGoalsAttempted',
        combinedStatPart: 'second',
      },
    },
    playByPlay: {
      type: 'count',
      filters: [
        { field: 'shootingPlay', value: true, operator: 'equals' },
        { field: 'type.id', value: '9', operator: 'startsWith', negate: true }, // Not a free throw (negate means NOT startsWith)
      ],
      participantIndex: 0,
    },
  },

  three_pointers_made: {
    boxscore: {
      team: {
        fieldName: 'threePointFieldGoalsMade-threePointFieldGoalsAttempted',
        combinedStatPart: 'first',
      },
      player: {
        keyName: 'threePointFieldGoalsMade-threePointFieldGoalsAttempted',
        combinedStatPart: 'first',
      },
    },
    playByPlay: {
      type: 'count',
      filters: [
        { field: 'scoringPlay', value: true, operator: 'equals' },
        { field: 'scoreValue', value: 3, operator: 'equals' },
      ],
      participantIndex: 0,
    },
  },

  three_pointers_attempted: {
    boxscore: {
      team: {
        fieldName: 'threePointFieldGoalsMade-threePointFieldGoalsAttempted',
        combinedStatPart: 'second',
      },
      player: {
        keyName: 'threePointFieldGoalsMade-threePointFieldGoalsAttempted',
        combinedStatPart: 'second',
      },
    },
    playByPlay: {
      type: 'count',
      filters: [
        { field: 'shootingPlay', value: true, operator: 'equals' },
        { field: 'pointsAttempted', value: 3, operator: 'equals' },
      ],
      participantIndex: 0,
    },
  },

  free_throws_made: {
    boxscore: {
      team: {
        fieldName: 'freeThrowsMade-freeThrowsAttempted',
        combinedStatPart: 'first',
      },
      player: {
        keyName: 'freeThrowsMade-freeThrowsAttempted',
        combinedStatPart: 'first',
      },
    },
    playByPlay: {
      type: 'count',
      filters: [
        { field: 'type.id', value: '9', operator: 'startsWith' }, // Free throw type IDs start with 9
        { field: 'scoringPlay', value: true, operator: 'equals' },
      ],
      participantIndex: 0,
    },
  },

  free_throws_attempted: {
    boxscore: {
      team: {
        fieldName: 'freeThrowsMade-freeThrowsAttempted',
        combinedStatPart: 'second',
      },
      player: {
        keyName: 'freeThrowsMade-freeThrowsAttempted',
        combinedStatPart: 'second',
      },
    },
    playByPlay: {
      type: 'count',
      filters: [
        { field: 'type.id', value: '9', operator: 'startsWith' }, // Free throw type IDs start with 9
      ],
      participantIndex: 0,
    },
  },
};

/**
 * Helper function to get stat extraction config for a metric
 */
export function getStatExtractionConfig(metric: string): StatExtractionConfig | null {
  return BASKETBALL_STAT_PATHS[metric] || null;
}

/**
 * Helper function to check if a metric has play-by-play extraction
 */
export function hasPlayByPlayExtraction(metric: string): boolean {
  const config = getStatExtractionConfig(metric);
  return config?.playByPlay !== undefined;
}

/**
 * Helper function to check if a metric has boxscore extraction
 */
export function hasBoxscoreExtraction(metric: string): boolean {
  const config = getStatExtractionConfig(metric);
  return config?.boxscore !== undefined;
}

