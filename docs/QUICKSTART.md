# Quick Start Guide

Fast setup for developers familiar with the stack.

## Prerequisites

- Node.js 18+
- Docker & Docker Compose
- npm

## Setup (5 minutes)

### 1. Backend Setup

```bash
cd backend

# Already installed dependencies? Skip to database setup
# Otherwise: Dependencies are already in package.json from npm install

# Create environment file
cat > .env << EOL
NODE_ENV=development
PORT=3001
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/parlay_streak?schema=public"
SESSION_SECRET=$(openssl rand -base64 32)
CORS_ORIGIN=http://localhost:5173
RESEND_API_KEY=re_your_api_key_here
EOL

# Start PostgreSQL in Docker
npm run docker:db

# Wait 5 seconds for DB to be ready
sleep 5

# Run migrations
npx prisma migrate dev --name init

# Generate Prisma Client
npx prisma generate

# Start backend
npm run dev
```

Backend now running at `http://localhost:3001`

### 2. Frontend Setup (New Terminal)

```bash
cd frontend

# Already installed dependencies? Skip to environment setup
# Otherwise: Dependencies are already in package.json from npm install

# Create environment file
cat > .env.local << EOL
VITE_API_URL=http://localhost:3001
VITE_WS_URL=http://localhost:3001
EOL

# Start frontend
npm run dev
```

Frontend now running at `http://localhost:5173`

## Verify Setup

**Test Backend:**
```bash
curl http://localhost:3001/health
# Should return: {"status":"ok","timestamp":"..."}
```

**Test Frontend:**
Open browser to `http://localhost:5173`

**Test Database:**
```bash
cd backend
npx prisma studio
# Opens at http://localhost:5555
```

## Daily Development

```bash
# Start database (if not already running)
cd backend && npm run docker:db

# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend  
cd frontend && npm run dev

# Terminal 3 - Database GUI (optional)
cd backend && npx prisma studio
```

## Useful Commands

### Backend
```bash
npm run dev              # Start dev server
npm run prisma:studio    # Open database GUI
npm run prisma:migrate   # Run new migrations
npm run docker:db        # Start database
npm run docker:db:stop   # Stop database
```

### Frontend
```bash
npm run dev              # Start dev server
npm run build            # Production build
npm run lint             # Type check
```

## Troubleshooting

**Database won't start:**
```bash
docker ps -a                    # Check container status
docker logs parlay-streak-db    # Check logs
npm run docker:db:stop && npm run docker:db  # Restart
```

**Port already in use:**
```bash
# Backend (3001)
lsof -ti:3001 | xargs kill -9

# Frontend (5173)
lsof -ti:5173 | xargs kill -9
```

**Prisma issues:**
```bash
npx prisma generate    # Regenerate client
npx prisma db push     # Push schema without migration
```

## Tech Stack Reference

- **Backend:** Node.js + Express + TypeScript + Prisma
- **Frontend:** Vite + React + TypeScript + Tailwind v4
- **Database:** PostgreSQL (Docker)
- **Real-time:** Socket.io
- **Auth:** Session-based (express-session)

## Next Steps

See [SETUP.md](./SETUP.md) for detailed documentation.

Start building:
1. Authentication flows (`backend/src/routes/auth.routes.ts`)
2. Game management endpoints
3. Parlay builder UI
4. Real-time updates with Socket.io

