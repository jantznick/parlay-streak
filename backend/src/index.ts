import dotenv from 'dotenv';
dotenv.config();

import httpServer from './app';
import { logger } from './utils/logger';

const PORT = process.env.PORT || 3001;

httpServer.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`);
  logger.info(`📚 API Docs: http://localhost:${PORT}/api-docs`);
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

