import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

/**
 * 接入模拟器交互自检
 *
 * 验证开发者门户的核心演示路径：点五下按钮，模拟器能跑完五步接入，
 * 并给出 API Key、作业单与最终账单 —— 这是答辩现场最需要稳的一环。
 */

const BASE = process.argv[2] || 'http://localhost:4173';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = 'C:/Users/ASUS/_shots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 1680, height: 1050 } });
const page = await ctx.newPage();

const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(`[console] ${m.text()}`); });
page.on('pageerror', e => errors.push(`[pageerror] ${e.message}`));

const log = [];
await page.goto(`${BASE}/`, { waitUntil: 'load', timeout: 45000 });
await page.waitForTimeout(5000);

await page.locator('.nav button', { hasText: '开发者门户' }).first().click({ timeout: 8000 });
await page.waitForTimeout(2000);

// 逐步执行五步接入
for (let i = 1; i <= 5; i++) {
  const btn = page.locator('button', { hasText: `执行第 ${i} 步` }).first();
  const visible = await btn.count();
  if (!visible) {
    log.push(`FAIL 第 ${i} 步按钮不存在`);
    break;
  }
  await btn.click();
  await page.waitForTimeout(500);
  const panel = await page.locator('.card', { hasText: '接入模拟器' }).first().innerText();
  log.push(`STEP ${i} :: ${panel.replace(/\s+/g, ' ').slice(-220)}`);
}
await page.screenshot({ path: `${OUT}/base-developers-done.png`, fullPage: true });

// 校验关键产出
const panel = await page.locator('.card', { hasText: '接入模拟器' }).first().innerText();
log.push(`--- 校验 ---`);
log.push(`含 API Key: ${panel.includes('sk_UAV-YOUR-001') ? 'YES' : 'NO'}`);
log.push(`含账单: ${panel.includes('账单') ? 'YES' : 'NO'}`);
log.push(`含金额: ${/¥\d/.test(panel) ? 'YES' : 'NO'}`);

// 代码示例切换
await page.locator('button', { hasText: 'Python' }).first().click();
await page.waitForTimeout(600);
const code = await page.locator('pre').last().innerText();
log.push(`代码示例切换: ${code.includes('requests.post') ? 'OK' : 'FAIL'}`);
await page.screenshot({ path: `${OUT}/base-developers.png`, fullPage: true });

log.push('--- console errors ---');
log.push(errors.length ? errors.slice(0, 20).join('\n') : '(none)');

await browser.close();
console.log(log.join('\n'));
