/**
 * 公网验收 —— 部署到 Cloudflare 后跑这个
 *
 * 验三件事：
 *   1. 后端真在跑（不是静态回退）—— 关键判据是 /api/meta 可达，
 *      且 /api/analytics/* 六维都有数据
 *   2. WebSocket 实时通道通（/ws/live 能握手并收到消息）
 *   3. 页面真的用上了后端（前端显示「实时接入」而非「演示模式」）
 *
 * 第 3 条最关键：前端有「连不上就退回浏览器内引擎」的降级逻辑，
 * 页面看着正常不代表后端在工作。必须从 DOM 上确认状态标识。
 */

import { chromium } from 'playwright-core';

const URL = process.argv[2] || 'https://suiyunzhice-platform.<你的子域名>.workers.dev';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const api = async (p) => {
  const res = await fetch(`${URL}/api${p}`, { signal: AbortSignal.timeout(20000) });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
};

async function main() {
  console.log(`验收目标：${URL}\n`);

  let fail = 0;
  const check = (ok, label, detail = '') => {
    console.log(`${ok ? '✓' : '✗'} ${label}${detail ? '  ' + detail : ''}`);
    if (!ok) fail++;
  };

  // ---- 1. 后端接口 ----
  console.log('--- 后端接口 ---');
  try {
    const meta = await api('/meta');
    check(meta.status === 200, '/api/meta 可达', `status=${meta.status}`);
    if (meta.body?.field) {
      check(true, '地块信息', `${meta.body.field.name}`);
    }
  } catch (e) {
    check(false, '/api/meta 可达', e.message);
  }

  const dims = ['spatial', 'temporal', 'disease', 'platform', 'task', 'environment'];
  for (const d of dims) {
    try {
      const r = await api(`/analytics/${d}`);
      const rows = r.body?.rows?.length ?? 0;
      check(r.status === 200 && rows > 0, `六维 /${d}`, `rows=${rows}`);
    } catch (e) {
      check(false, `六维 /${d}`, e.message);
    }
  }

  try {
    const ov = await api('/analytics/overview');
    const eff = ov.body?.efficiency || {};
    check(typeof eff.savedRatioVsZone === 'number', '分区口径节药率', `${eff.savedRatioVsZone}%`);
    check(typeof eff.savedRatio === 'number', '全田口径节药率', `${eff.savedRatio}%`);
  } catch (e) {
    check(false, 'overview 指标', e.message);
  }

  try {
    const ev = await api('/linkage/events?limit=20');
    const st = ev.body?.stats || {};
    check(st.count > 0, '联动事件', `count=${st.count} closed=${st.closedRatio}%`);
  } catch (e) {
    check(false, '联动事件', e.message);
  }

  // ---- 2. WebSocket ----
  console.log('\n--- WebSocket 实时通道 ---');
  const wsUrl = URL.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:') + '/ws/live';
  const wsResult = await new Promise((resolve) => {
    let ws;
    const timer = setTimeout(() => { try { ws?.close(); } catch { /* */ } resolve({ ok: false, reason: '超时' }); }, 15000);
    try {
      ws = new WebSocket(wsUrl);
    } catch (e) {
      clearTimeout(timer);
      resolve({ ok: false, reason: e.message });
      return;
    }
    ws.onopen = () => { /* 已连接，等消息 */ };
    ws.onmessage = (ev) => {
      clearTimeout(timer);
      let msg = null;
      try { msg = JSON.parse(ev.data); } catch { /* */ }
      try { ws.close(); } catch { /* */ }
      resolve({ ok: true, type: msg?.type });
    };
    ws.onerror = () => { clearTimeout(timer); resolve({ ok: false, reason: '连接错误' }); };
  });
  check(wsResult.ok, 'WebSocket /ws/live', wsResult.ok ? `收到 ${wsResult.type}` : wsResult.reason);

  // ---- 3. 页面是否真的用上了后端 ----
  console.log('\n--- 页面端到端 ---');
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await (await browser.newContext({ viewport: { width: 1680, height: 1050 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message.slice(0, 120)));
  try {
    await page.goto(URL, { waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(14000);

    // 前端的状态标识：连上后端显示「实时接入」，否则「演示模式」
    const status = await page.evaluate(() => {
      const chip = document.querySelector('.modechip');
      return {
        mode: chip?.textContent?.trim() || '',
        cls: chip?.className || '',
      };
    });
    check(
      status.mode === '实时接入',
      '页面识别到后端（modechip=实时接入）',
      `实际="${status.mode}" class="${status.cls}"`,
    );

    const brand = await page.evaluate(() => ({
      name: document.querySelector('.brand .brand-text > b')?.textContent || '',
      hasMark: !!document.querySelector('.brand .mark'),
    }));
    check(brand.name === '穗云智策', '品牌名正确', brand.name);
    check(!brand.hasMark, 'logo 已移除');

    // 数据分析页逐个维度点一遍，确认不崩
    await page.locator('.nav button', { hasText: '数据分析' }).first().click();
    await page.waitForTimeout(3500);
    const dimBtns = await page.locator('.btn').allTextContents();
    for (const label of dimBtns) {
      if (!/空间|时间|病害|平台|作业|环境/.test(label)) continue;
      await page.locator('.btn', { hasText: label }).first().click();
      await page.waitForTimeout(1800);
      const ok = await page.evaluate(() => !document.body.innerText.includes('暂时不可用'));
      if (!ok) check(false, `数据分析「${label}」可用`);
    }
    check(true, '数据分析六维切换无崩溃');

    await page.screenshot({ path: 'C:/Users/ASUS/_shots/cloud-verify.png', fullPage: false });
  } catch (e) {
    check(false, '页面加载', e.message);
  }
  await browser.close();

  const realErrors = errors.filter(e => !/favicon|Failed to load resource/i.test(e));
  check(realErrors.length === 0, '无 JS 报错', realErrors.join(' | ').slice(0, 200));

  console.log(`\n${fail === 0 ? '✓ 公网验收全部通过' : '✗ ' + fail + ' 项未通过'}`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
