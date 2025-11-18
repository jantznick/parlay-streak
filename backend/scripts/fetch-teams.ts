#!/usr/bin/env ts-node

/**
 * Script to fetch team data for all supported leagues from ESPN API
 * Saves team data to shared/constants/teams.json
 * 
 * Run with: npm run fetch-teams
 * Or: ts-node backend/scripts/fetch-teams.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

// Import Backblaze service
let backblazeService: any = null;
try {
  // Try to import the service (works if backend is built)
  const backblazePath = path.join(__dirname, '../dist/services/backblaze.service.js');
  if (fs.existsSync(backblazePath)) {
    backblazeService = require(backblazePath).backblazeService;
  } else {
    // Try TypeScript source (for development)
    const tsBackblazePath = path.join(__dirname, '../src/services/backblaze.service.ts');
    if (fs.existsSync(tsBackblazePath)) {
      // Use ts-node to require TypeScript
      require('ts-node/register');
      backblazeService = require('../src/services/backblaze.service').backblazeService;
    }
  }
} catch (error: any) {
  console.warn('⚠️  Backblaze service not available, uploads will be skipped:', error.message);
}

const BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports';

interface Team {
  id: string;
  abbreviation: string;
  displayName: string;
  location: string;
  name: string;
  slug: string;
}

interface LeagueTeams {
  sport: string;
  league: string;
  teams: Team[];
  lastFetched: string;
}

interface TeamsConfig {
  leagues: LeagueTeams[];
  lastUpdated: string;
}

const SPORTS_CONFIG = [
  {
    sport: 'basketball',
    leagues: ['nba', 'wnba', 'mens-college-basketball', 'womens-college-basketball'],
  },
  {
    sport: 'football',
    leagues: ['nfl', 'college-football'],
  },
  {
    sport: 'baseball',
    leagues: ['mlb', 'college-baseball'],
  },
  {
    sport: 'hockey',
    leagues: ['nhl'],
  },
  // Note: soccer uses 'all' which might have a different structure
];

async function fetchTeams(sport: string, league: string): Promise<Team[]> {
  const url = `${BASE_URL}/${sport}/${league}/teams`;
  console.log(`Fetching teams for ${sport}/${league}...`);

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: any = await response.json();
    
    // ESPN API structure: sports[0].leagues[0].teams[]
    const teams: Team[] = [];
    
    if (data?.sports && Array.isArray(data.sports)) {
      for (const sportData of data.sports) {
        if (sportData.leagues && Array.isArray(sportData.leagues)) {
          for (const leagueData of sportData.leagues) {
            if (leagueData.teams && Array.isArray(leagueData.teams)) {
              for (const teamWrapper of leagueData.teams) {
                const team = teamWrapper.team || teamWrapper;
                if (team?.id) {
                  teams.push({
                    id: team.id,
                    abbreviation: team.abbreviation || '',
                    displayName: team.displayName || team.name || '',
                    location: team.location || '',
                    name: team.name || '',
                    slug: team.slug || '',
                  });
                }
              }
            }
          }
        }
      }
    }

    console.log(`  Found ${teams.length} teams`);
    return teams;
  } catch (error: any) {
    console.error(`  Error fetching teams for ${sport}/${league}:`, error.message);
    return [];
  }
}

function loadExistingConfig(): TeamsConfig | null {
  const outputPath = path.join(__dirname, '../../shared/constants/teams.json');
  
  if (!fs.existsSync(outputPath)) {
    return null;
  }

  try {
    const content = fs.readFileSync(outputPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.warn('Error loading existing config, starting fresh:', error);
    return null;
  }
}

function saveConfig(config: TeamsConfig) {
  const outputPath = path.join(__dirname, '../../shared/constants/teams.json');
  const outputDir = path.dirname(outputPath);
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write to temp file first, then rename (atomic write)
  const tempPath = `${outputPath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(config, null, 2));
  fs.renameSync(tempPath, outputPath);
}

function shouldUpdateLeague(existingConfig: TeamsConfig | null, sport: string, league: string): boolean {
  if (!existingConfig) {
    return true; // No existing config, need to fetch
  }

  const existingLeague = existingConfig.leagues.find(
    (l) => l.sport === sport && l.league === league
  );

  if (!existingLeague) {
    return true; // League doesn't exist, need to fetch
  }

  // Check if last fetched was more than 24 hours ago
  const lastFetched = new Date(existingLeague.lastFetched);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  
  return lastFetched < oneDayAgo;
}

async function main() {
  console.log('Starting team data fetch...\n');

  // Load existing config or start fresh
  let config = loadExistingConfig();
  if (!config) {
    config = {
      leagues: [],
      lastUpdated: new Date().toISOString(),
    };
  }

  const initialLeagueCount = config.leagues.length;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const sportConfig of SPORTS_CONFIG) {
    for (const league of sportConfig.leagues) {
      const shouldUpdate = shouldUpdateLeague(config, sportConfig.sport, league);
      
      if (!shouldUpdate) {
        console.log(`⏭️  Skipping ${sportConfig.sport}/${league} (updated less than 24h ago)`);
        skippedCount++;
        continue;
      }

      console.log(`📥 Fetching ${sportConfig.sport}/${league}...`);
      const teams = await fetchTeams(sportConfig.sport, league);
      
      if (teams.length > 0) {
        // Remove existing league entry if it exists
        config.leagues = config.leagues.filter(
          (l) => !(l.sport === sportConfig.sport && l.league === league)
        );

        // Add updated league entry
        config.leagues.push({
          sport: sportConfig.sport,
          league,
          teams,
          lastFetched: new Date().toISOString(),
        });

        // Save incrementally after each league
        config.lastUpdated = new Date().toISOString();
        saveConfig(config);
        console.log(`  ✅ Saved ${teams.length} teams`);
        
        // Upload to Backblaze if configured
        if (backblazeService) {
          const teamsPath = path.join(__dirname, '../../shared/constants/teams.json');
          const uploaded = await backblazeService.uploadFile(teamsPath, 'teams/teams.json');
          if (uploaded) {
            console.log(`  ☁️  Uploaded to Backblaze`);
          }
        }
        
        updatedCount++;
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`\n✅ Team data fetch complete!`);
  console.log(`   Updated: ${updatedCount} leagues`);
  console.log(`   Skipped: ${skippedCount} leagues (recently updated)`);
  console.log(`   Total leagues: ${config.leagues.length}`);
  console.log(`   Total teams: ${config.leagues.reduce((sum, l) => sum + l.teams.length, 0)}`);
  console.log(`   Data saved to: ${path.join(__dirname, '../../shared/constants/teams.json')}`);
  
  // Final upload to Backblaze
  if (backblazeService && updatedCount > 0) {
    const teamsPath = path.join(__dirname, '../../shared/constants/teams.json');
    const uploaded = await backblazeService.uploadFile(teamsPath, 'teams/teams.json');
    if (uploaded) {
      console.log(`   ☁️  Final upload to Backblaze complete`);
    }
  }
}

main().catch(console.error);

