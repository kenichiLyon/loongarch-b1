# syntax=docker/dockerfile:1.7

ARG NODE_BUILD_IMAGE=node:22-bookworm
ARG NODE_RUNTIME_IMAGE=node:22-bookworm-slim

FROM ${NODE_BUILD_IMAGE} AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
WORKDIR /workspace

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json .npmrc .env.example README.md AGENT.md ./
COPY apps ./apps
COPY docs ./docs
COPY scripts ./scripts

RUN pnpm install --frozen-lockfile
RUN pnpm build
RUN node scripts/build-runtime-bundle.mjs

FROM ${NODE_RUNTIME_IMAGE} AS runtime
WORKDIR /opt/loongarch-b1
ENV NODE_ENV=production
ENV WEB_DIST_DIR=/opt/loongarch-b1/web
ENV STORAGE_ROOT=/opt/loongarch-b1/storage

COPY --from=build /workspace/release/runtime/ ./

EXPOSE 3000
CMD ["node", "api/dist/main.js"]
