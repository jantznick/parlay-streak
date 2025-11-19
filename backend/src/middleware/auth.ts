import { Request, Response, NextFunction } from 'express';
import { AuthenticationError } from './errorHandler';
import { logger } from '../utils/logger';

// Extend Express Request type to include session userId
declare module 'express-session' {
  interface SessionData {
    userId: string;
  }
}

// Get allowed CORS origins from environment
const corsOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://localhost:5173'];

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  // Check authentication
  if (!req.session.userId) {
    throw new AuthenticationError('Authentication required');
  }

  // Verify Origin header for CSRF protection
  const origin = req.headers.origin;
  
  // Block requests without Origin header - required for CSRF protection
  if (!origin) {
    logger.warn('Authenticated request blocked: no Origin header', {
      method: req.method,
      path: req.path,
      userId: req.session.userId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return res.status(403).json({
      success: false,
      error: {
        message: 'Forbidden: Origin header required',
        code: 'FORBIDDEN_NO_ORIGIN',
      },
    });
  }
  
  // Verify Origin matches allowed CORS origins
  if (!corsOrigins.includes(origin)) {
    logger.warn('Authenticated request blocked: unauthorized origin', {
      method: req.method,
      path: req.path,
      origin,
      userId: req.session.userId,
      allowedOrigins: corsOrigins,
      ip: req.ip,
    });
    return res.status(403).json({
      success: false,
      error: {
        message: 'Forbidden: Origin not allowed',
        code: 'FORBIDDEN_ORIGIN',
      },
    });
  }

  next();
};

