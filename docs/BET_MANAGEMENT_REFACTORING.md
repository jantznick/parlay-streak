# BetManagement Component Refactoring Plan

## Overview
This document outlines refactoring opportunities for the `BetManagement.tsx` component to improve code organization, reusability, and maintainability without changing any functionality or user experience.

## Completed Refactorings

### ✅ formatDateDisplay Function
- **Status**: Completed
- **Change**: Moved `formatDateDisplay` function into `DateNavigation` component and exported it
- **Impact**: Eliminates code duplication across `MyBetsSection`, `BetManagement`, and `AvailableBetsSection`
- **Files Modified**:
  - `frontend/src/components/dashboard/DateNavigation.tsx` - Added and exported function
  - `frontend/src/components/dashboard/MyBetsSection.tsx` - Removed duplicate, imports from DateNavigation
  - `frontend/src/pages/admin/BetManagement.tsx` - Removed duplicate, imports from DateNavigation
  - `frontend/src/components/dashboard/AvailableBetsSection.tsx` - Removed prop, imports from DateNavigation

### ✅ Utility Functions Extraction
- **Status**: Completed
- **Change**: Extracted formatting and helper functions to `frontend/src/utils/formatting.ts`
- **Functions Extracted**:
  - `formatDate(dateString: string)` - Formats date for display
  - `formatTime(dateString: string)` - Formats time for display
  - `getTeamName(participant: any, game: Game)` - Gets team name from participant
  - `formatResolvedBetText(bet: Bet, game: Game)` - Formats resolved bet text
- **Impact**: High reusability, easier to test, consistent formatting across the app
- **Files Modified**:
  - `frontend/src/utils/formatting.ts` - New file with all utility functions
  - `frontend/src/pages/admin/BetManagement.tsx` - Removed local functions, imports from utils

### ✅ Delete Confirmation Modal Enhancement
- **Status**: Completed
- **Change**: Enhanced existing `ConfirmModal` component to support custom content via `children` prop, then replaced inline delete modal in `BetManagement`
- **Impact**: Reusable modal component, consistent styling, easier to maintain
- **Files Modified**:
  - `frontend/src/components/common/ConfirmModal.tsx` - Added `children` prop support
  - `frontend/src/pages/admin/BetManagement.tsx` - Replaced inline modal with `ConfirmModal` component

### ✅ Bet List Item Component
- **Status**: Completed
- **Change**: Extracted individual bet item rendering into `BetListItem` component
- **Impact**: Reduced `BetManagement.tsx` complexity, better code organization, reusable component
- **Files Created**:
  - `frontend/src/components/admin/BetListItem.tsx` - New component for bet list items
- **Files Modified**:
  - `frontend/src/pages/admin/BetManagement.tsx` - Replaced inline bet item rendering with `BetListItem` component

## Planned Refactorings

### 1. Utility Functions Extraction
**Priority**: High  
**Complexity**: Low  
**Impact**: High reusability

Extract formatting and helper functions to a shared utilities file.

**Functions to Extract**:
- `formatDate(dateString: string)` - Formats date for display
- `formatTime(dateString: string)` - Formats time for display
- `getTeamName(participant: any, game: Game)` - Gets team name from participant
- `formatResolvedBetText(bet: Bet, game: Game)` - Formats resolved bet text

**New File**: `frontend/src/utils/formatting.ts`

**Benefits**:
- Reusable across multiple components
- Easier to test in isolation
- Consistent formatting across the app

---

### 2. Delete Confirmation Modal Component
**Priority**: High  
**Complexity**: Low  
**Impact**: Medium reusability

Extract the delete confirmation modal into a reusable component.

**Current Location**: Lines 850-880 in `BetManagement.tsx`

**New Component**: `frontend/src/components/common/ConfirmModal.tsx`

**Props Interface**:
```typescript
interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmButtonClass?: string;
  onConfirm: () => void;
  onCancel: () => void;
  children?: React.ReactNode; // For custom content (bet details, etc.)
}
```

**Benefits**:
- Reusable for other confirmation dialogs
- Consistent modal styling
- Easier to maintain

---

### 3. Game Card Component
**Priority**: Medium  
**Complexity**: Medium  
**Impact**: High code organization

Extract the entire game card rendering logic into a separate component.

**Current Location**: Lines 636-822 in `BetManagement.tsx`

**New Component**: `frontend/src/components/admin/GameCard.tsx`

**Props Interface**:
```typescript
interface GameCardProps {
  game: Game;
  isExpanded: boolean;
  onToggle: (gameId: string) => void;
  onCreateBets: (game: Game) => void;
  onQuickMoneyline: (game: Game) => void;
  onEditBet: (bet: Bet, game: Game) => void;
  onDeleteBet: (bet: Bet, game: Game) => void;
  onResolveBet: (bet: Bet) => void;
  onMoveBetPriority: (gameId: string, betId: string, direction: 'up' | 'down') => void;
  creatingMoneyline: string | null;
  loadingRoster: boolean;
  resolvingBet: string | null;
}
```

**Benefits**:
- Reduces `BetManagement.tsx` from ~920 lines to ~400 lines
- Easier to test game card logic in isolation
- Better separation of concerns

---

### 4. Bet List Item Component
**Priority**: Medium  
**Complexity**: Low  
**Impact**: Medium code organization

Extract individual bet item rendering from the game card.

**Current Location**: Lines 726-813 in `BetManagement.tsx`

**New Component**: `frontend/src/components/admin/BetListItem.tsx`

**Props Interface**:
```typescript
interface BetListItemProps {
  bet: Bet;
  game: Game;
  index: number;
  totalBets: number;
  onEdit: (bet: Bet, game: Game) => void;
  onDelete: (bet: Bet, game: Game) => void;
  onResolve: (bet: Bet) => void;
  onMovePriority: (gameId: string, betId: string, direction: 'up' | 'down') => void;
  resolvingBet: string | null;
  formatResolvedBetText: (bet: Bet, game: Game) => string;
}
```

**Benefits**:
- Further reduces component complexity
- Reusable if bet lists appear elsewhere
- Easier to style and maintain

---

### 5. Filter Controls Component
**Priority**: Low  
**Complexity**: Low  
**Impact**: Low (only used in BetManagement)

Extract the sport/league selectors and fetch buttons into a separate component.

**Current Location**: Lines 556-601 in `BetManagement.tsx`

**New Component**: `frontend/src/components/admin/GameFilters.tsx`

**Props Interface**:
```typescript
interface GameFiltersProps {
  selectedDate: string;
  sportsConfig: SportConfig[];
  selectedSport: string;
  selectedLeague: string;
  onSportChange: (sport: string) => void;
  onLeagueChange: (league: string) => void;
  onFetchGames: (force: boolean) => void;
  loading: boolean;
  gamesCount: number;
  formatDate: (dateString: string) => string;
}
```

**Benefits**:
- Cleaner main component
- Could be reused if filter UI is needed elsewhere
- Easier to modify filter logic

---

## Implementation Order

1. ✅ **formatDateDisplay** - Completed
2. ✅ **Utility Functions** - Completed
3. ✅ **Delete Confirmation Modal** - Completed
4. ✅ **Bet List Item Component** - Completed
5. **Game Card Component** - Larger refactor, high impact (Pending)
6. **Filter Controls Component** - Lower priority, nice to have (Pending)

## Summary

**Completed**: 4 out of 6 planned refactorings
- Reduced code duplication
- Improved code organization
- Enhanced component reusability
- Maintained 100% functionality and UX compatibility

**Remaining**: 2 refactorings (Game Card and Filter Controls) - can be done as needed

## Testing Checklist

After each refactoring:
- [ ] All existing functionality works identically
- [ ] No visual/UX changes
- [ ] No console errors
- [ ] TypeScript compilation succeeds
- [ ] Linter passes
- [ ] Manual testing of affected features

## Notes

- All refactorings maintain 100% backward compatibility
- No changes to API calls or data structures
- All styling remains identical
- Component interfaces may change internally but external behavior is unchanged

