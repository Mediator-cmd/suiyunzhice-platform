import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

/**
 * 掌上端交互自检
 *
 * 验证田间作业模式的真实可操作性：
 *   接单 → 执行点位 → 拍照回传 → 断网缓存 → 补传 → 异常上报
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
await page.waitForTimeout(7000);   // 等模拟器攒出复核作业单

await page.locator('.nav button', { hasText: '三端联动' }).first().click({ timeout: 8000 });
await page.waitForTimeout(2000);

// 1. 接单
const acceptBtn = page.locator('button', { hasText: '确认接单' }).first();
if (await acceptBtn.count()) {
  await acceptBtn.click();
  await page.waitForTimeout(600);
  log.push('接单: OK');
} else {
  log.push('接单: FAIL（按钮不存在，可能没有待执行作业单）');
}

// 2. 切到执行模式
await page.locator('button', { hasText: '执行' }).first().click();
await page.waitForTimeout(800);
const rows = await page.locator('table.tbl tbody tr').count();
log.push(`点位表行数: ${rows}`);

// 3. 拍照回传第一个点位
const capBtn = page.locator('button', { hasText: '到位拍照' }).first();
if (await capBtn.count()) {
  await capBtn.click();
  await page.waitForTimeout(1800);
  log.push('拍照回传: OK');
} else {
  log.push('拍照回传: FAIL（无点位按钮）');
}
await page.screenshot({ path: `${OUT}/base-mobile-exec.png`, fullPage: true });

// 4. 断网 → 再拍一个 → 应提示缓存
await page.locator('button', { hasText: '模拟断网' }).first().click();
await page.waitForTimeout(400);
const capBtn2 = page.locator('button', { hasText: '到位拍照' }).first();
if (await capBtn2.count()) {
  await capBtn2.click();
  await page.waitForTimeout(1600);
  const flush = await page.locator('button', { hasText: '补传' }).count();
  log.push(`断网缓存后出现补传按钮: ${flush ? 'YES' : 'NO'}`);
} else {
  log.push('断网后无待拍照点位（可能点位已全部确认）');
}

// 5. 恢复网络 → 补传
const restore = page.locator('button', { hasText: '恢复网络' }).first();
if (await restore.count()) {
  await restore.click();
  await page.waitForTimeout(400);
  const flushBtn = page.locator('button', { hasText: '补传' }).first();
  if (await flushBtn.count()) {
    await flushBtn.click();
    await page.waitForTimeout(1200);
    log.push('补传: OK');
  } else {
    log.push('补传: 无按钮（可能未产生缓存帧）');
  }
}

// 6. 异常上报
await page.locator('button', { hasText: '异常' }).first().click();
await page.waitForTimeout(600);
const anomaly = page.locator('button', { hasText: '上报异常' }).first();
if (await anomaly.count()) {
  await anomaly.click();
  await page.waitForTimeout(600);
  log.push('异常上报: OK');
}
await page.screenshot({ path: `${OUT}/base-mobile.png`, fullPage: true });

// 校验页面文本
const main = await page.locator('main').innerText();
log.push(`--- 校验 ---`);
log.push(`含「掌上端」: ${main.includes('掌上端') ? 'YES' : 'NO'}`);
log.push(`含「公众号」: ${main.includes('公众号') ? 'YES' : 'NO'}`);
log.push(`含时延标注: ${main.includes('ms') ? 'YES' : 'NO'}`);

log.push('--- console errors ---');
log.push(errors.length ? errors.slice(0, 20).join('\n') : '(none)');

await browser.close();
console.log(log.join('\n'));
