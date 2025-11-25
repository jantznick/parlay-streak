# Backend Date/Timezone Utilities Refactoring

## Overview
This document outlines the refactoring of duplicate date and timezone utility functions across backend route files into a shared utility module.

## Problem
Multiple backend route files had duplicate implementations of:
1. `getUTCDateRange()` - Converting user's local date + timezone to UTC date range
2. Date/timezone parsing from request query parameters
3. Local date string calculation logic

These duplicates were found in:
- `backend/src/routes/bets.routes.ts` (2 instances of `getUTCDateRange`)
- `backend/src/routes/admin.routes.ts` (1 instance of `getUTCDateRange`)
- `backend/src/routes/parlay.routes.ts` (1 instance of `getUTCDateRange`)

## Solution

### Created Shared Utility Module
**New File**: `backend/src/utils/dateUtils.ts`

**Functions Extracted**:
1. `parseDateAndTimezone(req)` - Parses date and timezoneOffset from request query parameters
2. `getLocalDateString(date?, timezoneOffset?)` - Gets local date string with fallback logic
3. `getUTCDateRange(dateStr, timezoneOffset?)` - Converts local date + timezone to UTC date range

### Updated Files
- `backend/src/routes/bets.routes.ts` - Removed 2 duplicate `getUTCDateRange` functions and inline date parsing
- `backend/src/routes/admin.routes.ts` - Removed duplicate `getUTCDateRange` function
- `backend/src/routes/parlay.routes.ts` - Removed duplicate `getUTCDateRange` function and inline date parsing

## Benefits
- **Eliminated ~60 lines of duplicate code** across 3 route files
- **Consistent date/timezone handling** across all endpoints
- **Easier maintenance** - update logic in one place
- **Better testability** - utilities can be tested in isolation
- **Type safety** - centralized TypeScript types

## Functions

### `parseDateAndTimezone(req)`
Extracts `date` and `timezoneOffset` from Express request query parameters.
- Handles optional parameters
- Parses timezoneOffset as integer
- Returns typed object

### `getLocalDateString(date?, timezoneOffset?)`
Gets local date string with smart fallback logic:
1. If `date` provided → use it
2. Else if `timezoneOffset` provided → calculate date in user's timezone
3. Else → use server's local date

### `getUTCDateRange(dateStr, timezoneOffset?)`
Converts a local date string (YYYY-MM-DD) and timezone offset to UTC date range for database queries.
- Creates midnight in user's timezone
- Converts to UTC by adjusting for offset
- Returns 24-hour range (start to end)

## Usage Example

```typescript
import { parseDateAndTimezone, getLocalDateString, getUTCDateRange } from '../utils/dateUtils';

// In route handler
const { date, timezoneOffset } = parseDateAndTimezone(req);
const localDateStr = getLocalDateString(date, timezoneOffset);
const { start, end } = getUTCDateRange(localDateStr, timezoneOffset);

// Use start/end for database queries
const games = await prisma.game.findMany({
  where: {
    startTime: {
      gte: start,
      lt: end
    }
  }
});
```

## Testing Checklist
- [x] All route files compile without errors
- [x] No linter errors
- [x] Functionality preserved (no behavior changes)
- [ ] Manual testing of date filtering endpoints
- [ ] Verify timezone conversions are correct

## Notes
- All functions maintain backward compatibility
- Default behavior when timezoneOffset is undefined (uses UTC)
- Functions are pure and easily testable
- Could potentially be moved to `shared/utils/` if needed by both frontend and backend in the future

