# Parlay Routes Refactoring Plan

## Overview
This document outlines refactoring opportunities in `backend/src/routes/parlay.routes.ts` to reduce code duplication and improve maintainability.

## Identified Issues

### 1. Repeated Validation Patterns
- **User authentication check**: Appears in every route handler (lines 69-74, 288-293, 535-540, 718-723, 812-817, 891-896, 1101-1106)
- **Parlay ownership check**: Repeated 5 times (lines 310-315, 557-562, 841-846, 928-933, 1120-1125)
- **Parlay locked check**: Repeated 4 times (lines 318-323, 564-570, 936-941, 1128-1133)
- **Game started check**: Repeated 4 times (lines 130-135, 170-175, 370-375, 416-421, 944-950)

### 2. Duplicated Selection/Bet Validation Logic
- **Selection validation**: The logic for validating an existing selection (existence, ownership, already in parlay, game started) is duplicated in:
  - `/start` route (lines 96-135)
  - `/:parlayId/add-selection` route (lines 336-375)
- **Bet validation**: The logic for validating a new bet (existence, availability, visibility, game started, selectedSide) is duplicated in:
  - `/start` route (lines 137-186)
  - `/:parlayId/add-selection` route (lines 377-432)

### 3. Repeated Parlay Response Formatting
- The parlay response mapping is repeated 5 times:
  - Lines 252-266 (POST `/start`)
  - Lines 500-515 (POST `/:parlayId/add-selection`)
  - Lines 682-697 (DELETE `/:parlayId/selections/:selectionId`)
  - Lines 851-870 (GET `/:parlayId`)
  - Lines 1066-1081 (PATCH `/:parlayId`)
- Also appears in GET `/` route (lines 773-791) with slight variation

### 4. Repeated Parlay Fetching Pattern
- The pattern of fetching a parlay with selections is repeated 6 times:
  - Lines 228-241
  - Lines 476-489
  - Lines 658-671
  - Lines 819-832
  - Lines 906-919
  - Lines 1048-1061

### 5. Insurance Refund Logic Duplication
- Insurance refund logic is duplicated in:
  - PATCH `/:parlayId` route (lines 1009-1044)
  - DELETE `/:parlayId` route (lines 1141-1159)

### 6. Error Response Pattern
- The error response pattern is repeated in every catch block

## Proposed Refactorings

### 1. Create Validation Helper Functions
**File**: `backend/src/utils/parlayValidation.ts`

Functions to extract:
- `validateUserAuthenticated(userId: string | undefined): void` - Throws error if not authenticated
- `validateParlayOwnership(parlay: any, userId: string): void` - Throws error if parlay doesn't belong to user
- `validateParlayNotLocked(parlay: any): void` - Throws error if parlay is locked
- `validateGameNotStarted(game: any): void` - Throws error if game has started
- `validateExistingSelection(selection: any, userId: string): void` - Validates existing selection
- `validateNewBet(bet: any, selectedSide: string): void` - Validates new bet selection

### 2. Create Selection Helper Functions
**File**: `backend/src/utils/parlayHelpers.ts`

Functions to extract:
- `getParlayWithSelections(parlayId: string)` - Fetches parlay with selections
- `formatParlayResponse(parlay: any, includeSelections?: boolean)` - Formats parlay for API response
- `handleInsuranceRefund(parlay: any, user: any, prisma: PrismaClient)` - Handles insurance refund logic

### 3. Extract Insurance Logic
**File**: `backend/src/utils/parlayHelpers.ts`

Functions to extract:
- `addInsuranceToParlay(parlay: any, user: any, prisma: PrismaClient)` - Adds insurance to parlay
- `removeInsuranceFromParlay(parlay: any, user: any, prisma: PrismaClient)` - Removes insurance from parlay

### 4. Create Error Handler Utility
**File**: `backend/src/utils/parlayValidation.ts` or use existing error handler

- Standardize error responses

## Benefits
- **Reduced code duplication**: ~200+ lines of duplicate code eliminated
- **Easier maintenance**: Update validation logic in one place
- **Better testability**: Helper functions can be unit tested
- **Improved readability**: Route handlers become more focused on business logic
- **Consistency**: All routes use the same validation and formatting logic

## Implementation Order
1. Create validation helper functions
2. Create parlay helper functions (fetching, formatting)
3. Extract insurance logic
4. Refactor routes to use helpers
5. Test all endpoints

## Notes
- All refactorings should maintain existing functionality
- No changes to API contracts
- Error messages should remain the same
- Response formats should remain identical

