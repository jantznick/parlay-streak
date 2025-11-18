# Timezone and State Management Issues Analysis

## Problems Identified

### 1. **Frontend Date Initialization (Timezone Issue)**
**Location:** `frontend/src/pages/admin/BetManagement.tsx:38-40`
```typescript
const [selectedDate, setSelectedDate] = useState<string>(
  new Date().toISOString().split('T')[0]
);
```

**Problem:** 
- `toISOString()` converts to UTC, so if it's 11 PM local time but 2 AM UTC the next day, you get tomorrow's date
- Example: User in EST (UTC-5) at 11 PM on Jan 17 → `toISOString()` returns Jan 18 → date picker shows Jan 18

**Impact:** Date picker shows wrong date on page load, causing incorrect API calls

---

### 2. **Backend Date Parsing Ambiguity (Timezone Issue)**
**Location:** `backend/src/routes/admin.routes.ts:68-71`
```typescript
const requestedDate = new Date(date);
requestedDate.setUTCHours(0, 0, 0, 0);
```

**Problem:**
- `new Date("2025-01-17")` is ambiguous - in some environments it's treated as UTC midnight, in others as local midnight
- Even though we call `setUTCHours(0, 0, 0, 0)` after, the initial parsing might have already shifted the date

**Impact:** Database queries might look for games on the wrong day

---

### 3. **Database Query vs Game Storage Mismatch (Timezone Issue)**
**Location:** `backend/src/routes/admin.routes.ts:77-91` (query) vs `207, 223` (storage)

**Problem:**
- **Query:** Uses UTC date range (`requestedDate` UTC midnight to `nextDay` UTC midnight)
- **Storage:** Games stored with `startTime` from ESPN API timestamps (which are in the game's local timezone)
- **Example:** Game starts 11 PM EST on Jan 17 → stored as `2025-01-18T04:00:00Z` (UTC) → query for Jan 17 UTC (00:00-24:00) misses it

**Impact:** Games stored correctly but not found when querying by date

---

### 4. **State Management Race Conditions**
**Location:** `frontend/src/pages/admin/BetManagement.tsx:87-94`

**Problem:**
- `useEffect` auto-fetches when `selectedDate` changes
- `fetchGames` function is recreated on every render (not memoized)
- Rapid date changes cause multiple simultaneous API calls
- No cleanup/cancellation of in-flight requests

**Impact:** 
- Stale responses overwrite newer data
- Games from previous date appear when switching dates
- Inconsistent UI state

---

### 5. **Missing Error Handling for Empty Responses**
**Location:** `frontend/src/pages/admin/BetManagement.tsx:106-116`

**Problem:**
- If API returns empty games array, `setGames([])` is called
- But if there's a network error or the response structure is unexpected, games state might not update
- No distinction between "no games found" vs "error occurred"

**Impact:** UI might show stale games when errors occur

---

### 6. **Date String Format Inconsistency**
**Location:** Multiple places

**Problem:**
- Frontend sends `YYYY-MM-DD` (local date interpretation)
- Backend receives and parses it (ambiguous)
- ESPN API expects `YYYYMMDD` (no timezone, just date)
- Database stores full timestamps (UTC)

**Impact:** Date boundaries don't align across the stack

---

## Proposed Solutions

### Solution 1: Standardize on UTC for All Date Operations

**Frontend Changes:**
```typescript
// Get today's date in user's local timezone, but send as UTC date string
const getTodayDateString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
```

**Backend Changes:**
```typescript
// Parse date string explicitly as UTC date (not local)
const parseUTCDate = (dateStr: string): Date => {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  return date;
};

const requestedDate = parseUTCDate(date);
const nextDay = new Date(requestedDate);
nextDay.setUTCDate(nextDay.getUTCDate() + 1);
```

**Pros:**
- Eliminates timezone ambiguity
- Consistent date boundaries
- Easier to reason about

**Cons:**
- Users might see "today" as yesterday if they're in a timezone ahead of UTC
- Need to handle date display carefully

---

### Solution 2: Use Local Date for User Experience, UTC for Storage/Queries

**Frontend Changes:**
```typescript
// Get today in user's local timezone
const getLocalTodayDateString = (): string => {
  const now = new Date();
  const localDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const year = localDate.getFullYear();
  const month = String(localDate.getMonth() + 1).padStart(2, '0');
  const day = String(localDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
```

**Backend Changes:**
```typescript
// Parse as local date, then convert to UTC range
// But also query games that might span date boundaries
const parseDateAsLocal = (dateStr: string): { startUTC: Date; endUTC: Date } => {
  const [year, month, day] = dateStr.split('-').map(Number);
  // Create date in UTC but representing the local date
  const startUTC = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const endUTC = new Date(startUTC);
  endUTC.setUTCDate(endUTC.getUTCDate() + 1);
  
  // Also check games from previous day that might be in this date's range
  // (e.g., 11 PM EST game on Jan 17 is Jan 18 in UTC)
  const prevDayStart = new Date(startUTC);
  prevDayStart.setUTCDate(prevDayStart.getUTCDate() - 1);
  
  return { startUTC: prevDayStart, endUTC };
};
```

**Pros:**
- Better UX (users see "today" as their local today)
- Handles games that span date boundaries

**Cons:**
- More complex query logic
- Need to handle edge cases

---

### Solution 3: Store Game Date Separately from Start Time

**Database Schema Addition:**
```prisma
model Game {
  // ... existing fields
  gameDate String @map("game_date") @db.VarChar(10) // YYYY-MM-DD in game's local timezone
  startTime DateTime @map("start_time") // Full timestamp (UTC)
}
```

**Query Changes:**
```typescript
// Query by gameDate field instead of startTime range
const existingGames = await prisma.game.findMany({
  where: {
    gameDate: date, // Direct match, no timezone issues
    sport: sport.toUpperCase()
  }
});
```

**Pros:**
- Eliminates timezone issues for date queries
- Clear separation of concerns
- Easy to query by date

**Cons:**
- Requires database migration
- Need to populate `gameDate` when storing games
- Need to determine "game date" from timestamp (which timezone?)

---

### Solution 4: Fix State Management Issues

**Memoize fetchGames:**
```typescript
const fetchGames = useCallback(async (force: boolean = false) => {
  // ... existing logic
}, [selectedDate, selectedSport, selectedLeague]);
```

**Add Request Cancellation:**
```typescript
const [abortController, setAbortController] = useState<AbortController | null>(null);

const fetchGames = useCallback(async (force: boolean = false) => {
  // Cancel previous request
  if (abortController) {
    abortController.abort();
  }
  
  const controller = new AbortController();
  setAbortController(controller);
  
  try {
    // ... fetch logic
  } finally {
    if (controller === abortController) {
      setAbortController(null);
    }
  }
}, [selectedDate, selectedSport, selectedLeague]);
```

**Add Loading State Per Date:**
```typescript
const [loadingDates, setLoadingDates] = useState<Set<string>>(new Set());

const fetchGames = useCallback(async (force: boolean = false) => {
  const dateKey = `${selectedDate}-${selectedSport}-${selectedLeague}`;
  if (loadingDates.has(dateKey)) {
    return; // Already loading
  }
  
  setLoadingDates(prev => new Set(prev).add(dateKey));
  try {
    // ... fetch logic
  } finally {
    setLoadingDates(prev => {
      const next = new Set(prev);
      next.delete(dateKey);
      return next;
    });
  }
}, [selectedDate, selectedSport, selectedLeague, loadingDates]);
```

---

## Recommended Approach

**Combination of Solutions 3 + 4 (Store Game Date + Fix State Management):**

### The Core Problem:
- User selects "Jan 17" in their local timezone (EST)
- Backend queries for games on "Jan 17 UTC" (00:00-24:00 UTC)
- But a game at 11 PM EST on Jan 17 is actually 4 AM UTC on Jan 18
- So the game is stored correctly but not found when querying

### The Solution:
1. **Store `gameDate` field** (YYYY-MM-DD) extracted from ESPN API response
   - ESPN API returns games for a specific date in the league's timezone
   - When we request games for "2025-01-17", ESPN returns games that are "on Jan 17" in the game's local timezone
   - We should store this date string directly (no timezone conversion)
   - Query by `gameDate` field instead of `startTime` range

2. **Fix frontend date initialization** to use local date correctly

3. **Fix state management** with memoization and request cancellation

4. **Keep `startTime` as UTC timestamp** for actual game time (for sorting, display, etc.)

**Why:**
- Eliminates timezone issues completely
- ESPN API already handles timezone correctly - we just need to preserve the date
- Simple queries by date (no range calculations)
- Fixes race conditions
- Requires database migration but it's straightforward

**How it works:**
- User selects "2025-01-17" → Frontend sends "2025-01-17"
- Backend queries ESPN for "2025-01-17" → ESPN returns games on that date (in game's timezone)
- When storing: Extract date from ESPN response, store as `gameDate: "2025-01-17"`
- When querying: `WHERE gameDate = "2025-01-17"` → Gets all games for that date, regardless of UTC timestamp

---

## Implementation Steps

### Step 1: Database Migration
Add `gameDate` field to Game model:
```prisma
model Game {
  // ... existing fields
  gameDate String @map("game_date") @db.VarChar(10) // YYYY-MM-DD, the date ESPN returned this game for
  startTime DateTime @map("start_time") // UTC timestamp for actual game time
}
```

### Step 2: Update Game Storage
When storing games from ESPN API:
- Store `gameDate` as the date that was requested from ESPN (the `date` parameter)
- This is safe because ESPN only returns games for the requested date
- Keep `startTime` as UTC timestamp for actual game time

### Step 3: Update Database Queries
Change from:
```typescript
where: {
  startTime: { gte: requestedDate, lt: nextDay },
  sport: sport.toUpperCase()
}
```

To:
```typescript
where: {
  gameDate: date, // Direct match, no timezone issues
  sport: sport.toUpperCase()
}
```

### Step 4: Fix Frontend Date Initialization
```typescript
const getLocalTodayDateString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
```

### Step 5: Fix State Management
- Memoize `fetchGames` with `useCallback`
- Add request cancellation with AbortController
- Prevent multiple simultaneous requests for same date/sport/league

### Step 6: Add Logging
- Log the `gameDate` being stored
- Log the `gameDate` being queried
- Log date conversions for debugging

### Step 7: Migration Script
Create a migration script to populate `gameDate` for existing games:
- Extract date from `startTime` in the game's local timezone (or use metadata if available)
- Or set based on when the game was fetched (if we have that info)

---

## Testing Checklist

- [ ] Page load shows correct date in date picker
- [ ] Changing date fetches correct games
- [ ] Force refresh works correctly
- [ ] Games stored correctly in database
- [ ] Querying by date finds all games for that date
- [ ] No stale games when switching dates
- [ ] No race conditions with rapid date changes
- [ ] Works correctly in different timezones (EST, PST, UTC, etc.)

