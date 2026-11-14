# 麦田智翼 · 空地协同云平台 —— 生产镜像
# 前端构建阶段 + 服务端运行阶段

# ---------- 前端构建 ----------
FROM node:22-alpine AS web-builder
WORKDIR /build
# web/ 自带 package.json，前端依赖在 web/ 内部安装即可。
# 必须先 COPY web/ 再安装：vite.config.js 会 import ../../shared/*，
# shared/ 也要一起放进构建上下文。
COPY shared/ ./shared/
COPY web/ ./web/
WORKDIR /build/web
RUN npm install --no-audit --no-fund && npx vite build

# ---------- 服务端运行 ----------
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=8080 DB_PATH=/data/maitian.db

RUN apk add --no-cache tini curl

# 服务端只依赖 express 与 ws（均为纯 JS，无原生模块）。
# 这里用 server/package.json 而不是根 package.json：
# 根 package.json 声明了 workspaces:["web"]，而运行阶段并不包含 web/，
# 直接 npm install 会因「找不到工作区」而失败。
COPY server/package.json ./package.json
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
