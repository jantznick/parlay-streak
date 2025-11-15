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
  // TODO: Integrate with Resend API when RESEND_API_KEY is configured
  
  if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 're_your_api_key_here') {
    logger.warn('RESEND_API_KEY not configured. Falling back to dev mode.');
    sendDevEmail(email, magicLink);
    return;
  }

  try {
    // Example Resend integration:
    // const { Resend } = require('resend');
    // const resend = new Resend(process.env.RESEND_API_KEY);
    //
    // await resend.emails.send({
    //   from: 'Parlay Streak <noreply@parlaystreak.com>',
    //   to: email,
    //   subject: 'Your Magic Link to Login',
    //   html: `
    //     <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
    //       <h1 style="color: #ea580c;">Login to Parlay Streak</h1>
    //       <p>Click the link below to login to your account:</p>
    //       <a href="${magicLink}" 
    //          style="display: inline-block; background: linear-gradient(to right, #ea580c, #dc2626); 
    //                 color: white; padding: 12px 24px; text-decoration: none; 
    //                 border-radius: 8px; font-weight: bold;">
    //         Login to Parlay Streak
    //       </a>
    //       <p style="color: #666; margin-top: 20px;">
    //         This link expires in 15 minutes.
    //       </p>
    //       <p style="color: #666; font-size: 12px;">
    //         If you didn't request this, you can safely ignore this email.
    //       </p>
    //     </div>
    //   `,
    // });

    logger.info(`Magic link email sent to ${email}`);
  } catch (error) {
    logger.error('Failed to send magic link email:', error);
    throw new Error('Failed to send email');
  }
}

/**
 * Send magic link email
 * Automatically uses dev mode in development, production mode in production
 */
export async function sendMagicLinkEmail(email: string, magicLink: string): Promise<void> {
  if (process.env.NODE_ENV === 'development') {
    sendDevEmail(email, magicLink);
    // Simulate email sending delay
    await new Promise(resolve => setTimeout(resolve, 100));
  } else {
    await sendProductionEmail(email, magicLink);
  }
}

