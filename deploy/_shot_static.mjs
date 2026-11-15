import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

/**
 * 纯静态部署自检 —— 不启动任何后端，直接用 file:// 打开构建产物，
 * 验证「GitHub Pages 这类无后端环境」下平台功能是否依然完整。
 *
 * 这是公网链接方案的底线保证：任何人点开链接都能看到全部功能，
 * 而不是只有几个空壳页面。
 */

const EXE = 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const OUT = 'C:/Users/ASUS/_shots';
mkdirSync(OUT, { recursive: true });

const PAGES = [
  ['overview',  '总览'],
  ['realtime',  '实时监控'],
  ['linkage',   '空地联动'],
  ['analytics', '数据分析'],
  ['agro',      '农情策略'],
  ['planner',   '路径规划'],
  ['planning',  '平台方案'],
  ['farm',      '农户服务'],
  ['arch',      '系统架构'],
];

const browser = await chromium.launch({ executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 1680, height: 1050 } });
const page = await ctx.newPage();

const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`); });
page.on('pageerror', e => errors.push(`[pageerror] ${e.message}`));

const log = [];
await page.goto('http://localhost:4173/', { waitUntil: 'load', timeout: 45000 });
await page.waitForTimeout(6000);   // 给本地引擎攒一批模拟数据

for (const [key, label] of PAGES) {
  try {
    await page.locator('.nav button', { hasText: label }).first().click({ timeout: 8000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/static-${key}.png`, fullPage: true });
    const txt = (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 240);
    log.push(`OK   ${key} (${label}) :: ${txt}`);
  } catch (e) {
    log.push(`FAIL ${key} (${label}) :: ${e.message}`);
  }
}

log.push('--- console errors ---');
log.push(errors.length ? errors.slice(0, 30).join('\n') : '(none)');

await browser.close();
console.log(log.join('\n'));
