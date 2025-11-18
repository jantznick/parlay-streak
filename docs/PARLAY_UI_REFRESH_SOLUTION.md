# Parlay Builder UI Refresh Solution

## Problem Statement

Currently, the "My Bets" section immediately reflects all parlay changes (creating, adding bets, removing bets) even while the parlay builder is open. This creates a confusing UX where:

1. Converting a single bet to a parlay immediately removes it from "My Bets" and shows the parlay
2. Adding/removing bets from a parlay immediately updates the "My Bets" display
3. Users see changes before they've explicitly saved the parlay

## Desired Behavior

The "My Bets" section should only update when:
- ✅ User explicitly clicks "Save Parlay" 
- ✅ User deletes a parlay (via "Delete Parlay" button)
- ✅ User closes a 1-bet parlay (converts back to single bet - this is an exception)
- ✅ User saves a single bet (not in builder)

The "My Bets" section should NOT update when:
- ❌ Starting a new parlay (from single bet or new selection)
- ❌ Adding a bet to an existing parlay
- ❌ Removing a bet from a parlay
- ❌ Toggling insurance
- ❌ Opening an existing parlay (unless it's being deleted/converted)

**Visual Indicator**: When a bet is in the parlay builder, it should remain visible in "My Bets" but with an overlay/indicator showing it's "In Parlay Builder" or similar. This provides visual feedback without hiding the bet.

## Solution Approach

### Option 1: Suppress Refresh When Builder is Open (Recommended)

**Concept**: Track whether the parlay builder is open, and suppress `triggerRefresh()` calls when it is. Only allow refresh when:
- Builder is closed AND parlay was saved
- Builder is closed AND parlay was deleted
- Builder is closed AND 1-bet parlay was converted back

**Implementation**:
1. Modify `BetsContext` to accept an optional `suppressRefresh` flag
2. Modify `MyBetsSection` to check `isParlayBuilderOpen` before refreshing
3. Remove `triggerRefresh()` calls from:
   - `performStartParlay` in `BetSelectionGroup` and `MyBetsSection`
   - `handleAddToParlay` in `BetSelectionGroup`
   - `handleRemoveSelection` in `ParlayBuilder` (unless parlay is deleted)
   - `handleToggleInsurance` in `ParlayBuilder`
4. Keep `triggerRefresh()` calls in:
   - `handleSaveParlay` in `ParlayBuilder` (after closing builder)
   - `performDeleteParlay` in `ParlayBuilder` (after deletion)
   - `handleClose` in `ParlayBuilder` (for 1-bet parlay conversion)
   - `handleSave` in `BetSelectionGroup` (single bet save)

**Edge Cases Handled**:
- ✅ Converting single bet to parlay: Single bet stays visible with "In Parlay Builder" overlay, parlay doesn't appear until saved
- ✅ Adding bet to parlay: Bet stays visible with overlay, no UI refresh until saved
- ✅ Removing bet from parlay: Overlay removed, bet returns to normal state, no UI refresh until saved (unless parlay is deleted)
- ✅ Closing builder without saving: 1-bet parlays convert back (refresh happens, overlay removed), multi-bet parlays stay as-is (no refresh needed since they weren't shown)
- ✅ Opening existing parlay: No refresh (parlay already exists in "My Bets"), bets in parlay show overlay
- ✅ Deleting parlay: Refresh happens immediately (user explicitly deleted), overlays removed

### Option 2: Track "Saved" State (More Complex)

**Concept**: Add a `parlaySaved` flag to `ParlayContext` that tracks whether the current parlay has been explicitly saved. Only refresh when this flag is true.

**Pros**: More explicit control
**Cons**: More state management, need to track when parlay becomes "unsaved" (e.g., after modifications)

## Recommended Implementation (Option 1)

### Changes Required

1. **`MyBetsSection.tsx`**:
   - Modify `useEffect` that watches `refreshTrigger` to also check `isParlayBuilderOpen`
   - Only refresh if builder is closed OR if it's a non-parlay operation
   - **NEW**: Add visual overlay/indicator to bets that are in the active parlay
     - Check if a bet's `selectionId` or `betId` matches any selection in `activeParlay.selections`
     - Apply overlay styling (e.g., semi-transparent overlay with "In Parlay Builder" text)
     - Style: Could be a badge, border highlight, or overlay div with reduced opacity

2. **`BetSelectionGroup.tsx`**:
   - Remove `triggerRefresh()` from `performStartParlay` (line ~176)
   - Remove `triggerRefresh()` from `handleAddToParlay` (line ~246)
   - Keep `triggerRefresh()` in `handleSave` (single bet save)

3. **`MyBetsSection.tsx`**:
   - Remove `await fetchMyData()` from `performStartParlay` (line ~168)
   - Remove `await fetchMyData()` from `performOpenParlay` (line ~130) - parlay already exists
   - Keep refresh logic for delete operations
   - **NEW**: Add helper function to check if a bet is in the active parlay:
     ```typescript
     const isBetInActiveParlay = (selectionId: string, betId: string): boolean => {
       if (!activeParlay || !isParlayBuilderOpen) return false;
       return activeParlay.selections.some(
         sel => sel.id === selectionId || sel.bet.id === betId
       );
     };
     ```

4. **`ParlayBuilder.tsx`**:
   - Remove `triggerRefresh()` from `handleRemoveSelection` (lines ~105, ~109) - unless parlay is deleted
   - Remove `triggerRefresh()` from `handleToggleInsurance` (if any)
   - Keep `triggerRefresh()` in `handleSaveParlay` (line ~162) - after closing
   - Keep `triggerRefresh()` in `handleClose` (line ~179, ~187) - for 1-bet conversion
   - Keep `triggerRefresh()` in `performDeleteParlay` (line ~201) - after deletion

### Special Handling

**1-bet Parlay Conversion**: When closing a 1-bet parlay, we DO want to refresh immediately because:
- The parlay is being converted back to a single bet
- This is an explicit user action (closing the builder)
- The single bet should appear in "My Bets" right away

**Parlay Deletion**: When deleting a parlay, we DO want to refresh immediately because:
- This is an explicit user action
- The parlay should disappear from "My Bets" right away

## Edge Cases

1. **User starts parlay, adds bets, closes without saving**: 
   - Parlay exists in DB but not shown in "My Bets"
   - Bets show overlay while builder is open
   - When builder closes, overlays are removed (bets return to normal state)
   - When user opens builder again, parlay should be loaded and overlays reapplied
   - **Solution**: When opening builder, check if there's an unsaved parlay for this user, apply overlays

2. **User converts single bet to parlay, closes builder without saving**:
   - Single bet is now in a parlay in DB
   - Overlay is removed when builder closes
   - Single bet should reappear in "My Bets" without overlay
   - **Solution**: `handleClose` for 1-bet parlays already handles this, overlay state is managed by `activeParlay`

3. **User has unsaved parlay, refreshes page**:
   - Unsaved parlay exists in DB
   - Should it appear in "My Bets"?
   - **Decision**: Yes, because it exists in DB. User can open it and continue editing. Overlays only show when builder is open.

4. **User starts parlay from "Today's Bets", then closes builder**:
   - Bet selection was created and linked to parlay
   - Overlay shows while builder is open
   - Should it appear as single bet or parlay?
   - **Solution**: If 1-bet parlay, convert back (overlay removed). If 2+ bets, leave as-is (parlay exists but not shown until saved, overlay removed when builder closes)

5. **Multiple bets in parlay builder**:
   - All bets in the active parlay should show the overlay
   - Overlay should clearly indicate they're part of the same parlay
   - **Solution**: Use the same overlay style for all bets in `activeParlay.selections`

## Implementation Notes

- The parlay builder will continue to show real-time updates (bet count, insurance, etc.)
- Only the "My Bets" section will be suppressed from refreshing
- Backend operations continue to work normally (all changes are saved immediately)
- This is purely a UI/UX improvement
- Overlay styling suggestions:
  - Semi-transparent overlay (e.g., `bg-blue-900/20` or `bg-slate-800/30`)
  - Border highlight (e.g., `border-2 border-blue-500`)
  - Badge/indicator (e.g., small badge saying "In Builder" or "Building Parlay")
  - Could combine: border highlight + badge + slight opacity reduction
  - Should be visually distinct but not overwhelming

