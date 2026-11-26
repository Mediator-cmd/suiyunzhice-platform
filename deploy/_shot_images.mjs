/**
 * 全平台图片加载自检
 *
 * 用法：node deploy/_shot_images.mjs http://localhost:4180
 *
 * 遍历所有页面，检查每个 <img> 是否真的解码成功（naturalWidth > 0）。
 * 页面「有内容」不等于「图片有内容」—— 资源 404 时文字照样渲染，
 * 只有这个检查能发现图挂了。
 */
import { chromium } from 'playwright-core';

const BASE = process.argv[2] || 'http://localhost:4180';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const PAGES = [
  ['overview', '总览'], ['realtime', '实时监控'], ['fleet', '装备操控台'],
  ['dispatch', '作业调度'], ['linkage', '空地联动'], ['analytics', '数据分析'],
  ['agro', '农情策略'], ['planner', '路径规划'], ['algorithms', '算法基准'],
  ['planning', '平台方案'], ['tenancy', '租户与权限'], ['access', '设备接入'],
  ['developers', '开发者门户'], ['mobile', '三端联动'], ['metering', '计量结算'],
  ['farm', '农户服务'], ['arch', '系统架构'],
];

const browser = await chromium.launch({ executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 1680, height: 1050 } });
const page = await ctx.newPage();

const errors = [];
page.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));

await page.goto(`${BASE}/`, { waitUntil: 'load', timeout: 45000 });
await page.waitForTimeout(9000);

const log = [];
let totalImgs = 0;
let totalBroken = 0;

for (const [id, label] of PAGES) {
  const btn = page.locator('.nav button', { hasText: label }).first();
  if (!(await btn.count())) { log.push(`${label.padEnd(6)} FAIL — 导航项找不到`); continue; }
  await btn.click();
  await page.waitForTimeout(3200);

  // 等所有图片完成加载
  await page.waitForFunction(
    () => Array.from(document.images).every(i => i.complete),
    null,
    { timeout: 15000 }
  ).catch(() => {});

  const r = await page.evaluate(() => {
    const imgs = Array.from(document.images);
    return {
      n: imgs.length,
      broken: imgs.filter(i => !i.naturalWidth).map(i => i.getAttribute('src') || '(no src)'),
      lazy: imgs.filter(i => i.loading === 'lazy').length,
    };
  });

  totalImgs += r.n;
  totalBroken += r.broken.length;
  log.push(
    `${label.padEnd(6)} 图 ${String(r.n).padStart(3)}  ` +
    `${r.broken.length ? `⚠ 失败 ${r.broken.length}: ${r.broken.slice(0, 3).join(', ')}` : '全部加载 OK'}`
  );
}

log.push('');
log.push(`合计图片 ${totalImgs}，加载失败 ${totalBroken}`);
log.push('--- console errors ---');
log.push(errors.length ? [...new Set(errors)].slice(0, 10).join('\n') : '(none)');

await browser.close();
console.log(log.join('\n'));
process.exit(totalBroken ? 1 : 0);
