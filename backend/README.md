# Parlay Streak Backend API

## Installation

```bash
cd backend
npm install
```

### Required Packages

```bash
npm install express cors helmet compression express-session connect-pg-simple @prisma/client bcrypt socket.io uuid winston dotenv joi pg swagger-jsdoc swagger-ui-express
npm install -D typescript @types/express @types/node @types/cors @types/bcrypt @types/express-session @types/uuid @types/pg @types/swagger-jsdoc @types/swagger-ui-express nodemon ts-node prisma tsconfig-paths
```

## Setup

1. Copy `env.example` to `.env` and configure your environment variables:
   ```bash
   cp env.example .env
   ```
2. Start PostgreSQL in Docker:
   ```bash
   npm run docker:db
   ```
3. Run Prisma migrations:
   ```bash
   npx prisma migrate dev
   ```
4. Generate Prisma client:
   ```bash
   npx prisma generate
   ```

## Development

```bash
npm run dev
```

Server will run on `http://localhost:3001`

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Run production build
- `npm run prisma:generate` - Generate Prisma client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio (database GUI)

## API Documentation

Swagger documentation available at: `http://localhost:3001/api-docs`

## Project Structure

```
backend/
├── src/
│   ├── index.ts              # Entry point
│   ├── app.ts                # Express app setup
│   ├── routes/               # API routes
│   ├── controllers/          # Route controllers
│   ├── middleware/           # Custom middleware
│   ├── services/             # Business logic
│   ├── utils/                # Utility functions
│   ├── types/                # TypeScript types
│   └── config/               # Configuration files
├── prisma/
│   ├── schema.prisma         # Database schema
│   └── migrations/           # Database migrations
└── swagger/                  # Swagger/OpenAPI definitions
```

