import { Router, Request, Response } from 'express';
import { requireAuth } from '../../middleware/auth';
import { requireAdmin } from '../../middleware/admin';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * @swagger
 * /api/admin/feature-flags:
 *   get:
 *     summary: Get current feature flag status (admin only)
 *     tags: [Admin]
 *     security:
 *       - sessionAuth: []
 *     responses:
 *       200:
 *         description: Feature flags status
 */
router.get('/', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { getFeatureFlags } = require('../../middleware/featureFlags');
    const flags = getFeatureFlags();
    
    res.json({
      success: true,
      data: flags
    });
  } catch (error: any) {
    logger.error('Error fetching feature flags', { error });
    res.status(500).json({
      success: false,
      error: { message: error.message || 'Failed to fetch feature flags', code: 'SERVER_ERROR' }
    });
  }
});

export default router;

