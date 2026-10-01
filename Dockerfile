# syntax=docker/dockerfile:1.7
# The app is compiled on first container start (see docker/app-entrypoint.sh) so each
# install bakes in its own freshly generated keys — nothing secret lives in the image.
FROM node:22-slim
COPY --from=oven/bun:1.2 /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /app

COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

COPY . .
RUN rm -f .env && chmod +x docker/*.sh && chown -R node:node /app

USER node
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=180s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
ENTRYPOINT ["/app/docker/app-entrypoint.sh"]
