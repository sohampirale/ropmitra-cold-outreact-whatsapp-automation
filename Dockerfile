FROM node:20-alpine AS production

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001

COPY package*.json ./
RUN npm install --omit=dev && npm install tsx better-sqlite3

COPY backend/ ./backend/
COPY frontend/dist ./frontend/dist
COPY tsconfig.json ./

EXPOSE 3001

CMD ["npx", "tsx", "backend/src/index.ts"]
