import { logger } from '../utils/logger';
import type { EspnEvent, EspnLeague, EspnApiResponse, ApiSportsGame } from '../interfaces';

// Re-export interfaces for backward compatibility
export type { EspnEvent, EspnLeague, EspnApiResponse, ApiSportsGame } from '../interfaces';

const API_TIMEOUT_MS = 10000; // 10 seconds
const MAX_RETRIES = 2;

const espnLogger = (url: string, date: string, dateStr: string, sport: string, sportLower: string, league: string) => {
      // Log URL prominently for debugging
      console.log('\n═══════════════════════════════════════════════════════════');
      console.log('📡 ESPN API REQUEST');
      console.log('═══════════════════════════════════════════════════════════');
      console.log(`URL: ${url}`);
      console.log(`Date (input): ${date}`);
      console.log(`Date (formatted): ${dateStr}`);
      console.log(`Sport: ${sport} (lowercase: ${sportLower})`);
      console.log(`League: ${league}`);
      console.log('═══════════════════════════════════════════════════════════\n');
}

/**
 * Service for interacting with ESPN API
 * Fetches games from ESPN's scoreboard API
 */
export class ApiSportsService {
  private baseUrl = 'https://site.api.espn.com/apis/site/v2/sports';

  constructor() {
    // ESPN API doesn't require authentication for basic scoreboard data
  }

  /**
   * Fetch games for a specific date, sport, and league from ESPN
   * @param sport - Sport name (e.g., 'basketball', 'football', 'hockey')
   * @param league - League name (e.g., 'nba', 'nfl', 'nhl')
   * @param date - Date in YYYY-MM-DD format (required)
   * @returns Array of transformed games
   */
  async getGames(sport: string, league: string, date: string): Promise<ApiSportsGame[]> {
    // ESPN API uses dates in YYYYMMDD format
    const dateStr = date.replace(/-/g, '');
    
    // ESPN API expects lowercase sport names
    const sportLower = sport.toLowerCase();
    
    // Build URL: /sports/{sport}/{league}/scoreboard?dates={date}
    const url = `${this.baseUrl}/${sportLower}/${league}/scoreboard?dates=${dateStr}`;
    
    espnLogger(url, date, dateStr, sport, sportLower, league);
    
    logger.info('Fetching games from ESPN API', { url, sport, sportLower, league, date, dateStr });

    // Retry logic
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const startTime = Date.now();
        
        // Create abort controller for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

        const response = await fetch(url, {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        const responseTime = Date.now() - startTime;

        // Log API call for monitoring
        logger.info('ESPN API request', {
          statusCode: response.status,
          responseTime,
          attempt,
        });

        if (!response.ok) {
          if (response.status >= 500 && attempt < MAX_RETRIES) {
            logger.warn(`ESPN API server error (${response.status}), retrying...`, { attempt });
            await this.sleep(1000 * attempt);
            continue;
          }
          throw new Error(`ESPN API request failed: ${response.status} ${response.statusText}`);
        }

        const rawData: any = await response.json();

        // Check if response has events directly (some ESPN endpoints return events at root)
        if (rawData?.events && Array.isArray(rawData.events)) {
          // Wrap events in a league structure for transformation
          const wrappedData: EspnApiResponse = {
            leagues: [{
              id: league,
              uid: '',
              name: league.toUpperCase(),
              abbreviation: league.toUpperCase(),
              shortName: league,
              slug: league,
              events: rawData.events
            }]
          };
          const games = this.transformEspnResponse(wrappedData, sport, league);
          logger.info('Successfully fetched games from ESPN', { 
            gameCount: games.length,
            date 
          });
          return games;
        }

        const data = rawData as EspnApiResponse;
        
        if (!data?.leagues || !Array.isArray(data.leagues) || data.leagues.length === 0) {
          logger.warn('ESPN API response has no leagues array', { date, sport, league });
          return [];
        }

        // Transform ESPN response to our format
        const games = this.transformEspnResponse(data, sport, league);
        
        logger.info('Successfully fetched games from ESPN', { 
          gameCount: games.length,
          date 
        });

        return games;
      } catch (error: any) {
        lastError = error;
        
        // Handle timeout
        if (error.name === 'AbortError') {
          logger.warn('ESPN API request timeout', { attempt, date });
          if (attempt < MAX_RETRIES) {
            await this.sleep(1000 * attempt);
            continue;
          }
          throw new Error('ESPN API request timeout after retries');
        }

        // Handle network errors
        if (error.message?.includes('fetch failed') && attempt < MAX_RETRIES) {
          logger.warn('ESPN API network error, retrying...', { attempt, error: error.message });
          await this.sleep(1000 * attempt);
          continue;
        }

        // Don't retry other errors
        logger.error('Error fetching games from ESPN API', { error, date, attempt });
        throw error;
      }
    }

    // If we get here, all retries failed
    throw lastError || new Error('Failed to fetch games after retries');
  }

  /**
   * Fetch full game data (with boxscore and plays) for a specific game from ESPN
   * @param sport - Sport name (e.g., 'basketball', 'football', 'hockey')
   * @param league - League name (e.g., 'nba', 'nfl', 'nhl')
   * @param gameId - ESPN game ID
   * @returns Full game data with boxscore and plays
   */
  async getGameData(sport: string, league: string, gameId: string): Promise<any> {
    // Build URL: /sports/{sport}/{league}/scoreboard/{gameId}
    // ESPN API expects lowercase sport names
    const sportLower = sport.toLowerCase();
    const url = `${this.baseUrl}/${sportLower}/${league}/scoreboard/${gameId}`;
    
    logger.info('Fetching game data from ESPN API', { url, sport, sportLower, league, gameId });

    // Retry logic
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
          }
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unable to read error response');
          logger.error(`ESPN API returned error status: ${response.status} ${response.statusText} - URL: ${url} - GameId: ${gameId} - Attempt: ${attempt}`);
          if (errorText && errorText.length > 0) {
            logger.error(`ESPN API Error Response (first 500 chars): ${errorText.substring(0, 500)}`);
          }
          throw new Error(`ESPN API returned ${response.status}: ${response.statusText} - URL: ${url}`);
        }

        const data = await response.json();
        logger.info('Successfully fetched game data from ESPN API', { url, gameId, attempt });
        return data;
      } catch (error: any) {
        lastError = error;

        // Handle timeout
        if (error.name === 'AbortError' && attempt < MAX_RETRIES) {
          logger.warn(`ESPN API request timeout, retrying... - URL: ${url} - GameId: ${gameId} - Attempt: ${attempt} - Timeout: ${API_TIMEOUT_MS}ms`);
          await this.sleep(1000 * attempt);
          continue;
        }

        // Handle network errors
        if (error.message?.includes('fetch failed') && attempt < MAX_RETRIES) {
          logger.warn(`ESPN API network error, retrying... - URL: ${url} - GameId: ${gameId} - Attempt: ${attempt} - Error: ${error.message}`);
          await this.sleep(1000 * attempt);
          continue;
        }

        // Don't retry other errors - log full details
        logger.error(`Error fetching game data from ESPN API: ${error.message || error.name || 'Unknown error'}`);
        logger.error(`ESPN API URL: ${url}`);
        logger.error(`Parameters: sport=${sport}, league=${league}, gameId=${gameId}, attempt=${attempt}`);
        logger.error(`Error details: name=${error.name || 'N/A'}, message=${error.message || 'N/A'}`);
        if (error.stack) {
          logger.error(`Stack trace (first 1000 chars): ${error.stack.substring(0, 1000)}`);
        }
        throw error;
      }
    }

    // If we get here, all retries failed
    throw lastError || new Error('Failed to fetch game data after retries');
  }

  /**
   * Transform ESPN API response to our game format
   */
  private transformEspnResponse(data: EspnApiResponse, sport: string, league: string): ApiSportsGame[] {
    const games: ApiSportsGame[] = [];

    if (!data || !data.leagues || !Array.isArray(data.leagues)) {
      logger.warn('Invalid ESPN API response structure', { hasData: !!data, hasLeagues: !!(data?.leagues) });
      return games;
    }

    // Map sport/league to our sport name
    const sportName = this.mapEspnSportToOurSport(sport, league);

    for (const leagueData of data.leagues) {
      if (!leagueData.events || !Array.isArray(leagueData.events)) {
        continue;
      }
      
      if (leagueData.events.length === 0) {
        continue;
      }

      for (const event of leagueData.events) {
        try {
          // ESPN API structure: event.competitions is an array
          // But sometimes the event itself might have the competition data directly
          let competition = event.competitions?.[0];
          
          // If no competitions array, check if event has competition data directly
          if (!competition && (event as any).competitors) {
            competition = event as any;
          }
          
          if (!competition) {
            continue;
          }

          // Find home and away teams
          // Note: ESPN API returns competitors with team data directly (not nested in .team)
          const homeTeam = competition.competitors?.find((c: any) => c.homeAway === 'home') as any;
          const awayTeam = competition.competitors?.find((c: any) => c.homeAway === 'away') as any;

          if (!homeTeam || !awayTeam) {
            continue;
          }

          // Parse status - check both competition and event for status
          const statusState = competition.status?.type?.state || event.status?.type?.state || 'pre';
          const status = this.mapEspnStatusToOurStatus(statusState);

          // Parse scores
          const homeScore = homeTeam.score ? parseInt(homeTeam.score) : null;
          const awayScore = awayTeam.score ? parseInt(awayTeam.score) : null;

          // Parse date/timestamp - check both competition and event for date
          const dateStr = competition.startDate || event.date || (event as any).startDate;
          if (!dateStr) {
            continue;
          }
          const eventDate = new Date(dateStr);
          const timestamp = eventDate.getTime();

          if (isNaN(timestamp)) {
            continue;
          }

          // Extract team data - competitors have team nested under .team property
          const homeTeamData = homeTeam.team || homeTeam;
          const awayTeamData = awayTeam.team || awayTeam;

          const game: ApiSportsGame = {
            id: event.id,
            externalId: event.id,
            date: eventDate.toISOString(),
            timestamp: Math.floor(timestamp / 1000),
            status,
            sport: sportName,
            league: {
              id: leagueData.id,
              name: leagueData.name,
              abbreviation: leagueData.abbreviation,
            },
            teams: {
              home: {
                id: homeTeamData.id || homeTeam.id,
                name: homeTeamData.name || homeTeamData.location || 'Unknown',
                abbreviation: homeTeamData.abbreviation || '',
                displayName: homeTeamData.displayName || homeTeamData.name || 'Unknown',
              },
              away: {
                id: awayTeamData.id || awayTeam.id,
                name: awayTeamData.name || awayTeamData.location || 'Unknown',
                abbreviation: awayTeamData.abbreviation || '',
                displayName: awayTeamData.displayName || awayTeamData.name || 'Unknown',
              },
            },
            scores: {
              home: homeScore,
              away: awayScore,
            },
            metadata: {
              espnEvent: event,
              competition,
            },
          };

          games.push(game);
        } catch (error: any) {
          logger.error(`Error transforming event ${event.id}`, { 
            eventId: event.id,
            error: error?.message || String(error)
          });
        }
      }
    }

    return games;
  }

  /**
   * Map ESPN sport/league to our sport names
   */
  private mapEspnSportToOurSport(sport: string, league: string): string {
    // Map sport names to our format
    const sportMap: Record<string, string> = {
      'basketball': 'BASKETBALL',
      'football': 'FOOTBALL',
      'baseball': 'BASEBALL',
      'hockey': 'HOCKEY',
      'soccer': 'SOCCER',
    };

    return sportMap[sport.toLowerCase()] || sport.toUpperCase();
  }

  /**
   * Map ESPN status to our status format
   */
  private mapEspnStatusToOurStatus(espnState: string): string {
    const statusMap: Record<string, string> = {
      'pre': 'scheduled',
      'in': 'in_progress',
      'post': 'completed',
      'final': 'completed',
      'stat_final': 'completed',
    };

    return statusMap[espnState.toLowerCase()] || 'scheduled';
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get supported sports and their leagues
   */
  getSupportedSports(): Array<{ sport: string; leagues: Array<{ id: string; name: string }> }> {
    return [
      {
        sport: 'basketball',
        leagues: [
          { id: 'nba', name: 'NBA' },
          { id: 'wnba', name: 'WNBA' },
          { id: 'mens-college-basketball', name: "Men's College Basketball" },
          { id: 'womens-college-basketball', name: "Women's College Basketball" },
        ],
      },
      {
        sport: 'football',
        leagues: [
          { id: 'nfl', name: 'NFL' },
          { id: 'college-football', name: 'College Football' },
        ],
      },
      {
        sport: 'baseball',
        leagues: [
          { id: 'mlb', name: 'MLB' },
          { id: 'college-baseball', name: 'College Baseball' },
        ],
      },
      {
        sport: 'hockey',
        leagues: [
          { id: 'nhl', name: 'NHL' },
        ],
      },
      {
        sport: 'soccer',
        leagues: [
          { id: 'all', name: 'All Leagues' },
        ],
      },
    ];
  }

  /**
   * Fetch roster for a specific team
   * First checks local cached data, falls back to ESPN API if not found
   * @param sport - Sport name (e.g., 'basketball', 'hockey')
   * @param league - League name (e.g., 'nba', 'nhl')
   * @param teamId - Team ID from ESPN
   * @param useCache - Whether to use cached data (default: true)
   * @returns Roster data or null if not found
   */
  async getTeamRoster(sport: string, league: string, teamId: string, useCache: boolean = true): Promise<any | null> {
    // Try to load from Backblaze first
    if (useCache) {
      try {
        const { backblazeService } = require('./backblaze.service');
        const remotePath = `rosters/${sport}/${league}/${teamId}.json`;
        const cachedData = await backblazeService.getFileAsJson(remotePath);
        
        if (cachedData) {
          logger.info('Loaded roster from Backblaze', { 
            sport, 
            league, 
            teamId,
            athletesCount: cachedData?.athletes?.length || 0,
            cachedAt: cachedData?.timestamp
          });
          return cachedData;
        } else {
          logger.info('Roster not found in Backblaze, fetching from API', { sport, league, teamId });
        }
      } catch (error: any) {
        logger.warn('Error loading roster from Backblaze, falling back to API', { 
          error: error.message,
          sport, 
          league, 
          teamId 
        });
      }
    }

    // Fallback to ESPN API
    // ESPN API expects lowercase sport names
    const sportLower = sport.toLowerCase();
    const url = `${this.baseUrl}/${sportLower}/${league}/teams/${teamId}/roster`;
    logger.info('Fetching team roster from ESPN API', { sport, league, teamId, url });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

      const response = await fetch(url, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 404) {
          logger.warn('Team roster not found', { sport, league, teamId });
          return null;
        }
        throw new Error(`ESPN API request failed: ${response.status} ${response.statusText}`);
      }

      const data: any = await response.json();
      logger.info('Successfully fetched team roster from API', { 
        sport, 
        league, 
        teamId,
        athletesCount: data?.athletes?.length || 0
      });

      return data;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        logger.warn('Team roster request timeout', { sport, league, teamId });
        throw new Error('Team roster request timeout');
      }

      logger.error('Error fetching team roster', { error, sport, league, teamId });
      throw error;
    }
  }

  /**
   * Get team ID from team name/abbreviation
   * Loads teams from shared config
   */
  async getTeamId(sport: string, league: string, teamNameOrAbbr: string): Promise<string | null> {
    try {
      // Load from Backblaze only
      const { backblazeService } = require('./backblaze.service');
      const teamsConfig = await backblazeService.getFileAsJson('teams/teams.json');
      
      if (!teamsConfig) {
        logger.error('Teams config not found in Backblaze');
        return null;
      }

      logger.debug('Loaded teams config from Backblaze');

      for (const leagueData of teamsConfig.leagues || []) {
        if (leagueData.sport === sport && leagueData.league === league) {
          const team = leagueData.teams.find((t: any) => 
            t.displayName.toLowerCase() === teamNameOrAbbr.toLowerCase() ||
            t.abbreviation.toLowerCase() === teamNameOrAbbr.toLowerCase() ||
            t.name.toLowerCase() === teamNameOrAbbr.toLowerCase()
          );
          return team?.id || null;
        }
      }
      return null;
    } catch (error: any) {
      logger.error('Error loading teams config from Backblaze', { error: error.message });
      return null;
    }
  }
}

