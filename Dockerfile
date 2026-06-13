# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY yarn.lock* ./

# Copy prisma schema BEFORE install (needed for postinstall script)
COPY prisma ./prisma

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy source code
COPY . .

# Build TypeScript
RUN yarn build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Drives config.isDev=false so the logger skips the pino-pretty dev transport
ENV NODE_ENV=production

# Copy package files
COPY package*.json ./
COPY yarn.lock* ./

# Copy prisma schema BEFORE install
COPY prisma ./prisma

# Install production dependencies only
RUN yarn install --production --frozen-lockfile

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 8080

# Start the application
CMD ["node", "dist/server/index.js"]
