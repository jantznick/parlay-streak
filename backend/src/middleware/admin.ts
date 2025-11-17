import { Request, Response, NextFunction } from 'express';
import { AuthenticationError } from './errorHandler';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Extend session type to include user data
declare module 'express-session' {
  interface SessionData {
    userId: string;
    userEmail?: string;
  }
}

/**
 * Middleware to require admin access
 * Checks if the logged-in user's email is in the ADMIN_EMAILS env variable
 */
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // First check if user is authenticated
    if (!req.session.userId) {
      throw new AuthenticationError('Authentication required');
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: req.session.userId },
      select: { email: true }
    });

    if (!user) {
      throw new AuthenticationError('User not found');
    }

    // Check if user email is in admin list
    const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(email => email.trim()) || [];
    
    if (!adminEmails.includes(user.email)) {
      return res.status(403).json({ 
        success: false,
        error: { 
          message: 'Admin access required', 
          code: 'FORBIDDEN' 
        } 
      });
    }

    // Store email in session for future requests
    req.session.userEmail = user.email;

    next();
  } catch (error) {
    next(error);
  }
};

