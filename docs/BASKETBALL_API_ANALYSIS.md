# Basketball API Data Structure Analysis

## Overview

Analysis of ESPN basketball boxscore API responses to determine what bet types can be resolved and what data paths are needed.

**Files Analyzed:**
- `sample-basketball-end.json` - Completed game boxscore
- `sample-basketball-pregame.json` - Pre-game boxscore

---

## Game Status & Completion Detection

### Game Completion Keys

**Location:** `boxscore.competitions[0].status.type`

**Key Fields:**
- `state`: `"post"` = game completed
- `completed`: `true` = game completed
- `description`: `"Final"` = game completed
- `name`: `"STATUS_FINAL"` = game completed

**Example:**
```json
{
  "status": {
    "type": {
      "id": "3",
      "name": "STATUS_FINAL",
      "state": "post",
      "completed": true,
      "description": "Final",
      "detail": "Final",
      "shortDetail": "Final"
    }
  }
}
```

**Resolution:** ✅ Can detect game completion reliably

### Period Completion Detection

**Location:** `boxscore.plays[]` - Each play has period info

**Key Fields:**
- `period.number`: `1`, `2`, `3`, `4` (quarters)
- `period.displayValue`: `"1st Quarter"`, `"2nd Quarter"`, etc.

**Issue:** ⚠️ **Period completion not directly indicated**
- No explicit "Q1 complete" flag in boxscore
- Would need to check if last play in period has occurred
- Or check if next period has started
- Or use `linescores` array length (if 4 quarters exist, Q4 is complete)

**Potential Solutions:**
1. Check if `linescores` array has entry for period (e.g., if `linescores[0]` exists, Q1 is complete)
2. Check play-by-play for last play in period
3. Use different endpoint that provides period completion status

**Resolution:** ⚠️ **Needs clarification** - May need different endpoint or calculation method

---

## Team Statistics

### Full Game Team Stats

**Location:** `boxscore.teams[].statistics[]`

**Available Stats:**
- `points` - ❌ **NOT directly available** (need to calculate from score or use different path)
- `totalRebounds` - ✅ Available
- `assists` - ✅ Available
- `steals` - ✅ Available
- `blocks` - ✅ Available
- `turnovers` - ✅ Available
- `fieldGoalsMade-fieldGoalsAttempted` - ✅ Available (need to parse "49-88")
- `threePointFieldGoalsMade-threePointFieldGoalsAttempted` - ✅ Available
- `freeThrowsMade-freeThrowsAttempted` - ✅ Available

**Structure:**
```json
{
  "name": "assists",
  "displayValue": "37",
  "abbreviation": "AST",
  "label": "Assists"
}
```

**Data Path:** `boxscore.teams[].statistics[]` (array, need to find by `name`)

**Resolution:** ✅ Most team stats available, but **points not in statistics array** (need to use `score` field)

### Period-Specific Team Stats

**Location:** `boxscore.competitions[0].competitors[].linescores[]`

**Available:**
- Quarter scores only: `[30, 24, 31, 28]` for Q1-Q4
- No other period-specific stats (rebounds, assists, etc.)

**Structure:**
```json
{
  "linescores": [
    { "displayValue": "30" },  // Q1
    { "displayValue": "24" },  // Q2
    { "displayValue": "31" },  // Q3
    { "displayValue": "28" }   // Q4
  ]
}
```

**Resolution:** ⚠️ **Only quarter scores available** - Cannot resolve period-specific team stats (rebounds, assists, etc.) for quarters

---

## Player Statistics

### Full Game Player Stats

**Location:** `boxscore.players[].statistics[].athletes[]`

**Structure:**
```json
{
  "statistics": [{
    "keys": [
      "minutes",
      "points",
      "fieldGoalsMade-fieldGoalsAttempted",
      "threePointFieldGoalsMade-threePointFieldGoalsAttempted",
      "freeThrowsMade-freeThrowsAttempted",
      "rebounds",
      "assists",
      "turnovers",
      "steals",
      "blocks",
      "offensiveRebounds",
      "defensiveRebounds",
      "fouls",
      "plusMinus"
    ],
    "athletes": [{
      "athlete": {
        "id": "3913176",
        "displayName": "Brandon Ingram"
      },
      "stats": [
        "35",      // minutes
        "11",      // points
        "5-15",    // fieldGoalsMade-fieldGoalsAttempted
        "0-6",     // threePointFieldGoalsMade-threePointFieldGoalsAttempted
        "1-1",     // freeThrowsMade-freeThrowsAttempted
        "5",       // rebounds
        "4",       // assists
        "3",       // turnovers
        "0",       // steals
        "1",       // blocks
        "0",       // offensiveRebounds
        "5",       // defensiveRebounds
        "1",       // fouls
        "+5"       // plusMinus
      ]
    }]
  }]
}
```

**Available Stats:**
- ✅ `points` - Index 1
- ✅ `rebounds` - Index 5
- ✅ `assists` - Index 6
- ✅ `turnovers` - Index 7
- ✅ `steals` - Index 8
- ✅ `blocks` - Index 9
- ✅ `fieldGoalsMade` - Index 2 (parse "5-15" → 5)
- ✅ `fieldGoalsAttempted` - Index 2 (parse "5-15" → 15)
- ✅ `threePointersMade` - Index 3 (parse "0-6" → 0)
- ✅ `freeThrowsMade` - Index 4 (parse "1-1" → 1)

**Data Path:** 
- Find team in `boxscore.players[]` by `team.id`
- Find statistics array (usually first one)
- Find athlete by `athlete.id`
- Access `stats[]` array by index based on `keys[]` array

**Resolution:** ✅ Full game player stats available

### Period-Specific Player Stats

**Issue:** ❌ **NOT FOUND in boxscore**

The boxscore only contains full game stats. Period-specific player stats (e.g., "Player X points in Q1") are **not available** in this endpoint.

**Potential Solutions:**
1. Use play-by-play data to calculate period stats
2. Use different endpoint that provides period breakdowns
3. Check if live endpoint has period-specific data

**Resolution:** ❌ **Cannot resolve period-specific player props** with current boxscore data

### Period-Specific Stats via Play-by-Play Parsing

**Location:** `boxscore.plays[]` - Array of all plays in the game

**Key Fields in Each Play:**
- `period.number`: `1`, `2`, `3`, `4` (quarters)
- `team.id`: Team that the play belongs to
- `participants[]`: Array of athletes involved in the play
- `scoringPlay`: `true`/`false` - Whether the play resulted in points
- `scoreValue`: `0`, `1`, `2`, or `3` - Points scored on this play
- `shortDescription`: Short description of the play
- `text`: Full text description of the play
- `type.id`: Numeric ID for the play type
- `type.text`: Text description of the play type
- `wallclock`: UTC timestamp of when the play occurred

**Resolution:** ✅ **Can calculate period-specific stats by parsing plays array**

---

## Play-by-Play Parsing Guide

### Overview

The `boxscore.plays[]` array contains every play in the game in chronological order. By filtering plays by `period.number` and parsing the play details, we can calculate period-specific statistics for both players and teams.

### Play Structure

```json
{
  "id": "40181008013",
  "sequenceNumber": "13",
  "type": {
    "id": "130",
    "text": "Floating Jump Shot"
  },
  "text": "Jarrett Allen makes 9-foot two point shot (De'Andre Hunter assists)",
  "awayScore": 0,
  "homeScore": 2,
  "period": {
    "number": 1,
    "displayValue": "1st Quarter"
  },
  "clock": {
    "displayValue": "11:33"
  },
  "scoringPlay": true,
  "scoreValue": 2,
  "team": {
    "id": "5"
  },
  "participants": [
    {
      "athlete": {
        "id": "4066328"  // Scorer (Jarrett Allen)
      }
    },
    {
      "athlete": {
        "id": "4065732"  // Assister (De'Andre Hunter)
      }
    }
  ],
  "wallclock": "2025-11-14T00:13:40Z",
  "shootingPlay": true,
  "pointsAttempted": 2,
  "shortDescription": "+2 Points"
}
```

### Stat Extraction Patterns

#### 1. Points (Player & Team)

**Pattern:**
- Filter: `scoringPlay === true`
- Period: `period.number`
- Team: `team.id`
- Player: `participants[0].athlete.id` (scorer is always first)
- Value: `scoreValue` (1, 2, or 3)

**Example:**
```json
{
  "scoringPlay": true,
  "scoreValue": 3,
  "period": { "number": 1 },
  "team": { "id": "28" },
  "participants": [{ "athlete": { "id": "4395724" } }]  // Scorer
}
```

**Logic:**
```typescript
// For player points in Q1
plays.filter(play => 
  play.scoringPlay === true &&
  play.period.number === 1 &&
  play.participants[0]?.athlete.id === playerId
).reduce((sum, play) => sum + play.scoreValue, 0)

// For team points in Q1
plays.filter(play => 
  play.scoringPlay === true &&
  play.period.number === 1 &&
  play.team.id === teamId
).reduce((sum, play) => sum + play.scoreValue, 0)
```

**Note:** Team points can also be calculated from `linescores` array, but play-by-play allows for more granular tracking.

---

#### 2. Free Throws Made (Player & Team)

**Pattern:**
- Filter: `type.id` starts with "9" (e.g., "98", "99", "100", "101")
  - `"98"` = "Free Throw - 1 of 2"
  - `"99"` = "Free Throw - 2 of 2"
  - `"100"` = "Free Throw - 1 of 1"
  - `"101"` = "Free Throw - 1 of 3"
- Period: `period.number`
- Team: `team.id`
- Player: `participants[0].athlete.id` (shooter)
- Value: `1` if `scoringPlay === true`, `0` if missed

**Example:**
```json
{
  "type": { "id": "98", "text": "Free Throw - 1 of 2" },
  "scoringPlay": true,
  "scoreValue": 1,
  "period": { "number": 1 },
  "team": { "id": "28" },
  "participants": [{ "athlete": { "id": "4433134" } }]  // Shooter
}
```

**Logic:**
```typescript
// For player free throws made in Q1
plays.filter(play => 
  play.type.id.startsWith("9") &&
  play.period.number === 1 &&
  play.participants[0]?.athlete.id === playerId &&
  play.scoringPlay === true
).length
```

---

#### 3. Rebounds (Player & Team)

**Pattern:**
- Filter: `shortDescription === "Rebound"`
- Period: `period.number`
- Team: `team.id` (team that got the rebound)
- Player: `participants[0].athlete.id` (rebounder)
- Type: Check `type.text` for "Defensive Rebound" vs "Offensive Rebound"

**Example:**
```json
{
  "type": { "id": "155", "text": "Defensive Rebound" },
  "shortDescription": "Rebound",
  "period": { "number": 1 },
  "team": { "id": "5" },
  "participants": [{ "athlete": { "id": "4066328" } }]  // Rebounder
}
```

**Logic:**
```typescript
// For player rebounds in Q1
plays.filter(play => 
  play.shortDescription === "Rebound" &&
  play.period.number === 1 &&
  play.participants[0]?.athlete.id === playerId
).length

// For team rebounds in Q1
plays.filter(play => 
  play.shortDescription === "Rebound" &&
  play.period.number === 1 &&
  play.team.id === teamId
).length
```

**Note:** Team rebounds can also include "offensive team rebound" plays where `participants` may be empty or refer to the team.

---

#### 4. Assists (Player & Team)

**Pattern:**
- Filter: `scoringPlay === true` AND `text` contains "(PlayerName assists)"
- Period: `period.number`
- Team: `team.id` (scoring team)
- Player: `participants[1].athlete.id` (assister is second participant)
- Value: `1` per assist

**Example:**
```json
{
  "scoringPlay": true,
  "text": "Jarrett Allen makes 9-foot two point shot (De'Andre Hunter assists)",
  "period": { "number": 1 },
  "team": { "id": "5" },
  "participants": [
    { "athlete": { "id": "4066328" } },  // Scorer
    { "athlete": { "id": "4065732" } }   // Assister
  ]
}
```

**Logic:**
```typescript
// For player assists in Q1
plays.filter(play => 
  play.scoringPlay === true &&
  play.period.number === 1 &&
  play.participants.length >= 2 &&
  play.participants[1]?.athlete.id === playerId
).length

// For team assists in Q1
plays.filter(play => 
  play.scoringPlay === true &&
  play.period.number === 1 &&
  play.team.id === teamId &&
  play.participants.length >= 2  // Has an assist
).length
```

**Note:** Not all scoring plays have assists. Check `participants.length >= 2` to ensure an assist exists.

---

#### 5. Blocks (Player & Team)

**Pattern:**
- Filter: `text` contains "blocks" (case-insensitive)
- Period: `period.number`
- Team: `team.id` (team of the blocked player - opposite of blocker's team)
- Player: `participants[1].athlete.id` (blocker is second participant)
- Value: `1` per block

**Example:**
```json
{
  "text": "Scottie Barnes blocks Jarrett Allen 's 2-foot driving layup",
  "period": { "number": 1 },
  "team": { "id": "5" },  // Team of blocked player
  "participants": [
    { "athlete": { "id": "4066328" } },  // Blocked player
    { "athlete": { "id": "4433134" } }   // Blocker (Scottie Barnes)
  ]
}
```

**Logic:**
```typescript
// For player blocks in Q1
plays.filter(play => 
  play.text.toLowerCase().includes("blocks") &&
  play.period.number === 1 &&
  play.participants.length >= 2 &&
  play.participants[1]?.athlete.id === playerId
).length

// For team blocks in Q1 (need to find blocker's team)
// This is more complex - need to check if blocker is on the team
plays.filter(play => {
  if (!play.text.toLowerCase().includes("blocks") || 
      play.period.number !== 1 || 
      play.participants.length < 2) {
    return false;
  }
  const blockerId = play.participants[1]?.athlete.id;
  return isPlayerOnTeam(blockerId, teamId);  // Helper function needed
}).length
```

**Note:** The `team.id` in the play refers to the team of the blocked player, not the blocker. Need to check blocker's team separately.

---

#### 6. Steals (Player & Team)

**Pattern:**
- Filter: `text` contains "(PlayerName steals)" (case-insensitive)
- Period: `period.number`
- Team: `team.id` (team of the player who committed the turnover)
- Player: `participants[1].athlete.id` (stealer is second participant)
- Value: `1` per steal

**Example:**
```json
{
  "text": "Scottie Barnes lost ball turnover (Jarrett Allen steals)",
  "type": { "id": "63", "text": "Lost Ball Turnover" },
  "period": { "number": 1 },
  "team": { "id": "28" },  // Team of player who committed turnover
  "participants": [
    { "athlete": { "id": "4433134" } },  // Player who committed turnover
    { "athlete": { "id": "4066328" } }   // Stealer (Jarrett Allen)
  ]
}
```

**Logic:**
```typescript
// For player steals in Q1
plays.filter(play => 
  play.text.toLowerCase().includes("steals") &&
  play.period.number === 1 &&
  play.participants.length >= 2 &&
  play.participants[1]?.athlete.id === playerId
).length

// For team steals in Q1 (need to find stealer's team)
plays.filter(play => {
  if (!play.text.toLowerCase().includes("steals") || 
      play.period.number !== 1 || 
      play.participants.length < 2) {
    return false;
  }
  const stealerId = play.participants[1]?.athlete.id;
  return isPlayerOnTeam(stealerId, teamId);  // Helper function needed
}).length
```

**Note:** Similar to blocks, the `team.id` refers to the team of the player who committed the turnover, not the stealer.

---

#### 7. Turnovers (Player & Team)

**Pattern:**
- Filter: `shortDescription === "Turnover"` OR `type.text` contains "Turnover"
- Period: `period.number`
- Team: `team.id` (team of the player who committed the turnover)
- Player: `participants[0].athlete.id` (player who committed turnover)
- Value: `1` per turnover

**Example:**
```json
{
  "type": { "id": "90", "text": "Out of Bounds - Bad Pass Turnover" },
  "text": "Brandon Ingram out of bounds bad pass turnover",
  "shortDescription": "Turnover",
  "period": { "number": 1 },
  "team": { "id": "28" },
  "participants": [{ "athlete": { "id": "3913176" } }]  // Player with turnover
}
```

**Logic:**
```typescript
// For player turnovers in Q1
plays.filter(play => 
  (play.shortDescription === "Turnover" || 
   play.type.text.toLowerCase().includes("turnover")) &&
  play.period.number === 1 &&
  play.participants[0]?.athlete.id === playerId
).length

// For team turnovers in Q1
plays.filter(play => 
  (play.shortDescription === "Turnover" || 
   play.type.text.toLowerCase().includes("turnover")) &&
  play.period.number === 1 &&
  play.team.id === teamId
).length
```

---

#### 8. Field Goals Made/Attempted (Player & Team)

**Field Goals Made:**
- Filter: `scoringPlay === true` AND `scoreValue` is `2` or `3` (not free throws)
- Period: `period.number`
- Team: `team.id`
- Player: `participants[0].athlete.id` (scorer)

**Field Goals Attempted:**
- Filter: `shootingPlay === true` (includes both made and missed)
- Period: `period.number`
- Team: `team.id`
- Player: `participants[0].athlete.id` (shooter)

**Example:**
```json
{
  "scoringPlay": true,
  "shootingPlay": true,
  "scoreValue": 3,
  "pointsAttempted": 3,
  "period": { "number": 1 },
  "team": { "id": "28" },
  "participants": [{ "athlete": { "id": "4395724" } }]
}
```

**Logic:**
```typescript
// For player field goals made in Q1
plays.filter(play => 
  play.scoringPlay === true &&
  (play.scoreValue === 2 || play.scoreValue === 3) &&
  !play.type.id.startsWith("9") &&  // Not a free throw
  play.period.number === 1 &&
  play.participants[0]?.athlete.id === playerId
).length

// For player field goals attempted in Q1
plays.filter(play => 
  play.shootingPlay === true &&
  !play.type.id.startsWith("9") &&  // Not a free throw
  play.period.number === 1 &&
  play.participants[0]?.athlete.id === playerId
).length
```

---

#### 9. Three Pointers Made/Attempted (Player & Team)

**Three Pointers Made:**
- Filter: `scoringPlay === true` AND `scoreValue === 3`
- Period: `period.number`
- Team: `team.id`
- Player: `participants[0].athlete.id` (scorer)

**Three Pointers Attempted:**
- Filter: `shootingPlay === true` AND `pointsAttempted === 3`
- Period: `period.number`
- Team: `team.id`
- Player: `participants[0].athlete.id` (shooter)

**Example:**
```json
{
  "scoringPlay": true,
  "shootingPlay": true,
  "scoreValue": 3,
  "pointsAttempted": 3,
  "shortDescription": "+3 Points",
  "period": { "number": 1 },
  "team": { "id": "28" },
  "participants": [{ "athlete": { "id": "4395724" } }]
}
```

**Logic:**
```typescript
// For player three pointers made in Q1
plays.filter(play => 
  play.scoringPlay === true &&
  play.scoreValue === 3 &&
  play.period.number === 1 &&
  play.participants[0]?.athlete.id === playerId
).length

// For player three pointers attempted in Q1
plays.filter(play => 
  play.shootingPlay === true &&
  play.pointsAttempted === 3 &&
  play.period.number === 1 &&
  play.participants[0]?.athlete.id === playerId
).length
```

---

### Implementation Considerations

#### 1. Period Completion Detection

**Method:** Check if the last play in a period has occurred.

```typescript
function isPeriodComplete(plays: Play[], periodNumber: number): boolean {
  const periodPlays = plays.filter(p => p.period.number === periodNumber);
  if (periodPlays.length === 0) return false;
  
  // Check if next period has started
  const nextPeriodPlays = plays.filter(p => p.period.number === periodNumber + 1);
  if (nextPeriodPlays.length > 0) return true;
  
  // Check if game is complete and this is the last period
  // (Would need game status check)
  
  return false;  // Period may still be in progress
}
```

**Alternative:** Use `linescores` array - if `linescores[periodNumber - 1]` exists, the period is complete.

---

#### 2. Team Identification for Blocks/Steals

**Issue:** For blocks and steals, the `team.id` in the play refers to the team of the player who was blocked/committed the turnover, not the blocker/stealer.

**Solution:** Need a helper function to determine which team a player belongs to.

```typescript
function getPlayerTeam(playerId: string, gameData: GameData): string | null {
  // Search through boxscore.players[] to find player
  for (const team of gameData.boxscore.players) {
    for (const stat of team.statistics) {
      for (const athlete of stat.athletes) {
        if (athlete.athlete.id === playerId) {
          return team.team.id;
        }
      }
    }
  }
  return null;
}
```

---

#### 3. Performance Optimization

**Caching:** Parse all plays once and cache period-specific stats by player/team.

```typescript
interface PeriodStats {
  [periodNumber: number]: {
    [playerId: string]: {
      points: number;
      rebounds: number;
      assists: number;
      // ... etc
    };
    [teamId: string]: {
      points: number;
      rebounds: number;
      // ... etc
    };
  };
}
```

**Incremental Updates:** When polling for updates, only process new plays since last check.

---

#### 4. Edge Cases

**Team Rebounds:**
- Some rebounds may not have a player participant (team rebounds)
- Check if `participants` array is empty or has team reference

**Assists:**
- Not all scoring plays have assists
- Check `participants.length >= 2` before accessing `participants[1]`

**Free Throws:**
- Multiple free throws in a sequence (1 of 2, 2 of 2)
- Each free throw is a separate play
- Count each made free throw separately

**Period Boundaries:**
- Plays may be recorded slightly after period ends
- Use `wallclock` timestamp for precise ordering if needed

---

### Summary: Period-Specific Stats via Play-by-Play

**✅ Can Resolve via Play-by-Play:**

**Player Stats (by Period):**
- ✅ Points
- ✅ Rebounds
- ✅ Assists
- ✅ Steals
- ✅ Blocks
- ✅ Turnovers
- ✅ Field Goals Made/Attempted
- ✅ Three Pointers Made/Attempted
- ✅ Free Throws Made

**Team Stats (by Period):**
- ✅ Points (also available via `linescores`)
- ✅ Rebounds
- ✅ Assists
- ✅ Steals
- ✅ Blocks
- ✅ Turnovers
- ✅ Field Goals Made/Attempted
- ✅ Three Pointers Made/Attempted
- ✅ Free Throws Made

**Half Stats:**
- ✅ Can sum Q1+Q2 for first half
- ✅ Can sum Q3+Q4 for second half

**Resolution:** ✅ **All period-specific stats can be calculated from play-by-play data**

---

## Bet Type Resolution Capability

### ✅ Can Resolve

**Full Game Team Bets:**
- Team points (from `score` field, not statistics)
- Team rebounds, assists, steals, blocks, turnovers
- Team field goals made/attempted
- Team three pointers made/attempted
- Team free throws made/attempted
- Moneyline (compare team scores)
- Spread (compare team scores with spread)

**Full Game Player Bets:**
- Player points, rebounds, assists, steals, blocks, turnovers
- Player field goals made/attempted
- Player three pointers made/attempted
- Player free throws made/attempted

**Quarter Team Scores:**
- Team points in Q1, Q2, Q3, Q4 (from `linescores` array)
- Quarter moneyline (compare quarter scores)
- Quarter spread (compare quarter scores with spread)

### ⚠️ Cannot Resolve (with current data)

**Period-Specific Team Stats:**
- Team rebounds in Q1
- Team assists in Q1
- Team steals/blocks/turnovers in Q1
- Any non-points team stat for specific quarters

**Period-Specific Player Stats:**
- Player points in Q1
- Player rebounds in Q1
- Player assists in Q1
- Any player stat for specific quarters

**Half-Specific Stats:**
- First half stats (would need to sum Q1+Q2)
- Second half stats (would need to sum Q3+Q4)

---

## Data Path Mappings Needed

### Team Stats (Full Game)

```typescript
// Points - Use score field, not statistics
"points": "competitions[0].competitors[].score" // Parse as number

// Other stats - Find in statistics array
"totalRebounds": "teams[].statistics[]" // Find by name: "totalRebounds"
"assists": "teams[].statistics[]" // Find by name: "assists"
"steals": "teams[].statistics[]" // Find by name: "steals"
"blocks": "teams[].statistics[]" // Find by name: "blocks"
"turnovers": "teams[].statistics[]" // Find by name: "turnovers"
"fieldGoalsMade": "teams[].statistics[]" // Find by name: "fieldGoalsMade-fieldGoalsAttempted", parse "49-88" → 49
"fieldGoalsAttempted": "teams[].statistics[]" // Find by name: "fieldGoalsMade-fieldGoalsAttempted", parse "49-88" → 88
"threePointersMade": "teams[].statistics[]" // Find by name: "threePointFieldGoalsMade-threePointFieldGoalsAttempted", parse "12-31" → 12
"freeThrowsMade": "teams[].statistics[]" // Find by name: "freeThrowsMade-freeThrowsAttempted", parse "16-17" → 16
```

### Team Stats (Quarter Scores)

```typescript
// Quarter points
"Q1_points": "competitions[0].competitors[].linescores[0].displayValue" // Parse as number
"Q2_points": "competitions[0].competitors[].linescores[1].displayValue"
"Q3_points": "competitions[0].competitors[].linescores[2].displayValue"
"Q4_points": "competitions[0].competitors[].linescores[3].displayValue"
```

### Player Stats (Full Game)

```typescript
// Find player in boxscore.players[]
// Then access stats array by index
"points": "players[].statistics[0].athletes[].stats[1]" // Index 1
"rebounds": "players[].statistics[0].athletes[].stats[5]" // Index 5
"assists": "players[].statistics[0].athletes[].stats[6]" // Index 6
"steals": "players[].statistics[0].athletes[].stats[8]" // Index 8
"blocks": "players[].statistics[0].athletes[].stats[9]" // Index 9
"turnovers": "players[].statistics[0].athletes[].stats[7]" // Index 7
"fieldGoalsMade": "players[].statistics[0].athletes[].stats[2]" // Parse "5-15" → 5
"fieldGoalsAttempted": "players[].statistics[0].athletes[].stats[2]" // Parse "5-15" → 15
"threePointersMade": "players[].statistics[0].athletes[].stats[3]" // Parse "0-6" → 0
"freeThrowsMade": "players[].statistics[0].athletes[].stats[4]" // Parse "1-1" → 1
```

---

## Critical Findings

### 1. Points Not in Statistics Array

**Issue:** Team points are NOT in `teams[].statistics[]` array. They're in `competitions[0].competitors[].score`.

**Solution:** Need separate data path for points vs other stats.

### 2. Period-Specific Stats Missing

**Issue:** Boxscore only contains full game stats. No period-specific breakdowns for:
- Player stats by quarter
- Team stats by quarter (except points)

**Impact:** Cannot resolve bets like:
- "Player X over 5 points in Q1"
- "Team Y over 10 rebounds in Q1"
- "Player Z over 2 assists in first half"

**Potential Solutions:**
1. Use play-by-play data to calculate period stats
2. Check if different endpoint provides period breakdowns
3. Check if live endpoint has period-specific data
4. Restrict bets to full game only initially

### 3. Period Completion Detection

**Issue:** No explicit "period complete" flag in boxscore.

**Potential Solutions:**
1. Check `linescores` array length (if `linescores[0]` exists, Q1 complete)
2. Use play-by-play to find last play in period
3. Check if next period has started
4. Use different endpoint that provides period status

### 4. Data Parsing Required

**Issue:** Some stats are in combined format:
- `"fieldGoalsMade-fieldGoalsAttempted"`: `"49-88"` → Need to parse
- `"freeThrowsMade-freeThrowsAttempted"`: `"16-17"` → Need to parse

**Solution:** Parse strings like "49-88" to extract made/attempted values.

---

## Recommendations

### Phase 1: Full Game Bets Only

**Start with bets that can be resolved:**
- ✅ Full game team stats (points, rebounds, assists, etc.)
- ✅ Full game player stats (all metrics)
- ✅ Quarter team scores (points only)
- ✅ Moneyline and spread (full game and quarters)

**Defer:**
- ❌ Period-specific player props
- ❌ Period-specific team stats (non-points)
- ❌ Half-specific stats

### Phase 2: Investigate Period Stats

**Next steps:**
1. Check if live endpoint has period-specific data
2. Investigate play-by-play endpoint for calculating period stats
3. Check if different boxscore endpoint provides period breakdowns
4. Consider restricting period bets to points only (using linescores)

### Phase 3: Data Path Implementation

**Once period stats available:**
1. Document exact data paths for period-specific stats
2. Update sport config with period data paths
3. Implement period completion detection
4. Add period-specific resolution logic

---

## Questions for You

1. **Period Stats:** Do you have access to an endpoint that provides period-specific player/team stats? Or should we calculate from play-by-play?

2. **Period Completion:** How should we detect when a period is complete? Use `linescores` array, play-by-play, or different method?

3. **Bet Restrictions:** Should we restrict period bets to points only initially (since that's what's available), or wait until we have full period stats?

4. **Live Data:** Does the live endpoint have different structure that might include period stats?

5. **Half Stats:** For first half/second half bets, should we sum Q1+Q2 and Q3+Q4, or is there a direct half stat available?

---

## Summary

**What Works:**
- ✅ Full game team stats (most metrics)
- ✅ Full game player stats (all metrics)
- ✅ Quarter team scores (points only)
- ✅ Game completion detection

**What Doesn't Work:**
- ❌ Period-specific player stats
- ❌ Period-specific team stats (non-points)
- ⚠️ Period completion detection (needs method)

**Next Steps:**
1. Verify if period stats available in live endpoint
2. Determine period completion detection method
3. Document exact data paths for available stats
4. Plan implementation for period-specific stats (if available)

