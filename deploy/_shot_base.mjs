import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

/**
 * 平台底座三页的渲染自检
 *
 * 用法：
 *   node deploy/_shot_base.mjs http://localhost:8130   # 有后端（真实接口）
 *   node deploy/_shot_base.mjs http://localhost:4173   # 无后端（演示模式降级）
 *
 * 两种模式都要能正常渲染 —— 这是平台「两种环境数字口径一致」约定的延伸：
 * 底座页面在纯静态托管下也必须可用。
 */

const BASE = process.argv[2] || 'http://localhost:4173';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = 'C:/Users/ASUS/_shots';
mkdirSync(OUT, { recursive: true });

const PAGES = [
  ['tenancy',   '租户与权限'],
  ['access',    '设备接入'],
  ['developers','开发者门户'],
  ['metering',  '计量结算'],
];

const browser = await chromium.launch({ executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 1680, height: 1050 } });
const page = await ctx.newPage();

const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`); });
page.on('pageerror', e => errors.push(`[pageerror] ${e.message}`));

const log = [];
await page.goto(`${BASE}/`, { waitUntil: 'load', timeout: 45000 });
await page.waitForTimeout(6000);

for (const [key, label] of PAGES) {
  try {
    await page.locator('.nav button', { hasText: label }).first().click({ timeout: 8000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/base-${key}.png`, fullPage: true });
    const txt = (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 260);
    log.push(`OK   ${key} (${label}) :: ${txt}`);
  } catch (e) {
    log.push(`FAIL ${key} (${label}) :: ${e.message}`);
  }
}

// 侧边栏身份徽标
try {
  const badge = await page.locator('.side-foot .badge').allInnerTexts();
  log.push(`side-foot badges :: ${badge.map(s => s.replace(/\s+/g, ' ').trim()).join(' | ')}`);
} catch (e) {
  log.push(`badge FAIL :: ${e.message}`);
}

log.push('--- console errors ---');
log.push(errors.length ? errors.slice(0, 30).join('\n') : '(none)');

await browser.close();
console.log(log.join('\n'));
