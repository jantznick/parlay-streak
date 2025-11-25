import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { requireAuth } from '../middleware/auth';
import { requireFeature } from '../middleware/featureFlags';
import { parseDateAndTimezone, getUTCDateRange } from '../utils/dateUtils';

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

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { message: 'Authentication required', code: 'AUTH_REQUIRED' }
      });
    }

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

      if (!selection) {
        return res.status(404).json({
          success: false,
          error: { message: 'Selection not found', code: 'NOT_FOUND' }
        });
      }

      if (selection.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: { message: 'Selection does not belong to user', code: 'FORBIDDEN' }
        });
      }

      if (selection.parlayId !== null) {
        return res.status(400).json({
          success: false,
          error: { message: 'Selection is already in a parlay', code: 'VALIDATION_ERROR' }
        });
      }

      // Check if game has started
      if (selection.bet.game.status !== 'scheduled') {
        return res.status(400).json({
          success: false,
          error: { message: 'Cannot add bets from games that have already started', code: 'GAME_STARTED' }
        });
      }
    } else {
      // Flow 2: Create new selection
      // Get bet with game info
      const bet = await prisma.bet.findUnique({
        where: { id: betId },
        include: {
          game: true
        }
      });

      if (!bet) {
        return res.status(404).json({
          success: false,
          error: { message: 'Bet not found', code: 'NOT_FOUND' }
        });
      }

      // Validate bet is available
      if (bet.outcome !== 'pending') {
        return res.status(400).json({
          success: false,
          error: { message: 'Bet is no longer available for selection', code: 'BET_UNAVAILABLE' }
        });
      }

      // Check if bet is visible
      if (bet.visibleFrom && bet.visibleFrom > new Date()) {
        return res.status(400).json({
          success: false,
          error: { message: 'Bet is not yet visible', code: 'BET_NOT_VISIBLE' }
        });
      }

      // Check if game has started
      if (bet.game.status !== 'scheduled') {
        return res.status(400).json({
          success: false,
          error: { message: 'Cannot select bets for games that have already started', code: 'GAME_STARTED' }
        });
      }

      // Validate selectedSide matches bet type
      if (!validateSelectedSide(bet.betType, selectedSide)) {
        return res.status(400).json({
          success: false,
          error: { 
            message: `Invalid selectedSide for bet type ${bet.betType}`, 
            code: 'VALIDATION_ERROR' 
          }
        });
      }

      // Create new UserBetSelection
      selection = await prisma.userBetSelection.create({
        data: {
          userId,
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
        userId,
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
    const parlayWithSelections = await prisma.parlay.findUnique({
      where: { id: parlay.id },
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

    logger.info('Parlay created', {
      userId,
      parlayId: parlay.id,
      selectionId: selection.id
    });

    res.json({
      success: true,
      data: {
        parlay: {
          id: parlayWithSelections!.id,
          betCount: parlayWithSelections!.betCount,
          parlayValue: parlayWithSelections!.parlayValue,
          insured: parlayWithSelections!.insured,
          insuranceCost: parlayWithSelections!.insuranceCost,
          status: parlayWithSelections!.status,
          selections: parlayWithSelections!.selections.map(s => ({
            id: s.id,
            bet: s.bet,
            selectedSide: s.selectedSide,
            game: s.bet.game
          })),
          createdAt: parlayWithSelections!.createdAt.toISOString()
        }
      }
    });
  } catch (error: any) {
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

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { message: 'Authentication required', code: 'AUTH_REQUIRED' }
      });
    }

    // Get parlay
    const parlay = await prisma.parlay.findUnique({
      where: { id: parlayId },
      include: {
        selections: true
      }
    });

    if (!parlay) {
      return res.status(404).json({
        success: false,
        error: { message: 'Parlay not found', code: 'NOT_FOUND' }
      });
    }

    if (parlay.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: { message: 'Parlay does not belong to user', code: 'FORBIDDEN' }
      });
    }

    // Check if parlay is locked
    if (parlay.lockedAt !== null) {
      return res.status(400).json({
        success: false,
        error: { message: 'Parlay is locked and cannot be modified', code: 'PARLAY_LOCKED' }
      });
    }

    // Check if parlay already has 5 selections
    if (parlay.selections.length >= 5) {
      return res.status(400).json({
        success: false,
        error: { message: 'Parlay already has maximum number of bets (5)', code: 'VALIDATION_ERROR' }
      });
    }

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

      if (!selection) {
        return res.status(404).json({
          success: false,
          error: { message: 'Selection not found', code: 'NOT_FOUND' }
        });
      }

      if (selection.userId !== userId) {
        return res.status(403).json({
          success: false,
          error: { message: 'Selection does not belong to user', code: 'FORBIDDEN' }
        });
      }

      if (selection.parlayId !== null) {
        return res.status(400).json({
          success: false,
          error: { message: 'Selection is already in a parlay', code: 'VALIDATION_ERROR' }
        });
      }

      // Check if game has started
      if (selection.bet.game.status !== 'scheduled') {
        return res.status(400).json({
          success: false,
          error: { message: 'Cannot add bets from games that have already started', code: 'GAME_STARTED' }
        });
      }
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

      if (!bet) {
        return res.status(404).json({
          success: false,
          error: { message: 'Bet not found', code: 'NOT_FOUND' }
        });
      }

      // Validate bet is available
      if (bet.outcome !== 'pending') {
        return res.status(400).json({
          success: false,
          error: { message: 'Bet is no longer available for selection', code: 'BET_UNAVAILABLE' }
        });
      }

      // Check if bet is visible
      if (bet.visibleFrom && bet.visibleFrom > new Date()) {
        return res.status(400).json({
          success: false,
          error: { message: 'Bet is not yet visible', code: 'BET_NOT_VISIBLE' }
        });
      }

      // Check if game has started
      if (bet.game.status !== 'scheduled') {
        return res.status(400).json({
          success: false,
          error: { message: 'Cannot select bets for games that have already started', code: 'GAME_STARTED' }
        });
      }

      // Validate selectedSide matches bet type
      if (!validateSelectedSide(bet.betType, selectedSide)) {
        return res.status(400).json({
          success: false,
          error: { 
            message: `Invalid selectedSide for bet type ${bet.betType}`, 
            code: 'VALIDATION_ERROR' 
          }
        });
      }

      // Create new UserBetSelection
      selection = await prisma.userBetSelection.create({
        data: {
          userId,
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
    const updatedParlay = await prisma.parlay.findUnique({
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

    logger.info('Selection added to parlay', {
      userId,
      parlayId,
      selectionId: selection.id
    });

    res.json({
      success: true,
      data: {
        parlay: {
          id: updatedParlay!.id,
          betCount: updatedParlay!.betCount,
          parlayValue: updatedParlay!.parlayValue,
          insured: updatedParlay!.insured,
          insuranceCost: updatedParlay!.insuranceCost,
          status: updatedParlay!.status,
          selections: updatedParlay!.selections.map(s => ({
            id: s.id,
            bet: s.bet,
            selectedSide: s.selectedSide,
            game: s.bet.game
          })),
          createdAt: updatedParlay!.createdAt.toISOString()
        }
      }
    });
  } catch (error: any) {
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

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { message: 'Authentication required', code: 'AUTH_REQUIRED' }
      });
    }

    // Get parlay
    const parlay = await prisma.parlay.findUnique({
      where: { id: parlayId },
      include: {
        selections: true
      }
    });

    if (!parlay) {
      return res.status(404).json({
        success: false,
        error: { message: 'Parlay not found', code: 'NOT_FOUND' }
      });
    }

    if (parlay.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: { message: 'Parlay does not belong to user', code: 'FORBIDDEN' }
      });
    }

    // Check if parlay is locked
    if (parlay.lockedAt !== null) {
      return res.status(400).json({
        success: false,
        error: { message: 'Parlay is locked and cannot be modified', code: 'PARLAY_LOCKED' }
      });
    }

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

    // Get updated parlay
    const updatedParlay = await prisma.parlay.findUnique({
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

    logger.info('Selection removed from parlay', {
      userId,
      parlayId,
      selectionId
    });

    res.json({
      success: true,
      data: {
        parlay: {
          id: updatedParlay!.id,
          betCount: updatedParlay!.betCount,
          parlayValue: updatedParlay!.parlayValue,
          insured: updatedParlay!.insured,
          insuranceCost: updatedParlay!.insuranceCost,
          status: updatedParlay!.status,
          selections: updatedParlay!.selections.map(s => ({
            id: s.id,
            bet: s.bet,
            selectedSide: s.selectedSide,
            game: s.bet.game
          })),
          createdAt: updatedParlay!.createdAt.toISOString()
        }
      }
    });
  } catch (error: any) {
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

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { message: 'Authentication required', code: 'AUTH_REQUIRED' }
      });
    }

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
        parlays: parlays.map(parlay => ({
          id: parlay.id,
          betCount: parlay.betCount,
          parlayValue: parlay.parlayValue,
          insured: parlay.insured,
          insuranceCost: parlay.insuranceCost,
          status: parlay.status,
          lockedAt: parlay.lockedAt?.toISOString(),
          resolvedAt: parlay.resolvedAt?.toISOString(),
          lastGameEndTime: parlay.lastGameEndTime?.toISOString(),
          selections: include ? parlay.selections.map(s => ({
            id: s.id,
            bet: s.bet,
            selectedSide: s.selectedSide,
            status: s.status,
            game: s.bet.game
          })) : undefined,
          createdAt: parlay.createdAt.toISOString()
        }))
      }
    });
  } catch (error: any) {
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

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { message: 'Authentication required', code: 'AUTH_REQUIRED' }
      });
    }

    const parlay = await prisma.parlay.findUnique({
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

    if (!parlay) {
      return res.status(404).json({
        success: false,
        error: { message: 'Parlay not found', code: 'NOT_FOUND' }
      });
    }

    if (parlay.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: { message: 'Parlay does not belong to user', code: 'FORBIDDEN' }
      });
    }

    res.json({
      success: true,
      data: {
        parlay: {
          id: parlay.id,
          betCount: parlay.betCount,
          parlayValue: parlay.parlayValue,
          insured: parlay.insured,
          insuranceCost: parlay.insuranceCost,
          status: parlay.status,
          lockedAt: parlay.lockedAt?.toISOString(),
          resolvedAt: parlay.resolvedAt?.toISOString(),
          lastGameEndTime: parlay.lastGameEndTime?.toISOString(),
          selections: parlay.selections.map(s => ({
            id: s.id,
            bet: s.bet,
            selectedSide: s.selectedSide,
            status: s.status,
            game: s.bet.game
          })),
          createdAt: parlay.createdAt.toISOString()
        }
      }
    });
  } catch (error: any) {
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

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { message: 'Authentication required', code: 'AUTH_REQUIRED' }
      });
    }

    if (typeof insured !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: { message: 'insured must be a boolean', code: 'VALIDATION_ERROR' }
      });
    }

    // Get parlay
    const parlay = await prisma.parlay.findUnique({
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

    if (!parlay) {
      return res.status(404).json({
        success: false,
        error: { message: 'Parlay not found', code: 'NOT_FOUND' }
      });
    }

    if (parlay.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: { message: 'Parlay does not belong to user', code: 'FORBIDDEN' }
      });
    }

    // Check if parlay is locked
    if (parlay.lockedAt !== null) {
      return res.status(400).json({
        success: false,
        error: { message: 'Parlay is locked and cannot be modified', code: 'PARLAY_LOCKED' }
      });
    }

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
      // Adding insurance
      if (parlay.betCount < 4) {
        return res.status(400).json({
          success: false,
          error: { message: 'Insurance only available for 4-5 bet parlays', code: 'VALIDATION_ERROR' }
        });
      }

      if (user.insuranceLocked) {
        return res.status(400).json({
          success: false,
          error: { message: 'Insurance is locked. Complete an uninsured bet first.', code: 'INSURANCE_LOCKED' }
        });
      }

      const insuranceCost = getInsuranceCost(parlay.parlayValue, user.currentStreak);
      const newStreak = Math.max(0, user.currentStreak - insuranceCost);

      // Update user streak and insurance status
      await prisma.user.update({
        where: { id: userId },
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

      logger.info('Insurance added to parlay', {
        userId,
        parlayId,
        insuranceCost,
        newStreak
      });
    } else if (!insured && parlay.insured) {
      // Removing insurance
      const refundAmount = parlay.insuranceCost;
      const newStreak = user.currentStreak + refundAmount;

      // Update user streak and insurance status
      const updateData: any = {
        currentStreak: newStreak
      };

      // Only unlock insurance if this was the locked parlay
      if (user.lastInsuredParlayId === parlayId) {
        updateData.insuranceLocked = false;
        updateData.lastInsuredParlayId = null;
      }

      await prisma.user.update({
        where: { id: userId },
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

      logger.info('Insurance removed from parlay', {
        userId,
        parlayId,
        refundAmount,
        newStreak
      });
    }

    // Get updated parlay
    const updatedParlay = await prisma.parlay.findUnique({
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

    res.json({
      success: true,
      data: {
        parlay: {
          id: updatedParlay!.id,
          betCount: updatedParlay!.betCount,
          parlayValue: updatedParlay!.parlayValue,
          insured: updatedParlay!.insured,
          insuranceCost: updatedParlay!.insuranceCost,
          status: updatedParlay!.status,
          selections: updatedParlay!.selections.map(s => ({
            id: s.id,
            bet: s.bet,
            selectedSide: s.selectedSide,
            game: s.bet.game
          })),
          createdAt: updatedParlay!.createdAt.toISOString()
        }
      }
    });
  } catch (error: any) {
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

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { message: 'Authentication required', code: 'AUTH_REQUIRED' }
      });
    }

    // Get parlay
    const parlay = await prisma.parlay.findUnique({
      where: { id: parlayId }
    });

    if (!parlay) {
      return res.status(404).json({
        success: false,
        error: { message: 'Parlay not found', code: 'NOT_FOUND' }
      });
    }

    if (parlay.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: { message: 'Parlay does not belong to user', code: 'FORBIDDEN' }
      });
    }

    // Check if parlay is locked
    if (parlay.lockedAt !== null) {
      return res.status(400).json({
        success: false,
        error: { message: 'Parlay is locked and cannot be deleted', code: 'PARLAY_LOCKED' }
      });
    }

    // Get user for insurance refund
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    // Refund insurance if applicable
    if (parlay.insured && user) {
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
        where: { id: userId },
        data: updateData
      });
    }

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

