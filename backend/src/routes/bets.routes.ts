import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { requireFeature } from '../middleware/featureFlags';
import { requireAuth } from '../middleware/auth';

const router = Router();
const prisma = new PrismaClient();

/**
 * @swagger
 * /api/bets/today:
 *   get:
 *     summary: Get all visible bets for today's games
 *     tags: [Bets]
 *     responses:
 *       200:
 *         description: Bets retrieved successfully
 */
router.get('/today', requireFeature('PUBLIC_BETS_VIEW'), async (req: Request, res: Response) => {
  try {
    // Get date and timezone offset from query params
    // date should be in format YYYY-MM-DD (user's local date)
    // timezoneOffset is the user's timezone offset in hours (e.g., -5 for EST)
    const date = req.query.date as string | undefined;
    const timezoneOffset = req.query.timezoneOffset 
      ? parseInt(req.query.timezoneOffset as string, 10) 
      : undefined;
    
    // If no date provided, fallback to calculating from timezone offset or server date
    let localDateStr: string;
    if (date) {
      // Use the provided date (user's local date)
      localDateStr = date;
    } else if (timezoneOffset !== undefined) {
      // Calculate what date it is in the user's timezone
      const now = new Date();
      const utcTime = now.getTime() + (now.getTimezoneOffset() * 60 * 1000);
      const localTime = utcTime + (timezoneOffset * 60 * 60 * 1000);
      const localDate = new Date(localTime);
      localDateStr = localDate.toISOString().split('T')[0];
    } else {
      // Fallback to server's local date
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      localDateStr = `${year}-${month}-${day}`;
    }
    
    // Convert user's local date + timezone to UTC date range
    function getUTCDateRange(dateStr: string, offset: number | undefined): { start: Date; end: Date } {
      const [year, month, day] = dateStr.split('-').map(Number);
      const offsetHours = offset ?? 0;
      // Create date representing midnight in user's local timezone
      const localMidnight = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
      // Convert to UTC by subtracting the offset
      const startUTC = new Date(localMidnight.getTime() - (offsetHours * 60 * 60 * 1000));
      const endUTC = new Date(startUTC.getTime() + (24 * 60 * 60 * 1000));
      return { start: startUTC, end: endUTC };
    }
    
    const { start: today, end: tomorrow } = getUTCDateRange(localDateStr, timezoneOffset);

    logger.info('Fetching today\'s bets', { 
      localDate: localDateStr,
      timezoneOffset: timezoneOffset ?? 'not provided (using UTC)',
      today: today.toISOString(), 
      tomorrow: tomorrow.toISOString() 
    });

    // Get all games that start today (in UTC) and have at least one available bet
    const allGames = await prisma.game.findMany({
      where: {
        startTime: {
          gte: today,
          lt: tomorrow
        }
      },
      include: {
        bets: {
          where: {
            // Only show bets that are:
            // 1. Visible (visible_from is null or in the past)
            // 2. Pending (available to bet on)
            AND: [
              {
                OR: [
                  { visibleFrom: null },
                  { visibleFrom: { lte: new Date() } }
                ]
              },
              {
                outcome: 'pending'
              }
            ]
          },
          orderBy: { priority: 'asc' }
        }
      },
      orderBy: { startTime: 'asc' }
    });

    // Filter to only games that have at least one available bet
    const gamesWithBets = allGames.filter(game => game.bets.length > 0);

    logger.info('Found games for today', { 
      totalGames: allGames.length,
      gamesWithAvailableBets: gamesWithBets.length,
      totalAvailableBets: gamesWithBets.reduce((sum, g) => sum + g.bets.length, 0)
    });

    res.json({
      success: true,
      data: {
        games: gamesWithBets,
        count: gamesWithBets.length,
        date: today.toISOString().split('T')[0]
      }
    });
  } catch (error: any) {
    logger.error('Error fetching today\'s bets', { error });
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to fetch bets', code: 'SERVER_ERROR' }
    });
  }
});

/**
 * @swagger
 * /api/bets/:betId/select:
 *   post:
 *     summary: Select a bet and choose a side (single bet, not a parlay)
 *     tags: [Bets]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: betId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - selectedSide
 *             properties:
 *               selectedSide:
 *                 type: string
 *                 enum: [participant_1, participant_2, over, under, yes, no]
 *     responses:
 *       200:
 *         description: Bet selection created successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Bet not found
 */
router.post('/:betId/select', requireAuth, requireFeature('PUBLIC_BETS_VIEW'), async (req: Request, res: Response) => {
  try {
    const { betId } = req.params;
    const { selectedSide } = req.body;
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { message: 'Authentication required', code: 'AUTH_REQUIRED' }
      });
    }

    // Validate selectedSide
    if (!selectedSide) {
      return res.status(400).json({
        success: false,
        error: { message: 'selectedSide is required', code: 'VALIDATION_ERROR' }
      });
    }

    const validSides = ['participant_1', 'participant_2', 'over', 'under', 'yes', 'no'];
    if (!validSides.includes(selectedSide)) {
      return res.status(400).json({
        success: false,
        error: { 
          message: `selectedSide must be one of: ${validSides.join(', ')}`, 
          code: 'VALIDATION_ERROR' 
        }
      });
    }

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
    const betType = bet.betType;
    const config = bet.config as any;

    if (betType === 'COMPARISON') {
      if (selectedSide !== 'participant_1' && selectedSide !== 'participant_2') {
        return res.status(400).json({
          success: false,
          error: { 
            message: 'For COMPARISON bets, selectedSide must be "participant_1" or "participant_2"', 
            code: 'VALIDATION_ERROR' 
          }
        });
      }
    } else if (betType === 'THRESHOLD') {
      if (selectedSide !== 'over' && selectedSide !== 'under') {
        return res.status(400).json({
          success: false,
          error: { 
            message: 'For THRESHOLD bets, selectedSide must be "over" or "under"', 
            code: 'VALIDATION_ERROR' 
          }
        });
      }
    } else if (betType === 'EVENT') {
      if (selectedSide !== 'yes' && selectedSide !== 'no') {
        return res.status(400).json({
          success: false,
          error: { 
            message: 'For EVENT bets, selectedSide must be "yes" or "no"', 
            code: 'VALIDATION_ERROR' 
          }
        });
      }
    }

    // Create UserBetSelection
    const selection = await prisma.userBetSelection.create({
      data: {
        userId,
        betId,
        selectedSide,
        parlayId: null, // Single bet, not in a parlay
        status: 'selected'
      },
      include: {
        bet: {
          select: {
            id: true,
            displayText: true,
            betType: true
          }
        }
      }
    });

    logger.info('User bet selection created', {
      userId,
      betId,
      selectedSide,
      selectionId: selection.id
    });

    res.json({
      success: true,
      data: {
        selection: {
          id: selection.id,
          betId: selection.betId,
          selectedSide: selection.selectedSide,
          status: selection.status,
          createdAt: selection.createdAt
        }
      }
    });
  } catch (error: any) {
    logger.error('Error creating bet selection', { error, betId: req.params.betId });
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to create bet selection', code: 'SERVER_ERROR' }
    });
  }
});

/**
 * @swagger
 * /api/bets/my-selections:
 *   get:
 *     summary: Get all bet selections for the current user
 *     tags: [Bets]
 *     security:
 *       - sessionAuth: []
 *     responses:
 *       200:
 *         description: Bet selections retrieved successfully
 *       401:
 *         description: Not authenticated
 */
router.get('/my-selections', requireAuth, requireFeature('PUBLIC_BETS_VIEW'), async (req: Request, res: Response) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { message: 'Authentication required', code: 'AUTH_REQUIRED' }
      });
    }

    // Get all bet selections for the user (single bets only, not in parlays)
    const selections = await prisma.userBetSelection.findMany({
      where: {
        userId,
        parlayId: null, // Only single bets
        status: {
          in: ['selected', 'locked'] // Only active selections
        }
      },
      include: {
        bet: {
          include: {
            game: {
              select: {
                id: true,
                homeTeam: true,
                awayTeam: true,
                startTime: true,
                status: true,
                sport: true,
                metadata: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    logger.info('Fetched user bet selections', {
      userId,
      count: selections.length
    });

    res.json({
      success: true,
      data: {
        selections: selections.map(sel => ({
          id: sel.id,
          betId: sel.betId,
          selectedSide: sel.selectedSide,
          status: sel.status,
          createdAt: sel.createdAt,
          bet: {
            id: sel.bet.id,
            displayText: sel.bet.displayText,
            betType: sel.bet.betType,
            outcome: sel.bet.outcome,
            config: sel.bet.config, // Include config for participant names
            game: sel.bet.game
          }
        }))
      }
    });
  } catch (error: any) {
    logger.error('Error fetching user bet selections', { error });
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to fetch bet selections', code: 'SERVER_ERROR' }
    });
  }
});

/**
 * @swagger
 * /api/bets/selections/:selectionId:
 *   delete:
 *     summary: Delete a bet selection (only if game hasn't started)
 *     tags: [Bets]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: selectionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Bet selection deleted successfully
 *       400:
 *         description: Cannot delete (game started, etc.)
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Selection not found
 */
router.delete('/selections/:selectionId', requireAuth, requireFeature('PUBLIC_BETS_VIEW'), async (req: Request, res: Response) => {
  try {
    const { selectionId } = req.params;
    const userId = req.session.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { message: 'Authentication required', code: 'AUTH_REQUIRED' }
      });
    }

    // Get the selection with bet and game info
    const selection = await prisma.userBetSelection.findUnique({
      where: { id: selectionId },
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
        error: { message: 'Bet selection not found', code: 'NOT_FOUND' }
      });
    }

    // Verify ownership
    if (selection.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: { message: 'Not authorized to delete this selection', code: 'FORBIDDEN' }
      });
    }

    // Check if game has started
    if (selection.bet.game.status !== 'scheduled') {
      return res.status(400).json({
        success: false,
        error: { message: 'Cannot delete selection for a game that has already started', code: 'GAME_STARTED' }
      });
    }

    // Check if selection is locked
    if (selection.status === 'locked') {
      return res.status(400).json({
        success: false,
        error: { message: 'Cannot delete a locked selection', code: 'SELECTION_LOCKED' }
      });
    }

    // Delete the selection
    await prisma.userBetSelection.delete({
      where: { id: selectionId }
    });

    logger.info('User bet selection deleted', {
      userId,
      selectionId,
      betId: selection.betId
    });

    res.json({
      success: true,
      data: { message: 'Bet selection deleted successfully' }
    });
  } catch (error: any) {
    logger.error('Error deleting bet selection', { error, selectionId: req.params.selectionId });
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to delete bet selection', code: 'SERVER_ERROR' }
    });
  }
});

export default router;

