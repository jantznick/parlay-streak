#!/usr/bin/env ts-node

/**
 * Script to fetch roster data for all teams from ESPN API
 * Saves roster data to backend/data/rosters/
 * 
 * Run with: npm run fetch-rosters
 * Or: ts-node backend/scripts/fetch-rosters.ts
 * 
 * This should be run nightly to keep roster data fresh
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
const ROSTERS_DIR = path.join(__dirname, '../data/rosters');

interface Team {
  id: string;
  abbreviation: string;
  displayName: string;
  sport: string;
  league: string;
}

interface RosterData {
  teamId: string;
  sport: string;
  league: string;
  timestamp: string;
  athletes: any[];
  team: any;
}

// Load teams from config
function loadTeams(): Team[] {
  const teamsPath = path.join(__dirname, '../../shared/constants/teams.json');
  
  if (!fs.existsSync(teamsPath)) {
    console.error('❌ teams.json not found. Please run fetch-teams.ts first.');
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(teamsPath, 'utf-8'));
  const teams: Team[] = [];

  for (const league of config.leagues || []) {
    for (const team of league.teams || []) {
      teams.push({
        id: team.id,
        abbreviation: team.abbreviation,
        displayName: team.displayName,
        sport: league.sport,
        league: league.league,
      });
    }
  }

  return teams;
}

async function fetchRoster(sport: string, league: string, teamId: string): Promise<any | null> {
  const url = `${BASE_URL}/${sport}/${league}/teams/${teamId}/roster`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 404) {
        console.log(`  ⚠️  No roster found for ${sport}/${league}/teams/${teamId}`);
        return null;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error(`  ❌ Error fetching roster for ${sport}/${league}/teams/${teamId}:`, error.message);
    return null;
  }
}

function getRosterAge(sport: string, league: string, teamId: string): number | null {
  const rosterFile = path.join(ROSTERS_DIR, sport, league, `${teamId}.json`);
  
  if (!fs.existsSync(rosterFile)) {
    return null; // File doesn't exist
  }

  try {
    const data = JSON.parse(fs.readFileSync(rosterFile, 'utf-8'));
    const timestamp = new Date(data.timestamp);
    const ageMs = Date.now() - timestamp.getTime();
    return ageMs;
  } catch (error) {
    return null; // Error reading file, treat as missing
  }
}

function shouldUpdateRoster(sport: string, league: string, teamId: string): boolean {
  const ageMs = getRosterAge(sport, league, teamId);
  
  if (ageMs === null) {
    return true; // File doesn't exist, need to fetch
  }

  // Update if older than 24 hours
  const oneDayMs = 24 * 60 * 60 * 1000;
  return ageMs > oneDayMs;
}

async function saveRoster(sport: string, league: string, teamId: string, rosterData: any) {
  const leagueDir = path.join(ROSTERS_DIR, sport, league);
  if (!fs.existsSync(leagueDir)) {
    fs.mkdirSync(leagueDir, { recursive: true });
  }

  const rosterFile = path.join(leagueDir, `${teamId}.json`);
  const tempFile = `${rosterFile}.tmp`;
  
  const data: RosterData = {
    teamId,
    sport,
    league,
    timestamp: new Date().toISOString(),
    athletes: rosterData.athletes || [],
    team: rosterData.team || {},
  };

  // Write to temp file first, then rename (atomic write)
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2));
  fs.renameSync(tempFile, rosterFile);
}

function formatAge(ageMs: number): string {
  const hours = Math.floor(ageMs / (60 * 60 * 1000));
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  return `${hours}h`;
}

async function main() {
  console.log('Starting roster data fetch...\n');

  // Ensure rosters directory exists
  if (!fs.existsSync(ROSTERS_DIR)) {
    fs.mkdirSync(ROSTERS_DIR, { recursive: true });
  }

  const teams = loadTeams();
  console.log(`Loaded ${teams.length} teams from config\n`);

  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  for (let i = 0; i < teams.length; i++) {
    const team = teams[i];
    const shouldUpdate = shouldUpdateRoster(team.sport, team.league, team.id);
    
    if (!shouldUpdate) {
      const ageMs = getRosterAge(team.sport, team.league, team.id);
      const ageStr = ageMs ? formatAge(ageMs) : 'unknown';
      console.log(`[${i + 1}/${teams.length}] ⏭️  Skipping ${team.displayName} (${team.sport}/${team.league}) - updated ${ageStr} ago`);
      skipCount++;
      continue;
    }

    console.log(`[${i + 1}/${teams.length}] 📥 Fetching roster for ${team.displayName} (${team.sport}/${team.league})...`);

    const rosterData = await fetchRoster(team.sport, team.league, team.id);
    
    if (rosterData) {
      await saveRoster(team.sport, team.league, team.id, rosterData);
      successCount++;
      console.log(`  ✅ Saved roster (${rosterData.athletes?.length || 0} athletes)`);
      
      // Upload to Backblaze if configured
      if (backblazeService) {
        const rosterFile = path.join(ROSTERS_DIR, team.sport, team.league, `${team.id}.json`);
        const remotePath = `rosters/${team.sport}/${team.league}/${team.id}.json`;
        const uploaded = await backblazeService.uploadFile(rosterFile, remotePath);
        if (uploaded) {
          console.log(`  ☁️  Uploaded to Backblaze`);
        }
      }
    } else {
      failCount++;
      console.log(`  ❌ Failed to fetch roster`);
    }

    // Delay to avoid rate limiting (500ms between requests)
    if (i < teams.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log(`\n✅ Roster fetch complete!`);
  console.log(`   Updated: ${successCount}`);
  console.log(`   Skipped: ${skipCount} (updated less than 24h ago)`);
  console.log(`   Failed: ${failCount}`);
  console.log(`   Data saved to: ${ROSTERS_DIR}`);
}

main().catch(console.error);

