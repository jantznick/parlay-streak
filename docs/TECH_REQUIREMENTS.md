# Parlay Streak - Technical Requirements Document

## Project Overview

A social sports prediction game where players build winning streaks by creating parlays from live sporting events. Players can manage multiple simultaneous parlays with a strategic insurance system.

---

## Technology Stack

### Backend
- **Framework:** Node.js with Express
- **Language:** TypeScript (liberal use of `any` for MVP speed)
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Real-time:** Socket.io for WebSocket connections
- **Authentication:** 
  - Session-based (express-session + connect-pg-simple)
  - Magic links via email
  - Username/password with bcrypt
  - Session duration: 1 week
  - OAuth (Google, Apple) - Future enhancement
- **API Documentation:** swagger-jsdoc (definitions in separate files)

### Frontend (Web)
- **Framework:** Vite + React (SPA)
- **Language:** TypeScript (liberal use of `any`)
- **Styling:** TailwindCSS + shadcn/ui components
- **State Management:** React Context + Zustand for larger state
- **Real-time:** Socket.io client
- **API Calls:** Fetch API
- **Build Tool:** Vite

### Frontend (Mobile)
- **Framework:** React Native (Expo) - Post-MVP
- **Language:** TypeScript
- **Styling:** NativeWind (Tailwind for React Native)
- **State Management:** Zustand
- **Navigation:** React Navigation

### Shared Code (Monorepo)
- **Types:** Shared TypeScript types/interfaces
- **Utils:** Common utility functions
- **Constants:** Shared constants (parlay values, insurance costs, etc.)

### Infrastructure
- **Hosting:** EC2 or similar
- **Database Hosting:** AWS RDS (PostgreSQL) or similar managed service
- **Email Service:** Resend (for magic links)
- **Environment Management:** Docker for production, local dev for development

### Development Tools
- **API Testing:** Postman/Insomnia
- **Version Control:** Git
- **Linting:** ESLint + Prettier (optional for MVP)

---

## System Architecture

### High-Level Architecture

```
┌─────────────────┐         ┌─────────────────┐
│   Next.js Web   │         │  React Native   │
│   Application   │         │  Mobile Apps    │
└────────┬────────┘         └────────┬────────┘
         │                           │
         │        HTTP/REST          │
         │      WebSocket (Socket.io)│
         │                           │
         └───────────┬───────────────┘
                     │
         ┌───────────▼───────────┐
         │   Express API Server  │
         │   (Node.js/TypeScript)│
         └───────────┬───────────┘
                     │
         ┌───────────▼───────────┐
         │   PostgreSQL Database │
         └───────────────────────┘
```

### Data Flow

1. **User Creates Parlay:**
   - Frontend → API: POST /api/parlays
   - API validates, saves to DB
   - Returns parlay object

2. **Parlay Locks (Game Start):**
   - Background job checks game start times
   - Locks relevant parlays
   - WebSocket broadcasts lock event to connected clients

3. **Game Completes:**
   - Manual input or future API integration updates game result
   - Resolution engine processes completed parlays
   - Calculates streak updates
   - WebSocket broadcasts results to affected users

4. **Real-time Updates:**
   - Client maintains WebSocket connection
   - Receives push notifications for:
     - Parlay locks
     - Bet resolutions
     - Streak updates
     - Insurance unlock events

---

## Database Schema

### Core Tables

#### `users`
```sql
id                  UUID PRIMARY KEY
username            VARCHAR(50) UNIQUE NOT NULL
email               VARCHAR(255) UNIQUE NOT NULL
password_hash       VARCHAR(255) -- nullable for magic link only users
current_streak      INTEGER DEFAULT 0
longest_streak      INTEGER DEFAULT 0
total_points_earned INTEGER DEFAULT 0
insurance_locked    BOOLEAN DEFAULT false
created_at          TIMESTAMP DEFAULT NOW()
updated_at          TIMESTAMP DEFAULT NOW()
```

#### `games`
```sql
id              UUID PRIMARY KEY
external_id     VARCHAR(255) -- ID from sports data source
sport           VARCHAR(50) -- 'NBA', 'NFL', 'NHL', etc.
home_team       VARCHAR(255)
away_team       VARCHAR(255)
start_time      TIMESTAMP NOT NULL
end_time        TIMESTAMP -- null until game ends
status          VARCHAR(20) -- 'scheduled', 'in_progress', 'completed', 'postponed'
home_score      INTEGER
away_score      INTEGER
metadata        JSONB -- additional game data
created_at      TIMESTAMP DEFAULT NOW()
updated_at      TIMESTAMP DEFAULT NOW()
```

#### `bets`
```sql
id              UUID PRIMARY KEY
game_id         UUID REFERENCES games(id)
bet_type        VARCHAR(50) -- 'moneyline', 'spread', 'over_under', 'player_prop', etc.
description     VARCHAR(255) -- "Lakers ML", "Curry over 28.5 pts"
bet_value       VARCHAR(100) -- the specific value (spread number, points, etc.)
outcome         VARCHAR(20) -- 'pending', 'win', 'loss', 'push', 'void'
priority        INTEGER -- 1 = main bet, 2+ = side bets
resolved_at     TIMESTAMP
metadata        JSONB -- additional bet data
created_at      TIMESTAMP DEFAULT NOW()
updated_at      TIMESTAMP DEFAULT NOW()
```

#### `parlays`
```sql
id                      UUID PRIMARY KEY
user_id                 UUID REFERENCES users(id)
bet_count               INTEGER NOT NULL (1-5)
parlay_value            INTEGER NOT NULL -- +1, +2, +4, +8, +16
insured                 BOOLEAN DEFAULT false
insurance_cost          INTEGER DEFAULT 0
status                  VARCHAR(20) -- 'building', 'locked', 'pending', 'won', 'lost'
locked_at               TIMESTAMP
resolved_at             TIMESTAMP
last_game_end_time      TIMESTAMP -- when the last game in this parlay ends
created_at              TIMESTAMP DEFAULT NOW()
updated_at              TIMESTAMP DEFAULT NOW()
```

#### `parlay_bets` (junction table)
```sql
id              UUID PRIMARY KEY
parlay_id       UUID REFERENCES parlays(id) ON DELETE CASCADE
bet_id          UUID REFERENCES bets(id)
created_at      TIMESTAMP DEFAULT NOW()
```

#### `streak_history`
```sql
id              UUID PRIMARY KEY
user_id         UUID REFERENCES users(id)
parlay_id       UUID REFERENCES parlays(id)
old_streak      INTEGER NOT NULL
new_streak      INTEGER NOT NULL
change_amount   INTEGER NOT NULL
change_type     VARCHAR(20) -- 'parlay_win', 'parlay_loss', 'insurance_deducted'
created_at      TIMESTAMP DEFAULT NOW()
```

#### `auth_tokens`
```sql
id              UUID PRIMARY KEY
user_id         UUID REFERENCES users(id)
token           VARCHAR(500) UNIQUE NOT NULL
token_type      VARCHAR(20) -- 'magic_link', 'refresh', 'reset_password'
expires_at      TIMESTAMP NOT NULL
used_at         TIMESTAMP
created_at      TIMESTAMP DEFAULT NOW()
```

### Indexes

```sql
-- Performance indexes
CREATE INDEX idx_games_start_time ON games(start_time);
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_parlays_user_status ON parlays(user_id, status);
CREATE INDEX idx_parlays_last_game_end ON parlays(last_game_end_time);
CREATE INDEX idx_bets_game ON bets(game_id);
CREATE INDEX idx_streak_history_user ON streak_history(user_id, created_at DESC);
CREATE INDEX idx_users_current_streak ON users(current_streak DESC);
CREATE INDEX idx_users_longest_streak ON users(longest_streak DESC);
```

---

## API Endpoints

### Authentication

```
POST   /api/auth/register
POST   /api/auth/login
POST   /api/auth/magic-link/request
POST   /api/auth/magic-link/verify
POST   /api/auth/refresh
POST   /api/auth/logout
GET    /api/auth/me
```

### Games

```
GET    /api/games              # List today's games
GET    /api/games/:id          # Get game details + available bets
GET    /api/games/:id/bets     # Get all bets for a game
```

### Bets

```
GET    /api/bets/:id           # Get specific bet details
```

### Parlays

```
POST   /api/parlays            # Create a new parlay
GET    /api/parlays            # Get user's parlays (with status filters)
GET    /api/parlays/:id        # Get specific parlay details
PATCH  /api/parlays/:id        # Add bets to parlay (if status = 'building')
POST   /api/parlays/:id/lock   # Lock a parlay (manual, or auto when game starts)
DELETE /api/parlays/:id        # Delete unlocked parlay
POST   /api/parlays/:id/insure # Add insurance to eligible parlay
```

### User Profile & Stats

```
GET    /api/users/:id/profile  # Get user profile
GET    /api/users/:id/streak-history
GET    /api/users/:id/stats    # Detailed statistics
PATCH  /api/users/:id/profile  # Update profile
```

### Leaderboards

```
GET    /api/leaderboards/current-streak
GET    /api/leaderboards/longest-streak
GET    /api/leaderboards/hot-hand
GET    /api/leaderboards/total-points
```

### Admin (Manual Data Entry for MVP)

```
POST   /api/admin/games        # Create a game
PATCH  /api/admin/games/:id    # Update game (scores, status)
POST   /api/admin/bets         # Create a bet for a game
PATCH  /api/admin/bets/:id     # Update bet outcome
```

---

## WebSocket Events

### Client → Server

```javascript
// Connection
socket.emit('authenticate', { token: 'JWT_TOKEN' })

// Subscribe to updates
socket.emit('subscribe:user', { userId: 'UUID' })
socket.emit('subscribe:parlay', { parlayId: 'UUID' })
```

### Server → Client

```javascript
// Parlay updates
socket.emit('parlay:locked', { parlayId, lockedAt })
socket.emit('parlay:resolved', { parlayId, outcome, streakChange })

// Streak updates
socket.emit('streak:updated', { userId, oldStreak, newStreak, change })

// Insurance updates
socket.emit('insurance:locked', { userId })
socket.emit('insurance:unlocked', { userId })

// Bet updates
socket.emit('bet:resolved', { betId, outcome })

// Game updates
socket.emit('game:started', { gameId })
socket.emit('game:completed', { gameId, finalScore })
```

---

## Key Business Logic Components

### 1. Parlay Value Calculator

```typescript
function calculateParlayValue(betCount: number): number {
  const values = { 1: 1, 2: 2, 3: 4, 4: 8, 5: 16 };
  return values[betCount] || 0;
}
```

### 2. Insurance Cost Calculator

```typescript
function calculateInsuranceCost(betCount: number, currentStreak: number): number {
  if (betCount < 4) return 0; // Insurance not available
  
  const baseCoB = betCount === 4 ? 3 : 5;
  
  let multiplier = 1.0;
  if (currentStreak >= 45) multiplier = 3.0;
  else if (currentStreak >= 35) multiplier = 2.67;
  else if (currentStreak >= 25) multiplier = 2.0;
  else if (currentStreak >= 15) multiplier = 1.67;
  else multiplier = 1.0; // 0-14
  
  return Math.round(baseCost * multiplier);
}
```

### 3. Insurance Availability Checker

```typescript
async function canUseInsurance(userId: UUID): Promise<boolean> {
  const user = await db.users.findUnique({ where: { id: userId } });
  return !user.insurance_locked;
}
```

### 4. Parlay Resolution Engine

**Core Resolution Logic:**

```typescript
async function resolveParlays() {
  // Find all parlays ready to resolve
  // (status = 'locked' AND all games completed)
  const readyParlays = await findReadyParlays();
  
  for (const parlay of readyParlays) {
    // Check if all bets won
    const allBetsWon = await checkAllBetsWon(parlay.id);
    
    if (allBetsWon) {
      await handleParlayWin(parlay);
    } else {
      await handleParlayLoss(parlay);
    }
  }
}

async function handleParlayWin(parlay: Parlay) {
  const user = await getUser(parlay.user_id);
  const netGain = parlay.parlay_value - parlay.insurance_cost;
  const newStreak = user.current_streak + netGain;
  
  await updateUserStreak(user.id, newStreak);
  await updateParlay(parlay.id, { status: 'won', resolved_at: new Date() });
  await createStreakHistory(user.id, parlay.id, user.current_streak, newStreak, 'parlay_win');
  
  // Emit WebSocket events
  emitStreakUpdate(user.id, newStreak);
  emitParlayResolved(parlay.id, 'won');
}

async function handleParlayLoss(parlay: Parlay) {
  const user = await getUser(parlay.user_id);
  
  if (parlay.insured) {
    // Streak survives, already paid insurance cost
    await updateParlay(parlay.id, { status: 'lost', resolved_at: new Date() });
    await createStreakHistory(user.id, parlay.id, user.current_streak, user.current_streak, 'parlay_loss');
    
    // Lock insurance until uninsured bet resolves after this
    await lockInsurance(user.id);
  } else {
    // Streak resets to 0
    await updateUserStreak(user.id, 0);
    await updateParlay(parlay.id, { status: 'lost', resolved_at: new Date() });
    await createStreakHistory(user.id, parlay.id, user.current_streak, 0, 'parlay_loss');
    
    // Check if this resolves after insured parlay - unlock insurance
    await checkAndUnlockInsurance(user.id, parlay.resolved_at);
  }
  
  emitStreakUpdate(user.id, user.current_streak);
  emitParlayResolved(parlay.id, 'lost');
}
```

### 5. Insurance Unlock Logic

```typescript
async function checkAndUnlockInsurance(userId: UUID, parlayResolvedAt: Date) {
  const user = await getUser(userId);
  
  if (!user.insurance_locked) return; // Already unlocked
  
  // Find the last insured parlay that resolved
  const lastInsuredParlay = await getLastInsuredParlay(userId);
  
  if (!lastInsuredParlay) return;
  
  // Check if this uninsured parlay resolved AFTER the insured one
  if (parlayResolvedAt > lastInsuredParlay.resolved_at) {
    await unlockInsurance(userId);
    emitInsuranceUnlocked(userId);
  }
}
```

### 6. Parlay Auto-Lock System

Background job that runs every minute:

```typescript
async function autoLockParlays() {
  const now = new Date();
  
  // Find parlays in 'building' status where first game has started
  const parlaysToLock = await db.parlays.findMany({
    where: {
      status: 'building',
      parlay_bets: {
        some: {
          bet: {
            game: {
              start_time: { lte: now },
              status: { in: ['in_progress', 'completed'] }
            }
          }
        }
      }
    },
    include: {
      parlay_bets: {
        include: {
          bet: {
            include: { game: true }
          }
        }
      }
    }
  });
  
  for (const parlay of parlaysToLock) {
    await lockParlay(parlay.id);
  }
}
```

### 7. Chronological Resolution Order

```typescript
async function findReadyParlays(): Promise<Parlay[]> {
  // Find parlays where ALL games have completed
  // Order by last_game_end_time to ensure chronological processing
  const parlays = await db.parlays.findMany({
    where: {
      status: 'locked',
      // All related games must be completed
      parlay_bets: {
        every: {
          bet: {
            game: {
              status: 'completed'
            }
          }
        }
      }
    },
    orderBy: {
      last_game_end_time: 'asc' // Process in chronological order
    }
  });
  
  return parlays;
}
```

---

## Security Considerations

### Authentication
- JWT tokens with expiration (15 min access, 7 day refresh)
- Magic links expire after 15 minutes
- Bcrypt with salt rounds = 12 for password hashing
- Rate limiting on auth endpoints (5 attempts per 15 min)

### API Security
- Rate limiting on all endpoints
- Input validation with Joi or Zod
- SQL injection prevention via Prisma (parameterized queries)
- CORS configuration for known origins only
- Helmet.js for HTTP headers

### Data Privacy
- User emails stored securely
- No public display of emails (use usernames)
- Soft delete option for user accounts

---

## Performance Considerations

### Database
- Proper indexing on frequently queried columns
- Connection pooling (Prisma handles this)
- Pagination for leaderboards and game lists
- Caching strategy for leaderboards (Redis optional for Phase 2)

### API
- Response compression (gzip)
- Pagination for list endpoints (default 50 items)
- Efficient queries (avoid N+1 with Prisma include)

### WebSockets
- Room-based subscriptions (users only get their own updates)
- Disconnect handling and reconnection logic
- Heartbeat to detect stale connections

---

## Development Phases

### Phase 1: MVP Core (Weeks 1-4)
- [ ] Project setup (Express, Prisma, PostgreSQL)
- [ ] Database schema implementation
- [ ] Authentication (username/password + magic links)
- [ ] Manual game/bet creation (admin endpoints)
- [ ] Parlay creation and management
- [ ] Basic parlay resolution engine
- [ ] Insurance system
- [ ] Streak calculation
- [ ] WebSocket real-time updates
- [ ] Basic leaderboards

### Phase 2: Frontend MVP (Weeks 5-8)
- [ ] Next.js project setup
- [ ] Game browsing UI
- [ ] Parlay builder interface
- [ ] Active parlays dashboard
- [ ] Real-time resolution view
- [ ] Leaderboards
- [ ] User profile
- [ ] Auth flows (login, register, magic link)

### Phase 3: Polish & Testing (Weeks 9-10)
- [ ] End-to-end testing
- [ ] Bug fixes
- [ ] Performance optimization
- [ ] UI/UX refinement
- [ ] Documentation

### Phase 4: Mobile Apps (Weeks 11-14)
- [ ] React Native setup with Expo
- [ ] Port web features to mobile
- [ ] Native navigation
- [ ] Push notifications (optional)

---

## Testing Strategy

### Backend
- **Unit tests:** Business logic (insurance calculations, parlay values)
- **Integration tests:** API endpoints
- **E2E tests:** Full parlay flow from creation to resolution

### Frontend
- **Component tests:** React Testing Library
- **E2E tests:** Playwright or Cypress

### Load Testing
- Simulate multiple concurrent users
- WebSocket connection stress tests
- Database query performance

---

## Deployment Strategy

### Environment Setup
```
Development → Staging → Production
```

### Environment Variables
```
NODE_ENV=production
DATABASE_URL=postgresql://...
JWT_SECRET=...
JWT_REFRESH_SECRET=...
SENDGRID_API_KEY=...
CORS_ORIGIN=https://parlaystreak.com
SOCKET_IO_CORS_ORIGIN=https://parlaystreak.com
```

### Docker Setup
- Dockerfile for Express API
- Docker Compose for local dev (API + PostgreSQL)
- Health check endpoints for monitoring

### Database Migrations
- Prisma migrations for schema changes
- Seed scripts for development data
- Backup strategy for production

---

## Monitoring & Logging

### Application Monitoring
- Error tracking: Sentry
- Logging: Winston or Pino
- Structured logs (JSON format)

### Performance Monitoring
- API response times
- Database query performance
- WebSocket connection metrics

### Alerts
- Failed parlay resolutions
- Database connection issues
- High error rates
- WebSocket disconnections

---

## Future Enhancements (Post-MVP)

### Features
- Friend system and private leagues
- Live bet tracking during games
- Advanced statistics and analytics
- Bet recommendations based on history
- Social features (comments, trash talk)
- Push notifications (mobile)
- OAuth providers (Google, Apple)

### Technical
- Sports data API integration
- Redis caching layer
- CDN for static assets
- GraphQL API (optional)
- Microservices architecture (if scale requires)

---

## Open Questions / Decisions Needed

1. **Bet Priority vs "Main Bet" Label**
   - Use priority level (1 = main, 2+ = side bets) ✓
   - Allows flexibility in display

2. **Parlay Lock Behavior**
   - Auto-lock when first game starts ✓
   - Manual lock option available before game start ✓

3. **Postponed/Canceled Games**
   - Push the bet (parlay continues with remaining bets)
   - Void entire parlay (refund insurance cost)
   - **Decision needed before implementation**

4. **Tie/Push Scenarios**
   - Treat as loss (strict)
   - Remove from parlay (lenient)
   - **Decision needed based on desired difficulty**

5. **Insurance Edge Case:**
   - If insured parlay and uninsured bet/parlay are both pending and uninsured resolves first, does insurance unlock immediately?
   - **Current spec:** No - uninsured must resolve AFTER insured parlay resolves

6. **Leaderboard Calculation Frequency**
   - Real-time updates (every resolution)
   - Cached updates (every 5 minutes)
   - **Recommendation:** Cache with 5-minute TTL for performance

---

## Success Metrics (Technical)

- API response time < 200ms (p95)
- Database query time < 50ms (p95)
- WebSocket message delivery < 100ms
- 99.9% uptime
- Zero data loss on parlay resolutions
- Support 10,000+ concurrent users (Phase 2 goal)

---

## Next Steps

1. Initialize backend project structure
2. Set up PostgreSQL + Prisma
3. Implement database schema
4. Build authentication system
5. Create admin endpoints for manual game/bet entry
6. Implement core parlay logic
7. Build resolution engine
8. Add WebSocket layer
9. Create API endpoints
10. Begin frontend development

---

## Questions for Clarification

- **Postponed games:** How should we handle them?
- **Push/Tie bets:** Treated as loss or removed from parlay?
- **Same-game parlay detection:** For insurance unlock, should we validate that uninsured bet is from different game automatically?
- **Username requirements:** Length, special characters allowed?
- **Profile customization:** Avatar uploads? Display names vs usernames?


