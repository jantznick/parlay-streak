# Bet Resolution System - Technical Design Document

## Overview

This document outlines the technical design for the automated bet resolution system. The system resolves bets in real-time as game events occur, handles corrections after a 30-minute freeze period, and maintains chronological accuracy for streak calculations.

**Key Principle:** Resolve bets as close to real-time as possible, store outcomes at the user selection level for efficiency, and maintain complete history for corrections.

---

## Core Architecture Decisions

### 1. Resolution Storage Strategy

**Decision:** Store resolution outcomes at the `UserBetSelection` level, not derived on-the-fly.

**Reasoning:**
- **Performance:** Bulk upsert operations are more efficient than deriving outcomes on every read
- **User Experience:** Users frequently check their bets (multiple times per game session)
- **Scalability:** As user base grows, deriving outcomes becomes expensive
- **Simplicity:** Clear data model - each user's bet has its own outcome

**Tradeoffs:**
- **Storage:** Slightly more database storage (outcome per user vs per bet)
- **Update Complexity:** Must update all user selections when bet resolves
- **Consistency:** Need to ensure all selections updated atomically

**Implementation:**
When a bet resolves, perform bulk upsert:
```typescript
// Pseudo-code
if (betOutcome === 'win') {
  // Update all users who picked the winning side
  await updateUserSelections({
    betId: bet.id,
    selectedSide: winningSide,
    outcome: 'win'
  });
  
  // Update all users who picked the losing side
  await updateUserSelections({
    betId: bet.id,
    selectedSide: losingSide,
    outcome: 'loss'
  });
}
```

### 2. Job Queue System

**Decision:** Use cron for discovery + BullMQ/Redis for job queue.

**Reasoning:**
- **Reliability:** Jobs persist in Redis, won't be lost if worker crashes
- **Scheduling:** Built-in support for delayed execution (resolve in 2 hours)
- **Retries:** Automatic retry logic with exponential backoff
- **Scalability:** Can run multiple workers for parallel processing
- **Monitoring:** Built-in job tracking and status

**Tradeoffs:**
- **Infrastructure:** Requires Redis service (Railway makes this easy)
- **Complexity:** More moving parts than simple cron
- **Learning Curve:** Team needs to understand queue system

**Alternative Considered:** Pure cron approach
- **Pros:** Simpler, no extra infrastructure
- **Cons:** Less reliable, harder to schedule, no built-in retries
- **Decision:** Start with queue system for production reliability

### 3. Chronological Resolution Order

**Decision:** Store `resolutionEventTime` (when event actually happened) separate from `resolvedAt` (when we processed it).

**Reasoning:**
- **Parlay Resolution:** Parlays must resolve in chronological order by actual event time
- **Corrections:** When stats are corrected, need to recalculate from actual event time
- **Accuracy:** API data might arrive out of order, but resolution order must be correct

**Example Scenario:**
```
8:15 PM - Q1 ends (Bet A event time)
8:16 PM - We process Bet A → WIN
8:45 PM - Q2 ends (Bet B event time)
8:46 PM - We process Bet B → WIN
9:16 PM - Bet A correction: Actually LOSS
         → Recalculate from 8:15 PM (actual event time)
         → Bet A was loss, so streak resets at 8:15 PM
         → Bet B happened after, so streak: 0 → 1
```

**Implementation:**
- Extract event time from API response (period end time, game end time)
- Store in `resolutionEventTime` field
- Use for chronological ordering, not `resolvedAt`

### 4. Immediate Parlay Failure

**Decision:** Fail parlays immediately when any bet loses, don't wait for all bets to resolve.

**Reasoning:**
- **User Experience:** Faster feedback when parlay is lost
- **Streak Logic:** Streak resets immediately on loss (per game rules)
- **Efficiency:** No need to wait for remaining bets
- **Data Integrity:** Remaining bets still resolve individually for data completeness

**Tradeoff:**
- **Consistency:** Parlay marked "lost" before all bets resolved
- **Mitigation:** Individual bets still resolve, parlay status is separate concern

### 5. Stat Snapshots

**Decision:** Store complete stat snapshots used for resolution.

**Reasoning:**
- **Debugging:** Can verify why bet resolved the way it did
- **Corrections:** Can compare old vs new stats when corrections happen
- **Audit Trail:** Complete record of resolution data
- **Support:** Helps resolve user disputes

**Storage:** JSON field `resolution_stat_snapshot` on Bet table

---

## System Components

### 1. Discovery Service (Cron Job)

**Purpose:** Find games that have started and schedule resolution jobs.

**Frequency:** Every minute

**Process:**
1. Query database for games that started in last X minutes (configurable, e.g., 10 minutes)
2. For each game, find all pending bets
3. For each bet, calculate when it should be resolved (based on period/game completion)
4. Schedule resolution job in BullMQ queue with appropriate delay

**Key Logic:**
- Only schedule jobs for bets that haven't been scheduled yet
- Use game start time + period-specific offsets to calculate resolution time
- Handle multiple periods per game (Q1, Q2, full game, etc.)

**Configuration:**
- Discovery window: How far back to look for started games
- Period offsets: When to start checking after period/game ends (stored in sport configs)

### 2. Resolution Worker (BullMQ Worker)

**Purpose:** Process resolution jobs, fetch game data, resolve bets.

**Concurrency:** 3 workers (can scale as needed)

**Process:**
1. Worker receives job: `{ betId, gameId }`
2. Fetch bet from database
3. Fetch game data from ESPN API using summary endpoint:
   - **Endpoint:** `site.api.espn.com/apis/site/v2/sports/{sport}/{league}/summary?event={gameId}`
   - **Sport/League:** Mapped from game metadata (see `ApiSportsService.getSupportedSports()`)
   - **Example:** `/apis/site/v2/sports/basketball/nba/summary?event=401585401`
   - **Note:** This endpoint provides boxscore, play-by-play, and statistics data needed for resolution
   - **Live Updates:** To be verified if this endpoint updates during live games
4. Call resolution function with bet + game data
5. Parse result:
   - If `resolved: true` → Update database
   - If `resolved: false` → Reschedule job for later (with backoff)

**Error Handling:**
- If API fails → Retry with exponential backoff (up to 5 attempts)
- If stat missing but event complete → Try once more, then flag for admin
- If event not complete → Reschedule with appropriate delay

### 3. Resolution Function (Pure Function)

**Purpose:** Core resolution logic - takes bet + game data, returns outcome.

**Key Principle:** Pure function, no database access, fully testable.

**Input:**
- `bet`: Bet object from database (includes config)
- `gameData`: Raw game data from ESPN API

**Output:**
```typescript
{
  resolved: boolean;              // Can we resolve this bet now?
  outcome?: 'win' | 'loss' | 'push' | 'void';
  resolutionEventTime?: Date;     // When event actually happened (from API)
  resolutionUTCTime?: Date;       // UTC time of resolution event completion
  resolutionQuarter?: string;     // Which quarter/period
  resolutionStatSnapshot?: object; // Stats used for resolution
  reason?: string;                // Why not resolved (if resolved: false)
}
```

**Process:**
1. Check if period/game is complete (using API keys you'll provide)
2. If not complete → Return `{ resolved: false, reason: 'Period not complete' }`
3. If complete → Extract stat value using data path from bet config
4. Calculate outcome based on bet type and extracted stat
5. Return complete resolution data

**Bet Type Resolution Logic:**

**COMPARISON (Moneyline, Spread):**
- Extract stat for participant_1 and participant_2
- Apply spread if exists
- Compare values
- Determine winner

**THRESHOLD (Over/Under):**
- Extract stat for participant
- Compare to threshold
- Determine if over/under hit

**EVENT (Binary events):**
- Check if event occurred in stats
- Return win/loss

### 4. Database Update Service

**Purpose:** Update database after resolution.

**Process:**
1. Update Bet table:
   - `outcome`: Bet-level outcome (for reference)
   - `resolutionEventTime`: When event happened
   - `resolutionUTCTime`: UTC time of resolution
   - `resolutionQuarter`: Which period
   - `resolutionStatSnapshot`: Stats used
   - `resolvedAt`: When we processed it
   - `lastPolledAt`: Last time we checked

2. Bulk update UserBetSelection table:
   - Determine winning/losing sides based on bet outcome
   - Update all selections with matching `betId` and `selectedSide`
   - Set `outcome` and `status: 'resolved'`

3. Check parlays:
   - For each updated selection, check if it's in a parlay
   - If parlay has any loss → Immediately fail parlay
   - If all bets resolved and all wins → Resolve parlay as win

4. Update streaks:
   - For single bets: Update user streak immediately
   - For parlays: Update when parlay resolves
   - Record in StreakHistory with `eventTime`

### 5. Verification Service (30-Minute Freeze)

**Purpose:** Verify stats haven't changed after 30-minute freeze period.

**Process:**
1. After bet resolves, schedule verification job (30 minutes later)
2. When job runs:
   - Re-fetch game stats from API
   - Re-resolve bet with new stats
   - Compare outcomes:
     - If same → Mark as finalized (no further changes)
     - If different → Flag for admin review, trigger correction flow

**Correction Flow:**
1. Detect outcome change
2. Recalculate streak from `resolutionEventTime` forward
3. Update all affected streak history entries
4. Update user's current streak
5. Mark original resolution as corrected
6. Create correction entry in history

### 6. Streak Recalculation Service

**Purpose:** Recalculate streaks when corrections happen.

**Process:**
1. Find all streak history entries after correction event time
2. Order chronologically by `eventTime`
3. Recalculate each entry:
   - Start from streak before correction point
   - Apply each change in chronological order
   - Update history entries with new values
4. Update user's current streak

**Key Logic:**
- Use `eventTime` for ordering, not `processedAt`
- Handle both single bets and parlays
- Update all subsequent history entries
- Maintain audit trail with correction markers

---

## Database Schema Changes

### Bet Table Additions

```prisma
model Bet {
  // ... existing fields
  
  // Resolution tracking
  resolutionEventTime      DateTime? @map("resolution_event_time")
  resolutionUTCTime        DateTime? @map("resolution_utc_time")
  resolutionQuarter        String?   @map("resolution_quarter") @db.VarChar(20)
  resolutionStatSnapshot   Json?     @map("resolution_stat_snapshot") @db.JsonB
  lastPolledAt             DateTime? @map("last_polled_at")
  
  // Existing fields (keep)
  outcome                  String    @default("pending") @db.VarChar(20)
  resolvedAt               DateTime? @map("resolved_at")
}
```

### UserBetSelection Table Additions

```prisma
model UserBetSelection {
  // ... existing fields
  
  // Resolution tracking
  outcome                  String?   @db.VarChar(20) // 'win' | 'loss' | 'push' | 'void'
  resolvedAt               DateTime? @map("resolved_at")
  
  // Existing fields (keep)
  status                   String    @default("selected") @db.VarChar(20)
}
```

### StreakHistory Table Additions

```prisma
model StreakHistory {
  // ... existing fields
  
  // Correction tracking
  eventTime                DateTime  @map("event_time") // When event actually happened
  processedAt              DateTime  @map("processed_at") // When we processed it
  correctedAt              DateTime? @map("corrected_at")
  isCorrection             Boolean   @default(false) @map("is_correction")
  originalHistoryId        String?   @map("original_history_id")
  
  // Existing fields (keep)
  changeType               String    @map("change_type") @db.VarChar(20)
}
```

---

## Configuration System

### Sport Config Structure

Resolution timing and data paths stored in sport config files:

```typescript
interface ResolutionTimingConfig {
  period: TimePeriod;
  offset_minutes: number;           // When to start checking after period ends
  initial_poll_interval_seconds: number;
  max_poll_interval_seconds: number;
  freeze_time_minutes: number;      // 30 minutes after game ends
}

interface DataPathConfig {
  metric: string;
  api_path_team?: string;           // e.g., "statistics.team.{team_id}.points.{period}"
  api_path_player?: string;         // e.g., "statistics.players.{player_id}.points.{period}"
  period_completion_key?: string;   // API key that indicates period is complete
  game_completion_key?: string;     // API key that indicates game is complete
}
```

**Storage:** In sport config files (e.g., `shared/config/sports/basketball.ts`)

**Future:** Can migrate to database if needed for runtime updates

---

## Workflow Examples

### Example 1: Single Bet Resolution

**Scenario:** User has single bet "Lakers ML" on game starting at 7 PM

**Timeline:**
```
7:00 PM - Game starts
         → Discovery finds game
         → Schedules resolution job (2 hours delay = 9:00 PM)

9:00 PM - Resolution job runs
         → Worker fetches bet + game data
         → Resolution function: Game complete, Lakers won
         → Returns: { resolved: true, outcome: 'win', ... }
         → Updates:
           - Bet.outcome = 'win'
           - UserBetSelection.outcome = 'win', status = 'resolved'
           - User streak: 20 → 21
           - StreakHistory entry created
         → Schedules verification job (9:30 PM)

9:30 PM - Verification job runs
         → Re-fetches stats, re-resolves
         → Outcome unchanged
         → Marks bet as finalized
```

### Example 2: Parlay with Early Failure

**Scenario:** User has 3-bet parlay, Bet A loses in Q1

**Timeline:**
```
7:00 PM - Game 1 starts (Bet A: Q1 bet)
         → Discovery schedules Bet A resolution (Q1 end + offset)

8:15 PM - Q1 ends, Bet A resolves → LOSS
         → Updates:
           - Bet A: outcome = 'loss'
           - UserBetSelection A: outcome = 'loss'
           - Parlay: status = 'lost' (immediate failure)
           - User streak: 20 → 0
           - StreakHistory entry created
         → Bet B and C still pending (will resolve later)

8:45 PM - Q2 ends, Bet B resolves → WIN
         → Updates:
           - Bet B: outcome = 'win'
           - UserBetSelection B: outcome = 'win'
           - Parlay already lost, no further action
```

### Example 3: Correction After 30 Minutes

**Scenario:** Bet resolves as win, but stat correction changes it to loss

**Timeline:**
```
8:15 PM - Q1 ends, Bet resolves → WIN
         → User streak: 20 → 21
         → StreakHistory: { eventTime: 8:15 PM, oldStreak: 20, newStreak: 21 }

8:45 PM - Q2 ends, Bet B resolves → WIN
         → User streak: 21 → 22
         → StreakHistory: { eventTime: 8:45 PM, oldStreak: 21, newStreak: 22 }

9:16 PM - Verification: Bet A actually LOSS (stat correction)
         → Detects outcome change
         → Recalculates from 8:15 PM (eventTime):
           - Before 8:15 PM: streak = 20
           - At 8:15 PM: Bet A loss → streak = 0
           - At 8:45 PM: Bet B win → streak = 1
         → Updates:
           - Bet A: outcome = 'loss' (corrected)
           - UserBetSelection A: outcome = 'loss'
           - StreakHistory entries updated
           - User streak: 22 → 1
         → Flags for admin review
```

---

## Error Handling & Edge Cases

### Missing Stats

**Scenario:** Period complete, but stat value not in API response

**Handling:**
1. First attempt: Retry immediately (stats might be updating)
2. If still missing: Flag for admin review
3. User sees: "Under manual review" status

**Reasoning:** Stats usually appear within seconds, but sometimes delayed. One retry balances speed vs accuracy.

### API Failures

**Scenario:** ESPN API down or timeout

**Handling:**
1. Retry with exponential backoff (5 attempts)
2. After max retries: Flag for admin review
3. Job remains in queue for manual retry

**Reasoning:** Temporary API issues are common, retries handle most cases.

### Period Completion Detection

**Scenario:** API key indicates period complete, but stats not final

**Handling:**
1. Check period completion key
2. If complete, attempt resolution
3. If stats missing, retry once
4. If still missing, flag for admin

**Reasoning:** Completion keys are reliable, but stats might lag slightly.

### Concurrent Resolution

**Scenario:** Multiple workers try to resolve same bet

**Handling:**
1. Use database transaction with row lock
2. Check if bet already resolved before updating
3. First worker wins, others skip

**Reasoning:** Prevents duplicate updates and race conditions.

### Parlay Resolution Race Condition

**Scenario:** Multiple bets in parlay resolve simultaneously

**Handling:**
1. Each bet resolution checks parlay status
2. Use database transaction for parlay update
3. First loss fails parlay, subsequent updates are no-ops

**Reasoning:** Immediate failure requirement means first loss wins.

---

## Performance Considerations

### Database Indexes

**Required indexes:**
- `bets(gameId, outcome)` - Find pending bets for game
- `bets(resolutionEventTime)` - Chronological ordering
- `user_bet_selections(betId, selectedSide, status)` - Bulk updates
- `user_bet_selections(parlayId, status)` - Parlay resolution checks
- `streak_history(userId, eventTime)` - Recalculation queries

### Bulk Operations

**UserBetSelection Updates:**
- Use bulk upsert for efficiency
- Update in batches if large number of selections
- Consider batch size limits (e.g., 1000 per batch)

### API Rate Limiting

**ESPN API:**
- Implement rate limiting in worker
- Use BullMQ limiter (max 10 requests/second)
- Cache game data when possible (short TTL)

### Worker Scaling

**Initial:** 3 workers
**Scaling:** Add workers as needed
**Monitoring:** Track job queue depth, processing time

---

## Monitoring & Observability

### Key Metrics

- **Resolution Latency:** Time from event to resolution
- **Resolution Success Rate:** % of bets resolved automatically
- **Correction Rate:** % of bets that change after verification
- **Queue Depth:** Number of pending jobs
- **Worker Utilization:** % of time workers are processing

### Alerts

- **Stuck Jobs:** Jobs in queue > 1 hour
- **High Failure Rate:** > 10% of jobs failing
- **API Errors:** ESPN API failures
- **Corrections:** Any bet outcome changes after verification

### Logging

- **Resolution Events:** Log every bet resolution with key data
- **Corrections:** Log all corrections with before/after
- **Errors:** Log all errors with context
- **Performance:** Log slow operations (> 1 second)

---

## Implementation Phases

### Phase 1: Core Resolution Function

**Goal:** Standalone, testable resolution function

**Deliverables:**
- Pure function: `resolveBetFromGameData(bet, gameData)`
- Stat extraction logic with data path support
- Outcome calculation for all bet types
- Period completion detection
- Unit tests with sample data

**Success Criteria:**
- Function returns correct outcomes for test cases
- Handles all bet types (COMPARISON, THRESHOLD, EVENT)
- Handles missing data gracefully

### Phase 2: API Endpoint

**Goal:** Manual trigger for testing

**Deliverables:**
- `POST /api/admin/bets/:betId/resolve` endpoint
- Fetches bet + game data
- Calls resolution function
- Updates database
- Returns resolution result

**Success Criteria:**
- Can manually trigger resolution for any bet
- Updates database correctly
- Returns useful response data

### Phase 3: Full Automation

**Goal:** Complete automated system

**Deliverables:**
- Discovery cron job
- BullMQ queue setup
- Resolution workers
- Database update service
- Verification service
- Streak recalculation service
- Monitoring and logging

**Success Criteria:**
- System automatically resolves bets as games complete
- Handles errors gracefully
- Maintains chronological accuracy
- Processes corrections correctly

---

## Open Questions & Future Enhancements

### Questions to Resolve

1. **Period Completion Keys:** Exact API keys and expected values (to be provided)
2. **Data Paths:** Exact JSON paths for stat extraction (to be provided)
3. **Resolution Timing:** Exact offset times per period (to be configured)

### Future Enhancements

1. **Live Game Tracking:** Show current period/score to users
2. **Smart Polling:** Adjust polling intervals based on game state
3. **Predictive Scheduling:** Schedule jobs more intelligently based on game patterns
4. **Batch Processing:** Process multiple bets from same game together
5. **Caching:** Cache game data to reduce API calls

---

## Summary

This system provides reliable, real-time bet resolution with:
- **Efficient storage** at user selection level
- **Chronological accuracy** via event time tracking
- **Correction handling** with streak recalculation
- **Scalable architecture** with queue system
- **Comprehensive monitoring** for reliability

The three-phase implementation approach allows for incremental development and testing, ensuring each component works correctly before moving to the next phase.

