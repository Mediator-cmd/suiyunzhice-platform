import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const EXE = 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const OUT = 'C:/Users/ASUS/_shots';
mkdirSync(OUT, { recursive: true });

const PAGES = [
  ['overview',  '总览'],
  ['realtime',  '实时监控'],
  ['linkage',   '空地联动'],
  ['analytics', '数据分析'],
  ['planner',   '路径规划'],
  ['planning',  '方案与部署'],
  ['farm',      '农户服务'],
  ['arch',      '系统架构'],
];

const browser = await chromium.launch({ executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`); });
page.on('pageerror', e => errors.push(`[pageerror] ${e.message}`));

const log = [];
await page.goto('http://localhost:8080/', { waitUntil: 'networkidle', timeout: 45000 });
await page.waitForTimeout(3500);

for (const [key, label] of PAGES) {
  try {
    const btn = page.locator('.nav button', { hasText: label });
    await btn.first().click({ timeout: 8000 });
    await page.waitForTimeout(2200);
    await page.screenshot({ path: `${OUT}/${key}.png`, fullPage: true });
    // 抓取该页可见文本前若干字符，便于确认内容渲染
    const txt = (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 220);
    log.push(`OK  ${key} (${label}) :: ${txt}`);
  } catch (e) {
    log.push(`FAIL ${key} (${label}) :: ${e.message}`);
  }
}

log.push('--- console errors ---');
log.push(errors.length ? errors.slice(0, 30).join('\n') : '(none)');

await browser.close();
console.log(log.join('\n'));
