import { Router } from 'express';
import { logger } from '../utils/logger';

const router = Router();

// Example route
router.get('/', (req, res) => {
  res.json({ 
    success: true, 
    data: { message: 'Example route working' } 
  });
});

// Example with error handling
router.get('/error', (req, res, next) => {
  try {
    throw new Error('Test error');
  } catch (error) {
    next(error);
  }
});

export default router;

