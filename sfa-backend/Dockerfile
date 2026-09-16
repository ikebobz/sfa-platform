FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/knexfile.ts ./knexfile.ts
COPY --from=build /app/src/db ./src/db
EXPOSE 4000
CMD ["node", "dist/server.js"]
