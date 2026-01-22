# Fix: News Title Length Error

## Problem
When news titles exceed 255 characters, the system throws a server error because the database column is limited to VARCHAR(255), but the validators allow up to 500 characters.

## Solution
1. **Database Schema Update**: Changed `title` field from default VARCHAR(255) to VARCHAR(500) in Prisma schema
2. **CRM Validator Update**: Added max length validation (500 characters) to CRM news validator
3. **Frontend Input Enhancement**: Added `maxLength` attribute and character counter to prevent exceeding limit
4. **Database Migration**: Created SQL migration to update existing database

## Files Modified

### Backend
- `backend/prisma/schema.prisma`: Updated `title` field to `@db.VarChar(500)`
- `backend/src/validators/crm.validators.ts`: Added `.max(500)` validation to title field
- `backend/prisma/migrations/increase_news_title_length.sql`: Database migration script

### Frontend
- `frontend/src/components/admin/news-form-modal.tsx`: Added `maxLength={500}` and character counter

## How to Apply

### 1. Apply Database Migration

Run the SQL migration on your database:

```bash
# Option 1: Using MySQL/MariaDB client
mysql -u your_user -p your_database < backend/prisma/migrations/increase_news_title_length.sql

# Option 2: Using Prisma (if you have database access)
npx prisma migrate dev --name increase_news_title_length
```

**Note**: If Prisma migrate fails due to permissions, use the manual SQL migration file provided.

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

1. Try creating a news article with a title between 255-500 characters - it should work
2. Try creating a news article with a title over 500 characters - it should show validation error
3. Check the frontend input field - it should show character count and prevent typing beyond 500 characters

## Technical Details

- **Previous Limit**: VARCHAR(255) - default MySQL/MariaDB String type
- **New Limit**: VARCHAR(500) - explicitly set in Prisma schema
- **Validation**: 
  - Backend: Zod validators enforce 5-500 character range
  - Frontend: HTML `maxLength` attribute + JavaScript validation
- **Character Counter**: Shows current length / 500 in the form

## Related Issues

This fix addresses:
- Server errors when news titles exceed 255 characters
- Inconsistent validation between database and application layers
- Missing validation in CRM endpoints
