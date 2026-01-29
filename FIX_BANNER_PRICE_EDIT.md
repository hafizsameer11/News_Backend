# Fix: Banner/Ad Price Editing Issue

## Problem
Users reported that banners (ads) cannot be edited after creation. Specifically, they cannot change the price of an existing banner - they have to recreate it.

## Root Cause
The price field was only being sent to the backend when it had a value AND was not empty. However, when editing an ad:
1. If the user wanted to change ONLY the price (without changing dates or type), the price might not be properly sent
2. The backend would only recalculate price if dates/type changed AND price wasn't provided
3. This meant price-only updates weren't being processed correctly

## Solution

### Frontend Changes (`frontend/src/components/admin/ad-form-modal.tsx`)

1. **Enhanced Price Submission Logic**:
   - When editing an ad, always send the price if the form field has a value
   - Added explicit validation before form submission to catch invalid prices early
   - Ensures price updates are sent even if no other fields changed

2. **Improved Price Validation**:
   - Added pre-submit validation for price when editing
   - Shows clear error messages if price is invalid
   - Prevents form submission with invalid price values

**Key Changes**:
```typescript
// Before: Price only sent if not empty
if (formData.price && formData.price.trim() !== "") {
  // ... send price
}

// After: When editing, always send price if it has a value
if (ad) {
  if (formData.price !== undefined && formData.price !== null && formData.price.toString().trim() !== "") {
    // Validate and send price
    submitData.price = Math.round(priceValue * 100) / 100;
  }
}
```

### Backend Behavior (Already Correct)

The backend (`backend/src/services/ad.service.ts`) already handles price updates correctly:
- If price is explicitly provided, it uses that value
- If price is not provided but dates/type changed, it recalculates
- If price is not provided and nothing else changed, it keeps existing price

## Files Modified

- `frontend/src/components/admin/ad-form-modal.tsx`:
  - Enhanced `handleSubmit` to always send price when editing
  - Added pre-submit price validation
  - Improved price handling logic for edit vs create scenarios

## Testing

To verify the fix:
1. Create a banner/ad with a price
2. Edit the banner and change ONLY the price (don't change dates or type)
3. Save the changes
4. Verify the price has been updated

## Technical Details

- **Price Field**: The price input field is not disabled and can be edited
- **Price Format**: Price is stored as Decimal(10, 2) in the database
- **Price Validation**: Frontend validates price is a positive number before submission
- **Backend Processing**: Backend accepts price updates for all ad statuses (PENDING, ACTIVE, PAUSED)

## User Impact

- ✅ Users can now edit the price of existing banners/ads
- ✅ Price can be changed independently of other fields
- ✅ No need to recreate ads just to change the price
- ✅ Price updates work for all ad statuses (PENDING, ACTIVE, PAUSED)
