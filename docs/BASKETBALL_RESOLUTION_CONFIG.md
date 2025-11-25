# Basketball Bet Resolution Configuration Documentation

This document explains how the basketball bet resolution system works, including all helper functions, end period keys, and metric resolution functions.

## Table of Contents

1. [Helper Functions](#helper-functions)
2. [End Period Keys (BetEndPointKey)](#end-period-keys-betendpointkey)
3. [Metric Resolution Functions](#metric-resolution-functions)
4. [Resolution Flow](#resolution-flow)

---

## Helper Functions

### `getNestedValue(obj, path, filter?)`

**Purpose:** Extracts a value from a nested JSON object using dot-notation paths. Supports filtering arrays to find specific items.

**Parameters:**
- `obj`: The root object to traverse
- `path`: Dot-notation path (e.g., `"status.type.completed"` or `"competitors[0].linescores[1]"`)
- `filter` (optional): Filter configuration for array filtering
  - `arrayPath`: Path to the array to filter (e.g., `"header.competitions"`)
  - `filterKey`: Key to match on (e.g., `"id"`)
  - `filterValuePath`: Path to get the filter value (e.g., `"header.id"`)

**How it works:**
```
PSEUDOCODE:
function getNestedValue(obj, path, filter):
  IF filter is provided:
    // Step 1: Get the filter value
    filterValue = getNestedValue(obj, filter.filterValuePath)
    
    // Step 2: Navigate to the array
    arrayObj = navigate to filter.arrayPath in obj
    
    // Step 3: Find item in array where item[filter.filterKey] === filterValue
    filteredItem = arrayObj.find(item => item[filter.filterKey] === filterValue)
    
    // Step 4: Resolve remaining path from filtered item
    remainingPath = path with arrayPath removed
    RETURN getNestedValue(filteredItem, remainingPath)
  
  ELSE:
    // Normal path traversal
    parts = split path by dots and brackets
    current = obj
    FOR each part in parts:
      current = current[part]
    RETURN current
```

**Example:**
```javascript
// Without filter:
getNestedValue(gameData, "header.competitions[0].status.type.completed")
// Traverses: gameData -> header -> competitions -> [0] -> status -> type -> completed

// With filter:
getNestedValue(gameData, "status.type.completed", {
  arrayPath: "header.competitions",
  filterKey: "id",
  filterValuePath: "header.id"
})
// 1. Gets header.id value (e.g., "401810080")
// 2. Finds competition in header.competitions where id === "401810080"
// 3. Resolves "status.type.completed" from that competition
```

---

### `getPlayerStat(gameData, playerId, statKey)`

**Purpose:** Extracts a player statistic from the boxscore.players structure.

**Parameters:**
- `gameData`: The full game data JSON object
- `playerId`: The player's ID (as string)
- `statKey`: The stat key to look up (e.g., `"points"`, `"rebounds"`, `"fieldGoalsMade-fieldGoalsAttempted"`)

**How it works:**
```
PSEUDOCODE:
function getPlayerStat(gameData, playerId, statKey):
  // Step 1: Find the player group containing this player
  playerGroup = gameData.boxscore.players.find(group => 
    group.statistics[0].athletes contains player with id === playerId
  )
  
  IF playerGroup not found:
    RETURN null
  
  // Step 2: Get the statistics structure
  stats = playerGroup.statistics[0]
  
  // Step 3: Find the athlete
  athlete = stats.athletes.find(a => a.athlete.id === playerId)
  
  IF athlete not found OR athlete.stats is missing:
    RETURN null
  
  // Step 4: Find the index of the stat in the keys array
  statIndex = stats.keys.indexOf(statKey)
  
  IF statIndex === -1 OR athlete.stats[statIndex] is undefined:
    RETURN null
  
  // Step 5: Handle compound stats (e.g., "fieldGoalsMade-fieldGoalsAttempted")
  IF statKey contains "-":
    value = athlete.stats[statIndex]
    IF value is string with "-":
      RETURN parseInt(value.split("-")[0])  // Extract first part
  
  // Step 6: Return the stat value
  RETURN parseInt(athlete.stats[statIndex])
```

**Data Structure:**
```
boxscore.players[] = [
  {
    team: { id: "28", ... },
    statistics: [
      {
        keys: ["minutes", "points", "rebounds", ...],
        athletes: [
          {
            athlete: { id: "4065732", ... },
            stats: ["27", "16", "2", ...]  // Values aligned with keys array
          }
        ]
      }
    ]
  }
]
```

**Example:**
```javascript
// Get points for player "4065732"
getPlayerStat(gameData, "4065732", "points")
// 1. Finds player group containing player 4065732
// 2. Gets statistics[0].keys array, finds index of "points" (index 1)
// 3. Returns athlete.stats[1] = "16" -> 16
```

---

## End Period Keys (BetEndPointKey)

End period keys determine when a bet's time period has completed. Each time period has a `betEndPointKey` configuration that specifies how to check if that period is done.

### Structure

```typescript
interface BetEndPointKey {
  path: string;              // JSON path to check
  expectedValue: any;        // Expected value when complete
  filter?: {                 // Optional filter for arrays
    arrayPath: string;       // Path to array
    filterKey: string;       // Key to match
    filterValuePath: string; // Path to filter value
  };
}
```

### Time Period Configurations

#### FULL_GAME
```javascript
{
  path: 'status.type.completed',
  expectedValue: true,
  filter: {
    arrayPath: 'header.competitions',
    filterKey: 'id',
    filterValuePath: 'header.id'
  }
}
```
**How it works:**
- Filters `header.competitions` to find competition where `id === header.id`
- Checks if `status.type.completed === true`
- Returns true when the game is finished

---

#### Q1 (1st Quarter)
```javascript
{
  path: 'competitors[0].linescores[0]',
  expectedValue: 'exists',
  filter: {
    arrayPath: 'header.competitions',
    filterKey: 'id',
    filterValuePath: 'header.id'
  }
}
```
**How it works:**
- Filters to find the correct competition
- Checks if `competitors[0].linescores[0]` exists (not null/undefined)
- Q1 is complete when the first quarter linescore exists

---

#### Q2 (2nd Quarter)
```javascript
{
  path: 'competitors[0].linescores[1]',
  expectedValue: 'exists',
  filter: { /* same as Q1 */ }
}
```
**How it works:**
- Checks if `competitors[0].linescores[1]` exists
- Q2 is complete when the second quarter linescore exists

---

#### Q3 (3rd Quarter)
```javascript
{
  path: 'competitors[0].linescores[2]',
  expectedValue: 'exists',
  filter: { /* same as Q1 */ }
}
```
**How it works:**
- Checks if `competitors[0].linescores[2]` exists
- Q3 is complete when the third quarter linescore exists

---

#### Q4 (4th Quarter)
```javascript
{
  path: 'competitors[0].linescores[3]',
  expectedValue: 'exists',
  filter: { /* same as Q1 */ }
}
```
**How it works:**
- Checks if `competitors[0].linescores[3]` exists
- Q4 is complete when the fourth quarter linescore exists

---

#### H1 (1st Half)
```javascript
{
  path: 'competitors[0].linescores[1]',
  expectedValue: 'exists',
  filter: { /* same as Q1 */ }
}
```
**How it works:**
- Uses the same check as Q2 (linescores[1])
- H1 is complete when Q2 is complete (since H1 = Q1 + Q2)

---

#### H2 (2nd Half)
```javascript
{
  path: 'status.type.completed',
  expectedValue: true,
  filter: { /* same as Q1 */ }
}
```
**How it works:**
- Checks if game is completed
- H2 is complete when the entire game is finished (since H2 = Q3 + Q4 + any OT)

---

#### OT (Overtime)
```javascript
{
  path: 'status.type.completed',
  expectedValue: true,
  filter: { /* same as Q1 */ }
}
```
**How it works:**
- Checks if game is completed
- OT is complete when the entire game is finished

---

## Metric Resolution Functions

Each metric has an `endGameStatFetchKey` function that extracts the stat value from the game data. All functions follow this signature:

```typescript
(gameData: any, subjectId: string, subjectType: 'TEAM' | 'PLAYER', period?: TimePeriod) => number | null
```

### Points

**Function:** `endGameStatFetchKey` for `points` metric

**How it works:**

```
IF subjectType === 'TEAM':
  // Step 1: Get header.id to filter competition
  headerId = gameData.header.id
  
  // Step 2: Find competition matching header.id
  competition = header.competitions.find(c => c.id === headerId)
  
  // Step 3: Find competitor (team) in competition
  competitor = competition.competitors.find(c => c.team.id === subjectId)
  
  // Step 4: Extract points based on period
  IF period === 'FULL_GAME' OR no period:
    RETURN parseInt(competitor.score)
  
  IF period === 'Q1', 'Q2', 'Q3', or 'Q4':
    quarterIndex = map period to index (Q1=0, Q2=1, Q3=2, Q4=3)
    RETURN parseInt(competitor.linescores[quarterIndex].displayValue)
  
  IF period === 'H1':
    q1 = parseInt(competitor.linescores[0].displayValue)
    q2 = parseInt(competitor.linescores[1].displayValue)
    RETURN q1 + q2
  
  IF period === 'H2':
    q3 = parseInt(competitor.linescores[2].displayValue)
    q4 = parseInt(competitor.linescores[3].displayValue)
    RETURN q3 + q4

ELSE IF subjectType === 'PLAYER':
  // Use getPlayerStat helper
  RETURN getPlayerStat(gameData, subjectId, 'points')
```

**Data Sources:**
- **Team:** `header.competitions[].competitors[].score` (full game) or `linescores[]` (quarters/halves)
- **Player:** `boxscore.players[].statistics[0].athletes[].stats[]` (index from keys array)

---

### Rebounds

**Function:** `endGameStatFetchKey` for `rebounds` metric

**How it works:**

```
IF subjectType === 'TEAM':
  // Step 1: Find team in boxscore
  team = gameData.boxscore.teams.find(t => t.team.id === subjectId)
  
  // Step 2: Find totalRebounds stat
  stat = team.statistics.find(s => s.name === 'totalRebounds')
  
  // Step 3: Extract value
  RETURN parseInt(stat.displayValue)

ELSE IF subjectType === 'PLAYER':
  // Use getPlayerStat helper
  RETURN getPlayerStat(gameData, subjectId, 'rebounds')
```

**Data Sources:**
- **Team:** `boxscore.teams[].statistics[]` where `name === 'totalRebounds'`
- **Player:** `boxscore.players[].statistics[0].athletes[].stats[]` (index of 'rebounds' in keys)

---

### Assists

**Function:** `endGameStatFetchKey` for `assists` metric

**How it works:**

```
IF subjectType === 'TEAM':
  team = gameData.boxscore.teams.find(t => t.team.id === subjectId)
  stat = team.statistics.find(s => s.name === 'assists')
  RETURN parseInt(stat.displayValue)

ELSE IF subjectType === 'PLAYER':
  RETURN getPlayerStat(gameData, subjectId, 'assists')
```

**Data Sources:**
- **Team:** `boxscore.teams[].statistics[]` where `name === 'assists'`
- **Player:** `boxscore.players[].statistics[0].athletes[].stats[]` (index of 'assists' in keys)

---

### Steals

**Function:** `endGameStatFetchKey` for `steals` metric

**How it works:**

```
IF subjectType === 'TEAM':
  team = gameData.boxscore.teams.find(t => t.team.id === subjectId)
  stat = team.statistics.find(s => s.name === 'steals')
  RETURN parseInt(stat.displayValue)

ELSE IF subjectType === 'PLAYER':
  RETURN getPlayerStat(gameData, subjectId, 'steals')
```

**Data Sources:**
- **Team:** `boxscore.teams[].statistics[]` where `name === 'steals'`
- **Player:** `boxscore.players[].statistics[0].athletes[].stats[]` (index of 'steals' in keys)

---

### Blocks

**Function:** `endGameStatFetchKey` for `blocks` metric

**How it works:**

```
IF subjectType === 'TEAM':
  team = gameData.boxscore.teams.find(t => t.team.id === subjectId)
  stat = team.statistics.find(s => s.name === 'blocks')
  RETURN parseInt(stat.displayValue)

ELSE IF subjectType === 'PLAYER':
  RETURN getPlayerStat(gameData, subjectId, 'blocks')
```

**Data Sources:**
- **Team:** `boxscore.teams[].statistics[]` where `name === 'blocks'`
- **Player:** `boxscore.players[].statistics[0].athletes[].stats[]` (index of 'blocks' in keys)

---

### Turnovers

**Function:** `endGameStatFetchKey` for `turnovers` metric

**How it works:**

```
IF subjectType === 'TEAM':
  team = gameData.boxscore.teams.find(t => t.team.id === subjectId)
  stat = team.statistics.find(s => s.name === 'turnovers')
  RETURN parseInt(stat.displayValue)

ELSE IF subjectType === 'PLAYER':
  RETURN getPlayerStat(gameData, subjectId, 'turnovers')
```

**Data Sources:**
- **Team:** `boxscore.teams[].statistics[]` where `name === 'turnovers'`
- **Player:** `boxscore.players[].statistics[0].athletes[].stats[]` (index of 'turnovers' in keys)

---

### Field Goals Made

**Function:** `endGameStatFetchKey` for `field_goals_made` metric

**How it works:**

```
IF subjectType === 'TEAM':
  team = gameData.boxscore.teams.find(t => t.team.id === subjectId)
  stat = team.statistics.find(s => s.name === 'fieldGoalsMade-fieldGoalsAttempted')
  
  // Format is "49-88", extract first number (made)
  made = stat.displayValue.split('-')[0]
  RETURN parseInt(made)

ELSE IF subjectType === 'PLAYER':
  // getPlayerStat handles compound stats automatically
  RETURN getPlayerStat(gameData, subjectId, 'fieldGoalsMade-fieldGoalsAttempted')
```

**Data Sources:**
- **Team:** `boxscore.teams[].statistics[]` where `name === 'fieldGoalsMade-fieldGoalsAttempted'`, format `"49-88"`
- **Player:** `boxscore.players[].statistics[0].athletes[].stats[]` (index of 'fieldGoalsMade-fieldGoalsAttempted' in keys), format `"7-16"`

**Note:** Compound stats are stored as "made-attempted" strings. The function extracts the first number.

---

### Field Goals Attempted

**Function:** `endGameStatFetchKey` for `field_goals_attempted` metric

**How it works:**

```
IF subjectType === 'TEAM':
  team = gameData.boxscore.teams.find(t => t.team.id === subjectId)
  stat = team.statistics.find(s => s.name === 'fieldGoalsMade-fieldGoalsAttempted')
  
  // Format is "49-88", extract second number (attempted)
  attempted = stat.displayValue.split('-')[1]
  RETURN parseInt(attempted)

ELSE IF subjectType === 'PLAYER':
  // Manual extraction needed for second part
  playerGroup = find player group containing subjectId
  stats = playerGroup.statistics[0]
  athlete = stats.athletes.find(a => a.athlete.id === subjectId)
  statIndex = stats.keys.indexOf('fieldGoalsMade-fieldGoalsAttempted')
  value = athlete.stats[statIndex]  // e.g., "7-16"
  attempted = value.split('-')[1]
  RETURN parseInt(attempted)
```

**Data Sources:**
- **Team:** Same as field_goals_made, but extracts second number
- **Player:** Same as field_goals_made, but extracts second number

---

### Three Pointers Made

**Function:** `endGameStatFetchKey` for `three_pointers_made` metric

**How it works:**

```
IF subjectType === 'TEAM':
  team = gameData.boxscore.teams.find(t => t.team.id === subjectId)
  stat = team.statistics.find(s => s.name === 'threePointFieldGoalsMade-threePointFieldGoalsAttempted')
  
  // Format is "12-31", extract first number
  made = stat.displayValue.split('-')[0]
  RETURN parseInt(made)

ELSE IF subjectType === 'PLAYER':
  RETURN getPlayerStat(gameData, subjectId, 'threePointFieldGoalsMade-threePointFieldGoalsAttempted')
```

**Data Sources:**
- **Team:** `boxscore.teams[].statistics[]` where `name === 'threePointFieldGoalsMade-threePointFieldGoalsAttempted'`
- **Player:** `boxscore.players[].statistics[0].athletes[].stats[]` (index of 'threePointFieldGoalsMade-threePointFieldGoalsAttempted' in keys)

---

### Free Throws Made

**Function:** `endGameStatFetchKey` for `free_throws_made` metric

**How it works:**

```
IF subjectType === 'TEAM':
  team = gameData.boxscore.teams.find(t => t.team.id === subjectId)
  stat = team.statistics.find(s => s.name === 'freeThrowsMade-freeThrowsAttempted')
  
  // Format is "16-17", extract first number
  made = stat.displayValue.split('-')[0]
  RETURN parseInt(made)

ELSE IF subjectType === 'PLAYER':
  RETURN getPlayerStat(gameData, subjectId, 'freeThrowsMade-freeThrowsAttempted')
```

**Data Sources:**
- **Team:** `boxscore.teams[].statistics[]` where `name === 'freeThrowsMade-freeThrowsAttempted'`
- **Player:** `boxscore.players[].statistics[0].athletes[].stats[]` (index of 'freeThrowsMade-freeThrowsAttempted' in keys)

---

## Resolution Flow

### High-Level Process

```
1. RESOLVE BET
   ├─> Get bet config (participant_1, participant_2, operator, etc.)
   ├─> Get sport config (time periods, metrics)
   └─> Call resolveComparisonBet()

2. CHECK PERIOD COMPLETION
   ├─> Get betEndPointKey for participant_1.time_period
   ├─> Get betEndPointKey for participant_2.time_period
   ├─> For each period:
   │   ├─> Call checkBetEndPoint(gameData, betEndPointKey)
   │   │   ├─> Call getNestedValue() with filter
   │   │   ├─> Compare value to expectedValue
   │   │   └─> Return true/false
   │   └─> If both periods complete, continue
   └─> If not complete, return { resolved: false, reason: "..." }

3. EXTRACT STATS
   ├─> For participant_1:
   │   ├─> Get metric config (endGameStatFetchKey function)
   │   ├─> Call function(gameData, subjectId, subjectType, time_period)
   │   └─> Get stat value
   ├─> For participant_2:
   │   ├─> Get metric config (endGameStatFetchKey function)
   │   ├─> Call function(gameData, subjectId, subjectType, time_period)
   │   └─> Get stat value
   └─> If either stat is null, return { resolved: false, reason: "..." }

4. APPLY SPREAD (if exists)
   ├─> If bet.spread exists:
   │   ├─> IF spread.direction === '+':
   │   │   └─> adjustedStat1 = stat1 + spread.value
   │   └─> ELSE:
   │       └─> adjustedStat1 = stat1 - spread.value

5. DETERMINE OUTCOME
   ├─> IF operator === 'GREATER_THAN':
   │   ├─> IF adjustedStat1 > stat2: outcome = 'win'
   │   ├─> IF adjustedStat1 < stat2: outcome = 'loss'
   │   └─> IF adjustedStat1 === stat2: outcome = 'push'
   ├─> IF operator === 'GREATER_EQUAL':
   │   ├─> IF adjustedStat1 >= stat2: outcome = 'win'
   │   └─> ELSE: outcome = 'loss'
   └─> Return { resolved: true, outcome, ... }
```

### Key Design Decisions

1. **Filtering Competitions:** Instead of using `competitions[0]`, we filter by `id === header.id` to ensure we're looking at the correct game.

2. **Team vs Player Stats:** 
   - Team stats come from `boxscore.teams[]` or `header.competitions[].competitors[]`
   - Player stats come from `boxscore.players[]` using the `getPlayerStat()` helper

3. **Period Handling:**
   - Full game: Use total score/stat
   - Quarters: Use specific linescore index
   - Halves: Sum appropriate quarters

4. **Compound Stats:** Stats like "fieldGoalsMade-fieldGoalsAttempted" are stored as strings like "49-88" and need to be split to extract individual values.

---

## Common Patterns

### Pattern 1: Simple Team Stat (rebounds, assists, steals, blocks, turnovers)
```
1. Find team in boxscore.teams by team.id
2. Find stat in team.statistics by stat.name
3. Return parseInt(stat.displayValue)
```

### Pattern 2: Compound Team Stat (field goals, three pointers, free throws)
```
1. Find team in boxscore.teams by team.id
2. Find compound stat (e.g., "fieldGoalsMade-fieldGoalsAttempted")
3. Split displayValue by "-"
4. Extract first number (made) or second number (attempted)
5. Return parseInt(value)
```

### Pattern 3: Player Stat (all metrics)
```
1. Use getPlayerStat(gameData, playerId, statKey)
2. Helper finds player in boxscore.players
3. Gets stat index from keys array
4. Returns value from stats array
5. Handles compound stats automatically
```

### Pattern 4: Team Points with Period
```
1. Find competition by filtering header.competitions
2. Find competitor (team) in competition
3. IF FULL_GAME: Return competitor.score
4. IF Q1-Q4: Return competitor.linescores[index]
5. IF H1: Sum linescores[0] + linescores[1]
6. IF H2: Sum linescores[2] + linescores[3]
```

---

## Error Handling

All functions return `null` when:
- Required data structures are missing
- Subject (team/player) not found
- Stat not found
- Invalid period specified
- Data format is unexpected

The resolution function checks for `null` values and returns `{ resolved: false, reason: "..." }` with a descriptive error message.

