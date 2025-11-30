# Parlay Streak Mobile App

React Native mobile app for Parlay Streak built with Expo and TypeScript.

## 📱 Overview

This is the mobile application for Parlay Streak, allowing users to build winning streaks by making smart picks on live sporting events. The app shares code with the web frontend through the `shared/` directory.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI (installed globally or via npx)
- iOS Simulator (for Mac) or Android Studio (for Android development)

### Installation

```bash
# Install dependencies
npm install

# Start the development server
npm start
```

Then:
- Press `i` to open iOS simulator
- Press `a` to open Android emulator
- Scan QR code with Expo Go app on your phone

## 🔗 Deep Linking / Magic Links

The app supports deep linking for magic link authentication. Magic links sent via email will open the app automatically.

### Development Setup

For development, you can test deep links using:

**iOS Simulator:**
```bash
xcrun simctl openurl booted "parlaystreak://auth/verify?token=YOUR_TOKEN"
```

**Android Emulator:**
```bash
adb shell am start -W -a android.intent.action.VIEW -d "parlaystreak://auth/verify?token=YOUR_TOKEN" com.parlaystreak.app
```

**Expo Go (on physical device):**
The deep link will work automatically when you click a link with the `parlaystreak://` scheme.

### Production Setup

For production, you'll need to:

1. **Configure Universal Links (iOS)** - Set up associated domains in your Apple Developer account
2. **Configure App Links (Android)** - Set up Digital Asset Links on your website
3. **Update Backend** - Modify the magic link email to use the app scheme:
   - Development: `parlaystreak://auth/verify?token=TOKEN`
   - Production: `https://parlaystreak.com/auth/verify?token=TOKEN` (will redirect to app if installed)

The app is configured to handle both:
- Custom scheme: `parlaystreak://auth/verify?token=...`
- Universal/App links: `https://parlaystreak.com/auth/verify?token=...`

## 📁 Project Structure

```
react-native/
├── src/
│   ├── components/        # Reusable components
│   │   └── common/        # Common components (LoadingScreen, etc.)
│   ├── context/           # React Context providers
│   │   ├── AuthContext.tsx
│   │   ├── ParlayContext.tsx
│   │   └── BetsContext.tsx
│   ├── interfaces/        # TypeScript interfaces
│   ├── pages/             # Screen components
│   │   ├── Login.tsx
│   │   ├── Register.tsx
│   │   ├── Dashboard.tsx
│   │   ├── VerifyMagicLink.tsx
│   │   └── Settings.tsx
│   └── services/          # API service
│       └── api.ts
├── App.tsx                # Root component with navigation
├── app.json               # Expo configuration
├── babel.config.js        # Babel configuration
└── tsconfig.json          # TypeScript configuration
```

## 🔧 Configuration

### API URL

The API URL is configured in `src/services/api.ts`. It defaults to `http://localhost:3001` but can be overridden via Expo constants.

To set a custom API URL, update `app.json`:

```json
{
  "expo": {
    "extra": {
      "apiUrl": "https://your-api-url.com"
    }
  }
}
```

### Path Aliases

The project uses path aliases for cleaner imports:

- `@/*` - Points to `src/*`
- `@shared/*` - Points to `../shared/*`

## 📦 Dependencies

### Core
- **expo** - Expo SDK
- **react-native** - React Native framework
- **react** - React library (18.2.0)

### Navigation
- **@react-navigation/native** - Navigation library
- **@react-navigation/native-stack** - Stack navigator
- **@react-navigation/bottom-tabs** - Bottom tabs navigator

### State Management
- **zustand** - Lightweight state management

### Networking
- **socket.io-client** - WebSocket client for real-time updates

### Deep Linking
- **expo-linking** - Handle deep links and universal links

## 🎨 Styling

The app uses React Native's StyleSheet API for styling. The design follows the same dark theme as the web app:

- Background: `#0f172a` (slate-950)
- Surface: `#1e293b` (slate-800)
- Text Primary: `#fff`
- Text Secondary: `#94a3b8` (slate-400)
- Accent: `#3b82f6` (blue-500)

## 🔐 Authentication

The app uses session-based authentication, sharing the same backend as the web app. Session cookies are automatically handled by the fetch API with `credentials: 'include'`.

### Magic Link Flow

1. User enters email on Login screen
2. Clicks "Send me a magic link instead"
3. Backend sends email with link: `parlaystreak://auth/verify?token=TOKEN`
4. User clicks link in email
5. App opens and navigates to VerifyMagicLink screen
6. Token is verified and user is logged in

## 📱 Features

### Implemented
- ✅ Authentication (Login/Register)
- ✅ Magic Link authentication with deep linking
- ✅ Dashboard with user stats
- ✅ Settings page
- ✅ API service integration
- ✅ Context providers (Auth, Parlay, Bets)

### Planned
- 📋 Bet selection and parlay building
- 📋 Real-time game updates via WebSocket
- 📋 Push notifications
- 📋 Offline support

## 🛠️ Development

### Running on Device

1. Install Expo Go app on your phone
2. Start the development server: `npm start`
3. Scan the QR code with Expo Go (iOS) or Camera app (Android)

### Building for Production

```bash
# iOS
eas build --platform ios

# Android
eas build --platform android
```

## 🔗 Integration with Monorepo

This app is part of the Parlay Streak monorepo and shares:

- **Types** from `shared/types/`
- **Utilities** from `shared/utils/`
- **Constants** from `shared/constants/`
- **Backend API** from `backend/`

## 📝 Notes

- The app structure mirrors the web frontend for consistency
- All API calls go through the centralized `api` service
- Context providers match the web app's structure
- Navigation uses React Navigation (native) instead of React Router
- Deep linking is configured for both custom schemes and universal/app links

## 🤝 Contributing

See the main [README.md](../README.md) for contribution guidelines.

---

**Built with ❤️ for sports fans who love strategy**
