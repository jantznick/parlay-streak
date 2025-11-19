import { logger } from './logger';

/**
 * Development Email Service
 * Bypasses actual email sending and logs to console for easy testing
 * 
 * TODO: Expand this function to support:
 * - Different email types (magic link, password reset, notifications, etc.)
 * - Email templates/formatting
 * - Attachments/embedded images
 * - Better testing utilities
 */
function sendDevEmail(email: string, magicLink: string): void {
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📧 MAGIC LINK EMAIL (Development Mode)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(`To:      ${email}`);
  console.log(`Subject: Login to Parlay Streak`);
  console.log('');
  console.log('Message:');
  console.log('  Click the link below to login:');
  console.log('');
  console.log(`  🔗 ${magicLink}`);
  console.log('');
  console.log('  This link expires in 15 minutes.');
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('💡 TIP: Copy the link above and paste it in your browser');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('\n');
}

/**
 * Production Email Service (Resend)
 */
async function sendProductionEmail(email: string, magicLink: string): Promise<void> {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 're_your_api_key_here') {
    logger.warn('RESEND_API_KEY not configured. Falling back to dev mode.');
    sendDevEmail(email, magicLink);
    return;
  }

  try {
    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Parlay Streak <onboarding@resend.dev>';
    
    await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: 'Login to Parlay Streak',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(to right, #ea580c, #dc2626); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Parlay Streak</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
            <h2 style="color: #111827; margin-top: 0;">Login to Your Account</h2>
            <p style="color: #4b5563; font-size: 16px;">Click the button below to securely login to your Parlay Streak account:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${magicLink}" 
                 style="display: inline-block; background: linear-gradient(to right, #ea580c, #dc2626); 
                        color: white; padding: 14px 28px; text-decoration: none; 
                        border-radius: 8px; font-weight: bold; font-size: 16px;">
                Login to Parlay Streak
              </a>
            </div>
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              <strong>⚠️ Important:</strong> This link expires in 15 minutes.
            </p>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              If you didn't request this login link, you can safely ignore this email. No changes have been made to your account.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `Login to Parlay Streak\n\nClick the link below to login to your account:\n\n${magicLink}\n\nThis link expires in 15 minutes.\n\nIf you didn't request this, you can safely ignore this email.`,
    });

    logger.info(`Magic link email sent to ${email} via Resend`);
  } catch (error: any) {
    logger.error('Failed to send magic link email via Resend', { 
      error: error.message,
      email 
    });
    // Fall back to dev mode if Resend fails
    logger.warn('Falling back to dev mode email');
    sendDevEmail(email, magicLink);
  }
}

/**
 * Send welcome/registration email
 */
function sendDevWelcomeEmail(email: string, username: string): void {
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📧 WELCOME EMAIL (Development Mode)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(`To:      ${email}`);
  console.log(`Subject: Welcome to Parlay Streak!`);
  console.log('');
  console.log('Message:');
  console.log(`  Welcome ${username}!`);
  console.log('');
  console.log('  Thank you for joining Parlay Streak!');
  console.log('  Start building your streak and compete with friends.');
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('\n');
}

async function sendProductionWelcomeEmail(email: string, username: string): Promise<void> {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 're_your_api_key_here') {
    logger.warn('RESEND_API_KEY not configured. Falling back to dev mode.');
    sendDevWelcomeEmail(email, username);
    return;
  }

  try {
    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Parlay Streak <onboarding@resend.dev>';
    
    await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: 'Welcome to Parlay Streak!',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(to right, #ea580c, #dc2626); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Parlay Streak</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
            <h2 style="color: #111827; margin-top: 0;">Welcome, ${username}!</h2>
            <p style="color: #4b5563; font-size: 16px;">Thank you for joining Parlay Streak! We're excited to have you on board.</p>
            <p style="color: #4b5563; font-size: 16px;">Start building your streak by creating parlays and competing with friends. The longer your streak, the more points you earn!</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.CORS_ORIGIN || 'http://localhost:5173'}/dashboard" 
                 style="display: inline-block; background: linear-gradient(to right, #ea580c, #dc2626); 
                        color: white; padding: 14px 28px; text-decoration: none; 
                        border-radius: 8px; font-weight: bold; font-size: 16px;">
                Go to Dashboard
              </a>
            </div>
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              <strong>What's next?</strong>
            </p>
            <ul style="color: #4b5563; font-size: 14px; padding-left: 20px;">
              <li>Browse today's available bets</li>
              <li>Create your first parlay</li>
              <li>Build your streak and climb the leaderboard</li>
            </ul>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              If you have any questions, feel free to reach out to our support team.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `Welcome to Parlay Streak!\n\nWelcome, ${username}!\n\nThank you for joining Parlay Streak! We're excited to have you on board.\n\nStart building your streak by creating parlays and competing with friends. The longer your streak, the more points you earn!\n\nGo to Dashboard: ${process.env.CORS_ORIGIN || 'http://localhost:5173'}/dashboard\n\nWhat's next?\n- Browse today's available bets\n- Create your first parlay\n- Build your streak and climb the leaderboard\n\nIf you have any questions, feel free to reach out to our support team.`,
    });

    logger.info(`Welcome email sent to ${email} via Resend`);
  } catch (error: any) {
    logger.error('Failed to send welcome email via Resend', { 
      error: error.message,
      email 
    });
    logger.warn('Falling back to dev mode email');
    sendDevWelcomeEmail(email, username);
  }
}

/**
 * Send password reset email
 */
function sendDevPasswordResetEmail(email: string, resetLink: string): void {
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📧 PASSWORD RESET EMAIL (Development Mode)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(`To:      ${email}`);
  console.log(`Subject: Reset Your Password`);
  console.log('');
  console.log('Message:');
  console.log('  We received a request to reset your password.');
  console.log('');
  console.log('  Click the link below to reset your password:');
  console.log('');
  console.log(`  🔗 ${resetLink}`);
  console.log('');
  console.log('  This link expires in 1 hour.');
  console.log('');
  console.log('  If you didn\'t request this, you can safely ignore this email.');
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('💡 TIP: Copy the link above and paste it in your browser');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('\n');
}

async function sendProductionPasswordResetEmail(email: string, resetLink: string): Promise<void> {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 're_your_api_key_here') {
    logger.warn('RESEND_API_KEY not configured. Falling back to dev mode.');
    sendDevPasswordResetEmail(email, resetLink);
    return;
  }

  try {
    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Parlay Streak <onboarding@resend.dev>';
    
    await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: 'Reset Your Password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(to right, #ea580c, #dc2626); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Parlay Streak</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
            <h2 style="color: #111827; margin-top: 0;">Reset Your Password</h2>
            <p style="color: #4b5563; font-size: 16px;">We received a request to reset your password for your Parlay Streak account.</p>
            <p style="color: #4b5563; font-size: 16px;">Click the button below to reset your password:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetLink}" 
                 style="display: inline-block; background: linear-gradient(to right, #ea580c, #dc2626); 
                        color: white; padding: 14px 28px; text-decoration: none; 
                        border-radius: 8px; font-weight: bold; font-size: 16px;">
                Reset Password
              </a>
            </div>
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              <strong>⚠️ Important:</strong> This link expires in 1 hour.
            </p>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              If you didn't request a password reset, you can safely ignore this email. Your password will not be changed.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `Reset Your Password\n\nWe received a request to reset your password for your Parlay Streak account.\n\nClick the link below to reset your password:\n\n${resetLink}\n\nThis link expires in 1 hour.\n\nIf you didn't request a password reset, you can safely ignore this email. Your password will not be changed.`,
    });

    logger.info(`Password reset email sent to ${email} via Resend`);
  } catch (error: any) {
    logger.error('Failed to send password reset email via Resend', { 
      error: error.message,
      email 
    });
    logger.warn('Falling back to dev mode email');
    sendDevPasswordResetEmail(email, resetLink);
  }
}

/**
 * Send magic link email
 * Automatically uses dev mode if RESEND_API_KEY is not configured or NODE_ENV is development, production mode otherwise
 */
export async function sendMagicLinkEmail(email: string, magicLink: string): Promise<void> {
  // Use dev mode if NODE_ENV is development OR Resend is not configured
  const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
  const resendNotConfigured = !process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 're_your_api_key_here';
  
  if (isDevelopment || resendNotConfigured) {
    // Use dev mode (console log) if in development or Resend not configured
    sendDevEmail(email, magicLink);
    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 100));
  } else {
    // Use Resend in production
    await sendProductionEmail(email, magicLink);
  }
}

/**
 * Send welcome/registration email
 * Automatically uses dev mode if RESEND_API_KEY is not configured or NODE_ENV is development, production mode otherwise
 */
export async function sendWelcomeEmail(email: string, username: string): Promise<void> {
  // Use dev mode if NODE_ENV is development OR Resend is not configured
  const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
  const resendNotConfigured = !process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 're_your_api_key_here';
  
  if (isDevelopment || resendNotConfigured) {
    // Use dev mode (console log) if in development or Resend not configured
    sendDevWelcomeEmail(email, username);
    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 100));
  } else {
    // Use Resend in production
    await sendProductionWelcomeEmail(email, username);
  }
}

/**
 * Send password reset email
 * Automatically uses dev mode if RESEND_API_KEY is not configured or NODE_ENV is development, production mode otherwise
 */
export async function sendPasswordResetEmail(email: string, resetLink: string): Promise<void> {
  // Use dev mode if NODE_ENV is development OR Resend is not configured
  const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
  const resendNotConfigured = !process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 're_your_api_key_here';
  
  if (isDevelopment || resendNotConfigured) {
    // Use dev mode (console log) if in development or Resend not configured
    sendDevPasswordResetEmail(email, resetLink);
    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 100));
  } else {
    // Use Resend in production
    await sendProductionPasswordResetEmail(email, resetLink);
  }
}

/**
 * Send email verification email
 */
function sendDevVerificationEmail(email: string, verificationLink: string): void {
  console.log('\n');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📧 EMAIL VERIFICATION EMAIL (Development Mode)');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');
  console.log(`To:      ${email}`);
  console.log(`Subject: Verify Your Email Address - Parlay Streak`);
  console.log('');
  console.log('Message:');
  console.log('  Welcome to Parlay Streak!');
  console.log('');
  console.log('  Please verify your email address by clicking the link below:');
  console.log('');
  console.log(`  🔗 ${verificationLink}`);
  console.log('');
  console.log('  This link expires in 24 hours.');
  console.log('');
  console.log('  If you didn\'t create an account, you can safely ignore this email.');
  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('💡 TIP: Copy the link above and paste it in your browser');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('\n');
}

async function sendProductionVerificationEmail(email: string, verificationLink: string): Promise<void> {
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 're_your_api_key_here') {
    logger.warn('RESEND_API_KEY not configured. Falling back to dev mode.');
    sendDevVerificationEmail(email, verificationLink);
    return;
  }

  try {
    const { Resend } = require('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);

    const fromEmail = process.env.RESEND_FROM_EMAIL || 'Parlay Streak <onboarding@resend.dev>';
    
    await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: 'Verify Your Email Address - Parlay Streak',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(to right, #ea580c, #dc2626); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Parlay Streak</h1>
          </div>
          <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
            <h2 style="color: #111827; margin-top: 0;">Verify Your Email Address</h2>
            <p style="color: #4b5563; font-size: 16px;">Welcome to Parlay Streak! Please verify your email address to complete your registration and start building your streak.</p>
            <p style="color: #4b5563; font-size: 16px;">Click the button below to verify your email address:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationLink}" 
                 style="display: inline-block; background: linear-gradient(to right, #ea580c, #dc2626); 
                        color: white; padding: 14px 28px; text-decoration: none; 
                        border-radius: 8px; font-weight: bold; font-size: 16px;">
                Verify Email Address
              </a>
            </div>
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              <strong>⚠️ Important:</strong> This link expires in 24 hours.
            </p>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              If you didn't create an account with Parlay Streak, you can safely ignore this email. No account will be created.
            </p>
          </div>
        </body>
        </html>
      `,
      text: `Verify Your Email Address\n\nWelcome to Parlay Streak! Please verify your email address to complete your registration and start building your streak.\n\nClick the link below to verify your email address:\n\n${verificationLink}\n\nThis link expires in 24 hours.\n\nIf you didn't create an account with Parlay Streak, you can safely ignore this email. No account will be created.`,
    });

    logger.info(`Verification email sent to ${email} via Resend`);
  } catch (error: any) {
    logger.error('Failed to send verification email via Resend', { 
      error: error.message,
      email 
    });
    logger.warn('Falling back to dev mode email');
    sendDevVerificationEmail(email, verificationLink);
  }
}

/**
 * Send email verification email
 * Automatically uses dev mode if RESEND_API_KEY is not configured or NODE_ENV is development, production mode otherwise
 */
export async function sendVerificationEmail(email: string, verificationLink: string): Promise<void> {
  // Use dev mode if NODE_ENV is development OR Resend is not configured
  const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
  const resendNotConfigured = !process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 're_your_api_key_here';
  
  if (isDevelopment || resendNotConfigured) {
    // Use dev mode (console log) if in development or Resend not configured
    sendDevVerificationEmail(email, verificationLink);
    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 100));
  } else {
    // Use Resend in production
    await sendProductionVerificationEmail(email, verificationLink);
  }
}

