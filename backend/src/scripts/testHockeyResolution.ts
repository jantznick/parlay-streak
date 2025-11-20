/**
 * Test script for hockey bet resolution
 * 
 * Creates sample bet configs and tests them against the sample hockey game data
 */

import * as fs from 'fs';
import * as path from 'path';
import { resolveBet } from '../services/betResolution.service';
import { BetConfig, ComparisonConfig, ThresholdConfig } from '../../shared/types/bets';
import { HOCKEY_STAT_PATHS, getPeriodNumbers as getHockeyPeriodNumbers } from '../../shared/config/sports/hockey-data-paths';

// Load the sample game data
const sampleGamePath = path.resolve(__dirname, '../../../sample-hockey-end.json');
if (!fs.existsSync(sampleGamePath)) {
  throw new Error(`Sample game file not found at: ${sampleGamePath}`);
}
const gameData = JSON.parse(fs.readFileSync(sampleGamePath, 'utf-8'));

// Team IDs from the sample data
const EDMONTON_OILERS_ID = '6';
const WASHINGTON_CAPITALS_ID = '23';

// Player IDs from the sample data (need to verify these from the actual data)
// From the sample: Leon Draisaitl, Tom Wilson, John Carlson, etc.
const LEON_DRAISAITL_ID = '3114727';  // 1 goal, 0 assists, -3 plus/minus
const TOM_WILSON_ID = '2970615';      // 2 goals (from leaders section)
const JOHN_CARLSON_ID = '5118';       // 3 assists (from leaders section)
const ALIAKSEI_PROTAS_ID = '4587943'; // Scored a goal in P1
const STUART_SKINNER_ID = '4268767';  // Goalie: 5 goals against, 15 saves

/**
 * Create sample hockey bet configs
 */
function createSampleHockeyBets(): BetConfig[] {
  const bets: BetConfig[] = [];

  // ===== COMPARISON BETS =====

  // 1. Moneyline - Washington vs Edmonton (Full Game)
  bets.push({
    type: 'COMPARISON',
    participant_1: {
      subject_type: 'TEAM',
      subject_id: WASHINGTON_CAPITALS_ID,
      subject_name: 'Washington Capitals',
      metric: 'goals',
      time_period: 'FULL_GAME'
    },
    participant_2: {
      subject_type: 'TEAM',
      subject_id: EDMONTON_OILERS_ID,
      subject_name: 'Edmonton Oilers',
      metric: 'goals',
      time_period: 'FULL_GAME'
    },
    operator: 'GREATER_THAN'
  } as ComparisonConfig);

  // 2. Player Goals Comparison
  bets.push({
    type: 'COMPARISON',
    participant_1: {
      subject_type: 'PLAYER',
      subject_id: TOM_WILSON_ID,
      subject_name: 'Tom Wilson',
      metric: 'goals',
      time_period: 'FULL_GAME'
    },
    participant_2: {
      subject_type: 'PLAYER',
      subject_id: LEON_DRAISAITL_ID,
      subject_name: 'Leon Draisaitl',
      metric: 'goals',
      time_period: 'FULL_GAME'
    },
    operator: 'GREATER_THAN'
  } as ComparisonConfig);

  // 3. Team Shots Comparison
  bets.push({
    type: 'COMPARISON',
    participant_1: {
      subject_type: 'TEAM',
      subject_id: EDMONTON_OILERS_ID,
      subject_name: 'Edmonton Oilers',
      metric: 'shots',
      time_period: 'FULL_GAME'
    },
    participant_2: {
      subject_type: 'TEAM',
      subject_id: WASHINGTON_CAPITALS_ID,
      subject_name: 'Washington Capitals',
      metric: 'shots',
      time_period: 'FULL_GAME'
    },
    operator: 'GREATER_THAN'
  } as ComparisonConfig);

  // ===== THRESHOLD BETS =====

  // 4. Player Goals Over
  bets.push({
    type: 'THRESHOLD',
    participant: {
      subject_type: 'PLAYER',
      subject_id: TOM_WILSON_ID,
      subject_name: 'Tom Wilson',
      metric: 'goals',
      time_period: 'FULL_GAME'
    },
    operator: 'OVER',
    threshold: 1.5
  } as ThresholdConfig);

  // 5. Player Assists Over
  bets.push({
    type: 'THRESHOLD',
    participant: {
      subject_type: 'PLAYER',
      subject_id: JOHN_CARLSON_ID,
      subject_name: 'John Carlson',
      metric: 'assists',
      time_period: 'FULL_GAME'
    },
    operator: 'OVER',
    threshold: 2.5
  } as ThresholdConfig);

  // 6. Team Goals Against Over
  bets.push({
    type: 'THRESHOLD',
    participant: {
      subject_type: 'TEAM',
      subject_id: EDMONTON_OILERS_ID,
      subject_name: 'Edmonton Oilers',
      metric: 'goals_against',
      time_period: 'FULL_GAME'
    },
    operator: 'OVER',
    threshold: 6.5
  } as ThresholdConfig);

  // 7. Goalie Saves Over
  bets.push({
    type: 'THRESHOLD',
    participant: {
      subject_type: 'PLAYER',
      subject_id: STUART_SKINNER_ID,
      subject_name: 'Stuart Skinner',
      metric: 'saves',
      time_period: 'FULL_GAME'
    },
    operator: 'OVER',
    threshold: 14.5
  } as ThresholdConfig);

  // 8. Goalie Goals Against Under
  bets.push({
    type: 'THRESHOLD',
    participant: {
      subject_type: 'PLAYER',
      subject_id: STUART_SKINNER_ID,
      subject_name: 'Stuart Skinner',
      metric: 'goals_against',
      time_period: 'FULL_GAME'
    },
    operator: 'UNDER',
    threshold: 5.5
  } as ThresholdConfig);

  // 9. Player Plus/Minus Over
  bets.push({
    type: 'THRESHOLD',
    participant: {
      subject_type: 'PLAYER',
      subject_id: LEON_DRAISAITL_ID,
      subject_name: 'Leon Draisaitl',
      metric: 'plus_minus',
      time_period: 'FULL_GAME'
    },
    operator: 'OVER',
    threshold: -3.5
  } as ThresholdConfig);

  // 10. Team Hits Over
  bets.push({
    type: 'THRESHOLD',
    participant: {
      subject_type: 'TEAM',
      subject_id: EDMONTON_OILERS_ID,
      subject_name: 'Edmonton Oilers',
      metric: 'hits',
      time_period: 'FULL_GAME'
    },
    operator: 'OVER',
    threshold: 10.5
  } as ThresholdConfig);

  // 11. Period-specific: Player Goals in P1
  bets.push({
    type: 'THRESHOLD',
    participant: {
      subject_type: 'PLAYER',
      subject_id: ALIAKSEI_PROTAS_ID,
      subject_name: 'Aliaksei Protas',
      metric: 'goals',
      time_period: 'P1'
    },
    operator: 'OVER',
    threshold: 0.5
  } as ThresholdConfig);

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
    const event = bet as any;
    return `${event.participant.subject_name} - ${event.event_type} (${event.time_period})`;
  }
  return 'Unknown bet type';
}

/**
 * Main test function
 */
function runTests() {
  console.log('='.repeat(80));
  console.log('HOCKEY BET RESOLUTION TEST SCRIPT');
  console.log('='.repeat(80));
  console.log();

  const bets = createSampleHockeyBets();
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

    const result = resolveBet(bet, gameData, HOCKEY_STAT_PATHS, getHockeyPeriodNumbers);

    if (result.resolved) {
      resolvedCount++;
      outcomes[result.outcome!] = (outcomes[result.outcome!] || 0) + 1;

      console.log(`✅ RESOLVED`);
      console.log(`   Outcome: ${result.outcome?.toUpperCase()}`);
      console.log(`   Resolution Period: ${result.resolutionQuarter || 'N/A'}`);
      
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

export { runTests, createSampleHockeyBets };

