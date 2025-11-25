/**
 * Helper functions for parlay operations
 */

import { PrismaClient } from '@prisma/client';

/**
 * Fetches a parlay with its selections and related data
 */
export async function getParlayWithSelections(
  prisma: PrismaClient,
  parlayId: string
) {
  return prisma.parlay.findUnique({
    where: { id: parlayId },
    include: {
      selections: {
        include: {
          bet: {
            include: {
              game: true
            }
          }
        }
      }
    }
  });
}

/**
 * Formats a parlay for API response
 * @param parlay - The parlay object from Prisma
 * @param includeSelections - Whether to include selections in the response
 * @param includeSelectionStatus - Whether to include status in each selection (default: true)
 */
export function formatParlayResponse(parlay: any, includeSelections: boolean = true, includeSelectionStatus: boolean = true) {
  return {
    id: parlay.id,
    betCount: parlay.betCount,
    parlayValue: parlay.parlayValue,
    insured: parlay.insured,
    insuranceCost: parlay.insuranceCost,
    status: parlay.status,
    lockedAt: parlay.lockedAt?.toISOString(),
    resolvedAt: parlay.resolvedAt?.toISOString(),
    lastGameEndTime: parlay.lastGameEndTime?.toISOString(),
    selections: includeSelections && parlay.selections
      ? parlay.selections.map((s: any) => {
          const selection: any = {
            id: s.id,
            bet: s.bet,
            selectedSide: s.selectedSide,
            game: s.bet.game
          };
          if (includeSelectionStatus) {
            selection.status = s.status;
          }
          return selection;
        })
      : undefined,
    createdAt: parlay.createdAt.toISOString()
  };
}

/**
 * Handles insurance refund when removing insurance or deleting a parlay
 */
export async function handleInsuranceRefund(
  prisma: PrismaClient,
  parlay: any,
  user: any,
  parlayId: string
): Promise<void> {
  if (!parlay.insured || !user) {
    return;
  }

  const refundAmount = parlay.insuranceCost;
  const newStreak = user.currentStreak + refundAmount;

  const updateData: any = {
    currentStreak: newStreak
  };

  // Only unlock insurance if this was the locked parlay
  if (user.lastInsuredParlayId === parlayId) {
    updateData.insuranceLocked = false;
    updateData.lastInsuredParlayId = null;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: updateData
  });
}

/**
 * Adds insurance to a parlay
 */
export async function addInsuranceToParlay(
  prisma: PrismaClient,
  parlay: any,
  user: any,
  parlayId: string,
  getInsuranceCost: (parlayValue: number, currentStreak: number) => number
): Promise<void> {
  if (parlay.betCount < 4) {
    const error: any = new Error('Insurance only available for 4-5 bet parlays');
    error.status = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  if (user.insuranceLocked) {
    const error: any = new Error('Insurance is locked. Complete an uninsured bet first.');
    error.status = 400;
    error.code = 'INSURANCE_LOCKED';
    throw error;
  }

  const insuranceCost = getInsuranceCost(parlay.parlayValue, user.currentStreak);
  const newStreak = Math.max(0, user.currentStreak - insuranceCost);

  // Update user streak and insurance status
  await prisma.user.update({
    where: { id: user.id },
    data: {
      currentStreak: newStreak,
      insuranceLocked: true,
      lastInsuredParlayId: parlayId
    }
  });

  // Update parlay
  await prisma.parlay.update({
    where: { id: parlayId },
    data: {
      insured: true,
      insuranceCost
    }
  });
}

/**
 * Removes insurance from a parlay
 */
export async function removeInsuranceFromParlay(
  prisma: PrismaClient,
  parlay: any,
  user: any,
  parlayId: string
): Promise<void> {
  const refundAmount = parlay.insuranceCost;
  const newStreak = user.currentStreak + refundAmount;

  const updateData: any = {
    currentStreak: newStreak
  };

  // Only unlock insurance if this was the locked parlay
  if (user.lastInsuredParlayId === parlayId) {
    updateData.insuranceLocked = false;
    updateData.lastInsuredParlayId = null;
  }

  await prisma.user.update({
    where: { id: user.id },
    data: updateData
  });

  // Update parlay
  await prisma.parlay.update({
    where: { id: parlayId },
    data: {
      insured: false,
      insuranceCost: 0
    }
  });
}

