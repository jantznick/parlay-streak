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
**Example:** "LeBron James points OVER 28.5"

**User Choice:** The bet already has OVER/UNDER defined by admin
- User just selects this bet (no side choice needed)
- The operator (OVER/UNDER) is part of the bet definition

**Alternative Approach (if needed):** Could allow user to choose OVER/UNDER, but this would require creating two separate bet options. For MVP, we'll assume the bet is fixed.

**Storage:** No side selection needed, just bet selection

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

**Questions to Resolve:**
1. Can a user select the same bet multiple times with different sides? (e.g., Lakers in one parlay, Warriors in another)
2. Should `selectedSide` be nullable for THRESHOLD bets, or use a default value?
3. Should we allow users to have multiple selections of the same bet (for different parlays)?

**Proposed Answer:**
- Yes, users can select the same bet multiple times (for different parlays)
- `selectedSide` can be nullable for THRESHOLD bets
- Multiple selections allowed (remove unique constraint, or make it `[userId, betId, selectedSide, parlayId]`)

**Revised Schema:**
```prisma
model UserBetSelection {
  id              String   @id @default(uuid())
  userId          String   @map("user_id")
  betId           String   @map("bet_id")
  selectedSide    String?  @map("selected_side") @db.VarChar(50)
  status          String   @default("selected") @db.VarChar(20)
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  bet             Bet      @relation(fields: [betId], references: [id], onDelete: Cascade)
  parlayBets      ParlayBet[]
  
  @@index([userId, status])
  @@index([betId])
  @@map("user_bet_selections")
}
```

**Note:** The relationship with `ParlayBet` needs clarification. Should `UserBetSelection` be the link, or should `ParlayBet` reference `UserBetSelection`? Or should they be separate?

**Proposed Approach:**
- `UserBetSelection` represents the user's choice (which side)
- `ParlayBet` links a parlay to a bet, and references the `UserBetSelection` to know which side was chosen
- This allows: User selects bet → Creates selection → Adds selection to parlay

**Updated Schema:**
```prisma
model UserBetSelection {
  id              String   @id @default(uuid())
  userId          String   @map("user_id")
  betId           String   @map("bet_id")
  selectedSide    String?  @map("selected_side") @db.VarChar(50)
  status          String   @default("selected") @db.VarChar(20)
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  bet             Bet      @relation(fields: [betId], references: [id], onDelete: Cascade)
  parlayBets      ParlayBet[] // Links to parlays this selection is in
  
  @@index([userId, status])
  @@index([betId])
  @@map("user_bet_selections")
}

// Update ParlayBet to reference UserBetSelection
model ParlayBet {
  id                    String   @id @default(uuid())
  parlayId              String   @map("parlay_id")
  userBetSelectionId    String   @map("user_bet_selection_id") // Reference to user's selection
  createdAt             DateTime @default(now()) @map("created_at")

  parlay                Parlay           @relation(fields: [parlayId], references: [id], onDelete: Cascade)
  userBetSelection      UserBetSelection @relation(fields: [userBetSelectionId], references: [id], onDelete: Cascade)

  @@unique([parlayId, userBetSelectionId])
  @@index([parlayId])
  @@index([userBetSelectionId])
  @@map("parlay_bets")
}
```

**Wait, this creates a circular dependency issue. Let me reconsider...**

**Better Approach:**
- Keep `ParlayBet` as is (links parlay to bet)
- Add `selectedSide` to `ParlayBet` to store the user's choice
- `UserBetSelection` is just for tracking selections before they're in parlays (optional, for "cart" functionality)

**Simpler Schema:**
```prisma
model UserBetSelection {
  id              String   @id @default(uuid())
  userId          String   @map("user_id")
  betId           String   @map("bet_id")
  selectedSide    String?  @map("selected_side") @db.VarChar(50)
  status          String   @default("selected") @db.VarChar(20) // 'selected', 'in_parlay', 'locked'
  parlayId        String?  @map("parlay_id") // Which parlay this is in (if any)
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")
  
  user            User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  bet             Bet      @relation(fields: [betId], references: [id], onDelete: Cascade)
  parlay          Parlay?  @relation(fields: [parlayId], references: [id], onDelete: SetNull)
  
  @@index([userId, status])
  @@index([betId])
  @@index([parlayId])
  @@map("user_bet_selections")
}

// Update ParlayBet to reference UserBetSelection instead of just Bet
model ParlayBet {
  id                    String   @id @default(uuid())
  parlayId              String   @map("parlay_id")
  userBetSelectionId    String   @map("user_bet_selection_id") // Links to user's selection
  createdAt             DateTime @default(now()) @map("created_at")

  parlay                Parlay           @relation(fields: [parlayId], references: [id], onDelete: Cascade)
  userBetSelection      UserBetSelection @relation(fields: [userBetSelectionId], references: [id], onDelete: Cascade)

  @@unique([parlayId, userBetSelectionId])
  @@index([parlayId])
  @@index([userBetSelectionId])
  @@map("parlay_bets")
}
```

**Actually, let me simplify even more for MVP:**

For single bets (MVP), we can create a parlay immediately with one bet. So:
1. User selects bet and side
2. Create `UserBetSelection` with status='in_parlay'
3. Create `Parlay` with 1 bet
4. Create `ParlayBet` linking parlay to the selection

This works for MVP. Later, we can add "cart" functionality where users build selections before creating parlays.

---

## API Endpoints

### POST `/api/bets/:betId/select`

Create a user bet selection (and optionally create a single-bet parlay immediately).

**Request:**
```typescript
{
  selectedSide?: string; // 'participant_1', 'participant_2', 'yes', 'no', or null for THRESHOLD
  createParlay?: boolean; // If true, immediately create a 1-bet parlay (default: true for MVP)
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
      selectedSide: string | null;
      status: string;
      parlayId?: string; // If parlay was created
    };
    parlay?: {
      id: string;
      betCount: number;
      parlayValue: number;
      status: string;
    };
  };
}
```

**Validation:**
- User must be authenticated
- Bet must exist and be available (outcome='pending', visibleFrom in past or null)
- For COMPARISON: selectedSide must be 'participant_1' or 'participant_2'
- For EVENT: selectedSide must be 'yes' or 'no'
- For THRESHOLD: selectedSide should be null (or ignored)

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
1. User clicks on a bet card
2. **If COMPARISON bet:** Modal opens showing:
   - Bet display text
   - Two buttons: "Participant 1" and "Participant 2" (with names)
   - If spread: Show spread details
   - "Select" button
3. **If THRESHOLD bet:** Modal opens showing:
   - Bet display text
   - "Select This Bet" button (no side choice)
4. **If EVENT bet:** Modal opens showing:
   - Bet display text
   - Two buttons: "YES" and "NO"
   - "Select" button
5. User selects side and clicks "Select"
6. **For MVP (single bets):** Immediately creates 1-bet parlay
   - Show success message: "Bet added! Your parlay is locked when the game starts."
   - Optionally show parlay details
7. **Future (parlay building):** Add to "My Selections" cart
   - Show success: "Bet added to your selections"
   - Show cart count badge

### Bet Selection Modal Component

**Props:**
```typescript
interface BetSelectionModalProps {
  bet: Bet;
  game: Game;
  onClose: () => void;
  onSelect: (selectedSide: string | null) => Promise<void>;
}
```

**Behavior:**
- Renders different UI based on bet type
- Handles side selection
- Calls `onSelect` with the selected side
- Shows loading state during API call
- Shows error messages if selection fails

---

## Implementation Plan

### Phase 1: Database Schema (MVP)
1. Create `UserBetSelection` table
2. Update `ParlayBet` to reference `UserBetSelection` (or add `selectedSide` to `ParlayBet`)
3. Run migration

### Phase 2: Backend API (MVP)
1. Create `POST /api/bets/:betId/select` endpoint
2. Validate bet availability and user authentication
3. Create `UserBetSelection` record
4. Create 1-bet `Parlay` immediately
5. Create `ParlayBet` linking parlay to selection
6. Return selection and parlay data

### Phase 3: Frontend UI (MVP)
1. Create `BetSelectionModal` component
2. Update `TodaysBets` page to open modal on bet click
3. Handle different bet types in modal
4. Show success/error messages
5. Optionally show created parlay details

### Phase 4: Testing & Refinement
1. Test all bet types
2. Test edge cases (bet no longer available, game started, etc.)
3. Test admin users can select bets
4. Verify parlay creation works correctly

---

## Open Questions

1. **THRESHOLD bets:** Should users be able to choose OVER/UNDER, or is the bet fixed?
   - **Proposed:** Bet is fixed (admin sets OVER/UNDER), user just selects it
   
2. **Multiple selections:** Can user select same bet multiple times?
   - **Proposed:** Yes, for different parlays
   
3. **Parlay creation timing:** For MVP, create parlay immediately or allow building?
   - **Proposed:** Create immediately for MVP (single-bet parlays)
   
4. **Selection status:** Do we need 'selected' status, or go straight to 'in_parlay'?
   - **Proposed:** For MVP, go straight to 'in_parlay' (parlay created immediately)
   
5. **ParlayBet relationship:** Should `ParlayBet` reference `UserBetSelection` or just `Bet`?
   - **Proposed:** Reference `UserBetSelection` to know which side was chosen

---

## Decisions Made

1. **Schema Approach:** Use `UserBetSelection` table to store user's side choice, then link to parlays via `ParlayBet`
2. **MVP Scope:** Create 1-bet parlays immediately (no cart/building phase yet)
3. **THRESHOLD bets:** No side selection needed (bet is fixed)
4. **Multiple selections:** Allowed (user can select same bet for different parlays)
5. **Admin access:** Admins play identically to regular users (no special handling)

---

## Next Steps

1. Review and approve this design document
2. Clarify any open questions
3. Implement Phase 1 (Database Schema)
4. Implement Phase 2 (Backend API)
5. Implement Phase 3 (Frontend UI)
6. Test and iterate

