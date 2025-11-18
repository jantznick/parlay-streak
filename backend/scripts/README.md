# Data Management Scripts

## Overview

These scripts manage team and roster data, with optional Backblaze B2 cloud storage integration.

## Scripts

### `fetch-teams.ts`
Fetches team data for all supported leagues from ESPN API.

**Usage:**
```bash
npm run fetch-teams
# or
ts-node backend/scripts/fetch-teams.ts
```

**What it does:**
- Fetches team data for all configured sports/leagues
- Saves to `shared/constants/teams.json`
- Only updates leagues that haven't been fetched in the last 24 hours
- Automatically uploads to Backblaze B2 if configured

### `fetch-rosters.ts`
Fetches roster data for all teams from ESPN API.

**Usage:**
```bash
npm run fetch-rosters
# or
ts-node backend/scripts/fetch-rosters.ts
```

**What it does:**
- Loads teams from `shared/constants/teams.json`
- Fetches roster for each team
- Saves to `backend/data/rosters/{sport}/{league}/{teamId}.json`
- Only updates rosters that haven't been fetched in the last 24 hours
- Automatically uploads each roster to Backblaze B2 if configured

**Note:** This should be run nightly to keep roster data fresh.

### `upload-to-backblaze.ts`
Uploads existing data files to Backblaze B2.

**Usage:**
```bash
npm run upload-to-backblaze
# or
ts-node backend/scripts/upload-to-backblaze.ts
```

**What it does:**
- Uploads `shared/constants/teams.json` → `teams/teams.json`
- Uploads all roster files → `rosters/{sport}/{league}/{teamId}.json`

**Use this to:**
- Upload existing data after setting up Backblaze
- Re-upload files if needed

## Backblaze B2 Setup

1. **Create Backblaze Account**: https://www.backblaze.com/b2/sign-up.html

2. **Create Bucket**:
   - Go to B2 Cloud Storage → Buckets
   - Create new bucket (e.g., `parlay-streak-data`)
   - Note the endpoint URL (e.g., `https://s3.us-west-004.backblazeb2.com`)

3. **Create Application Key**:
   - Go to App Keys → Add a New Application Key
   - Give it a name (e.g., `parlay-streak-scripts`)
   - Select your bucket
   - Give it "Read and Write" permissions
   - Save the Key ID and Application Key

4. **Get Your S3-Compatible Endpoint**:
   - Go to your bucket settings
   - Look for "S3 Compatible API" section
   - You'll see an endpoint like: `https://s3.us-west-004.backblazeb2.com`
   - **Note**: The region code (e.g., `us-west-004`) depends on where your bucket is located
   - Common endpoints:
     - US West: `https://s3.us-west-004.backblazeb2.com`
     - US East: `https://s3.us-east-005.backblazeb2.com`
     - EU Central: `https://s3.eu-central-003.backblazeb2.com`

5. **Configure Environment Variables**:
   Add to `backend/.env`:
   ```
   BACKBLAZE_KEY_ID=your_key_id_here
   BACKBLAZE_APPLICATION_KEY=your_application_key_here
   BACKBLAZE_BUCKET_NAME=parlay-streak-data
   BACKBLAZE_ENDPOINT=https://s3.us-west-004.backblazeb2.com
   ```
   
   **Important**: Replace `us-west-004` with your actual region code from step 4!

5. **Build Backend** (required for scripts to use Backblaze):
   ```bash
   cd backend
   npm run build
   ```

7. **Test Upload**:
   ```bash
   npm run upload-to-backblaze
   ```

## Where to Set Backblaze Configuration

All Backblaze settings are configured via environment variables in `backend/.env`:

```bash
# Required: Your Backblaze credentials
BACKBLAZE_KEY_ID=your_key_id_here
BACKBLAZE_APPLICATION_KEY=your_application_key_here
BACKBLAZE_BUCKET_NAME=parlay-streak-data

# Required: Your S3-compatible endpoint
# Find this in your Backblaze bucket settings under "S3 Compatible API"
BACKBLAZE_ENDPOINT=https://s3.us-west-004.backblazeb2.com
```

**For Production (Railway/Render):**
- Set these same environment variables in your hosting platform's dashboard
- The backend will automatically use them when deployed

## Workflow

### Initial Setup
1. Run `fetch-teams.ts` to get all team data
2. Run `fetch-rosters.ts` to get all roster data
3. Run `upload-to-backblaze.ts` to upload everything to Backblaze

### Daily/Nightly Updates
1. Run `fetch-rosters.ts` (it will only update rosters older than 24 hours)
2. Files are automatically uploaded to Backblaze as they're fetched

### Weekly/Monthly Updates
1. Run `fetch-teams.ts` (it will only update leagues older than 24 hours)
2. File is automatically uploaded to Backblaze

## Backend Integration

The backend service (`apiSports.service.ts`) automatically:
- Tries to load data from Backblaze first
- Falls back to local files if Backblaze is not available
- Falls back to ESPN API if neither is available

This means:
- ✅ You can run scripts locally and upload to Backblaze
- ✅ Backend on Railway/Render will fetch from Backblaze
- ✅ No need to commit large data files to git
- ✅ Backend works even if Backblaze is not configured (uses local files)

## File Structure in Backblaze

```
teams/
  └── teams.json

rosters/
  ├── basketball/
  │   ├── nba/
  │   │   ├── 1.json
  │   │   ├── 2.json
  │   │   └── ...
  │   └── wnba/
  │       └── ...
  ├── football/
  │   └── nfl/
  │       └── ...
  └── ...
```

## Cost

Backblaze B2 pricing (as of 2024):
- **Storage**: $0.005/GB/month (~$0.50 for 100GB)
- **Download**: First 1GB/day free, then $0.01/GB
- **Upload**: Free

For this use case (teams.json + rosters), you're looking at:
- Storage: < $0.10/month
- Downloads: Likely free (under 1GB/day)
- **Total: ~$0.10/month or less**
