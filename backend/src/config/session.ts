import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { Pool } from 'pg';

const PgSession = connectPgSimple(session);

// Create PostgreSQL connection pool for sessions
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const sessionConfig: session.SessionOptions = {
  store: new PgSession({
    pool: pgPool,
    tableName: 'session', // Must match Prisma schema
    createTableIfMissing: false, // Prisma handles table creation
  }),
  secret: process.env.SESSION_SECRET || 'your-secret-key-change-this',
  resave: false,
  saveUninitialized: false, // Don't save uninitialized sessions
  name: 'parlay.sid', // Custom session cookie name
  cookie: {
    secure: process.env.NODE_ENV === 'production', // true in production (requires HTTPS)
    httpOnly: true, // Prevent client-side JS from accessing cookie
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' required for cross-subdomain cookies in production
    domain: process.env.NODE_ENV === 'production' ? '.parlaystreak.com' : undefined, // Allow cookies across subdomains in production
    path: '/', // Ensure cookie is available for all paths
  },
  // Add rolling to refresh cookie on activity
  rolling: false,
  // Trust proxy for secure cookies behind reverse proxy
  proxy: process.env.NODE_ENV === 'production',
};

