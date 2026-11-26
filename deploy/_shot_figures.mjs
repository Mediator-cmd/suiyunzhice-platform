/**
 * 论文图集页渲染自检
 *
 * 用法：node deploy/_shot_figures.mjs http://localhost:4173
 *
 * 检查：图集页是否渲染出 18 张图、图片是否真的加载成功（naturalWidth > 0）、
 * 有没有控制台错误、筛选按钮能不能切换分组。
 */
import { chromium } from 'playwright-core';

const BASE = process.argv[2] || 'http://localhost:4173';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const browser = await chromium.launch({ executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 1680, height: 1050 } });
const page = await ctx.newPage();

const errors = [];
page.on('console', m => {
  if (m.type() === 'error' && !/favicon/i.test(m.text())) errors.push(`[console] ${m.text()}`);
});
page.on('pageerror', e => errors.push(`[pageerror] ${e.message}`));

await page.goto(`${BASE}/`, { waitUntil: 'load', timeout: 45000 });
await page.waitForTimeout(6000);

const log = [];

// 找到「算法基准」导航
const nav = page.locator('.nav button', { hasText: '算法基准' }).first();
if (!(await nav.count())) {
  console.log('FAIL — 导航里找不到「算法基准」');
  await browser.close();
  process.exit(1);
}
await nav.click();
await page.waitForTimeout(3500);

// 切到「论文图集」标签
const tab = page.locator('.tabs button', { hasText: '论文图集' }).first();
if (!(await tab.count())) {
  console.log('FAIL — 找不到「论文图集」标签');
  await browser.close();
  process.exit(1);
}
await tab.click();
await page.waitForTimeout(4000);

// 等所有图片解码完
await page.waitForFunction(
  () => Array.from(document.images).every(i => i.complete),
  null,
  { timeout: 20000 }
).catch(() => {});

const stat = await page.evaluate(() => {
  const imgs = Array.from(document.querySelectorAll('figure.card img'));
  return {
    total: imgs.length,
    broken: imgs.filter(i => !i.naturalWidth).map(i => i.getAttribute('src')),
    dims: imgs.slice(0, 4).map(i => `${i.naturalWidth}x${i.naturalHeight}`),
    captions: document.querySelectorAll('figure.card figcaption').length,
    tabs: Array.from(document.querySelectorAll('.tabs.small button')).map(b => b.textContent.trim()),
  };
});

log.push(`图片总数 ${stat.total}  图注 ${stat.captions}`);
log.push(`前四张尺寸 ${stat.dims.join('  ')}`);
log.push(`加载失败 ${stat.broken.length ? stat.broken.join(', ') : '无'}`);
log.push(`分组筛选 ${stat.tabs.join(' | ')}`);

// 测分组切换
const grp = page.locator('.tabs.small button', { hasText: '病害检测' }).first();
if (await grp.count()) {
  await grp.click();
  await page.waitForTimeout(1200);
  const n = await page.evaluate(() => document.querySelectorAll('figure.card img').length);
  log.push(`切到「病害检测」后图片数 ${n}`);
}
await page.screenshot({ path: 'C:/Users/ASUS/_shots/figures.png', fullPage: false });

log.push('--- console errors ---');
log.push(errors.length ? [...new Set(errors)].slice(0, 10).join('\n') : '(none)');

await browser.close();
console.log(log.join('\n'));
