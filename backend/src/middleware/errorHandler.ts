import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// Custom error classes
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

// Global error handler middleware
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Log error
  logger.error(`Error: ${err.message}`, { stack: err.stack });

  // Handle known errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        message: err.message,
        code: err.code,
      },
    });
  }

  // Handle Prisma errors
  if (err.constructor.name.includes('Prisma')) {
    return res.status(400).json({
      success: false,
      error: {
        message: 'Database error',
        code: 'DATABASE_ERROR',
      },
    });
  }

  // Handle unknown errors
  const statusCode = 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      code: 'INTERNAL_ERROR',
    },
  });
};

