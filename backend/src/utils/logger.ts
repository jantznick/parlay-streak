import winston from 'winston';

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

// Create logger
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    logFormat
  ),
  transports: [
    // Console transport
    new winston.transports.Console({
      format: combine(colorize(), logFormat),
    }),
    // File transports (optional)
    // new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    // new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// Handle uncaught exceptions
logger.exceptions.handle(
  new winston.transports.Console({
    format: combine(colorize(), logFormat),
  })
);

// Handle unhandled promise rejections
logger.rejections.handle(
  new winston.transports.Console({
    format: combine(colorize(), logFormat),
  })
);

