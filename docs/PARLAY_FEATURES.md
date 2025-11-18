# Parlay Features - Technical Design Document

## Overview

This document outlines the technical implementation for the parlay building system. Parlays allow users to combine 2-5 bet selections into a single wager, with values ranging from +2 to +16 based on the number of bets. The system supports multiple active parlays per user and insurance mechanics.

**Key Principle:** Parlays are collections of `UserBetSelection` records. Single bets (1 selection) are NOT parlays - they're just `UserBetSelection` records with `parlayId = null`.

**Note:** Parlay resolution is handled separately. See `PARLAY_RESOLUTION_ENGINE.md` (WIP) for resolution details.

---

## Core Concepts

### Parlay Definition

A **Parlay** is a collection of 2-5 `UserBetSelection` records that:
- Must all hit for the parlay to win
- Can be insured (4-5 bet parlays only)
- Lock when the first game in the parlay starts
- Can be edited freely until locked

### Parlay Values

| Bet Count | Parlay Value | Insurance Available |
|-----------|--------------|---------------------|
| 1 bet     | +1           | No (single bet, not a parlay) |
| 2 bets    | +2           | No |
| 3 bets    | +4           | No |
| 4 bets    | +8           | Yes |
| 5 bets    | +16          | Yes |

### Parlay Status Lifecycle

1. **`building`** - User is adding selections (1-5 allowed, but need 2-5 to be valid)
2. **`locked`** - First game in parlay has started, no modifications allowed

**Note:** Resolution statuses (`pending`, `won`, `lost`, `resolution_failed`) are handled by the resolution engine and not part of this document.

**Important:** A parlay can be deleted at any time as long as it's not locked (i.e., `lockedAt` is null). Once the first game starts and the parlay is locked (`lockedAt` is set), it cannot be deleted.

### Insurance System

**Availability:**
- Only available on 4-bet (+8) and 5-bet (+16) parlays
- User can only have ONE insured parlay active at a time
- Insurance cost is based on current streak level (lookup table)

**Insurance Lock/Unlock:**
- When user insures a parlay, `insuranceLocked = true` on User
- Insurance cost is deducted immediately from streak
- After insured parlay resolves, insurance remains LOCKED
- Insurance unlocks when an **uninsured** bet/parlay resolves **AFTER** the insured parlay
- The uninsured bet must be from a different game (different resolution time)

**Insurance Cost Lookup Table:**

```typescript
const INSURANCE_COSTS = {
  // Format: [streakRange]: { parlay8: cost, parlay16: cost }
  '0-14': { parlay8: 3, parlay16: 5 },
  '15-24': { parlay8: 5, parlay16: 8 },
  '25-34': { parlay8: 6, parlay16: 10 },
  '35-44': { parlay8: 8, parlay16: 13 },
  '45+': { parlay8: 9, parlay16: 15 },
};

function getInsuranceCost(parlayValue: number, currentStreak: number): number {
  let range: string;
  if (currentStreak <= 14) range = '0-14';
  else if (currentStreak <= 24) range = '15-24';
  else if (currentStreak <= 34) range = '25-34';
  else if (currentStreak <= 44) range = '35-44';
  else range = '45+';
  
  const costs = INSURANCE_COSTS[range];
  return parlayValue === 8 ? costs.parlay8 : costs.parlay16;
}
```

---

## Database Schema

### Schema Changes Required

**Remove `ParlayBet` table entirely** - All parlays use `UserBetSelection` with `parlayId` set.

**Parlay Model:**
```prisma
model Parlay {
  id                String    @id @default(uuid())
  userId            String    @map("user_id")
  betCount          Int       @map("bet_count") // 2-5 (NOT 1 - single bets aren't parlays)
  parlayValue       Int       @map("parlay_value") // +2, +4, +8, +16
  insured           Boolean   @default(false)
  insuranceCost     Int       @default(0) @map("insurance_cost")
  status            String    @default("building") @db.VarChar(20)
  lockedAt          DateTime? @map("locked_at")
  resolvedAt        DateTime? @map("resolved_at")
  lastGameEndTime   DateTime? @map("last_game_end_time") // When the last game in this parlay ends
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")

  // Relations
  user          User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  selections    UserBetSelection[] // Direct relation - parlay contains these selections
  streakHistory StreakHistory[]

  @@index([userId, status])
  @@index([lastGameEndTime])
  @@map("parlays")
}
```

**UserBetSelection Model (already exists):**
```prisma
model UserBetSelection {
  id              String   @id @default(uuid())
  userId          String   @map("user_id")
  betId           String   @map("bet_id")
  selectedSide    String   @map("selected_side") @db.VarChar(50) // NOT NULL
  parlayId        String?  @map("parlay_id") // If null, it's a single bet (not in a parlay)
  status          String   @default("selected") @db.VarChar(20)
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  // Relations
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  bet             Bet      @relation(fields: [betId], references: [id], onDelete: Cascade)
  parlay          Parlay?  @relation(fields: [parlayId], references: [id], onDelete: SetNull)

  @@index([userId, status])
  @@index([betId])
  @@index([parlayId])
  @@index([userId, betId, selectedSide])
  @@map("user_bet_selections")
}
```

**User Model (insurance tracking):**
```prisma
model User {
  // ... existing fields
  insuranceLocked    Boolean   @default(false) @map("insurance_locked")
  lastInsuredParlayId String?  @map("last_insured_parlay_id") // Track which parlay locked insurance
  // ... relations
}
```

**Migration Notes:**
- Remove `ParlayBet` table entirely
- All parlays use `UserBetSelection` with `parlayId` set
- `betCount` should be 2-5 (not 1) - single bets are not parlays
- `lastGameEndTime` is used by resolution engine (not part of this doc)

---

## Bet Saving Flow - Critical Clarification

There are two user flows for creating parlays, and it's important to understand when bets are saved and how they're stored.

### How Bets Are Stored in Parlays

**Important:** Parlays do NOT store `betId`s directly. Instead:
- A `Parlay` references `UserBetSelection` records via the `parlayId` foreign key on `UserBetSelection`
- Each `UserBetSelection` stores:
  - `betId` - Which bet this selection is for
  - `selectedSide` - Which side the user picked
  - `parlayId` - Which parlay this selection belongs to (null = single bet)

**To get all bets in a parlay:**
1. Query `UserBetSelection` where `parlayId = parlay.id`
2. Each selection has a `betId` that references the actual `Bet` record
3. Each selection also has `selectedSide` showing which side the user picked

**This means:**
- The parlay's bets are stored in `UserBetSelection` records, not in the `Parlay` table
- The `Parlay.betCount` field is a cached count (for performance)
- The `Parlay.parlayValue` field is a cached value (for performance)
- Both are updated whenever selections are added/removed

### Flow 1: Convert Existing Single Bet to Parlay

**Step-by-step:**

1. **User saves a bet as single bet:**
   - User selects a side on a bet (e.g., "Lakers" on "Lakers vs Warriors")
   - User clicks **"Save Bet"** button
   - **Backend:** Creates `UserBetSelection` record:
     ```typescript
     {
       id: "selection-123",
       userId: "user-456",
       betId: "bet-789", // The bet ID
       selectedSide: "participant_1", // User picked Lakers
       parlayId: null, // NOT in a parlay yet
       status: "selected"
     }
     ```
   - **Frontend:** Shows bet in "My Bets" section as a single bet

2. **User converts single bet to parlay:**
   - User views their saved bets
   - User clicks **"Start Parlay"** button on an existing saved bet
   - **Backend:**
     a. Creates new `Parlay` record:
        ```typescript
        {
          id: "parlay-abc",
          userId: "user-456",
          betCount: 1, // Will be updated as more bets added
          parlayValue: 0, // Invalid until 2+ bets
          status: "building",
          insured: false,
          insuranceCost: 0
        }
        ```
     b. Updates existing `UserBetSelection`:
        ```typescript
        {
          id: "selection-123",
          parlayId: "parlay-abc", // NOW linked to parlay
          // ... rest unchanged
        }
        ```
   - **Frontend:** Shows sticky parlay builder with that bet already in slot 1

3. **User adds more bets to parlay:**
   - User browses bets and selects another side
   - User clicks **"Add to Parlay"** button
   - **Backend:**
     a. Creates new `UserBetSelection`:
        ```typescript
        {
          id: "selection-124",
          userId: "user-456",
          betId: "bet-790", // Different bet
          selectedSide: "over",
          parlayId: "parlay-abc", // Linked to same parlay
          status: "selected"
        }
        ```
     b. Updates `Parlay`:
        ```typescript
        {
          id: "parlay-abc",
          betCount: 2, // Updated
          parlayValue: 2, // Updated (+2 for 2 bets)
          // ... rest unchanged
        }
        ```
   - **Frontend:** Updates sticky parlay builder to show 2 bets

**Key Points for Flow 1:**
- The original `UserBetSelection` is **reused** - we don't create a duplicate
- We just update its `parlayId` from `null` to the new parlay ID
- The bet selection is **converted** from single bet to parlay bet

### Flow 2: Start Parlay with New Bet (No Prior Save)

**Step-by-step:**

1. **User starts parlay immediately:**
   - User selects a side on a bet (e.g., "Warriors" on "Lakers vs Warriors")
   - User clicks **"Start Parlay"** button (instead of "Save Bet")
   - **Backend:**
     a. Creates new `UserBetSelection`:
        ```typescript
        {
          id: "selection-125",
          userId: "user-456",
          betId: "bet-789",
          selectedSide: "participant_2", // User picked Warriors
          parlayId: null, // Will be set in next step
          status: "selected"
        }
        ```
     b. Creates new `Parlay`:
        ```typescript
        {
          id: "parlay-def",
          userId: "user-456",
          betCount: 1,
          parlayValue: 0,
          status: "building",
          insured: false,
          insuranceCost: 0
        }
        ```
     c. Updates `UserBetSelection` to link to parlay:
        ```typescript
        {
          id: "selection-125",
          parlayId: "parlay-def", // Linked to parlay
          // ... rest unchanged
        }
        ```
   - **Frontend:** Shows sticky parlay builder with that bet already in slot 1

2. **User adds more bets to parlay:**
   - Same as Flow 1, step 3 - creates new `UserBetSelection` records linked to the parlay

**Key Points for Flow 2:**
- `UserBetSelection` is created **and immediately linked** to the parlay
- No intermediate state as a single bet
- The bet selection is created **as part of** the parlay from the start

### Adding More Bets to an Existing Parlay

Once a parlay exists (via either flow), adding more bets works the same:

1. User selects a side on any bet (anywhere on the page)
2. User clicks **"Add to Parlay"** button
3. **Backend:**
   - Creates new `UserBetSelection` with `parlayId` set to the active parlay
   - Updates `Parlay.betCount` (increment)
   - Updates `Parlay.parlayValue` (recalculate: 2=+2, 3=+4, 4=+8, 5=+16)
4. **Frontend:** Updates sticky parlay builder

**Note:** If user has a saved single bet and wants to add it to an existing parlay:
- Option 1: User can click "Add to Parlay" on the saved bet (if UI supports it)
- Backend would update that `UserBetSelection.parlayId` to the existing parlay
- This **moves** the bet from single bet to parlay

### Removing Bets from a Parlay

When a bet is removed from a parlay:

1. **Backend:**
   - Updates `UserBetSelection.parlayId = null` (becomes a single bet)
   - Updates `Parlay.betCount` (decrement)
   - Updates `Parlay.parlayValue` (recalculate)
   - If `betCount` becomes 0: Deletes the `Parlay` record entirely

2. **Frontend:**
   - If parlay deleted: Sticky parlay builder disappears
   - If parlay still exists: Updates display

### Summary: Where Bets Are Stored

- **Bets themselves:** Stored in `Bet` table (created by admins)
- **User's selections:** Stored in `UserBetSelection` table
  - Each selection has: `betId` (which bet), `selectedSide` (which side), `parlayId` (which parlay, or null)
- **Parlays:** Stored in `Parlay` table
  - Contains metadata: `betCount`, `parlayValue`, `insured`, etc.
  - Does NOT contain bet IDs directly
  - Bets are accessed via: `UserBetSelection` where `parlayId = parlay.id`

**To get all bets in a parlay:**
```typescript
const parlay = await prisma.parlay.findUnique({
  where: { id: parlayId },
  include: {
    selections: {
      include: {
        bet: true, // Get the actual Bet record
        game: true // Get the Game record
      }
    }
  }
});
// parlay.selections is an array of UserBetSelection records
// Each selection has selection.bet (the Bet) and selection.selectedSide (the user's pick)
```

---

## API Endpoints

### POST `/api/parlays/start`

Start a new parlay from a bet selection. This handles both Flow 1 and Flow 2.

**Request:**
```typescript
{
  betId: string; // The bet to start the parlay with
  selectedSide: string; // The side selected ('participant_1', 'participant_2', 'over', 'under', 'yes', 'no')
  existingSelectionId?: string; // Optional - if provided, use this existing UserBetSelection instead of creating new one
}
```

**Response:**
```typescript
{
  success: boolean;
  data: {
    parlay: {
      id: string;
      betCount: number; // Will be 1 initially
      parlayValue: number; // Will be 0 initially (need 2+ bets)
      insured: boolean;
      insuranceCost: number;
      status: string; // 'building'
      selections: Array<{
        id: string;
        bet: {
          id: string;
          displayText: string;
          betType: string;
        };
        selectedSide: string;
        game: {
          id: string;
          homeTeam: string;
          awayTeam: string;
          startTime: string;
        };
      }>;
      createdAt: string;
    };
  };
}
```

**Business Logic:**
1. If `existingSelectionId` provided:
   - Verify selection exists, belongs to user, has `parlayId = null`
   - Use that selection
2. Else:
   - Validate bet exists and is available
   - Validate game hasn't started
   - Validate `selectedSide` matches bet type
   - Create new `UserBetSelection` with `parlayId = null` initially
3. Create new `Parlay` with status='building', betCount=1, parlayValue=0
4. Update `UserBetSelection.parlayId` to the new parlay
5. Return parlay with selection details

### POST `/api/parlays/:parlayId/add-selection`

Add a bet selection to an existing parlay.

**Request:**
```typescript
{
  betId: string;
  selectedSide: string;
  existingSelectionId?: string; // Optional - if provided, use existing selection
}
```

**Response:**
```typescript
{
  success: boolean;
  data: {
    parlay: {
      id: string;
      betCount: number; // Updated count
      parlayValue: number; // Updated value (+2, +4, +8, or +16)
      // ... rest of parlay data
      selections: Array<{ /* selection data */ }>;
    };
  };
}
```

**Validation:**
- Parlay must exist and belong to user
- Parlay must not be locked (`lockedAt` is null)
- Must have less than 5 selections already
- If `existingSelectionId` provided:
  - Selection must exist, belong to user, have `parlayId = null`
- Else:
  - Bet must exist and be available
  - Game must not have started
  - `selectedSide` must be valid for bet type

**Business Logic:**
1. If `existingSelectionId` provided, use that selection
2. Else, create new `UserBetSelection`
3. Set `UserBetSelection.parlayId` to the parlay
4. Update parlay's `betCount` (increment)
5. Calculate new `parlayValue` based on betCount:
   - 2 bets = +2
   - 3 bets = +4
   - 4 bets = +8
   - 5 bets = +16
6. Return updated parlay

### DELETE `/api/parlays/:parlayId/selections/:selectionId`

Remove a selection from a parlay (only if parlay is not locked).

**Business Logic:**
1. Verify parlay exists, belongs to user, and `lockedAt` is null (not locked)
2. Verify selection exists, belongs to parlay
3. Update `UserBetSelection`:
   - Set `parlayId = null`
   - Keep `status = 'selected'` (becomes a single bet)
4. Update parlay's `betCount` (decrement)
5. Recalculate `parlayValue` based on new betCount
6. If betCount becomes 0, delete the parlay (or keep with betCount=0? Decision needed)
7. Return updated parlay

### GET `/api/parlays`

Get user's parlays with optional filtering.

**Query Params:**
- `status`: Filter by status ('building', 'locked', etc.)
- `includeSelections`: Include full selection details (default: true)

**Response:**
```typescript
{
  success: boolean;
  data: {
    parlays: Array<{
      id: string;
      betCount: number;
      parlayValue: number;
      insured: boolean;
      insuranceCost: number;
      status: string;
      lockedAt?: string;
      selections?: Array<{
        id: string;
        bet: {
          id: string;
          displayText: string;
          betType: string;
        };
        selectedSide: string;
        status: string;
        game: {
          id: string;
          homeTeam: string;
          awayTeam: string;
          startTime: string;
        };
      }>;
      createdAt: string;
    }>;
  };
}
```

### GET `/api/parlays/:parlayId`

Get a specific parlay with full details.

**Response:** Same structure as single parlay in GET `/api/parlays`

### PATCH `/api/parlays/:parlayId`

Update a parlay (only allowed if parlay is not locked). Currently only used for insurance.

**Request:**
```typescript
{
  insured?: boolean; // Toggle insurance (only if 4-5 bets)
}
```

**Validation:**
- Parlay must exist, belong to user, and `lockedAt` is null (not locked)
- All games must not have started yet
- If adding insurance:
  - Must be 4 or 5 bet parlay
  - User's `insuranceLocked` must be `false`
  - Calculate insurance cost from lookup table
  - Deduct insurance cost from streak immediately
  - Set `insuranceLocked = true` on User
  - Set `lastInsuredParlayId` on User
- If removing insurance:
  - Refund insurance cost to streak
  - Set `insuranceLocked = false` on User (if this was the locked parlay)
  - Clear `lastInsuredParlayId` if applicable

### DELETE `/api/parlays/:parlayId`

Delete a parlay (only allowed if parlay is not locked).

**Business Logic:**
1. Verify parlay exists, belongs to user, and `lockedAt` is null (not locked)
2. If insured, refund insurance cost to streak
3. Update all `UserBetSelection` records:
   - Set `parlayId = null`
   - Set `status = 'selected'` (they become single bets)
4. Delete `Parlay` record

### POST `/api/parlays/:parlayId/lock`

Manually lock a parlay (usually automatic when first game starts).

**Business Logic:**
1. Check if any game has started
2. Set `lockedAt = now()`
3. Update status to 'locked'
4. Update all `UserBetSelection` status to 'locked'

### Note on "Save Parlay" Button

The "Save Parlay" button in the UI is purely for UX confirmation. Since all backend saving happens automatically as bets are added to the parlay, this button doesn't require a dedicated API endpoint. 

**Frontend Implementation:**
- When "Save Parlay" is clicked, the frontend can:
  - Option 1: Simply show a success message (since parlay is already saved)
  - Option 2: Call `GET /api/parlays/:parlayId` to verify the parlay exists and show success message
- No backend changes needed - the button is just for user confirmation/feedback

---

## UI/UX Flow

### Bet Selection with Parlay Option

**Location:** Today's Bets page (or anywhere bets are displayed)

**Current State:**
- Each bet shows two clickable cards (one for each side)
- When a side is selected, "Save Bet" button appears

**New State:**
- When a side is selected, TWO buttons appear:
  - **"Save Bet"** - Creates single bet (existing behavior)
  - **"Start Parlay"** - Creates new parlay with this bet (new behavior)

### Sticky Parlay Builder

**When "Start Parlay" is clicked:**
- A sticky menu/sidebar appears (stays visible as user scrolls)
- Shows 5 slots for bet selections
- First slot is filled with the bet that started the parlay
- Slots 2-5 are empty (or show "Add Bet" placeholder)

**Adding Bets to Parlay:**
- User can browse any bets on the page
- When user selects a side on any bet, an **"Add to Parlay"** button appears
- Clicking "Add to Parlay" adds that bet to the next available slot
- Parlay builder updates to show:
  - Current bet count
  - Calculated parlay value (+2, +4, +8, +16)
  - Insurance toggle (if 4-5 bets, and insurance available)
  - Insurance cost preview (if applicable)

**Removing Bets from Parlay:**
- Each slot in the parlay builder has a remove/delete button
- Clicking remove:
  - Removes bet from parlay
  - Bet becomes a single bet (if it was originally saved) or is deleted
  - Parlay value recalculates

**Save Parlay Button:**
- **"Save Parlay"** button is always visible in the sticky parlay builder
- **Purpose:** UX confirmation that parlay is saved (even though backend saves automatically)
- **Behavior:**
  - When clicked: Shows success message "Parlay saved!" (backend already saved, this is just confirmation)
  - Button is enabled when parlay has 2+ bets (valid parlay)
  - Button is disabled when parlay has < 2 bets (invalid parlay)
  - Button is hidden/disabled when parlay is locked (already saved and locked)
- **Note:** All backend saving happens automatically as bets are added, but this button provides explicit user confirmation

**Locking the Parlay:**
- Parlay automatically locks when first game starts
- User can also manually lock (if all games haven't started)
- Once locked, no modifications allowed
- "Save Parlay" button is hidden/disabled when locked

### Display of Saved Bets and Parlays

**Key Principle:** UI does NOT differentiate between saved bets and parlays in terms of display style. They use the same visual design, just grouped differently.

**Grouping:**
- **Single Bets** - Grouped together (all `UserBetSelection` with `parlayId = null`)
- **Parlays** - Grouped together (all `Parlay` records)
  - Each parlay shows its selections in a similar style to single bets
  - Visual indicator that it's a parlay (e.g., "Parlay: 3 bets, +4" badge)
  - Can expand/collapse to show individual selections

**Visual Design:**
- Same card style for single bets and parlay selections
- Parlays have an additional badge/header showing parlay info
- Both can be edited/deleted (if not locked)
- Both show game info, bet info, selected side

### Insurance UI

**When Parlay Has 4-5 Bets:**
- Insurance toggle appears in sticky parlay builder
- Shows insurance cost based on current streak (from lookup table)
- Shows net gain if parlay wins (parlayValue - insuranceCost)
- Shows loss if parlay loses (just insuranceCost)
- If insurance is locked: "Insurance unavailable - complete an uninsured bet first"

---

## Implementation Plan

### Phase 1: Database Schema Cleanup

1. **Add `lastInsuredParlayId` to User model**
   - Migration to add column
   - Update Prisma schema

2. **Remove `ParlayBet` table**
   - Migration to drop table
   - Remove from Prisma schema
   - Update any code references

3. **Add validation: `betCount` must be 2-5**
   - Update Prisma schema if needed
   - Add application-level validation

### Phase 2: Backend API - Parlay Creation

1. **POST `/api/parlays/start`**
   - Handle Flow 1 (existing selection) and Flow 2 (new selection)
   - Create parlay with first bet
   - Return parlay data

2. **POST `/api/parlays/:parlayId/add-selection`**
   - Add bet to existing parlay
   - Handle existing selection or create new
   - Update betCount and parlayValue
   - Return updated parlay

3. **DELETE `/api/parlays/:parlayId/selections/:selectionId`**
   - Remove selection from parlay
   - Update betCount and parlayValue
   - Handle parlay deletion if betCount becomes 0

4. **GET `/api/parlays`**
   - Query user's parlays
   - Include selection details
   - Filter by status

5. **GET `/api/parlays/:parlayId`**
   - Get single parlay with full details

6. **PATCH `/api/parlays/:parlayId`**
   - Toggle insurance
   - Handle insurance cost lookup
   - Update user streak and insurance state

7. **DELETE `/api/parlays/:parlayId`**
   - Delete parlay (only if not locked)
   - Refund insurance if applicable
   - Convert selections back to single bets

### Phase 3: Backend API - Parlay Locking

1. **Automatic Locking**
   - Service to check game start times
   - Update parlays when first game starts
   - Set `lockedAt` and update status

2. **POST `/api/parlays/:parlayId/lock`**
   - Manual lock endpoint (for testing/admin)

### Phase 4: Frontend - Bet Selection UI

1. **Update BetSelectionGroup Component**
   - Add "Start Parlay" button next to "Save Bet"
   - Handle parlay creation on "Start Parlay" click
   - Show "Add to Parlay" button when parlay is active

2. **Parlay Builder Component (Sticky)**
   - Create sticky sidebar/menu component
   - Show 5 slots for bet selections
   - Display current bet count and parlay value
   - Insurance toggle and cost display
   - Remove bet functionality
   - Lock parlay functionality

### Phase 5: Frontend - Display Integration

1. **Update "My Bets" Section**
   - Group single bets together
   - Group parlays together
   - Same visual style for both
   - Show parlay badge/header for parlays
   - Allow editing/deleting (if not locked)

2. **Update Dashboard**
   - Integrate parlay builder
   - Show active parlays
   - Show single bets

---

## Edge Cases & Error Handling

### Parlay with 0 or 1 Bet

**Scenario:** User removes bets from parlay until only 1 or 0 remain.

**Handling:**
- If betCount becomes 0: Delete the parlay entirely, sticky parlay builder UI disappears
- If betCount becomes 1: Keep parlay but parlayValue = 0 (invalid parlay, can't lock)
- User must add at least 2 bets before locking

### Adding Same Bet Twice

**Scenario:** User tries to add the same bet+side to a parlay twice.

**Handling:**
- Allow it (user might want same bet in multiple parlays)
- Create new `UserBetSelection` record
- Each parlay can have its own selection of the same bet

### Game Starts While Building

**Scenario:** User is building a parlay and one of the games starts.

**Handling:**
- When user tries to add a bet from a started game: Reject with error
- When checking parlay status: If any game has started, auto-lock the parlay
- User can still add bets from games that haven't started yet (until parlay is locked)

### Insurance Locked

**Scenario:** User tries to insure a parlay but insurance is locked.

**Handling:**
- Show error message: "Insurance unavailable - complete an uninsured bet first"
- Disable insurance toggle
- Show explanation of why insurance is locked

### Invalid Parlay State

**Scenario:** Parlay has betCount < 2 when user tries to lock.

**Handling:**
- Prevent locking
- Show error: "Parlay must have at least 2 bets"
- User must add more bets or delete the parlay

---

## Open Questions & Decisions

1. **ParlayBet table removal:**
   - ✅ **Decision:** Remove entirely

2. **Void bet handling:**
   - **Decision:** Handled by resolution engine (not part of this doc)

3. **Parlay editing:**
   - ✅ **Decision:** Allow full editing until locked

4. **Resolution timing:**
   - **Decision:** Not part of this doc (handled by resolution engine)

5. **Frontend updates:**
   - **Decision:** Not needed for MVP - backend verifies games haven't started

6. **Single bet resolution:**
   - **Decision:** Not part of this doc (handled separately)

7. **Parlay with 0 bets:**
   - ✅ **Decision:** Delete parlay automatically, sticky parlay builder disappears

---

## Next Steps

1. **Review and approve this document**
2. **Make decision on parlay with 0 bets**
3. **Create database migration for schema updates**
4. **Implement Phase 1 (Database Schema Cleanup)**
5. **Implement Phase 2 (Backend API - Parlay Creation)**
6. **Implement Phase 3 (Backend API - Parlay Locking)**
7. **Implement Phase 4 (Frontend - Bet Selection UI)**
8. **Implement Phase 5 (Frontend - Display Integration)**

---

## Appendix: Insurance Cost Lookup Table

| Streak Range | +8 Parlay Cost | +16 Parlay Cost | +8 Net Win | +16 Net Win |
|--------------|----------------|-----------------|------------|-------------|
| 0-14         | 3              | 5               | +5         | +11         |
| 15-24        | 5              | 8               | +3         | +8          |
| 25-34        | 6              | 10              | +2         | +6          |
| 35-44        | 8              | 13              | 0          | +3          |
| 45+          | 9              | 15              | -1         | +1          |

**Note:** Net win = parlayValue - insuranceCost. If parlay loses, user only loses the insurance cost (streak survives).
