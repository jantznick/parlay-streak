import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/admin';
import { requireFeature } from '../../middleware/featureFlags';
import { ApiSportsService } from '../../services/apiSports.service';
import { PrismaClient } from '@prisma/client';
import { logger } from '../../utils/logger';
import { getUTCDateRange } from '../../utils/dateUtils';

const router = Router();
const prisma = new PrismaClient();
const apiSportsService = new ApiSportsService();

/**
 * @swagger
 * /api/admin/games/fetch:
 *   post:
 *     summary: Fetch games from ESPN API, store in database, and return stored games
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
 *               - league
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *                 example: "2025-01-15"
 *               sport:
 *                 type: string
 *                 example: "basketball"
 *               league:
 *                 type: string
 *                 example: "nba"
 *     responses:
 *       200:
 *         description: Games fetched from ESPN, stored in DB, and returned
 */
router.post('/fetch', requireAuth, requireAdmin, requireFeature('ADMIN_GAME_MANAGEMENT'), async (req: Request, res: Response) => {
  try {
    const { date, sport, league, force, timezoneOffset } = req.body;

    // Validate required fields
    if (!date || !sport || !league) {
      return res.status(400).json({
        success: false,
        error: { message: 'date, sport, and league are required', code: 'VALIDATION_ERROR' }
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

    // Convert user's date + timezone to UTC range for querying
    const { start: requestedDateStart, end: requestedDateEnd } = getUTCDateRange(date, timezoneOffset);
    
    logger.info('Date range calculation', {
      date,
      timezoneOffset: timezoneOffset ?? 'not provided (using UTC)',
      utcStart: requestedDateStart.toISOString(),
      utcEnd: requestedDateEnd.toISOString()
    });

    // Step 1: Check if we have games in DB for this date/sport/league
    logger.info('Checking database for existing games', { 
      date, 
      sport, 
      league,
      timezoneOffset: timezoneOffset ?? 'not provided',
      utcRange: {
        start: requestedDateStart.toISOString(),
        end: requestedDateEnd.toISOString()
      }
    });
    
    // First get all games for the date and sport using UTC range
    const allGamesForDate = await prisma.game.findMany({
      where: {
        startTime: {
          gte: requestedDateStart,
          lt: requestedDateEnd
        },
        sport: sport.toUpperCase()
      },
      include: {
        bets: {
          orderBy: { priority: 'asc' }
        }
      },
      orderBy: { startTime: 'asc' }
    });

    // Filter by league in metadata (since Prisma JSON filtering is limited)
    const existingGames = allGamesForDate.filter((game: any) => {
      const metadata = game.metadata as any;
      const leagueData = metadata?.league || metadata?.apiData?.league;
      return leagueData?.id === league || 
             leagueData?.abbreviation?.toLowerCase() === league.toLowerCase() ||
             leagueData?.slug?.toLowerCase() === league.toLowerCase();
    });

    // Check if games are fresh (less than 24 hours old)
    // If force=true, always fetch from API regardless of cache
    let shouldFetchFromAPI = force === true;
    if (!shouldFetchFromAPI && existingGames.length > 0) {
      // Find the most recently updated game
      const mostRecentGame = existingGames.reduce((latest, game) => {
        const latestTime = new Date(latest.updatedAt || latest.createdAt).getTime();
        const gameTime = new Date(game.updatedAt || game.createdAt).getTime();
        return gameTime > latestTime ? game : latest;
      }, existingGames[0]);
      
      const gameAge = Date.now() - new Date(mostRecentGame.updatedAt || mostRecentGame.createdAt).getTime();
      const oneDayMs = 24 * 60 * 60 * 1000;
      
      if (gameAge < oneDayMs) {
        shouldFetchFromAPI = false;
        logger.info('Using existing games from database', { 
          count: existingGames.length, 
          ageHours: Math.round(gameAge / (60 * 60 * 1000)),
          date, 
          sport, 
          league 
        });
      } else {
        logger.info('Database games are older than 24 hours, fetching fresh data', { 
          count: existingGames.length,
          ageHours: Math.round(gameAge / (60 * 60 * 1000)),
          date, 
          sport, 
          league 
        });
      }
    } else {
      logger.info('No games found in database for this date, fetching from API', { date, sport, league });
    }

    // Step 2: Fetch from ESPN API only if needed
    let apiGames: any[] = [];
    let storedGameIds: string[] = [];

    if (shouldFetchFromAPI) {
      logger.info('Fetching games from ESPN API', { date, sport, league });
      apiGames = await apiSportsService.getGames(sport, league, date);
      
      if (!apiGames || apiGames.length === 0) {
        logger.warn('No games returned from ESPN API', { date, sport, league });
        // Return existing games from DB if we have them, otherwise empty
        return res.json({
          success: true,
          data: {
            games: existingGames,
            count: existingGames.length,
            date,
            sport,
            league,
            message: existingGames.length > 0 
              ? 'No new games from API, returning existing games from database'
              : 'No games found for this date, sport, and league'
          }
        });
      }
      
      logger.info('ESPN API returned games', { count: apiGames.length, date, sport, league });

      // Step 3: Delete old games for this date/sport/league that are no longer in the API response
      // This ensures we don't have stale games in the database
      // Only delete games that are in existingGames (already filtered by date/sport/league)
      const apiGameExternalIds = new Set(apiGames.map(g => g.externalId));
      const gamesToDelete = existingGames.filter(game => {
        // Delete games that are not in the new API response
        // These are games we had in the DB for this date/sport/league but are no longer in the API
        return !apiGameExternalIds.has(game.externalId);
      });

      if (gamesToDelete.length > 0) {
        logger.info('Deleting old games that are no longer in API response', { 
          count: gamesToDelete.length,
          gameIds: gamesToDelete.map(g => g.id),
          externalIds: gamesToDelete.map(g => g.externalId)
        });
        
        // Delete games (bets will be cascade deleted automatically due to onDelete: Cascade in schema)
        await prisma.game.deleteMany({
          where: {
            id: { in: gamesToDelete.map(g => g.id) }
          }
        });
        
        logger.info('Successfully deleted old games', { count: gamesToDelete.length });
      } else {
        logger.info('No old games to delete - all existing games are in the new API response');
      }

      // Step 4: Store games in database
      logger.info('Storing games in database', { count: apiGames.length });
      
      for (const apiGame of apiGames) {
        try {
          const game = await prisma.game.upsert({
            where: {
              externalId: apiGame.externalId
            },
            update: {
              homeTeam: apiGame.teams.home.displayName,
              awayTeam: apiGame.teams.away.displayName,
              startTime: new Date(apiGame.timestamp * 1000),
              status: apiGame.status,
              homeScore: apiGame.scores.home,
              awayScore: apiGame.scores.away,
              sport: apiGame.sport,
              metadata: {
                apiData: apiGame,
                league: apiGame.league,
              } as any,
              updatedAt: new Date()
            },
            create: {
              externalId: apiGame.externalId,
              sport: apiGame.sport,
              homeTeam: apiGame.teams.home.displayName,
              awayTeam: apiGame.teams.away.displayName,
              startTime: new Date(apiGame.timestamp * 1000),
              status: apiGame.status,
              homeScore: apiGame.scores.home,
              awayScore: apiGame.scores.away,
              metadata: {
                apiData: apiGame,
                league: apiGame.league,
              } as any
            }
          });

          storedGameIds.push(game.id);
        } catch (error) {
          logger.error('Error storing game', { gameId: apiGame.id, error });
        }
      }

      // Step 5: Fetch updated games from database
      if (storedGameIds.length > 0) {
        const updatedGames = await prisma.game.findMany({
          where: {
            id: { in: storedGameIds }
          },
          include: {
            bets: {
              orderBy: { priority: 'asc' }
            }
          },
          orderBy: { startTime: 'asc' }
        });

        logger.info('Successfully fetched and stored games', { 
          fetched: apiGames.length, 
          stored: storedGameIds.length,
          returned: updatedGames.length,
          date,
          sport,
          league
        });

        return res.json({
          success: true,
          data: {
            games: updatedGames,
            count: updatedGames.length,
            date,
            sport,
            league,
            source: 'api'
          }
        });
      }
    }

    // Return existing games from database
    logger.info('Returning games from database', { 
      count: existingGames.length,
      date,
      sport,
      league
    });

    res.json({
      success: true,
      data: {
        games: existingGames,
        count: existingGames.length,
        date,
        sport,
        league,
        source: 'database'
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
 *     summary: Get games for a specific date from database (without fetching from ESPN)
 *     description: Loads existing games from the database. Useful for viewing games you've already fetched without re-fetching from ESPN.
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
 *         example: "BASKETBALL"
 *     responses:
 *       200:
 *         description: Games retrieved successfully
 */
router.get('/', requireAuth, requireAdmin, requireFeature('ADMIN_GAME_MANAGEMENT'), async (req: Request, res: Response) => {
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
 * /api/admin/games/{gameId}/bets/reorder:
 *   put:
 *     summary: Reorder bet priorities
 *     tags: [Admin]
 */
router.put('/:gameId/bets/reorder', requireAuth, requireAdmin, requireFeature('ADMIN_BET_MANAGEMENT'), async (req: Request, res: Response) => {
  try {
    const { gameId } = req.params;
    const { bet_ids } = req.body; // Array of bet IDs in new order

    if (!Array.isArray(bet_ids)) {
      return res.status(400).json({
        success: false,
        error: { message: 'bet_ids must be an array', code: 'VALIDATION_ERROR' }
      });
    }

    // Update priorities
    for (let i = 0; i < bet_ids.length; i++) {
      await prisma.bet.update({
        where: { id: bet_ids[i] },
        data: { priority: i + 1 } as any
      });
    }

    // Return updated bets
    const bets = await prisma.bet.findMany({
      where: { gameId },
      orderBy: { priority: 'asc' }
    });

    logger.info('Bets reordered', { gameId, count: bet_ids.length });

    res.json({
      success: true,
      data: { bets }
    });
  } catch (error: any) {
    logger.error('Error reordering bets', { error });
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to reorder bets', code: 'SERVER_ERROR' }
    });
  }
});

export default router;

