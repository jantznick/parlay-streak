# Email Verification and Password Reset Implementation

## Overview

This document describes the implementation of email verification and password reset flows for the Parlay Streak application. Users must verify their email address before they can access any protected features of the application.

## Table of Contents

1. [Email Verification Flow](#email-verification-flow)
2. [Password Reset Flow](#password-reset-flow)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [Security Considerations](#security-considerations)
6. [Frontend Integration](#frontend-integration)

---

## Email Verification Flow

### User Registration Flow

1. **User registers** with username, email, and password
2. **User account is created** with `emailVerified = false`
3. **Verification token is generated** (32-byte random hex string)
4. **Verification email is sent** with a link containing the token
5. **User clicks link** in email
6. **Token is validated** (checked for existence, expiration, and previous use)
7. **User email is marked as verified** (`emailVerified = true`)
8. **Token is marked as used** (`usedAt = timestamp`)
9. **User can now access protected features**

### Resend Verification Email

- Users can request a new verification email if:
  - They didn't receive the original email
  - The verification link expired
  - They need a new link for any reason
- A new token is generated and the old token is invalidated
- Rate limiting: Maximum 3 requests per hour per email address

### Token Expiration

- Verification tokens expire after **24 hours**
- Expired tokens cannot be used
- Users must request a new verification email if token expires

### Access Control

- **Unverified users** can only:
  - Access public pages (login, register, forgot password)
  - View their own profile (but see verification warning)
  - Request verification email resend
- **Verified users** can:
  - Access all protected features
  - Create parlays
  - View dashboard
  - Access all authenticated endpoints

---

## Password Reset Flow

### Request Password Reset

1. **User requests password reset** by providing their email address
2. **System checks if user exists** (for security, always returns success even if user doesn't exist)
3. **Reset token is generated** (32-byte random hex string)
4. **Token is stored** in `AuthToken` table with type `'password_reset'`
5. **Reset email is sent** with a link containing the token
6. **Token expires** after 1 hour

### Reset Password

1. **User clicks reset link** in email
2. **Token is validated** (checked for existence, expiration, and previous use)
3. **User is redirected** to password reset page with token
4. **User enters new password** (twice for confirmation)
5. **Password is validated** (meets requirements)
6. **Password is hashed** using bcrypt (12 rounds)
7. **User password is updated** in database
8. **Token is marked as used** (`usedAt = timestamp`)
9. **All existing sessions are invalidated** (user must log in again)
10. **User is redirected** to login page

### Security Features

- **Token expiration**: 1 hour
- **Single-use tokens**: Once used, token cannot be reused
- **Rate limiting**: Maximum 3 requests per hour per email address
- **No user enumeration**: Always returns success message even if email doesn't exist
- **Session invalidation**: All sessions are cleared after password reset

---

## Database Schema

### User Model Updates

```prisma
model User {
  // ... existing fields ...
  emailVerified          Boolean   @default(false) @map("email_verified")
  emailVerificationToken String?   @unique @map("email_verification_token") @db.VarChar(64)
  emailVerificationExpires DateTime? @map("email_verification_expires")
  // ... rest of fields ...
}
```

### AuthToken Model (Already Exists)

The `AuthToken` model is used for both magic links and password reset tokens:

```prisma
model AuthToken {
  id        String    @id @default(uuid())
  userId    String    @map("user_id")
  token     String    @unique @db.VarChar(500)
  tokenType String    @map("token_type") @db.VarChar(20) // 'magic_link', 'password_reset', 'email_verification'
  expiresAt DateTime  @map("expires_at")
  usedAt    DateTime? @map("used_at")
  createdAt DateTime  @default(now()) @map("created_at")
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([token])
  @@index([userId])
  @@map("auth_tokens")
}
```

**Note**: For email verification, we use both:
- `User.emailVerificationToken` for quick lookups
- `AuthToken` table for token management and history

---

## API Endpoints

### Email Verification

#### `POST /api/auth/verify-email/resend`
Resend verification email to the authenticated user.

**Request:**
```json
{}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Verification email sent"
  }
}
```

**Errors:**
- `401`: Not authenticated
- `400`: Email already verified
- `429`: Too many requests (rate limited)

#### `GET /api/auth/verify-email?token=<token>`
Verify email address using token from email.

**Query Parameters:**
- `token` (required): Verification token from email

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Email verified successfully"
  }
}
```

**Errors:**
- `400`: Invalid token
- `400`: Token expired
- `400`: Token already used
- `400`: Email already verified

### Password Reset

#### `POST /api/auth/forgot-password`
Request password reset email.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "If an account exists with this email, a password reset link has been sent"
  }
}
```

**Note**: Always returns success to prevent user enumeration.

**Errors:**
- `400`: Invalid email format
- `429`: Too many requests (rate limited)

#### `POST /api/auth/reset-password`
Reset password using token from email.

**Request:**
```json
{
  "token": "abc123...",
  "password": "newSecurePassword123",
  "confirmPassword": "newSecurePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Password reset successfully"
  }
}
```

**Errors:**
- `400`: Invalid token
- `400`: Token expired
- `400`: Token already used
- `400`: Passwords do not match
- `400`: Password validation failed

---

## Security Considerations

### Email Verification

1. **Token Security**
   - Tokens are 32-byte random hex strings (64 characters)
   - Cryptographically secure random generation
   - Tokens are single-use
   - Tokens expire after 24 hours

2. **Rate Limiting**
   - Maximum 3 verification email requests per hour per email
   - Prevents email spam and abuse

3. **User Enumeration Prevention**
   - Always returns success message
   - Doesn't reveal if email exists or not

### Password Reset

1. **Token Security**
   - Tokens are 32-byte random hex strings (64 characters)
   - Cryptographically secure random generation
   - Tokens are single-use
   - Tokens expire after 1 hour

2. **Rate Limiting**
   - Maximum 3 password reset requests per hour per email
   - Prevents abuse and email spam

3. **User Enumeration Prevention**
   - Always returns success message
   - Doesn't reveal if email exists or not

4. **Session Security**
   - All existing sessions are invalidated after password reset
   - User must log in again with new password

5. **Password Requirements**
   - Minimum 8 characters
   - Must meet validation requirements (see `@shared/validation/auth`)

### General Security

1. **HTTPS Only**
   - All email links use HTTPS
   - Tokens are never sent over unencrypted connections

2. **Token Storage**
   - Tokens are hashed in database (optional, but recommended for production)
   - Tokens are never logged

3. **Email Security**
   - Email links include expiration warnings
   - Clear instructions on what to do if user didn't request the email

---

## Frontend Integration

### Email Verification

#### Registration Flow
1. After successful registration, redirect to verification page
2. Show message: "Please check your email to verify your account"
3. Provide "Resend Email" button
4. After verification, redirect to dashboard

#### Verification Page (`/verify-email`)
- Shows verification status
- Allows resending verification email
- Shows countdown for rate limiting

#### Protected Routes
- All protected routes check `user.emailVerified`
- If not verified, show verification banner
- Block access to features until verified

### Password Reset

#### Forgot Password Page (`/forgot-password`)
- Email input field
- Submit button
- Success message (always shown, regardless of email existence)

#### Reset Password Page (`/reset-password?token=...`)
- Token from URL query parameter
- New password input (with strength indicator)
- Confirm password input
- Submit button
- Error handling for invalid/expired tokens

#### After Reset
- Show success message
- Redirect to login page
- User must log in with new password

### User State Management

The `AuthContext` should include:
```typescript
interface User {
  id: string;
  username: string;
  email: string;
  emailVerified: boolean;
  // ... other fields
}
```

### Middleware Integration

The `requireAuth` middleware should be updated to also check `emailVerified`:

```typescript
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  // ... existing auth check ...
  
  // Check email verification
  if (!user.emailVerified) {
    return res.status(403).json({
      success: false,
      error: {
        message: 'Email verification required',
        code: 'EMAIL_NOT_VERIFIED',
      },
    });
  }
  
  next();
};
```

---

## Implementation Checklist

### Backend
- [ ] Update Prisma schema with email verification fields
- [ ] Create migration for schema changes
- [ ] Add email verification email templates
- [ ] Implement `resendVerificationEmail` controller
- [ ] Implement `verifyEmail` controller
- [ ] Implement `forgotPassword` controller
- [ ] Implement `resetPassword` controller
- [ ] Add `requireEmailVerification` middleware
- [ ] Update `requireAuth` to check email verification
- [ ] Add rate limiting for email endpoints
- [ ] Update registration to send verification email
- [ ] Add routes for new endpoints

### Frontend
- [ ] Create email verification page
- [ ] Create forgot password page
- [ ] Create reset password page
- [ ] Update registration flow to show verification message
- [ ] Add email verification banner to protected pages
- [ ] Update `AuthContext` to include `emailVerified`
- [ ] Add verification status to user profile
- [ ] Handle verification errors gracefully
- [ ] Add loading states for email operations

### Testing
- [ ] Test email verification flow end-to-end
- [ ] Test password reset flow end-to-end
- [ ] Test rate limiting
- [ ] Test token expiration
- [ ] Test invalid tokens
- [ ] Test already-used tokens
- [ ] Test unverified user access restrictions

---

## Email Templates

### Verification Email
- Subject: "Verify Your Email Address - Parlay Streak"
- Includes verification link
- Expiration notice (24 hours)
- Clear call-to-action

### Password Reset Email
- Subject: "Reset Your Password - Parlay Streak"
- Includes reset link
- Expiration notice (1 hour)
- Security warning if user didn't request

### Resend Verification Email
- Same as verification email
- Note that previous link is now invalid

---

## Environment Variables

No new environment variables required. Uses existing:
- `RESEND_API_KEY`: For sending emails
- `RESEND_FROM_EMAIL`: From address for emails
- `CORS_ORIGIN`: Base URL for email links

---

## Future Enhancements

1. **Email Change Flow**
   - Allow users to change email
   - Require verification of new email
   - Send notification to old email

2. **Two-Factor Authentication**
   - Optional 2FA for additional security
   - Use email as one factor

3. **Account Recovery**
   - Alternative recovery methods
   - Security questions
   - Backup codes

4. **Email Preferences**
   - Allow users to manage email notifications
   - Unsubscribe options

