import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import Joi from 'joi';
import { randomBytes } from 'crypto';
import prisma from '../config/database';
import { ValidationError, AuthenticationError } from '../middleware/errorHandler';
import { AUTH_VALIDATION } from '@shared/validation/auth';
import { sendMagicLinkEmail, sendVerificationEmail, sendPasswordResetEmail } from '../utils/email';
import { logger } from '../utils/logger';

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

const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required(),
});

const resetPasswordSchema = Joi.object({
  token: Joi.string().required(),
  password: Joi.string()
    .min(AUTH_VALIDATION.password.minLength)
    .max(AUTH_VALIDATION.password.maxLength)
    .required(),
  confirmPassword: Joi.string().required().valid(Joi.ref('password')),
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

    // Generate verification token
    const verificationToken = randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user
    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
        emailVerified: false,
      },
      select: {
        id: true,
        username: true,
        email: true,
        emailVerified: true,
        currentStreak: true,
        longestStreak: true,
        totalPointsEarned: true,
        createdAt: true,
      },
    });

    // Create auth token for tracking
    await prisma.authToken.create({
      data: {
        userId: user.id,
        token: verificationToken,
        tokenType: 'email_verification',
        expiresAt: verificationExpires,
      },
    });

    // Send verification email
    const verificationLink = `${process.env.CORS_ORIGIN}/verify-email?token=${verificationToken}`;
    await sendVerificationEmail(email, verificationLink);

    // Set session
    req.session.userId = user.id;
    
    // Explicitly save session to ensure cookie is set
    req.session.save((err) => {
      if (err) {
        return next(err);
      }
      
      res.status(201).json({
        success: true,
        data: { 
          user,
          message: 'Registration successful. Please check your email to verify your account.',
        },
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
    
    // Log session info for debugging
    logger.info('Setting session', { 
      userId: user.id, 
      sessionId: req.sessionID,
      cookie: req.session.cookie 
    });
    
    // Explicitly save session to ensure cookie is set
    req.session.save((err) => {
      if (err) {
        logger.error('Session save error', { error: err });
        return next(err);
      }
      
      // Log that session was saved
      logger.info('Session saved successfully', { 
        sessionId: req.sessionID,
        cookie: req.session.cookie 
      });
      
      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.username,
            email: user.email,
            emailVerified: user.emailVerified,
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
        emailVerified: true,
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
            emailVerified: authToken.user.emailVerified,
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

// Rate limiting helper (simple in-memory store - use Redis in production)
const emailRequestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS_PER_HOUR = 3;

function checkRateLimit(email: string): boolean {
  const now = Date.now();
  const record = emailRequestCounts.get(email);

  if (!record || now > record.resetAt) {
    emailRequestCounts.set(email, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.count >= MAX_REQUESTS_PER_HOUR) {
    return false;
  }

  record.count++;
  return true;
}

export const resendVerificationEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.session.userId;

    if (!userId) {
      throw new AuthenticationError('Authentication required');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AuthenticationError('User not found');
    }

    if (user.emailVerified) {
      throw new ValidationError('Email is already verified');
    }

    // Check rate limit
    if (!checkRateLimit(user.email)) {
      throw new ValidationError('Too many requests. Please try again later.');
    }

    // Generate new verification token
    const verificationToken = randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Invalidate old token
    await prisma.authToken.updateMany({
      where: {
        userId: user.id,
        tokenType: 'email_verification',
        usedAt: null,
      },
      data: {
        usedAt: new Date(), // Mark as used to invalidate
      },
    });

    // Update user with new token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
      },
    });

    // Create new auth token
    await prisma.authToken.create({
      data: {
        userId: user.id,
        token: verificationToken,
        tokenType: 'email_verification',
        expiresAt: verificationExpires,
      },
    });

    // Send verification email
    const verificationLink = `${process.env.CORS_ORIGIN}/verify-email?token=${verificationToken}`;
    await sendVerificationEmail(user.email, verificationLink);

    res.json({
      success: true,
      data: { message: 'Verification email sent' },
    });
  } catch (err) {
    next(err);
  }
};

export const verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      throw new ValidationError('Invalid token');
    }

    // Find user by verification token
    const user = await prisma.user.findUnique({
      where: { emailVerificationToken: token },
    });

    if (!user) {
      throw new ValidationError('Invalid verification token');
    }

    // Check if already verified
    if (user.emailVerified) {
      throw new ValidationError('Email is already verified');
    }

    // Check if token is expired
    if (!user.emailVerificationExpires || user.emailVerificationExpires < new Date()) {
      throw new ValidationError('Verification token has expired');
    }

    // Find auth token
    const authToken = await prisma.authToken.findUnique({
      where: { token },
    });

    if (!authToken) {
      throw new ValidationError('Invalid verification token');
    }

    // Check if token was already used
    if (authToken.usedAt) {
      throw new ValidationError('Verification token has already been used');
    }

    // Mark token as used
    await prisma.authToken.update({
      where: { id: authToken.id },
      data: { usedAt: new Date() },
    });

    // Mark email as verified
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpires: null,
      },
    });

    res.json({
      success: true,
      data: { message: 'Email verified successfully' },
    });
  } catch (err) {
    next(err);
  }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate input
    const { error, value } = forgotPasswordSchema.validate(req.body);
    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const { email } = value;

    // Find user (don't reveal if user exists for security)
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // Always return success to prevent user enumeration
    // Send email if user exists (including magic-link-only users who want to set a password)
    if (user) {
      // Check rate limit
      if (checkRateLimit(email)) {
        // Generate reset token
        const resetToken = randomBytes(32).toString('hex');
        const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        // Invalidate old reset tokens
        await prisma.authToken.updateMany({
          where: {
            userId: user.id,
            tokenType: 'password_reset',
            usedAt: null,
          },
          data: {
            usedAt: new Date(),
          },
        });

        // Create new reset token
        await prisma.authToken.create({
          data: {
            userId: user.id,
            token: resetToken,
            tokenType: 'password_reset',
            expiresAt: resetExpires,
          },
        });

        // Send reset email
        const resetLink = `${process.env.CORS_ORIGIN}/reset-password?token=${resetToken}`;
        await sendPasswordResetEmail(email, resetLink);
      }
    }

    // Always return success message
    res.json({
      success: true,
      data: {
        message: 'If an account exists with this email, a password reset link has been sent',
      },
    });
  } catch (err) {
    next(err);
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate input
    const { error, value } = resetPasswordSchema.validate(req.body);
    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const { token, password } = value;

    // Find auth token
    const authToken = await prisma.authToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!authToken) {
      throw new ValidationError('Invalid reset token');
    }

    // Check token type
    if (authToken.tokenType !== 'password_reset') {
      throw new ValidationError('Invalid reset token');
    }

    // Check if token is expired
    if (authToken.expiresAt < new Date()) {
      throw new ValidationError('Reset token has expired');
    }

    // Check if token was already used
    if (authToken.usedAt) {
      throw new ValidationError('Reset token has already been used');
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(password, 12);

    // Update user password
    await prisma.user.update({
      where: { id: authToken.userId },
      data: { passwordHash },
    });

    // Mark token as used
    await prisma.authToken.update({
      where: { id: authToken.id },
      data: { usedAt: new Date() },
    });

    // Invalidate all user sessions (force re-login)
    await prisma.session.deleteMany({
      where: { userId: authToken.userId },
    });

    res.json({
      success: true,
      data: { message: 'Password reset successfully' },
    });
  } catch (err) {
    next(err);
  }
};

