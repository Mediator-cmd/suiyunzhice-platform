import { chromium } from 'playwright-core';

/**
 * 公网链接验收 —— 直接访问 GitHub Pages 线上地址，
 * 逐页检查渲染、控制台错误与关键数值。
 *
 * 这是「提交给评委/老师看的那条链接」的直接验证。
 */

const EXE = 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const OUT = 'C:/Users/ASUS/_shots';
const URL = process.argv[2] || 'https://mediator-cmd.github.io/maitian-platform/';

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
const ctx = await browser.newContext({ viewport: { width: 1680, height: 1050 } });
const page = await ctx.newPage();

const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(`[console] ${m.text().slice(0, 160)}`); });
page.on('pageerror', e => errors.push(`[pageerror] ${e.message}`));

const log = [`URL: ${URL}`];
const resp = await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
log.push(`HTTP ${resp.status()} · 标题 "${await page.title()}"`);

await page.waitForTimeout(5000);
const badge = await page.locator('.badge').last().innerText().catch(() => '—');
log.push(`模式徽章: ${badge.replace(/\s+/g, ' ')}`);

for (const [key, label] of PAGES) {
  try {
    await page.locator('.nav button', { hasText: label }).first().click({ timeout: 10000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${OUT}/live-${key}.png`, fullPage: true });
    const txt = (await page.locator('main').innerText()).replace(/\s+/g, ' ').slice(0, 200);
    log.push(`OK   ${key} :: ${txt}`);
  } catch (e) {
    log.push(`FAIL ${key} :: ${e.message}`);
  }
}

// 路径规划页关键数值抽查
await page.locator('.nav button', { hasText: '路径规划' }).first().click();
await page.waitForTimeout(5000);
const planTxt = await page.locator('main').innerText();
for (const kw of ['可行速度区间', '流量/速度比', '相比人工手画的提升', '搜索候选解排行']) {
  log.push(`规划页含「${kw}」: ${planTxt.includes(kw) ? 'YES' : 'NO'}`);
}

log.push('--- console errors ---');
log.push(errors.length ? errors.slice(0, 20).join('\n') : '(none)');

await browser.close();
console.log(log.join('\n'));
