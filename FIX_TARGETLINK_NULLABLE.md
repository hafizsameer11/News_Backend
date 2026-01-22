# Fix for targetLink Nullable Error

## Problem
The API endpoint `/api/v1/ads?slot=FOOTER&status=ACTIVE&limit=2` is returning a 500 error:
```
Error converting field "targetLink" of expected non-nullable type "String", found incompatible value of "null".
```

This happens because the database has ads with `null` values in the `targetLink` column, but the Prisma schema expects it to be non-nullable.

## Solution Applied

### 1. Schema Update ✅
- Updated `backend/prisma/schema.prisma` to make `targetLink` nullable:
  ```prisma
  targetLink String? @db.VarChar(2048)
  ```

### 2. Validator Update ✅
- Updated validators to properly handle null/empty values

### 3. Database Migration Required

You need to run the SQL migration to update the database schema:

**Option A: Run SQL directly**
```sql
ALTER TABLE `ads` MODIFY COLUMN `targetLink` VARCHAR(2048) NULL;
```

**Option B: Use Prisma Migrate (if you have permissions)**
```bash
cd backend
npx prisma migrate dev --name make_targetlink_nullable
```

**Option C: Run the SQL file**
```bash
mysql -u your_user -p tgcalabriareport < backend/prisma/migrations/make_targetlink_nullable.sql
```

## After Migration

1. Regenerate Prisma Client:
   ```bash
   cd backend
   npx prisma generate
   ```

2. Restart your backend server

3. Test the endpoint:
   ```bash
   curl https://api.tgcalabriareport.com/api/v1/ads?slot=FOOTER&status=ACTIVE&limit=2
   ```

## Notes

- The schema change allows `targetLink` to be `null`, which matches existing data in the database
- Validators already allow optional `targetLink` values
- This fix only affects the news backend as requested
