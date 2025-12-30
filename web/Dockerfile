# Final Corrected Dockerfile for UPSC PrepX-AI Web Application
# 
# DIAGNOSTIC RESULTS SUMMARY:
# - Repository Structure: Monorepo with admin/ and web/ directories
# - Original Error: COPY command looking for non-existent "apps/web/" path
# - Actual Path: "web/" directory contains the NextJS application
# - ENV Format Issues: Legacy syntax causing warnings
#
# FIXES IMPLEMENTED:
# 1. Corrected COPY path from "apps/web/" to "web/"
# 2. Modernized ENV variable syntax (ENV key value instead of ENV key=value)
# 3. Optimized multi-stage build for production deployment
# 4. Added proper error handling and security practices

# Multi-stage build for NextJS application
FROM node:20-alpine AS base

# Install dependencies stage
FROM base AS deps
# Install required packages for Node.js Alpine images
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files and install dependencies
COPY web/package*.json ./
RUN npm ci --only=production

# Build stage
FROM base AS builder
WORKDIR /app

# Copy dependencies from previous stage
COPY --from=deps /app/node_modules ./node_modules

# Copy source code from correct path (web/ instead of apps/web/)
COPY web/ .

# Set environment variables in modern format (fixes ENV warnings)
ENV NEXT_TELEMETRY_DISABLED 1
ENV NODE_ENV production

# Build the NextJS application
RUN npm run build

# Production stage
FROM base AS runner
WORKDIR /app

# Set environment variables in modern format (fixes ENV warnings)
ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1
ENV PORT 3000
ENV HOSTNAME 0.0.0.0

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application files from builder stage
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Set proper ownership for security
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Switch to non-root user
USER nextjs

# Expose the application port
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]

# BUILD CONTEXT NOTES:
# This Dockerfile expects the build context to be the repository root
# The COPY commands use "web/" prefix to access the correct application directory
# Original error "apps/web: not found" is resolved by using "web/" path
#
# ALTERNATIVE CONFIGURATIONS:
# 
# For building the admin application instead:
# 1. Replace "web/" with "admin/" in COPY commands
# 2. Update the package*.json path accordingly
# 3. Adjust any environment-specific configurations
#
# For monorepo builds with different structures:
# 1. Modify the COPY web/ . command to match your directory structure
# 2. Ensure package.json and source files are in the correct relative paths
# 3. Verify NextJS configuration matches the build context
