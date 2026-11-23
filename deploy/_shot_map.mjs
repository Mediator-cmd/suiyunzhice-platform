import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

/**
 * 地图局部特写截图 —— 用来核对：
 *   1) A~H 管理区角标是否都在地块内、互不压字
 *   2) 地块边框 / 5 m 网格线 / 障碍区三者是否对齐
 *   3) 真实地形晕渲是否与地块贴合
 */

const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = 'C:/Users/ASUS/_shots';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 1680, height: 1050 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', e => errors.push(e.message));

await page.goto('http://localhost:4173/', { waitUntil: 'load', timeout: 45000 });
await page.waitForTimeout(7000);

const targets = [
  ['overview', '总览'],
  ['realtime', '实时监控'],
];

for (const [key, label] of targets) {
  await page.locator('.nav button', { hasText: label }).first().click({ timeout: 8000 });
  await page.waitForTimeout(3500);
  const map = page.locator('.map-wrap').first();
  await map.screenshot({ path: `${OUT}/map-${key}.png` });
  console.log(`shot map-${key}`);

  // 把地图里的所有角标文字与坐标吐出来核对
  const labels = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('.leaflet-marker-icon').forEach(el => {
      const t = el.textContent?.trim();
      if (!t) return;
      const r = el.getBoundingClientRect();
      const mr = el.closest('.leaflet-container')?.getBoundingClientRect();
      if (!mr) return;
      out.push({
        text: t,
        // 相对地图容器的位置（0~1），用于判断是否越界
        left: +((r.left - mr.left) / mr.width).toFixed(3),
        top: +((r.top - mr.top) / mr.height).toFixed(3),
        right: +((r.right - mr.left) / mr.width).toFixed(3),
        bottom: +((r.bottom - mr.top) / mr.height).toFixed(3),
      });
    });
    return out;
  });
  console.log(key, JSON.stringify(labels, null, 1));
}

console.log('errors:', errors.length ? errors.join('\n') : '(none)');
await browser.close();
