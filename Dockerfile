# Lightweight, zero-dependency container for AutoInvoice with native SQLite
FROM node:22-alpine

# Set working directory
WORKDIR /app

# Set non-root environment & production mode
ENV NODE_ENV=production \
    PORT=8080

# Copy application source
COPY . .

# Ensure records directory exists for disk persistence
RUN mkdir -p records/invoices records/challans && \
    chown -R node:node /app

# Use unprivileged user for security
USER node

# Expose default HTTP port
EXPOSE 8080

# Healthcheck to verify server is serving requests
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1

# Start zero-dependency static & API server
CMD ["node", "server.js"]
