/**
 * Test script for bet resolution
 * Run with: npx ts-node test-resolution.ts
 */

import { readFileSync } from 'fs';
import { resolveBet } from './shared/utils/betResolution';
import { BASKETBALL_CONFIG } from './shared/config/sports/basketball';
import { ComparisonConfig, ThresholdConfig, BetConfig } from './shared/types/bets';

// Load sample data
const gameData = JSON.parse(readFileSync('./sample-basketball-end.json', 'utf-8'));

// Player IDs from the sample data
const BRANDON_INGRAM_ID = '3913176';  // 11 pts, 5 reb, 4 ast
const RJ_BARRETT_ID = '4395625';      // 9 pts, 9 reb, 4 ast
const DEANDRE_HUNTER_ID = '4065732';  // 16 pts, 2 reb, 6 ast
const JARRETT_ALLEN_ID = '4066328';   // 6 pts, 8 reb, 0 ast
const SCOTTIE_BARNES_ID = '4433134';  // Need to check stats
const DONOVAN_MITCHELL_ID = '3908809'; // Need to check stats

// Create a sample moneyline bet (Toronto Raptors vs Cleveland Cavaliers)
const bets: ComparisonConfig[] = [{
  type: 'COMPARISON',
  participant_1: {
    subject_type: 'TEAM',
    subject_id: '28', // Toronto Raptors
    subject_name: 'Toronto Raptors',
    metric: 'points',
    time_period: 'FULL_GAME'
  },
  participant_2: {
    subject_type: 'TEAM',
    subject_id: '5', // Cleveland Cavaliers
    subject_name: 'Cleveland Cavaliers',
    metric: 'points',
    time_period: 'FULL_GAME'
  },
  operator: 'GREATER_THAN'
},{
    type: 'COMPARISON',
    participant_1: {
      subject_type: 'PLAYER',
      subject_id: DEANDRE_HUNTER_ID,
      subject_name: "De'Andre Hunter",
      metric: 'points',
      time_period: 'FULL_GAME'
    },
    participant_2: {
      subject_type: 'PLAYER',
      subject_id: BRANDON_INGRAM_ID,
      subject_name: 'Brandon Ingram',
      metric: 'points',
      time_period: 'FULL_GAME'
    },
    operator: 'GREATER_THAN'
  }, {
    type: 'COMPARISON',
    participant_1: {
      subject_type: 'TEAM',
      subject_id: '28',
      subject_name: 'Toronto Raptors',
      metric: 'points',
      time_period: 'Q1'
    },
    participant_2: {
      subject_type: 'TEAM',
      subject_id: '5',
      subject_name: 'Cleveland Cavaliers',
      metric: 'points',
      time_period: 'Q1'
    },
    operator: 'GREATER_THAN'
  }, {
    type: 'COMPARISON',
    participant_1: {
      subject_type: 'TEAM',
      subject_id: '28',
      subject_name: 'Toronto Raptors',
      metric: 'points',
      time_period: 'Q2'
    },
    participant_2: {
      subject_type: 'TEAM',
      subject_id: '5',
      subject_name: 'Cleveland Cavaliers',
      metric: 'points',
      time_period: 'Q2'
    },
    operator: 'GREATER_THAN'
  } as ComparisonConfig];

// Create threshold bet examples
const thresholdBets: ThresholdConfig[] = [{
  type: 'THRESHOLD',
  participant: {
    subject_type: 'TEAM',
    subject_id: '28', // Toronto Raptors
    subject_name: 'Toronto Raptors',
    metric: 'points',
    time_period: 'FULL_GAME'
  },
  operator: 'OVER',
  threshold: 120
}, {
  type: 'THRESHOLD',
  participant: {
    subject_type: 'PLAYER',
    subject_id: DEANDRE_HUNTER_ID,
    subject_name: "De'Andre Hunter",
    metric: 'points',
    time_period: 'FULL_GAME'
  },
  operator: 'OVER',
  threshold: 15
}, {
  type: 'THRESHOLD',
  participant: {
    subject_type: 'PLAYER',
    subject_id: BRANDON_INGRAM_ID,
    subject_name: 'Brandon Ingram',
    metric: 'points',
    time_period: 'Q1'
  },
  operator: 'UNDER',
  threshold: 5
}];

console.log('Testing bet resolution...');
console.log('\n');

console.log('=== COMPARISON BETS ===\n');
for (const bet of bets) {
  const result = resolveBet(bet, gameData, BASKETBALL_CONFIG);
  console.log('Resolution Result:');
  console.log(JSON.stringify(result, null, 2));
  console.log('\n');
}

console.log('=== THRESHOLD BETS ===\n');
for (const bet of thresholdBets) {
  const result = resolveBet(bet, gameData, BASKETBALL_CONFIG);
  console.log('Resolution Result:');
  console.log(JSON.stringify(result, null, 2));
  console.log('\n');
}
