# Deep Linking Implementation Guide

## Overview

This guide covers implementing deep linking for email links, starting with custom URL schemes for local development and mobile app testing, with a migration path to Universal Links (iOS) and App Links (Android) for production.

**Current Focus**: Custom URL schemes for local development and mobile app release
**Future**: Universal Links for production (when ready)

## How It Works (Simple Explanation)

### When You Click "Send Me a Magic Login Link"

1. **Backend generates a token** (unique, expires in 15 minutes)
2. **Backend generates the link** using `APP_LINK_TYPE` environment variable:
   - `APP_LINK_TYPE=mobile` → `parlaystreak://auth/verify?token=abc123` (opens app, requires dev build)
   - `APP_LINK_TYPE=expo` → `exp://127.0.0.1:8081/--/auth/verify?token=abc123` (works with Expo Go)
   - `APP_LINK_TYPE=web` → `http://localhost:5173/auth/verify?token=abc123` (opens browser)
   - `APP_LINK_TYPE=auto` → Uses web URLs in dev, universal links in production
3. **Backend sends email** with the generated link
4. **You click the link**:
   - Custom scheme (`parlaystreak://`) → Opens mobile app ✅
   - Web URL (`http://localhost:5173`) → Opens browser (on mobile) or browser (on desktop)

### Important Clarifications

**Where is `APP_LINK_TYPE` set?**
- Set in `backend/.env` file
- Example: `APP_LINK_TYPE=mobile`
- **Server restart required** when changing this value (environment variables are read at startup)

**Web URLs in emails on mobile:**
- ⚠️ **Web URLs in emails on mobile open in browser, NOT the app**
- Custom schemes (`parlaystreak://`) are needed to open the app from email links
- React Navigation can handle web URLs, but only if the app is already running or universal links are configured

**For Local Development:**
- **Expo Go testing (Recommended for local dev)**: 
  - Set `APP_LINK_TYPE=expo` in `backend/.env`
  - Restart backend server
  - Links will be `exp://127.0.0.1:8081/--/auth/verify?token=...` (works with Expo Go)
  - ✅ Works with Expo Go (no dev build needed)
  - ⚠️ Not ideal for email testing (emails would need `exp://` links)
  - ✅ Good for testing deep linking logic in Expo Go
- **Mobile email testing (Production-like)**: 
  - Set `APP_LINK_TYPE=mobile` in `backend/.env`
  - Restart backend server
  - Links will be `parlaystreak://auth/verify?token=...` (opens app)
  - **⚠️ Important**: Custom schemes (`parlaystreak://`) do NOT work in Expo Go
  - **You need a development build** to test custom schemes (not Expo Go)
  - Create dev build: `eas build --profile development --platform ios` (or android)
- **Web testing**: 
  - Set `APP_LINK_TYPE=web` in `backend/.env`
  - Restart backend server
  - Links will be `http://localhost:5173/auth/verify?token=...` (opens browser)
- **Switching between modes**: 
  - Edit `backend/.env` file
  - Change `APP_LINK_TYPE` value
  - **Restart backend server** (required - env vars read at startup)

**Expo Go Support:**
- ✅ Expo Go supports `exp://` scheme with special format: `exp://127.0.0.1:8081/--/path`
- ✅ Use `APP_LINK_TYPE=expo` for Expo Go testing
- ❌ Expo Go does NOT support custom URL schemes (`parlaystreak://`)
- ✅ To test custom schemes, you need a **development build** (not Expo Go)
- ✅ Development builds support custom schemes and work like production apps

## Current State

Your app already has some deep linking configured:
- **iOS**: Associated domains configured in `app.json` (`applinks:parlaystreak.com`)
- **Android**: Intent filters configured for `https://parlaystreak.com/auth/verify`
- **React Navigation**: Linking configured in `App.tsx` for `parlaystreak://` and `https://parlaystreak.com`
- **Custom Scheme**: `parlaystreak://` already configured in `app.json`

## Email Links That Need Deep Linking

1. **Magic Link Login**: `/auth/verify?token=...`
2. **Email Verification**: `/verify-email?token=...`
3. **Password Reset**: `/reset-password?token=...`
4. **Welcome Email**: `/dashboard` (optional - could deep link to dashboard)

## Implementation Requirements

### 1. Backend: Host Association Files

You need to host two files on your domain at specific paths:

#### iOS: `apple-app-site-association` (AASA)
**Location**: `https://parlaystreak.com/.well-known/apple-app-site-association`
**Content-Type**: `application/json` (NOT `text/json`)

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAM_ID.com.parlaystreak.app",
        "paths": [
          "/auth/verify*",
          "/verify-email*",
          "/reset-password*",
          "/dashboard*"
        ]
      }
    ]
  }
}
```

**Important Notes**:
- Must be served over HTTPS
- Must return `application/json` content type
- Must NOT have a `.json` file extension
- Must be accessible without authentication
- `TEAM_ID` is your Apple Developer Team ID (found in Apple Developer account)

#### Android: `assetlinks.json`
**Location**: `https://parlaystreak.com/.well-known/assetlinks.json`
**Content-Type**: `application/json`

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.parlaystreak.app",
      "sha256_cert_fingerprints": [
        "SHA256_FINGERPRINT_1",
        "SHA256_FINGERPRINT_2"
      ]
    }
  }
]
```

**Important Notes**:
- Must be served over HTTPS
- Must return `application/json` content type
- Must be accessible without authentication
- `SHA256_FINGERPRINT` is your app's signing certificate fingerprint

### 2. Backend: Update Email Links

Currently, emails use `CORS_ORIGIN` which might be `http://localhost:5173` in dev. For universal links to work, you need to:

1. **Use your production domain** for email links (even in dev, you can use production domain)
2. **Ensure links use HTTPS** (required for universal links)
3. **Keep existing web fallback** (links should still work in browser)

**Recommended Approach**:
- Add new environment variable: `APP_DOMAIN=https://parlaystreak.com`
- Use `APP_DOMAIN` for email links instead of `CORS_ORIGIN`
- Keep `CORS_ORIGIN` for CORS configuration

### 3. React Native: Update App Configuration

#### Update `app.json`

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.parlaystreak.app",
      "associatedDomains": [
        "applinks:parlaystreak.com"
      ]
    },
    "android": {
      "package": "com.parlaystreak.app",
      "intentFilters": [
        {
          "action": "VIEW",
          "autoVerify": true,
          "data": [
            {
              "scheme": "https",
              "host": "parlaystreak.com",
              "pathPrefix": "/auth/verify"
            },
            {
              "scheme": "https",
              "host": "parlaystreak.com",
              "pathPrefix": "/verify-email"
            },
            {
              "scheme": "https",
              "host": "parlaystreak.com",
              "pathPrefix": "/reset-password"
            },
            {
              "scheme": "https",
              "host": "parlaystreak.com",
              "pathPrefix": "/dashboard"
            }
          ],
          "category": ["BROWSABLE", "DEFAULT"]
        }
      ]
    }
  }
}
```

#### Update `App.tsx` Linking Configuration

```typescript
const linking = {
  prefixes: [
    'parlaystreak://',
    'https://parlaystreak.com',
    'http://parlaystreak.com' // For dev/testing
  ],
  config: {
    screens: {
      AuthStack: {
        screens: {
          VerifyMagicLink: {
            path: 'auth/verify',
            parse: {
              token: (token: string) => token,
            },
          },
          VerifyEmail: {
            path: 'verify-email',
            parse: {
              token: (token: string) => token,
            },
          },
          ResetPassword: {
            path: 'reset-password',
            parse: {
              token: (token: string) => token,
            },
          },
        },
      },
      AppStack: {
        screens: {
          Dashboard: {
            path: 'dashboard',
          },
        },
      },
    },
  },
};
```

### 4. Backend: Create Route Handlers for Web Fallback

Even with universal links, you need web routes that:
1. Handle the link when app isn't installed
2. Redirect to app store if on mobile
3. Show appropriate UI if on desktop

**Recommended Routes**:
- `GET /auth/verify?token=...` - Magic link verification
- `GET /verify-email?token=...` - Email verification
- `GET /reset-password?token=...` - Password reset

These routes should:
- Verify the token
- Set session cookie
- Redirect to appropriate page (dashboard, password reset form, etc.)
- Show "Open in App" button if on mobile

### 5. Local Testing Options

#### Option 1: Custom URL Schemes (Easiest for Local Dev) ✅

**Works perfectly locally!** Custom schemes like `parlaystreak://` work without any special setup.

**How it works:**
- Use `parlaystreak://auth/verify?token=...` in emails during local development
- No HTTPS or domain verification needed
- Works on both iOS and Android
- Perfect for testing app navigation logic

**Implementation:**
1. Add environment variable: `APP_LINK_SCHEME=parlaystreak` (or detect from environment)
2. In local/dev, use custom scheme: `parlaystreak://auth/verify?token=...`
3. In production, use universal links: `https://parlaystreak.com/auth/verify?token=...`

**Pros:**
- ✅ Works immediately, no setup
- ✅ Perfect for testing app logic
- ✅ No external dependencies

**Cons:**
- ⚠️ Doesn't test universal link behavior
- ⚠️ Won't work if user doesn't have app installed (no web fallback)

#### Option 2: ngrok (Test Universal Links Locally) 🔧

**Best for testing universal links before production deployment.**

**Setup:**
1. Install ngrok: `brew install ngrok` or download from ngrok.com
2. Start your backend: `npm run dev` (on port 3001)
3. Create tunnel: `ngrok http 3001`
4. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)
5. Update association files to use ngrok domain
6. Update app.json associated domains to include ngrok domain
7. Rebuild app

**Configuration:**
```bash
# Terminal 1: Start backend
npm run dev

# Terminal 2: Start ngrok
ngrok http 3001

# You'll get something like:
# Forwarding: https://abc123.ngrok.io -> http://localhost:3001
```

**Update environment:**
```env
# .env.local
APP_DOMAIN=https://abc123.ngrok.io
```

**Update app.json (temporarily for testing):**
```json
{
  "ios": {
    "associatedDomains": [
      "applinks:parlaystreak.com",
      "applinks:abc123.ngrok.io"  // Add ngrok domain
    ]
  },
  "android": {
    "intentFilters": [
      {
        "data": [
          {
            "host": "parlaystreak.com"
          },
          {
            "host": "abc123.ngrok.io"  // Add ngrok domain
          }
        ]
      }
    ]
  }
}
```

**Pros:**
- ✅ Tests actual universal link behavior
- ✅ HTTPS provided automatically
- ✅ Works with real email clients
- ✅ Free tier available

**Cons:**
- ⚠️ URL changes each time (unless paid plan)
- ⚠️ Requires app rebuild when domain changes
- ⚠️ Slightly more setup

#### Option 3: Dev/Staging Environment (Recommended for Final Testing) 🚀

**Use a real domain but in development mode.**

**Setup:**
1. Deploy backend to staging server (e.g., `dev.parlaystreak.com`)
2. Deploy association files to staging domain
3. Use staging domain in emails
4. Test with real universal links

**Pros:**
- ✅ Most realistic testing environment
- ✅ Tests production-like setup
- ✅ Can test with real email clients
- ✅ Stable domain

**Cons:**
- ⚠️ Requires deployment
- ⚠️ More setup time

#### Recommended Testing Strategy

**Phase 1: Local Development (Custom Schemes)**
- Use `parlaystreak://` links in local dev
- Test all app navigation logic
- Verify token parsing and routing

**Phase 2: Universal Link Testing (ngrok)**
- Use ngrok to test universal link behavior
- Verify association files work
- Test on physical devices

**Phase 3: Staging Validation (Dev Environment)**
- Deploy to staging with real domain
- Test end-to-end with real emails
- Final validation before production

### 6. Testing Requirements

#### iOS Testing
1. **Test on physical device** (simulator doesn't fully support universal links)
2. **For custom schemes**: Development builds work fine - just install via Xcode/Expo
3. **For universal links**: Install app from TestFlight or App Store (development builds may not work for universal links)
4. **Send test email** and click link
5. **Verify app opens** directly (not Safari first)
6. **Test with app uninstalled** - should open in Safari/web

#### Android Testing
1. **Test on physical device** (emulator may have issues)
2. **Install app** (can be development build)
3. **Verify assetlinks.json** using: `adb shell pm get-app-links com.parlaystreak.app`
4. **Send test email** and click link
5. **Verify app opens** directly
6. **Test with app uninstalled** - should open in browser

#### Validation Tools
- **iOS**: Apple's App Search API Validation Tool
- **Android**: Google's Statement List Generator and Tester
- **Both**: Branch.io Universal Link Validator

## Implementation Steps

### Step 1: Get Required Information

1. **Apple Team ID**: 
   - Go to https://developer.apple.com/account
   - Find your Team ID (10-character string)

2. **Android SHA-256 Fingerprint**:
   - For debug: `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android`
   - For release: Get from your signing keystore
   - You'll need both for development and production

### Step 2: Create Association Files

Create the two JSON files with your actual values:
- `apple-app-site-association` (no extension)
- `assetlinks.json`

### Step 3: Host Association Files

**Option A: Static File Hosting** (Recommended for simple setup)
- Upload to your web server at `/.well-known/` directory
- Ensure proper content-type headers
- Test accessibility: `curl -I https://parlaystreak.com/.well-known/apple-app-site-association`

**Option B: Backend Route** (More control)
- Create Express routes to serve these files
- Set proper headers
- Example:
  ```typescript
  app.get('/.well-known/apple-app-site-association', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(aasaFile);
  });
  ```

### Step 4: Update Backend Email Links

1. **Add environment variables to `backend/.env`:**
   ```env
   # App Link Configuration
   # Options: 'web', 'mobile', 'expo', 'auto'
   # - 'mobile': Uses custom schemes (parlaystreak://) - opens app from email (requires dev build, not Expo Go)
   # - 'expo': Uses Expo Go scheme (exp://127.0.0.1:8081/--/...) - works with Expo Go
   # - 'web': Uses web URLs (http://localhost:5173) - opens browser
   # - 'auto': Uses web URLs in dev, universal links in production
   APP_LINK_TYPE=expo
   
   # Custom URL scheme for mobile app (default: parlaystreak)
   APP_LINK_SCHEME=parlaystreak
   
   # Web frontend URL (for local dev and web fallback)
   # Defaults to CORS_ORIGIN if not set
   WEB_URL=http://localhost:5173
   
   # Expo Go URL (for exp:// links, only used when APP_LINK_TYPE=expo)
   # Defaults to exp://127.0.0.1:8081
   EXPO_URL=exp://127.0.0.1:8081
   
   # App domain for universal links (production)
   # If not set, falls back to CORS_ORIGIN
   APP_DOMAIN=
   ```

      **⚠️ Important**: Changing `APP_LINK_TYPE` requires **restarting the backend server** for changes to take effect.

   **Workflow for Testing:**
   - **For Expo Go (Recommended for local dev)**: Set `APP_LINK_TYPE=expo` in `backend/.env`, restart server
   - To test mobile app with dev build: Set `APP_LINK_TYPE=mobile` in `backend/.env`, restart server
   - To test web app: Set `APP_LINK_TYPE=web` in `backend/.env`, restart server
   - Server restart is required because environment variables are read at startup

2. Create helper function to generate links based on environment:
   ```typescript
   function generateAppLink(path: string, params?: Record<string, string>): string {
     const linkType = process.env.APP_LINK_TYPE || 'auto';
     const scheme = process.env.APP_LINK_SCHEME || 'parlaystreak';
     const appDomain = process.env.APP_DOMAIN;
     const webUrl = process.env.WEB_URL || process.env.CORS_ORIGIN || 'http://localhost:5173';
     const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
     
     // Build query string
     const queryString = Object.keys(params).length > 0
       ? '?' + new URLSearchParams(params).toString()
       : '';
     
     // Determine link type
     let finalLinkType = linkType;
     if (linkType === 'auto') {
       // Auto mode: use web URLs in dev, universal links in production
       if (isDevelopment) {
         finalLinkType = 'web';
       } else {
         finalLinkType = 'universal';
       }
     }
     
     // Generate link based on type
     switch (finalLinkType) {
       case 'mobile':
         // Custom scheme for mobile app (requires dev build, not Expo Go)
         return `${scheme}://${path}${queryString}`;
       
       case 'expo':
         // Expo Go scheme (works with Expo Go)
         // Format: exp://127.0.0.1:8081/--/path
         const expoUrl = process.env.EXPO_URL || 'exp://127.0.0.1:8081';
         return `${expoUrl}/--/${path}${queryString}`;
       
       case 'web':
         // Web URL for browsers
         return `${webUrl}/${path}${queryString}`;
       
       case 'universal':
         // Universal link (web URL that opens app if installed)
         const domain = appDomain || webUrl;
         return `${domain}/${path}${queryString}`;
       
       default:
         // Fallback to web URL
         return `${webUrl}/${path}${queryString}`;
     }
   }
   ```
3. Update email functions to use this helper
4. Ensure production links use HTTPS

### Step 5: Update React Native App

1. Update `app.json` with all path prefixes (already configured)

2. Update `App.tsx` linking configuration to support all link types:

```typescript
const linking = {
  prefixes: [
    'parlaystreak://', // Custom scheme (for dev builds)
    'https://parlaystreak.com', // Universal links (production)
    'http://localhost:5173', // Web URLs (local dev)
    'exp://127.0.0.1:8081', // Expo Go (local dev)
    'exp://', // Catch-all for Expo Go
  ],
  config: {
    screens: {
      AuthStack: {
        screens: {
          VerifyMagicLink: {
            path: 'auth/verify',
            parse: {
              token: (token: string) => token,
            },
          },
          VerifyEmail: {
            path: 'verify-email',
            parse: {
              token: (token: string) => token,
            },
          },
          ResetPassword: {
            path: 'reset-password',
            parse: {
              token: (token: string) => token,
            },
          },
        },
      },
      AppStack: {
        screens: {
          Dashboard: {
            path: 'dashboard',
          },
        },
      },
    },
  },
};
```

**Note**: The `/--/` in `exp://` URLs is handled automatically by Expo - React Navigation will strip it and match the path correctly.

3. Rebuild app only if you made native changes (like updating `app.json`). For just updating `App.tsx`, a reload is sufficient.

### Step 6: Create Web Fallback Routes

Create routes that handle links when app isn't installed:
- Verify tokens
- Set sessions
- Redirect appropriately
- Show "Open in App" option

### Step 7: Test Thoroughly

1. Test on iOS device with app installed
2. Test on iOS device without app installed
3. Test on Android device with app installed
4. Test on Android device without app installed
5. Test on desktop browser
6. Verify all email types work

## Common Issues & Solutions

### Issue: Links open in Safari instead of app
**Solution**: 
- Verify AASA file is accessible and valid
- Check that app was installed from App Store/TestFlight (not Xcode)
- Clear iOS cache: Settings > Safari > Clear History and Website Data

### Issue: Android links don't work
**Solution**:
- Verify `autoVerify: true` in intent filters
- Check assetlinks.json is accessible
- Verify SHA-256 fingerprint matches
- Run: `adb shell pm verify-app-links --re-verify com.parlaystreak.app`

### Issue: Links work but don't navigate correctly
**Solution**:
- Check React Navigation linking configuration
- Verify path patterns match exactly
- Check URL parsing logic

### Issue: Association files return wrong content-type
**Solution**:
- Ensure server returns `application/json`
- Check for any middleware that modifies headers
- Verify file doesn't have `.json` extension

## Security Considerations

1. **Token Validation**: Always validate tokens server-side, even when app handles the link
2. **HTTPS Only**: Universal links require HTTPS
3. **Domain Verification**: Only your verified domain can open your app
4. **Token Expiration**: Ensure tokens expire appropriately
5. **One-Time Use**: Consider making tokens single-use

## Additional Enhancements

### Smart App Banners (iOS)
Add meta tags to your web pages to show "Open in App" banner:
```html
<meta name="apple-itunes-app" content="app-id=YOUR_APP_ID">
```

### App Store Redirects
If app isn't installed, redirect to App Store:
- iOS: `https://apps.apple.com/app/id/YOUR_APP_ID`
- Android: `https://play.google.com/store/apps/details?id=com.parlaystreak.app`

### Analytics
Track universal link performance:
- Which links are clicked
- App open rate vs web fallback
- Conversion rates

## Resources

- [Apple Universal Links Documentation](https://developer.apple.com/documentation/xcode/allowing-apps-and-websites-to-link-to-your-content)
- [Android App Links Documentation](https://developer.android.com/training/app-links)
- [Expo Linking Documentation](https://docs.expo.dev/guides/linking/)
- [React Navigation Deep Linking](https://reactnavigation.org/docs/deep-linking/)

## Estimated Implementation Time

- **Backend setup**: 2-4 hours
- **React Native updates**: 1-2 hours
- **Testing**: 2-3 hours
- **Total**: 5-9 hours

## Next Steps

1. Review this guide and gather required information (Team ID, SHA-256 fingerprints)
2. Decide on hosting method for association files
3. Create association files
4. Update backend email links
5. Update React Native configuration
6. Test thoroughly
7. Deploy and monitor

