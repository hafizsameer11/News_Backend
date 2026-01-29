# Fix: YouTube URL Support for News Articles

## Problem
Users need to add YouTube video links to news articles. The system should support YouTube URLs and display them as embedded videos in news articles.

## Solution
1. **Database Schema**: Added `youtubeUrl` field to `News` model
2. **Backend Validators**: Added YouTube URL validation to news validators
3. **Frontend Form**: Added YouTube URL input field with live preview
4. **Display Components**: Updated news display to show YouTube embeds
5. **Helper Functions**: Created YouTube URL utilities for embed conversion

## Files Modified

### Backend
- `backend/prisma/schema.prisma`: Added `youtubeUrl String?` field to News model
- `backend/src/validators/news.validators.ts`: Added YouTube URL validation
- `backend/src/validators/crm.validators.ts`: Added YouTube URL validation for CRM
- `backend/src/services/news.service.ts`: Added youtubeUrl handling in create/update
- `backend/src/services/crm.service.ts`: Added youtubeUrl to CRM news creation
- `backend/prisma/migrations/add_youtube_url_to_news.sql`: Database migration

### Frontend
- `frontend/src/types/news.types.ts`: Added `youtubeUrl` to News interfaces
- `frontend/src/components/admin/news-form-modal.tsx`: Added YouTube URL input field with preview
- `frontend/src/components/news/news-detail-client.tsx`: Added YouTube embed display
- `frontend/src/components/ui/news-card.tsx`: Added YouTube thumbnail support
- `frontend/src/components/home/homepage-sections.tsx`: Added YouTube thumbnail support
- `frontend/src/lib/helpers/youtube.ts`: New helper functions for YouTube URLs

## How to Apply

### 1. Apply Database Migration

Run the SQL migration on your database:

```bash
# Option 1: Using MySQL/MariaDB client
mysql -u your_user -p your_database < backend/prisma/migrations/add_youtube_url_to_news.sql

# Option 2: Manual execution
# Connect to your database and run:
ALTER TABLE `news` ADD COLUMN `youtubeUrl` VARCHAR(500) NULL AFTER `mainImage`;
CREATE INDEX `idx_news_youtube_url` ON `news`(`youtubeUrl`);
```

**Note**: If Prisma migrate fails due to permissions, use the manual SQL migration file provided.

### 2. Regenerate Prisma Client

After updating the schema, regenerate the Prisma client:

```bash
cd backend
npx prisma generate
```

### 3. Rebuild and Restart Backend

```bash
cd backend
npm run build
npm run start
```

## Features

### YouTube URL Input Field
- Located in the news creation/editing form
- Validates YouTube URLs (youtube.com or youtu.be)
- Shows live preview of YouTube embed
- Optional field (can be used alongside or instead of main image)

### YouTube Embed Display
- **News Detail Page**: Shows full YouTube embed (16:9 aspect ratio)
- **News Cards**: Shows YouTube thumbnail with play button overlay
- **Homepage Sections**: Shows YouTube thumbnails in featured sections

### Supported YouTube URL Formats
- `https://www.youtube.com/watch?v=VIDEO_ID`
- `https://youtu.be/VIDEO_ID`
- `https://www.youtube.com/embed/VIDEO_ID`
- `https://youtube.com/watch?v=VIDEO_ID`

## Usage

1. **Creating News with YouTube Video**:
   - Fill in the news form as usual
   - In the "YouTube Video URL" field, paste a YouTube URL
   - The form will show a live preview of the embed
   - Submit the form

2. **Display Priority**:
   - If `youtubeUrl` is provided, it takes priority over `mainImage` for video display
   - YouTube embed is shown in the news detail page
   - YouTube thumbnail is shown in news cards and lists
   - `mainImage` can still be used for thumbnail/fallback

## Technical Details

- **Database Field**: `youtubeUrl VARCHAR(500) NULL`
- **Validation**: Must be a valid YouTube URL (youtube.com or youtu.be)
- **Embed Conversion**: Automatically converts various YouTube URL formats to embed URLs
- **Thumbnail**: Uses YouTube's thumbnail API (`img.youtube.com/vi/VIDEO_ID/highdefault.jpg`)

## Related Issues

This feature addresses:
- Ability to embed YouTube videos in news articles
- Proper YouTube URL validation
- YouTube embed display in news detail pages
- YouTube thumbnail display in news cards and lists
