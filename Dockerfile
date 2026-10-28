# syntax=docker/dockerfile:1

FROM node:24-alpine AS base
COPY --from=ghcr.io/pnpm/pnpm:12-alpine /opt/pnpm /opt/pnpm
ENV PATH="/opt/pnpm:$PATH"
# Node.js comes from the base image, so skip the devEngines.runtime download.
ENV pnpm_config_runtime=false
ENV pnpm_config_store_dir=/var/cache/pnpm
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/var/cache/pnpm \
    pnpm install --prod --frozen-lockfile

FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/var/cache/pnpm \
    pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY src ./src
RUN pnpm run build

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json ./
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
# Extra arguments like `--full` are appended: docker compose run --rm fakturownia-backup --full
ENTRYPOINT ["node", "dist/index.js", "/config/conf.yml"]
