import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

/**
 * 抓取「平台底座」四个新页面的实拍图（公网真后端）。
 *
 * 用法：node _shot_base.mjs <baseUrl> <outDir>
 * 视口 1600x1000 @2x。
 */

const BASE = process.argv[2] || 'https://suiyunzhice-platform.3403775603.workers.dev';
const OUT = process.argv[3] || 'C:/temp/lx6/shots';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
mkdirSync(OUT, { recursive: true });

const PAGES = [
  ['tenancy',    '租户与权限', 'book_tenancy'],
  ['access',     '设备接入',   'book_access'],
  ['developers', '开发者门户', 'book_developers'],
  ['farm',       '农户服务',   'book_farm'],
  ['mobile',     '三端联动',   'book_mobile'],
  ['analytics',  '数据分析',   'book_analytics'],
  ['arch',       '系统架构',   'book_arch'],
];

const browser = await chromium.launch({ executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

const errors = [];
page.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));

await page.goto(`${BASE}/`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(12000);

const chip = await page.locator('.modechip').first().innerText().catch(() => '(无 modechip)');
console.log('modechip:', chip.replace(/\s+/g, ' ').trim());

for (const [id, label, out] of PAGES) {
  const btn = page.locator('.nav button', { hasText: label }).first();
  if (!(await btn.count())) { console.log(`${label} FAIL — 导航项找不到`); continue; }
  await btn.click();
  await page.waitForTimeout(3500);
  await page.screenshot({ path: `${OUT}/${out}.png`, fullPage: false });
  console.log(`${label} -> ${out}.png`);
}

console.log('console errors:', errors.length ? errors.slice(0, 5) : 'none');
await browser.close();
