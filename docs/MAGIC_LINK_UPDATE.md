# Magic Link & Shared Validation Update

## What Changed

### ✅ Shared Validation (New)

**Created `/shared/validation/auth.ts`:**
- Centralized validation rules for username, email, and password
- Used by both backend (with Joi) and frontend (client-side)
- Helper functions: `validateUsername()`, `validateEmail()`, `validatePassword()`

**Benefits:**
- Single source of truth for validation rules
- Change password requirements in one place
- Consistent error messages across frontend/backend
- TypeScript types ensure consistency

**Validation Rules:**
- Username: 3-30 characters, alphanumeric only
- Email: Valid email format
- Password: 6-128 characters

### ✅ Magic Link Authentication (New)

**Backend:**
- `POST /api/auth/magic-link/request` - Request magic link via email
- `GET /api/auth/magic-link/verify?token=...` - Verify token and login
- Auto-creates users if they don't exist (passwordless flow)
- Tokens expire after 15 minutes
- One-time use tokens (marked as used after verification)

**Frontend:**
- Login page now has Password/Magic Link toggle
- Magic link sends email with verification link
- Verification page handles token validation
- Auto-redirects to dashboard on success

**Email Flow (Development):**
- Currently logs magic link to console
- In production, will integrate with Resend API
- Template ready in `backend/src/utils/email.ts`

---

## File Changes

### Shared (`/shared`)
- ✅ **NEW:** `validation/auth.ts` - Shared validation rules and helpers

### Backend (`/backend/src`)
- ✅ **UPDATED:** `controllers/auth.controller.ts` 
  - Uses shared validation constants
  - Added `requestMagicLink()` controller
  - Added `verifyMagicLink()` controller
- ✅ **UPDATED:** `routes/auth.routes.ts`
  - Added magic link endpoints with Swagger docs
- ✅ **NEW:** `utils/email.ts` - Email sending utility (logs to console in dev)

### Frontend (`/frontend/src`)
- ✅ **UPDATED:** `services/api.ts`
  - Added `requestMagicLink()` method
  - Added `verifyMagicLink()` method
- ✅ **UPDATED:** `pages/Login.tsx`
  - Password/Magic Link toggle
  - Conditional form fields
  - Success message for magic link sent
- ✅ **UPDATED:** `pages/Register.tsx`
  - Uses shared validation helpers
  - Client-side validation before submission
- ✅ **NEW:** `pages/VerifyMagicLink.tsx` - Magic link verification page
- ✅ **UPDATED:** `App.tsx` - Added `/auth/verify` route

---

## How to Test

### Test Shared Validation

**Register with invalid data:**
1. Go to `/register`
2. Try username with special characters (should fail)
3. Try username < 3 characters (should fail)
4. Try password < 6 characters (should fail)
5. Error messages should match backend responses

### Test Magic Link Flow

**Development Mode:**

1. **Request Magic Link:**
   - Go to `/login`
   - Click "Magic Link" tab
   - Enter your email
   - Click "Send Magic Link"
   - Success message appears

2. **Check Console:**
   - Backend logs magic link URL
   - Look for `🔐 MAGIC LINK EMAIL` in terminal
   - Copy the full URL

3. **Verify Token:**
   - Paste magic link URL in browser
   - Should see "Verifying..." page
   - Then "Success!" message
   - Auto-redirects to dashboard
   - You're logged in!

4. **Test Expiration:**
   - Request another magic link
   - Wait 16+ minutes
   - Try to use it
   - Should see error: "Magic link has expired"

5. **Test One-Time Use:**
   - Use a magic link successfully
   - Try to use the same link again
   - Should see error: "Magic link has already been used"

### Test Auto-User Creation

**New User via Magic Link:**
1. Use magic link with email that doesn't exist
2. System creates user automatically
3. Username is generated from email
4. User has no password (can only use magic links)
5. Check Prisma Studio to verify user was created

### Test API Directly

```bash
# Request magic link
curl -X POST http://localhost:3001/api/auth/magic-link/request \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'

# Check backend console for magic link URL
# Copy token from URL

# Verify token (creates session)
curl "http://localhost:3001/api/auth/magic-link/verify?token=YOUR_TOKEN_HERE" \
  -c cookies.txt

# Check if logged in
curl http://localhost:3001/api/auth/me \
  -b cookies.txt
```

---

## Production Setup

### Integrate Resend Email

1. **Get Resend API Key:**
   - Sign up at https://resend.com
   - Create API key
   - Add to `backend/.env`:
     ```
     RESEND_API_KEY=re_your_api_key_here
     ```

2. **Install Resend:**
   ```bash
   cd backend
   npm install resend
   ```

3. **Update Email Utility:**
   Edit `backend/src/utils/email.ts` and uncomment the Resend integration code.

4. **Test in Production:**
   - Send real emails
   - Customize email template
   - Add your branding

---

## Validation Rules Reference

### Username
- **Min Length:** 3 characters
- **Max Length:** 30 characters
- **Pattern:** Alphanumeric only (letters and numbers)
- **Examples:**
  - ✅ `john123`
  - ✅ `user`
  - ❌ `jo` (too short)
  - ❌ `john_doe` (underscore not allowed)
  - ❌ `user@123` (special characters not allowed)

### Email
- **Pattern:** Standard email format
- **Examples:**
  - ✅ `user@example.com`
  - ✅ `test.user@domain.co.uk`
  - ❌ `invalid@email` (no TLD)
  - ❌ `@example.com` (no local part)

### Password
- **Min Length:** 6 characters
- **Max Length:** 128 characters
- **No complexity requirements** (for now)

---

## API Endpoints

### Magic Link Request
```
POST /api/auth/magic-link/request
Content-Type: application/json

{
  "email": "user@example.com"
}

Response:
{
  "success": true,
  "data": {
    "message": "Magic link sent to your email"
  }
}
```

### Magic Link Verify
```
GET /api/auth/magic-link/verify?token=abc123...

Response:
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "username": "...",
      "email": "...",
      ...
    }
  }
}
```

---

## Troubleshooting

### "Cannot find module '@shared/validation/auth'"

Make sure tsconfig paths are configured:

**Backend `tsconfig.json`:**
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["../shared/*"]
    }
  }
}
```

**Frontend `tsconfig.json`:**
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["../shared/*"]
    }
  }
}
```

### Magic link not working

1. Check backend console for the magic link URL
2. Make sure `CORS_ORIGIN` in backend `.env` matches frontend URL
3. Verify token hasn't expired (15 minutes)
4. Check if token was already used (one-time use)
5. Check database for auth_tokens table entries

### Email not sending

1. In development, emails are logged to console (not sent)
2. Check backend console output
3. For production, integrate Resend API (see Production Setup above)

---

## Next Steps

With shared validation and magic links complete, you can now:

1. ✅ Users can register with password OR magic link
2. ✅ Validation is consistent across frontend/backend
3. ✅ Easy to change validation rules in one place

**Ready to build:**
- Game browsing
- Parlay builder
- Bet selection
- Real-time updates

---

## Code Examples

### Using Shared Validation (Frontend)

```typescript
import { validateUsername, validateEmail, validatePassword } from '@shared/validation/auth';

// Validate before submission
const usernameError = validateUsername(username);
if (usernameError) {
  setError(usernameError);
  return;
}

// Or use validation constants directly
import { AUTH_VALIDATION } from '@shared/validation/auth';

if (username.length < AUTH_VALIDATION.username.minLength) {
  setError(`Username must be at least ${AUTH_VALIDATION.username.minLength} characters`);
}
```

### Using Shared Validation (Backend)

```typescript
import { AUTH_VALIDATION } from '@shared/validation/auth';

const registerSchema = Joi.object({
  username: Joi.string()
    .min(AUTH_VALIDATION.username.minLength)
    .max(AUTH_VALIDATION.username.maxLength)
    .pattern(AUTH_VALIDATION.username.pattern)
    .required(),
});
```

---

## Summary

🎉 **Completed:**
- ✅ Shared validation in `/shared` folder
- ✅ Magic link authentication flow
- ✅ Auto-user creation for magic links
- ✅ Email utility (console logging for dev)
- ✅ Updated Login/Register pages
- ✅ Verification page with nice UX
- ✅ API documentation updated

🚀 **Benefits:**
- Single source of truth for validation
- Passwordless authentication option
- Better UX with magic links
- Easier to maintain validation rules
- Consistent error messages

Ready to continue building! 🎮

