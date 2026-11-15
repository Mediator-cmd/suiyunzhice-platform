import { chromium } from 'playwright-core';
import fs from 'node:fs';

const EXE = 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const OUT = 'C:/Users/ASUS/_shots/reshot';
fs.mkdirSync(OUT, { recursive: true });
const URL = 'https://mediator-cmd.github.io/suiyunzhice-platform/?cb=' + Date.now();

// 侧边栏 nav 的 button 顺序即 NAV 数组顺序（无 data-* 属性，靠文本+序号定位）
const PAGES = [
  ['overview', '总览'],
  ['realtime', '实时监控'],
  ['linkage',  '空地联动'],
  ['analytics', '数据分析'],
  ['agro',     '农情策略'],
  ['planner',  '路径规划'],
  ['planning', '平台方案'],
  ['farm',     '农户服务'],
  ['arch',     '系统架构'],
];

const browser = await chromium.launch({ executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
page.on('pageerror', e => errors.push(e.message));
await page.goto(URL, { waitUntil: 'networkidle', timeout: 90000 });
await page.waitForTimeout(6000);

for (const [id, label] of PAGES) {
  const ok = await page.evaluate((lb) => {
    const btns = [...document.querySelectorAll('nav.nav button')];
    const b = btns.find(x => x.textContent.includes(lb));
    if (!b) return false;
    b.click();
    return true;
  }, label);
  await page.waitForTimeout(3500);
  const act = await page.evaluate(() => {
    const b = document.querySelector('nav.nav button.active');
    return b ? b.textContent.trim() : null;
  });
  await page.screenshot({ path: `${OUT}/${id}.png` });
  console.log('shot', id, 'want', label, 'active=', act, act && act.includes(label) ? 'OK' : 'MISMATCH');
}
console.log('ERRORS', JSON.stringify(errors));
await browser.close();
