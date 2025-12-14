# NEWS NEXT Backend

Enterprise-grade backend starter for NEWS NEXT platform built with Node.js, Express, TypeScript, and Prisma.

## Architecture

This backend follows a strict layered architecture:

- **Controllers**: Handle HTTP requests/responses, no business logic
- **Services**: Implement application logic
- **Repositories**: Interact with Prisma (database)
- **Validators**: Zod schemas for request validation
- **Middleware**: Async handlers, auth guards, error handling

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **ORM**: Prisma (MySQL)
- **Validation**: Zod
- **Auth**: JWT

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Required variables:
- `DATABASE_URL`: MySQL connection string (XAMPP default: `mysql://root@localhost:3306/news_db`)
- `JWT_SECRET`: Secret key for JWT tokens (minimum 32 characters)

### 3. Database Setup

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# (Optional) Open Prisma Studio
npm run prisma:studio
```

### 4. Start Development Server

```bash
npm run dev
```

## Project Structure

```
src/
├── app.ts                 # Express app configuration
├── server.ts              # Server entry point
├── config/                # Configuration files
│   ├── env.ts            # Environment variables
│   └── prisma.ts         # Prisma client
├── controllers/          # Request handlers
├── services/             # Business logic
├── repositories/         # Database access
├── validators/           # Zod validators
├── middleware/           # Express middleware
│   ├── asyncHandler.ts  # Async wrapper
│   ├── validate.ts      # Validation middleware
│   ├── authGuard.ts     # Auth middleware
│   └── errorHandler.ts  # Error handler
├── routes/               # Route definitions
├── types/                # TypeScript types
└── utils/                # Utility functions
```

## Protocols

### Middleware Order

Always follow this order:
1. `validate(ZOD_SCHEMA)` - Validate request
2. `authGuard([ROLES])` - Check authentication/authorization
3. `asyncHandler(controller)` - Handle async errors

### API Response Format

All responses follow this structure:

```typescript
{
  success: boolean;
  message: string;
  data?: any;
  errors?: any;
}
```

Use helpers:
- `successResponse(res, message, data)`
- `errorResponse(res, message, errors)`

## Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run prisma:generate` - Generate Prisma Client
- `npm run prisma:migrate` - Run database migrations
- `npm run prisma:studio` - Open Prisma Studio

## License

ISC

