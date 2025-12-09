import type { StreakGroup } from '../interfaces/streak';
import type { Parlay } from '../interfaces/parlay';
import type { BetSelection } from '../interfaces/bet';

// Helper to create a mock parlay
const createMockParlay = (
  id: string,
  betCount: number,
  value: number,
  status: string,
  insured: boolean = false,
  cost: number = 0
): Parlay => ({
  id,
  betCount,
  parlayValue: value,
  insured,
  insuranceCost: cost,
  status,
  lockedAt: new Date().toISOString(),
  resolvedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  selections: [
    {
      id: `sel-${id}-1`,
      selectedSide: 'participant_1',
      outcome: status === 'won' ? 'win' : status === 'lost' ? 'loss' : 'pending',
      bet: {
        id: `bet-${id}-1`,
        displayText: 'Mock Team A vs Mock Team B',
        betType: 'COMPARISON',
      },
      game: {
        id: `game-${id}-1`,
        homeTeam: 'Mock Team B',
        awayTeam: 'Mock Team A',
        startTime: new Date().toISOString(),
        sport: 'BASKETBALL',
        status: 'completed',
        homeScore: 100,
        awayScore: 110,
      }
    },
    {
      id: `sel-${id}-2`,
      selectedSide: 'over',
      outcome: status === 'won' ? 'win' : status === 'lost' ? 'loss' : 'pending',
      bet: {
        id: `bet-${id}-2`,
        displayText: 'LeBron James Points',
        betType: 'THRESHOLD',
        config: {
          threshold: 25.5,
          participant: { subject_name: 'LeBron James', metric: 'Points', time_period: 'FULL_GAME' }
        }
      },
      game: {
        id: `game-${id}-2`,
        homeTeam: 'Lakers',
        awayTeam: 'Warriors',
        startTime: new Date().toISOString(),
        sport: 'BASKETBALL',
        status: 'completed',
        homeScore: 110,
        awayScore: 105,
      }
    }
  ]
});

// Helper to create a mock single bet
const createMockSingleBet = (
  id: string,
  status: string
): BetSelection => ({
  id: `sel-${id}`,
  betId: `bet-${id}`,
  selectedSide: 'participant_1',
  status: 'resolved',
  outcome: status === 'won' ? 'win' : 'loss',
  bet: {
    id: `bet-${id}`,
    displayText: 'Single Bet Team X vs Team Y',
    betType: 'COMPARISON',
    priority: 1
  },
  game: {
    id: `game-${id}`,
    homeTeam: 'Team Y',
    awayTeam: 'Team X',
    startTime: new Date().toISOString(),
    sport: 'BASKETBALL',
    status: 'completed',
    homeScore: 95,
    awayScore: 102,
  }
});

export const MOCK_STREAK_HISTORY: StreakGroup[] = [
  {
    id: 'streak-active',
    status: 'active',
    peakStreak: 10,
    finalStreak: 10,
    startDate: '2025-12-01T10:00:00Z',
    events: [
      {
        id: 'evt-4',
        type: 'parlay_win',
        pointsChange: 4,
        resultingStreak: 10,
        date: '2025-12-07T20:00:00Z',
        parlay: createMockParlay('parlay-4-act', 3, 4, 'won')
      },
      {
        id: 'evt-3',
        type: 'insurance_deducted',
        pointsChange: -3,
        resultingStreak: 6,
        date: '2025-12-05T15:00:00Z',
        parlay: createMockParlay('parlay-3-act', 4, 8, 'lost', true, 3)
      },
      {
        id: 'evt-2',
        type: 'parlay_win',
        pointsChange: 8,
        resultingStreak: 9,
        date: '2025-12-03T20:00:00Z',
        parlay: createMockParlay('parlay-2-act', 4, 8, 'won')
      },
      {
        id: 'evt-1',
        type: 'bet_win',
        pointsChange: 1,
        resultingStreak: 1,
        date: '2025-12-01T10:00:00Z',
        betSelection: createMockSingleBet('bet-1-act', 'won')
      },
      {
        id: 'evt-0',
        type: 'bet_win',
        pointsChange: 1,
        resultingStreak: 0, // Before streak started? Or just extra history
        date: '2025-11-30T10:00:00Z',
        betSelection: createMockSingleBet('bet-0-act', 'won')
      },
      {
        id: 'evt-neg-1',
        type: 'bet_win',
        pointsChange: 1,
        resultingStreak: -1, // Testing scroll
        date: '2025-11-29T10:00:00Z',
        betSelection: createMockSingleBet('bet-neg-1-act', 'won')
      },
      {
        id: 'evt-neg-2',
        type: 'bet_win',
        pointsChange: 1,
        resultingStreak: -2,
        date: '2025-11-28T10:00:00Z',
        betSelection: createMockSingleBet('bet-neg-2-act', 'won')
      },
      {
        id: 'evt-neg-3',
        type: 'bet_win',
        pointsChange: 1,
        resultingStreak: -3,
        date: '2025-11-27T10:00:00Z',
        betSelection: createMockSingleBet('bet-neg-3-act', 'won')
      }
    ]
  },
  {
    id: 'streak-ended-1',
    status: 'ended',
    peakStreak: 8,
    finalStreak: 0,
    startDate: '2025-11-10T10:00:00Z',
    endDate: '2025-11-20T22:00:00Z',
    events: [
      {
        id: 'evt-old-5',
        type: 'bet_loss',
        pointsChange: -8,
        resultingStreak: 0,
        date: '2025-11-20T22:00:00Z',
        betSelection: createMockSingleBet('bet-5-old', 'loss')
      },
      {
        id: 'evt-old-4',
        type: 'parlay_win',
        pointsChange: 4,
        resultingStreak: 8,
        date: '2025-11-18T18:00:00Z',
        parlay: createMockParlay('parlay-4-old', 3, 4, 'won')
      },
      {
        id: 'evt-old-3',
        type: 'bet_win',
        pointsChange: 1,
        resultingStreak: 4,
        date: '2025-11-15T10:00:00Z',
        betSelection: createMockSingleBet('bet-3-old', 'won')
      },
      {
        id: 'evt-old-2',
        type: 'parlay_win',
        pointsChange: 2,
        resultingStreak: 3,
        date: '2025-11-12T18:00:00Z',
        parlay: createMockParlay('parlay-2-old', 2, 2, 'won')
      },
      {
        id: 'evt-old-1',
        type: 'bet_win',
        pointsChange: 1,
        resultingStreak: 1,
        date: '2025-11-10T10:00:00Z',
        betSelection: createMockSingleBet('bet-1-old', 'won')
      }
    ]
  },
  {
    id: 'streak-ended-2',
    status: 'ended',
    peakStreak: 5,
    finalStreak: 0,
    startDate: '2025-10-01T10:00:00Z',
    endDate: '2025-10-15T22:00:00Z',
    events: [
      {
        id: 'evt-ended-2-loss',
        type: 'parlay_loss',
        pointsChange: -5,
        resultingStreak: 0,
        date: '2025-10-15T22:00:00Z',
        parlay: createMockParlay('parlay-ended-2', 3, 5, 'lost')
      },
      {
        id: 'evt-ended-2-win',
        type: 'bet_win',
        pointsChange: 5,
        resultingStreak: 5,
        date: '2025-10-01T10:00:00Z',
        betSelection: createMockSingleBet('bet-ended-2', 'won')
      }
    ]
  },
  {
    id: 'streak-ended-3',
    status: 'ended',
    peakStreak: 12,
    finalStreak: 0,
    startDate: '2025-09-01T10:00:00Z',
    endDate: '2025-09-20T22:00:00Z',
    events: [
      {
        id: 'evt-ended-3-loss',
        type: 'bet_loss',
        pointsChange: -12,
        resultingStreak: 0,
        date: '2025-09-20T22:00:00Z',
        betSelection: createMockSingleBet('bet-ended-3-loss', 'loss')
      },
      {
        id: 'evt-ended-3-win',
        type: 'parlay_win',
        pointsChange: 12,
        resultingStreak: 12,
        date: '2025-09-01T10:00:00Z',
        parlay: createMockParlay('parlay-ended-3', 4, 12, 'won')
      }
    ]
  },
  {
    id: 'streak-ended-4',
    status: 'ended',
    peakStreak: 3,
    finalStreak: 0,
    startDate: '2025-08-01T10:00:00Z',
    endDate: '2025-08-05T22:00:00Z',
    events: [
      {
        id: 'evt-ended-4-loss',
        type: 'bet_loss',
        pointsChange: -3,
        resultingStreak: 0,
        date: '2025-08-05T22:00:00Z',
        betSelection: createMockSingleBet('bet-ended-4-loss', 'loss')
      },
      {
        id: 'evt-ended-4-win',
        type: 'bet_win',
        pointsChange: 3,
        resultingStreak: 3,
        date: '2025-08-01T10:00:00Z',
        betSelection: createMockSingleBet('bet-ended-4-win', 'won')
      }
    ]
  }
];
