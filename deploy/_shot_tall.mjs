import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const EXE = 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const OUT = 'C:/Users/ASUS/_shots';
mkdirSync(OUT, { recursive: true });

const URL = process.argv[2] || 'http://localhost:4173/';
const PAGES = process.argv[3]
  ? process.argv[3].split(',').map(s => [s, s])
  : [['overview','总览'],['realtime','实时监控'],['linkage','空地联动'],['analytics','数据分析'],
     ['planner','路径规划'],['planning','平台方案'],['farm','农户服务'],['arch','系统架构']];

const browser = await chromium.launch({ executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 1680, height: 1400 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(`[console] ${m.text().slice(0,160)}`); });
page.on('pageerror', e => errors.push(`[pageerror] ${e.message}`));

await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(4000);

const log = [];
for (const [key, label] of PAGES) {
  try {
    await page.locator('.nav button', { hasText: label }).first().click({ timeout: 10000 });
    await page.waitForTimeout(2200);
    // 主区域可滚动，fullPage 抓不到 —— 改为临时放开高度
    await page.evaluate(() => {
      const m = document.querySelector('.main');
      if (m) { m.dataset._h = m.style.height; m.style.height = 'auto'; m.style.overflow = 'visible'; }
      const a = document.querySelector('.app'); if (a) a.style.height = 'auto';
    });
    await page.waitForTimeout(400);
    const h = await page.evaluate(() => document.body.scrollHeight);
    await page.setViewportSize({ width: 1680, height: Math.min(6000, Math.max(1400, h)) });
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${OUT}/tall-${key}.png`, fullPage: true });
    log.push(`OK ${key} h=${h}`);
    await page.setViewportSize({ width: 1680, height: 1400 });
    await page.evaluate(() => {
      const m = document.querySelector('.main');
      if (m) { m.style.height = ''; m.style.overflow = ''; }
      const a = document.querySelector('.app'); if (a) a.style.height = '';
    });
  } catch (e) { log.push(`FAIL ${key} :: ${e.message}`); }
}
log.push('--- errors ---');
log.push(errors.length ? errors.slice(0,20).join('\n') : '(none)');
await browser.close();
console.log(log.join('\n'));
