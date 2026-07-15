# Deploy target: Koyeb (or any plain Docker host). Build context should be
# this raid-alert-bot/ directory.
FROM node:24-slim AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY public ./public
# Koyeb sets $PORT automatically; the app reads it via process.env.PORT.
EXPOSE 8787
CMD ["node", "dist/index.js"]
