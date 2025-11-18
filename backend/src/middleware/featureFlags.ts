import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Feature Flags Configuration
 * Control which features are enabled/disabled via environment variables
 */
export const FeatureFlags = {
  // Authentication features
  AUTH_REGISTRATION: process.env.FEATURE_AUTH_REGISTRATION !== 'false', // Default: enabled
  AUTH_LOGIN: process.env.FEATURE_AUTH_LOGIN !== 'false', // Default: enabled
  AUTH_MAGIC_LINKS: process.env.FEATURE_AUTH_MAGIC_LINKS !== 'false', // Default: enabled
  
  // Public features
  PUBLIC_BETS_VIEW: process.env.FEATURE_PUBLIC_BETS_VIEW !== 'false', // Default: enabled
  PUBLIC_LEADERBOARDS: process.env.FEATURE_PUBLIC_LEADERBOARDS !== 'false', // Default: enabled
  
  // User features
  USER_PARLAYS: process.env.FEATURE_USER_PARLAYS !== 'false', // Default: enabled
  USER_PROFILE: process.env.FEATURE_USER_PROFILE !== 'false', // Default: enabled
  
  // Admin features
  ADMIN_BET_MANAGEMENT: process.env.FEATURE_ADMIN_BET_MANAGEMENT !== 'false', // Default: enabled
  ADMIN_GAME_MANAGEMENT: process.env.FEATURE_ADMIN_GAME_MANAGEMENT !== 'false', // Default: enabled
};

/**
 * Middleware to check if a feature is enabled
 * Returns 503 Service Unavailable if feature is disabled
 */
export const requireFeature = (feature: keyof typeof FeatureFlags) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!FeatureFlags[feature]) {
      logger.warn('Feature disabled', { 
        feature, 
        path: req.path, 
        method: req.method,
        ip: req.ip 
      });
      
      return res.status(503).json({
        success: false,
        error: {
          message: 'This feature is currently unavailable',
          code: 'FEATURE_DISABLED',
          feature
        }
      });
    }
    
    next();
  };
};

/**
 * Middleware to check if the app is in maintenance mode
 * If ENABLE_MAINTENANCE_MODE=true, all non-admin routes return 503
 */
export const checkMaintenanceMode = (req: Request, res: Response, next: NextFunction) => {
  const maintenanceMode = process.env.ENABLE_MAINTENANCE_MODE === 'true';
  
  if (!maintenanceMode) {
    return next();
  }

  // Allow admin routes even in maintenance mode
  if (req.path.startsWith('/api/admin')) {
    return next();
  }

  logger.info('Request blocked by maintenance mode', { 
    path: req.path, 
    method: req.method,
    ip: req.ip 
  });

  res.status(503).json({
    success: false,
    error: {
      message: 'The application is currently under maintenance. Please check back soon.',
      code: 'MAINTENANCE_MODE'
    }
  });
};

/**
 * Get current feature flag status (for admin/debugging)
 */
export const getFeatureFlags = () => {
  return {
    ...FeatureFlags,
    maintenanceMode: process.env.ENABLE_MAINTENANCE_MODE === 'true'
  };
};

