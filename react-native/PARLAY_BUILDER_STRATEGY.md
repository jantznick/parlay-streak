# Mobile Parlay Builder - Implementation Strategy

## Overview
Build a native-feeling parlay builder for the React Native app that mirrors the web functionality while being optimized for mobile UX.

---

## Stages

### Stage 1: Foundation & Bottom Sheet
**Goal**: Set up the core parlay builder UI component

- [ ] Install bottom sheet library (react-native-reanimated + @gorhom/bottom-sheet)
- [ ] Create `ParlayBuilder.tsx` bottom sheet component
- [ ] Basic open/close functionality triggered by `isParlayBuilderOpen`
- [ ] Display active parlay data (bet count, value, 5 slots)
- [ ] Cancel button (converts 1-bet parlay back to single bet)
- [ ] Close/minimize behavior

### Stage 2: Start Parlay Flow  
**Goal**: Enable starting a new parlay from Available Bets

- [ ] Update `BetSelectionGroup.tsx` to show "Start Parlay" button
- [ ] Integrate with `ParlayContext` 
- [ ] Call `api.startParlay()` when starting fresh
- [ ] Open builder when parlay is created
- [ ] Toast notification on success

### Stage 3: Add to Parlay Flow
**Goal**: Enable adding bets to an open parlay

- [ ] Update `BetSelectionGroup.tsx` to detect open builder
- [ ] Show "Add to Parlay" instead of "Start Parlay" when builder is open
- [ ] Call `api.addSelectionToParlay()` 
- [ ] Update builder UI with new selection
- [ ] Handle max 5 bets limit

### Stage 4: Parlay Management in Builder
**Goal**: Full parlay editing capabilities

- [ ] Remove bet from parlay (X button on each slot)
- [ ] Handle parlay deletion when last bet removed
- [ ] Insurance toggle (for 4+ leg parlays)
- [ ] "Save Parlay" button (closes builder, triggers refresh)
- [ ] "Delete Parlay" button with confirmation

### Stage 5: Display Parlays in My Picks
**Goal**: Show saved parlays in the dashboard

- [ ] Create `ParlayCard.tsx` component for displaying parlays
- [ ] Fetch parlays in Dashboard (2+ legs only in list)
- [ ] "Open" button to edit existing parlay
- [ ] Visual distinction from single bets (blue gradient styling)
- [ ] Show parlay status (locked, win, loss indicators)

### Stage 6: Convert Existing Bet to Parlay
**Goal**: "Make Parlay" button on single bets

- [ ] Add "Make Parlay" button to single bet cards in My Picks
- [ ] Call `api.startParlay()` with `existingSelectionId`
- [ ] Open builder with converted parlay
- [ ] Bet disappears from singles, appears in builder

### Stage 7: Polish & Edge Cases
**Goal**: Handle all edge cases and refine UX

- [ ] "In Builder" overlay for bets currently in active parlay
- [ ] Handle builder already open when starting new parlay (warning)
- [ ] Handle builder already open when opening different parlay (warning)
- [ ] Proper refresh triggers
- [ ] Loading states
- [ ] Error handling with toasts

---

## Technical Decisions

### Bottom Sheet Library
**Recommendation**: `@gorhom/bottom-sheet`
- Most popular and well-maintained
- Works with Expo
- Smooth animations via reanimated
- Snap points for partial/full expansion
- Requires: `react-native-reanimated`, `react-native-gesture-handler`

### State Management
- Use existing `ParlayContext` for:
  - `activeParlay` - current parlay being built
  - `isParlayBuilderOpen` - controls bottom sheet visibility
  - `refreshActiveParlay()` - re-fetch parlay data
- Use existing `BetsContext` for:
  - `triggerRefresh()` - refresh My Picks after save/delete

### API Calls (already in api.ts)
- `api.startParlay(betId, selectedSide, existingSelectionId?)`
- `api.addSelectionToParlay(parlayId, betId, selectedSide)`
- `api.removeSelectionFromParlay(parlayId, selectionId)`
- `api.updateParlay(parlayId, { insured })`
- `api.deleteParlay(parlayId)`
- `api.getParlays(status, includeSelections, date, timezoneOffset)`
- `api.getParlay(parlayId)`

### Visual Design
- Bottom sheet with dark theme (slate-900 background)
- Orange accent color for primary actions
- Blue accent for parlay-specific elements
- 5 bet slots (filled with selection or empty dashed)
- Parlay value display
- Insurance toggle (switch component)

---

## File Structure

```
react-native/src/
├── components/
│   ├── parlay/
│   │   └── ParlayBuilder.tsx      # Bottom sheet parlay builder
│   └── bets/
│       └── ParlayCard.tsx         # Parlay display card in My Picks
├── context/
│   ├── ParlayContext.tsx          # Already exists
│   └── BetsContext.tsx            # Already exists
└── pages/
    └── Dashboard.tsx              # Updates to integrate parlay features
```

---

## Dependencies to Install

```bash
npx expo install react-native-reanimated react-native-gesture-handler @gorhom/bottom-sheet
```

**Note**: May need babel config update for reanimated.

---

## Success Criteria

1. User can start a parlay from Available Bets
2. User can add bets to an open parlay (up to 5)
3. User can remove bets from parlay in builder
4. User can toggle insurance on 4+ leg parlays
5. User can save parlay (closes builder, appears in My Picks)
6. User can cancel/delete parlay
7. User can convert existing single bet to parlay
8. User can open and edit existing parlays
9. All actions use toast notifications (no native alerts)
10. Smooth, native-feeling bottom sheet animations

