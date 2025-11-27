# Streak Management Strategy

## Overview

This document outlines the strategy for implementing streak management in Parlay Streak. The core challenge is that bets resolve asynchronously (when data becomes available), not in chronological order of when events actually occurred. This requires a sophisticated system that processes streak changes based on **event time** rather than **resolution time**.

## Problem Statement

### The Core Challenge

Bets resolve when data becomes available from the sports API, not when events actually happen. This creates a temporal ordering problem:

**Example Scenario:**
- **Bet A** (Q1 bet): Event happened at 2:00 PM, but resolves at 3:00 PM
- **Bet B** (Q2 bet): Event happened at 1:00 PM, but resolves at 4:00 PM

If we process streaks in resolution order, we'd process Bet A first (3:00 PM), then Bet B (4:00 PM), even though Bet B's event happened first (1:00 PM). This would incorrectly calculate the user's streak.

### Current System State

- ✅ Bet resolution system exists and stores `resolutionEventTime` and `resolutionUTCTime` in `bet.metadata.resolution`
- ✅ `StreakHistory` table exists for audit trail
- ✅ User table has `currentStreak` and `longestStreak` fields
- ✅ Insurance system exists and affects streaks
- ❌ No streak management service exists
- ❌ `StreakHistory` table lacks `eventTime` field (only has `createdAt`)
- ❌ No mechanism to process streaks in chronological order

## Key Concepts

### Historical Lookup Strategy

**Question:** How far back historically do we check streaks?

**Answer:** We only check back to the **most recent streak history entry** before the target event time. We do NOT recalculate all historical entries.

**How it works:**
1. When processing a new resolution, we need to know the streak value at that event's `eventTime`
2. We query for the single most recent `StreakHistory` entry with `eventTime < targetEventTime`
3. That entry's `newStreak` value is our baseline - no recalculation needed!
4. **Why this works:** Since we maintain chronological correctness by recalculating forward when out-of-order resolutions occur, the most recent entry before our target time is guaranteed to be correct

**Example:**
```
User has 1000 streak history entries over 6 months.

New parlay resolves with eventTime: 2025-01-15 3:00 PM

We query: "Find most recent entry before 2025-01-15 3:00 PM"
Result: Entry from 2025-01-15 2:30 PM with newStreak = 42

We use 42 as our baseline - we don't recalculate all 1000 entries!
```

**Performance:** This is a single indexed query (O(log n)) - very fast even with millions of history entries.

**When we DO recalculate:** Only when we detect an out-of-order resolution (earlier event resolves after later event). In that case, we recalculate forward from the insertion point, not backward.

### Timestamps

1. **`resolutionEventTime`**: When the actual sporting event happened (e.g., when Q1 ended)
   - Stored in `bet.metadata.resolution.resolutionEventTime`
   - For parlays: Use `parlay.lastGameEndTime` (when the last game in the parlay ended)

2. **`resolutionUTCTime`**: When the bet was actually resolved by our system
   - Stored in `bet.metadata.resolution.resolutionUTCTime`
   - Used for logging/debugging, but NOT for streak ordering

3. **`eventTime`**: The canonical timestamp for streak processing
   - For single bets: `resolutionEventTime` from bet metadata
   - For parlays: `parlay.lastGameEndTime` (when the last game ended)

### Streak Change Types

1. **`parlay_win`**: Parlay won → Add `parlayValue - insuranceCost` to streak
2. **`parlay_loss`**: Parlay lost → Reset streak to 0 (unless insured)
3. **`insurance_deducted`**: Insurance purchased → Subtract `insuranceCost` from streak
4. **`insurance_refunded`**: Insurance removed/parlay deleted → Add `insuranceCost` back
5. **`correction`**: Outcome changed after verification → Recalculate from event time forward

## Strategy

### Phase 1: Database Schema Updates

#### 1.1 Add `eventTime` to `StreakHistory`

**Current Schema:**
```prisma
model StreakHistory {
  id           String   @id @default(uuid())
  userId       String   @map("user_id")
  parlayId     String?  @map("parlay_id")
  oldStreak    Int      @map("old_streak")
  newStreak    Int      @map("new_streak")
  changeAmount Int      @map("change_amount")
  changeType   String   @map("change_type") @db.VarChar(20)
  createdAt    DateTime @default(now()) @map("created_at")
  // ...
}
```

**Proposed Addition:**
```prisma
model StreakHistory {
  // ... existing fields ...
  eventTime    DateTime @map("event_time") // When the event actually happened
  // ...
  
  @@index([userId, eventTime(sort: Asc)]) // For chronological queries
}
```

**Migration Strategy:**
- Add `eventTime` column (nullable initially)
- Backfill existing records: Use `createdAt` as fallback (not perfect, but best we can do)
- Make `eventTime` required for new records

#### 1.2 Add `correctionId` to `StreakHistory` (Optional)

For tracking corrections:
```prisma
correctionId  String?  @map("correction_id") // Links to original entry if this is a correction
```

### Phase 2: Core Streak Management Service

#### 2.1 Service Structure

Create `backend/src/services/streakManagement.service.ts` with the following functions:

```typescript
/**
 * Main entry point: Process a parlay resolution and update streaks
 * This is called when a parlay's status changes to 'won' or 'lost'
 */
export async function processParlayResolution(
  prisma: PrismaClient,
  parlayId: string,
  outcome: 'won' | 'lost'
): Promise<void>

/**
 * Process a single bet resolution (for single bets, not in parlays)
 * Single bets affect streaks: win = +1, loss = reset to 0, push = no change
 */
export async function processSingleBetResolution(
  prisma: PrismaClient,
  betId: string,
  userId: string,
  outcome: 'win' | 'loss' | 'push'
): Promise<void>

/**
 * Recalculate streaks for a user from a specific event time forward
 * Used for corrections and out-of-order resolutions
 */
export async function recalculateStreaksFromEventTime(
  prisma: PrismaClient,
  userId: string,
  fromEventTime: Date
): Promise<void>

/**
 * Get the current streak value for a user at a specific point in time
 * (before processing a new event)
 * 
 * This is an efficient lookup - we only check the most recent streak history
 * entry before the target eventTime. We don't need to recalculate backwards
 * because we maintain chronological correctness by recalculating forward when
 * out-of-order resolutions occur.
 */
export async function getStreakAtEventTime(
  prisma: PrismaClient,
  userId: string,
  eventTime: Date
): Promise<number>

/**
 * Apply a streak change and create history entry
 */
async function applyStreakChange(
  prisma: PrismaClient,
  userId: string,
  parlayId: string | null,
  eventTime: Date,
  changeType: StreakChangeType,
  changeAmount: number,
  oldStreak: number,
  newStreak: number
): Promise<void>

/**
 * Update longest streak if needed
 */
async function updateLongestStreak(
  prisma: PrismaClient,
  userId: string,
  newStreak: number
): Promise<void>
```

#### 2.2 Processing Flow: `processParlayResolution`

**When a parlay resolves (immediately on first loss, or when all bets win):**

1. **Get parlay and user data**
   ```typescript
   const parlay = await prisma.parlay.findUnique({
     where: { id: parlayId },
     include: { user: true }
   });
   ```

2. **Determine event time**
   - For parlays: Use `parlay.lastGameEndTime` (when the last game in the parlay ended)
   - Fallback to `parlay.resolvedAt` if `lastGameEndTime` is not set
   ```typescript
   const eventTime = parlay.lastGameEndTime || parlay.resolvedAt || new Date();
   ```

3. **Get current streak at event time (EFFICIENT LOOKUP)**
   - **Key insight:** We only need to find the most recent streak change that happened BEFORE this event
   - **No backward recalculation needed!** We just query for the single most recent entry:
   ```typescript
   const mostRecentEntry = await prisma.streakHistory.findFirst({
     where: {
       userId: parlay.userId,
       eventTime: { lt: eventTime }
     },
     orderBy: { eventTime: 'desc' },
     select: { newStreak: true }
   });
   const currentStreakAtEventTime = mostRecentEntry?.newStreak ?? parlay.user.currentStreak ?? 0;
   ```
   - **Why this works:** Since we maintain chronological correctness by recalculating forward when out-of-order resolutions occur, the most recent entry before our target time is guaranteed to be correct
   - **Performance:** This is a single indexed query - very fast even with millions of history entries

4. **Calculate new streak**
   ```typescript
   let newStreak: number;
   if (outcome === 'won') {
     const netGain = parlay.parlayValue - parlay.insuranceCost;
     newStreak = currentStreakAtEventTime + netGain;
   } else { // lost
     if (parlay.insured) {
       // Streak survives (insurance already deducted when purchased)
       newStreak = currentStreakAtEventTime;
     } else {
       // Streak resets to 0
       newStreak = 0;
     }
   }
   ```

5. **Check if this resolution is out of order**
   - Query for any `StreakHistory` entries with `eventTime > eventTime` for this user
   - If found, we need to recalculate (see Phase 3)

6. **Apply streak change**
   - Create `StreakHistory` entry with `eventTime`
   - Update user's `currentStreak`
   - Update `longestStreak` if needed

7. **Handle insurance locking/unlocking** (if applicable)

#### 2.3 Out-of-Order Resolution Handling

**Problem:** A parlay with an earlier `eventTime` resolves after a parlay with a later `eventTime`.

**Solution:** When we detect out-of-order resolution:

1. **Insert the new history entry** with the correct `eventTime`
2. **Recalculate all subsequent entries** (those with `eventTime > newEventTime`)
3. **Update user's current streak** to the final calculated value

**Example:**
```
Initial state: streak = 10

3:00 PM - Parlay B resolves (eventTime: 2:00 PM) → streak: 10 → 12
4:00 PM - Parlay A resolves (eventTime: 1:00 PM) → OUT OF ORDER!

Process:
1. Insert Parlay A entry at 1:00 PM: streak: 10 → 8 (loss)
2. Recalculate Parlay B entry: streak: 8 → 10 (win)
3. Update current streak: 10
```

### Phase 3: Recalculation Service

#### 3.1 `recalculateStreaksFromEventTime`

**Purpose:** Recalculate all streak changes from a specific event time forward. Used when:
- An out-of-order resolution is detected (earlier event resolves after later event)
- A correction is made (bet outcome changes after verification)

**Process:**

1. **Get baseline streak (EFFICIENT - single query)**
   ```typescript
   // This only looks back to find the most recent entry before fromEventTime
   // No full recalculation needed!
   const baselineStreak = await getStreakAtEventTime(prisma, userId, fromEventTime);
   ```

2. **Get all history entries after event time**
   ```typescript
   const entries = await prisma.streakHistory.findMany({
     where: {
       userId,
       eventTime: { gte: fromEventTime }
     },
     orderBy: { eventTime: 'asc' },
     include: { parlay: true }
   });
   ```

3. **Recalculate each entry in chronological order**
   ```typescript
   let currentStreak = baselineStreak;
   for (const entry of entries) {
     const oldStreak = currentStreak;
     // Recalculate based on entry's parlay and changeType
     currentStreak = calculateNewStreak(oldStreak, entry);
     
     // Update entry if values changed
     if (oldStreak !== entry.oldStreak || currentStreak !== entry.newStreak) {
       await prisma.streakHistory.update({
         where: { id: entry.id },
         data: {
           oldStreak,
           newStreak: currentStreak,
           changeAmount: currentStreak - oldStreak
         }
       });
     }
   }
   ```

4. **Update user's current streak**
   ```typescript
   await prisma.user.update({
     where: { id: userId },
     data: { currentStreak: currentStreak }
   });
   ```

### Phase 4: Integration Points

#### 4.1 Bet Resolution Flow

**Location:** `backend/src/routes/admin.routes.ts` (bet resolution endpoint)

**Current Flow:**
1. Resolve bet
2. Update `UserBetSelection` outcomes
3. Check if parlay is complete
4. If complete, update parlay status

**New Flow:**
1. Resolve bet
2. Update `UserBetSelection` outcomes
3. **Check if this is a single bet (not in a parlay)**
   - If single bet: **Call `processSingleBetResolution(prisma, betId, userId, outcome)`**
4. **Check if parlay is complete**
   - If parlay has any loss: Immediately mark as 'lost' and **Call `processParlayResolution(prisma, parlayId, 'lost')`**
   - If all bets resolved and all wins: Mark as 'won' and **Call `processParlayResolution(prisma, parlayId, 'won')`**

#### 4.2 Insurance Purchase/Removal

**Location:** `backend/src/routes/parlay.routes.ts`

**When insurance is purchased:**
- Deduct `insuranceCost` from streak immediately
- Create `StreakHistory` entry with `changeType: 'insurance_deducted'`
- Use `parlay.lockedAt` as `eventTime` (when insurance was purchased)

**When insurance is removed:**
- Add `insuranceCost` back to streak
- Create `StreakHistory` entry with `changeType: 'insurance_refunded'`
- Use current time as `eventTime`

#### 4.3 Correction Flow (30-Minute Verification)

**Location:** Future verification service

**When a bet outcome changes:**
1. Identify the parlay(s) affected
2. For each affected parlay:
   - Get the `eventTime` from the original resolution
   - Call `recalculateStreaksFromEventTime(prisma, userId, eventTime)`
3. Create correction entry in `StreakHistory` (if using `correctionId`)

### Phase 5: Edge Cases & Considerations

#### 5.1 Missing `lastGameEndTime`

**Problem:** A parlay might not have `lastGameEndTime` set.

**Solution:**
- Fallback to `parlay.resolvedAt` (not ideal, but better than nothing)
- Log a warning for monitoring
- Consider: Should we calculate `lastGameEndTime` when parlay is locked?

#### 5.2 Missing `resolutionEventTime` in Bet Metadata

**Problem:** Older bets might not have `resolutionEventTime` stored.

**Solution:**
- Fallback to `bet.resolvedAt`
- Log a warning
- Consider backfilling from game data if possible

#### 5.3 Concurrent Resolutions

**Problem:** Two parlays might resolve simultaneously with the same `eventTime`.

**Solution:**
- Use database transactions to ensure atomicity
- If same `eventTime`, process in `parlayId` order (deterministic)
- Consider adding microsecond precision or sequence number

#### 5.4 Insurance Locking/Unlocking

**Current Logic (from docs):**
- When insured parlay loses: Lock insurance
- When uninsured parlay loses: Check if it resolves after locked insured parlay, unlock if so

**Integration:**
- This logic should be part of `processParlayResolution`
- Need to check `eventTime` ordering, not `resolvedAt` ordering

#### 5.5 Single Bets

**Answer:** Yes, single bets affect streaks:
- **Win:** +1 to streak
- **Loss:** Reset streak to 0

**Implementation:**
- Single bets need `eventTime` from `bet.metadata.resolution.resolutionEventTime`
- Process them similarly to parlays using `processSingleBetResolution()`
- Create `StreakHistory` entry with `parlayId: null` and appropriate `changeType`

### Phase 6: Performance Considerations

#### 6.1 Query Optimization

**Critical Query:** Getting streak at a specific event time

**Key Insight:** We don't need to recalculate backwards! We only need to find the most recent streak change that happened before our target event time. Since we maintain chronological correctness by recalculating forward when out-of-order resolutions occur, the most recent entry before our target time is guaranteed to be correct.

```typescript
// Efficient single-query lookup: "What was the streak before this eventTime?"
const mostRecentEntry = await prisma.streakHistory.findFirst({
  where: {
    userId,
    eventTime: { lt: targetEventTime }
  },
  orderBy: { eventTime: 'desc' },
  select: { newStreak: true }
});

// If no history exists, use user's current streak (or 0 for new users)
const baselineStreak = mostRecentEntry?.newStreak ?? 
  (await prisma.user.findUnique({ 
    where: { id: userId }, 
    select: { currentStreak: true } 
  }))?.currentStreak ?? 0;
```

**Index Required:**
```prisma
@@index([userId, eventTime(sort: Asc)])
```

**Performance:** This is a single indexed query - O(log n) complexity, very fast even with millions of history entries.

#### 6.2 Recalculation Performance

**Problem:** Recalculating from an early event time could process many entries.

**Mitigation:**
- Batch updates in transactions
- Consider pagination for very large recalculation sets
- Monitor and alert on slow recalculations

#### 6.3 Caching

**Consideration:** Could we cache "streak at event time" values?

**Challenge:** Any recalculation invalidates the cache.

**Recommendation:** Start without caching, add if performance becomes an issue.

## Implementation Plan

### Step 1: Schema Migration
- [ ] Add `eventTime` to `StreakHistory` table
- [ ] Add index on `[userId, eventTime]`
- [ ] Backfill existing records (use `createdAt` as fallback)
- [ ] Make `eventTime` required for new records

### Step 2: Core Service Functions
- [ ] Implement `getStreakAtEventTime`
- [ ] Implement `applyStreakChange`
- [ ] Implement `updateLongestStreak`
- [ ] Implement `processParlayResolution`
- [ ] Implement `recalculateStreaksFromEventTime`

### Step 3: Integration
- [ ] Integrate into bet resolution flow
- [ ] Integrate into insurance purchase/removal
- [ ] Add logging and error handling
- [ ] Add unit tests

### Step 4: Testing
- [ ] Test in-order resolutions
- [ ] Test out-of-order resolutions
- [ ] Test recalculation scenarios
- [ ] Test insurance scenarios
- [ ] Test edge cases (missing timestamps, concurrent resolutions)

### Step 5: Monitoring & Observability
- [ ] Add metrics for streak updates
- [ ] Add alerts for out-of-order resolutions
- [ ] Add logging for recalculation events
- [ ] Monitor performance of streak queries

## Open Questions - RESOLVED

1. **Single Bets:** ✅ **Yes** - Single bets affect streaks: win = +1, loss = reset to 0

2. **Partial Parlay Resolution:** ✅ **Immediately on first loss** - The moment a parlay loses (first bet loss), that is the resolution time and the streak should be updated based on the parlay's `eventTime`

3. **Streak History Retention:** ✅ **Infinite** - User streak history should be kept indefinitely. We will never remove user bet selections or streak history records.

4. **Correction Tracking:** ⚠️ **TBD** - Need to determine if `correctionId` field is needed or if `changeType: 'correction'` is sufficient. This can be decided during implementation.

5. **Event Time Precision:** ✅ **Use API precision** - Use whatever precision is provided by the API. We should not be concerned with precision at all - just store what we receive.

6. **Backfilling Strategy:** ✅ **Parlays always have eventTime** - Parlays will always have an `eventTime` based on when they resolved (via `parlay.lastGameEndTime` or `parlay.resolvedAt`). No backfilling needed for new implementations.

## Success Criteria

1. ✅ Streaks are calculated correctly regardless of resolution order
2. ✅ Streak history accurately reflects chronological event order
3. ✅ Recalculation works correctly for corrections
4. ✅ Insurance locking/unlocking works with event time ordering
5. ✅ Performance is acceptable (< 100ms for typical streak update)
6. ✅ System handles edge cases gracefully

## Future Enhancements

1. **Streak Snapshots:** Periodically snapshot streak values for faster historical queries
2. **Streak Analytics:** Track streak patterns, longest streaks by time period, etc.
3. **Streak Challenges:** Time-limited streak competitions
4. **Streak Milestones:** Notifications/achievements for streak milestones

---

**Document Status:** Draft - Pending Review

**Last Updated:** 2025-01-XX

**Author:** AI Assistant (pending human review)

