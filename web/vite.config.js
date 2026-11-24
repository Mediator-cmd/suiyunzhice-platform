import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

export default defineConfig({
  plugins: [react()],
  // 用相对路径，GitHub Pages 子路径部署也能工作
  base: './',
  build: {
    outDir: 'dist',
    // 必须显式开启：Vite 默认只清理「本次构建产物」，
    // 历史构建的带哈希 bundle（index-XXXX.js、Access-XXXX.js 等）
    // 会一直堆在 dist 里 —— 实测积到 425 个 js。
    // 后果有两个：
    //   1. 每次 wrangler deploy 都要把全部历史产物传一遍，资产存储越滚越大
    //   2. 浏览器按路径缓存，可能命中旧 bundle，页面与后端口径漂移
    // public/ 目录（casebook 病害图鉴）由 Vite 在构建时重新复制，不受影响。
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
  },
  server: {
    port: 5173,
    // shared/ 目录在 web/ 之外，需显式允许 dev server 读取
    fs: { allow: [ROOT] },
    proxy: {
      '/api': 'http://localhost:8080',
      '/ws': { target: 'ws://localhost:8080', ws: true },
    },
  },
});
