#!/usr/bin/env bash
# 麦田智翼平台 —— 本地一键启动 / 构建 / 部署
#
# 用法：
#   bash deploy/deploy.sh dev        本地开发（服务端 + 前端热更新）
#   bash deploy/deploy.sh build      构建前端静态产物到 web/dist
#   bash deploy/deploy.sh docker     用 Docker 起完整服务
#   bash deploy/deploy.sh tunnel     用 Cloudflare Tunnel 暴露本机到公网
#   bash deploy/deploy.sh pages      构建并推送到 GitHub Pages

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

cmd="${1:-dev}"

case "$cmd" in
  dev)
    echo "== 启动云端服务（:8080） =="
    node server/src/index.js &
    SERVER_PID=$!
    trap 'kill $SERVER_PID 2>/dev/null || true' EXIT
    sleep 2
    echo "== 启动前端开发服务器（:5173） =="
    (cd web && npx vite)
    ;;

  build)
    echo "== 构建前端 =="
    (cd web && npx vite build)
    echo "产物：web/dist"
    ;;

  docker)
    echo "== Docker 启动 =="
    docker compose -f deploy/docker-compose.yml up -d --build
    echo "服务已启动：http://localhost:8080"
    echo "查看日志：docker compose -f deploy/docker-compose.yml logs -f"
    ;;

  tunnel)
    echo "== Cloudflare Tunnel（临时公网地址） =="
    if ! command -v cloudflared >/dev/null 2>&1; then
      echo "未安装 cloudflared。"
      echo "Windows: winget install --id Cloudflare.cloudflared"
      echo "或下载 https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
      exit 1
    fi
    # 先确保本机服务已启动
    if ! curl -fsS http://localhost:8080/api/meta >/dev/null 2>&1; then
      echo "云端服务未运行，正在后台启动…"
      node server/src/index.js &
      sleep 3
    fi
    cloudflared tunnel --url http://localhost:8080
    ;;

  pages)
    echo "== 构建并推送到 GitHub Pages =="
    (cd web && npx vite build)
    git add web/dist
    git commit -m "chore: build static site for GitHub Pages" || true
    git push origin gh-pages
    echo "已推送到 gh-pages 分支。"
    echo "在仓库 Settings → Pages 中将 Source 设为 gh-pages 分支即可。"
    ;;

  *)
    echo "未知命令：$cmd"
    echo "可用：dev | build | docker | tunnel | pages"
    exit 1
    ;;
esac
