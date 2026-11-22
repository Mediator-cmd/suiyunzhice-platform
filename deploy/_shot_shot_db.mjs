/**
 * 平台页面截图（答辩用）—— 用本机 Chrome，无需下载 Playwright 浏览器
 *
 * 用法：node deploy/_shot_shot_db.mjs [baseUrl] [outDir]
 */

import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname_(fileURLToPath(import.meta.url));
function dirname_(p) { return p.replace(/[\\/][^\\/]*$/, ''); }

const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.argv[2] || 'http://localhost:8099/';
const OUT = process.argv[3] || join(__dirname, '..', '..', '_ppt_new', 'assets');
mkdirSync(OUT, { recursive: true });

// 导航名 → 路径 id（App.jsx 的 NAV 定义）
const PAGES = [
  ['overview', '总览'],
  ['realtime', '实时监控'],
  ['linkage', '空地联动'],
  ['analytics', '数据分析'],
  ['planner', '路径规划'],
  ['planning', '平台方案'],
  ['agro', '农情策略'],
  ['farm', '农户服务'],
  ['arch', '系统架构'],
];

const browser = await chromium.launch({ executablePath: EXE, args: ['--force-device-scale-factor=2'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
page.on('pageerror', e => errors.push(String(e.message).slice(0, 200)));

await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(4000);

for (const [key, label] of PAGES) {
  try {
    await page.locator('.nav button', { hasText: label }).first().click({ timeout: 10000 });
    await page.waitForTimeout(3200);
    await page.screenshot({ path: join(OUT, `lv_${key}.png`) });
    console.log('OK  ', key);
  } catch (e) {
    console.log('FAIL', key, e.message.slice(0, 120));
  }
}

// 手机版（APP 页用）
const ctx2 = await browser.newContext({ viewport: { width: 414, height: 896 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p2 = await ctx2.newPage();
for (const [key, label] of [['overview', '总览'], ['planner', '路径规划'], ['realtime', '实时监控']]) {
  try {
    await p2.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
    await p2.waitForTimeout(2500);
    await p2.locator('.nav button', { hasText: label }).first().click({ timeout: 8000 });
    await p2.waitForTimeout(2500);
    await p2.screenshot({ path: join(OUT, `lv_mob-${key}.png`) });
    console.log('OK  mob-' + key);
  } catch (e) {
    console.log('FAIL mob-' + key, e.message.slice(0, 120));
  }
}

console.log('--- console errors ---');
console.log(errors.length ? [...new Set(errors)].slice(0, 12).join('\n') : '(none)');
await browser.close();
