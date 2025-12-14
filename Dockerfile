# Stage 1: Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy Prisma schema
COPY prisma ./prisma

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY src ./src

# Build TypeScript code
RUN npm run build

# Stage 2: Production stage
FROM node:20-alpine AS production

# Set working directory
WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Install tsconfig-paths for runtime path alias resolution
RUN npm install tsconfig-paths

# Copy Prisma files and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy tsconfig.json for path resolution
COPY tsconfig.json ./

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Create uploads directory
RUN mkdir -p uploads/chunks uploads/thumbnails uploads/videos

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port (default 3000, can be overridden via env)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -r tsconfig-paths/register -e "require('http').get('http://localhost:3000/', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application with path alias resolution
CMD ["node", "-r", "tsconfig-paths/register", "dist/server.js"]

