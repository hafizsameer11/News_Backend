#!/bin/sh
set -e

echo "Running database migrations..."
npx prisma migrate deploy || echo "Migration failed or already applied, continuing..."

echo "Starting server..."
exec node dist/server.js

