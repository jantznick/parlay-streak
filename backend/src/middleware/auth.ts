import { Request, Response, NextFunction } from 'express';
import { AuthenticationError } from './errorHandler';

// Extend Express Request type to include session userId
declare module 'express-session' {
  interface SessionData {
    userId: string;
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session.userId) {
    throw new AuthenticationError('Authentication required');
  }
  next();
};

