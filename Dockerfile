FROM oven/bun:latest AS runtime

WORKDIR /app

# Copy only the compiled files and assets needed for runtime
COPY dist/ ./dist/
COPY public/ ./public/
COPY drizzle/ ./drizzle/
COPY drizzle.config.ts ./drizzle.config.ts
COPY src/db/ ./src/db/
COPY package.json ./
COPY .env.production ./.env

# Install production dependencies, including drizzle-kit
RUN bun add drizzle-kit && bun install --production

EXPOSE 3000

# Create a simple entrypoint script to run migrations before starting the app
RUN echo '#!/bin/sh\n\
    cd /app && \n\
    bunx drizzle-kit migrate && \n\
    bun run dist/index.js' > /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

# Use the entrypoint script as our CMD
CMD ["/app/entrypoint.sh"]