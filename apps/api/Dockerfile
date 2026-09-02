# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
WORKDIR /workspace
RUN corepack enable

# --- deps: install with dev deps (needed to build) ---
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile --filter @jarvis/api...

# --- build: compile TypeScript ---
FROM deps AS build
COPY apps/api apps/api
RUN pnpm --filter @jarvis/api build

# --- prod deps: install production deps only ---
FROM base AS prod-deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile --prod --filter @jarvis/api...

# --- runtime: minimal final image ---
FROM node:24-alpine AS runtime
WORKDIR /workspace/apps/api
ENV NODE_ENV=production
RUN addgroup -S jarvis && adduser -S jarvis -G jarvis
COPY --from=prod-deps /workspace/node_modules /workspace/node_modules
COPY --from=prod-deps /workspace/apps/api/node_modules ./node_modules
COPY --from=build /workspace/apps/api/dist ./dist
COPY apps/api/package.json ./package.json
USER jarvis
EXPOSE 3000
CMD ["node", "dist/main.js"]
