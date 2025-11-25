import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';
import { requireFeature } from '../middleware/featureFlags';
import { ApiSportsService } from '../services/apiSports.service';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { resolveBet, getSportConfig, extractLiveGameInfo } from '../services/betResolution.service';
import { getUTCDateRange } from '../utils/dateUtils';

// Type for bet config (from shared types)
type BetConfig = {
  type: 'COMPARISON' | 'THRESHOLD' | 'EVENT';
  [key: string]: any;
};

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

router.post('/games/fetch', requireAuth, requireAdmin, requireFeature('ADMIN_GAME_MANAGEMENT'), async (req: Request, res: Response) => {
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
router.get('/games', requireAuth, requireAdmin, requireFeature('ADMIN_GAME_MANAGEMENT'), async (req: Request, res: Response) => {
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
router.post('/bets', requireAuth, requireAdmin, requireFeature('ADMIN_BET_MANAGEMENT'), async (req: Request, res: Response) => {
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

    // Generate display text (will implement utility function)
    const displayText = display_text_override || generateDisplayText(bet_type, config);

    // Get current max priority for this game
    const maxPriorityResult = await prisma.bet.aggregate({
      where: { gameId: game_id },
      _max: { priority: true }
    });

    const priority = (maxPriorityResult._max.priority || 0) + 1;

    // Create bet
    // Note: After running migration, regenerate Prisma client: npx prisma generate
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

// Helper function to format metric label
function formatMetricLabel(metric: string): string {
  return metric.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

// Helper function to format time period label
function formatTimePeriodLabel(period: string): string {
  const periodMap: Record<string, string> = {
    'FULL_GAME': 'Full Game',
    'Q1': 'Q1',
    'Q2': 'Q2',
    'Q3': 'Q3',
    'Q4': 'Q4',
    'H1': '1H',
    'H2': '2H',
    'OT': 'OT'
  };
  return periodMap[period] || period;
}

// Helper function to generate display text from bet config
function generateDisplayText(betType: string, config: any): string {
  if (betType === 'COMPARISON') {
    const { participant_1, participant_2, spread } = config;
    
    // Moneyline (simple comparison, no spread, both teams, points, full game)
    if (!spread && 
        participant_1.metric === 'points' && 
        participant_1.time_period === 'FULL_GAME' &&
        participant_1.subject_type === 'TEAM' &&
        participant_2.subject_type === 'TEAM' &&
        participant_2.metric === 'points' &&
        participant_2.time_period === 'FULL_GAME') {
      return `${participant_1.subject_name} ML`;
    }
    
    // Spread (both teams, points, full game)
    if (spread && 
        participant_1.metric === 'points' && 
        participant_1.time_period === 'FULL_GAME' &&
        participant_1.subject_type === 'TEAM' &&
        participant_2.subject_type === 'TEAM' &&
        participant_2.metric === 'points' &&
        participant_2.time_period === 'FULL_GAME') {
      return `${participant_1.subject_name} ${spread.direction}${spread.value}`;
    }
    
    // Generic comparison - always show all values explicitly
    const metric1Label = formatMetricLabel(participant_1.metric);
    const metric2Label = formatMetricLabel(participant_2.metric);
    const period1 = participant_1.time_period !== 'FULL_GAME'
      ? ` (${formatTimePeriodLabel(participant_1.time_period)})`
      : '';
    const period2 = participant_2.time_period !== 'FULL_GAME'
      ? ` (${formatTimePeriodLabel(participant_2.time_period)})`
      : '';
    
    // Always show both metrics and periods explicitly
    if (spread) {
      return `${participant_1.subject_name} ${metric1Label}${period1} ${spread.direction}${spread.value} > ${participant_2.subject_name} ${metric2Label}${period2}`;
    } else {
      return `${participant_1.subject_name} ${metric1Label}${period1} > ${participant_2.subject_name} ${metric2Label}${period2}`;
    }
  }
  
  if (betType === 'THRESHOLD') {
    const { participant, operator, threshold } = config;
    const metricLabel = formatMetricLabel(participant.metric);
    const period = participant.time_period !== 'FULL_GAME'
      ? ` (${formatTimePeriodLabel(participant.time_period)})`
      : '';
    
    return `${participant.subject_name} ${operator} ${threshold} ${metricLabel}${period}`;
  }
  
  if (betType === 'EVENT') {
    const { participant, event_type, time_period } = config;
    const eventLabel = event_type.replace(/_/g, ' ').toLowerCase();
    const period = time_period !== 'FULL_GAME'
      ? ` (${formatTimePeriodLabel(time_period)})`
      : '';
    
    return `${participant.subject_name} ${eventLabel}${period}`;
  }
  
  return 'Unknown bet';
}

/**
 * @swagger
 * /api/admin/bets/{betId}:
 *   patch:
 *     summary: Update a bet
 *     tags: [Admin]
 */
router.patch('/bets/:betId', requireAuth, requireAdmin, requireFeature('ADMIN_BET_MANAGEMENT'), async (req: Request, res: Response) => {
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
router.delete('/bets/:betId', requireAuth, requireAdmin, requireFeature('ADMIN_BET_MANAGEMENT'), async (req: Request, res: Response) => {
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
 * /api/admin/games/{gameId}/bets/reorder:
 *   put:
 *     summary: Reorder bet priorities
 *     tags: [Admin]
 */
router.put('/games/:gameId/bets/reorder', requireAuth, requireAdmin, requireFeature('ADMIN_BET_MANAGEMENT'), async (req: Request, res: Response) => {
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

/**
 * @swagger
 * /api/admin/feature-flags:
 *   get:
 *     summary: Get current feature flag status (admin only)
 *     tags: [Admin]
 *     security:
 *       - sessionAuth: []
 *     responses:
 *       200:
 *         description: Feature flags status
 */
router.get('/feature-flags', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { getFeatureFlags } = require('../middleware/featureFlags');
    const flags = getFeatureFlags();
    
    res.json({
      success: true,
      data: flags
    });
  } catch (error: any) {
    logger.error('Error fetching feature flags', { error });
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to fetch feature flags', code: 'SERVER_ERROR' }
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
router.post('/bets/:betId/resolve', requireAuth, requireAdmin, requireFeature('ADMIN_BET_MANAGEMENT'), async (req: Request, res: Response) => {
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
    // Note: We allow 'scheduled' games if the start time has passed (for old games that weren't properly updated)
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
    // League structure: { id: 'nba', name: 'NBA', ... }
    const leagueId = league.id || league.abbreviation || league.slug;
    const sport = bet.game.sport; // e.g., 'basketball'
    
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

    // Fetch full game data from ESPN API
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
      const gameStatusFromApi = gameData?.header?.competitions?.[0]?.status?.type?.state;
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

    // Update game status, scores, and live info from the fetched gameData
    // This is called after bet resolution (even if it failed) to keep game data current
    // Uses sport-specific config for extensibility across all sports
    const liveGameInfo = extractLiveGameInfo(gameData, sportConfig);
    const currentMetadata = (bet.game.metadata as any) || {};
    
    await prisma.game.update({
      where: { id: bet.gameId },
      data: {
        status: liveGameInfo.status,
        homeScore: liveGameInfo.homeScore,
        awayScore: liveGameInfo.awayScore,
        metadata: {
          ...currentMetadata,
          liveInfo: {
            period: liveGameInfo.period,
            displayClock: liveGameInfo.displayClock,
            periodDisplay: liveGameInfo.periodDisplay,
            lastUpdated: new Date().toISOString()
          }
        },
        // Set endTime if game is completed
        ...(liveGameInfo.status === 'completed' && !bet.game.endTime ? {
          endTime: new Date()
        } : {})
      }
    });

    logger.info('Updated game with live info', {
      gameId: bet.gameId,
      status: liveGameInfo.status,
      homeScore: liveGameInfo.homeScore,
      awayScore: liveGameInfo.awayScore,
      periodDisplay: liveGameInfo.periodDisplay
    });

    // Resolve the bet
    const betConfig = bet.config as unknown as BetConfig;
    let resolutionResult;
    try {
      resolutionResult = resolveBet(betConfig, gameData, sportConfig);
    } catch (error: any) {
      logger.error('Error during bet resolution', { error, betId, betType: bet.betType });
      // Game was already updated above, so we can return the error
      return res.status(500).json({
        success: false,
        error: { 
          message: `Error during bet resolution: ${error.message || 'Unknown error'}`,
          code: 'RESOLUTION_ERROR',
          details: error.message
        }
      });
    }

    // Check if bet resolution failed - return error but game was still updated
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

