import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

/**
 * 为申报书抓取平台实拍图（公网真后端）。
 *
 * 用法：node _shot_book.mjs <baseUrl> <outDir>
 * 抓 6 张：总览 / 实时监控 / 作业调度 / 空地联动 / 农情策略 / 路径规划
 * 视口 1600x1000，等模拟器攒数据后再拍。
 */

const BASE = process.argv[2] || 'https://suiyunzhice-platform.3403775603.workers.dev';
const OUT = process.argv[3] || 'C:/temp/lx6/shots';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
mkdirSync(OUT, { recursive: true });

const PAGES = [
  ['overview',   '总览',       'book_overview'],
  ['realtime',   '实时监控',   'book_realtime'],
  ['dispatch',   '作业调度',   'book_dispatch'],
  ['linkage',    '空地联动',   'book_linkage'],
  ['agro',       '农情策略',   'book_agro'],
  ['planner',    '路径规划',   'book_planner'],
  ['metering',   '计量结算',   'book_metering'],
];

const browser = await chromium.launch({ executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

const errors = [];
page.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));

await page.goto(`${BASE}/`, { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(12000);

// 顶栏 modechip —— 确认页面真的连着后端
const chip = await page.locator('.modechip').first().innerText().catch(() => '(无 modechip)');
console.log('modechip:', chip.replace(/\s+/g, ' ').trim());

for (const [id, label, out] of PAGES) {
  const btn = page.locator('.nav button', { hasText: label }).first();
  if (!(await btn.count())) { console.log(`${label} FAIL — 导航项找不到`); continue; }
  await btn.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/${out}.png`, fullPage: false });
  console.log(`${label} -> ${out}.png`);
}

console.log('console errors:', errors.length ? errors.slice(0, 5) : 'none');
await browser.close();
