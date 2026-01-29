# Fix: YouTube URL Column Missing in Database

## Problem
The API is returning 500 errors because the `youtubeUrl` column doesn't exist in the database:
- `GET /api/v1/news?limit=10&status=PUBLISHED` - Error: "The column `tgcalabriareport.news.youtubeUrl` does not exist"
- `GET /api/v1/stats` - Error: "Database schema error" (likely because stats queries news table)

## Root Cause
The `youtubeUrl` field was added to the Prisma schema (`backend/prisma/schema.prisma`) but the database migration hasn't been run yet. Prisma is trying to query a column that doesn't exist in the database.

## Solution

### Step 1: Run the Database Migration

You need to apply the migration to add the `youtubeUrl` column to the `news` table.

**Option A: Using MySQL/MariaDB Command Line**

```bash
# Connect to your database and run the migration
mysql -u your_username -p your_database_name < backend/prisma/migrations/add_youtube_url_to_news.sql
```

**Option B: Manual SQL Execution**

1. Connect to your MySQL/MariaDB database
2. Select the database: `USE tgcalabriareport;`
3. Run the SQL commands:

```sql
-- Add youtubeUrl column to news table
ALTER TABLE `news` ADD COLUMN `youtubeUrl` VARCHAR(500) NULL AFTER `mainImage`;

-- Add index for faster queries (optional, but recommended)
CREATE INDEX `idx_news_youtube_url` ON `news`(`youtubeUrl`);
```

**Option C: Using Prisma Migrate (if you have permissions)**

```bash
cd backend
npx prisma migrate dev --name add_youtube_url_to_news
```

**Note**: If Prisma migrate fails due to permissions, use Option A or B (manual SQL).

### Step 2: Verify the Migration

After running the migration, verify the column exists:

```sql
DESCRIBE `news`;
```

You should see `youtubeUrl` in the column list.

### Step 3: Regenerate Prisma Client (if needed)

If you used manual SQL (Option A or B), regenerate the Prisma client:

```bash
cd backend
npx prisma generate
```

### Step 4: Restart the Backend

After the migration is applied, restart your backend server:

```bash
cd backend
npm run build
npm run start
# or if using PM2
pm2 restart news-backend
```

## Migration File Location

The migration file is located at:
- `backend/prisma/migrations/add_youtube_url_to_news.sql`

## What This Migration Does

1. **Adds `youtubeUrl` column**: 
   - Type: `VARCHAR(500)`
   - Nullable: `NULL` (optional field)
   - Position: After `mainImage` column

2. **Creates index**: 
   - Index name: `idx_news_youtube_url`
   - Improves query performance when filtering by YouTube URL

## Verification

After applying the migration, test the endpoints:

1. **News Endpoint**: `GET /api/v1/news?limit=10&status=PUBLISHED`
   - Should return 200 OK with news data

2. **Stats Endpoint**: `GET /api/v1/stats`
   - Should return 200 OK with statistics

## Troubleshooting

### Error: "Column already exists"
If you get this error, the migration was already applied. You can skip this step.

### Error: "Access denied"
If you get permission errors:
1. Make sure you're using a database user with ALTER TABLE permissions
2. Use Option A or B (manual SQL) with a user that has proper permissions
3. Contact your database administrator if needed

### Error persists after migration
1. Verify the column exists: `DESCRIBE news;`
2. Check Prisma client is regenerated: `npx prisma generate`
3. Restart the backend server
4. Check backend logs for any other errors

## Related Files

- Migration SQL: `backend/prisma/migrations/add_youtube_url_to_news.sql`
- Prisma Schema: `backend/prisma/schema.prisma` (line 204)
- Documentation: `backend/FIX_YOUTUBE_URL_FEATURE.md`
