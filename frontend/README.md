# Parlay Streak Frontend

React SPA built with Vite, TypeScript, and TailwindCSS.

## Installation

```bash
cd frontend
npm install
```

### Required Packages

```bash
# Core dependencies
npm install react react-dom react-router-dom zustand socket.io-client

# Dev dependencies
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom tailwindcss postcss autoprefixer

# Tailwind + shadcn/ui
npx shadcn-ui@latest init
```

## Setup

1. Install dependencies (see above)
2. Copy `env.example` to `.env.local` and configure:
   ```bash
   cp env.example .env.local
   ```
3. Run development server

## Development

```bash
npm run dev
```

App will run on `http://localhost:5173`

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Lint code (if configured)

## Environment Variables

Create a `.env.local` file:

```
VITE_API_URL=http://localhost:3001
VITE_WS_URL=http://localhost:3001
```

## Project Structure

```
frontend/
├── src/
│   ├── main.tsx              # Entry point
│   ├── App.tsx               # Root component
│   ├── components/           # React components
│   ├── pages/                # Page components
│   ├── hooks/                # Custom hooks
│   ├── store/                # Zustand stores
│   ├── services/             # API services
│   ├── utils/                # Utility functions
│   ├── types/                # TypeScript types
│   └── styles/               # Global styles
├── public/                   # Static assets
└── index.html                # HTML template
```

## Adding shadcn/ui Components

```bash
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add dialog
# etc.
```

