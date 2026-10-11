# Dockerfile untuk Render free tier
FROM node:20-alpine AS base
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY server/package*.json ./server/

# Install dependencies
RUN npm ci --legacy-peer-deps 2>/dev/null || npm install
RUN cd server && npm ci --legacy-peer-deps 2>/dev/null || npm install

# Copy source
COPY . .

# Build server
RUN cd server && npm run build

# Build frontend (Vite outputs to dist/)
RUN npm run build

# Production image
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

# Copy built artifacts
COPY --from=base /app/dist ./dist
COPY --from=base /app/server/dist ./server/dist
COPY --from=base /app/server/package*.json ./server/
COPY --from=base /app/server/node_modules ./server/node_modules
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/server/.env ./server/.env
COPY --from=base /app/server/src/db/migrations ./server/src/db/migrations
COPY server/src/db/migrations ./server/src/db/migrations

# Startup script
COPY start.sh .
RUN chmod +x start.sh

EXPOSE 4000

# Run migrations then start server
CMD ["sh", "-c", "cd server && npx tsx src/db/migrate.ts || true && cd .. && node server/dist/index.js"]
