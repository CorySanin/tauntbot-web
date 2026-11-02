FROM node:current-alpine AS base

FROM base AS build-env

WORKDIR /usr/src/app

RUN apk add --no-cache libwebp libwebp-tools libavif-apps pnpm

RUN --mount=target=/usr/src/app/package.json,source=package.json \
    --mount=target=/usr/src/app/pnpm-lock.yaml,source=pnpm-lock.yaml \
    --mount=target=/usr/src/app/pnpm-workspace.yaml,source=pnpm-workspace.yaml \
    pnpm ci

COPY --link . .

RUN pnpm run build

FROM base AS composit

WORKDIR /usr/src/app

RUN apk add --no-cache pnpm

RUN --mount=target=/usr/src/app/package.json,source=package.json \
    --mount=target=/usr/src/app/pnpm-lock.yaml,source=pnpm-lock.yaml \
    --mount=target=/usr/src/app/pnpm-workspace.yaml,source=pnpm-workspace.yaml \
    pnpm ci --prod

COPY --link --exclude=node_modules/ --from=build-env /usr/src/app /usr/src/app


FROM base AS deploy

HEALTHCHECK --interval=5m --timeout=3s --start-period=2m --start-interval=5s \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/healthcheck || exit 1

EXPOSE 8080

WORKDIR /usr/src/app

COPY --from=composit --chown=appuser:appuser /usr/src/app /usr/src/app

USER node

CMD [ "node", "distribution/src/index.js"]
