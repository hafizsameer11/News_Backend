# CRM API Quick Reference

## Base URL
```
https://api.tgcalabriareport.com/api/v1/crm
```

## Authentication
All requests require:
```
Authorization: Bearer <token>
```

---

## Endpoints Summary

| Method | Endpoint | Description | Required Role |
|--------|----------|-------------|---------------|
| POST | `/crm/users/register` | Register new user | ADMIN, SUPER_ADMIN |
| GET | `/crm/categories` | Get all categories | ADMIN, SUPER_ADMIN, EDITOR, ADVERTISER |
| POST | `/crm/news` | Create news article | ADMIN, SUPER_ADMIN, EDITOR, ADVERTISER |
| POST | `/crm/ads` | Create ad campaign | ADMIN, SUPER_ADMIN, EDITOR, ADVERTISER |

---

## 1. Register User

**POST** `/crm/users/register`

```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "User Name",
  "role": "EDITOR",
  "companyName": "Company" // optional
}
```

**Roles:** `EDITOR`, `ADVERTISER`, `USER`

---

## 2. Get Categories

**GET** `/crm/categories`

Returns list of all categories with:
- `id` (UUID)
- `nameEn` (English name)
- `nameIt` (Italian name)
- `slug`
- `parentId`
- `order`

---

## 3. Create News

**POST** `/crm/news`

```json
{
  "title": "News Title",
  "content": "<p>Article content...</p>",
  "categoryId": "uuid-here",
  "status": "PUBLISHED", // or "DRAFT"
  "summary": "Brief summary", // optional
  "isFeatured": false, // optional
  "isBreaking": false, // optional
  "tags": ["tag1", "tag2"], // optional
  "mainImage": "https://..." // optional
}
```

**Note:** News is auto-published (status: PUBLISHED) unless set to DRAFT

---

## 4. Create Ad

**POST** `/crm/ads`

```json
{
  "title": "Ad Title",
  "type": "BANNER_TOP",
  "imageUrl": "https://example.com/image.jpg",
  "targetLink": "https://example.com", // optional
  "position": "HEADER", // optional
  "startDate": "2024-06-01T00:00:00.000Z",
  "endDate": "2024-08-31T23:59:59.999Z",
  "price": 500.00 // optional (auto-calculated)
}
```

**Ad Types:**
- `BANNER_TOP`
- `BANNER_SIDE`
- `INLINE`
- `FOOTER`
- `SLIDER`
- `TICKER`
- `POPUP`
- `STICKY`

**Note:** Ads are auto-approved (status: ACTIVE, isPaid: true)

---

## Response Format

**Success:**
```json
{
  "success": true,
  "message": "Success message",
  "data": { /* data */ }
}
```

**Error:**
```json
{
  "success": false,
  "message": "Error message",
  "data": null
}
```

---

## Important Notes

✅ **User Registration:** Only admins can register users  
✅ **News Creation:** Can create in any category  
✅ **News Status:** Defaults to PUBLISHED  
✅ **Ad Auto-Approval:** All CRM ads are auto-approved and marked as paid  
✅ **Date Format:** ISO 8601 (e.g., `2024-01-15T10:30:00.000Z`)

---

For detailed documentation, see `CRM_API_DOCUMENTATION.md`
