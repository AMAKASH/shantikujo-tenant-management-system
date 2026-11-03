# syntax=docker/dockerfile:1.7
# STMS web (Next.js standalone). Listens on :3000 and proxies /api/* to the API.

# ─── Build ────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# The /api proxy target is baked into the build (Next.js rewrites). Point it at the API's
# internal address, e.g. http://api:4000 with Docker Compose or the API service name on Dokploy.
ARG INTERNAL_API_URL=http://api:4000
ENV INTERNAL_API_URL=${INTERNAL_API_URL}
RUN npm run build

# ─── Runtime ──────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
RUN apk add --no-cache tini
WORKDIR /app
ARG INTERNAL_API_URL=http://api:4000
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    TZ=Asia/Dhaka \
    INTERNAL_API_URL=${INTERNAL_API_URL}

COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/login >/dev/null || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server.js"]
