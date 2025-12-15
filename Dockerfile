# ============================================
# Stage 1: Build Stage
# ============================================
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache libc6-compat

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy Prisma schema
COPY prisma ./prisma

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY src ./src

# Build TypeScript code
RUN npm run build

# ============================================
# Stage 2: Production Stage
# ============================================
FROM node:20-alpine AS production

# Set working directory
WORKDIR /app

# Install runtime dependencies for native modules (sharp, etc.)
RUN apk add --no-cache \
    libc6-compat \
    vips \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./

# Install production dependencies and tsconfig-paths (needed for runtime path resolution)
RUN npm ci --only=production && \
    npm install tsconfig-paths && \
    npm cache clean --force

# Copy Prisma files
COPY prisma ./prisma

# Generate Prisma Client for production
RUN npx prisma generate

# Copy tsconfig.json for path resolution
COPY tsconfig.json ./

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy start script and path registration file
COPY start.js ./
COPY register-paths.js ./

# Create uploads directory structure
RUN mkdir -p uploads/chunks uploads/thumbnails uploads/videos

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port (default 3001, can be overridden via env)
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -r tsconfig-paths/register -e "require('http').get('http://localhost:' + (process.env.PORT || '3001') + '/', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)}).on('error', () => process.exit(1))"

# Start the application with path alias registration loaded first
CMD ["node", "-r", "./register-paths.js", "start.js"]

