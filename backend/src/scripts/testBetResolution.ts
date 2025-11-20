/**
 * Test script for bet resolution
 * 
 * Creates sample bet configs and tests them against the sample basketball game data
 */

import * as fs from 'fs';
import * as path from 'path';
import { resolveBet } from '../services/betResolution.service';
import { BetConfig, ComparisonConfig, ThresholdConfig, EventConfig } from '../../../shared/types/bets';
import { BASKETBALL_STAT_PATHS, getPeriodNumbers as getBasketballPeriodNumbers } from '../../../shared/config/sports/basketball-data-paths';

// Load the sample game data
// Path from backend/src/scripts to root/sample-basketball-end.json
// When running with ts-node, __dirname is backend/src/scripts
// So we need to go up 3 levels: ../../../sample-basketball-end.json
const sampleGamePath = path.resolve(__dirname, '../../../sample-basketball-end.json');
if (!fs.existsSync(sampleGamePath)) {
  throw new Error(`Sample game file not found at: ${sampleGamePath}`);
}
const gameData = JSON.parse(fs.readFileSync(sampleGamePath, 'utf-8'));

// Team IDs from the sample data
const TORONTO_RAPTORS_ID = '28';
const CLEVELAND_CAVALIERS_ID = '5';

// Player IDs from the sample data
const BRANDON_INGRAM_ID = '3913176';  // 11 pts, 5 reb, 4 ast
const RJ_BARRETT_ID = '4395625';      // 9 pts, 9 reb, 4 ast
const DEANDRE_HUNTER_ID = '4065732';  // 16 pts, 2 reb, 6 ast
const JARRETT_ALLEN_ID = '4066328';   // 6 pts, 8 reb, 0 ast
const SCOTTIE_BARNES_ID = '4433134';  // Need to check stats
const DONOVAN_MITCHELL_ID = '3908809'; // Need to check stats

/**
 * Create sample bet configs
 */
function createSampleBets(): BetConfig[] {
  const bets: BetConfig[] = [];

  // ===== COMPARISON BETS =====

  // 1. Moneyline - Toronto vs Cleveland (Full Game)
  bets.push({
    type: 'COMPARISON',
    participant_1: {
      subject_type: 'TEAM',
      subject_id: TORONTO_RAPTORS_ID,
      subject_name: 'Toronto Raptors',
      metric: 'points',
      time_period: 'FULL_GAME'
    },
    participant_2: {
      subject_type: 'TEAM',
      subject_id: CLEVELAND_CAVALIERS_ID,
      subject_name: 'Cleveland Cavaliers',
      metric: 'points',
      time_period: 'FULL_GAME'
    },
    operator: 'GREATER_THAN'
  } as ComparisonConfig);

  // 2. Spread - Toronto -3.5 vs Cleveland
  bets.push({
    type: 'COMPARISON',
    participant_1: {
      subject_type: 'TEAM',
      subject_id: TORONTO_RAPTORS_ID,
      subject_name: 'Toronto Raptors',
      metric: 'points',
      time_period: 'FULL_GAME'
    },
    participant_2: {
      subject_type: 'TEAM',
      subject_id: CLEVELAND_CAVALIERS_ID,
      subject_name: 'Cleveland Cavaliers',
      metric: 'points',
      time_period: 'FULL_GAME'
    },
    operator: 'GREATER_THAN',
    spread: {
      direction: '-',
      value: 3.5
    }
  } as ComparisonConfig);

  // 3. Player vs Player - Points (Full Game)
  bets.push({
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
  } as ComparisonConfig);

  // 4. Team Rebounds Comparison
  bets.push({
    type: 'COMPARISON',
    participant_1: {
      subject_type: 'TEAM',
      subject_id: TORONTO_RAPTORS_ID,
      subject_name: 'Toronto Raptors',
      metric: 'rebounds',
      time_period: 'FULL_GAME'
    },
    participant_2: {
      subject_type: 'TEAM',
      subject_id: CLEVELAND_CAVALIERS_ID,
      subject_name: 'Cleveland Cavaliers',
      metric: 'rebounds',
      time_period: 'FULL_GAME'
    },
    operator: 'GREATER_THAN'
  } as ComparisonConfig);

  // 5. Quarter Score Comparison (Q1)
  bets.push({
    type: 'COMPARISON',
    participant_1: {
      subject_type: 'TEAM',
      subject_id: TORONTO_RAPTORS_ID,
      subject_name: 'Toronto Raptors',
      metric: 'points',
      time_period: 'Q1'
    },
    participant_2: {
      subject_type: 'TEAM',
      subject_id: CLEVELAND_CAVALIERS_ID,
      subject_name: 'Cleveland Cavaliers',
      metric: 'points',
      time_period: 'Q1'
    },
    operator: 'GREATER_THAN'
  } as ComparisonConfig);

  // ===== THRESHOLD BETS =====

  // 6. Player Points Over/Under
  bets.push({
    type: 'THRESHOLD',
    participant: {
      subject_type: 'PLAYER',
      subject_id: BRANDON_INGRAM_ID,
      subject_name: 'Brandon Ingram',
      metric: 'points',
      time_period: 'FULL_GAME'
    },
    operator: 'OVER',
    threshold: 10.5
  } as ThresholdConfig);

  // 7. Player Points Under
  bets.push({
    type: 'THRESHOLD',
    participant: {
      subject_type: 'PLAYER',
      subject_id: BRANDON_INGRAM_ID,
      subject_name: 'Brandon Ingram',
      metric: 'points',
      time_period: 'FULL_GAME'
    },
    operator: 'UNDER',
    threshold: 15.5
  } as ThresholdConfig);

  // 8. Team Total Points Over
  bets.push({
    type: 'THRESHOLD',
    participant: {
      subject_type: 'TEAM',
      subject_id: TORONTO_RAPTORS_ID,
      subject_name: 'Toronto Raptors',
      metric: 'points',
      time_period: 'FULL_GAME'
    },
    operator: 'OVER',
    threshold: 120.5
  } as ThresholdConfig);

  // 9. Player Rebounds Over
  bets.push({
    type: 'THRESHOLD',
    participant: {
      subject_type: 'PLAYER',
      subject_id: RJ_BARRETT_ID,
      subject_name: 'RJ Barrett',
      metric: 'rebounds',
      time_period: 'FULL_GAME'
    },
    operator: 'OVER',
    threshold: 8.5
  } as ThresholdConfig);

  // 10. Player Assists Over
  bets.push({
    type: 'THRESHOLD',
    participant: {
      subject_type: 'PLAYER',
      subject_id: DEANDRE_HUNTER_ID,
      subject_name: "De'Andre Hunter",
      metric: 'assists',
      time_period: 'FULL_GAME'
    },
    operator: 'OVER',
    threshold: 5.5
  } as ThresholdConfig);

  // 11. Team Rebounds Under
  bets.push({
    type: 'THRESHOLD',
    participant: {
      subject_type: 'TEAM',
      subject_id: CLEVELAND_CAVALIERS_ID,
      subject_name: 'Cleveland Cavaliers',
      metric: 'rebounds',
      time_period: 'FULL_GAME'
    },
    operator: 'UNDER',
    threshold: 40.5
  } as ThresholdConfig);

  // 12. Player Points in Q1 (Period-specific)
  bets.push({
    type: 'THRESHOLD',
    participant: {
      subject_type: 'PLAYER',
      subject_id: BRANDON_INGRAM_ID,
      subject_name: 'Brandon Ingram',
      metric: 'points',
      time_period: 'Q1'
    },
    operator: 'OVER',
    threshold: 2.5
  } as ThresholdConfig);

  // 13. Player Rebounds in Q1
  bets.push({
    type: 'THRESHOLD',
    participant: {
      subject_type: 'PLAYER',
      subject_id: JARRETT_ALLEN_ID,
      subject_name: 'Jarrett Allen',
      metric: 'rebounds',
      time_period: 'Q1'
    },
    operator: 'OVER',
    threshold: 1.5
  } as ThresholdConfig);

  // ===== EVENT BETS =====

  // 14. Double-Double
  bets.push({
    type: 'EVENT',
    participant: {
      subject_type: 'PLAYER',
      subject_id: RJ_BARRETT_ID,
      subject_name: 'RJ Barrett',
      metric: 'points', // Not used for event, but required
      time_period: 'FULL_GAME'
    },
    event_type: 'DOUBLE_DOUBLE',
    time_period: 'FULL_GAME'
  } as EventConfig);

  // 15. Triple-Double
  bets.push({
    type: 'EVENT',
    participant: {
      subject_type: 'PLAYER',
      subject_id: BRANDON_INGRAM_ID,
      subject_name: 'Brandon Ingram',
      metric: 'points',
      time_period: 'FULL_GAME'
    },
    event_type: 'TRIPLE_DOUBLE',
    time_period: 'FULL_GAME'
  } as EventConfig);

  // 16. Triple-Double (should fail)
  bets.push({
    type: 'EVENT',
    participant: {
      subject_type: 'PLAYER',
      subject_id: JARRETT_ALLEN_ID,
      subject_name: 'Jarrett Allen',
      metric: 'points',
      time_period: 'FULL_GAME'
    },
    event_type: 'TRIPLE_DOUBLE',
    time_period: 'FULL_GAME'
  } as EventConfig);

  return bets;
}

/**
 * Format bet config for display
 */
function formatBetConfig(bet: BetConfig): string {
  if (bet.type === 'COMPARISON') {
    const comp = bet as ComparisonConfig;
    let desc = `${comp.participant_1.subject_name} (${comp.participant_1.metric}) vs ${comp.participant_2.subject_name} (${comp.participant_2.metric})`;
    if (comp.spread) {
      desc += ` [Spread: ${comp.spread.direction}${comp.spread.value}]`;
    }
    return desc;
  } else if (bet.type === 'THRESHOLD') {
    const thresh = bet as ThresholdConfig;
    return `${thresh.participant.subject_name} ${thresh.operator} ${thresh.threshold} ${thresh.participant.metric} (${thresh.participant.time_period})`;
  } else if (bet.type === 'EVENT') {
    const event = bet as EventConfig;
    return `${event.participant.subject_name} - ${event.event_type} (${event.time_period})`;
  }
  return 'Unknown bet type';
}

/**
 * Main test function
 */
function runTests() {
  console.log('='.repeat(80));
  console.log('BET RESOLUTION TEST SCRIPT');
  console.log('='.repeat(80));
  console.log();

  const bets = createSampleBets();
  console.log(`Created ${bets.length} sample bets\n`);

  let resolvedCount = 0;
  let unresolvedCount = 0;
  const outcomes: Record<string, number> = {
    win: 0,
    loss: 0,
    push: 0,
    void: 0
  };

  bets.forEach((bet, index) => {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`Bet #${index + 1}: ${bet.type}`);
    console.log(`Description: ${formatBetConfig(bet)}`);
    console.log(`${'─'.repeat(80)}`);

    const result = resolveBet(bet, gameData, BASKETBALL_STAT_PATHS, getBasketballPeriodNumbers);

    if (result.resolved) {
      resolvedCount++;
      outcomes[result.outcome!] = (outcomes[result.outcome!] || 0) + 1;

      console.log(`✅ RESOLVED`);
      console.log(`   Outcome: ${result.outcome?.toUpperCase()}`);
      console.log(`   Resolution Quarter: ${result.resolutionQuarter || 'N/A'}`);
      
      if (result.resolutionStatSnapshot) {
        console.log(`   Stats Used:`);
        console.log(JSON.stringify(result.resolutionStatSnapshot, null, 6));
      }
    } else {
      unresolvedCount++;
      console.log(`❌ NOT RESOLVED`);
      console.log(`   Reason: ${result.reason}`);
    }
  });

  // Summary
  console.log(`\n${'='.repeat(80)}`);
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total Bets: ${bets.length}`);
  console.log(`Resolved: ${resolvedCount}`);
  console.log(`Unresolved: ${unresolvedCount}`);
  console.log();
  console.log('Outcomes:');
  console.log(`  WIN:  ${outcomes.win}`);
  console.log(`  LOSS: ${outcomes.loss}`);
  console.log(`  PUSH: ${outcomes.push}`);
  console.log(`  VOID: ${outcomes.void}`);
  console.log('='.repeat(80));
}

// Run the tests
if (require.main === module) {
  try {
    runTests();
  } catch (error) {
    console.error('Error running tests:', error);
    process.exit(1);
  }
}

export { runTests, createSampleBets };

