# Multi-stage Dockerfile optimized for Oracle Always Free tier (lightweight memory/CPU footprint)
FROM node:20-alpine AS build

WORKDIR /app

# Copy root package files
COPY package*.json ./
COPY tsconfig.json ./

# Copy backend and frontend files
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Install dependencies and build frontend
RUN npm install
RUN npm run build

# Production run stage
FROM node:20-alpine AS production

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

COPY package*.json ./
RUN npm install --omit=dev && npm install tsx better-sqlite3

COPY --from=build /app/backend ./backend
COPY --from=build /app/frontend/dist ./frontend/dist
COPY --from=build /app/tsconfig.json ./tsconfig.json

# Expose HTTP port
EXPOSE 3001

# Run server with embedded background worker
CMD ["npx", "tsx", "backend/src/index.ts"]
