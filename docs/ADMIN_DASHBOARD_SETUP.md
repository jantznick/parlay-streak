# Admin Dashboard - Quick Start Guide

## What's Been Built

✅ **Backend:**
- Admin middleware that checks user email against `ADMIN_EMAILS` env variable
- Reusable API Sports service (supports basketball and football)
- Admin API endpoints for fetching and viewing games

✅ **Frontend:**
- Admin dashboard at `/admin/bets`
- Date picker for selecting game dates
- Sport selector (Basketball/Football)
- Games list with real-time data from API Sports
- Beautiful dark UI matching your app's design

---

## Setup Instructions

### 1. Add Environment Variables

Edit your `/backend/.env` file (create from `env.example` if needed):

```bash
# Add your admin email
ADMIN_EMAILS=your-admin-email@example.com

# Add your API Sports key (get from api-sports.io)
API_SPORTS_KEY=your_api_sports_key_here
```

**Getting an API Sports Key:**
1. Go to https://api-sports.io/
2. Create a free account
3. Subscribe to the Basketball API (free tier available)
4. Copy your API key from the dashboard

### 2. Start the Backend

```bash
cd backend
npm run dev
```

Backend will run on `http://localhost:3001`

### 3. Start the Frontend

```bash
cd frontend
npm run dev
```

Frontend will run on `http://localhost:5173`

---

## How to Use

### 1. Login as Admin

1. Go to `http://localhost:5173/login`
2. Login with your admin email (the one you set in `ADMIN_EMAILS`)
3. Navigate to: `http://localhost:5173/admin/bets`

### 2. View Games

1. **Select a date** - Use the date picker to choose a date
2. **Select a sport** - Choose Basketball (NBA) or Football (NFL)
3. **Fetch games** - Click "Fetch Games from API" to load games from API Sports

The app will:
- Fetch games from api-sports.io
- Store them in your database
- Display them in the list

### 3. Game Information Displayed

Each game card shows:
- 🏀/🏈 Sport icon
- Teams (Away @ Home)
- Game time and date
- Current status (scheduled, in_progress, completed)
- Scores (if game has started)
- Number of bets created (coming next!)

---

## API Endpoints

### Fetch Games from API
```bash
POST /api/admin/games/fetch
Body: { "date": "2025-01-15", "sport": "basketball" }
```

### Get Games from Database
```bash
GET /api/admin/games?date=2025-01-15&sport=BASKETBALL
```

### Get Supported Sports
```bash
GET /api/admin/sports
```

---

## Testing Tips

### Basketball (NBA)
- Regular season: October - April
- Games most days of the week
- Good for testing with frequent games
- Try dates like today or upcoming dates

### Football (NFL)
- Regular season: September - December
- Games primarily Thursday, Sunday, Monday
- Less frequent but good for testing different sports

### Sample Test Flow

1. Login as admin
2. Select today's date
3. Select Basketball
4. Click "Fetch Games from API"
5. See list of NBA games for today
6. (Next step: Click "Create Bets" button - coming soon!)

---

## Troubleshooting

### "Admin access required" error
- Make sure your logged-in email matches one in `ADMIN_EMAILS`
- Check that `ADMIN_EMAILS` is set in backend/.env
- Restart the backend after changing .env

### "No games found"
- Make sure the date has games scheduled
- Try a different date (check NBA/NFL schedules)
- Click "Fetch Games from API" first if database is empty

### API errors
- Check that `API_SPORTS_KEY` is set correctly
- Verify your API key is active at api-sports.io
- Check API rate limits (free tier has limits)

### Games not loading
- Check browser console for errors
- Check backend logs for API responses
- Verify backend is running on port 3001
- Verify CORS is configured for localhost:5173

---

## Next Steps

Now that the admin dashboard is working, the next phase is:

1. **Create Bets Button** - Wire up the "Create Bets" button
2. **Bet Creation Modal** - Build the modal UI from ADMIN_BET_CREATION.md
3. **Player Roster Fetching** - Fetch fresh rosters when creating bets
4. **Bet Forms** - Build COMPARISON, THRESHOLD, and EVENT bet forms
5. **Bet Display** - Show created bets for each game

See `/docs/ADMIN_BET_CREATION.md` for full implementation details.

---

## Files Created/Modified

**Backend:**
- `/backend/src/middleware/admin.ts` - Admin authentication middleware
- `/backend/src/services/apiSports.service.ts` - API Sports integration
- `/backend/src/routes/admin.routes.ts` - Admin API endpoints
- `/backend/src/app.ts` - Mounted admin routes
- `/backend/env.example` - Added ADMIN_EMAILS and API_SPORTS_KEY

**Frontend:**
- `/frontend/src/services/api.ts` - Added admin API methods
- `/frontend/src/pages/admin/BetManagement.tsx` - Admin dashboard page
- `/frontend/src/App.tsx` - Added /admin/bets route

---

**Status:** ✅ Ready to Test  
**Last Updated:** 2025-11-17  
**Next Phase:** Bet Creation UI



