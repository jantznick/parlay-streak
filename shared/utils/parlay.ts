import { PARLAY_VALUES, BASE_INSURANCE_COSTS, INSURANCE_MULTIPLIERS } from '../constants/game';

/**
 * Calculate parlay value based on number of bets
 */
export function calculateParlayValue(betCount: number): number {
  return PARLAY_VALUES[betCount as keyof typeof PARLAY_VALUES] || 0;
}

/**
 * Calculate insurance cost based on bet count and current streak
 */
export function calculateInsuranceCost(betCount: number, currentStreak: number): number {
  // Insurance only available for 4 or 5 bet parlays
  if (betCount !== 4 && betCount !== 5) {
    return 0;
  }

  const baseCost = BASE_INSURANCE_COSTS[betCount as keyof typeof BASE_INSURANCE_COSTS];
  
  // Find applicable multiplier
  const tier = INSURANCE_MULTIPLIERS.find(
    (tier) => currentStreak >= tier.min && currentStreak <= tier.max
  );

  if (!tier) {
    return 0;
  }

  return Math.round(baseCost * tier.multiplier);
}

/**
 * Calculate net gain/loss from an insured parlay
 * Returns positive for net gain, negative for net loss
 */
export function calculateInsuredParlayNet(
  betCount: number,
  currentStreak: number,
  won: boolean
): number {
  const parlayValue = calculateParlayValue(betCount);
  const insuranceCost = calculateInsuranceCost(betCount, currentStreak);

  if (won) {
    return parlayValue - insuranceCost;
  } else {
    return -insuranceCost;
  }
}

/**
 * Check if insurance is available for a parlay
 */
export function isInsuranceEligible(betCount: number): boolean {
  return betCount === 4 || betCount === 5;
}

/**
 * Get insurance tier info for current streak
 */
export function getInsuranceTier(currentStreak: number) {
  return INSURANCE_MULTIPLIERS.find(
    (tier) => currentStreak >= tier.min && currentStreak <= tier.max
  );
}

