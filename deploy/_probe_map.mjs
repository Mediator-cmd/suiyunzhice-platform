import { chromium } from 'playwright-core';

/**
 * 地图几何探针 —— 成对核对「多边形 ↔ 标签」
 *
 * 对每个障碍区：多边形的屏幕包围盒 vs 标签的屏幕包围盒，
 * 标签应当落在多边形内部。同理核对 8 个分区角标是否落在各自分区矩形内。
 */

const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const browser = await chromium.launch({ executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 1680, height: 1050 } });
const page = await ctx.newPage();

await page.goto('http://localhost:4173/', { waitUntil: 'load', timeout: 45000 });
await page.waitForTimeout(7000);

for (const [key, label] of [['overview', '总览'], ['realtime', '实时监控']]) {
  await page.locator('.nav button', { hasText: label }).first().click({ timeout: 8000 });
  await page.waitForTimeout(3000);

  const out = await page.evaluate(() => {
    const container = document.querySelector('.leaflet-container');
    const cr = container.getBoundingClientRect();
    const rel = (b) => ({
      l: +(b.left - cr.left).toFixed(0), t: +(b.top - cr.top).toFixed(0),
      r: +(b.right - cr.left).toFixed(0), b: +(b.bottom - cr.top).toFixed(0),
    });
    const paths = [...container.querySelectorAll('path')];
    const pick = (st) => paths.filter(p => p.getAttribute('stroke') === st).map(p => rel(p.getBoundingClientRect()));
    const zones = pick('#4b5563');
    const obstacles = pick('#2b3442');
    const field = pick('#1d2430')[0];

    const markers = [...container.querySelectorAll('.leaflet-marker-icon')]
      .map(el => ({ text: el.textContent?.trim() || '', cls: el.className, ...rel(el.getBoundingClientRect()) }))
      .filter(m => m.text);

    const inside = (m, r) => m.l >= r.l - 1 && m.t >= r.t - 1 && m.r <= r.r + 1 && m.b <= r.b + 1;

    // 分区角标：按行序配对（第 i 个角标对应第 i 个分区矩形）
    const zoneLetters = ['A区', 'B区', 'C区', 'D区', 'E区', 'F区', 'G区', 'H区'];
    const zoneCheck = zoneLetters.map((L, i) => {
      const m = markers.find(x => x.text === L);
      const r = zones[i];
      return { label: L, rect: r, marker: m ? { l: m.l, t: m.t, r: m.r, b: m.b } : null, inside: m ? inside(m, r) : null };
    });

    // 障碍标签：文字含「障碍」语义的
    const obsLabels = markers.filter(m => m.text === '灌溉水渠' || m.text === '地头房舍');
    const obsCheck = obstacles.map((r, i) => {
      const m = obsLabels[i];
      return { rect: r, label: m?.text ?? null, marker: m ? { l: m.l, t: m.t, r: m.r, b: m.b } : null, inside: m ? inside(m, r) : null };
    });

    return { container: { w: +cr.width.toFixed(0), h: +cr.height.toFixed(0) }, field, zoneCheck, obsCheck };
  });

  console.log(`=== ${key} ===`);
  console.log('container', out.container, 'field', out.field);
  console.log('zones:');
  for (const z of out.zoneCheck) {
    console.log(`  ${z.label} rect=(${z.rect.l},${z.rect.t})-(${z.rect.r},${z.rect.b}) marker=${z.marker ? `(${z.marker.l},${z.marker.t})-(${z.marker.r},${z.marker.b})` : 'NONE'} inside=${z.inside}`);
  }
  console.log('obstacles:');
  for (const o of out.obsCheck) {
    console.log(`  ${o.label} rect=(${o.rect.l},${o.rect.t})-(${o.rect.r},${o.rect.b}) marker=${o.marker ? `(${o.marker.l},${o.marker.t})-(${o.marker.r},${o.marker.b})` : 'NONE'} inside=${o.inside}`);
  }
}

await browser.close();
