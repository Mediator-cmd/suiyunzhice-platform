#!/usr/bin/env bash
# 穗云智策平台 —— 部署到 Cloudflare（公网后端）
#
# 用法：
#   bash deploy/deploy.sh cloud           构建并部署 Worker（含 Durable Object）
#   bash deploy/deploy.sh cloud:check     部署后跑公网验收
#
# 前置：已执行 `npx wrangler login`（或设置 CLOUDFLARE_API_TOKEN）

set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

cmd="${1:-cloud}"

case "$cmd" in
  cloud)
    echo "== 构建前端 =="
    (cd web && npx vite build)

    echo "== 部署 Worker（含 Durable Object 状态层）=="
    npx wrangler deploy

    echo
    echo "== 部署完成 =="
    npx wrangler deployments list 2>/dev/null | head -10 || true
    echo
    echo "提示：查看公网地址用  npx wrangler deployments list"
    echo "      或打开 https://dash.cloudflare.com/workers"
    ;;

  cloud:check)
    echo "== 公网验收 =="
    node deploy/_verify_public_cloud.mjs
    ;;

  *)
    echo "未知命令：$cmd"
    echo "可用： cloud | cloud:check"
    exit 1
    ;;
esac
