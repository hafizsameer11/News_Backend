# Fix: SLIDER_TOP AdType Enum Error

## Problem
The API endpoint `/api/v1/ads` returns a 404 error with the message:
```
Value 'SLIDER_TOP' not found in enum 'AdType'
```

This occurs because:
1. The Prisma schema enum `AdType` only includes `SLIDER`, not `SLIDER_TOP`
2. The database contains ads with `type = 'SLIDER_TOP'`
3. The validators and frontend support `SLIDER_TOP` as a distinct ad type

## Solution
1. **Updated Prisma Schema**: Added `SLIDER_TOP` to the `AdType` enum
2. **Database Migration**: Created SQL migration to update the database enum
3. **Pricing Configuration**: Added `SLIDER_TOP` pricing (50 EUR/day, same as BANNER_TOP)

## Files Modified

### Backend
- `backend/prisma/schema.prisma`: Added `SLIDER_TOP` to `AdType` enum
- `backend/src/config/ad-pricing.ts`: Added `SLIDER_TOP` pricing rate (50 EUR/day)
- `backend/prisma/migrations/add_slider_top_to_adtype.sql`: Database migration script

## How to Apply

### 1. Apply Database Migration

Run the SQL migration on your database:

```bash
# Option 1: Using MySQL/MariaDB client
mysql -u your_user -p your_database < backend/prisma/migrations/add_slider_top_to_adtype.sql

# Option 2: Manual execution
# Connect to your database and run:
ALTER TABLE `ads` MODIFY COLUMN `type` ENUM(
  'BANNER_TOP',
  'BANNER_SIDE',
  'INLINE',
  'FOOTER',
  'SLIDER',
  'SLIDER_TOP',
  'TICKER',
  'POPUP',
  'STICKY'
) NOT NULL;
```

**Note**: If you're using MySQL < 8.0.13, you may need to:
1. Create a temporary column
2. Copy data
3. Drop old column
4. Rename new column

### 2. Regenerate Prisma Client

After updating the schema, regenerate the Prisma client:

```bash
cd backend
npx prisma generate
```

### 3. Restart Backend

Restart your backend server to apply the changes:

```bash
cd backend
npm run build
npm run start
```

## Verification

1. Try accessing `/api/v1/ads` - it should now work without errors
2. Check that ads with `SLIDER_TOP` type are returned correctly
3. Verify that new ads can be created with `SLIDER_TOP` type

## Technical Details

- **Previous Enum**: `BANNER_TOP`, `BANNER_SIDE`, `INLINE`, `FOOTER`, `SLIDER`, `TICKER`, `POPUP`, `STICKY`
- **New Enum**: Added `SLIDER_TOP` between `SLIDER` and `TICKER`
- **Pricing**: `SLIDER_TOP` uses 50 EUR/day (same as `BANNER_TOP` since it's a prominent homepage hero position)
- **Frontend**: Already supports `SLIDER_TOP` as "Slider Top (Homepage Hero)"

## Related Issues

This fix addresses:
- 404 errors when fetching ads from `/api/v1/ads`
- Prisma enum validation errors for `SLIDER_TOP` ad type
- Inconsistency between database schema and application code
