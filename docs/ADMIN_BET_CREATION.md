# Admin Bet Creation System - Implementation Guide

## Overview

This document outlines the admin dashboard system for creating bets from game data fetched via the api-sports.io API. The system allows admins to manually create and configure bets for upcoming games, with automatic bet generation options for common bet types.

---

## Core Concepts

### Bet Types

The system supports three core bet types:

1. **COMPARISON** - Compare two participants on the same metric
   - Examples: Moneyline, Spread, Player vs Player
   
2. **THRESHOLD** - Single participant vs a number
   - Examples: Over/Under team totals, Player props
   
3. **EVENT** - Binary yes/no events
   - Examples: Player scores TD, Game goes to OT

### Participants

A participant can be:
- **TEAM** - A team in the game
- **PLAYER** - A player on one of the teams

### Metrics

Sport-specific measurable stats (points, yards, touchdowns, etc.)

### Time Periods

When the metric is measured (Full Game, Q1, Q2, First Half, etc.)

---

## Data Structures

### Database Schema Updates

#### `bets` table modifications

```sql
-- Update existing bets table from TECH_REQUIREMENTS.md
ALTER TABLE bets 
  DROP COLUMN bet_type,
  DROP COLUMN description,
  DROP COLUMN bet_value,
  ADD COLUMN bet_type VARCHAR(50) NOT NULL, -- 'COMPARISON', 'THRESHOLD', 'EVENT'
  ADD COLUMN display_text VARCHAR(255) NOT NULL,
  ADD COLUMN display_text_override VARCHAR(255),
  ADD COLUMN config JSONB NOT NULL, -- stores ComparisonConfig | ThresholdConfig | EventConfig
  ADD COLUMN last_fetched_at TIMESTAMP,
  ADD COLUMN needs_admin_resolution BOOLEAN DEFAULT false,
  ADD COLUMN admin_resolution_notes TEXT;
```

#### New: `api_teams` table

```sql
CREATE TABLE api_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id VARCHAR(100) UNIQUE NOT NULL,
  sport VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  abbreviation VARCHAR(10),
  logo_url VARCHAR(500),
  metadata JSONB, -- store any additional API data
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_api_teams_sport ON api_teams(sport);
CREATE INDEX idx_api_teams_api_id ON api_teams(api_id);
```

#### New: `api_players` table

```sql
CREATE TABLE api_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_id VARCHAR(100) UNIQUE NOT NULL,
  team_id UUID REFERENCES api_teams(id),
  sport VARCHAR(50) NOT NULL,
  name VARCHAR(255) NOT NULL,
  position VARCHAR(50),
  jersey_number INTEGER,
  metadata JSONB, -- store any additional API data
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_api_players_sport ON api_players(sport);
CREATE INDEX idx_api_players_team ON api_players(team_id);
CREATE INDEX idx_api_players_api_id ON api_players(api_id);
```

#### New: `api_call_log` table (rate limit tracking)

```sql
CREATE TABLE api_call_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint VARCHAR(500) NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  rate_limit_remaining INTEGER,
  called_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_api_call_log_endpoint ON api_call_log(endpoint, called_at DESC);
```

#### Update: `games` table

```sql
-- Add fields to existing games table
ALTER TABLE games
  ADD COLUMN api_fetched_at TIMESTAMP,
  ADD COLUMN odds JSONB, -- store odds data from API
  ADD COLUMN available_players JSONB; -- array of player data for bet creation
```

### TypeScript Types

```typescript
// shared/types/bets.ts

export type BetType = 'COMPARISON' | 'THRESHOLD' | 'EVENT';
export type SubjectType = 'TEAM' | 'PLAYER';
export type TimePeriod = 'FULL_GAME' | 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'H1' | 'H2' | 'OT';
export type ComparisonOperator = 'GREATER_THAN' | 'GREATER_EQUAL';
export type ThresholdOperator = 'OVER' | 'UNDER';
export type EventType = 'SCORES_TD' | 'SCORES_FIRST' | 'GAME_GOES_TO_OT' | 'SHUTOUT';

export interface Participant {
  subject_type: SubjectType;
  subject_id: string; // API's ID for team/player
  subject_name: string; // Display name
  metric: string; // e.g., 'points', 'rushing_yards'
  time_period: TimePeriod;
}

export interface ComparisonConfig {
  type: 'COMPARISON';
  participant_1: Participant;
  participant_2: Participant;
  operator: ComparisonOperator;
  spread?: {
    direction: '+' | '-';
    value: number; // must be X.5 (half-point)
  };
}

export interface ThresholdConfig {
  type: 'THRESHOLD';
  participant: Participant;
  operator: ThresholdOperator;
  threshold: number;
}

export interface EventConfig {
  type: 'EVENT';
  participant: Participant;
  event_type: EventType;
  time_period: TimePeriod; // when event must occur
}

export type BetConfig = ComparisonConfig | ThresholdConfig | EventConfig;

export interface Bet {
  id: string;
  game_id: string;
  bet_type: BetType;
  display_text: string;
  display_text_override?: string;
  config: BetConfig;
  outcome: 'pending' | 'win' | 'loss' | 'push' | 'void';
  priority: number;
  resolved_at?: Date;
  last_fetched_at?: Date;
  needs_admin_resolution: boolean;
  admin_resolution_notes?: string;
  metadata?: any;
  created_at: Date;
  updated_at: Date;
}
```

---

## Sport Configuration

### Structure

Sport configs live in `shared/config/sports/` and define:
- Available metrics for that sport
- Time periods
- API mapping paths
- Auto-bet templates

### American Football Config

```typescript
// shared/config/sports/american-football.ts

export interface SportMetric {
  value: string;
  label: string;
  team: boolean;
  player: boolean;
  api_path_team?: string;
  api_path_player?: string;
  resolvable: boolean;
}

export interface SportConfig {
  sport_key: string;
  display_name: string;
  api_sport_id: number;
  time_periods: Array<{
    value: TimePeriod;
    label: string;
    api_key: string;
  }>;
  metrics: SportMetric[];
  auto_bet_templates: AutoBetTemplate[];
}

export const AMERICAN_FOOTBALL_CONFIG: SportConfig = {
  sport_key: 'american_football',
  display_name: 'American Football',
  api_sport_id: 1, // NFL on api-sports.io
  
  time_periods: [
    { value: 'FULL_GAME', label: 'Full Game', api_key: 'game' },
    { value: 'Q1', label: '1st Quarter', api_key: 'quarter_1' },
    { value: 'Q2', label: '2nd Quarter', api_key: 'quarter_2' },
    { value: 'Q3', label: '3rd Quarter', api_key: 'quarter_3' },
    { value: 'Q4', label: '4th Quarter', api_key: 'quarter_4' },
    { value: 'H1', label: '1st Half', api_key: 'half_1' },
    { value: 'H2', label: '2nd Half', api_key: 'half_2' },
    { value: 'OT', label: 'Overtime', api_key: 'overtime' },
  ],
  
  metrics: [
    {
      value: 'points',
      label: 'Points',
      team: true,
      player: true,
      api_path_team: 'statistics.team.{team_id}.points.{period}',
      api_path_player: 'statistics.players.{player_id}.points.{period}',
      resolvable: true
    },
    {
      value: 'total_yards',
      label: 'Total Yards',
      team: true,
      player: true,
      api_path_team: 'statistics.team.{team_id}.total_yards',
      api_path_player: 'statistics.players.{player_id}.total_yards',
      resolvable: true
    },
    {
      value: 'passing_yards',
      label: 'Passing Yards',
      team: true,
      player: true,
      api_path_team: 'statistics.team.{team_id}.passing.yards',
      api_path_player: 'statistics.players.{player_id}.passing.yards',
      resolvable: true
    },
    {
      value: 'rushing_yards',
      label: 'Rushing Yards',
      team: true,
      player: true,
      api_path_team: 'statistics.team.{team_id}.rushing.yards',
      api_path_player: 'statistics.players.{player_id}.rushing.yards',
      resolvable: true
    },
    {
      value: 'receiving_yards',
      label: 'Receiving Yards',
      team: true,
      player: true,
      api_path_team: 'statistics.team.{team_id}.receiving.yards',
      api_path_player: 'statistics.players.{player_id}.receiving.yards',
      resolvable: true
    },
    {
      value: 'touchdowns',
      label: 'Touchdowns',
      team: true,
      player: true,
      api_path_team: 'statistics.team.{team_id}.touchdowns.total',
      api_path_player: 'statistics.players.{player_id}.touchdowns.total',
      resolvable: true
    },
    {
      value: 'receptions',
      label: 'Receptions',
      team: true,
      player: true,
      api_path_team: 'statistics.team.{team_id}.receiving.receptions',
      api_path_player: 'statistics.players.{player_id}.receiving.receptions',
      resolvable: true
    },
    {
      value: 'interceptions',
      label: 'Interceptions',
      team: true,
      player: true,
      api_path_team: 'statistics.team.{team_id}.passing.interceptions',
      api_path_player: 'statistics.players.{player_id}.passing.interceptions',
      resolvable: true
    },
    {
      value: 'sacks',
      label: 'Sacks',
      team: true,
      player: true,
      api_path_team: 'statistics.team.{team_id}.defense.sacks',
      api_path_player: 'statistics.players.{player_id}.defense.sacks',
      resolvable: true
    },
    {
      value: 'field_goals',
      label: 'Field Goals Made',
      team: true,
      player: true,
      api_path_team: 'statistics.team.{team_id}.kicking.field_goals_made',
      api_path_player: 'statistics.players.{player_id}.kicking.field_goals_made',
      resolvable: true
    },
  ],
  
  auto_bet_templates: [
    {
      name: 'Home Moneyline',
      bet_type: 'COMPARISON',
      priority: 1,
      generate: (game: Game, odds?: any) => ({
        type: 'COMPARISON',
        participant_1: {
          subject_type: 'TEAM',
          subject_id: game.home_team_api_id,
          subject_name: game.home_team,
          metric: 'points',
          time_period: 'FULL_GAME'
        },
        participant_2: {
          subject_type: 'TEAM',
          subject_id: game.away_team_api_id,
          subject_name: game.away_team,
          metric: 'points',
          time_period: 'FULL_GAME'
        },
        operator: 'GREATER_THAN'
      } as ComparisonConfig)
    },
    {
      name: 'Away Moneyline',
      bet_type: 'COMPARISON',
      priority: 2,
      generate: (game: Game, odds?: any) => ({
        type: 'COMPARISON',
        participant_1: {
          subject_type: 'TEAM',
          subject_id: game.away_team_api_id,
          subject_name: game.away_team,
          metric: 'points',
          time_period: 'FULL_GAME'
        },
        participant_2: {
          subject_type: 'TEAM',
          subject_id: game.home_team_api_id,
          subject_name: game.home_team,
          metric: 'points',
          time_period: 'FULL_GAME'
        },
        operator: 'GREATER_THAN'
      } as ComparisonConfig)
    },
    {
      name: 'Spread (Home)',
      bet_type: 'COMPARISON',
      priority: 3,
      generate: (game: Game, odds?: any) => {
        // Extract spread from odds if available, default to -3.5
        const spreadValue = odds?.spread?.home || 3.5;
        const direction = spreadValue > 0 ? '+' : '-';
        
        return {
          type: 'COMPARISON',
          participant_1: {
            subject_type: 'TEAM',
            subject_id: game.home_team_api_id,
            subject_name: game.home_team,
            metric: 'points',
            time_period: 'FULL_GAME'
          },
          participant_2: {
            subject_type: 'TEAM',
            subject_id: game.away_team_api_id,
            subject_name: game.away_team,
            metric: 'points',
            time_period: 'FULL_GAME'
          },
          operator: 'GREATER_THAN',
          spread: {
            direction,
            value: Math.abs(spreadValue)
          }
        } as ComparisonConfig;
      }
    },
    {
      name: 'Spread (Away)',
      bet_type: 'COMPARISON',
      priority: 4,
      generate: (game: Game, odds?: any) => {
        // Extract spread from odds if available, default to +3.5
        const spreadValue = odds?.spread?.away || -3.5;
        const direction = spreadValue > 0 ? '+' : '-';
        
        return {
          type: 'COMPARISON',
          participant_1: {
            subject_type: 'TEAM',
            subject_id: game.away_team_api_id,
            subject_name: game.away_team,
            metric: 'points',
            time_period: 'FULL_GAME'
          },
          participant_2: {
            subject_type: 'TEAM',
            subject_id: game.home_team_api_id,
            subject_name: game.home_team,
            metric: 'points',
            time_period: 'FULL_GAME'
          },
          operator: 'GREATER_THAN',
          spread: {
            direction,
            value: Math.abs(spreadValue)
          }
        } as ComparisonConfig;
      }
    },
  ]
};

// Export registry for all sports
export const SPORT_CONFIGS: Record<string, SportConfig> = {
  american_football: AMERICAN_FOOTBALL_CONFIG,
  // basketball: BASKETBALL_CONFIG, // Future
  // hockey: HOCKEY_CONFIG, // Future
};
```

---

## API Integration

### api-sports.io Endpoints

Based on [api-sports.io NFL documentation](https://api-sports.io/documentation/nfl/v1#tag/Games):

```typescript
// backend/src/services/apiSports.service.ts

export class ApiSportsService {
  private baseUrl = 'https://v1.american-football.api-sports.io';
  private apiKey = process.env.API_SPORTS_KEY!;
  
  // Fetch games for a specific date
  async getGames(date: string, league: number = 1): Promise<Game[]> {
    // date format: YYYY-MM-DD
    const endpoint = `/games`;
    const params = { date, league };
    
    const response = await this.makeRequest(endpoint, params);
    return this.transformGamesResponse(response);
  }
  
  // Fetch game statistics (for resolution)
  async getGameStatistics(gameId: string): Promise<GameStatistics> {
    const endpoint = `/games/statistics`;
    const params = { id: gameId };
    
    const response = await this.makeRequest(endpoint, params);
    return this.transformStatisticsResponse(response);
  }
  
  // Fetch team information
  async getTeam(teamId: string): Promise<Team> {
    const endpoint = `/teams`;
    const params = { id: teamId };
    
    const response = await this.makeRequest(endpoint, params);
    return response.response[0];
  }
  
  // Fetch players for a team
  async getTeamPlayers(teamId: string): Promise<Player[]> {
    const endpoint = `/players`;
    const params = { team: teamId };
    
    const response = await this.makeRequest(endpoint, params);
    return response.response;
  }
  
  // Fetch odds for a game (separate endpoint)
  // See: https://api-sports.io/documentation/nfl/v1#tag/Odds
  async getOdds(gameId: string): Promise<Odds> {
    const endpoint = `/odds`;
    const params = { game: gameId };
    
    const response = await this.makeRequest(endpoint, params);
    return response.response[0];
  }
  
  private async makeRequest(endpoint: string, params: any) {
    const url = new URL(this.baseUrl + endpoint);
    Object.keys(params).forEach(key => 
      url.searchParams.append(key, params[key])
    );
    
    // Log for rate limiting
    const startTime = Date.now();
    
    const response = await fetch(url.toString(), {
      headers: {
        'x-rapidapi-key': this.apiKey,
        'x-rapidapi-host': 'v1.american-football.api-sports.io'
      }
    });
    
    const responseTime = Date.now() - startTime;
    const rateLimitRemaining = response.headers.get('x-ratelimit-requests-remaining');
    
    // Log API call
    await this.logApiCall(endpoint, response.status, responseTime, rateLimitRemaining);
    
    if (!response.ok) {
      throw new Error(`API Sports request failed: ${response.statusText}`);
    }
    
    return await response.json();
  }
  
  private async logApiCall(
    endpoint: string,
    statusCode: number,
    responseTime: number,
    rateLimitRemaining: string | null
  ) {
    await prisma.api_call_log.create({
      data: {
        endpoint,
        status_code: statusCode,
        response_time_ms: responseTime,
        rate_limit_remaining: rateLimitRemaining ? parseInt(rateLimitRemaining) : null
      }
    });
  }
}
```

### Caching Strategy

**Two-tier approach:**
1. **Game/Team Data**: Cached permanently (rarely changes)
2. **Player Rosters**: Fetched fresh every time admin clicks "Create Bets" (can change due to trades, injuries)

```typescript
// backend/src/services/gameCache.service.ts

export class GameCacheService {
  // Check if we need to refetch game data
  async shouldRefetch(gameId: string): Promise<boolean> {
    const game = await prisma.games.findUnique({
      where: { id: gameId },
      select: { api_fetched_at: true }
    });
    
    if (!game?.api_fetched_at) return true;
    
    // Don't auto-refetch, only manual refresh by admin
    return false;
  }
  
  // Manually refresh game data (admin triggered)
  async refreshGameData(gameId: string): Promise<Game> {
    const apiService = new ApiSportsService();
    const freshData = await apiService.getGameStatistics(gameId);
    
    const updated = await prisma.games.update({
      where: { id: gameId },
      data: {
        ...freshData,
        api_fetched_at: new Date()
      }
    });
    
    return updated;
  }
  
  // Cache teams from API response (permanent)
  async cacheTeams(teams: Team[]): Promise<void> {
    for (const team of teams) {
      await prisma.api_teams.upsert({
        where: { api_id: team.id },
        update: {
          name: team.name,
          abbreviation: team.abbreviation,
          logo_url: team.logo,
          updated_at: new Date()
        },
        create: {
          api_id: team.id,
          sport: 'american_football',
          name: team.name,
          abbreviation: team.abbreviation,
          logo_url: team.logo
        }
      });
    }
  }
  
  // Cache players for metadata only (name, position)
  // NOTE: This is just for historical reference. Player rosters are always
  // fetched fresh when admin opens bet creation modal to handle trades/roster changes.
  async cachePlayers(players: Player[], teamId: string): Promise<void> {
    for (const player of players) {
      await prisma.api_players.upsert({
        where: { api_id: player.id },
        update: {
          name: player.name,
          position: player.position,
          jersey_number: player.number,
          team_id: teamId, // Update team in case of trade
          updated_at: new Date()
        },
        create: {
          api_id: player.id,
          team_id: teamId,
          sport: 'american_football',
          name: player.name,
          position: player.position,
          jersey_number: player.number
        }
      });
    }
  }
  
  // Fetch fresh player roster (always call API, don't use cache)
  async getFreshPlayerRoster(teamId: string): Promise<Player[]> {
    const apiService = new ApiSportsService();
    const players = await apiService.getTeamPlayers(teamId);
    
    // Update cache for historical reference
    await this.cachePlayers(players, teamId);
    
    return players;
  }
}
```

---

## Admin Endpoints

### Games Management

```typescript
// backend/src/routes/admin.routes.ts

/**
 * @swagger
 * /api/admin/games/fetch:
 *   post:
 *     summary: Fetch games for a specific date from API
 *     tags: [Admin]
 */
router.post('/games/fetch', requireAdmin, async (req, res) => {
  const { date } = req.body; // YYYY-MM-DD format
  
  const apiService = new ApiSportsService();
  const games = await apiService.getGames(date);
  
  // Store games in database
  const stored = await gameService.storeGamesFromAPI(games);
  
  res.json({ games: stored, count: stored.length });
});

/**
 * @swagger
 * /api/admin/games/{gameId}/refresh:
 *   post:
 *     summary: Manually refresh game data from API
 */
router.post('/games/:gameId/refresh', requireAdmin, async (req, res) => {
  const { gameId } = req.params;
  
  const cacheService = new GameCacheService();
  const updated = await cacheService.refreshGameData(gameId);
  
  res.json({ game: updated, refreshed_at: updated.api_fetched_at });
});

/**
 * @swagger
 * /api/admin/games/{gameId}/players:
 *   get:
 *     summary: Get available players for a game (for bet creation)
 *     description: Always fetches fresh player data from API to handle trades/roster changes
 */
router.get('/games/:gameId/players', requireAdmin, async (req, res) => {
  const { gameId } = req.params;
  
  const game = await prisma.games.findUnique({ where: { id: gameId } });
  if (!game) return res.status(404).json({ error: 'Game not found' });
  
  // Always fetch fresh player data (rosters can change due to trades/injuries)
  const cacheService = new GameCacheService();
  const homePlayers = await cacheService.getFreshPlayerRoster(game.home_team_api_id);
  const awayPlayers = await cacheService.getFreshPlayerRoster(game.away_team_api_id);
  
  res.json({
    home_team: { name: game.home_team, players: homePlayers },
    away_team: { name: game.away_team, players: awayPlayers }
  });
});
```

### Bet Management

```typescript
/**
 * @swagger
 * /api/admin/games/{gameId}/bets/auto-generate:
 *   post:
 *     summary: Auto-generate standard bets (ML, spread) for a game
 */
router.post('/games/:gameId/bets/auto-generate', requireAdmin, async (req, res) => {
  const { gameId } = req.params;
  
  const game = await prisma.games.findUnique({ 
    where: { id: gameId },
    include: { odds: true }
  });
  
  if (!game) return res.status(404).json({ error: 'Game not found' });
  
  const sport = game.sport;
  const config = SPORT_CONFIGS[sport];
  if (!config) return res.status(400).json({ error: 'Sport config not found' });
  
  // Generate bets from templates
  const generatedBets = config.auto_bet_templates.map(template => {
    const betConfig = template.generate(game, game.odds);
    const displayText = generateDisplayText({ config: betConfig } as Bet);
    
    return {
      game_id: gameId,
      bet_type: template.bet_type,
      display_text: displayText,
      config: betConfig,
      priority: template.priority,
      outcome: 'pending'
    };
  });
  
  // Save to database
  const created = await prisma.bets.createMany({ data: generatedBets });
  
  res.json({ bets: generatedBets, count: created.count });
});

/**
 * @swagger
 * /api/admin/bets:
 *   post:
 *     summary: Create a custom bet
 */
router.post('/bets', requireAdmin, async (req, res) => {
  const { game_id, bet_type, config, display_text_override } = req.body;
  
  // Validate bet config
  const isValid = await betValidationService.validate(config);
  if (!isValid.valid) {
    return res.status(400).json({ error: isValid.error });
  }
  
  // Auto-generate display text
  const displayText = display_text_override || generateDisplayText({ config } as Bet);
  
  // Get current max priority for this game
  const maxPriority = await prisma.bets.aggregate({
    where: { game_id },
    _max: { priority: true }
  });
  
  const bet = await prisma.bets.create({
    data: {
      game_id,
      bet_type,
      config,
      display_text: displayText,
      display_text_override,
      priority: (maxPriority._max.priority || 0) + 1,
      outcome: 'pending'
    }
  });
  
  res.json({ bet });
});

/**
 * @swagger
 * /api/admin/bets/{betId}:
 *   patch:
 *     summary: Update a bet
 */
router.patch('/bets/:betId', requireAdmin, async (req, res) => {
  const { betId } = req.params;
  const updates = req.body;
  
  const bet = await prisma.bets.update({
    where: { id: betId },
    data: updates
  });
  
  res.json({ bet });
});

/**
 * @swagger
 * /api/admin/bets/{betId}:
 *   delete:
 *     summary: Delete a bet
 */
router.delete('/bets/:betId', requireAdmin, async (req, res) => {
  const { betId } = req.params;
  
  await prisma.bets.delete({ where: { id: betId } });
  
  res.json({ success: true });
});

/**
 * @swagger
 * /api/admin/games/{gameId}/bets/reorder:
 *   put:
 *     summary: Reorder bet priorities (from drag-drop)
 */
router.put('/games/:gameId/bets/reorder', requireAdmin, async (req, res) => {
  const { gameId } = req.params;
  const { bet_ids } = req.body; // Array of bet IDs in new order
  
  // Update priorities
  for (let i = 0; i < bet_ids.length; i++) {
    await prisma.bets.update({
      where: { id: bet_ids[i] },
      data: { priority: i + 1 }
    });
  }
  
  const updated = await prisma.bets.findMany({
    where: { game_id: gameId },
    orderBy: { priority: 'asc' }
  });
  
  res.json({ bets: updated });
});

/**
 * @swagger
 * /api/admin/bets/{betId}/void:
 *   post:
 *     summary: Void a bet (for player injuries, etc.)
 */
router.post('/bets/:betId/void', requireAdmin, async (req, res) => {
  const { betId } = req.params;
  const { reason } = req.body;
  
  const bet = await prisma.bets.update({
    where: { id: betId },
    data: {
      outcome: 'void',
      admin_resolution_notes: reason,
      resolved_at: new Date()
    }
  });
  
  res.json({ bet });
});
```

---

## Bet Publishing & Visibility System

### Database Schema Addition

Add publishing tracking to the database:

```sql
-- Track bet publication status per date
CREATE TABLE bet_publication_dates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE UNIQUE NOT NULL,
  is_locked BOOLEAN DEFAULT false,
  locked_at TIMESTAMP,
  locked_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add visibility field to bets
ALTER TABLE bets
  ADD COLUMN visible_from TIMESTAMP;
```

### Publishing Logic

**Admin Workflow:**
1. Admin creates/edits bets throughout the day
2. Admin clicks "Save" button at bottom of date page
3. Bets are marked as "locked" (complete) but still editable
4. At midnight UTC on game day, bets automatically become visible to users
5. Admin can still edit until midnight UTC cutoff

```typescript
// backend/src/services/betPublication.service.ts

export class BetPublicationService {
  // Lock a date as complete (admin clicked "Save")
  async lockDateBets(date: string): Promise<void> {
    const existingLock = await prisma.bet_publication_dates.findUnique({
      where: { date: new Date(date) }
    });
    
    if (existingLock) {
      await prisma.bet_publication_dates.update({
        where: { date: new Date(date) },
        data: {
          is_locked: true,
          locked_at: new Date()
        }
      });
    } else {
      await prisma.bet_publication_dates.create({
        data: {
          date: new Date(date),
          is_locked: true,
          locked_at: new Date()
        }
      });
    }
    
    // Set visible_from to midnight UTC on game day
    const midnightUTC = new Date(date);
    midnightUTC.setUTCHours(0, 0, 0, 0);
    
    // Update all bets for games on this date
    await prisma.bets.updateMany({
      where: {
        game: {
          start_time: {
            gte: midnightUTC,
            lt: new Date(midnightUTC.getTime() + 24 * 60 * 60 * 1000)
          }
        },
        visible_from: null
      },
      data: {
        visible_from: midnightUTC
      }
    });
  }
  
  // Check if date can still be edited
  async canEditDate(date: string): Promise<boolean> {
    const midnightUTC = new Date(date);
    midnightUTC.setUTCHours(0, 0, 0, 0);
    
    const now = new Date();
    
    // Can edit until midnight UTC on game day
    return now < midnightUTC;
  }
  
  // Get visible bets for users
  async getVisibleBets(gameId: string): Promise<Bet[]> {
    const now = new Date();
    
    return await prisma.bets.findMany({
      where: {
        game_id: gameId,
        visible_from: { lte: now },
        outcome: 'pending'
      },
      orderBy: { priority: 'asc' }
    });
  }
}
```

### Admin Endpoints

```typescript
/**
 * @swagger
 * /api/admin/dates/{date}/lock:
 *   post:
 *     summary: Lock bets for a date (marks as complete)
 */
router.post('/dates/:date/lock', requireAdmin, async (req, res) => {
  const { date } = req.params;
  
  const publicationService = new BetPublicationService();
  await publicationService.lockDateBets(date);
  
  res.json({ success: true, locked_at: new Date() });
});

/**
 * @swagger
 * /api/admin/dates/{date}/status:
 *   get:
 *     summary: Check if date is locked and editable
 */
router.get('/dates/:date/status', requireAdmin, async (req, res) => {
  const { date } = req.params;
  
  const publicationService = new BetPublicationService();
  const canEdit = await publicationService.canEditDate(date);
  
  const lockStatus = await prisma.bet_publication_dates.findUnique({
    where: { date: new Date(date) }
  });
  
  res.json({
    date,
    is_locked: lockStatus?.is_locked || false,
    can_edit: canEdit,
    locked_at: lockStatus?.locked_at || null
  });
});
```

### User-Facing Endpoint

```typescript
/**
 * @swagger
 * /api/games/{gameId}/bets:
 *   get:
 *     summary: Get visible bets for a game (user endpoint)
 */
router.get('/games/:gameId/bets', requireAuth, async (req, res) => {
  const { gameId } = req.params;
  
  const publicationService = new BetPublicationService();
  const bets = await publicationService.getVisibleBets(gameId);
  
  res.json({ bets });
});
```

### Admin UI Updates

Add "Save" button and lock status indicator:

```typescript
// frontend/src/pages/admin/BetCreation.tsx

export const BetCreationPage = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dateStatus, setDateStatus] = useState<DateStatus | null>(null);
  
  const checkDateStatus = async (date: Date) => {
    const response = await api.get(`/admin/dates/${formatDate(date)}/status`);
    setDateStatus(response);
  };
  
  const saveDateBets = async () => {
    await api.post(`/admin/dates/${formatDate(selectedDate)}/lock`);
    await checkDateStatus(selectedDate);
    alert('Bets saved! They will be visible to users at midnight UTC.');
  };
  
  return (
    <div>
      <h1>Create Bets</h1>
      
      <DatePicker 
        value={selectedDate} 
        onChange={(date) => {
          setSelectedDate(date);
          checkDateStatus(date);
        }} 
      />
      
      {dateStatus && (
        <div className="status-bar">
          {dateStatus.is_locked && (
            <span className="badge-success">✓ Saved</span>
          )}
          {!dateStatus.can_edit && (
            <span className="badge-warning">⚠ Cannot edit (past midnight UTC)</span>
          )}
        </div>
      )}
      
      <GamesList games={games} />
      
      {dateStatus?.can_edit && (
        <button 
          onClick={saveDateBets}
          className="save-button"
        >
          Save Bets for {formatDate(selectedDate)}
        </button>
      )}
    </div>
  );
};
```

---

## Admin UI Flow

### Page Structure

```
/admin/bets
  ├── Date Picker (top of page)
  ├── Games List (for selected date)
  │   └── Each game card:
  │       ├── Game info (teams, time, last fetched)
  │       ├── [Refresh Data] button
  │       ├── [Create Bets] button
  │       └── Bet count indicator
  └── Create Bets Modal (opened per game)
      ├── [Generate Standard Bets] button
      ├── Bet creation form
      │   ├── Bet type selector
      │   └── Dynamic form based on type
      └── Created bets list (drag-drop to reorder)
```

### Component Breakdown

```typescript
// frontend/src/pages/admin/BetCreation.tsx

export const BetCreationPage = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [games, setGames] = useState<Game[]>([]);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  
  const fetchGames = async (date: Date) => {
    // Fetch games for date
    const response = await api.post('/admin/games/fetch', {
      date: formatDate(date)
    });
    setGames(response.games);
  };
  
  return (
    <div>
      <h1>Create Bets</h1>
      
      <DatePicker value={selectedDate} onChange={setSelectedDate} />
      
      <GamesList
        games={games}
        onCreateBets={(game) => setSelectedGame(game)}
        onRefresh={(gameId) => refreshGameData(gameId)}
      />
      
      {selectedGame && (
        <BetCreationModal
          game={selectedGame}
          onClose={() => setSelectedGame(null)}
        />
      )}
    </div>
  );
};

// frontend/src/components/admin/BetCreationModal.tsx

export const BetCreationModal = ({ game, onClose }) => {
  const [betType, setBetType] = useState<BetType>('COMPARISON');
  const [createdBets, setCreatedBets] = useState<Bet[]>([]);
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  
  // Fetch fresh player roster when modal opens
  useEffect(() => {
    const fetchPlayers = async () => {
      setLoadingPlayers(true);
      try {
        const response = await api.get(`/admin/games/${game.id}/players`);
        // Combine home and away players
        const allPlayers = [
          ...response.home_team.players.map(p => ({ ...p, team: response.home_team.name })),
          ...response.away_team.players.map(p => ({ ...p, team: response.away_team.name }))
        ];
        setAvailablePlayers(allPlayers);
      } catch (error) {
        console.error('Failed to fetch players:', error);
      } finally {
        setLoadingPlayers(false);
      }
    };
    
    fetchPlayers();
  }, [game.id]);
  
  const generateStandardBets = async () => {
    const response = await api.post(
      `/admin/games/${game.id}/bets/auto-generate`
    );
    setCreatedBets(response.bets);
  };
  
  const createBet = async (config: BetConfig) => {
    const response = await api.post('/admin/bets', {
      game_id: game.id,
      bet_type: betType,
      config
    });
    setCreatedBets([...createdBets, response.bet]);
  };
  
  const reorderBets = async (newOrder: Bet[]) => {
    const betIds = newOrder.map(b => b.id);
    await api.put(`/admin/games/${game.id}/bets/reorder`, {
      bet_ids: betIds
    });
    setCreatedBets(newOrder);
  };
  
  return (
    <Modal onClose={onClose}>
      <h2>Create Bets - {game.home_team} vs {game.away_team}</h2>
      
      {loadingPlayers && (
        <div className="loading-indicator">
          <span>Fetching fresh player rosters...</span>
        </div>
      )}
      
      <button onClick={generateStandardBets}>
        Generate Standard Bets
      </button>
      
      <BetTypeSelector value={betType} onChange={setBetType} />
      
      {betType === 'COMPARISON' && (
        <ComparisonBetForm
          game={game}
          players={availablePlayers}
          onSubmit={createBet}
        />
      )}
      
      {betType === 'THRESHOLD' && (
        <ThresholdBetForm
          game={game}
          players={availablePlayers}
          onSubmit={createBet}
        />
      )}
      
      {betType === 'EVENT' && (
        <EventBetForm
          game={game}
          players={availablePlayers}
          onSubmit={createBet}
        />
      )}
      
      <h3>Created Bets (drag to reorder)</h3>
      <DragDropBetList
        bets={createdBets}
        onReorder={reorderBets}
        onEdit={(bet) => editBet(bet)}
        onDelete={(betId) => deleteBet(betId)}
      />
      
      <button onClick={onClose}>Done</button>
    </Modal>
  );
};

// frontend/src/components/admin/ComparisonBetForm.tsx

export const ComparisonBetForm = ({ game, players, onSubmit }) => {
  const [participant1, setParticipant1] = useState<Participant | null>(null);
  const [participant2, setParticipant2] = useState<Participant | null>(null);
  const [operator, setOperator] = useState<'GREATER_THAN' | 'spread'>('GREATER_THAN');
  const [spreadDirection, setSpreadDirection] = useState<'+' | '-'>('+');
  const [spreadValue, setSpreadValue] = useState<number>(3.5);
  
  const sportConfig = SPORT_CONFIGS[game.sport];
  
  const handleSubmit = () => {
    const config: ComparisonConfig = {
      type: 'COMPARISON',
      participant_1: participant1!,
      participant_2: participant2!,
      operator: 'GREATER_THAN',
      spread: operator === 'spread' ? {
        direction: spreadDirection,
        value: spreadValue
      } : undefined
    };
    
    onSubmit(config);
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <h4>Participant 1</h4>
      <ParticipantSelector
        teams={[game.home_team, game.away_team]}
        players={players}
        metrics={sportConfig.metrics}
        timePeriods={sportConfig.time_periods}
        value={participant1}
        onChange={setParticipant1}
      />
      
      <h4>Operator</h4>
      <select value={operator} onChange={(e) => setOperator(e.target.value as any)}>
        <option value="GREATER_THAN">Greater Than (>)</option>
        <option value="spread">Spread (+/-)</option>
      </select>
      
      {operator === 'spread' && (
        <div>
          <select value={spreadDirection} onChange={(e) => setSpreadDirection(e.target.value as any)}>
            <option value="+">+</option>
            <option value="-">-</option>
          </select>
          <input
            type="number"
            step="0.5"
            value={spreadValue}
            onChange={(e) => setSpreadValue(parseFloat(e.target.value))}
            placeholder="3.5"
          />
          <small>Must be half-point (X.5)</small>
        </div>
      )}
      
      <h4>Participant 2</h4>
      <ParticipantSelector
        teams={[game.home_team, game.away_team]}
        players={players}
        metrics={sportConfig.metrics}
        timePeriods={sportConfig.time_periods}
        value={participant2}
        onChange={setParticipant2}
      />
      
      <div className="preview">
        <strong>Preview:</strong> {generateDisplayTextPreview(config)}
      </div>
      
      <button type="submit">Create Bet</button>
    </form>
  );
};
```

---

## Resolution Logic

### Display Text Generation

```typescript
// shared/utils/betDisplay.ts

export function generateDisplayText(bet: Bet): string {
  const config = bet.config;
  
  if (config.type === 'COMPARISON') {
    const { participant_1, participant_2, spread } = config;
    
    // Moneyline (simple)
    if (!spread && participant_1.metric === 'points' && participant_1.time_period === 'FULL_GAME') {
      return `${participant_1.subject_name} ML`;
    }
    
    // Spread
    if (spread && participant_1.metric === 'points') {
      return `${participant_1.subject_name} ${spread.direction}${spread.value}`;
    }
    
    // Generic comparison
    const metricLabel = getMetricLabel(participant_1.metric);
    const period = participant_1.time_period !== 'FULL_GAME'
      ? ` (${getPeriodLabel(participant_1.time_period)})`
      : '';
    
    return `${participant_1.subject_name} ${metricLabel} > ${participant_2.subject_name} ${metricLabel}${period}`;
  }
  
  if (config.type === 'THRESHOLD') {
    const { participant, operator, threshold } = config;
    const metricLabel = getMetricLabel(participant.metric);
    const period = participant.time_period !== 'FULL_GAME'
      ? ` (${getPeriodLabel(participant.time_period)})`
      : '';
    
    return `${participant.subject_name} ${operator.toLowerCase()} ${threshold} ${metricLabel}${period}`;
  }
  
  if (config.type === 'EVENT') {
    const { participant, event_type, time_period } = config;
    const eventLabel = getEventLabel(event_type);
    const period = time_period !== 'FULL_GAME'
      ? ` (${getPeriodLabel(time_period)})`
      : '';
    
    return `${participant.subject_name} ${eventLabel}${period}`;
  }
  
  return 'Unknown bet';
}

function getMetricLabel(metric: string): string {
  // Look up from sport config
  const config = getCurrentSportConfig();
  const metricConfig = config.metrics.find(m => m.value === metric);
  return metricConfig?.label || metric;
}

function getPeriodLabel(period: TimePeriod): string {
  const config = getCurrentSportConfig();
  const periodConfig = config.time_periods.find(p => p.value === period);
  return periodConfig?.label || period;
}

function getEventLabel(eventType: EventType): string {
  const labels: Record<EventType, string> = {
    SCORES_TD: 'scores a touchdown',
    SCORES_FIRST: 'scores first',
    GAME_GOES_TO_OT: 'game goes to OT',
    SHUTOUT: 'gets shutout'
  };
  return labels[eventType] || eventType;
}
```

### Bet Resolution Engine

```typescript
// backend/src/services/betResolution.service.ts

export class BetResolutionService {
  private apiService = new ApiSportsService();
  
  async resolveBet(betId: string): Promise<BetOutcome> {
    const bet = await prisma.bets.findUnique({
      where: { id: betId },
      include: { game: true }
    });
    
    if (!bet) throw new Error('Bet not found');
    if (bet.game.status !== 'completed') throw new Error('Game not completed');
    
    try {
      // Fetch game statistics from API
      const stats = await this.apiService.getGameStatistics(bet.game.external_id);
      
      // Resolve based on bet type
      let outcome: BetOutcome;
      
      if (bet.config.type === 'COMPARISON') {
        outcome = this.resolveComparison(bet.config, stats);
      } else if (bet.config.type === 'THRESHOLD') {
        outcome = this.resolveThreshold(bet.config, stats);
      } else if (bet.config.type === 'EVENT') {
        outcome = this.resolveEvent(bet.config, stats);
      } else {
        throw new Error('Unknown bet type');
      }
      
      // Update bet in database
      await prisma.bets.update({
        where: { id: betId },
        data: {
          outcome,
          resolved_at: new Date(),
          needs_admin_resolution: false
        }
      });
      
      return outcome;
      
    } catch (error) {
      // Retry once
      await this.sleep(5000);
      
      try {
        const stats = await this.apiService.getGameStatistics(bet.game.external_id);
        // ... same resolution logic
        
      } catch (retryError) {
        // Mark for admin resolution
        await prisma.bets.update({
          where: { id: betId },
          data: {
            needs_admin_resolution: true,
            admin_resolution_notes: `Failed to resolve: ${error.message}`
          }
        });
        
        throw new Error('Resolution failed, marked for admin review');
      }
    }
  }
  
  private resolveComparison(config: ComparisonConfig, stats: GameStatistics): BetOutcome {
    const value1 = this.extractStatValue(config.participant_1, stats);
    const value2 = this.extractStatValue(config.participant_2, stats);
    
    if (value1 === null || value2 === null) {
      return 'void'; // Missing data
    }
    
    // Apply spread if exists
    let adjustedValue1 = value1;
    if (config.spread) {
      const spreadAmount = config.spread.direction === '+' 
        ? config.spread.value 
        : -config.spread.value;
      adjustedValue1 = value1 + spreadAmount;
    }
    
    // Compare
    if (adjustedValue1 > value2) return 'win';
    if (adjustedValue1 < value2) return 'loss';
    
    // Exact tie (shouldn't happen with half-point spreads)
    return 'push';
  }
  
  private resolveThreshold(config: ThresholdConfig, stats: GameStatistics): BetOutcome {
    const value = this.extractStatValue(config.participant, stats);
    
    if (value === null) return 'void';
    
    if (config.operator === 'OVER') {
      return value > config.threshold ? 'win' : 'loss';
    } else {
      return value < config.threshold ? 'win' : 'loss';
    }
  }
  
  private resolveEvent(config: EventConfig, stats: GameStatistics): BetOutcome {
    // Implement based on event type
    switch (config.event_type) {
      case 'SCORES_TD':
        const tds = this.extractStatValue(
          { ...config.participant, metric: 'touchdowns' },
          stats
        );
        return (tds && tds > 0) ? 'win' : 'loss';
        
      case 'GAME_GOES_TO_OT':
        return stats.periods.includes('overtime') ? 'win' : 'loss';
        
      // ... other event types
      
      default:
        return 'void';
    }
  }
  
  private extractStatValue(participant: Participant, stats: GameStatistics): number | null {
    const sportConfig = SPORT_CONFIGS[stats.sport];
    const metricConfig = sportConfig.metrics.find(m => m.value === participant.metric);
    
    if (!metricConfig) return null;
    
    // Get the API path template
    const pathTemplate = participant.subject_type === 'TEAM'
      ? metricConfig.api_path_team
      : metricConfig.api_path_player;
      
    if (!pathTemplate) return null;
    
    // Replace placeholders
    const path = pathTemplate
      .replace('{team_id}', participant.subject_id)
      .replace('{player_id}', participant.subject_id)
      .replace('{period}', participant.time_period);
    
    // Navigate JSON path
    return this.getValueByPath(stats, path);
  }
  
  private getValueByPath(obj: any, path: string): number | null {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current[key] === undefined) return null;
      current = current[key];
    }
    
    return typeof current === 'number' ? current : null;
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

---

## Edge Case Handling

### 1. Spread Half-Point Validation

```typescript
// shared/validation/betValidation.ts

export function validateSpread(spread: { direction: '+' | '-'; value: number }): boolean {
  // Must be half-point
  const isHalfPoint = spread.value % 1 === 0.5;
  if (!isHalfPoint) {
    throw new Error('Spread must be a half-point value (e.g., 3.5, 7.5)');
  }
  return true;
}
```

### 2. Postponed/Cancelled Games

```typescript
// backend/src/services/gameStatus.service.ts

export async function handlePostponedGame(gameId: string): Promise<void> {
  // Get all bets for this game
  const bets = await prisma.bets.findMany({
    where: { game_id: gameId, outcome: 'pending' }
  });
  
  // Mark all as push (virtual win for parlays)
  for (const bet of bets) {
    await prisma.bets.update({
      where: { id: bet.id },
      data: {
        outcome: 'push',
        resolved_at: new Date(),
        admin_resolution_notes: 'Game postponed/cancelled'
      }
    });
  }
  
  // Push bets don't count as wins or losses in parlays
  // They're treated as "virtual wins" - parlay continues with remaining bets
}
```

### 3. Player Injury (DNP)

```typescript
// Admin can manually void a bet before game starts

router.post('/admin/bets/:betId/void', requireAdmin, async (req, res) => {
  const { betId } = req.params;
  const { reason } = req.body;
  
  // Only void if game hasn't started
  const bet = await prisma.bets.findUnique({
    where: { id: betId },
    include: { game: true }
  });
  
  if (bet.game.status !== 'scheduled') {
    return res.status(400).json({ error: 'Can only void bets before game starts' });
  }
  
  await prisma.bets.update({
    where: { id: betId },
    data: {
      outcome: 'void',
      resolved_at: new Date(),
      admin_resolution_notes: reason
    }
  });
  
  res.json({ success: true });
});
```

### 4. API Failure Handling

```typescript
// If resolution fails twice, mark for admin review

async resolveBet(betId: string): Promise<BetOutcome> {
  try {
    // First attempt
    return await this.attemptResolution(betId);
  } catch (error) {
    await this.sleep(5000);
    
    try {
      // Second attempt
      return await this.attemptResolution(betId);
    } catch (retryError) {
      // Flag for admin
      await prisma.bets.update({
        where: { id: betId },
        data: {
          needs_admin_resolution: true,
          admin_resolution_notes: `Auto-resolution failed: ${error.message}`
        }
      });
      
      // Send alert to admin
      await this.notifyAdmin(betId, error);
      
      throw new Error('Resolution failed after retry');
    }
  }
}
```

---

## Admin Middleware

### Environment-based Admin Check

```typescript
// backend/src/middleware/admin.ts

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = req.session.user;
  
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  
  // Check if user email is in admin list (from .env)
  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
  
  if (!adminEmails.includes(user.email)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
}
```

### Environment Variable

```bash
# backend/.env
ADMIN_EMAILS=admin@example.com,nick@example.com
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1)
- [ ] Create database migrations for new tables
- [ ] Set up api-sports.io service
- [ ] Implement sport configs (American Football only)
- [ ] Build admin middleware
- [ ] Create basic admin endpoints (fetch games, view games)

### Phase 2: Bet Creation (Week 2)
- [ ] Implement bet creation endpoints
- [ ] Build display text generation
- [ ] Create bet validation service
- [ ] Add auto-bet generation
- [ ] Build admin UI (date picker, games list)
- [ ] Implement bet publishing system (Save button, visibility)

### Phase 3: Advanced Features (Week 3)
- [ ] Build bet creation modal (all 3 types)
- [ ] Implement drag-drop reordering
- [ ] Add player fetching
- [ ] Cache teams/players
- [ ] Build manual refresh functionality
- [ ] Add date lock status indicators

### Phase 4: Resolution (Week 4)
- [ ] Build bet resolution engine
- [ ] Implement stat extraction logic
- [ ] Add retry mechanism
- [ ] Build admin resolution override UI
- [ ] Test all edge cases

### Phase 5: Polish (Week 5)
- [ ] Add odds display
- [ ] Improve auto-bet generation with odds
- [ ] Add bet preview in UI
- [ ] Build admin dashboard (metrics, rate limits)
- [ ] Documentation and testing

---

## Testing Checklist

### Bet Creation
- [ ] Create COMPARISON bet (moneyline)
- [ ] Create COMPARISON bet (spread with half-points)
- [ ] Create THRESHOLD bet (team total)
- [ ] Create THRESHOLD bet (player prop)
- [ ] Create EVENT bet
- [ ] Auto-generate standard bets
- [ ] Reorder bet priorities
- [ ] Edit existing bet
- [ ] Delete bet
- [ ] Void bet (player injury)

### Resolution
- [ ] Resolve moneyline (win)
- [ ] Resolve moneyline (loss)
- [ ] Resolve spread (win by spread)
- [ ] Resolve spread (loss by spread)
- [ ] Resolve over/under (over wins)
- [ ] Resolve over/under (under wins)
- [ ] Resolve player prop (data available)
- [ ] Resolve player prop (player DNP - void)
- [ ] Resolve event bet (event occurred)
- [ ] Resolve event bet (event didn't occur)
- [ ] Handle API failure (retry, then flag)
- [ ] Handle postponed game (push all bets)

### API Integration
- [ ] Fetch games for date
- [ ] Cache games in database
- [ ] Fetch team info and cache (permanent)
- [ ] Fetch fresh player roster when admin opens bet creation modal
- [ ] Cache player metadata (historical reference)
- [ ] Fetch odds data
- [ ] Manual refresh game data
- [ ] Track API rate limits
- [ ] Handle API downtime gracefully

### Bet Publishing & Visibility
- [ ] Lock date (Save button)
- [ ] Check date status (locked/editable)
- [ ] Edit bets after locking but before midnight UTC
- [ ] Prevent edits after midnight UTC cutoff
- [ ] Bets visible to users at midnight UTC
- [ ] Bets not visible to users before midnight UTC
- [ ] Date lock status displays correctly in admin UI

---

## Future Enhancements

### Multi-Sport Support
- Basketball (NBA) config
- Hockey (NHL) config
- Baseball (MLB) config

### Advanced Bet Types
- Same-Game Parlays (SGP)
- Live betting (in-game)
- Futures (season-long bets)

### Analytics
- Track most popular bet types
- Success rate by bet type
- Admin dashboard with metrics

### Automation
- Auto-void bets for injured players (scrape injury reports)
- Auto-generate player props based on season averages
- Smart odds-based bet suggestions

### Player Roster Edge Case (Future Guardrails)
**Edge Case:** If admin creates player prop bets a week in advance, player could be traded between bet creation and game day.

**Potential Solutions (to implement later):**
1. **Pre-game validation**: Before midnight UTC (when bets go live), validate all player props
   - Check if player is still on the team
   - Auto-void bets for traded/released players
   - Send admin notification for review
2. **Trade monitoring**: Subscribe to roster change feeds/APIs
   - Automatically flag affected bets
   - Admin dashboard shows "at-risk" bets
3. **Bet locking period**: Only allow player props to be created within 48 hours of game
4. **User-facing disclaimer**: "Player props subject to change based on roster moves"

**Current Mitigation:**
- Player rosters fetched fresh each time admin opens bet creation modal
- Minimizes stale data during bet creation process
- Manual admin oversight before clicking "Save"

---

## Questions Resolved

1. **Odds Source:** ✅ Separate endpoint - https://api-sports.io/documentation/nfl/v1#tag/Odds
2. **Player Data Freshness:** ✅ Game/team data cached permanently. Player rosters fetched fresh every time admin clicks "Create Bets" to handle trades/roster changes. Edge case of trades between bet creation and game day addressed in Future Enhancements.
3. **Bet Editing:** ✅ Admins can edit bets until "Save" button clicked on date page (locks as complete). Still editable until midnight UTC on game day.
4. **Display to Users:** ✅ Bets become visible to users at midnight UTC on game day
5. **Bet Approval:** ✅ No approval step needed (single admin workflow)

---

## Related Documents

- [TECH_REQUIREMENTS.md](./TECH_REQUIREMENTS.md) - Core technical requirements
- [PRODUCT_OVERVIEW.md](./PRODUCT_OVERVIEW.md) - Product and game rules
- API Documentation: https://api-sports.io/documentation/nfl/v1

---

**Status:** Ready for Implementation  
**Last Updated:** 2025-11-16  
**Owner:** Nick

