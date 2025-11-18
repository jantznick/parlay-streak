#!/usr/bin/env ts-node

/**
 * Script to upload existing data files to Backblaze B2
 * 
 * Run with: npm run upload-to-backblaze
 * Or: ts-node backend/scripts/upload-to-backblaze.ts
 * 
 * This uploads:
 * - shared/constants/teams.json → teams/teams.json
 * - backend/data/rosters/**/*.json → rosters/{sport}/{league}/{teamId}.json
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
    } else {
      console.error('❌ Backblaze service not found. Please build the backend first: npm run build');
      process.exit(1);
    }
  }
} catch (error: any) {
  console.error('❌ Error loading Backblaze service:', error.message);
  process.exit(1);
}

async function uploadTeams() {
  const teamsPath = path.join(__dirname, '../../shared/constants/teams.json');
  
  if (!fs.existsSync(teamsPath)) {
    console.log('⚠️  teams.json not found, skipping...');
    return false;
  }

  console.log('📤 Uploading teams.json...');
  const success = await backblazeService.uploadFile(teamsPath, 'teams/teams.json');
  
  if (success) {
    console.log('  ✅ Uploaded teams.json to Backblaze');
  } else {
    console.log('  ❌ Failed to upload teams.json');
  }
  
  return success;
}

async function uploadRosters() {
  const rostersDir = path.join(__dirname, '../data/rosters');
  
  if (!fs.existsSync(rostersDir)) {
    console.log('⚠️  Rosters directory not found, skipping...');
    return { success: 0, failed: 0 };
  }

  console.log('📤 Uploading rosters...');
  let successCount = 0;
  let failCount = 0;

  // Walk through all roster files
  const sports = fs.readdirSync(rostersDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  for (const sport of sports) {
    const sportDir = path.join(rostersDir, sport);
    const leagues = fs.readdirSync(sportDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const league of leagues) {
      const leagueDir = path.join(sportDir, league);
      const files = fs.readdirSync(leagueDir)
        .filter(file => file.endsWith('.json'));

      for (const file of files) {
        const localPath = path.join(leagueDir, file);
        const remotePath = `rosters/${sport}/${league}/${file}`;
        
        const success = await backblazeService.uploadFile(localPath, remotePath);
        if (success) {
          successCount++;
          console.log(`  ✅ ${remotePath}`);
        } else {
          failCount++;
          console.log(`  ❌ ${remotePath}`);
        }
      }
    }
  }

  return { success: successCount, failed: failCount };
}

async function main() {
  console.log('🚀 Starting Backblaze upload...\n');

  // Check if Backblaze is configured
  if (!process.env.BACKBLAZE_KEY_ID || !process.env.BACKBLAZE_APPLICATION_KEY || !process.env.BACKBLAZE_BUCKET_NAME) {
    console.error('❌ Backblaze not configured!');
    console.error('   Please set BACKBLAZE_KEY_ID, BACKBLAZE_APPLICATION_KEY, and BACKBLAZE_BUCKET_NAME in .env');
    process.exit(1);
  }

  // Upload teams
  await uploadTeams();
  console.log('');

  // Upload rosters
  const rosterStats = await uploadRosters();

  console.log(`\n✅ Upload complete!`);
  console.log(`   Teams: 1 file`);
  console.log(`   Rosters: ${rosterStats.success} uploaded, ${rosterStats.failed} failed`);
}

main().catch(console.error);

