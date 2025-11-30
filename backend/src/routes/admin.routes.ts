import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';
import { requireFeature } from '../middleware/featureFlags';
import { ApiSportsService } from '../services/apiSports.service';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import gamesRoutes from './admin/games.routes';
import betsRoutes from './admin/bets.routes';
import featureFlagsRoutes from './admin/featureFlags.routes';

const router = Router();
const prisma = new PrismaClient();
const apiSportsService = new ApiSportsService();

// Mount sub-routes
router.use('/games', gamesRoutes);
router.use('/bets', betsRoutes);
router.use('/feature-flags', featureFlagsRoutes);

/**
 * @swagger
 * /api/admin/sports:
 *   get:
 *     summary: Get list of supported sports
 *     tags: [Admin]
 *     security:
 *       - sessionAuth: []
 *     responses:
 *       200:
 *         description: Supported sports retrieved successfully
 */
router.get('/sports', requireAuth, requireAdmin, requireFeature('ADMIN_GAME_MANAGEMENT'), async (req: Request, res: Response) => {
  try {
    const sportsConfig = apiSportsService.getSupportedSports();
    res.json({
      success: true,
      data: { sports: sportsConfig }
    });
  } catch (error: any) {
    logger.error('Error getting sports', { error });
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to get sports', code: 'SERVER_ERROR' }
    });
  }
});

/**
 * @swagger
 * /api/admin/teams/{gameId}/roster:
 *   get:
 *     summary: Get roster for teams in a game
 *     tags: [Admin]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: path
 *         name: gameId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Roster data retrieved successfully
 */
router.get('/teams/:gameId/roster', requireAuth, requireAdmin, requireFeature('ADMIN_BET_MANAGEMENT'), async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;

    // Get game from database
    const game = await prisma.game.findUnique({
      where: { id: gameId },
    });

    if (!game) {
      return res.status(404).json({
        success: false,
        error: { message: 'Game not found', code: 'NOT_FOUND' }
      });
    }

    // Extract sport and league from game metadata
    const metadata = game.metadata as any;
    const league = metadata?.league;
    const apiData = metadata?.apiData;

    if (!league || !apiData) {
      return res.status(400).json({
        success: false,
        error: { message: 'Game metadata missing league or API data', code: 'VALIDATION_ERROR' }
      });
    }

    // Determine sport from game data
    const sportMap: Record<string, string> = {
      'BASKETBALL': 'basketball',
      'FOOTBALL': 'football',
      'BASEBALL': 'baseball',
      'HOCKEY': 'hockey',
      'SOCCER': 'soccer',
    };
    const sport = sportMap[game.sport] || game.sport.toLowerCase();
    
    // Get league slug - prefer abbreviation, fallback to id, then slug
    // For NHL, abbreviation is "NHL" but slug should be "nhl"
    const leagueSlug = (league.slug || league.id || league.abbreviation || '').toLowerCase();

    // Get team IDs from game
    const homeTeamId = apiData.teams?.home?.id;
    const awayTeamId = apiData.teams?.away?.id;

    if (!homeTeamId || !awayTeamId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Game missing team IDs', code: 'VALIDATION_ERROR' }
      });
    }

    // Fetch rosters for both teams
    const [homeRoster, awayRoster] = await Promise.all([
      apiSportsService.getTeamRoster(sport, leagueSlug, homeTeamId),
      apiSportsService.getTeamRoster(sport, leagueSlug, awayTeamId),
    ]);

    res.json({
      success: true,
      data: {
        home: {
          team: game.homeTeam,
          roster: homeRoster,
        },
        away: {
          team: game.awayTeam,
          roster: awayRoster,
        },
      }
    });
  } catch (error: any) {
    logger.error('Error fetching team rosters', { error });
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to fetch rosters', code: 'SERVER_ERROR' }
    });
  }
});

export default router;
