#!/bin/sh
# Production startup script for Render
set -e

cd /app/server

# Run database migrations
echo "Running database migrations..."
npx tsx src/db/migrate.ts || true

# Start the server
echo "Starting WCC API server..."
exec npx tsx src/index.ts
