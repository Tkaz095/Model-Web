# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies and generate Prisma client
RUN npm install
RUN npx prisma generate

# Copy the rest of the application
COPY . .

# Build TypeScript to JavaScript
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install only production dependencies and generate Prisma client
RUN npm install --omit=dev
RUN npx prisma generate

# Copy built app from builder
COPY --from=builder /app/dist ./dist

EXPOSE 3000

# Start command: we can also run migrations here in an entrypoint but to keep it simple, just start the app
CMD ["npm", "start"]
