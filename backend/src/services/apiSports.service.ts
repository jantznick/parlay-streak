import { logger } from '../utils/logger';

const API_TIMEOUT_MS = 10000; // 10 seconds
const MAX_RETRIES = 2;

// ESPN API Response Types (new endpoint structure)
export interface EspnEvent {
  id: string;
  uid: string;
  date: string;
  name: string;
  shortName: string;
  status: {
    type: {
      id: string;
      name: string;
      state: string;
      completed: boolean;
      description: string;
      detail: string;
      shortDetail: string;
    };
    period: number;
    displayClock: string;
    clock: number;
  };
  competitions: Array<{
    id: string;
    date: string;
    attendance: number;
    type: {
      id: string;
      abbreviation: string;
    };
    timeValid: boolean;
    neutralSite: boolean;
    conferenceCompetition: boolean;
    playByPlayAvailable: boolean;
    recent: boolean;
    venue: {
      id: string;
      fullName: string;
      address: {
        city: string;
        state: string;
      };
    };
    competitors: Array<{
      id: string;
      uid: string;
      type: string;
      order: number;
      homeAway: 'home' | 'away';
      team: {
        id: string;
        uid: string;
        location: string;
        name: string;
        abbreviation: string;
        displayName: string;
        shortDisplayName: string;
        color: string;
        alternateColor: string;
        isActive: boolean;
        venue: {
          id: string;
        };
        links: Array<{
          rel: string[];
          href: string;
          text: string;
        }>;
      };
      score: string;
      linescores?: Array<{
        value: number;
      }>;
      statistics: any[];
      records: Array<{
        name: string;
        abbreviation?: string;
        type: string;
        summary: string;
      }>;
    }>;
    notes: any[];
    status: {
      type: {
        id: string;
        name: string;
        state: string;
        completed: boolean;
        description: string;
        detail: string;
        shortDetail: string;
      };
    };
    broadcasts: Array<{
      market: {
        id: string;
        type: string;
      };
      media: {
        shortName: string;
      };
      names: string[];
    }>;
    leaders?: any[];
    format: {
      regulation: {
        periods: number;
      };
    };
    startDate: string;
    geoBroadcasts: any[];
    headlines?: any[];
  }>;
  links: Array<{
    language: string;
    rel: string[];
    href: string;
    text: string;
    shortText?: string;
    isExternal: boolean;
    isPremium: boolean;
  }>;
  weather?: any;
}

export interface EspnLeague {
  id: string;
  uid: string;
  name: string;
  abbreviation: string;
  shortName: string;
  slug: string;
  events: EspnEvent[];
}

// New endpoint returns leagues directly (not nested under sports)
export interface EspnApiResponse {
  leagues: EspnLeague[];
}

// Transformed game format for our system
export interface ApiSportsGame {
  id: string;
  externalId: string;
  date: string;
  timestamp: number;
  status: string;
  sport: string;
  league: {
    id: string;
    name: string;
    abbreviation: string;
  };
  teams: {
    home: {
      id: string;
      name: string;
      abbreviation: string;
      displayName: string;
    };
    away: {
      id: string;
      name: string;
      abbreviation: string;
      displayName: string;
    };
  };
  scores: {
    home: number | null;
    away: number | null;
  };
  metadata: any;
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
    
    // Build URL: /sports/{sport}/{league}/scoreboard?dates={date}
    const url = `${this.baseUrl}/${sport}/${league}/scoreboard?dates=${dateStr}`;
    
    // Log URL prominently for debugging
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📡 ESPN API REQUEST');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`URL: ${url}`);
    console.log(`Date (input): ${date}`);
    console.log(`Date (formatted): ${dateStr}`);
    console.log(`Sport: ${sport}`);
    console.log(`League: ${league}`);
    console.log('═══════════════════════════════════════════════════════════\n');
    
    logger.info('Fetching games from ESPN API', { url, sport, league, date, dateStr });

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
   * Fetch game summary/boxscore data for bet resolution
   * This endpoint provides detailed game statistics, play-by-play, and boxscore data
   * Used for resolving bets after games complete (and potentially during live games)
   * 
   * @param sport - Sport name (e.g., 'basketball', 'hockey', 'football', 'baseball')
   * @param league - League name (e.g., 'nba', 'nhl', 'nfl', 'mlb')
   * @param gameId - Game/event ID from ESPN
   * @returns Game boxscore/summary data or null if not found
   * 
   * Endpoint: /apis/site/v2/sports/{sport}/{league}/summary?event={gameId}
   * Example: /apis/site/v2/sports/basketball/nba/summary?event=401585401
   * 
   * Note: This endpoint may also be updated live during games (to be verified)
   */
  async getGameSummary(sport: string, league: string, gameId: string): Promise<any | null> {
    const url = `${this.baseUrl}/${sport}/${league}/summary?event=${gameId}`;
    logger.info('Fetching game summary from ESPN API', { url, sport, league, gameId });

    // TODO: Implement with retry logic, timeout handling, and error handling
    // TODO: Add caching strategy for completed games
    // TODO: Verify if this endpoint updates live during games
    // TODO: Add rate limiting considerations
    
    throw new Error('Not yet implemented');
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
    const url = `${this.baseUrl}/${sport}/${league}/teams/${teamId}/roster`;
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

