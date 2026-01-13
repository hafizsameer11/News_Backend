# How to Connect Your Facebook Page (TGCalabriaReport)

## Method 1: Using Facebook Graph API Explorer (Recommended)

1. Go to [Facebook Graph API Explorer](https://developers.facebook.com/tools/explorer/)
2. Select your app: `851090237886043`
3. Get a User Access Token with these permissions:
   - `pages_manage_posts`
   - `pages_read_engagement`
   - `pages_show_list`
   - `pages_read_user_content`
4. Click "Generate Access Token" and authorize the app
5. Exchange for a long-lived token (60 days):
   ```
   GET https://graph.facebook.com/v18.0/oauth/access_token?
     grant_type=fb_exchange_token&
     client_id=851090237886043&
     client_secret=2e91c2844362b82180eb7ce0faefad08&
     fb_exchange_token={short-lived-token}
   ```
6. Get your pages:
   ```
   GET https://graph.facebook.com/v18.0/me/accounts?
     access_token={long-lived-token}
   ```
7. Find your page "TGCalabriaReport" and get its `id` and `access_token`
8. Use the API endpoint to connect:
   ```bash
   POST /api/v1/social/connect/facebook-page
   {
     "pageId": "YOUR_PAGE_ID",
     "pageAccessToken": "YOUR_PAGE_ACCESS_TOKEN",
     "pageName": "TGCalabriaReport"
   }
   ```

## Method 2: Using OAuth Flow (Automatic)

1. Go to your admin panel settings
2. Navigate to Social Media Integration
3. Click "Connect Facebook"
4. Authorize the app
5. Select your page "TGCalabriaReport"
6. The page will be automatically connected

## Method 3: Using Page Access Token Directly

If you already have a page access token:

1. Get your Page ID from your Facebook page URL or Graph API
2. Use the connect endpoint:
   ```bash
   POST /api/v1/social/connect/facebook-page
   Authorization: Bearer YOUR_ADMIN_TOKEN
   {
     "pageId": "YOUR_PAGE_ID",
     "pageAccessToken": "YOUR_PAGE_ACCESS_TOKEN",
     "pageName": "TGCalabriaReport"
   }
   ```

## Getting Your Page ID

1. Go to your Facebook page: https://www.facebook.com/TGCalabriaReport/
2. View page source (Ctrl+U)
3. Search for `"page_id":"` or `"entity_id":"`
4. The number after it is your Page ID

Or use Graph API:
```
GET https://graph.facebook.com/v18.0/TGCalabriaReport?access_token={token}
```

## Notes

- Page Access Tokens are long-lived (60 days) and can be refreshed
- Make sure your app has the required permissions
- The page must be published and you must be an admin


