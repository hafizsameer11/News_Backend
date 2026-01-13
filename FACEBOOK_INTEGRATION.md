# Facebook Integration Guide for TGCalabriaReport

## Overview
Your news backend is now configured to automatically post to Facebook when you publish news articles with social media selected.

## Configuration Complete ✅

1. **Facebook App Credentials Updated**
   - App ID: `851090237886043`
   - App Secret: `2e91c2844362b82180eb7ce0faefad08`
   - Configured in `/var/www/backend/.env`

2. **Automatic Posting Integration**
   - When you create or update news with status "PUBLISHED" and select Facebook in social media options, it will automatically post to your Facebook page
   - Posts include: title, summary, article link, and main image

3. **New API Endpoint**
   - `POST /api/v1/social/connect/facebook-page` - Connect Facebook page directly using page access token

## Step 1: Connect Your Facebook Page

You need to connect your Facebook page (TGCalabriaReport) to the system. Here are the methods:

### Method A: Using Facebook Graph API Explorer (Recommended)

1. **Go to Facebook Graph API Explorer**
   - Visit: https://developers.facebook.com/tools/explorer/
   - Select your app: `851090237886043`

2. **Get User Access Token**
   - Click "Generate Access Token"
   - Select these permissions:
     - `pages_manage_posts`
     - `pages_read_engagement`
     - `pages_show_list`
     - `pages_read_user_content`
   - Authorize the app

3. **Exchange for Long-Lived Token**
   ```
   GET https://graph.facebook.com/v18.0/oauth/access_token?
     grant_type=fb_exchange_token&
     client_id=851090237886043&
     client_secret=2e91c2844362b82180eb7ce0faefad08&
     fb_exchange_token={your-short-lived-token}
   ```

4. **Get Your Pages**
   ```
   GET https://graph.facebook.com/v18.0/me/accounts?
     access_token={your-long-lived-token}
   ```

5. **Find TGCalabriaReport Page**
   - Look for the page with name "TGCalabriaReport"
   - Note the `id` (Page ID) and `access_token` (Page Access Token)

6. **Connect via API**
   ```bash
   curl -X POST https://tgcalabriareport.com/api/v1/social/connect/facebook-page \
     -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "pageId": "YOUR_PAGE_ID",
       "pageAccessToken": "YOUR_PAGE_ACCESS_TOKEN",
       "pageName": "TGCalabriaReport"
     }'
   ```

### Method B: Using OAuth Flow (Easiest)

1. **Go to Admin Panel**
   - Navigate to Settings → Social Media Integration
   - Click "Connect Facebook"
   - Authorize the app
   - Select your page "TGCalabriaReport"
   - Done! The page will be automatically connected

### Method C: Get Page ID from Facebook Page

1. **Visit your page**: https://www.facebook.com/TGCalabriaReport/
2. **View page source** (Ctrl+U or Cmd+U)
3. **Search for** `"page_id":"` or `"entity_id":"`
4. **The number after it** is your Page ID

Or use Graph API:
```
GET https://graph.facebook.com/v18.0/TGCalabriaReport?access_token={token}
```

## Step 2: Using Automatic Posting

Once your Facebook page is connected:

1. **Create or Edit News Article**
   - Fill in title, content, summary, main image
   - Set status to "PUBLISHED"
   - Check "Post to Social Media"
   - Select "Facebook" platform
   - Click "Save" or "Publish"

2. **Automatic Posting**
   - The system will automatically post to your Facebook page
   - Post includes:
     - Title
     - Summary
     - Link to full article
     - Main image (if available)

3. **Check Post Status**
   - Go to Social Media Integration settings
   - View posting logs to see success/failure status

## API Endpoints

### Connect Facebook Page
```
POST /api/v1/social/connect/facebook-page
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "pageId": "your_page_id",
  "pageAccessToken": "your_page_access_token",
  "pageName": "TGCalabriaReport"
}
```

### Manual Post to Social Media
```
POST /api/v1/social/post/{newsId}
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "platforms": ["FACEBOOK"]
}
```

### Get Connected Accounts
```
GET /api/v1/social
Authorization: Bearer {admin_token}
```

## Troubleshooting

### "No active Facebook account connected"
- Make sure you've connected your Facebook page using one of the methods above
- Check that the account is active in the Social Media Integration settings

### "Token expired"
- Facebook page tokens expire after 60 days
- The system will attempt to refresh tokens automatically
- If refresh fails, reconnect the page

### "Failed to post to Facebook"
- Check that your app has the required permissions
- Verify the page is published and you're an admin
- Check the backend logs for detailed error messages

## Notes

- **Page Access Tokens** are long-lived (60 days) and can be refreshed
- **Automatic posting** only happens when:
  - News status is "PUBLISHED"
  - Social media platforms are selected
  - Facebook page is connected and active
- **Posts are logged** in the database for tracking and debugging
- **Image requirement**: Facebook posts work best with a main image

## Support

If you encounter issues:
1. Check backend logs: `pm2 logs news-backend`
2. Verify Facebook app permissions
3. Ensure page access token is valid
4. Check that the page is published and accessible


