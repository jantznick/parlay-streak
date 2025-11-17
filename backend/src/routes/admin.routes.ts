import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';
import { ApiSportsService } from '../services/apiSports.service';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();
const apiSportsService = new ApiSportsService();

/**
 * @swagger
 * /api/admin/games/fetch:
 *   post:
 *     summary: Fetch games for a specific date from API Sports
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
 *               - date
 *               - sport
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *                 example: "2025-01-15"
 *               sport:
 *                 type: string
 *                 enum: [basketball, football]
 *                 example: "basketball"
 *     responses:
 *       200:
 *         description: Games fetched and stored successfully
 */
router.post('/games/fetch', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { date, sport = 'basketball' } = req.body;

    if (!date) {
      return res.status(400).json({
        success: false,
        error: { message: 'Date is required', code: 'VALIDATION_ERROR' }
      });
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({
        success: false,
        error: { message: 'Invalid date format. Use YYYY-MM-DD', code: 'VALIDATION_ERROR' }
      });
    }

    // Fetch games from API Sports
    const apiGames = await apiSportsService.getGames(date);

    // Store games in database
    const storedGames = [];
    for (const apiGame of apiGames.sports) {
      for (const )
      // try {
      //   const game = await prisma.game.upsert({
      //     where: {
      //       externalId: apiGame.id.toString()
      //     },
      //     update: {
      //       homeTeam: apiGame.teams.home.name,
      //       awayTeam: apiGame.teams.away.name,
      //       startTime: new Date(apiGame.timestamp * 1000),
      //       status: apiGame.status.short.toLowerCase(),
      //       homeScore: apiGame.scores.home.total,
      //       awayScore: apiGame.scores.away.total,
      //       metadata: {
      //         apiData: apiGame,
      //       } as any,
      //       updatedAt: new Date()
      //     },
      //     create: {
      //       externalId: apiGame.id.toString(),
      //       sport: sport.toUpperCase(),
      //       homeTeam: apiGame.teams.home.name,
      //       awayTeam: apiGame.teams.away.name,
      //       startTime: new Date(apiGame.timestamp * 1000),
      //       status: apiGame.status.short.toLowerCase(),
      //       homeScore: apiGame.scores.home.total,
      //       awayScore: apiGame.scores.away.total,
      //       metadata: {
      //         apiData: apiGame
      //       } as any
      //     }
      //   });

      //   storedGames.push(game);
      // } catch (error) {
      //   logger.error('Error storing game', { gameId: apiGame.id, error });
      // }
    }

    res.json({
      success: true,
      data: {
        games: storedGames,
        count: storedGames.length,
        date,
        sport
      }
    });
  } catch (error: any) {
    logger.error('Error fetching games', { error });
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to fetch games', code: 'SERVER_ERROR' }
    });
  }
});

/**
 * @swagger
 * /api/admin/games:
 *   get:
 *     summary: Get games for a specific date from database
 *     tags: [Admin]
 *     security:
 *       - sessionAuth: []
 *     parameters:
 *       - in: query
 *         name: date
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         example: "2025-01-15"
 *       - in: query
 *         name: sport
 *         required: false
 *         schema:
 *           type: string
 *           enum: [BASKETBALL, FOOTBALL]
 *         example: "BASKETBALL"
 *     responses:
 *       200:
 *         description: Games retrieved successfully
 */
router.get('/games', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { date, sport } = req.query;

    if (!date || typeof date !== 'string') {
      return res.status(400).json({
        success: false,
        error: { message: 'Date is required', code: 'VALIDATION_ERROR' }
      });
    }

    // Build query
    const startDate = new Date(date);
    startDate.setUTCHours(0, 0, 0, 0);
    const endDate = new Date(date);
    endDate.setUTCHours(23, 59, 59, 999);

    const where: any = {
      startTime: {
        gte: startDate,
        lte: endDate
      }
    };

    if (sport && typeof sport === 'string') {
      where.sport = sport.toUpperCase();
    }

    const games = await prisma.game.findMany({
      where,
      orderBy: { startTime: 'asc' },
      include: {
        bets: {
          orderBy: { priority: 'asc' }
        }
      }
    });

    res.json({
      success: true,
      data: {
        games,
        count: games.length,
        date
      }
    });
  } catch (error: any) {
    logger.error('Error retrieving games', { error });
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to retrieve games', code: 'SERVER_ERROR' }
    });
  }
});

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
router.get('/sports', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const sports = apiSportsService.getSupportedSports();
    res.json({
      success: true,
      data: { sports }
    });
  } catch (error: any) {
    logger.error('Error getting sports', { error });
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to get sports', code: 'SERVER_ERROR' }
    });
  }
});

export default router;

