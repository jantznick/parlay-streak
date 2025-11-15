# Parlay Streak

A social sports prediction game where players build winning streaks by making smart picks on live sporting events.

## 📁 Project Structure

```
parlay-streak/
├── backend/              # Express API (Node.js + TypeScript + Prisma)
├── frontend/             # Web App (Vite + React + TypeScript + Tailwind)
├── shared/               # Shared code (types, utils, constants)
├── app/                  # Mobile App (React Native - future)
├── PRODUCT_OVERVIEW.md   # Detailed product specification
├── TECH_REQUIREMENTS.md  # Technical requirements document
└── SETUP.md              # Installation and setup guide
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- npm

### Installation

See [SETUP.md](./SETUP.md) for detailed installation instructions.

**Quick version:**

```bash
# Backend
cd backend
npm install
# Create .env file (see SETUP.md)
npx prisma migrate dev
npm run dev

# Frontend (in new terminal)
cd frontend
npm install
npm run dev
```

## 📚 Documentation

- **[PRODUCT_OVERVIEW.md](./PRODUCT_OVERVIEW.md)** - Complete product specification, game mechanics, and rules
- **[TECH_REQUIREMENTS.md](./TECH_REQUIREMENTS.md)** - Technical architecture and implementation details
- **[SETUP.md](./SETUP.md)** - Step-by-step setup and installation guide
- **[backend/README.md](./backend/README.md)** - Backend API documentation
- **[frontend/README.md](./frontend/README.md)** - Frontend app documentation

## 🎮 What is Parlay Streak?

Players build winning streaks by creating parlays from live sporting events:
- **Build parlays** - Combine 1-5 bets from any games
- **Watch them resolve** - Real-time updates as games finish
- **Manage risk** - Insurance system for big parlays
- **Compete** - Climb leaderboards with longest streaks

### Key Features
- Cross-game parlays (combine bets from multiple games)
- Multiple simultaneous parlays
- Strategic insurance system
- Real-time WebSocket updates
- Leaderboards and competitions

## 🛠️ Tech Stack

### Backend
- Node.js + Express
- TypeScript
- PostgreSQL + Prisma ORM
- Socket.io (WebSockets)
- Session-based authentication

### Frontend
- Vite + React
- TypeScript
- TailwindCSS + shadcn/ui
- Socket.io client
- Zustand (state management)

### Shared
- TypeScript types
- Game logic utilities
- Constants

## 📦 Monorepo Structure

This is a monorepo containing:
1. **Backend API** - RESTful API + WebSocket server
2. **Frontend Web App** - React SPA
3. **Shared Code** - Types, utils, constants used by all apps
4. **Mobile App** (future) - React Native

Code sharing via TypeScript path aliases:
```typescript
import { User } from '@shared/types';
import { calculateParlayValue } from '@shared/utils';
```

## 🔧 Development

### Running Locally

**Backend** (port 3001):
```bash
cd backend && npm run dev
```

**Frontend** (port 5173):
```bash
cd frontend && npm run dev
```

**Database GUI**:
```bash
cd backend && npx prisma studio
```

### Key Commands

```bash
# Backend
npm run dev              # Start dev server
npm run build            # Build for production
npx prisma migrate dev   # Run database migrations
npx prisma studio        # Open database GUI

# Frontend
npm run dev              # Start dev server
npm run build            # Build for production
npm run preview          # Preview production build
```

## 🎯 Current Status

**✅ Completed:**
- Project structure and boilerplate
- Database schema (Prisma)
- Basic Express server setup
- Basic React frontend
- Shared constants and utilities
- Session-based auth setup
- WebSocket infrastructure

**🚧 In Progress:**
- Authentication flows
- Game/bet management
- Parlay builder UI
- Resolution engine

**📋 Planned:**
- Admin dashboard
- Leaderboards
- Mobile app
- Real-time notifications

## 🤝 Contributing

This is a private project. See internal documentation for contribution guidelines.

## 📄 License

Proprietary - All rights reserved

---

**Built with ❤️ for sports fans who love strategy**

