# Fix: Pro Loco Login and News Approval Flow

## Problems Fixed

1. **Redirect Issue**: Pro Loco login was redirecting to normal pages instead of staying on Pro Loco dashboard
2. **Login Method**: Approved Pro Loco users should be able to login with just email/password (without city/code)
3. **News Approval**: News created by Pro Loco should require admin approval (PENDING_REVIEW status)

## Solutions Applied

### 1. Integrated Pro Loco Login with Main Auth System

**Frontend (`frontend/src/components/proloco/proloco-auth.tsx`)**:
- Updated to use main `AuthProvider` and `tokenStorage` instead of separate `proloco_auth_token`
- Uses `authLogin()` from AuthProvider for proper integration
- Redirect uses `window.location.href = "/proloco/dashboard"` to prevent Next.js router conflicts

**Changes**:
```typescript
// Before: Separate token storage
localStorage.setItem("proloco_auth_token", response.data.data.token);

// After: Main auth system
tokenStorage.set(token);
authLogin(token, user);
window.location.href = "/proloco/dashboard";
```

### 2. Conditional Login Form

**Frontend (`frontend/src/components/proloco/proloco-auth.tsx`)**:
- Added login mode toggle: "Email / Password" vs "Città / Codice"
- **Email/Password mode**: For approved Pro Loco users (simpler login)
- **City/Code mode**: For pending Pro Loco users or initial login
- Form validation ensures either email OR (city + code) is provided

**Features**:
- Toggle buttons to switch between login modes
- Email/password mode shows only email and password fields
- City/code mode shows city, code, and password fields
- Demo button fills appropriate fields based on mode

### 3. Fixed Redirect Logic

**Frontend (`frontend/src/lib/hooks/useAuth.ts`)**:
- Added Pro Loco role check in `useLogin` hook
- Pro Loco users redirect to `/proloco/dashboard` after login

**Frontend (`frontend/app/proloco/dashboard/page.tsx`)**:
- Improved redirect logic to handle different user roles
- Non-Pro Loco users are redirected to their appropriate dashboards
- Unauthenticated users redirect to `/register?type=proloco`

### 4. News Approval Requirement

**Backend (`backend/src/services/news.service.ts`)**:
- Already enforces PENDING_REVIEW for Pro Loco users (line 286-288)
- If Pro Loco tries to set status to PUBLISHED, it's automatically changed to PENDING_REVIEW

**Frontend (`frontend/src/components/admin/news-form-modal.tsx`)**:
- Detects Pro Loco users via `useAuth()` hook
- Status field is disabled for Pro Loco users
- Status is automatically set to PENDING_REVIEW for new news
- Help text explains that admin approval is required
- PUBLISHED option is hidden for Pro Loco users

**Changes**:
```typescript
// Detect Pro Loco user
const isProlocoUser = currentUser?.role === "PROLOCO";

// Force PENDING_REVIEW on submit
if (isProlocoUser) {
  submitData.status = "PENDING_REVIEW";
}

// Disable status field for Pro Loco
disabled={isLoading || isProlocoUser}
```

### 5. Backend Validation

**Backend (`backend/src/validators/auth.validators.ts`)**:
- Updated `prolocoLoginValidator` to ensure either email OR (city + code) is provided
- Prevents invalid login attempts

## Files Modified

### Frontend
- `frontend/src/components/proloco/proloco-auth.tsx`: Integrated with main auth, added login mode toggle
- `frontend/src/lib/hooks/useAuth.ts`: Added Pro Loco redirect
- `frontend/app/proloco/dashboard/page.tsx`: Improved redirect logic
- `frontend/src/components/admin/news-form-modal.tsx`: Auto-set PENDING_REVIEW for Pro Loco

### Backend
- `backend/src/validators/auth.validators.ts`: Enhanced Pro Loco login validation

## User Flow

### For Approved Pro Loco Users:
1. Go to `/register?type=proloco` or Pro Loco login page
2. Select "Email / Password" mode (default)
3. Enter email and password
4. Click "Accedi" (Login)
5. Redirected to `/proloco/dashboard`
6. Can create news (automatically set to PENDING_REVIEW)
7. News requires admin approval before appearing on site

### For Pending Pro Loco Users:
1. Go to Pro Loco login page
2. Select "Città / Codice" mode
3. Enter city, Pro Loco code, and password
4. Click "Accedi" (Login)
5. If approved, redirected to dashboard
6. If pending, shown approval pending message

## Verification

1. **Login as Approved Pro Loco**:
   - Use email/password mode
   - Should redirect to `/proloco/dashboard`
   - Should stay on Pro Loco dashboard (not redirect elsewhere)

2. **Create News as Pro Loco**:
   - Status field should be disabled
   - Status should show "PENDING_REVIEW"
   - Help text should explain admin approval is required
   - Backend should enforce PENDING_REVIEW even if frontend tries to send PUBLISHED

3. **News Approval**:
   - News created by Pro Loco should appear in admin panel for approval
   - Only admin can change status from PENDING_REVIEW to PUBLISHED

## Technical Details

- **Auth Integration**: Pro Loco login now uses the same token storage as regular users
- **Redirect Method**: Uses `window.location.href` instead of Next.js router to prevent conflicts
- **Status Enforcement**: Both frontend and backend enforce PENDING_REVIEW for Pro Loco
- **Login Flexibility**: Supports both email/password (approved) and city/code (pending) login methods
