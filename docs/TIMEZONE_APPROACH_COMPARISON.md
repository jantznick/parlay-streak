# Timezone Approach Comparison

## Approach 1: Store `gameDate` Field (Previous Recommendation)
- Add `gameDate` field to database
- Store the date ESPN returned the game for
- Query by `gameDate` directly

**Pros:**
- Simple queries (direct string match)
- No timezone math needed
- ESPN already handles timezone correctly

**Cons:**
- Requires database migration
- Adds a new field

---

## Approach 2: Send Timezone from Frontend, Convert to UTC Range (User's Proposal)

### How it works:
1. Frontend sends: `{ date: "2025-01-17", timezone: "America/Chicago" }` or `{ date: "2025-01-17", timezoneOffset: -6 }`
2. Backend converts:
   - User's date "2025-01-17" in CST (UTC-6)
   - Start: Jan 17 00:00 CST = Jan 17 06:00 UTC
   - End: Jan 18 00:00 CST = Jan 18 06:00 UTC
3. Query: `WHERE startTime >= '2025-01-17 06:00:00 UTC' AND startTime < '2025-01-18 06:00:00 UTC'`

### Pros:
- ✅ No database migration needed
- ✅ Uses existing `startTime` field
- ✅ Handles user's local timezone correctly
- ✅ Works for bet resolution (game end times in UTC)

### Cons:
- ⚠️ Need to send timezone from frontend on every request
- ⚠️ Need to handle timezone conversion logic
- ⚠️ Potential edge case: What if ESPN returns games that span the UTC boundary?

### Edge Case Analysis:
**Scenario:** User in EST (UTC-5) requests games for "Jan 17"
- Backend queries: Jan 17 05:00 UTC to Jan 18 05:00 UTC
- ESPN API: When we request games for "2025-01-17", ESPN returns games on that date in game's timezone
- If a game is at 11 PM EST on Jan 17, it's stored as Jan 18 04:00 UTC
- Our query (Jan 17 05:00 UTC to Jan 18 05:00 UTC) would find it ✅

**But what if:**
- User in PST (UTC-8) requests games for "Jan 17"
- Backend queries: Jan 17 08:00 UTC to Jan 18 08:00 UTC
- ESPN returns games for "Jan 17" (which are Jan 17 00:00-23:59 in game's timezone, typically EST/PST)
- A game at 1 AM EST on Jan 17 = Jan 17 06:00 UTC
- Our query would find it ✅

**Actually, this should work!** Because:
- ESPN returns games for the requested date in the game's local timezone
- We store them with UTC timestamps
- When querying, we convert the user's date to UTC range
- Games that fall in that UTC range are the ones the user wants

---

## Approach 3: Always Use UTC on Backend (Rejected)
- Backend always interprets dates as UTC
- User in EST at 11 PM sees "tomorrow" in date picker
- **Problem:** User experience is confusing

---

## Recommendation: Approach 2 (User's Proposal)

### Why it's better:
1. **No database migration** - uses existing schema
2. **Accurate for user's timezone** - user sees games for "their" date
3. **Works for bet resolution** - game end times are already in UTC
4. **Flexible** - can handle any timezone

### Implementation Details:

#### Frontend Changes:
```typescript
// Get user's timezone
const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
// Or get offset: const offset = -new Date().getTimezoneOffset() / 60;

// Send with request
const response = await api.fetchGamesFromApi(
  selectedDate, 
  selectedSport, 
  selectedLeague, 
  force,
  userTimezone // or timezoneOffset
);
```

#### Backend Changes:
```typescript
// Convert user's date + timezone to UTC range
function getUTCDateRange(dateStr: string, timezone: string): { start: Date; end: Date } {
  // Parse date as if it's in the user's timezone
  const [year, month, day] = dateStr.split('-').map(Number);
  
  // Create date in user's timezone (using a library like date-fns-tz or manual calculation)
  // For simplicity, we can use timezone offset
  const userDate = new Date(`${year}-${month}-${day}T00:00:00`);
  const offset = getTimezoneOffset(timezone); // e.g., -6 for CST
  
  // Convert to UTC
  const startUTC = new Date(userDate.getTime() - (offset * 60 * 60 * 1000));
  const endUTC = new Date(startUTC.getTime() + (24 * 60 * 60 * 1000));
  
  return { start: startUTC, end: endUTC };
}

// Query games
const { start, end } = getUTCDateRange(date, timezone);
const games = await prisma.game.findMany({
  where: {
    startTime: {
      gte: start,
      lt: end
    },
    sport: sport.toUpperCase()
  }
});
```

### Libraries to Consider:
- `date-fns-tz` - Timezone-aware date manipulation
- `luxon` - Full-featured date/time library with timezone support
- Native `Intl` API - Built-in but more verbose

### Alternative: Use Timezone Offset (Simpler)
Instead of timezone name, send offset in hours:
```typescript
// Frontend
const offset = -new Date().getTimezoneOffset() / 60; // -6 for CST

// Backend
function getUTCDateRange(dateStr: string, offsetHours: number): { start: Date; end: Date } {
  const [year, month, day] = dateStr.split('-').map(Number);
  const localMidnight = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  const startUTC = new Date(localMidnight.getTime() - (offsetHours * 60 * 60 * 1000));
  const endUTC = new Date(startUTC.getTime() + (24 * 60 * 60 * 1000));
  return { start: startUTC, end: endUTC };
}
```

---

## Bet Resolution Consideration

You mentioned bet resolution also uses UTC times. This approach works perfectly for that:
- Game end times are stored in UTC
- When resolving bets, we compare UTC timestamps
- No timezone conversion needed for resolution logic
- Only need timezone conversion for date-based queries

---

## Final Recommendation

**Use Approach 2 (User's Proposal):**
1. Frontend sends date + timezone offset
2. Backend converts to UTC range
3. Query by `startTime` in UTC range
4. No database migration needed
5. Works for bet resolution

**Implementation Priority:**
1. Fix frontend date initialization (use local date, not UTC)
2. Add timezone offset to API requests
3. Update backend to convert date + timezone to UTC range
4. Fix state management (memoization, request cancellation)
5. Add logging for debugging

