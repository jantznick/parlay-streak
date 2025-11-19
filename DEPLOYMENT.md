# Deployment Guide

## Architecture Overview

- **Marketing Site**: `parlaystreak.com` (static HTML on Render)
- **App Frontend**: `app.parlaystreak.com` (React/Vite on Render)
- **App Backend**: `api.parlaystreak.com` (Node.js/Express)
- **Database**: PostgreSQL

## Recommended Setup (Free/Low Cost)

### Option 1: Railway (Backend + DB) + Render (Frontend) ⭐ RECOMMENDED
- **Backend + Database**: Railway (free tier $5 credit, then ~$5-10/month)
- **Frontend**: Render (static site - **100% FREE, always-on**)
- **Marketing**: Render (static site - **100% FREE, always-on**)
- **Pros**: Frontend always free, automated DB backups, simple setup, good free tier
- **Cons**: Two platforms to manage (but minimal)

### Option 2: All-in-One Render
- **Backend + Database**: Render (free tier, then ~$14/month for always-on)
- **Frontend**: Render (static site - **100% FREE, always-on**)
- **Marketing**: Render (static site - **100% FREE, always-on**)
- **Pros**: Everything in one place, easy management
- **Cons**: Free tier spins down after inactivity (15 min warm-up), DB costs $7/month after 90 days

### Option 3: Fly.io + Supabase + Render (100% Free)
- **Backend**: Fly.io (free tier - 3 VMs)
- **Database**: Supabase (free tier - 500MB, includes backups)
- **Frontend**: Render (static site - **100% FREE, always-on**)
- **Marketing**: Render (static site - **100% FREE, always-on**)
- **Pros**: Completely free, automated backups, no spin-down
- **Cons**: More complex setup, three platforms, Supabase has 500MB limit


---

## Step-by-Step: Railway (Backend) + Render (Frontend) ⭐ RECOMMENDED

### Why This Setup?
- ✅ Frontend is **100% free** on Render (static sites never spin down)
- ✅ Railway's $5/month credit usually covers backend + database
- ✅ **Automated database backups** included (no manual work needed)
- ✅ Point-in-time recovery available
- ✅ Simple to set up and manage

### 1. Domain Configuration

In your DNS provider:

```
Type    Name    Value
CNAME   app     [Render URL - will be provided]
CNAME   api     [Railway URL - will be provided]
```

### 2. Deploy Backend + Database to Railway

1. **Sign up**: https://railway.app (use GitHub login)

2. **Create New Project**:
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository

3. **Add PostgreSQL Database**:
   - Click "+ New" → "Database" → "PostgreSQL"
   - Railway automatically sets `DATABASE_URL` env var
   - **Backups**: Railway includes automated backups (check Settings → Backups)

4. **Add Backend Service**:
   - Click "+ New" → "GitHub Repo" → Select your repo
   - Settings:
     - **Root Directory**: `backend`
     - **Build Command**: `npm install && npm run build && npx prisma generate`
     - **Start Command**: `npm run start`

5. **Environment Variables** (in Backend service):
   ```
   NODE_ENV=production
   PORT=3001
   DATABASE_URL=[auto-set by Railway - links to PostgreSQL service]
   SESSION_SECRET=[generate: openssl rand -base64 32]
   CORS_ORIGIN=https://app.parlaystreak.com,https://parlaystreak.com
   RESEND_API_KEY=[your key]
   ADMIN_EMAILS=[your admin email]
   API_SPORTS_KEY=[your key]
   ```

6. **Run Migrations**:
   - In Railway, click on Backend service → "Deployments" → "View Logs"
   - Or use Railway CLI: `railway run npx prisma migrate deploy`

7. **Custom Domain**:
   - Backend service → Settings → "Networking"
   - Add custom domain: `api.parlaystreak.com`
   - Update DNS with provided CNAME

### 3. Deploy Frontend to Render

1. **Sign up**: https://render.com (use GitHub login)

2. **Create Static Site**:
   - Dashboard → "New +" → "Static Site"
   - Connect your GitHub repo
   - Settings:
     - **Name**: `parlay-streak-app`
     - **Root Directory**: `frontend`
     - **Build Command**: `npm install && npm run build`
     - **Publish Directory**: `dist`
     - **Environment Variables**:
       ```
       VITE_API_URL=https://api.parlaystreak.com
       ```

3. **Custom Domain**:
   - Settings → "Custom Domains"
   - Add: `app.parlaystreak.com`
   - Update DNS with provided CNAME
   - **Note**: Static sites on Render are 100% free and always-on!

### 4. Deploy Marketing Site to Render

1. **Create Static Site**:
   - Dashboard → "New +" → "Static Site"
   - Connect your GitHub repo
   - Settings:
     - **Name**: `parlay-streak-marketing`
     - **Root Directory**: `/` (root)
     - **Build Command**: (leave empty)
     - **Publish Directory**: `/` (root)

2. **Custom Domain**:
   - Settings → "Custom Domains"
   - Add: `parlaystreak.com`
   - Update DNS

### 5. Update Marketing Site API URL

In `index.html`, update the fetch URL:

```javascript
const response = await fetch('https://api.parlaystreak.com/api/bets/today');
```

---

## Step-by-Step: All-in-One Render Setup

### 1. Domain Configuration

In your DNS provider:

```
Type    Name    Value
CNAME   app     [Render URL - will be provided]
CNAME   api     [Render URL - will be provided]
```

### 2. Deploy Backend to Render

1. **Sign up**: https://render.com (use GitHub login)

2. **Create PostgreSQL Database**:
   - Dashboard → "New +" → "PostgreSQL"
   - Name: `parlay-streak-db`
   - Plan: Free (or Starter for production)
   - Note the connection string (Internal Database URL)

3. **Create Web Service (Backend)**:
   - Dashboard → "New +" → "Web Service"
   - Connect your GitHub repo
   - Settings:
     - **Name**: `parlay-streak-api`
     - **Root Directory**: `backend`
     - **Environment**: `Node`
     - **Build Command**: `npm install && npm run build && npx prisma generate`
     - **Start Command**: `npm run start`
     - **Plan**: Free (or Starter for production)

4. **Environment Variables**:
   ```
   NODE_ENV=production
   PORT=10000
   DATABASE_URL=[from PostgreSQL service - Internal Database URL]
   SESSION_SECRET=[generate: openssl rand -base64 32]
   CORS_ORIGIN=https://app.parlaystreak.com,https://parlaystreak.com
   RESEND_API_KEY=[your key]
   ADMIN_EMAILS=[your admin email]
   API_SPORTS_KEY=[your key]
   ```

5. **Run Migrations**:
   - After first deploy, go to "Shell" tab
   - Run: `npx prisma migrate deploy`

6. **Custom Domain** (optional):
   - Settings → "Custom Domains"
   - Add: `api.parlaystreak.com`
   - Update DNS with provided CNAME

### 3. Deploy Frontend to Render

1. **Create Static Site**:
   - Dashboard → "New +" → "Static Site"
   - Connect your GitHub repo
   - Settings:
     - **Name**: `parlay-streak-app`
     - **Root Directory**: `frontend`
     - **Build Command**: `npm install && npm run build`
     - **Publish Directory**: `dist`
     - **Environment Variables**:
       ```
       VITE_API_URL=https://api.parlaystreak.com
       # or use Render URL: VITE_API_URL=https://parlay-streak-api.onrender.com
       ```

2. **Custom Domain**:
   - Settings → "Custom Domains"
   - Add: `app.parlaystreak.com`
   - Update DNS with provided CNAME

### 4. Deploy Marketing Site to Render

1. **Create Static Site**:
   - Dashboard → "New +" → "Static Site"
   - Connect your GitHub repo
   - Settings:
     - **Name**: `parlay-streak-marketing`
     - **Root Directory**: `/` (root)
     - **Build Command**: (leave empty - it's already HTML)
     - **Publish Directory**: `/` (root)
     - **Index Document**: `index.html`

2. **Custom Domain**:
   - Settings → "Custom Domains"
   - Add: `parlaystreak.com`
   - Update DNS

### 5. Update Marketing Site API URL

In `index.html`, update the fetch URL:

```javascript
const response = await fetch('https://api.parlaystreak.com/api/bets/today');
```

---

## Alternative Backend Options

### Fly.io (Good Free Tier)
1. **Sign up**: https://fly.io
2. **Install CLI**: `curl -L https://fly.io/install.sh | sh`
3. **Create app**: `fly launch` in `backend/` directory
4. **Add Postgres**: `fly postgres create`
5. **Set secrets**: `fly secrets set DATABASE_URL=...`
6. **Deploy**: `fly deploy`
7. **Pros**: 3 free VMs, global edge, no spin-down
8. **Cons**: CLI required, more complex setup

### DigitalOcean App Platform
1. **Sign up**: https://digitalocean.com
2. **Create App**: Connect GitHub repo
3. **Add Database**: Managed PostgreSQL ($15/month)
4. **Pros**: Simple UI, good documentation
5. **Cons**: More expensive (~$15/month minimum)

### Supabase (Backend + Database)
1. **Sign up**: https://supabase.com
2. **Create Project**: Includes PostgreSQL
3. **Deploy Backend**: Use Supabase Edge Functions or separate hosting
4. **Pros**: Great free tier, includes auth, real-time
5. **Cons**: Different architecture (might need refactoring)

---

## Step-by-Step: Railway (Backend) + Render (Frontend)

### 1. Domain Configuration

In your DNS provider (wherever parlaystreak.com is hosted):

```
Type    Name    Value
A       app     [Vercel IP - will be provided]
CNAME   api     [Railway URL - will be provided]
```

Or use Railway's custom domain feature for `api.parlaystreak.com`.

### 2. Deploy Backend to Railway

1. **Sign up**: https://railway.app (use GitHub login)

2. **Create New Project**:
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your repository
   - Select the `backend` folder

3. **Add PostgreSQL**:
   - Click "+ New" → "Database" → "PostgreSQL"
   - Railway will automatically set `DATABASE_URL` env var

4. **Configure Environment Variables**:
   ```
   NODE_ENV=production
   PORT=3001
   DATABASE_URL=[auto-set by Railway]
   SESSION_SECRET=[generate: openssl rand -base64 32]
   CORS_ORIGIN=https://app.parlaystreak.com
   RESEND_API_KEY=[your key]
   ADMIN_EMAILS=[your admin email]
   API_SPORTS_KEY=[your key]
   ```

5. **Configure Build Settings**:
   - Root Directory: `.` (repo root, leave empty or set to `.`)
   - Build Command: `pwd && ls -la && test -d backend && cd backend && npm install && npm run build && npx prisma generate`
   - Start Command: `cd backend && pwd && ls -la dist/ 2>&1 | head -5 && node dist/index.js`

6. **Run Migrations**:
   - In Railway, open the PostgreSQL service
   - Copy the connection string
   - Locally: `DATABASE_URL="[railway-url]" npx prisma migrate deploy`
   - Or use Railway's CLI: `railway run npx prisma migrate deploy`

7. **Get Backend URL**:
   - Railway will provide a URL like: `https://your-app.up.railway.app`
   - You can add custom domain: `api.parlaystreak.com`

### 3. Deploy Frontend to Vercel

1. **Sign up**: https://vercel.com (use GitHub login)

2. **Import Project**:
   - Click "Add New" → "Project"
   - Import your GitHub repository
   - Root Directory: `frontend`

3. **Configure Build Settings**:
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

4. **Environment Variables**:
   ```
   VITE_API_URL=https://api.parlaystreak.com
   # or use Railway URL: VITE_API_URL=https://your-app.up.railway.app
   ```

5. **Configure Custom Domain**:
   - Go to Project Settings → Domains
   - Add: `app.parlaystreak.com`
   - Follow DNS instructions

6. **Update Frontend API Calls**:
   - The frontend should use `import.meta.env.VITE_API_URL` for API calls
   - Update `frontend/src/services/api.ts` to use this

### 4. Update Frontend API Configuration

The frontend needs to know where the backend is. Update `frontend/src/services/api.ts`:

```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
```

### 5. Update Backend CORS

Make sure `CORS_ORIGIN` in Railway includes:
- `https://app.parlaystreak.com`
- `https://parlaystreak.com` (for marketing page API calls)

### 6. Marketing Site Updates

If your marketing site needs to call the API (for today's bets), update the fetch URL in `index.html`:

```javascript
const response = await fetch('https://api.parlaystreak.com/api/bets/today');
```

---

## Alternative: All-in-One Railway Deployment

Railway can also host the frontend:

1. Deploy backend as above
2. Add a second service for frontend:
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Start Command: `npx serve -s dist -l 3000`
   - Add `serve` to frontend dependencies: `npm install --save serve`

---

## Environment Variables Checklist

### Backend (Railway)
- [ ] `NODE_ENV=production`
- [ ] `PORT=3001` (or Railway's PORT)
- [ ] `DATABASE_URL` (auto-set by Railway)
- [ ] `SESSION_SECRET` (generate new one)
- [ ] `CORS_ORIGIN=https://app.parlaystreak.com,https://parlaystreak.com`
- [ ] `RESEND_API_KEY`
- [ ] `ADMIN_EMAILS`
- [ ] `API_SPORTS_KEY`

### Frontend (Vercel)
- [ ] `VITE_API_URL=https://api.parlaystreak.com`

---

## Post-Deployment Tasks

1. **Run Database Migrations**:
   ```bash
   railway run npx prisma migrate deploy
   ```

2. **Seed Initial Data** (if needed):
   ```bash
   railway run npm run fetch-teams
   railway run npm run fetch-rosters
   ```

3. **Set up Cron Jobs** (for nightly roster updates):
   - Use Railway's Cron Jobs feature
   - Or use a service like cron-job.org
   - Schedule: `0 2 * * *` (2 AM daily)

4. **Test Everything**:
   - [ ] Marketing site loads
   - [ ] App frontend loads
   - [ ] API endpoints work
   - [ ] Authentication works
   - [ ] Database connections work
   - [ ] Today's bets load on marketing page

---

## Cost Estimate & Free Tier Details

### Render (All-in-One) - RECOMMENDED
- **Frontend (Static Site)**: ✅ **100% FREE** - No spin-down, unlimited bandwidth, always-on
- **Marketing (Static Site)**: ✅ **100% FREE** - No spin-down, unlimited bandwidth, always-on
- **Backend (Web Service)**: 
  - Free tier: Spins down after 15 min inactivity (30 sec cold start)
  - Starter plan: $7/month (always-on, no spin-down)
- **PostgreSQL Database**:
  - Free tier: 90 days free, then $7/month
  - **Includes**: Automated daily backups, point-in-time recovery, 1GB storage
  - Starter plan: $7/month (always-on, backups included)
- **Total Free**: Frontend + Marketing + Backend (with spin-down) = $0
- **Total Paid (Always-On)**: $14/month (Backend $7 + DB $7)

### Railway (Backend + DB) + Render (Frontend)
- **Railway**:
  - Free tier: $5 credit/month (usually covers small backend + DB)
  - After free tier: ~$5-10/month (includes DB)
  - **Database**: Included, automated backups available
- **Render Frontend**: ✅ **100% FREE** (static site)
- **Total**: $0-10/month depending on usage

### Fly.io (Backend) + Supabase (DB) + Render (Frontend)
- **Fly.io**: Free tier (3 VMs, 3GB storage)
- **Supabase PostgreSQL**: 
  - Free tier: 500MB database, **automated backups included**
  - Paid: $25/month for 8GB (if you exceed free tier)
- **Render Frontend**: ✅ **100% FREE** (static site)
- **Total**: $0/month (free tier) or $25/month if you need more DB

### Database Backup Comparison

| Provider | Free Tier | Backups | Point-in-Time Recovery | Best For |
|----------|-----------|---------|----------------------|----------|
| **Render** | 90 days | ✅ Daily automated | ✅ Yes | Easiest, all-in-one |
| **Railway** | Included | ✅ Automated | ✅ Yes | Simple, good free tier |
| **Supabase** | ✅ Yes | ✅ Daily automated | ✅ Yes | Best free tier, separate service |
| **Fly.io Postgres** | ❌ No | ✅ Manual setup | ⚠️ Limited | Advanced users |

## Recommendation for Your Situation

**Best Option: Railway (Backend + DB) + Render (Frontend)**

**Why:**
1. ✅ **Frontend is 100% free** on Render (static sites never spin down)
2. ✅ **Railway's $5/month credit** usually covers backend + database
3. ✅ **Automated backups included** - you don't need to manage them
4. ✅ **Point-in-time recovery** - can restore to any point in time
5. ✅ **Simple setup** - everything in one place
6. ✅ **If you exceed free tier**: Only ~$5-10/month total

**Alternative if you want completely free:**
- **Fly.io + Supabase + Render**: 
  - Backend: Fly.io (free)
  - Database: Supabase (free, 500MB, includes backups)
  - Frontend: Render (free)
  - **Total: $0/month** until you exceed limits

---

## Troubleshooting

### CORS Errors
- Make sure `CORS_ORIGIN` includes all domains
- Check that backend URL is correct in frontend env vars

### Database Connection Issues
- Verify `DATABASE_URL` is set correctly
- Run migrations: `railway run npx prisma migrate deploy`

### Frontend Can't Reach Backend
- Check `VITE_API_URL` is set correctly
- Verify backend is running and accessible
- Check CORS settings

### Marketing Page API Calls Fail
- Update fetch URL to use production API
- Check CORS includes marketing domain

---

## Security Checklist

- [ ] Use strong `SESSION_SECRET`
- [ ] Set `NODE_ENV=production`
- [ ] Enable HTTPS everywhere
- [ ] Review and restrict CORS origins
- [ ] Use environment variables for all secrets
- [ ] Enable Railway's automatic HTTPS
- [ ] Review admin email access

