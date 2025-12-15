# ===============================
# Stage 1: Build Stage
# ===============================
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm install

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy source and build
COPY src ./src
RUN npm run build


# ===============================
# Stage 2: Production Stage
# ===============================
FROM node:20-bookworm-slim AS production

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm install --omit=dev && npm install tsconfig-paths

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# Copy build output
COPY --from=builder /app/dist ./dist
COPY tsconfig.json ./

# Create uploads directories
RUN mkdir -p uploads/chunks uploads/thumbnails uploads/videos

# Create non-root user
RUN useradd -m nodejs && chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3001

# Start app
CMD ["node", "-r", "tsconfig-paths/register", "dist/server.js"]
