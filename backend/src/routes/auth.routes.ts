import { Router } from 'express';
import * as authController from '../controllers/auth.controller';
import { requireAuth, requireAuthOnly } from '../middleware/auth';
import { requireFeature } from '../middleware/featureFlags';

const router = Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error
 */
router.post('/register', requireFeature('AUTH_REGISTRATION'), authController.register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', requireFeature('AUTH_LOGIN'), authController.login);

/**
 * Dev-only admin login (no password)
 * 
 * WARNING: This route is automatically disabled in production (see controller).
 * It is intended for local development to quickly assume an admin identity.
 */
router.post('/dev-login-admin', authController.devLoginAdmin);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 */
router.post('/logout', authController.logout);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Current user info
 *       401:
 *         description: Not authenticated
 */
router.get('/me', requireAuthOnly, authController.getCurrentUser);

/**
 * @swagger
 * /api/auth/magic-link/request:
 *   post:
 *     summary: Request a magic link via email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Magic link sent
 *       400:
 *         description: Invalid email
 */
router.post('/magic-link/request', requireFeature('AUTH_MAGIC_LINKS'), authController.requestMagicLink);

/**
 * @swagger
 * /api/auth/magic-link/verify:
 *   get:
 *     summary: Verify magic link token
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successfully authenticated
 *       401:
 *         description: Invalid or expired token
 */
router.get('/magic-link/verify', requireFeature('AUTH_MAGIC_LINKS'), authController.verifyMagicLink);

/**
 * @swagger
 * /api/auth/verify-email/resend:
 *   post:
 *     summary: Resend verification email
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Verification email sent
 *       401:
 *         description: Not authenticated
 *       400:
 *         description: Email already verified or rate limited
 */
router.post('/verify-email/resend', requireAuthOnly, authController.resendVerificationEmail);

/**
 * @swagger
 * /api/auth/verify-email:
 *   get:
 *     summary: Verify email address
 *     tags: [Auth]
 *     parameters:
 *       - in: query
 *         name: token
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid or expired token
 */
router.get('/verify-email', authController.verifyEmail);

/**
 * @swagger
 * /api/auth/forgot-password:
 *   post:
 *     summary: Request password reset
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset email sent (if account exists)
 */
router.post('/forgot-password', authController.forgotPassword);

/**
 * @swagger
 * /api/auth/reset-password:
 *   post:
 *     summary: Reset password
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - password
 *               - confirmPassword
 *             properties:
 *               token:
 *                 type: string
 *               password:
 *                 type: string
 *               confirmPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Invalid token or validation error
 */
router.post('/reset-password', authController.resetPassword);

/**
 * @swagger
 * /api/auth/profile/username:
 *   patch:
 *     summary: Update username
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *             properties:
 *               username:
 *                 type: string
 *     responses:
 *       200:
 *         description: Username updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 */
router.patch('/profile/username', requireAuth, authController.updateUsername);

/**
 * @swagger
 * /api/auth/profile/email:
 *   patch:
 *     summary: Update email
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Email updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 */
router.patch('/profile/email', requireAuth, authController.updateEmail);

/**
 * @swagger
 * /api/auth/profile/password:
 *   patch:
 *     summary: Update password
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *               - confirmPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *               confirmPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Not authenticated
 */
router.patch('/profile/password', requireAuth, authController.updatePassword);

export default router;

