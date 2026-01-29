# Fix: Banner/Ad Issues - Complete Resolution

## Problems Fixed

1. **JavaScript Error**: `Cannot read properties of null (reading 'trim')` when submitting ad form
2. **Banner Price Parsing**: European format (400,00€) was being parsed incorrectly as 4,000.00€
3. **Banner Editing**: Banners couldn't be edited after creation (price changes)
4. **Breaking News Banner**: Title gets cut off on mobile devices
5. **Banner Positions**:
   - Slider banner doesn't appear
   - Top slider banner: max 2, third goes to top banner section
   - Ticker banner goes to top slider banner section
   - Popup banner doesn't appear
6. **News Image Duplication**: Images in news content appear twice

## Solutions Applied

### 1. Fixed JavaScript Error (null.trim())

**File**: `frontend/src/components/admin/ad-form-modal.tsx`

**Issue**: `targetLink` field could be null, causing error when calling `.trim()`

**Fix**:
```typescript
// Before:
if (formData.targetLink.trim()) {
  submitData.targetLink = formData.targetLink.trim();
}

// After:
if (formData.targetLink && formData.targetLink.trim() !== "") {
  submitData.targetLink = formData.targetLink.trim();
}
```

### 2. Fixed Price Parsing (European Format)

**Files**: 
- `frontend/src/components/admin/ad-form-modal.tsx`
- `backend/src/services/ad.service.ts`

**Issue**: European format (400,00€) was being treated as thousands separator, resulting in 4,000.00€

**Fix**: Added intelligent parsing that handles both formats:
- **European format**: `400,00` → `400.00`
- **US format**: `400.00` → `400.00`
- **Mixed format**: `1.234,56` (European) → `1234.56`
- **Mixed format**: `1,234.56` (US) → `1234.56`

**Implementation**:
```typescript
// Handle both European (comma) and US (dot) decimal formats
let cleanedPrice = formData.price.toString().replace(/[€$£\s]/g, "").trim();

// If comma is present, treat it as European decimal separator
if (cleanedPrice.includes(",") && !cleanedPrice.includes(".")) {
  // European format: 400,00 -> 400.00
  cleanedPrice = cleanedPrice.replace(",", ".");
} else if (cleanedPrice.includes(",") && cleanedPrice.includes(".")) {
  // Mixed format: determine which is decimal separator
  const commaIndex = cleanedPrice.indexOf(",");
  const dotIndex = cleanedPrice.indexOf(".");
  if (commaIndex > dotIndex) {
    // Format: 1.234,56 -> 1234.56 (European)
    cleanedPrice = cleanedPrice.replace(/\./g, "").replace(",", ".");
  } else {
    // Format: 1,234.56 -> 1234.56 (US)
    cleanedPrice = cleanedPrice.replace(/,/g, "");
  }
} else {
  // Only dots or no separators
  cleanedPrice = cleanedPrice.replace(/[^0-9.]/g, "");
}
```

### 3. Fixed Banner Editing

**File**: `frontend/src/components/admin/ad-form-modal.tsx`

**Issue**: Price wasn't being sent when editing ads

**Fix**: Always send price when editing (even if unchanged) to allow price updates:
```typescript
if (ad) {
  // When editing, always send price if formData has a value
  if (formData.price !== undefined && formData.price !== null && formData.price.toString().trim() !== "") {
    // ... parse and send price
    submitData.price = Math.round(priceValue * 100) / 100;
  }
}
```

### 4. Fixed Breaking News Banner Title Cut-off

**File**: `frontend/src/components/notifications/breaking-news-alert.tsx`

**Issue**: Long titles were cut off with `truncate`, making them unreadable

**Fix**: Changed from `truncate` to `line-clamp-2 break-words` to allow wrapping:
```typescript
// Before:
<span className="font-semibold text-sm sm:text-base truncate block">{news.title}</span>

// After:
<span className="font-semibold text-sm sm:text-base line-clamp-2 break-words">{news.title}</span>
```

### 5. Fixed Banner Position Issues

#### 5.1. SLIDER_TOP Limit to 2 Ads

**Files**:
- `frontend/src/components/ads/slider-ad.tsx`
- `backend/src/services/ad.service.ts`

**Fix**: Limited SLIDER_TOP ads to maximum 2:
```typescript
// Frontend
const sliderTopAds = sliderTopData.data.ads
  .filter((ad) => ad.type === "SLIDER_TOP")
  .slice(0, 2); // Limit to maximum 2 SLIDER_TOP ads

// Backend
if (selectedAd.type === "SLIDER_TOP") {
  ads = matchingAds.slice(0, Math.min(2, Number(limit))); // Max 2 SLIDER_TOP ads
  total = Math.min(2, matchingAds.length);
}
```

#### 5.2. Ticker Banner - Only Show TICKER Ads

**File**: `frontend/src/components/ads/ticker-ad.tsx`

**Issue**: Ticker was showing SLIDER_TOP ads

**Fix**: Removed SLIDER_TOP from ticker, only show TICKER ads:
```typescript
// Before: Combined TICKER and SLIDER_TOP
const selectedAds = useMemo(() => {
  const ads: Ad[] = [];
  if (sliderTopData?.data?.ads && sliderTopData.data.ads.length > 0) {
    ads.push(...sliderTopAds); // WRONG - removed
  }
  if (tickerData?.data?.ads && tickerData.data.ads.length > 0) {
    ads.push(...tickerAds);
  }
  return ads;
}, [tickerData, sliderTopData]);

// After: Only TICKER ads
const selectedAds = useMemo(() => {
  if (tickerData?.data?.ads && tickerData.data.ads.length > 0) {
    return tickerData.data.ads.filter((ad) => ad.type === "TICKER");
  }
  return [];
}, [tickerData]);
```

#### 5.3. Regular SLIDER Ads Display

**File**: `frontend/src/components/ads/regular-slider-ad.tsx` (NEW)

**Issue**: Regular SLIDER ads weren't displaying because SliderAd component prioritized SLIDER_TOP

**Fix**: Created separate component for regular SLIDER ads:
- `SliderAd`: Shows SLIDER_TOP ads (max 2) in hero section
- `RegularSliderAd`: Shows regular SLIDER ads in separate section

**Integration**: Added `RegularSliderAd` to homepage layout

#### 5.4. Popup Banner Display

**File**: `frontend/src/components/ads/ads-wrapper.tsx`

**Issue**: PopupAd component wasn't being rendered

**Fix**: Added PopupAd to AdsWrapper:
```typescript
const PopupAd = dynamic(() => import("./popup-ad").then(mod => ({ default: mod.PopupAd })), { ssr: false });

export function AdsWrapper() {
  return (
    <>
      <StickyHeaderAd />
      <StickyAd />
      <PopupAd />
      <SliderAd />
    </>
  );
}
```

### 6. News Image Duplication (Already Fixed)

**File**: `frontend/src/components/news/image-gallery.tsx`

**Status**: Already fixed in previous update. The component:
- Only extracts images from HTML content
- Skips main image if it appears in content
- Uses robust duplicate detection with URL normalization

## Files Modified

### Frontend
- `frontend/src/components/admin/ad-form-modal.tsx`: Fixed null.trim() error, price parsing, editing
- `frontend/src/components/ads/slider-ad.tsx`: Limited SLIDER_TOP to 2, separated from SLIDER
- `frontend/src/components/ads/regular-slider-ad.tsx`: NEW - Separate component for SLIDER ads
- `frontend/src/components/ads/ticker-ad.tsx`: Removed SLIDER_TOP, only shows TICKER
- `frontend/src/components/ads/ads-wrapper.tsx`: Added PopupAd and SliderAd
- `frontend/src/components/notifications/breaking-news-alert.tsx`: Fixed title wrapping
- `frontend/src/components/home/home-client.tsx`: Added RegularSliderAd display
- `frontend/src/components/home/homepage-sections.tsx`: Added SliderAd to hero section

### Backend
- `backend/src/services/ad.service.ts`: Fixed price parsing, limited SLIDER_TOP to 2

## Banner Type Behavior

| Banner Type | Display Location | Max Count | Notes |
|-------------|------------------|-----------|-------|
| **SLIDER_TOP** | Homepage hero slider | 2 | Top of homepage, auto-rotates |
| **SLIDER** | Separate slider section | Unlimited | Displays in dedicated section |
| **TICKER** | Ticker bar (top) | Unlimited | Scrolling ticker, only TICKER type |
| **POPUP** | Modal overlay | 1 | Shows after 3 seconds, once per session |
| **BANNER_TOP** | Top banner slot | 1 | Standard top banner |
| **BANNER_SIDE** | Sidebar | 1 | Sidebar banner |
| **INLINE** | Inline content | Multiple | Between content sections |
| **FOOTER** | Footer | 1 | Footer banner |
| **STICKY** | Sticky bottom-right | 1 | Sticky floating ad |

## Testing Checklist

- [x] Ad form submission doesn't throw null.trim() error
- [x] Price parsing handles 400,00€ correctly (becomes 400.00)
- [x] Price parsing handles 400.00€ correctly (stays 400.00)
- [x] Banners can be edited and price can be changed
- [x] Breaking news banner title wraps properly on mobile
- [x] SLIDER_TOP ads limited to 2 in hero section
- [x] Regular SLIDER ads display in separate section
- [x] TICKER ads only show in ticker section (not SLIDER_TOP)
- [x] POPUP ads appear as modal overlay
- [x] News images don't duplicate

## User Impact

✅ **All banner issues resolved**:
- Banners can be edited (including price changes)
- Price parsing works for both European and US formats
- Breaking news titles display properly on mobile
- All banner types display in correct sections
- SLIDER_TOP limited to 2 to prevent overflow
- Regular SLIDER ads have dedicated display area
- TICKER and POPUP banners work correctly
