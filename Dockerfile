# Multi-stage Dockerfile for single-host fullstack deployment
# -------------------------------------------------------------
# 1. Build Frontend
# -------------------------------------------------------------
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# -------------------------------------------------------------
# 2. Build Backend
# -------------------------------------------------------------
FROM node:20-alpine AS backend-builder
WORKDIR /app/backend
COPY backend/package*.json ./
COPY backend/prisma ./prisma/
RUN npm ci
RUN npx prisma generate
COPY backend/ ./
RUN npm run build

# -------------------------------------------------------------
# 3. Production Runner
# -------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000
ENV HOST=0.0.0.0

# Copy backend dependencies and build
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --only=production
COPY --from=backend-builder /app/backend/dist ./dist
COPY --from=backend-builder /app/backend/prisma ./prisma
COPY --from=backend-builder /app/backend/node_modules/.prisma ./node_modules/.prisma
COPY --from=backend-builder /app/backend/node_modules/@prisma ./node_modules/@prisma

# Copy frontend static build for single-host serving
WORKDIR /app/frontend
COPY --from=frontend-builder /app/frontend/dist ./dist

WORKDIR /app/backend
EXPOSE 5000

CMD ["node", "dist/index.js"]
