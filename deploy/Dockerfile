# 麦田智翼 · 空地协同云平台 —— 生产镜像
# 前端构建阶段 + 服务端运行阶段

# ---------- 前端构建 ----------
FROM node:22-alpine AS web-builder
WORKDIR /build
COPY package*.json ./
RUN npm install --omit=optional --no-audit --no-fund
COPY shared/ ./shared/
COPY web/ ./web/
WORKDIR /build/web
RUN npm install --no-audit --no-fund && npx vite build

# ---------- 服务端运行 ----------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=8080 DB_PATH=/data/maitian.db

RUN apk add --no-cache tini curl

COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund && npm cache clean --force

COPY shared/ ./shared/
COPY server/ ./server/
COPY --from=web-builder /build/web/dist ./web/dist

RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME ["/data"]
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://localhost:8080/api/meta || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "server/src/index.js"]
