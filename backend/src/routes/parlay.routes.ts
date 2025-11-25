import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { requireAuth } from '../middleware/auth';
import { requireFeature } from '../middleware/featureFlags';
import { parseDateAndTimezone, getUTCDateRange } from '../utils/dateUtils';
import {
  validateUserAuthenticated,
  validateParlayOwnership,
  validateParlayNotLocked,
  validateExistingSelection,
  validateNewBet,
  validateParlayNotFull
} from '../utils/parlayValidation';
import {
  getParlayWithSelections,
  formatParlayResponse,
  handleInsuranceRefund,
  addInsuranceToParlay,
  removeInsuranceFromParlay
} from '../utils/parlayHelpers';

const router = Router();
const prisma = new PrismaClient();

// Insurance cost lookup table
const INSURANCE_COSTS = {
  '0-14': { parlay8: 3, parlay16: 5 },
  '15-24': { parlay8: 5, parlay16: 8 },
  '25-34': { parlay8: 6, parlay16: 10 },
  '35-44': { parlay8: 8, parlay16: 13 },
  '45+': { parlay8: 9, parlay16: 15 },
};

/**
 * Calculate insurance cost based on parlay value and current streak
 */
function getInsuranceCost(parlayValue: number, currentStreak: number): number {
  let range: keyof typeof INSURANCE_COSTS;
  if (currentStreak <= 14) range = '0-14';
  else if (currentStreak <= 24) range = '15-24';
  else if (currentStreak <= 34) range = '25-34';
  else if (currentStreak <= 44) range = '35-44';
  else range = '45+';
  
  const costs = INSURANCE_COSTS[range];
  return parlayValue === 8 ? costs.parlay8 : costs.parlay16;
}

/**
 * Calculate parlay value based on bet count
 */
function calculateParlayValue(betCount: number): number {
  if (betCount === 2) return 2;
  if (betCount === 3) return 4;
  if (betCount === 4) return 8;
  if (betCount === 5) return 16;
  return 0; // Invalid
}

/**
 * Validate selectedSide matches bet type
 */
function validateSelectedSide(betType: string, selectedSide: string): boolean {
  if (betType === 'COMPARISON') {
    return selectedSide === 'participant_1' || selectedSide === 'participant_2';
  } else if (betType === 'THRESHOLD') {
    return selectedSide === 'over' || selectedSide === 'under';
  } else if (betType === 'EVENT') {
    return selectedSide === 'yes' || selectedSide === 'no';
  }
  return false;
}

/**
 * POST /api/parlays/start
 * Start a new parlay from a bet selection
 */
router.post('/start', requireAuth, requireFeature('PUBLIC_BETS_VIEW'), async (req: Request, res: Response) => {
  try {
    const { betId, selectedSide, existingSelectionId } = req.body;
    const userId = req.session.userId;

    validateUserAuthenticated(userId);

    // Validate required fields
    if (!betId && !existingSelectionId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Either betId or existingSelectionId is required', code: 'VALIDATION_ERROR' }
      });
    }

    if (existingSelectionId && !selectedSide) {
      // If using existing selection, we don't need selectedSide
    } else if (!selectedSide) {
      return res.status(400).json({
        success: false,
        error: { message: 'selectedSide is required when creating new selection', code: 'VALIDATION_ERROR' }
      });
    }

    let selection;
    
    // Flow 1: Use existing selection
    if (existingSelectionId) {
      selection = await prisma.userBetSelection.findUnique({
        where: { id: existingSelectionId },
        include: {
          bet: {
            include: {
              game: true
            }
          }
        }
      });

      validateExistingSelection(selection, userId!);
    } else {
      // Flow 2: Create new selection
      const bet = await prisma.bet.findUnique({
        where: { id: betId },
        include: {
          game: true
        }
      });

      validateNewBet(bet, selectedSide, validateSelectedSide);

      // Create new UserBetSelection
      selection = await prisma.userBetSelection.create({
        data: {
          userId: userId!,
          betId,
          selectedSide,
          parlayId: null, // Will be set after parlay creation
          status: 'selected'
        },
        include: {
          bet: {
            include: {
              game: true
            }
          }
        }
      });
    }

    // Create new Parlay
    const parlay = await prisma.parlay.create({
      data: {
        userId: userId!,
        betCount: 1,
        parlayValue: 0, // Invalid until 2+ bets
        insured: false,
        insuranceCost: 0,
        status: 'building'
      }
    });

    // Update selection to link to parlay
    await prisma.userBetSelection.update({
      where: { id: selection.id },
      data: {
        parlayId: parlay.id
      }
    });

    // Get parlay with selections
    const parlayWithSelections = await getParlayWithSelections(prisma, parlay.id);

    if (!parlayWithSelections) {
      throw new Error('Failed to fetch created parlay');
    }

    logger.info('Parlay created', {
      userId,
      parlayId: parlay.id,
      selectionId: selection.id
    });

    res.json({
      success: true,
      data: {
        parlay: formatParlayResponse(parlayWithSelections, true, false) // Don't include selection status for POST /start
      }
    });
  } catch (error: any) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        error: { message: error.message, code: error.code }
      });
    }
    logger.error('Error creating parlay', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: { message: 'Internal server error', code: 'INTERNAL_ERROR' }
    });
  }
});

/**
 * POST /api/parlays/:parlayId/add-selection
 * Add a bet selection to an existing parlay
 */
router.post('/:parlayId/add-selection', requireAuth, requireFeature('PUBLIC_BETS_VIEW'), async (req: Request, res: Response) => {
  try {
    const { parlayId } = req.params;
    const { betId, selectedSide, existingSelectionId } = req.body;
    const userId = req.session.userId;

    validateUserAuthenticated(userId);

    // Get parlay
    const parlay = await prisma.parlay.findUnique({
      where: { id: parlayId },
      include: {
        selections: true
      }
    });

    validateParlayOwnership(parlay, userId!);
    validateParlayNotLocked(parlay);
    validateParlayNotFull(parlay);

    let selection;

    // Use existing selection or create new one
    if (existingSelectionId) {
      selection = await prisma.userBetSelection.findUnique({
        where: { id: existingSelectionId },
        include: {
          bet: {
            include: {
              game: true
            }
          }
        }
      });

      validateExistingSelection(selection, userId!);
    } else {
      // Create new selection
      if (!betId || !selectedSide) {
        return res.status(400).json({
          success: false,
          error: { message: 'betId and selectedSide are required', code: 'VALIDATION_ERROR' }
        });
      }

      const bet = await prisma.bet.findUnique({
        where: { id: betId },
        include: {
          game: true
        }
      });

      validateNewBet(bet, selectedSide, validateSelectedSide);

      // Create new UserBetSelection
      selection = await prisma.userBetSelection.create({
        data: {
          userId: userId!,
          betId,
          selectedSide,
          parlayId: parlayId,
          status: 'selected'
        },
        include: {
          bet: {
            include: {
              game: true
            }
          }
        }
      });
    }

    // Update selection to link to parlay (if using existing selection)
    if (existingSelectionId) {
      await prisma.userBetSelection.update({
        where: { id: selection.id },
        data: {
          parlayId: parlayId
        }
      });
    }

    // Update parlay betCount and parlayValue
    const newBetCount = parlay.selections.length + 1;
    const newParlayValue = calculateParlayValue(newBetCount);

    await prisma.parlay.update({
      where: { id: parlayId },
      data: {
        betCount: newBetCount,
        parlayValue: newParlayValue
      }
    });

    // Get updated parlay with selections
    const updatedParlay = await getParlayWithSelections(prisma, parlayId);

    if (!updatedParlay) {
      throw new Error('Failed to fetch updated parlay');
    }

    logger.info('Selection added to parlay', {
      userId,
      parlayId,
      selectionId: selection.id
    });

    res.json({
      success: true,
      data: {
        parlay: formatParlayResponse(updatedParlay, true, false) // Don't include selection status for POST /:parlayId/add-selection
      }
    });
  } catch (error: any) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        error: { message: error.message, code: error.code }
      });
    }
    logger.error('Error adding selection to parlay', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: { message: 'Internal server error', code: 'INTERNAL_ERROR' }
    });
  }
});

/**
 * DELETE /api/parlays/:parlayId/selections/:selectionId
 * Remove a selection from a parlay
 */
router.delete('/:parlayId/selections/:selectionId', requireAuth, requireFeature('PUBLIC_BETS_VIEW'), async (req: Request, res: Response) => {
  try {
    const { parlayId, selectionId } = req.params;
    const userId = req.session.userId;

    validateUserAuthenticated(userId);

    // Get parlay
    const parlay = await prisma.parlay.findUnique({
      where: { id: parlayId },
      include: {
        selections: true
      }
    });

    validateParlayOwnership(parlay, userId!);
    validateParlayNotLocked(parlay);

    // Get selection
    const selection = await prisma.userBetSelection.findUnique({
      where: { id: selectionId }
    });

    if (!selection) {
      return res.status(404).json({
        success: false,
        error: { message: 'Selection not found', code: 'NOT_FOUND' }
      });
    }

    if (selection.parlayId !== parlayId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Selection does not belong to this parlay', code: 'VALIDATION_ERROR' }
      });
    }

    // Delete the selection (remove the bet entirely)
    await prisma.userBetSelection.delete({
      where: { id: selectionId }
    });

    // Update parlay betCount and parlayValue
    const newBetCount = parlay.selections.length - 1;
    const newParlayValue = calculateParlayValue(newBetCount);

    if (newBetCount === 0) {
      // Delete parlay if no bets left
      await prisma.parlay.delete({
        where: { id: parlayId }
      });

      logger.info('Parlay deleted (no bets left)', {
        userId,
        parlayId
      });

      return res.json({
        success: true,
        data: { message: 'Parlay deleted (no bets remaining)' }
      });
    } else if (newBetCount === 1) {
      // If only 1 bet left, delete parlay and convert remaining selection back to single bet
      // First, get the remaining selection
      const remainingSelections = await prisma.userBetSelection.findMany({
        where: { parlayId }
      });
      
      // Delete parlay (this will set parlayId to null on remaining selection via cascade)
      await prisma.parlay.delete({
        where: { id: parlayId }
      });

      // Explicitly update remaining selection to ensure it's a single bet
      if (remainingSelections.length > 0) {
        await prisma.userBetSelection.updateMany({
          where: { parlayId: null, id: { in: remainingSelections.map(s => s.id) } },
          data: {
            status: 'selected'
          }
        });
      }

      logger.info('Parlay deleted (converted to single bet)', {
        userId,
        parlayId
      });

      return res.json({
        success: true,
        data: { message: 'Parlay deleted (converted to single bet)' }
      });
    } else {
      // Update parlay
      await prisma.parlay.update({
        where: { id: parlayId },
        data: {
          betCount: newBetCount,
          parlayValue: newParlayValue
        }
      });
    }

    // Get updated parlay (if it still exists)
    let updatedParlay = null;
    if (newBetCount > 1) {
      updatedParlay = await getParlayWithSelections(prisma, parlayId);
    }

    logger.info('Selection removed from parlay', {
      userId,
      parlayId,
      selectionId
    });

    if (updatedParlay) {
      res.json({
        success: true,
        data: {
          parlay: formatParlayResponse(updatedParlay, true, false) // Don't include selection status for DELETE /:parlayId/selections/:selectionId
        }
      });
    } else {
      // Parlay was deleted (converted to single bet or no bets left)
      res.json({
        success: true,
        data: { message: newBetCount === 0 ? 'Parlay deleted (no bets remaining)' : 'Parlay deleted (converted to single bet)' }
      });
    }
  } catch (error: any) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        error: { message: error.message, code: error.code }
      });
    }
    logger.error('Error removing selection from parlay', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: { message: 'Internal server error', code: 'INTERNAL_ERROR' }
    });
  }
});

/**
 * GET /api/parlays
 * Get user's parlays
 */
router.get('/', requireAuth, requireFeature('PUBLIC_BETS_VIEW'), async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;
    const { status, includeSelections } = req.query;
    const { date, timezoneOffset } = parseDateAndTimezone(req);

    validateUserAuthenticated(userId);

    const where: any = { userId };
    
    // When date is provided, always return all statuses (consistent with bets endpoint)
    // This allows viewing historical parlays regardless of status
    // If no date is provided and status is specified, allow filtering (for other use cases)
    if (!date && status) {
      where.status = status;
    }
    // When date is provided (or no status filter), return all statuses:
    // 'building', 'locked', 'pending', 'won', 'lost', 'resolution_failed'
    // This is consistent with the bets endpoint which returns all statuses when date is provided

    const include: any = includeSelections === 'false' ? false : {
      selections: {
        include: {
          bet: {
            include: {
              game: true
            }
          }
        }
      }
    };

    let parlays = await prisma.parlay.findMany({
      where,
      include,
      orderBy: { createdAt: 'desc' }
    });

    // If date is provided, filter parlays to only those with games on that date
    if (date && typeof date === 'string') {
      // Convert user's local date + timezone to UTC date range
      const { start: dateStart, end: dateEnd } = getUTCDateRange(date, timezoneOffset);

      // Filter parlays to only those where at least one game starts on the selected date
      parlays = parlays.filter(parlay => {
        if (!parlay.selections || parlay.selections.length === 0) return false;
        return parlay.selections.some(selection => {
          const gameStartTime = new Date(selection.bet.game.startTime);
          return gameStartTime >= dateStart && gameStartTime < dateEnd;
        });
      });
    }

    res.json({
      success: true,
      data: {
        parlays: parlays.map(parlay => formatParlayResponse(parlay, includeSelections !== 'false'))
      }
    });
  } catch (error: any) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        error: { message: error.message, code: error.code }
      });
    }
    logger.error('Error fetching parlays', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: { message: 'Internal server error', code: 'INTERNAL_ERROR' }
    });
  }
});

/**
 * GET /api/parlays/:parlayId
 * Get a specific parlay
 */
router.get('/:parlayId', requireAuth, requireFeature('PUBLIC_BETS_VIEW'), async (req: Request, res: Response) => {
  try {
    const { parlayId } = req.params;
    const userId = req.session.userId;

    validateUserAuthenticated(userId);

    const parlay = await getParlayWithSelections(prisma, parlayId);

    validateParlayOwnership(parlay, userId!);

    res.json({
      success: true,
      data: {
        parlay: formatParlayResponse(parlay, true, true) // Include selection status for GET /:parlayId
      }
    });
  } catch (error: any) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        error: { message: error.message, code: error.code }
      });
    }
    logger.error('Error fetching parlay', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: { message: 'Internal server error', code: 'INTERNAL_ERROR' }
    });
  }
});

/**
 * PATCH /api/parlays/:parlayId
 * Update a parlay (currently only for insurance toggle)
 */
router.patch('/:parlayId', requireAuth, requireFeature('PUBLIC_BETS_VIEW'), async (req: Request, res: Response) => {
  try {
    const { parlayId } = req.params;
    const { insured } = req.body;
    const userId = req.session.userId;

    validateUserAuthenticated(userId);

    if (typeof insured !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: { message: 'insured must be a boolean', code: 'VALIDATION_ERROR' }
      });
    }

    // Get parlay
    const parlay = await getParlayWithSelections(prisma, parlayId);

    validateParlayOwnership(parlay, userId!);
    validateParlayNotLocked(parlay);

    // Check if any games have started
    const anyGameStarted = parlay.selections.some(s => s.bet.game.status !== 'scheduled');
    if (anyGameStarted) {
      return res.status(400).json({
        success: false,
        error: { message: 'Cannot modify parlay with games that have started', code: 'GAME_STARTED' }
      });
    }

    // Get user for streak and insurance status
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        error: { message: 'User not found', code: 'NOT_FOUND' }
      });
    }

    // Handle insurance toggle
    if (insured && !parlay.insured) {
      await addInsuranceToParlay(prisma, parlay, user, parlayId, getInsuranceCost);
      logger.info('Insurance added to parlay', {
        userId,
        parlayId,
        insuranceCost: parlay.insuranceCost
      });
    } else if (!insured && parlay.insured) {
      await removeInsuranceFromParlay(prisma, parlay, user, parlayId);
      logger.info('Insurance removed from parlay', {
        userId,
        parlayId,
        refundAmount: parlay.insuranceCost
      });
    }

    // Get updated parlay
    const updatedParlay = await getParlayWithSelections(prisma, parlayId);

    if (!updatedParlay) {
      throw new Error('Failed to fetch updated parlay');
    }

    res.json({
      success: true,
      data: {
        parlay: formatParlayResponse(updatedParlay, true, false) // Don't include selection status for PATCH /:parlayId
      }
    });
  } catch (error: any) {
    if (error.status) {
      return res.status(error.status).json({
        success: false,
        error: { message: error.message, code: error.code }
      });
    }
    logger.error('Error updating parlay', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: { message: 'Internal server error', code: 'INTERNAL_ERROR' }
    });
  }
});

/**
 * DELETE /api/parlays/:parlayId
 * Delete a parlay
 */
router.delete('/:parlayId', requireAuth, requireFeature('PUBLIC_BETS_VIEW'), async (req: Request, res: Response) => {
  try {
    const { parlayId } = req.params;
    const userId = req.session.userId;

    validateUserAuthenticated(userId);

    // Get parlay
    const parlay = await prisma.parlay.findUnique({
      where: { id: parlayId }
    });

    validateParlayOwnership(parlay, userId!);
    validateParlayNotLocked(parlay);

    // Get user for insurance refund
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    // Refund insurance if applicable
    await handleInsuranceRefund(prisma, parlay, user, parlayId);

    // If parlay has only 1 bet, convert it back to a single bet instead of deleting
    if (parlay.betCount === 1) {
      // Update the selection to remove from parlay (convert to single bet)
      await prisma.userBetSelection.updateMany({
        where: { parlayId },
        data: {
          parlayId: null,
          status: 'selected'
        }
      });
    } else {
      // For multi-bet parlays, delete all selections (delete the bets entirely)
      await prisma.userBetSelection.deleteMany({
        where: { parlayId }
      });
    }

    // Delete parlay
    await prisma.parlay.delete({
      where: { id: parlayId }
    });

    logger.info('Parlay deleted', {
      userId,
      parlayId
    });

    res.json({
      success: true,
      data: { message: 'Parlay deleted successfully' }
    });
  } catch (error: any) {
    logger.error('Error deleting parlay', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      error: { message: 'Internal server error', code: 'INTERNAL_ERROR' }
    });
  }
});

export default router;

