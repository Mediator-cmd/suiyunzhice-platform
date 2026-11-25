import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

/**
 * 抓取「掌上端 / 移动端」实拍图 —— 手机视口，用于申报书 图2-16。
 *
 * 用法：node _shot_mobile.mjs <baseUrl> <outDir>
 */

const BASE = process.argv[2] || 'https://suiyunzhice-platform.3403775603.workers.dev';
const OUT = process.argv[3] || 'C:/temp/lx6/shots';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: EXE });
const ctx = await browser.newContext({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
});
const page = await ctx.newPage();

const errors = [];
page.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));

await page.goto(`${BASE}/`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(12000);

const chip = await page.locator('.modechip').first().innerText().catch(() => '(无 modechip)');
console.log('modechip:', chip.replace(/\s+/g, ' ').trim());

// 掌上端
for (const [label, out] of [['三端联动', 'book_mobile_phone'], ['农户服务', 'book_farm_phone']]) {
  const btn = page.locator('.nav button', { hasText: label }).first();
  if (!(await btn.count())) { console.log(`${label} FAIL — 导航项找不到`); continue; }
  await btn.click();
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${OUT}/${out}.png`, fullPage: false });
  console.log(`${label} -> ${out}.png`);
}

console.log('console errors:', errors.length ? errors.slice(0, 5) : 'none');
await browser.close();
