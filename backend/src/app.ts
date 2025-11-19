import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import session from 'express-session';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import swaggerUi from 'swagger-ui-express';

import { sessionConfig } from './config/session';
import { swaggerSpec } from './config/swagger';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { checkMaintenanceMode } from './middleware/featureFlags';

// Import routes
import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import betsRoutes from './routes/bets.routes';
import parlayRoutes from './routes/parlay.routes';
// import gameRoutes from './routes/game.routes';

const app = express();
const httpServer = createServer(app);

// Trust proxy - required for secure cookies behind reverse proxy (Render)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Handle CORS - support multiple origins
const corsOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://localhost:5173'];

// Initialize Socket.io
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: corsOrigins,
    credentials: true,
  },
});

// Make io accessible in routes
app.set('io', io);

// Middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false, // Allow cross-origin cookies
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin resources
}));
app.use(compression());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list
    if (corsOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // Log for debugging
      logger.warn('CORS blocked origin', { origin, allowedOrigins: corsOrigins });
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  exposedHeaders: ['Set-Cookie'], // Explicitly expose Set-Cookie header
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware
app.use(session(sessionConfig));

// Debug middleware to log session info
app.use((req, res, next) => {
  if (req.path.startsWith('/api/auth')) {
    logger.info('Session middleware', {
      path: req.path,
      hasSession: !!req.session,
      sessionId: req.sessionID,
      userId: req.session?.userId,
    });
  }
  next();
});

// Maintenance mode check (before routes)
app.use(checkMaintenanceMode);

// Request logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.get('/api', (req, res) => {
  res.json({ message: 'Parlay Streak API', version: '1.0.0' });
});

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Parlay Streak API Docs',
}));

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/bets', betsRoutes);
app.use('/api/parlays', parlayRoutes);
// app.use('/api/games', gameRoutes);

// Error handling
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: { message: 'Route not found', code: 'NOT_FOUND' } 
  });
});

// Socket.io connection handling
io.on('connection', (socket) => {
  logger.info(`Socket connected: ${socket.id}`);

  // Authentication check (implement later)
  // const sessionId = socket.handshake.auth.sessionId;
  
  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: ${socket.id}`);
  });
});

export default httpServer;

