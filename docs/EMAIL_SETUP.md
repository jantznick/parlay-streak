# Email Setup Guide

## Overview

The application uses **Resend** for sending emails (magic links, notifications, etc.). Resend provides a simple API and generous free tier.

## Quick Setup

### 1. Create Resend Account

1. Go to https://resend.com
2. Sign up for a free account
3. Verify your email address

### 2. Get API Key

1. Go to https://resend.com/api-keys
2. Click "Create API Key"
3. Give it a name (e.g., "Parlay Streak Production")
4. Copy the API key (starts with `re_`)

### 3. Configure Environment Variable

**Local Development** (`backend/.env`):
```bash
RESEND_API_KEY=re_your_actual_api_key_here
```

**Production (Railway/Render)**:
- Add `RESEND_API_KEY` to your environment variables in the hosting dashboard

### 4. (Optional) Set Custom "From" Email

By default, emails are sent from `onboarding@resend.dev`. This works but may go to spam.

**To use your own domain:**

1. **Add Domain in Resend**:
   - Go to https://resend.com/domains
   - Click "Add Domain"
   - Enter your domain (e.g., `parlaystreak.com`)
   - Follow DNS verification steps (add TXT/SPF/DKIM records)

2. **Set From Email**:
   ```bash
   RESEND_FROM_EMAIL=Parlay Streak <noreply@parlaystreak.com>
   ```

## Free Tier Limits

- **3,000 emails/month** (free)
- **100 emails/day** (free)
- After free tier: $20/month for 50,000 emails

## Testing

### Development Mode (No API Key)

If `RESEND_API_KEY` is not set or is the default value, emails are logged to the console:

```
📧 MAGIC LINK EMAIL (Development Mode)
To:      user@example.com
Subject: Login to Parlay Streak
🔗 http://localhost:5173/auth/verify?token=...
```

### Production Mode (With API Key)

When `RESEND_API_KEY` is configured, emails are sent via Resend API.

## Email Types

Currently implemented:
- ✅ **Magic Link** - Passwordless login emails

Future (not yet implemented):
- Password reset emails
- Welcome emails
- Bet resolution notifications
- Streak milestone notifications

## Troubleshooting

### Emails Not Sending

1. **Check API Key**:
   - Verify `RESEND_API_KEY` is set correctly
   - Make sure it starts with `re_`
   - Check for typos or extra spaces

2. **Check Logs**:
   - Look for "Magic link email sent to..." in logs
   - Check for Resend API errors

3. **Check Spam Folder**:
   - If using `onboarding@resend.dev`, emails may go to spam
   - Verify your domain in Resend to avoid spam

4. **Rate Limits**:
   - Free tier: 100 emails/day
   - Check Resend dashboard for rate limit errors

### Domain Verification Issues

If you're trying to use a custom domain:

1. **DNS Records**:
   - Add all required TXT, SPF, and DKIM records
   - Wait for DNS propagation (can take up to 48 hours)
   - Check status in Resend dashboard

2. **Common Issues**:
   - Missing DNS records
   - Incorrect record values
   - DNS not propagated yet

## Security Notes

- **Never commit API keys** to git
- Use environment variables only
- Rotate API keys periodically
- Use different keys for dev/production if possible

## Cost

- **Free tier**: 3,000 emails/month (plenty for development and early launch)
- **Paid**: $20/month for 50,000 emails (when you scale)

For magic links only, the free tier should last a long time unless you have very high user registration volume.

