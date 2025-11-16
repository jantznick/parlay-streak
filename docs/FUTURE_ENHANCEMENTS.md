# Future Enhancements & TODOs

This document tracks planned improvements and features that need to be implemented later.

---

## 🔥 High Priority

### Historical Streak Tracking

**Current State:**
- Users have `currentStreak`, `longestStreak`, and `totalPointsEarned`
- Streak history table exists but only tracks individual parlay resolutions
- No month-to-month or period-based tracking

**Needed:**
Monthly/periodic streak tracking so users can see:
- Their best streak each month
- Streak progression over time
- Monthly competitions/leaderboards
- Historical performance analytics

**Proposed Schema Changes:**

```prisma
// Add to schema.prisma

model MonthlyStreak {
  id              String   @id @default(uuid())
  userId          String   @map("user_id")
  year            Int
  month           Int      // 1-12
  longestStreak   Int      @map("longest_streak")
  totalPoints     Int      @map("total_points")
  parlaysPlayed   Int      @map("parlays_played")
  parlaysWon      Int      @map("parlays_won")
  insuredParlays  Int      @map("insured_parlays")
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, year, month])
  @@index([userId, year, month])
  @@map("monthly_streaks")
}

// Could also add weekly or daily tracking if needed
model WeeklyStreak {
  // Similar structure for weekly tracking
}
```

**Implementation Tasks:**
- [ ] Add monthly/weekly streak tables to schema
- [ ] Create background job to aggregate stats
- [ ] Update streak calculation to track monthly stats
- [ ] Add API endpoints for historical data
- [ ] Build frontend components for viewing history
- [ ] Add charts/graphs for visualization

**Impact:**
- Enables monthly competitions
- Better user retention (can see progress over time)
- More engaging leaderboards
- Analytics for users to improve strategy

---

## 📧 Email System Improvements

### Expand Dev Email Function

**Current State:**
- `sendDevEmail()` only handles magic link emails
- Basic console logging
- Single template

**Needed:**
Enhanced email development utilities:

1. **Multiple Email Types:**
   - Magic link authentication
   - Password reset
   - Welcome email (new user)
   - Parlay resolution notifications
   - Streak milestone notifications
   - Weekly recap emails
   - Competition results

2. **Better Testing:**
   - Email preview in browser (like MailHog)
   - Save emails to files for inspection
   - Test different email clients
   - Email template variables testing

3. **Template System:**
   - Reusable email components
   - Consistent branding
   - Mobile-responsive templates
   - Dark mode support

**Proposed Structure:**

```typescript
// backend/src/utils/email/index.ts
export async function sendEmail(options: EmailOptions): Promise<void> {
  if (isDevelopment) {
    return sendDevEmail(options);
  }
  return sendProductionEmail(options);
}

// backend/src/utils/email/templates/
// - magicLink.ts
// - passwordReset.ts
// - welcome.ts
// - parlayResolved.ts
// - streakMilestone.ts
// - weeklyRecap.ts

// backend/src/utils/email/dev.ts
function sendDevEmail(options: EmailOptions) {
  // Enhanced dev logging
  // Save to file option
  // Browser preview option
}
```

**Implementation Tasks:**
- [ ] Create email template system
- [ ] Build reusable components (header, footer, button)
- [ ] Add email preview functionality
- [ ] Support different email types
- [ ] Add email testing utilities
- [ ] Document email development process

---

## 🎮 Game Features

### Social Features
- [ ] Friend system
- [ ] Private leagues
- [ ] Group chat
- [ ] Social feed (friends' big wins/losses)
- [ ] Trash talk / reactions

### Advanced Parlays
- [ ] Parlay recommendations based on history
- [ ] Copy friend's parlays
- [ ] Parlay templates (save common combinations)
- [ ] Conditional parlays (if X hits, auto-place Y)

### Notifications
- [ ] Push notifications (mobile)
- [ ] Email notifications (configurable)
- [ ] Webhook integrations
- [ ] Discord/Slack bot integration

---

## 📊 Analytics & Stats

### User Analytics
- [ ] Win/loss rates by sport
- [ ] Best performing bet types
- [ ] Insurance usage patterns
- [ ] Time-of-day performance
- [ ] Streak breakdown analysis
- [ ] Comparison to other users

### Platform Analytics (Admin)
- [ ] User engagement metrics
- [ ] Popular sports/games
- [ ] Insurance usage trends
- [ ] Churn analysis
- [ ] Revenue metrics (if monetized)

---

## 🔒 Security & Performance

### Security
- [ ] Rate limiting per user (not just IP)
- [ ] 2FA/MFA support
- [ ] Account recovery flows
- [ ] Session management (view/revoke sessions)
- [ ] Audit logs
- [ ] GDPR compliance tools
- [ ] Data export functionality

### Performance
- [ ] Database query optimization
- [ ] Redis caching layer
- [ ] CDN for static assets
- [ ] API response compression
- [ ] GraphQL API (optional)
- [ ] Database read replicas
- [ ] Horizontal scaling support

---

## 🎨 UI/UX Improvements

### Accessibility
- [ ] Screen reader support
- [ ] Keyboard navigation
- [ ] WCAG 2.1 AA compliance
- [ ] High contrast mode
- [ ] Font size controls

### Mobile Experience
- [ ] Native mobile apps (iOS/Android)
- [ ] Offline support
- [ ] Push notifications
- [ ] Haptic feedback
- [ ] Biometric authentication

### Animations
- [ ] Parlay resolution animations
- [ ] Streak milestone celebrations
- [ ] Confetti for big wins
- [ ] Smooth transitions
- [ ] Loading skeletons

---

## 💰 Monetization (Future)

### Revenue Streams
- [ ] Entry fees for competitions
- [ ] Premium subscriptions
- [ ] White label licensing
- [ ] Affiliate partnerships
- [ ] Sponsored content
- [ ] Premium analytics

### Premium Features
- [ ] Advanced statistics
- [ ] Early access to games
- [ ] Custom themes
- [ ] Ad-free experience
- [ ] Exclusive competitions
- [ ] Priority support

---

## 🛠️ Developer Experience

### Tooling
- [ ] Better error messages
- [ ] Development seed data generator
- [ ] API mocking utilities
- [ ] E2E testing setup
- [ ] Load testing scripts
- [ ] Database migration rollback tools

### Documentation
- [ ] API documentation (auto-generated)
- [ ] Architecture diagrams
- [ ] Onboarding guide for new devs
- [ ] Deployment guide
- [ ] Troubleshooting playbook

---

## 🐛 Known Issues / Tech Debt

### To Fix
- [ ] Insurance unlock logic needs more edge case testing
- [ ] Parlay resolution order needs bulletproof handling
- [ ] WebSocket reconnection logic
- [ ] Session cleanup (expired sessions)
- [ ] Database connection pooling optimization
- [ ] TypeScript strict mode (currently disabled)

---

## 📋 Notes

### Historical Streak Implementation Strategy

**Phase 1: Database Schema**
- Add monthly/weekly streak tables
- Migration to backfill historical data from streak_history

**Phase 2: Data Collection**
- Update parlay resolution to write to monthly tables
- Background job to aggregate daily

**Phase 3: API & Frontend**
- Endpoints for historical data
- Charts and visualizations
- Monthly competition leaderboards

**Phase 4: User Features**
- Achievement badges
- Progress tracking
- Year-in-review summaries

### Email System Expansion

**Phase 1: Infrastructure**
- Refactor email utility to support templates
- Add email type enum
- Create base template components

**Phase 2: Templates**
- Design and implement each email type
- Test across email clients
- Mobile responsive

**Phase 3: Notifications**
- Add notification preferences to user settings
- Build notification service
- Queue system for bulk emails

**Phase 4: Advanced Features**
- Email scheduling
- A/B testing
- Personalization engine

---

## Priority Order

1. **Historical Streak Tracking** (enables monthly competitions)
2. **Email Template System** (better user experience)
3. **Performance Optimization** (scale preparation)
4. **Social Features** (engagement)
5. **Advanced Analytics** (user value)
6. **Monetization** (sustainability)

---

## Contributing

When implementing these features:
1. Create a new branch from main
2. Update this document with implementation details
3. Add tests for new functionality
4. Update API documentation
5. Submit PR with clear description

---

Last Updated: 2024-11-15

