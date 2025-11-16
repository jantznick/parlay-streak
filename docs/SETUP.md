# Parlay Streak - Setup Guide

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+
- Git

## Project Structure

```
parlay-streak/
├── backend/          # Express API server
├── frontend/         # Vite React SPA
├── shared/           # Shared types, utils, constants
└── app/              # React Native (future)
```

---

## Backend Setup

### 1. Install Dependencies

```bash
cd backend

# Core dependencies
npm install express cors helmet compression express-session connect-pg-simple @prisma/client bcrypt socket.io uuid winston dotenv joi pg

# Dev dependencies
npm install -D typescript @types/express @types/node @types/cors @types/bcrypt @types/express-session @types/uuid @types/pg nodemon ts-node prisma
```

### 2. Environment Setup

Create `backend/.env`:

```env
NODE_ENV=development
PORT=3001

# Database (Docker PostgreSQL)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/parlay_streak?schema=public"

# Session
SESSION_SECRET=your-secret-key-change-this-in-production

# CORS
CORS_ORIGIN=http://localhost:5173

# Resend Email (get key from resend.com)
RESEND_API_KEY=re_your_api_key_here
```

### 3. Database Setup (Docker)

```bash
# Start PostgreSQL in Docker
npm run docker:db

# Wait for database to be ready (check with docker ps)
# The database will be accessible at localhost:5432
# Credentials: postgres/postgres, database: parlay_streak

# Run Prisma migrations
npx prisma migrate dev --name init

# Generate Prisma Client
npx prisma generate

# (Optional) Open Prisma Studio to view database
npx prisma studio

# To stop the database:
npm run docker:db:stop
```

**Database Connection String:**
```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/parlay_streak?schema=public"
```

### 4. Package Scripts (Already Updated)

The backend package.json has been updated with scripts:
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm run start` - Run production build
- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio GUI
- `npm run docker:db` - Start PostgreSQL in Docker
- `npm run docker:db:stop` - Stop Docker database

### 5. Start Development Server

```bash
npm run dev
```

Server runs at: `http://localhost:3001`

---

## Frontend Setup

### 1. Install Dependencies

```bash
cd frontend

# Core dependencies
npm install react react-dom react-router-dom zustand socket.io-client

# Dev dependencies
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom tailwindcss postcss autoprefixer
```

### 2. Tailwind CSS v4 Setup

Tailwind v4 is already configured with the Vite plugin. The setup uses:
- `@import "tailwindcss"` in CSS (not `@tailwind` directives)
- Vite plugin instead of PostCSS
- Optional `tailwind.config.js` for customization

### 3. shadcn/ui Components

shadcn/ui components should be manually copied from [ui.shadcn.com](https://ui.shadcn.com/) as needed. 

To add a component:
1. Visit https://ui.shadcn.com/docs/components
2. Copy the component code
3. Paste into `src/components/ui/`
4. Adjust imports and styling as needed

### 4. Environment Setup

Create `frontend/.env.local`:

```env
VITE_API_URL=http://localhost:3001
VITE_WS_URL=http://localhost:3001
```

### 5. Package Scripts (Already Updated)

The frontend package.json has been updated with scripts:
- `npm run dev` - Start Vite development server
- `npm run build` - Build for production (TypeScript check + Vite build)
- `npm run preview` - Preview production build
- `npm run lint` - Type check without emitting files

### 6. Start Development Server

```bash
npm run dev
```

App runs at: `http://localhost:5173`

---

## Shared Package Setup

The `shared/` directory contains TypeScript files that don't need installation - they're imported directly by backend and frontend using path aliases.

No setup needed, but make sure:
- Backend `tsconfig.json` has paths configured (already done)
- Frontend `tsconfig.json` has paths configured (already done)
- Frontend `vite.config.ts` has alias configured (already done)

---

## Verification

### Test Backend

```bash
curl http://localhost:3001/health
# Should return: {"status":"ok","timestamp":"..."}

curl http://localhost:3001/api
# Should return: {"message":"Parlay Streak API","version":"1.0.0"}
```

### Test Frontend

Open browser to `http://localhost:5173`
- Should see Parlay Streak landing page
- Counter should increment when clicked

### Test Database

```bash
cd backend
npx prisma studio
```

Should open Prisma Studio at `http://localhost:5555`

---

## Development Workflow

### Running Everything

**Terminal 1 - Backend:**
```bash
cd backend
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

**Terminal 3 - Database GUI (optional):**
```bash
cd backend
npx prisma studio
```

---

## Troubleshooting

### PostgreSQL Connection Issues

```bash
# Check if Docker container is running
docker ps | grep parlay-streak-db

# Start the database if not running
cd backend && npm run docker:db

# Check container logs
docker logs parlay-streak-db

# Restart container
npm run docker:db:stop
npm run docker:db

# Check connection string in .env
# Should be: postgresql://postgres:postgres@localhost:5432/parlay_streak?schema=public
```

### Port Already in Use

```bash
# Kill process on port 3001 (backend)
lsof -ti:3001 | xargs kill -9

# Kill process on port 5173 (frontend)
lsof -ti:5173 | xargs kill -9
```

### Prisma Issues

```bash
# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Regenerate Prisma Client
npx prisma generate

# Format Prisma schema
npx prisma format
```

### Module Not Found Errors

```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

---

## Next Steps

1. **Authentication:** Implement login/register flows
2. **Game Management:** Create admin endpoints for games/bets
3. **Parlay Builder:** Build frontend parlay creation UI
4. **Real-time Updates:** Connect Socket.io between backend/frontend
5. **Leaderboards:** Implement leaderboard queries and UI
6. **Resolution Engine:** Build bet/parlay resolution logic

---

## Production Build

### Backend

```bash
cd backend
npm run build
npm start
```

### Frontend

```bash
cd frontend
npm run build
npm run preview
```

---

## Docker Setup (Production)

Coming soon...

---

## Additional Resources

- [Express Documentation](https://expressjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Socket.io Documentation](https://socket.io/docs/)

