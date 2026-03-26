# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache openssl libc6-compat

FROM base AS deps
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
RUN npx prisma generate

FROM deps AS builder
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM base AS production
ENV NODE_ENV=production

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev
RUN npx prisma generate

COPY --from=builder /app/dist ./dist

EXPOSE 3000

# Run schema migrations safely before launching the API in production.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
