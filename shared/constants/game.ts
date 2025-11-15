/**
 * Parlay value mappings
 */
export const PARLAY_VALUES = {
  1: 1,
  2: 2,
  3: 4,
  4: 8,
  5: 16,
} as const;

/**
 * Base insurance costs for each parlay type
 */
export const BASE_INSURANCE_COSTS = {
  4: 3, // 4-bet parlay base cost
  5: 5, // 5-bet parlay base cost
} as const;

/**
 * Insurance cost multipliers based on streak level
 */
export const INSURANCE_MULTIPLIERS = [
  { min: 0, max: 14, multiplier: 1.0 },
  { min: 15, max: 24, multiplier: 1.67 },
  { min: 25, max: 34, multiplier: 2.0 },
  { min: 35, max: 44, multiplier: 2.67 },
  { min: 45, max: Infinity, multiplier: 3.0 },
] as const;

/**
 * Game statuses
 */
export const GAME_STATUS = {
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  POSTPONED: 'postponed',
  CANCELED: 'canceled',
} as const;

/**
 * Bet outcomes
 */
export const BET_OUTCOME = {
  PENDING: 'pending',
  WIN: 'win',
  LOSS: 'loss',
  PUSH: 'push',
  VOID: 'void',
} as const;

/**
 * Parlay statuses
 */
export const PARLAY_STATUS = {
  BUILDING: 'building',
  LOCKED: 'locked',
  PENDING: 'pending',
  WON: 'won',
  LOST: 'lost',
  RESOLUTION_FAILED: 'resolution_failed',
} as const;

/**
 * Bet types
 */
export const BET_TYPE = {
  MONEYLINE: 'moneyline',
  SPREAD: 'spread',
  OVER_UNDER: 'over_under',
  PLAYER_PROP: 'player_prop',
  TEAM_PROP: 'team_prop',
  GAME_PROP: 'game_prop',
} as const;

/**
 * Sports
 */
export const SPORTS = {
  NBA: 'NBA',
  NFL: 'NFL',
  NHL: 'NHL',
  MLB: 'MLB',
  EPL: 'EPL',
  CHAMPIONS_LEAGUE: 'Champions League',
} as const;

