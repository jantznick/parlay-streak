# User Bet Selection - Design Document

## Overview

This document outlines the system for allowing users (including admins) to select bets and choose sides, building towards parlay creation. This is the foundation for the parlay building system.

**Key Principle:** Users select from curated bets created by admins. They choose which side/outcome they predict, then add these selections to parlays (starting with single-bet parlays).

---

## Core Concepts

### Bet Selection vs Bet Creation

- **Bet Creation (Admin):** Admins create bet definitions (e.g., "Lakers points > Warriors points")
- **Bet Selection (User):** Users choose which side/outcome they predict (e.g., "I pick Lakers")

### What "Choosing a Side" Means

Different bet types require different user choices:

#### 1. COMPARISON Bets
**Example:** "Lakers points > Warriors points"

**User Choice:** Pick which participant will win
- Option A: Participant 1 (Lakers)
- Option B: Participant 2 (Warriors)

**With Spread:** "Lakers +3.5 > Warriors"
- Option A: Lakers +3.5 (Lakers side with spread)
- Option B: Warriors (Warriors side)

**Storage:** Store which participant the user selected (participant_1 or participant_2)

#### 2. THRESHOLD Bets
**Example:** "LeBron James points 28.5"

**User Choice:** User chooses OVER or UNDER
- Option A: OVER 28.5
- Option B: UNDER 28.5

**Note:** The bet definition has a threshold value (28.5), but the user chooses which side (OVER/UNDER) they predict.

**Storage:** Store 'over' or 'under' as selectedSide

#### 3. EVENT Bets
**Example:** "LeBron scores triple double"

**User Choice:** Binary YES/NO
- Option A: YES (event happens)
- Option B: NO (event doesn't happen)

**Storage:** Store boolean (true = YES, false = NO)

---

## Database Schema

### New Table: `user_bet_selections`

Stores individual bet selections made by users. These can be added to parlays later.

```prisma
model UserBetSelection {
  id              String   @id @default(uuid())
  userId          String   @map("user_id")
  betId           String   @map("bet_id")
  
  // Side selection based on bet type
  selectedSide    String?  @map("selected_side") @db.VarChar(50)
  // For COMPARISON: 'participant_1' or 'participant_2'
  // For EVENT: 'yes' or 'no'
  // For THRESHOLD: null (no side choice)
  
  // Status tracking
  status          String   @default("selected") @db.VarChar(20)
  // 'selected' - chosen but not in a parlay yet
  // 'in_parlay' - added to a parlay
  // 'locked' - parlay locked, can't modify
  // 'resolved' - bet resolved (for single-bet parlays)
  
  // Timestamps
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  
  // Relations
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  bet             Bet      @relation(fields: [betId], references: [id], onDelete: Cascade)
  parlayBets      ParlayBet[] // Can be added to multiple parlays? Or one-to-one?
  
  @@unique([userId, betId, selectedSide]) // User can't select same side twice
  @@index([userId, status])
  @@index([betId])
  @@map("user_bet_selections")
}
```

**Key Points:**
1. Users can select the same bet multiple times with different sides (e.g., Lakers in one parlay, Warriors in another)
2. Users can select the same bet+side multiple times (for different parlays)
3. `selectedSide` is always required (no nullable) - every bet type has two sides
4. Single bets are NOT parlays - they're just selections with status='selected' or 'locked'

**Final Schema Design:**

The relationship is:
1. **UserBetSelection** = User's choice of a bet + side (saved permanently)
2. **Parlay** = Collection of 2-5 UserBetSelections (direct relationship, no junction table)

**Key Points:**
- Single bets are NOT parlays - they're just UserBetSelection records with `parlayId = null`
- A UserBetSelection can only be in ONE parlay (parlayId field)
- If you want the same bet+side in multiple parlays, create multiple UserBetSelection records
- Parlay directly contains UserBetSelections (no ParlayBet table needed)

**Schema:**
```prisma
model UserBetSelection {
  id              String   @id @default(uuid())
  userId          String   @map("user_id")
  betId           String   @map("bet_id")
  selectedSide    String   @map("selected_side") @db.VarChar(50) // NOT NULL - always required
  // Values: 'participant_1', 'participant_2', 'over', 'under', 'yes', 'no'
  
  parlayId        String?  @map("parlay_id") // If null, it's a single bet (not in a parlay)
  
  status          String   @default("selected") @db.VarChar(20)
  // 'selected' - chosen but not locked yet (parlayId is null, single bet)
  // 'locked' - game started, can't modify
  // 'resolved' - bet resolved
  
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  
  // Relations
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  bet             Bet      @relation(fields: [betId], references: [id], onDelete: Cascade)
  parlay          Parlay?  @relation(fields: [parlayId], references: [id], onDelete: SetNull)
  
  @@index([userId, status])
  @@index([betId])
  @@index([parlayId])
  @@index([userId, betId, selectedSide]) // Allow same bet+side multiple times (for different parlays)
  @@map("user_bet_selections")
}

// Update Parlay model to have UserBetSelection relation
model Parlay {
  id                String   @id @default(uuid())
  userId            String   @map("user_id")
  betCount          Int      @map("bet_count") // 2-5 (derived from selections count)
  parlayValue       Int      @map("parlay_value") // +2, +4, +8, +16
  insured           Boolean  @default(false)
  insuranceCost     Int      @default(0) @map("insurance_cost")
  status            String   @default("building") @db.VarChar(20)
  lockedAt          DateTime? @map("locked_at")
  resolvedAt        DateTime? @map("resolved_at")
  lastGameEndTime   DateTime? @map("last_game_end_time")
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")

  // Relations
  user              User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  selections        UserBetSelection[] // Direct relation - parlay contains these selections
  streakHistory     StreakHistory[]

  @@index([userId, status])
  @@index([lastGameEndTime])
  @@map("parlays")
}
```

**How it works:**
1. User selects bet + side → Creates `UserBetSelection` with status='selected', parlayId=null (single bet)
2. User saves bet → Stays as single bet (parlayId remains null)
3. User creates parlay → Selects 2-5 UserBetSelections, creates `Parlay`, sets their `parlayId` to the parlay's id
4. Game starts → Status changes to 'locked' (can't modify)
5. Bet resolves → Status changes to 'resolved'

**How Parlay contains UserBetSelections:**
- A `Bet` record is just the bet definition (e.g., "Lakers points > Warriors points")
- A `UserBetSelection` is the user's choice (e.g., "I pick Lakers" = participant_1)
- A `Parlay` is a collection of 2-5 UserBetSelections (direct relation via `parlayId` field)
- When resolving a parlay, we query all UserBetSelections where `parlayId = parlay.id`
- For each selection, we know:
  - Which bet it is (from `UserBetSelection.betId`)
  - Which side the user picked (from `UserBetSelection.selectedSide`)
  - We can then check if the user's pick was correct

**Example - Single Bet (NOT a parlay):**
```
Bet: "Lakers points > Warriors points" (id: bet-123)
UserBetSelection: { 
  betId: bet-123, 
  selectedSide: 'participant_1', 
  userId: user-456, 
  parlayId: null,  // Not in a parlay - this is a single bet
  status: 'selected' 
}
// No Parlay created - this is just a single bet selection
```

**Example - Multi-Bet Parlay:**
```
Bet 1: "Lakers points > Warriors points" (id: bet-123)
Bet 2: "Steph Curry points OVER 28.5" (id: bet-456)

UserBetSelection 1: { 
  id: selection-1,
  betId: bet-123, 
  selectedSide: 'participant_1', 
  parlayId: 'parlay-789',
  status: 'locked' 
}

UserBetSelection 2: { 
  id: selection-2,
  betId: bet-456, 
  selectedSide: 'over', 
  parlayId: 'parlay-789',
  status: 'locked' 
}

Parlay: { 
  id: parlay-789, 
  userId: user-456, 
  betCount: 2, 
  parlayValue: 2,
  selections: [selection-1, selection-2] // Direct relation
}

When resolving:
1. Query UserBetSelections where parlayId = 'parlay-789'
2. For each selection, check if the user's pick was correct
3. If all picks correct → Parlay wins, add parlayValue to streak
4. If any pick wrong → Parlay loses, reset streak (unless insured)
```

---

## API Endpoints

### POST `/api/bets/:betId/select`

Create a user bet selection (single bet, NOT a parlay).

**Request:**
```typescript
{
  selectedSide: string; // REQUIRED - 'participant_1', 'participant_2', 'over', 'under', 'yes', 'no'
}
```

**Response:**
```typescript
{
  success: boolean;
  data: {
    selection: {
      id: string;
      betId: string;
      selectedSide: string;
      status: string; // 'selected' (single bet, not in parlay)
      createdAt: string;
    };
  };
}
```

**Validation:**
- User must be authenticated
- Bet must exist and be available (outcome='pending', visibleFrom in past or null)
- Game must not have started yet (can't select bets for games in progress)
- For COMPARISON: selectedSide must be 'participant_1' or 'participant_2'
- For THRESHOLD: selectedSide must be 'over' or 'under'
- For EVENT: selectedSide must be 'yes' or 'no'

### GET `/api/bets/my-selections`

Get all user's bet selections (for building parlays later).

**Query Params:**
- `status`: Filter by status ('selected', 'in_parlay', 'locked')
- `parlayId`: Filter by parlay ID

**Response:**
```typescript
{
  success: boolean;
  data: {
    selections: Array<{
      id: string;
      bet: {
        id: string;
        displayText: string;
        betType: string;
        config: any;
      };
      selectedSide: string | null;
      status: string;
      parlayId?: string;
      createdAt: string;
    }>;
  };
}
```

### DELETE `/api/bets/selections/:selectionId`

Delete a bet selection (only if status='selected', not yet in a parlay).

---

## UI/UX Flow

### Today's Bets Page

**Current State:**
- Shows available bets as clickable cards
- Clicking opens signup modal (for non-users)

**New Flow:**
1. Each bet displays as **two clickable cards** (one for each side)
   - **COMPARISON:** Card 1 = "Participant 1" (e.g., "Lakers"), Card 2 = "Participant 2" (e.g., "Warriors")
   - **THRESHOLD:** Card 1 = "OVER [threshold]", Card 2 = "UNDER [threshold]"
   - **EVENT:** Card 1 = "YES", Card 2 = "NO"
2. User clicks on one of the two cards
3. Card highlights (visual feedback - border, background color change, etc.)
4. **"Save Bet" button appears** (below the bet cards or in a fixed position)
5. User clicks "Save Bet"
6. API call creates `UserBetSelection` with status='selected'
7. Show success message: "Bet saved! You can add it to a parlay later."
8. **Future:** "Start Parlay" button will also appear (for building multi-bet parlays)

**Visual Design:**
- Two cards side-by-side for each bet
- Hover states for interactivity
- Selected state (highlighted border/background)
- "Save Bet" button appears when a card is selected
- Button disabled if game has started

### Bet Selection Card Component

**Component:** `BetSelectionCard` (replaces modal approach)

**Props:**
```typescript
interface BetSelectionCardProps {
  bet: Bet;
  game: Game;
  onSelect: (selectedSide: string) => Promise<void>;
  isSelected?: boolean; // Is this side currently selected?
  disabled?: boolean; // Is selection disabled (game started)?
}
```

**Behavior:**
- Renders as a clickable card
- Shows the side label (e.g., "Lakers", "OVER 28.5", "YES")
- Highlights when clicked/selected
- Triggers parent component to show "Save Bet" button
- Shows loading state during API call
- Shows error messages if selection fails

**Parent Component:** `BetSelectionGroup`
- Renders two `BetSelectionCard` components side-by-side
- Manages selected state
- Shows "Save Bet" button when a card is selected
- Handles the save action

---

## Implementation Plan

### Phase 1: Database Schema (MVP)
1. Create `UserBetSelection` table with `selectedSide` (NOT NULL) and `parlayId` (nullable)
2. Update `Parlay` model to have `UserBetSelection[]` relation (remove old `ParlayBet` relation)
3. Remove or deprecate `ParlayBet` table (Parlay directly contains UserBetSelections)
4. Update `User` model to include `UserBetSelection[]` relation
5. Run migration

### Phase 2: Backend API (MVP)
1. Create `POST /api/bets/:betId/select` endpoint
2. Validate bet availability, user authentication, and game hasn't started
3. Validate `selectedSide` based on bet type
4. Create `UserBetSelection` record with status='selected'
5. Return selection data (NO parlay creation - single bets are not parlays)

### Phase 3: Frontend UI (MVP)
1. Create `BetSelectionCard` component (clickable card for one side)
2. Create `BetSelectionGroup` component (renders two cards + save button)
3. Update `TodaysBets` page to show two cards per bet instead of one
4. Handle card selection and highlighting
5. Show "Save Bet" button when card is selected
6. Handle save action and show success/error messages
7. Update UI to show saved bets differently (optional - show which bets user has selected)

### Phase 4: Testing & Refinement
1. Test all bet types
2. Test edge cases (bet no longer available, game started, etc.)
3. Test admin users can select bets
4. Verify parlay creation works correctly

---

## Clarifications Made

1. **THRESHOLD bets:** Users choose OVER or UNDER (two sides, like other bet types) ✓
   
2. **Multiple selections:** Users can select same bet multiple times (for different parlays) ✓
   
3. **Single bets:** Single bets are NOT parlays - they're just `UserBetSelection` records ✓
   
4. **Selection status:** Status='selected' for single bets (not in a parlay) ✓
   
5. **Parlay relationship:** Parlay directly contains UserBetSelections via `parlayId` field (no ParlayBet table) ✓
   
6. **UI Design:** Two clickable cards per bet (one for each side), "Save Bet" button appears on selection ✓

---

## Decisions Made

1. **Schema Approach:** 
   - `UserBetSelection` stores user's bet + side choice (always has a side)
   - `Parlay` directly contains UserBetSelections via `parlayId` field (no ParlayBet table)
   - Single bets are NOT parlays - they're just `UserBetSelection` with `parlayId = null`

2. **MVP Scope:** 
   - Users can save single bet selections (not in parlays)
   - Parlay building will come later
   - Special UI for single bets vs parlays

3. **THRESHOLD bets:** Users choose OVER or UNDER (two sides, like other bet types)

4. **Multiple selections:** Allowed (user can select same bet+side multiple times for different parlays)

5. **Admin access:** Admins play identically to regular users (no special handling)

6. **UI Design:** Two clickable cards per bet (one for each side), "Save Bet" button appears when a card is selected

---

## Next Steps

1. Review and approve this design document
2. Clarify any open questions
3. Implement Phase 1 (Database Schema)
4. Implement Phase 2 (Backend API)
5. Implement Phase 3 (Frontend UI)
6. Test and iterate

