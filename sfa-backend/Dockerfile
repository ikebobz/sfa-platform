# --- Stage 1: Build Stage ---
FROM node:20-alpine AS build
WORKDIR /app

# Copy dependency definitions first to leverage Docker layer caching
COPY package*.json ./
RUN npm ci

# Copy remaining source code and build
COPY . .

# Add this line to fix bin permissions:
RUN chmod -R +x node_modules/.bin

RUN npm run build

# --- Stage 2: Production Stage ---
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled JavaScript from build stage
COPY --from=build /app/dist ./dist

# Copy Knex configuration and migration files
COPY --from=build /app/knexfile.js ./knexfile.js
#COPY --from=build /app/db/migrations ./migrations

EXPOSE 4000

CMD ["node", "dist/server.js"]