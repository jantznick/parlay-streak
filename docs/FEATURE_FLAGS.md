# Feature Flags Guide

## Overview

Feature flags allow you to control which parts of the application are accessible during deployment and soft launches. This is useful for:
- Preventing users from signing up before launch
- Testing specific features in production
- Gradual feature rollouts
- Emergency feature disabling

## Quick Start

### Disable User Registration (Pre-Launch)

In your `.env` file or hosting platform:
```bash
FEATURE_AUTH_REGISTRATION=false
FEATURE_AUTH_LOGIN=false
FEATURE_AUTH_MAGIC_LINKS=false
```

This will:
- Block `/api/auth/register` → Returns 503 "Feature disabled"
- Block `/api/auth/login` → Returns 503 "Feature disabled"
- Block magic link requests → Returns 503 "Feature disabled"

### Enable Maintenance Mode (Lock Everything)

```bash
ENABLE_MAINTENANCE_MODE=true
```

This will:
- Block ALL routes except admin routes
- Returns 503 "Application is currently under maintenance"
- Admin routes still work (so you can manage things)

### Disable Public Bet Viewing

```bash
FEATURE_PUBLIC_BETS_VIEW=false
```

This will:
- Block `/api/bets/today` → Returns 503 "Feature disabled"
- Marketing page won't be able to load bets

## Available Feature Flags

| Flag | Default | Controls |
|------|---------|----------|
| `FEATURE_AUTH_REGISTRATION` | `true` | User registration endpoint |
| `FEATURE_AUTH_LOGIN` | `true` | User login endpoint |
| `FEATURE_AUTH_MAGIC_LINKS` | `true` | Magic link authentication |
| `FEATURE_PUBLIC_BETS_VIEW` | `true` | Public "today's bets" endpoint |
| `FEATURE_PUBLIC_LEADERBOARDS` | `true` | Public leaderboards (future) |
| `FEATURE_USER_PARLAYS` | `true` | User parlay creation (future) |
| `FEATURE_USER_PROFILE` | `true` | User profile endpoints (future) |
| `FEATURE_ADMIN_BET_MANAGEMENT` | `true` | Admin bet CRUD operations |
| `FEATURE_ADMIN_GAME_MANAGEMENT` | `true` | Admin game fetching/management |
| `ENABLE_MAINTENANCE_MODE` | `false` | Global maintenance mode (blocks all non-admin) |

## Setting Feature Flags

### Local Development
Add to `backend/.env`:
```bash
FEATURE_AUTH_REGISTRATION=false
FEATURE_AUTH_LOGIN=false
```

### Production (Railway/Render)
Add the same environment variables in your hosting platform's dashboard.

## Pre-Launch Configuration Example

For a soft launch where you want to:
- ✅ Show marketing page
- ✅ Show today's bets (read-only)
- ❌ Block user registration
- ❌ Block user login
- ✅ Allow admin access

Set these in your production environment:
```bash
FEATURE_AUTH_REGISTRATION=false
FEATURE_AUTH_LOGIN=false
FEATURE_AUTH_MAGIC_LINKS=false
FEATURE_PUBLIC_BETS_VIEW=true
FEATURE_ADMIN_BET_MANAGEMENT=true
FEATURE_ADMIN_GAME_MANAGEMENT=true
ENABLE_MAINTENANCE_MODE=false
```

## Checking Feature Flag Status

As an admin, you can check current feature flag status:
```bash
GET /api/admin/feature-flags
```

Returns:
```json
{
  "success": true,
  "data": {
    "AUTH_REGISTRATION": false,
    "AUTH_LOGIN": false,
    "AUTH_MAGIC_LINKS": false,
    "PUBLIC_BETS_VIEW": true,
    "ADMIN_BET_MANAGEMENT": true,
    "maintenanceMode": false
  }
}
```

## Response When Feature is Disabled

When a feature is disabled, the API returns:
```json
{
  "success": false,
  "error": {
    "message": "This feature is currently unavailable",
    "code": "FEATURE_DISABLED",
    "feature": "AUTH_REGISTRATION"
  }
}
```

Status code: `503 Service Unavailable`

## Maintenance Mode

When `ENABLE_MAINTENANCE_MODE=true`:
- All routes return 503 except:
  - `/health` (health check)
  - `/api` (API info)
  - `/api-docs` (Swagger docs)
  - `/api/admin/*` (Admin routes - you can still manage things)

Response:
```json
{
  "success": false,
  "error": {
    "message": "The application is currently under maintenance. Please check back soon.",
    "code": "MAINTENANCE_MODE"
  }
}
```

## Best Practices

1. **Pre-Launch**: Disable all auth features, keep public viewing enabled
2. **Soft Launch**: Enable auth for specific users, keep registration disabled
3. **Full Launch**: Enable all features
4. **Emergency**: Use maintenance mode to quickly lock everything

## Notes

- Feature flags are checked at the route level
- Admin routes bypass maintenance mode
- Health checks always work
- Changes require server restart (or environment variable update in hosting platform)

