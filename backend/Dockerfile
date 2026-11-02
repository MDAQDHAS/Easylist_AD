# ==============================================================================
# EasyList Express Backend - Production Dockerfile for Google Cloud Run
# Multi-stage build for minimal image size, zero devDependencies in production,
# and running as an unprivileged node user.
# ==============================================================================

# ---- Stage 1: Build ----
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies (including devDependencies required for typescript compilation)
COPY package.json package-lock.json ./
RUN npm ci

# Copy TypeScript source code and configuration
COPY tsconfig.json ./
COPY src ./src

# Compile TypeScript to JavaScript in /app/dist
RUN npm run build

# Prune devDependencies to keep only production runtime packages
RUN npm prune --omit=dev

# ---- Stage 2: Production Runtime ----
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

# Run as non-root user for container security
USER node

# Copy package manifests and production dependencies
COPY --chown=node:node package.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist

# Expose container port (Google Cloud Run injects PORT=8080 by default)
EXPOSE 8080

# Start server
CMD ["node", "dist/server.js"]

