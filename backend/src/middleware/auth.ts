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

/**
 * Base authentication middleware - checks session and CSRF protection
 * Does NOT check email verification (use requireAuth for that)
 */
const requireAuthBase = (req: Request, res: Response, next: NextFunction) => {
  // Check authentication
  if (!req.session.userId) {
    throw new AuthenticationError('Authentication required');
  }

  // Verify Origin header for CSRF protection
  // Mobile apps don't send Origin headers, but they still require valid session cookies
  // Browsers will send Origin headers, which we validate for CSRF protection
  const origin = req.headers.origin;
  
  // If no Origin header, allow the request (mobile apps, curl, etc.)
  // They still need valid session cookies, so security is maintained
  if (!origin) {
    logger.debug('Authenticated request without Origin header (likely mobile app)', {
      method: req.method,
      path: req.path,
      userId: req.session.userId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    return next();
  }
  
  // Origin header present - validate it for browser CSRF protection
  // Browsers enforce Origin headers and can't be spoofed by JavaScript
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

/**
 * Main authentication middleware - requires authentication AND email verification
 * Use this for all app features that require verified users
 */
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  // First check base auth (session + CSRF)
  requireAuthBase(req, res, async () => {
    // Check email verification - users must verify email before accessing app features
    // Import prisma here to avoid circular dependencies
    const prisma = (await import('../config/database')).default;

    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
      select: { emailVerified: true },
    });

    if (!user) {
      throw new AuthenticationError('User not found');
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        error: {
          message: 'Email verification required. Please verify your email address to access this feature.',
          code: 'EMAIL_NOT_VERIFIED',
        },
      });
    }

    next();
  });
};

/**
 * Authentication middleware without email verification requirement
 * Use this for routes that need to work before email verification (e.g., /api/auth/me, /api/auth/verify-email/resend)
 */
export const requireAuthOnly = requireAuthBase;

/**
 * Middleware to require email verification
 * Must be used after requireAuthOnly
 * @deprecated Use requireAuth instead, which includes email verification check
 */
export const requireEmailVerification = async (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    throw new AuthenticationError('Authentication required');
  }

  // Import prisma here to avoid circular dependencies
  const prisma = (await import('../config/database')).default;

  const user = await prisma.user.findUnique({
    where: { id: req.session.userId },
    select: { emailVerified: true },
  });

  if (!user) {
    throw new AuthenticationError('User not found');
  }

  if (!user.emailVerified) {
    return res.status(403).json({
      success: false,
      error: {
        message: 'Email verification required',
        code: 'EMAIL_NOT_VERIFIED',
      },
    });
  }

  next();
};

