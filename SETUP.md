# Setup Instructions

## Quick Start

1. **Install Dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Create Environment File** (REQUIRED)
   **You must create a `.env` file** in the `backend` directory. Prisma CLI requires this file to exist.
   
   **Easy way - Run the setup script:**
   ```bash
   npm run setup:env
   ```
   
   **Or manually create `.env` file** with the following content:
   ```env
   PORT=3000
   NODE_ENV=development
   DATABASE_URL="mysql://root@localhost:3306/news_db"
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-min-32-chars-please
   JWT_EXPIRES_IN=7d
   CORS_ORIGIN=http://localhost:3001
   ```
   
   **Quick Setup (Windows PowerShell):**
   ```powershell
   @"
   PORT=3000
   NODE_ENV=development
   DATABASE_URL="mysql://root@localhost:3306/news_db"
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production-min-32-chars-please
   JWT_EXPIRES_IN=7d
   CORS_ORIGIN=http://localhost:3001
   "@ | Out-File -FilePath .env -Encoding utf8
   ```
   
   **Note**: For XAMPP MySQL, the default connection uses:
   - Username: `root`
   - Password: (empty, no password)
   - Host: `localhost`
   - Port: `3306`

3. **Setup Database**
   Make sure MySQL is running in XAMPP, then:
   ```bash
   # Generate Prisma Client
   npm run prisma:generate
   
   # Create and run migrations
   npm run prisma:migrate
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

## Architecture Overview

### Middleware Order Protocol
Always follow this order in routes:
```typescript
router.post(
  "/endpoint",
  validate(schema),        // 1. Validate request
  authGuard([ROLE.ADMIN]), // 2. Check auth/roles
  asyncHandler(controller) // 3. Handle async errors
);
```

### Creating a New Module

1. **Create Validator** (`src/validators/example.validators.ts`)
   ```typescript
   import { z } from "zod";
   export const createExampleValidator = z.object({
     body: z.object({
       name: z.string().min(1),
     }),
   });
   ```

2. **Create Repository** (`src/repositories/example.repository.ts`)
   ```typescript
   import { BaseRepository } from "./base.repository";
   export class ExampleRepository extends BaseRepository {
     async create(data: any) {
       return await this.prisma.example.create({ data });
     }
   }
   ```

3. **Create Service** (`src/services/example.service.ts`)
   ```typescript
   import { BaseService } from "./base.service";
   import { ExampleRepository } from "@/repositories/example.repository";
   export class ExampleService extends BaseService {
     private repo = new ExampleRepository();
     async create(data: any) {
       // Business logic here
       return await this.repo.create(data);
     }
   }
   ```

4. **Create Controller** (`src/controllers/example.controller.ts`)
   ```typescript
   import { successResponse } from "@/utils/response";
   import { ExampleService } from "@/services/example.service";
   const service = new ExampleService();
   export const exampleController = {
     create: async (req, res) => {
       const result = await service.create(req.body);
       return successResponse(res, "Created successfully", result);
     },
   };
   ```

5. **Create Routes** (`src/routes/example.routes.ts`)
   ```typescript
   import { Router } from "express";
   import { validate } from "@/middleware/validate";
   import { authGuard } from "@/middleware/authGuard";
   import { asyncHandler } from "@/middleware/asyncHandler";
   import { createExampleValidator } from "@/validators/example.validators";
   import { exampleController } from "@/controllers/example.controller";
   import { ROLE } from "@/types/enums";
   
   const router = Router();
   router.post(
     "/",
     validate(createExampleValidator),
     authGuard([ROLE.ADMIN]),
     asyncHandler(exampleController.create)
   );
   export default router;
   ```

6. **Register Routes** (`src/routes/index.ts`)
   ```typescript
   import exampleRoutes from "./example.routes";
   router.use("/examples", exampleRoutes);
   ```

## Testing the Setup

1. **Health Check**
   ```bash
   curl http://localhost:3000/api/health
   ```

2. **Root Endpoint**
   ```bash
   curl http://localhost:3000/
   ```

## Troubleshooting

### Path Aliases Not Working
If you see import errors with `@/`, make sure:
- `tsconfig.json` has correct `paths` configuration
- You're using `tsx` for development (it handles path aliases automatically)
- For production builds, you may need to use a tool like `tsc-alias` or `tsconfig-paths`

### Database Connection Issues
- Verify MySQL is running in XAMPP
- Check `DATABASE_URL` in `.env` (should be `mysql://root@localhost:3306/news_db` for XAMPP)
- Make sure the database `news_db` exists (create it in phpMyAdmin if needed)
- Run `npm run prisma:generate` after schema changes

