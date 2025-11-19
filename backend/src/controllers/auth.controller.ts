import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import Joi from 'joi';
import { randomBytes } from 'crypto';
import prisma from '../config/database';
import { ValidationError, AuthenticationError } from '../middleware/errorHandler';
import { AUTH_VALIDATION } from '@shared/validation/auth';
import { sendMagicLinkEmail } from '../utils/email';

// Validation schemas using shared constants
const registerSchema = Joi.object({
  username: Joi.string()
    .alphanum()
    .min(AUTH_VALIDATION.username.minLength)
    .max(AUTH_VALIDATION.username.maxLength)
    .required()
    .messages({
      'string.alphanum': AUTH_VALIDATION.username.patternMessage,
    }),
  email: Joi.string().email().required(),
  password: Joi.string()
    .min(AUTH_VALIDATION.password.minLength)
    .max(AUTH_VALIDATION.password.maxLength)
    .required(),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const magicLinkSchema = Joi.object({
  email: Joi.string().email().required(),
});

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate input
    const { error, value } = registerSchema.validate(req.body);
    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const { username, email, password } = value;

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      throw new ValidationError('Username or email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
      },
      select: {
        id: true,
        username: true,
        email: true,
        currentStreak: true,
        longestStreak: true,
        totalPointsEarned: true,
        createdAt: true,
      },
    });

    // Set session
    req.session.userId = user.id;
    
    // Explicitly save session to ensure cookie is set
    req.session.save((err) => {
      if (err) {
        return next(err);
      }
      
      res.status(201).json({
        success: true,
        data: { user },
      });
    });
  } catch (err) {
    next(err);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate input
    const { error, value } = loginSchema.validate(req.body);
    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const { email, password } = value;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Check password
    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      throw new AuthenticationError('Invalid email or password');
    }

    // Set session
    req.session.userId = user.id;
    
    // Explicitly save session to ensure cookie is set
    req.session.save((err) => {
      if (err) {
        return next(err);
      }
      
      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            currentStreak: user.currentStreak,
            longestStreak: user.longestStreak,
            totalPointsEarned: user.totalPointsEarned,
          },
        },
      });
    });
  } catch (err) {
    next(err);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        throw new Error('Failed to logout');
      }
      res.clearCookie('parlay.sid');
      res.json({
        success: true,
        data: { message: 'Logged out successfully' },
      });
    });
  } catch (err) {
    next(err);
  }
};

export const getCurrentUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      throw new AuthenticationError('Not authenticated');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        currentStreak: true,
        longestStreak: true,
        totalPointsEarned: true,
        insuranceLocked: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new AuthenticationError('User not found');
    }

    // Check if user is admin
    const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(email => email.trim()) || [];
    const isAdmin = adminEmails.includes(user.email);

    res.json({
      success: true,
      data: { 
        user: {
          ...user,
          isAdmin,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

export const requestMagicLink = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate input
    const { error, value } = magicLinkSchema.validate(req.body);
    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const { email } = value;

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Auto-create user with magic link (no password)
      const username = email.split('@')[0] + Math.random().toString(36).substring(7);
      user = await prisma.user.create({
        data: {
          username,
          email,
          passwordHash: null, // No password for magic link users
        },
      });
    }

    // Generate magic link token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Save token to database
    await prisma.authToken.create({
      data: {
        userId: user.id,
        token,
        tokenType: 'magic_link',
        expiresAt,
      },
    });

    // Send email with magic link
    const magicLink = `${process.env.CORS_ORIGIN}/auth/verify?token=${token}`;
    await sendMagicLinkEmail(email, magicLink);

    res.json({
      success: true,
      data: { message: 'Magic link sent to your email' },
    });
  } catch (err) {
    next(err);
  }
};

export const verifyMagicLink = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      throw new ValidationError('Invalid token');
    }

    // Find token in database
    const authToken = await prisma.authToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!authToken) {
      throw new AuthenticationError('Invalid or expired magic link');
    }

    // Check if token is expired
    if (authToken.expiresAt < new Date()) {
      throw new AuthenticationError('Magic link has expired');
    }

    // Check if token was already used
    if (authToken.usedAt) {
      throw new AuthenticationError('Magic link has already been used');
    }

    // Mark token as used
    await prisma.authToken.update({
      where: { id: authToken.id },
      data: { usedAt: new Date() },
    });

    // Set session
    req.session.userId = authToken.userId;
    
    // Explicitly save session to ensure cookie is set
    req.session.save((err) => {
      if (err) {
        return next(err);
      }
      
      res.json({
        success: true,
        data: {
          user: {
            id: authToken.user.id,
            username: authToken.user.username,
            email: authToken.user.email,
            currentStreak: authToken.user.currentStreak,
            longestStreak: authToken.user.longestStreak,
            totalPointsEarned: authToken.user.totalPointsEarned,
          },
        },
      });
    });
  } catch (err) {
    next(err);
  }
};

