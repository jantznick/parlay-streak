/**
 * Shared validation rules for authentication
 * Used by both backend (with Joi) and frontend (for client-side validation)
 */

export const AUTH_VALIDATION = {
  username: {
    minLength: 3,
    maxLength: 30,
    pattern: /^[a-zA-Z0-9]+$/,
    patternMessage: 'Username must be alphanumeric (letters and numbers only)',
  },
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    patternMessage: 'Please enter a valid email address',
  },
  password: {
    minLength: 6,
    maxLength: 128,
  },
} as const;

// Helper functions for validation
export const validateUsername = (username: string): string | null => {
  if (username.length < AUTH_VALIDATION.username.minLength) {
    return `Username must be at least ${AUTH_VALIDATION.username.minLength} characters`;
  }
  if (username.length > AUTH_VALIDATION.username.maxLength) {
    return `Username must be no more than ${AUTH_VALIDATION.username.maxLength} characters`;
  }
  if (!AUTH_VALIDATION.username.pattern.test(username)) {
    return AUTH_VALIDATION.username.patternMessage;
  }
  return null;
};

export const validateEmail = (email: string): string | null => {
  if (!AUTH_VALIDATION.email.pattern.test(email)) {
    return AUTH_VALIDATION.email.patternMessage;
  }
  return null;
};

export const validatePassword = (password: string): string | null => {
  if (password.length < AUTH_VALIDATION.password.minLength) {
    return `Password must be at least ${AUTH_VALIDATION.password.minLength} characters`;
  }
  if (password.length > AUTH_VALIDATION.password.maxLength) {
    return `Password must be no more than ${AUTH_VALIDATION.password.maxLength} characters`;
  }
  return null;
};

