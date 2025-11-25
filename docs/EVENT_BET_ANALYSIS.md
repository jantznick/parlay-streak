# Event Bet Analysis & Recommendations

## Current Event Types

```typescript
export type EventType = 
  | 'SCORES_TD'           // Football: Scores a touchdown
  | 'SCORES_FIRST'        // Scores first (any sport)
  | 'GAME_GOES_TO_OT'     // Game goes to overtime
  | 'SHUTOUT'             // Team gets shutout
  | 'DOUBLE_DOUBLE'       // Basketball: Player gets double double
  | 'TRIPLE_DOUBLE';      // Basketball: Player gets triple double
```

## Event Type Requirements

### 1. **Player-Only Events** (Basketball)
- **DOUBLE_DOUBLE**: Player achieves double digits in 2 categories
  - ✅ Subject: PLAYER only
  - ❌ Metric: Not needed (event defines: points + rebounds/assists/blocks/steals)
  - ✅ Time Period: Needed (could be Q1, full game, etc.)
  
- **TRIPLE_DOUBLE**: Player achieves double digits in 3 categories
  - ✅ Subject: PLAYER only
  - ❌ Metric: Not needed (event defines: points + rebounds + assists/blocks/steals)
  - ✅ Time Period: Needed (could be Q1, full game, etc.)

### 2. **Game-Level Events** (Any Sport)
- **GAME_GOES_TO_OT**: Game goes to overtime
  - ❌ Subject: Not needed (game-level event)
  - ❌ Metric: Not needed
  - ❌ Time Period: Not needed (OT happens at end of regulation)

### 3. **Team/Player Events** (Any Sport)
- **SCORES_FIRST**: First to score
  - ✅ Subject: TEAM or PLAYER (depending on sport/context)
  - ❌ Metric: Not needed (just "first to score")
  - ✅ Time Period: Needed (first in Q1, first in game, etc.)

- **SCORES_TD**: Scores a touchdown (Football)
  - ✅ Subject: PLAYER or TEAM (player scores TD, or team scores TD)
  - ❌ Metric: Not needed (event is "scores TD")
  - ✅ Time Period: Needed (first TD in game, TD in Q1, etc.)

- **SHUTOUT**: Team gets shutout
  - ✅ Subject: TEAM only
  - ❌ Metric: Not needed (event is "shutout")
  - ✅ Time Period: Needed (shutout in Q1, full game, etc.)

## Current Issues

1. **Metric field is required** but doesn't make sense for events
   - Events are about achievements/occurrences, not stat values
   - Double double doesn't need a "metric" - it's about multiple metrics

2. **Participant is required** but game-level events don't need it
   - GAME_GOES_TO_OT is about the game, not a participant

3. **Time period is always required** but some events don't need it
   - GAME_GOES_TO_OT happens at end of regulation (no time period needed)

4. **Event types aren't filtered** by subject type
   - DOUBLE_DOUBLE should only show for PLAYER
   - SHUTOUT should only show for TEAM
   - GAME_GOES_TO_OT shouldn't need a subject at all

## Recommendations

### Option 1: Make Fields Optional Based on Event Type (Recommended)

**Update EventConfig:**
```typescript
export interface EventConfig {
  type: 'EVENT';
  participant?: Participant;  // Optional - not needed for game-level events
  event_type: EventType;
  time_period?: TimePeriod;   // Optional - not needed for some events
}
```

**Update Participant interface for events:**
- For events, `metric` should be optional or not used
- Could create a separate `EventParticipant` interface

### Option 2: Create Event-Specific Configs

```typescript
// Player achievement events
interface PlayerAchievementEvent {
  type: 'EVENT';
  event_type: 'DOUBLE_DOUBLE' | 'TRIPLE_DOUBLE';
  participant: {
    subject_type: 'PLAYER';
    subject_id: string;
    subject_name: string;
    time_period: TimePeriod;  // Required
  };
}

// Game-level events
interface GameEvent {
  type: 'EVENT';
  event_type: 'GAME_GOES_TO_OT';
  // No participant needed
  // No time period needed
}

// Scoring events
interface ScoringEvent {
  type: 'EVENT';
  event_type: 'SCORES_FIRST' | 'SCORES_TD';
  participant: {
    subject_type: 'TEAM' | 'PLAYER';
    subject_id: string;
    subject_name: string;
    time_period: TimePeriod;  // Required
  };
}
```

### Option 3: Simplify - Make Everything Optional (Easiest)

**Update EventConfig:**
```typescript
export interface EventConfig {
  type: 'EVENT';
  participant?: Participant;  // Optional
  event_type: EventType;
  time_period?: TimePeriod;   // Optional
}
```

**Update Participant for events:**
- Make `metric` optional in Participant when used for events
- Or create a simplified participant for events

## Recommended Approach: Option 1 with Smart UI

### 1. Update Type Definitions

```typescript
// Make participant and time_period optional
export interface EventConfig {
  type: 'EVENT';
  participant?: Participant;  // Optional
  event_type: EventType;
  time_period?: TimePeriod;   // Optional
}

// For events, metric is not used, so we could make it optional
// Or create a separate interface
export interface EventParticipant {
  subject_type: SubjectType;
  subject_id: string;
  subject_name: string;
  time_period?: TimePeriod;  // Optional for events
  // No metric field
}
```

### 2. Update UI to Filter Event Types

**Event Type Filtering:**
- **PLAYER only**: DOUBLE_DOUBLE, TRIPLE_DOUBLE
- **TEAM only**: SHUTOUT
- **TEAM or PLAYER**: SCORES_FIRST, SCORES_TD
- **No participant needed**: GAME_GOES_TO_OT

**Conditional Fields:**
- Show participant selector only if event type requires it
- Show time period only if event type requires it
- Never show metric for events

### 3. Update ParticipantSelector for Events

```typescript
// For events, don't show metric field
// Show time period only if event type requires it
// Show participant only if event type requires it
```

## Implementation Plan

### Phase 1: Update Types
1. Make `participant` optional in `EventConfig`
2. Make `time_period` optional in `EventConfig`
3. Create `EventParticipant` interface (without metric) OR make metric optional

### Phase 2: Update UI
1. Filter event types based on subject type selection
2. Hide participant selector for GAME_GOES_TO_OT
3. Hide time period for GAME_GOES_TO_OT
4. Never show metric field for events
5. Show time period conditionally based on event type

### Phase 3: Update Resolution Logic
1. Handle optional participant for game-level events
2. Handle optional time period
3. Implement resolution for each event type

## Example: Before vs After

### Before (Current)
```
Event: DOUBLE_DOUBLE
Participant: LeBron James (PLAYER)
Metric: points (doesn't make sense!)
Time Period: Full Game
```

### After (Recommended)
```
Event: DOUBLE_DOUBLE
Participant: LeBron James (PLAYER)
Time Period: Full Game
(No metric field - event defines what metrics matter)
```

### Game-Level Event
```
Event: GAME_GOES_TO_OT
(No participant needed)
(No time period needed)
```

## Questions to Consider

1. **Should we support "first to score in Q1" vs "first to score in game"?**
   - If yes, time period is needed for SCORES_FIRST
   - If no, could simplify

2. **Should DOUBLE_DOUBLE/TRIPLE_DOUBLE support time periods?**
   - "LeBron gets triple double in Q1" - makes sense
   - "LeBron gets triple double in full game" - also makes sense
   - Recommendation: Keep time period for these

3. **Should we add more event types?**
   - First basket (basketball)
   - First goal (hockey/soccer)
   - Hat trick (hockey)
   - Perfect game (baseball)
   - No-hitter (baseball)

