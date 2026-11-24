/**
 * 清理前端构建产物目录
 *
 * 为什么需要单独一步：
 * Vite 的 build.emptyOutDir 在这台机器上不生效（Windows + 中文路径，
 * 探针文件构建后仍在），于是 dist/assets 会堆积历次构建的带哈希 bundle。
 * 实测已积到 425 个 js，后果：
 *   1. 每次 wrangler deploy 都要把全部历史产物上传一遍
 *   2. 浏览器可能按路径命中旧 bundle，页面与后端接口口径漂移
 *
 * 只删 assets 子目录（构建产物），不动 public/casebook —— 那由 Vite
 * 从 web/public 复制生成，删了也会再回来，但没必要多一次 IO。
 */
import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// 注意：prebuild.mjs 位于 web/ 下，dist 与它同级，不是上一级。
const DIST = resolve(__dirname, 'dist');
const ASSETS = resolve(DIST, 'assets');

const before = await countFiles(ASSETS);
await rm(ASSETS, { recursive: true, force: true });
console.log(`[clean] 已清空 dist/assets（原有 ${before} 个文件）`);

async function countFiles(dir) {
  try {
    const { readdir } = await import('node:fs/promises');
    return (await readdir(dir)).length;
  } catch {
    return 0;
  }
}
