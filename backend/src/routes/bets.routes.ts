import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { requireFeature } from '../middleware/featureFlags';
import { requireAuth } from '../middleware/auth';
import { parseDateAndTimezone, getLocalDateString, getUTCDateRange } from '../utils/dateUtils';

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
    const { date, timezoneOffset } = parseDateAndTimezone(req);
    
    // If no date provided, fallback to calculating from timezone offset or server date
    const localDateStr = getLocalDateString(date, timezoneOffset);
    
    // Convert user's local date + timezone to UTC date range
    const { start: today, end: tomorrow } = getUTCDateRange(localDateStr, timezoneOffset);

    logger.info('Fetching bets', { 
      localDate: localDateStr,
      timezoneOffset: timezoneOffset ?? 'not provided (using UTC)',
      today: today.toISOString(), 
      tomorrow: tomorrow.toISOString()
    });

    // Get all games that start on the requested date (in UTC) and have at least one bet
    // Show all bets regardless of outcome (pending, win, loss, push) so users can see all available bets
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
            // Only filter by visibility - show all bets that are visible
            OR: [
              { visibleFrom: null },
              { visibleFrom: { lte: new Date() } }
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

    // Get date and timezone offset from query params (optional)
    // If provided, filter by game start time for that date
    const { date, timezoneOffset } = parseDateAndTimezone(req);

    // Build where clause
    let where: any = {
      userId,
      parlayId: null, // Only single bets
    };

    // When date is provided, return all statuses for historical viewing (consistent with parlays)
    // When no date is provided, still return all statuses (these are the only 3 statuses for bets anyway)
    // Statuses: 'selected', 'locked', 'resolved'
    // No status filter needed - we want all statuses

    // If date is provided, filter by game start time
    // First, find games in the date range, then filter selections by bet IDs
    let betIdsInDateRange: string[] | undefined;
    if (date) {
      // Convert user's local date + timezone to UTC date range
      const { start: dateStart, end: dateEnd } = getUTCDateRange(date, timezoneOffset);
      
      // Find all games in the date range
      const gamesInRange = await prisma.game.findMany({
        where: {
          startTime: {
            gte: dateStart,
            lt: dateEnd
          }
        },
        select: {
          id: true
        }
      });

      const gameIds = gamesInRange.map(g => g.id);

      // Find all bets for these games
      const betsInRange = await prisma.bet.findMany({
        where: {
          gameId: {
            in: gameIds
          }
        },
        select: {
          id: true
        }
      });

      betIdsInDateRange = betsInRange.map(b => b.id);
      
      // Filter selections by bet IDs
      if (betIdsInDateRange.length > 0) {
        where.betId = {
          in: betIdsInDateRange
        };
      } else {
        // No bets in date range, return empty result
        where.betId = {
          in: [] // Empty array means no results
        };
      }
    }

    // Get all bet selections for the user (single bets only, not in parlays)
    const selections = await prisma.userBetSelection.findMany({
      where,
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
                homeScore: true,
                awayScore: true,
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
          outcome: sel.outcome, // Include selection outcome (win/loss/push)
          createdAt: sel.createdAt,
          bet: {
            id: sel.bet.id,
            displayText: sel.bet.displayText,
            betType: sel.bet.betType,
            outcome: sel.bet.outcome,
            config: sel.bet.config, // Include config for participant names
            game: {
              id: sel.bet.game.id,
              homeTeam: sel.bet.game.homeTeam,
              awayTeam: sel.bet.game.awayTeam,
              startTime: sel.bet.game.startTime,
              status: sel.bet.game.status,
              sport: sel.bet.game.sport,
              homeScore: sel.bet.game.homeScore, // Include scores
              awayScore: sel.bet.game.awayScore, // Include scores
              metadata: sel.bet.game.metadata
            }
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

