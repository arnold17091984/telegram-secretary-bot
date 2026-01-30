# Stage 1: Install dependencies
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./
COPY patches/ ./patches/
RUN pnpm install --frozen-lockfile

# Stage 2: Build application
FROM node:20-alpine AS build
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build

# Stage 3: Production image
FROM node:20-alpine AS prod
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/index.js"]
