import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/admin';
import { requireFeature } from '../../middleware/featureFlags';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';
import { resolveBet, getSportConfig } from '../../services/betResolution.service';
import { ApiSportsService } from '../../services/apiSports.service';
import { generateDisplayText } from './utils/betDisplayText';
import type { BetConfig } from '../../interfaces';

const router = Router();
const prisma = new PrismaClient();
const apiSportsService = new ApiSportsService();

/**
 * @swagger
 * /api/admin/bets:
 *   post:
 *     summary: Create a new bet
 *     tags: [Admin]
 *     security:
 *       - sessionAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - game_id
 *               - bet_type
 *               - config
 *             properties:
 *               game_id:
 *                 type: string
 *               bet_type:
 *                 type: string
 *                 enum: [COMPARISON, THRESHOLD, EVENT]
 *               config:
 *                 type: object
 *               display_text_override:
 *                 type: string
 *     responses:
 *       200:
 *         description: Bet created successfully
 */
router.post('/', requireAuth, requireAdmin, requireFeature('ADMIN_BET_MANAGEMENT'), async (req: Request, res: Response) => {
  try {
    const { game_id, bet_type, config, display_text_override } = req.body;

    if (!game_id || !bet_type || !config) {
      return res.status(400).json({
        success: false,
        error: { message: 'game_id, bet_type, and config are required', code: 'VALIDATION_ERROR' }
      });
    }

    // Validate bet type
    if (!['COMPARISON', 'THRESHOLD', 'EVENT'].includes(bet_type)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid bet_type. Must be COMPARISON, THRESHOLD, or EVENT', code: 'VALIDATION_ERROR' }
      });
    }

    // Get game to verify it exists
    const game = await prisma.game.findUnique({
      where: { id: game_id }
    });

    if (!game) {
      return res.status(404).json({
        success: false,
        error: { message: 'Game not found', code: 'NOT_FOUND' }
      });
    }

    // Generate display text
    const displayText = display_text_override || generateDisplayText(bet_type, config);

    // Get current max priority for this game
    const maxPriorityResult = await prisma.bet.aggregate({
      where: { gameId: game_id },
      _max: { priority: true }
    });

    const priority = (maxPriorityResult._max.priority || 0) + 1;

    // Create bet
    const bet = await prisma.bet.create({
      data: {
        gameId: game_id,
        betType: bet_type,
        displayText: displayText as any,
        displayTextOverride: (display_text_override || null) as any,
        config: config as any,
        priority,
        outcome: 'pending',
        description: displayText, // Keep for backward compatibility
        betValue: '', // Keep for backward compatibility
        metadata: {}
      } as any
    });

    logger.info('Bet created', { 
      betId: bet.id, 
      gameId: game_id, 
      betType: bet_type,
      config: JSON.stringify(config),
      displayText
    });

    res.json({
      success: true,
      data: { bet }
    });
  } catch (error: any) {
    logger.error('Error creating bet', { error });
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to create bet', code: 'SERVER_ERROR' }
    });
  }
});

/**
 * @swagger
 * /api/admin/bets/{betId}:
 *   patch:
 *     summary: Update a bet
 *     tags: [Admin]
 */
router.patch('/:betId', requireAuth, requireAdmin, requireFeature('ADMIN_BET_MANAGEMENT'), async (req: Request, res: Response) => {
  try {
    const { betId } = req.params;
    const { bet_type, config, display_text_override, priority } = req.body;

    const bet = await prisma.bet.findUnique({
      where: { id: betId }
    });

    if (!bet) {
      return res.status(404).json({
        success: false,
        error: { message: 'Bet not found', code: 'NOT_FOUND' }
      });
    }

    const updateData: any = {};

    if (bet_type && config) {
      updateData.betType = bet_type;
      updateData.config = config as any;
      updateData.displayText = display_text_override || generateDisplayText(bet_type, config);
      if (display_text_override !== undefined) {
        updateData.displayTextOverride = display_text_override || null;
      }
    }

    if (priority !== undefined) {
      updateData.priority = priority;
    }

    const updated = await prisma.bet.update({
      where: { id: betId },
      data: updateData as any
    });

    logger.info('Bet updated', { betId, updates: Object.keys(updateData) });

    res.json({
      success: true,
      data: { bet: updated }
    });
  } catch (error: any) {
    logger.error('Error updating bet', { error });
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to update bet', code: 'SERVER_ERROR' }
    });
  }
});

/**
 * @swagger
 * /api/admin/bets/{betId}:
 *   delete:
 *     summary: Delete a bet
 *     tags: [Admin]
 */
router.delete('/:betId', requireAuth, requireAdmin, requireFeature('ADMIN_BET_MANAGEMENT'), async (req: Request, res: Response) => {
  try {
    const { betId } = req.params;

    await prisma.bet.delete({
      where: { id: betId }
    });

    logger.info('Bet deleted', { betId });

    res.json({
      success: true,
      data: { message: 'Bet deleted successfully' }
    });
  } catch (error: any) {
    logger.error('Error deleting bet', { error });
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to delete bet', code: 'SERVER_ERROR' }
    });
  }
});

/**
 * @swagger
 * /api/admin/bets/{betId}/resolve:
 *   post:
 *     summary: Manually trigger bet resolution for a specific bet
 *     tags: [Admin]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: betId
 *         required: true
 *         schema:
 *           type: string
 *         description: The ID of the bet to resolve
 *     responses:
 *       200:
 *         description: Bet resolved successfully
 *       400:
 *         description: Bet cannot be resolved (e.g., game not complete)
 *       404:
 *         description: Bet not found
 *       500:
 *         description: Server error
 */
router.post('/:betId/resolve', requireAuth, requireAdmin, requireFeature('ADMIN_BET_MANAGEMENT'), async (req: Request, res: Response) => {
  try {
    const { betId } = req.params;

    if (!betId) {
      return res.status(400).json({
        success: false,
        error: { message: 'betId is required', code: 'VALIDATION_ERROR' }
      });
    }

    // Get the bet with its game
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

    logger.info('Resolving bet', { betId, gameId: bet.gameId, betType: bet.betType });

    // Check if bet is already resolved
    if (bet.outcome && bet.outcome !== 'pending') {
      return res.status(400).json({
        success: false,
        error: {
          message: `Bet is already resolved with outcome: ${bet.outcome}`,
          code: 'ALREADY_RESOLVED',
          currentOutcome: bet.outcome
        }
      });
    }

    // Check if game has started
    const now = new Date();
    const gameStartTime = new Date(bet.game.startTime);
    
    if (gameStartTime > now) {
      const timeUntilStart = Math.round((gameStartTime.getTime() - now.getTime()) / 1000 / 60); // minutes
      return res.status(400).json({
        success: false,
        error: { 
          message: `Game has not started yet. Start time: ${gameStartTime.toISOString()}. Time until start: ${timeUntilStart} minutes`,
          code: 'GAME_NOT_STARTED',
          gameStartTime: gameStartTime.toISOString(),
          timeUntilStartMinutes: timeUntilStart
        }
      });
    }

    // Check game status - block postponed or canceled games
    const gameStatus = bet.game.status;
    if (gameStatus === 'postponed' || gameStatus === 'canceled') {
      return res.status(400).json({
        success: false,
        error: { 
          message: `Game is ${gameStatus}. Cannot resolve bets for ${gameStatus} games`,
          code: 'GAME_INVALID_STATUS',
          gameStatus
        }
      });
    }

    // Get game metadata to extract sport, league, and external ID
    const gameMetadata = bet.game.metadata as any;
    const apiData = gameMetadata?.apiData;
    const league = gameMetadata?.league;

    if (!apiData || !league) {
      return res.status(400).json({
        success: false,
        error: { message: 'Game metadata missing API data or league information', code: 'VALIDATION_ERROR' }
      });
    }

    // Extract sport and league from metadata
    const leagueId = league.id || league.abbreviation || league.slug;
    const sport = bet.game.sport;
    
    if (!leagueId || !sport) {
      return res.status(400).json({
        success: false,
        error: { message: 'Unable to determine sport or league from game data', code: 'VALIDATION_ERROR' }
      });
    }

    // Get external game ID (ESPN game ID)
    const externalGameId = bet.game.externalId || apiData.id || apiData.externalId;
    
    if (!externalGameId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Unable to determine external game ID', code: 'VALIDATION_ERROR' }
      });
    }

    // Fetch fresh game data from ESPN API
    logger.info(`Fetching game data from ESPN API for bet resolution: betId=${betId}, sport=${sport}, league=${leagueId}, gameId=${externalGameId}, gameExternalId=${bet.game.externalId}`);
    let gameData;
    try {
      gameData = await apiSportsService.getGameData(sport, leagueId, externalGameId);
      
      // Verify we got valid game data
      if (!gameData) {
        logger.error('Empty response from ESPN API', { sport, league: leagueId, gameId: externalGameId });
        return res.status(500).json({
          success: false,
          error: { 
            message: 'Failed to fetch game data from ESPN API (empty response)',
            code: 'GAME_DATA_FETCH_FAILED',
            url: `ESPN API: /${sport}/${leagueId}/scoreboard/${externalGameId}`
          }
        });
      }

      // Check if game has scores/status indicating it has started
      const gameStatusFromApi = gameData?.header?.competitions?.filter((competition: any) => competition.id === externalGameId)?.status?.type?.state;
      logger.info('Game data fetched successfully', { 
        gameId: externalGameId,
        apiGameStatus: gameStatusFromApi,
        hasHeader: !!gameData?.header,
        hasCompetitions: !!gameData?.header?.competitions
      });
      
      if (gameStatusFromApi === 'pre') {
        return res.status(400).json({
          success: false,
          error: { 
            message: 'Game has not started yet according to ESPN API',
            code: 'GAME_NOT_STARTED',
            apiGameStatus: gameStatusFromApi
          }
        });
      }

    } catch (error: any) {
      const errorUrl = `ESPN API: /${sport}/${leagueId}/scoreboard/${externalGameId}`;
      logger.error(`Error fetching game data from ESPN API in bet resolution: ${error.message || error.name || 'Unknown error'}`);
      logger.error(`URL: ${errorUrl}`);
      logger.error(`Parameters: betId=${betId}, sport=${sport}, league=${leagueId}, gameId=${externalGameId}, gameExternalId=${bet.game.externalId}`);
      logger.error(`Error name: ${error.name}, Error message: ${error.message}`);
      return res.status(500).json({
        success: false,
        error: { 
          message: `Failed to fetch game data from ESPN API: ${error.message || 'Unknown error'}`,
          code: 'GAME_DATA_FETCH_FAILED',
          details: error.message,
          url: errorUrl
        }
      });
    }

    // Get sport config dynamically based on sport
    let sportConfig;
    try {
      sportConfig = getSportConfig(sport);
    } catch (error: any) {
      logger.error('Sport config not found', { sport, error: error.message });
      return res.status(400).json({
        success: false,
        error: { 
          message: error.message || `Sport config not found for: ${sport}`,
          code: 'SPORT_CONFIG_NOT_FOUND'
        }
      });
    }

    // Resolve the bet
    const betConfig = bet.config as unknown as BetConfig;
    let resolutionResult;
    try {
      resolutionResult = resolveBet(betConfig, gameData, sportConfig);
    } catch (error: any) {
      logger.error('Error during bet resolution', { error, betId, betType: bet.betType });
      return res.status(500).json({
        success: false,
        error: { 
          message: `Error during bet resolution: ${error.message || 'Unknown error'}`,
          code: 'RESOLUTION_ERROR',
          details: error.message
        }
      });
    }

    // Check if bet resolution failed
    if (!resolutionResult.resolved) {
      logger.warn('Bet resolution failed', { betId, reason: resolutionResult.reason });
      return res.status(400).json({
        success: false,
        error: { 
          message: resolutionResult.reason || 'Bet cannot be resolved at this time',
          code: 'RESOLUTION_FAILED',
          details: resolutionResult
        }
      });
    }

    // Update bet in database
    const updatedBet = await prisma.bet.update({
      where: { id: betId },
      data: {
        outcome: resolutionResult.outcome || 'pending',
        resolvedAt: resolutionResult.resolutionUTCTime || new Date(),
        lastFetchedAt: new Date(),
        metadata: {
          ...((bet.metadata as any) || {}),
          resolution: {
            resolutionEventTime: resolutionResult.resolutionEventTime,
            resolutionUTCTime: resolutionResult.resolutionUTCTime,
            resolutionQuarter: resolutionResult.resolutionQuarter,
            resolutionStatSnapshot: resolutionResult.resolutionStatSnapshot
          }
        }
      }
    });

    // Update all user bet selections for this bet
    // Determine the winning side based on the actual stat values
    let winningSide: string | null = null;
    const statSnapshot = resolutionResult.resolutionStatSnapshot as any;
    
    if (betConfig.type === 'COMPARISON') {
      // For COMPARISON bets, determine which participant won
      if (statSnapshot?.participant_1?.adjustedStat > statSnapshot?.participant_2?.adjustedStat) {
        winningSide = 'participant_1';
      } else if (statSnapshot?.participant_1?.adjustedStat < statSnapshot?.participant_2?.adjustedStat) {
        winningSide = 'participant_2';
      }
      // If equal, it's a push (winningSide stays null)
    } else if (betConfig.type === 'THRESHOLD') {
      // For threshold bets, determine if over or under won based on actual stat
      const participantStat = statSnapshot?.participant?.stat;
      const threshold = statSnapshot?.threshold;
      
      if (participantStat > threshold) {
        winningSide = 'over';
      } else if (participantStat < threshold) {
        winningSide = 'under';
      }
      // If equal, it's a push (winningSide stays null)
    }

    // Update user bet selections
    const userSelections = await prisma.userBetSelection.findMany({
      where: { betId: betId }
    });

    let updatedSelections = 0;
    for (const selection of userSelections) {
      let selectionOutcome: 'win' | 'loss' | 'push' = 'loss';
      
      if (resolutionResult.outcome === 'push' || winningSide === null) {
        // Push: stat equals threshold or participants tied
        selectionOutcome = 'push';
      } else if (selection.selectedSide === winningSide) {
        // User selected the winning side
        selectionOutcome = 'win';
      } else {
        // User selected the losing side
        selectionOutcome = 'loss';
      }

      // Update selection status to resolved and store the outcome
      await prisma.userBetSelection.update({
        where: { id: selection.id },
        data: {
          status: 'resolved',
          outcome: selectionOutcome
        }
      });
      
      logger.info('Updated user bet selection', {
        selectionId: selection.id,
        userId: selection.userId,
        selectedSide: selection.selectedSide,
        outcome: selectionOutcome,
        winningSide
      });
      
      updatedSelections++;
    }

    logger.info('Bet resolved successfully', {
      betId,
      outcome: resolutionResult.outcome,
      updatedSelections
    });

    res.json({
      success: true,
      data: {
        bet: updatedBet,
        resolution: resolutionResult,
        updatedSelections
      }
    });
  } catch (error: any) {
    logger.error('Error resolving bet', { error, betId: req.params.betId });
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to resolve bet', code: 'SERVER_ERROR' }
    });
  }
});

export default router;

