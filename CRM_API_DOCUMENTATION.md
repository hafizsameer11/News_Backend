# CRM API Documentation

## Table of Contents
1. [User Registration](#1-user-registration)
2. [Get Categories](#2-get-categories)
3. [Create News](#3-create-news)
4. [Create Ad](#4-create-ad)
5. [Get All News Statistics](#5-get-all-news-statistics)
6. [Get User News Statistics](#6-get-user-news-statistics)

This document describes the CRM API endpoints for managing users, news, and ads from external systems (like a CRM platform).

## Base URL

All CRM endpoints are prefixed with `/api/v1/crm`

```
https://api.tgcalabriareport.com/api/v1/crm
```

## Authentication

All CRM endpoints require authentication using Bearer token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

**Required Roles:**
- User Registration: `ADMIN` or `SUPER_ADMIN` only
- Other endpoints: `ADMIN`, `SUPER_ADMIN`, `EDITOR`, or `ADVERTISER`

---

## Endpoints

### 1. Register User

Register a new user via CRM. Users created through CRM can create news and ads.

**Endpoint:** `POST /crm/users/register`

**Required Role:** `ADMIN` or `SUPER_ADMIN`

**Request Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "editor@example.com",
  "password": "securepassword123",
  "name": "John Doe",
  "role": "EDITOR",
  "companyName": "Example Company" // Optional
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| email | string | Yes | User email address (must be unique) |
| password | string | Yes | Password (minimum 6 characters) |
| name | string | Yes | User's full name |
| role | string | Yes | User role: `EDITOR`, `ADVERTISER`, or `USER` |
| companyName | string | No | Company name (optional) |

**Success Response (201):**
```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "editor@example.com",
    "name": "John Doe",
    "role": "EDITOR",
    "companyName": "Example Company",
    "emailVerified": true,
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

**Error Responses:**

**400 - Validation Error:**
```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

**400 - Email Already Exists:**
```json
{
  "success": false,
  "message": "Email already registered",
  "data": null
}
```

**401 - Unauthorized:**
```json
{
  "success": false,
  "message": "Unauthorized",
  "data": null
}
```

---

### 2. Get Categories

Get list of all categories for news creation.

**Endpoint:** `GET /crm/categories`

**Required Role:** `ADMIN`, `SUPER_ADMIN`, `EDITOR`, or `ADVERTISER`

**Request Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:** None

**Success Response (200):**
```json
{
  "success": true,
  "message": "Categories retrieved successfully",
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "nameEn": "Politics",
      "nameIt": "Politica",
      "slug": "politics",
      "parentId": null,
      "order": 1
    },
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "nameEn": "Sports",
      "nameIt": "Sport",
      "slug": "sports",
      "parentId": null,
      "order": 2
    }
  ]
}
```

**Error Response (401):**
```json
{
  "success": false,
  "message": "Unauthorized",
  "data": null
}
```

---

### 3. Create News Article

Create a news article via CRM. News created through CRM can be in any category and will be auto-published (unless status is set to DRAFT).

**Endpoint:** `POST /crm/news`

**Required Role:** `ADMIN`, `SUPER_ADMIN`, `EDITOR`, or `ADVERTISER`

**Request Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "Breaking News: Major Event Happens",
  "slug": "breaking-news-major-event", // Optional - auto-generated if not provided
  "summary": "A brief summary of the news article",
  "content": "<p>Full article content in HTML format...</p>",
  "categoryId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "PUBLISHED", // Optional: "DRAFT" or "PUBLISHED" (default: "PUBLISHED")
  "isFeatured": false, // Optional: default false
  "isBreaking": true, // Optional: default false
  "tags": ["breaking", "news", "event"], // Optional: array of tags
  "mainImage": "https://example.com/image.jpg" // Optional: main image URL
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| title | string | Yes | News article title |
| slug | string | No | URL-friendly slug (auto-generated from title if not provided) |
| summary | string | No | Brief summary of the article |
| content | string | Yes | Full article content (HTML supported) |
| categoryId | string (UUID) | Yes | Category ID (must exist) |
| status | string | No | `DRAFT` or `PUBLISHED` (default: `PUBLISHED`) |
| isFeatured | boolean | No | Mark as featured news (default: `false`) |
| isBreaking | boolean | No | Mark as breaking news (default: `false`) |
| tags | array | No | Array of tag strings |
| mainImage | string (URL) | No | Main image URL for the article |

**Success Response (201):**
```json
{
  "success": true,
  "message": "News created successfully",
  "data": {
    "id": "770e8400-e29b-41d4-a716-446655440000",
    "title": "Breaking News: Major Event Happens",
    "slug": "breaking-news-major-event",
    "summary": "A brief summary of the news article",
    "content": "<p>Full article content in HTML format...</p>",
    "status": "PUBLISHED",
    "isFeatured": false,
    "isBreaking": true,
    "tags": "[\"breaking\",\"news\",\"event\"]",
    "mainImage": "https://example.com/image.jpg",
    "publishedAt": "2024-01-15T10:30:00.000Z",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z",
    "category": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "nameEn": "Politics",
      "nameIt": "Politica",
      "slug": "politics"
    },
    "author": {
      "id": "880e8400-e29b-41d4-a716-446655440000",
      "name": "John Doe"
    }
  }
}
```

**Error Responses:**

**400 - Validation Error:**
```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    {
      "field": "categoryId",
      "message": "Invalid category ID"
    }
  ]
}
```

**400 - Category Not Found:**
```json
{
  "success": false,
  "message": "Category not found",
  "data": null
}
```

**401 - Unauthorized:**
```json
{
  "success": false,
  "message": "Unauthorized",
  "data": null
}
```

---

### 4. Create Ad Campaign

Create an ad campaign via CRM. Ads created through CRM are automatically approved and don't require payment.

**Endpoint:** `POST /crm/ads`

**Required Role:** `ADMIN`, `SUPER_ADMIN`, `EDITOR`, or `ADVERTISER`

**Request Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "Summer Sale Campaign",
  "type": "BANNER_TOP",
  "imageUrl": "https://example.com/ad-banner.jpg",
  "targetLink": "https://example.com/summer-sale", // Optional
  "position": "HEADER", // Optional: specific position code
  "startDate": "2024-06-01T00:00:00.000Z",
  "endDate": "2024-08-31T23:59:59.999Z",
  "price": 500.00 // Optional: auto-calculated if not provided
}
```

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| title | string | Yes | Ad campaign title |
| type | string | Yes | Ad type: `BANNER_TOP`, `BANNER_SIDE`, `INLINE`, `FOOTER`, `SLIDER`, `TICKER`, `POPUP`, `STICKY` |
| imageUrl | string (URL) | Yes | Ad image URL (max 2048 characters) |
| targetLink | string (URL) | No | Click destination URL (max 2048 characters) |
| position | string | No | Specific position code (e.g., `HEADER`, `SIDEBAR`, `FOOTER`) |
| startDate | string (ISO 8601) | Yes | Campaign start date/time |
| endDate | string (ISO 8601) | Yes | Campaign end date/time |
| price | number | No | Custom price (auto-calculated based on type and duration if not provided) |

**Ad Types:**
- `BANNER_TOP` - Top banner ad
- `BANNER_SIDE` - Sidebar banner ad
- `INLINE` - Inline content ad
- `FOOTER` - Footer ad
- `SLIDER` - Image slider ad
- `TICKER` - Text ticker ad
- `POPUP` - Popup ad
- `STICKY` - Sticky header/footer ad

**Date Validation:**
- Start date cannot be in the past
- End date must be after start date
- Minimum duration: 1 day
- Maximum duration: 365 days

**Success Response (201):**
```json
{
  "success": true,
  "message": "Ad created and auto-approved successfully",
  "data": {
    "id": "990e8400-e29b-41d4-a716-446655440000",
    "title": "Summer Sale Campaign",
    "type": "BANNER_TOP",
    "imageUrl": "https://example.com/ad-banner.jpg",
    "targetLink": "https://example.com/summer-sale",
    "position": "HEADER",
    "startDate": "2024-06-01T00:00:00.000Z",
    "endDate": "2024-08-31T23:59:59.999Z",
    "status": "ACTIVE",
    "isPaid": true,
    "price": "500.00",
    "impressions": 0,
    "clicks": 0,
    "createdAt": "2024-01-15T10:30:00.000Z",
    "updatedAt": "2024-01-15T10:30:00.000Z",
    "advertiser": {
      "id": "880e8400-e29b-41d4-a716-446655440000",
      "name": "John Doe",
      "email": "editor@example.com",
      "companyName": "Example Company"
    }
  }
}
```

**Error Responses:**

**400 - Validation Error:**
```json
{
  "success": false,
  "message": "Validation error",
  "errors": [
    {
      "field": "startDate",
      "message": "Start date cannot be in the past"
    }
  ]
}
```

**400 - Date Range Error:**
```json
{
  "success": false,
  "message": "End date must be after start date",
  "data": null
}
```

**400 - Duration Error:**
```json
{
  "success": false,
  "message": "Ad duration must be at least 1 day(s)",
  "data": null
}
```

**401 - Unauthorized:**
```json
{
  "success": false,
  "message": "Unauthorized",
  "data": null
}
```

---

### 5. Get All News Statistics

Get comprehensive aggregate statistics about all news articles in the system.

**Endpoint:** `GET /crm/news/stats`

**Required Role:** `ADMIN`, `SUPER_ADMIN`, `EDITOR`, or `ADVERTISER`

**Request Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:** None

**Success Response (200):**
```json
{
  "success": true,
  "message": "News statistics retrieved successfully",
  "data": {
    "overview": {
      "total": 1250,
      "published": 1100,
      "draft": 50,
      "pending": 80,
      "rejected": 20,
      "featured": 45,
      "breaking": 12
    },
    "views": {
      "total": 125000,
      "average": 113,
      "last7Days": 8500,
      "last30Days": 32000
    },
    "recentActivity": {
      "newsLast7Days": 25,
      "newsLast30Days": 95
    },
    "topNews": [
      {
        "id": "770e8400-e29b-41d4-a716-446655440000",
        "title": "Breaking News: Major Event Happens",
        "slug": "breaking-news-major-event",
        "views": 5420,
        "publishedAt": "2024-01-15T10:30:00.000Z",
        "category": {
          "id": "550e8400-e29b-41d4-a716-446655440000",
          "nameEn": "Politics",
          "nameIt": "Politica"
        },
        "author": {
          "id": "880e8400-e29b-41d4-a716-446655440000",
          "name": "John Doe"
        }
      },
      {
        "id": "880e8400-e29b-41d4-a716-446655440001",
        "title": "Sports Update: Championship Results",
        "slug": "sports-update-championship-results",
        "views": 4320,
        "publishedAt": "2024-01-14T15:20:00.000Z",
        "category": {
          "id": "660e8400-e29b-41d4-a716-446655440001",
          "nameEn": "Sports",
          "nameIt": "Sport"
        },
        "author": {
          "id": "880e8400-e29b-41d4-a716-446655440000",
          "name": "John Doe"
        }
      }
    ],
    "categoryBreakdown": [
      {
        "categoryId": "550e8400-e29b-41d4-a716-446655440000",
        "category": {
          "id": "550e8400-e29b-41d4-a716-446655440000",
          "nameEn": "Politics",
          "nameIt": "Politica",
          "slug": "politics"
        },
        "newsCount": 350,
        "totalViews": 45000
      },
      {
        "categoryId": "660e8400-e29b-41d4-a716-446655440001",
        "category": {
          "id": "660e8400-e29b-41d4-a716-446655440001",
          "nameEn": "Sports",
          "nameIt": "Sport",
          "slug": "sports"
        },
        "newsCount": 280,
        "totalViews": 38000
      }
    ]
  }
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| overview.total | number | Total number of news articles |
| overview.published | number | Number of published news |
| overview.draft | number | Number of draft news |
| overview.pending | number | Number of pending review news |
| overview.rejected | number | Number of rejected news |
| overview.featured | number | Number of featured news |
| overview.breaking | number | Number of breaking news |
| views.total | number | Total views across all news |
| views.average | number | Average views per published article |
| views.last7Days | number | Total views in last 7 days |
| views.last30Days | number | Total views in last 30 days |
| recentActivity.newsLast7Days | number | News created in last 7 days |
| recentActivity.newsLast30Days | number | News created in last 30 days |
| topNews | array | Top 10 performing news by views |
| categoryBreakdown | array | Statistics grouped by category |

**Error Response (401):**
```json
{
  "success": false,
  "message": "Unauthorized",
  "data": null
}
```

---

### 6. Get User News Statistics

Get statistics about news articles created by a specific user. If `userId` is not provided in the URL, returns stats for the authenticated user.

**Endpoint:** `GET /crm/news/stats/user/:userId?`

**Required Role:** `ADMIN`, `SUPER_ADMIN`, `EDITOR`, or `ADVERTISER`

**Request Headers:**
```
Authorization: Bearer <token>
```

**URL Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| userId | string (UUID) | No | User ID. If omitted, uses authenticated user's ID |

**Success Response (200):**
```json
{
  "success": true,
  "message": "User news statistics retrieved successfully",
  "data": {
    "user": {
      "id": "880e8400-e29b-41d4-a716-446655440000",
      "name": "John Doe",
      "email": "editor@example.com"
    },
    "overview": {
      "total": 45,
      "published": 38,
      "draft": 5,
      "pending": 2,
      "rejected": 0,
      "featured": 3,
      "breaking": 1
    },
    "views": {
      "total": 12500,
      "average": 329
    },
    "recentActivity": {
      "newsLast7Days": 3,
      "newsLast30Days": 12
    },
    "topNews": [
      {
        "id": "770e8400-e29b-41d4-a716-446655440000",
        "title": "Breaking News: Major Event Happens",
        "slug": "breaking-news-major-event",
        "views": 5420,
        "publishedAt": "2024-01-15T10:30:00.000Z",
        "category": {
          "id": "550e8400-e29b-41d4-a716-446655440000",
          "nameEn": "Politics",
          "nameIt": "Politica"
        }
      },
      {
        "id": "880e8400-e29b-41d4-a716-446655440001",
        "title": "Sports Update: Championship Results",
        "slug": "sports-update-championship-results",
        "views": 4320,
        "publishedAt": "2024-01-14T15:20:00.000Z",
        "category": {
          "id": "660e8400-e29b-41d4-a716-446655440001",
          "nameEn": "Sports",
          "nameIt": "Sport"
        }
      }
    ],
    "categoryBreakdown": [
      {
        "categoryId": "550e8400-e29b-41d4-a716-446655440000",
        "category": {
          "id": "550e8400-e29b-41d4-a716-446655440000",
          "nameEn": "Politics",
          "nameIt": "Politica",
          "slug": "politics"
        },
        "newsCount": 20,
        "totalViews": 8500
      },
      {
        "categoryId": "660e8400-e29b-41d4-a716-446655440001",
        "category": {
          "id": "660e8400-e29b-41d4-a716-446655440001",
          "nameEn": "Sports",
          "nameIt": "Sport",
          "slug": "sports"
        },
        "newsCount": 18,
        "totalViews": 4000
      }
    ]
  }
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| user | object | User information (id, name, email) |
| overview | object | News counts by status for this user |
| views.total | number | Total views for user's news |
| views.average | number | Average views per published article |
| recentActivity.newsLast7Days | number | User's news created in last 7 days |
| recentActivity.newsLast30Days | number | User's news created in last 30 days |
| topNews | array | User's top 10 performing news by views |
| categoryBreakdown | array | User's news statistics grouped by category |

**Example Requests:**

**Get stats for authenticated user:**
```bash
curl -X GET https://api.tgcalabriareport.com/api/v1/crm/news/stats/user \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Get stats for specific user:**
```bash
curl -X GET https://api.tgcalabriareport.com/api/v1/crm/news/stats/user/880e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Error Responses:**

**401 - Unauthorized:**
```json
{
  "success": false,
  "message": "Unauthorized",
  "data": null
}
```

**404 - User Not Found:**
```json
{
  "success": false,
  "message": "User not found",
  "data": null
}
```

---

## Complete Example Workflow

### Step 1: Register a User
```bash
curl -X POST https://api.tgcalabriareport.com/api/v1/crm/users/register \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "editor@example.com",
    "password": "securepassword123",
    "name": "John Doe",
    "role": "EDITOR",
    "companyName": "Example Company"
  }'
```

### Step 2: Get Categories
```bash
curl -X GET https://api.tgcalabriareport.com/api/v1/crm/categories \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Step 3: Create News Article
```bash
curl -X POST https://api.tgcalabriareport.com/api/v1/crm/news \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Breaking News: Major Event",
    "content": "<p>Article content here...</p>",
    "categoryId": "550e8400-e29b-41d4-a716-446655440000",
    "status": "PUBLISHED",
    "isBreaking": true
  }'
```

### Step 4: Create Ad Campaign
```bash
curl -X POST https://api.tgcalabriareport.com/api/v1/crm/ads \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Summer Sale",
    "type": "BANNER_TOP",
    "imageUrl": "https://example.com/banner.jpg",
    "targetLink": "https://example.com/sale",
    "startDate": "2024-06-01T00:00:00.000Z",
    "endDate": "2024-08-31T23:59:59.999Z"
  }'
```

### Step 5: Get All News Statistics
```bash
curl -X GET https://api.tgcalabriareport.com/api/v1/crm/news/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Step 6: Get User News Statistics
```bash
# Get stats for authenticated user
curl -X GET https://api.tgcalabriareport.com/api/v1/crm/news/stats/user \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get stats for specific user
curl -X GET https://api.tgcalabriareport.com/api/v1/crm/news/stats/user/880e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Important Notes

1. **User Registration**: Only `ADMIN` or `SUPER_ADMIN` can register users via CRM
2. **News Creation**: CRM users can create news in any category (no category restrictions)
3. **News Status**: Defaults to `PUBLISHED` unless explicitly set to `DRAFT`
4. **Ad Auto-Approval**: All ads created via CRM are automatically approved (`ACTIVE` status) and marked as paid (`isPaid: true`)
5. **Ad Pricing**: Price is auto-calculated based on ad type and duration if not provided
6. **Date Formats**: All dates must be in ISO 8601 format (e.g., `2024-01-15T10:30:00.000Z`)
7. **Authentication**: All endpoints require valid JWT token in Authorization header
8. **Error Handling**: All errors return consistent JSON format with `success: false` and error details

---

## Response Format

All responses follow this structure:

**Success:**
```json
{
  "success": true,
  "message": "Operation successful message",
  "data": { /* response data */ }
}
```

**Error:**
```json
{
  "success": false,
  "message": "Error message",
  "data": null,
  "errors": [ /* optional validation errors */ ]
}
```

---

## Status Codes

- `200` - Success (GET requests)
- `201` - Created (POST requests)
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `500` - Internal Server Error

---

## Support

For issues or questions, please contact the development team or refer to the main API documentation.
