import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

/**
 * 全平台 14 页渲染自检
 *
 * 用法：
 *   node deploy/_shot_all.mjs http://localhost:4173   # 纯静态（演示模式）
 *   node deploy/_shot_all.mjs http://localhost:8141   # 有后端
 *
 * 检查每页：是否渲染出内容、是否有控制台错误、是否有空态残留。
 */

const BASE = process.argv[2] || 'http://localhost:4173';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = 'C:/Users/ASUS/_shots';
mkdirSync(OUT, { recursive: true });

const PAGES = [
  ['overview',   '总览'],
  ['realtime',   '实时监控'],
  ['fleet',      '装备操控台'],
  ['dispatch',   '作业调度'],
  ['linkage',    '空地联动'],
  ['analytics',  '数据分析'],
  ['agro',       '农情策略'],
  ['planner',    '路径规划'],
  ['planning',   '平台方案'],
  ['tenancy',    '租户与权限'],
  ['access',     '设备接入'],
  ['developers', '开发者门户'],
  ['mobile',     '三端联动'],
  ['metering',   '计量结算'],
  ['farm',       '农户服务'],
  ['arch',       '系统架构'],
];

const browser = await chromium.launch({ executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 1680, height: 1050 } });
const page = await ctx.newPage();

const errors = [];
page.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) errors.push(`[console] ${m.text()}`); });
page.on('pageerror', e => errors.push(`[pageerror] ${e.message}`));

await page.goto(`${BASE}/`, { waitUntil: 'load', timeout: 45000 });
await page.waitForTimeout(9000);   // 等模拟器攒数据

const log = [];
for (const [id, label] of PAGES) {
  const btn = page.locator('.nav button', { hasText: label }).first();
  if (!(await btn.count())) { log.push(`${label.padEnd(6)} FAIL — 导航项找不到`); continue; }
  await btn.click();
  await page.waitForTimeout(2200);
  const main = await page.locator('main.content, main').first().innerText();
  const len = main.replace(/\s+/g, '').length;
  const head = main.split('\n').filter(s => s.trim())[0] || '';
  const bad = /undefined|NaN|\[object Object\]/.test(main);
  log.push(`${label.padEnd(6)} 字符${String(len).padStart(5)}  ${bad ? '⚠ 含 undefined/NaN' : 'OK'}  ${head.slice(0, 34)}`);
  await page.screenshot({ path: `${OUT}/all-${id}.png`, fullPage: false });
}

log.push('--- console errors ---');
log.push(errors.length ? [...new Set(errors)].slice(0, 20).join('\n') : '(none)');

await browser.close();
console.log(log.join('\n'));
