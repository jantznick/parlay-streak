# Deploying the Marketing Site to Render

This directory contains the static marketing site for Parlay Streak.

## Render Deployment Steps

1. **Go to Render Dashboard**: https://dashboard.render.com

2. **Create New Static Site**:
   - Click "New +" → "Static Site"
   - Connect your Git repository (GitHub/GitLab/Bitbucket)

3. **Configure the Static Site**:
   - **Name**: `parlay-streak-marketing` (or your preferred name)
   - **Branch**: `main` (or your default branch)
   - **Root Directory**: `public`
   - **Build Command**: Leave empty or use `echo "No build needed"`
   - **Publish Directory**: `.` (current directory, which is `public`)

4. **Environment Variables**: None needed for static site

5. **Click "Create Static Site"**

## Alternative: Using render.yaml

If you're using the `render.yaml` file in the root directory, the marketing site service is already configured:

```yaml
# Marketing Site
- type: web
  name: parlay-streak-marketing
  env: static
  rootDir: public
  buildCommand: echo "No build needed for static site"
  staticPublishPath: .
```

When you push to your repository, Render will automatically detect and deploy the static site.

## Custom Domain

After deployment, you can add a custom domain:
1. Go to your static site settings in Render
2. Click "Custom Domains"
3. Add `parlaystreak.com` (or your domain)
4. Follow DNS configuration instructions

## Notes

- The `_redirects` file ensures proper routing for all pages
- All HTML files are in the `public/` directory
- The site uses Tailwind CSS via CDN, so no build step is required

