/**
 * Hockey Data Path Configuration
 * 
 * Defines how to extract stat values from ESPN API responses
 * for both full game stats (boxscore) and period-specific stats (play-by-play)
 */

import { TimePeriod } from '../../types/bets';

/**
 * Maps time periods to period numbers for this sport
 */
export function getPeriodNumbers(timePeriod: TimePeriod): number[] {
  switch (timePeriod) {
    case 'FULL_GAME':
      return [1, 2, 3, 4, 5, 6, 7, 8]; // All periods + OT
    case 'P1':
      return [1];
    case 'P2':
      return [2];
    case 'P3':
      return [3];
    case 'OT':
      return [4, 5, 6, 7, 8]; // All OT periods
    default:
      return [];
  }
}

export interface StatExtractionConfig {
  // For full game stats from boxscore
  boxscore?: {
    // Team stat extraction
    team?: {
      // Path to find the stat in team.statistics array
      fieldName?: string;
      // Special handling: 'score' means use competitor.score instead of statistics
      // 'sum_goalie_goals_against' means sum all goalie goals against for team
      special?: 'score' | 'sum_goalie_goals_against';
    };
    // Player stat extraction
    player?: {
      // Key name in the keys array (e.g., "goals", "assists")
      keyName?: string;
      // Stat group: 'forwards' or 'goalies' (different stat groups)
      statGroup?: 'forwards' | 'goalies';
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
    // Participant type to match (e.g., "scorer", "assister", "hit-credited")
    participantType?: string;
  };
}

/**
 * Hockey stat extraction configuration
 * Maps each metric to how to extract it from the API response
 */
export const HOCKEY_STAT_PATHS: Record<string, StatExtractionConfig> = {
  // ===== FULL GAME STATS =====
  
  goals: {
    boxscore: {
      team: {
        special: 'score', // Use competitor.score, not statistics
      },
      player: {
        keyName: 'goals',
        statGroup: 'forwards', // Goals are in forwards stat group
      },
    },
    playByPlay: {
      type: 'count',
      filters: [
        { field: 'scoringPlay', value: true, operator: 'equals' },
        { field: 'type.text', value: 'Goal', operator: 'equals' },
      ],
      participantIndex: 0, // Scorer is first participant
      participantType: 'scorer',
    },
  },

  assists: {
    boxscore: {
      team: {
        // Team assists would need to be calculated from player assists
        // For now, we'll use play-by-play
        fieldName: 'assists', // May not exist in team stats, will need play-by-play
      },
      player: {
        keyName: 'assists',
        statGroup: 'forwards',
      },
    },
    playByPlay: {
      type: 'count',
      filters: [
        { field: 'scoringPlay', value: true, operator: 'equals' },
        { field: 'type.text', value: 'Goal', operator: 'equals' },
      ],
      // Assisters are participants with type "assister" (usually 2nd and 3rd)
      participantType: 'assister',
    },
  },

  points: {
    boxscore: {
      team: {
        // Points = goals + assists, will need to calculate
        special: 'score', // Use score as proxy, or calculate from goals + assists
      },
      player: {
        // Points may not be in keys array, will need to calculate goals + assists
        keyName: 'points', // Check if exists, otherwise calculate
        statGroup: 'forwards',
      },
    },
    playByPlay: {
      // Points = goals + assists, calculate from play-by-play
      type: 'count',
      filters: [
        { field: 'scoringPlay', value: true, operator: 'equals' },
      ],
      // Count all scoring play participations (scorer + assisters)
      participantIndex: 0, // Will need special handling to count scorer + assisters
    },
  },

  shots: {
    boxscore: {
      team: {
        fieldName: 'shotsTotal',
      },
      player: {
        keyName: 'shotsTotal',
        statGroup: 'forwards',
      },
    },
    playByPlay: {
      type: 'count',
      filters: [
        { field: 'shootingPlay', value: true, operator: 'equals' },
        // Shots include both goals and missed shots
        { field: 'type.text', value: ['Shot', 'Goal', 'Missed Shot'], operator: 'equals' },
      ],
      participantIndex: 0, // Shooter is first participant
      participantType: 'shooter',
    },
  },

  saves: {
    boxscore: {
      player: {
        keyName: 'saves',
        statGroup: 'goalies', // Only goalies have saves
      },
    },
    playByPlay: {
      type: 'count',
      filters: [
        { field: 'type.text', value: 'Save', operator: 'equals' },
      ],
      // Goalie is typically the participant, need to check
      participantIndex: 0,
    },
  },

  goals_against: {
    boxscore: {
      team: {
        // Team goals against = sum of all goalie goals against for that team
        // This requires special handling - sum all goalies' goalsAgainst
        special: 'sum_goalie_goals_against',
      },
      player: {
        keyName: 'goalsAgainst',
        statGroup: 'goalies', // Only goalies have goals against
      },
    },
    playByPlay: {
      // Count goals scored against the goalie's team
      type: 'count',
      filters: [
        { field: 'scoringPlay', value: true, operator: 'equals' },
        { field: 'type.text', value: 'Goal', operator: 'equals' },
      ],
      // Need to check if goal was scored against goalie's team
      checkParticipantTeam: true,
    },
  },

  plus_minus: {
    boxscore: {
      player: {
        keyName: 'plusMinus',
        statGroup: 'forwards', // Plus/minus is in forwards stat group
      },
    },
    // Plus/minus is not typically tracked per period in play-by-play
    // It's a full game stat only
  },

  power_play_goals: {
    boxscore: {
      team: {
        fieldName: 'powerPlayGoals',
      },
      player: {
        // May need to calculate from play-by-play or check if in stats
        keyName: 'powerPlayGoals', // Check if exists
        statGroup: 'forwards',
      },
    },
    playByPlay: {
      type: 'count',
      filters: [
        { field: 'scoringPlay', value: true, operator: 'equals' },
        { field: 'type.text', value: 'Goal', operator: 'equals' },
        { field: 'strength.text', value: 'Power Play', operator: 'includes' },
      ],
      participantIndex: 0,
      participantType: 'scorer',
    },
  },

  short_handed_goals: {
    boxscore: {
      team: {
        fieldName: 'shortHandedGoals',
      },
      player: {
        keyName: 'shortHandedGoals', // Check if exists
        statGroup: 'forwards',
      },
    },
    playByPlay: {
      type: 'count',
      filters: [
        { field: 'scoringPlay', value: true, operator: 'equals' },
        { field: 'type.text', value: 'Goal', operator: 'equals' },
        { field: 'strength.text', value: 'Short Handed', operator: 'includes' },
      ],
      participantIndex: 0,
      participantType: 'scorer',
    },
  },

  hits: {
    boxscore: {
      team: {
        fieldName: 'hits',
      },
      player: {
        keyName: 'hits',
        statGroup: 'forwards',
      },
    },
    playByPlay: {
      type: 'count',
      filters: [
        { field: 'type.text', value: 'Hit', operator: 'equals' },
      ],
      participantIndex: 0,
      participantType: 'hit-credited',
    },
  },

  blocked_shots: {
    boxscore: {
      team: {
        fieldName: 'blockedShots',
      },
      player: {
        keyName: 'blockedShots',
        statGroup: 'forwards',
      },
    },
    playByPlay: {
      type: 'count',
      filters: [
        { field: 'type.text', value: 'Blocked', operator: 'equals' },
      ],
      // Blocker is typically the second participant (defender)
      participantIndex: 1,
      participantType: 'defender',
    },
  },

  faceoffs_won: {
    boxscore: {
      team: {
        fieldName: 'faceoffsWon',
      },
      player: {
        keyName: 'faceoffsWon',
        statGroup: 'forwards',
      },
    },
    playByPlay: {
      type: 'count',
      filters: [
        { field: 'type.text', value: 'Face Off', operator: 'equals' },
      ],
      participantIndex: 0,
      participantType: 'face-off-winner',
    },
  },

  takeaways: {
    boxscore: {
      team: {
        fieldName: 'takeaways',
      },
      player: {
        keyName: 'takeaways',
        statGroup: 'forwards',
      },
    },
    playByPlay: {
      type: 'count',
      filters: [
        { field: 'type.text', value: 'Takeaway', operator: 'equals' },
      ],
      participantIndex: 0,
    },
  },

  giveaways: {
    boxscore: {
      team: {
        fieldName: 'giveaways',
      },
      player: {
        keyName: 'giveaways',
        statGroup: 'forwards',
      },
    },
    playByPlay: {
      type: 'count',
      filters: [
        { field: 'type.text', value: 'Giveaway', operator: 'equals' },
      ],
      participantIndex: 0,
      participantType: 'giver',
    },
  },

  penalty_minutes: {
    boxscore: {
      team: {
        fieldName: 'penaltyMinutes',
      },
      player: {
        keyName: 'penaltyMinutes',
        statGroup: 'forwards', // Both forwards and goalies can have penalty minutes
      },
    },
    playByPlay: {
      // Would need to parse penalty plays and sum minutes
      // This is complex, better to use boxscore
      type: 'count',
      filters: [
        { field: 'type.text', value: 'Penalty', operator: 'includes' },
      ],
      // Would need to extract minutes from text or type
      // For now, rely on boxscore
    },
  },
};

/**
 * Helper function to get stat extraction config for a metric
 */
export function getStatExtractionConfig(metric: string): StatExtractionConfig | null {
  return HOCKEY_STAT_PATHS[metric] || null;
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

