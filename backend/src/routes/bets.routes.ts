import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

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
router.get('/today', async (req: Request, res: Response) => {
  try {
    // Get today's date range (start of today to end of today in UTC)
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    logger.info('Fetching today\'s bets', { 
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

export default router;

