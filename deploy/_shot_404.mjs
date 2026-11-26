import { chromium } from 'playwright-core';

/** 定位页面上 404 的具体 URL（静态托管模式下 /api/* 必然 404，属预期） */
const BASE = process.argv[2] || 'http://localhost:4180';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const browser = await chromium.launch({ executablePath: EXE, headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 950 } });
const bad = [];
page.on('response', r => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url()}`); });
page.on('pageerror', e => bad.push(`pageerror ${e.message}`));

await page.goto(`${BASE}/`, { waitUntil: 'load', timeout: 45000 });
await page.waitForTimeout(9000);

const PAGES = [
  ['overview', '总览'], ['realtime', '实时监控'], ['fleet', '装备操控台'],
  ['dispatch', '作业调度'], ['linkage', '空地联动'], ['analytics', '数据分析'],
  ['agro', '农情策略'], ['planner', '路径规划'], ['spray', '施药窗口'],
  ['algorithms', '算法基准'], ['planning', '平台方案'], ['tenancy', '租户与权限'],
  ['access', '设备接入'], ['developers', '开发者门户'], ['mobile', '三端联动'],
  ['metering', '计量结算'], ['farm', '农户服务'], ['arch', '系统架构'],
];
for (const [id, label] of PAGES) {
  const btn = page.locator('.nav button', { hasText: label }).first();
  await btn.click();
  await page.waitForTimeout(2500);
}

console.log('--- 非 2xx 响应 ---');
const uniq = [...new Set(bad)];
uniq.forEach(x => console.log(' ', x));
if (!uniq.length) console.log('  无');

await browser.close();
