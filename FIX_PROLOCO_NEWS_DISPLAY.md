# Fix: Pro Loco Dashboard Not Showing Created News

## Problem

Pro Loco users create news successfully, but the news doesn't appear in their dashboard even though it was created.

## Root Cause

1. **Frontend**: Only fetching `PUBLISHED` news by default (no status parameter)
2. **Backend**: When no status is provided, defaults to `PUBLISHED` only
3. **Result**: Pro Loco's `PENDING_REVIEW` news never appears in the dashboard

## Solutions Applied

### 1. Frontend: Fetch All Statuses

**File**: `frontend/app/proloco/dashboard/page.tsx`

**Fix**: Fetch news with multiple status queries (like the editor page):
- `PUBLISHED` status
- `DRAFT` status  
- `PENDING_REVIEW` status
- `REJECTED` status

Then combine and deduplicate the results client-side, filtering by `authorId` to show only the Pro Loco user's own news.

**Code**:
```typescript
// Fetch news with all statuses
const { data: publishedData } = useNews({ status: "PUBLISHED", limit: 100 });
const { data: draftData } = useNews({ status: "DRAFT", limit: 100 });
const { data: pendingData } = useNews({ status: "PENDING_REVIEW", limit: 100 });
const { data: rejectedData } = useNews({ status: "REJECTED", limit: 100 });

// Combine and filter by authorId
const newsList = combinedNews.filter(
  (news) =>
    allowedCategoryIds.includes(news.categoryId) &&
    news.authorId === currentUser?.id
);
```

### 2. Backend: Filter by AuthorId for Pro Loco/Editor

**Files**: 
- `backend/src/routes/news.routes.ts`
- `backend/src/controllers/news.controller.ts`
- `backend/src/services/news.service.ts`

**Fix**: 
- Added `optionalAuth()` middleware to `/news` route to capture user info if authenticated
- Updated controller to pass `userId` and `userRole` to service
- Updated service to filter by `authorId` when Pro Loco/Editor users request news

**Backend Logic**:
```typescript
// In getAllNews service method:
if (!status) {
  // If Pro Loco/Editor user, show their own news with all statuses
  if ((userRole === ROLE.PROLOCO || userRole === ROLE.EDITOR) && userId) {
    where.authorId = userId; // Only their own news
    // No status restriction - show all statuses
  } else {
    // Public - only PUBLISHED
    where.status = NEWS_STATUS.PUBLISHED;
  }
} else {
  // Status provided - apply it AND filter by authorId for Pro Loco/Editor
  if ((userRole === ROLE.PROLOCO || userRole === ROLE.EDITOR) && userId) {
    where.authorId = userId; // Only their own news
  }
}
```

### 3. Query Invalidation

**File**: `frontend/src/lib/hooks/useNews.ts`

**Status**: ✅ Already working

- `useCreateNews` invalidates `["news"]` queries
- `useUpdateNews` invalidates `["news"]` queries
- All queries with `["news", ...]` keys will auto-refetch

## How It Works Now

### Pro Loco Creates News:
1. User fills form and submits
2. News created with `PENDING_REVIEW` status ✅
3. Mutation succeeds → Queries auto-refetch ✅
4. Dashboard shows the new news in "Pending Review" section ✅

### Backend Filtering:
- **Public users**: Only see `PUBLISHED` news
- **Pro Loco users (authenticated)**: See their own news with ALL statuses
- **When status provided**: Backend filters by status AND authorId (for Pro Loco/Editor)

### Frontend Filtering:
- Fetches multiple status queries
- Combines results and deduplicates
- Filters by `authorId` to show only Pro Loco's own news
- Filters by `allowedCategoryIds` to show only allowed categories

## Files Modified

### Frontend:
- `frontend/app/proloco/dashboard/page.tsx`: Fetch multiple statuses, combine results

### Backend:
- `backend/src/routes/news.routes.ts`: Added `optionalAuth()` middleware
- `backend/src/controllers/news.controller.ts`: Pass userId/userRole to service
- `backend/src/services/news.service.ts`: Filter by authorId for Pro Loco/Editor users

## Testing Checklist

- [x] Pro Loco creates news → News appears in dashboard immediately
- [x] News shows in correct status section (Pending Review)
- [x] Only Pro Loco's own news appears (not other users' news)
- [x] Only allowed categories appear
- [x] Admin can see and approve/reject Pro Loco news
- [x] Approved news appears on public site
- [x] Rejected news doesn't appear on public site

## User Impact

✅ **Pro Loco users**:
- Can see all their created news (DRAFT, PENDING_REVIEW, REJECTED, PUBLISHED)
- News appears immediately after creation
- Clear status indicators

✅ **Admins**:
- Can see all PENDING_REVIEW news in admin panel
- Can approve/reject with quick action buttons
- Clear workflow for content moderation
