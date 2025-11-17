import { logger } from '../utils/logger';

const API_TIMEOUT_MS = 10000; // 10 seconds
const MAX_RETRIES = 2;

export interface ApiSportsGame {
  id: number;
  date: string;
  time: string;
  timestamp: number;
  timezone: string;
  stage: string | null;
  week: string | null;
  status: {
    long: string;
    short: string;
    timer: string | null;
  };
  league: {
    id: number;
    name: string;
    type: string;
    season: string;
    logo: string;
  };
  country: {
    id: number;
    name: string;
    code: string | null;
    flag: string | null;
  };
  teams: {
    home: {
      id: number;
      name: string;
      logo: string;
    };
    away: {
      id: number;
      name: string;
      logo: string;
    };
  };
  scores: {
    home: {
      total: number | null;
    };
    away: {
      total: number | null;
    };
  };
}

export interface ApiSportsResponse {
  get: string;
  parameters: any;
  errors: any[];
  results: number;
  response: ApiSportsGame[];
}

/**
 * Service for interacting with api-sports.io
 * Supports multiple sports with reusable structure
 */
export class ApiSportsService {
  private apiKey: string;
  private baseUrls: Record<string, string> = {
    allSports: "https://site.api.espn.com/apis/personalized/v2/scoreboard/header?showAirings=buy%2Clive%2Creplay?lang=en?region=us?tz=America%2FChicago"
  }

  constructor() {
    this.apiKey = process.env.API_SPORTS_KEY || '123';
    if (!this.apiKey) {
      logger.warn('API_SPORTS_KEY not set in environment variables');
    }
  }

  /**
   * Fetch games for a specific date and sport
   * @param sport - The sport (basketball, football, etc.)
   * @param date - Date in YYYY-MM-DD format
   * @param league - League ID (e.g., 12 for NBA, 1 for NFL)
   */
  async getGames(date: string): Promise<ApiSportsGame[]> {
    const url = this.baseUrls.allSports
    console.log(`Fetching URL: ${url}`)

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
        const rateLimitRemaining = response.headers.get('x-ratelimit-requests-remaining');

        // Log API call for monitoring
        logger.info('API Sports request', {
          statusCode: response.status,
          responseTime,
          rateLimitRemaining,
          attempt,
        });

        if (!response.ok) {
          // Check if we should retry
          // if (response.status >= 500 && attempt < MAX_RETRIES) {
          //   logger.warn(`API Sports server error (${response.status}), retrying...`, { attempt });
          //   await this.sleep(1000 * attempt); // Exponential backoff
          //   continue;
          // }
          // throw new Error(`API Sports request failed: ${response.status} ${response.statusText}`);
        }

        const data = await response.json() as ApiSportsResponse;
        console.log(data);

        if (data.errors && data.errors.length > 0) {
          logger.error('API Sports errors', { errors: data.errors });
          throw new Error(`API Sports errors: ${JSON.stringify(data.errors)}`);
        }

        return data.response || [];
      } catch (error: any) {
        lastError = error;
        
        // Handle timeout
        if (error.name === 'AbortError') {
          logger.warn('API Sports request timeout', { attempt, date });
          if (attempt < MAX_RETRIES) {
            await this.sleep(1000 * attempt);
            continue;
          }
          throw new Error('API Sports request timeout after retries');
        }

        // Handle network errors
        if (error.message?.includes('fetch failed') && attempt < MAX_RETRIES) {
          logger.warn('API Sports network error, retrying...', { attempt, error: error.message });
          await this.sleep(1000 * attempt);
          continue;
        }

        // Don't retry other errors
        logger.error('Error fetching games from API Sports', { error, date, attempt });
        throw error;
      }
    }

    // If we get here, all retries failed
    throw lastError || new Error('Failed to fetch games after retries');
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get supported sports
   */
  getSupportedSports(): string[] {
    return Object.keys(this.baseUrls);
  }

  /**
   * Get league configurations for different sports
   */
  getLeagueConfig(sport: string): { id: number; name: string } | null {
    const configs: Record<string, { id: number; name: string }> = {
      basketball: { id: 12, name: 'NBA' },
      football: { id: 1, name: 'NFL' },
    };
    return configs[sport] || null;
  }
}

