import { chromium } from 'playwright-core';

/**
 * 装备操控与作业调度 · 功能自检
 *
 * 渲染截图只能证明「页面不崩」，证明不了「平台真的能操控设备」。
 * 这个脚本走的是真实交互路径：
 *
 *   1. 装备操控台：点「起飞」→ 轮询设备位姿 → 确认真的离地、指令真的回执完成
 *   2. 作业调度：在地图上拖出作业范围 → 等航线预览 → 下发 → 核对预览药量与实耗药量
 *
 * 接口调用走**页面内的 api 门面**（window.__suiyunApi），
 * 而不是直接打 /api —— 这样「有后端」与「纯静态」两种部署能测同一套脚本，
 * 且测的正是前端真实走的路径（静态模式下自动落到浏览器内的 LocalEngine）。
 *
 * 用法：node deploy/_test_fleet.mjs http://localhost:8179
 */

const BASE = process.argv[2] || 'http://localhost:8179';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const log = [];
const say = (s) => { log.push(s); console.log(s); };

const browser = await chromium.launch({ executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 1680, height: 1050 } });
const page = await ctx.newPage();

const errors = [];
page.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));

/** 页面内调用 api 门面 */
const apiGet = (path) => page.evaluate(async (p) => {
  const A = window.__suiyunApi;
  if (!A) return { error: 'api 门面未挂载' };
  return A.get(p);
}, path);

const apiPost = (path, body) => page.evaluate(async ([p, b]) => {
  const A = window.__suiyunApi;
  if (!A) return { error: 'api 门面未挂载' };
  return A.post(p, b);
}, [path, body]);

/* ============ 准备：加速，让几分钟的任务在十几秒内跑完 ============ */
// 加时间戳避开浏览器缓存 —— 否则改了前端再跑，测的还是旧包
await page.goto(`${BASE}/?t=${Date.now()}`, { waitUntil: 'load', timeout: 45000 });
await page.waitForTimeout(5000);
const sp = await apiPost('/fleet/speed', { factor: 60 });
say(`加速档位: ${JSON.stringify(sp)}`);

/* ============ 1. 装备操控台：起飞 ============ */
await page.locator('.nav button', { hasText: '装备操控台' }).first().click();
await page.waitForTimeout(2500);

const before = await apiGet('/fleet/status');
const uavBefore = before.devices.find(d => d.deviceId === 'UAV-01');
say(`\n[1] 装备操控台 · 起飞`);
say(`    起飞前 UAV-01 位置 = (${uavBefore.pos.x.toFixed(1)}, ${uavBefore.pos.y.toFixed(1)}, ${uavBefore.pos.z?.toFixed(1) ?? 0}) 状态=${uavBefore.state}`);

await page.locator('.fleet-cmd-row button', { hasText: '起飞' }).first().click();
await page.waitForTimeout(1200);

// 轮询：起飞是垂直动作，水平位置本就不该变；
// 判据是「指令推进到已完成」且「设备离开地面（高度 > 0）」。
let sawCmd = null, sawDone = false, airborne = false;
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(800);
  const st = await apiGet('/fleet/status');
  const uav = st.devices.find(d => d.deviceId === 'UAV-01');
  const cmd = (st.recent || []).find(c => c.type === 'takeoff');
  if (cmd) { sawCmd = cmd; if (cmd.state === '已完成') sawDone = true; }
  if ((uav.pos.z ?? 0) > 0.5) airborne = true;
  if (sawDone && airborne) break;
}
say(`    已离地（高度 > 0）: ${airborne ? '是' : '否'}`);
say(`    指令已回执完成: ${sawDone ? '是' : '否'}`);
if (sawCmd) say(`    指令 ${sawCmd.commandId} 状态 = ${sawCmd.state}`);
say(`    ${sawDone && airborne ? '✓ 通过' : '✗ 未通过'}`);

/* ============ 2. 作业调度：框选范围 → 预览 → 下发 ============ */
await page.locator('.nav button', { hasText: '作业调度' }).first().click();
await page.waitForTimeout(2500);

await page.locator('.dispatch-mode', { hasText: '靶向点喷' }).first().click();
await page.waitForTimeout(1000);

say(`\n[2] 作业调度 · 框选范围`);

const map = page.locator('.dispatch-map .leaflet-container').first();
const box = await map.boundingBox();
if (!box) {
  say('    ✗ 找不到地图容器');
} else {
  const x0 = box.x + box.width * 0.22, y0 = box.y + box.height * 0.25;
  const x1 = box.x + box.width * 0.62, y1 = box.y + box.height * 0.72;
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move(x1, y1, { steps: 18 });
  await page.mouse.up();
  await page.waitForTimeout(2500);

  const rangeTxt = await page.locator('.dispatch-range-row').first().innerText();
  say(`    框选结果: ${rangeTxt.replace(/\s+/g, ' ').trim()}`);

  await page.waitForTimeout(3000);
  const metrics = await page.locator('.dispatch-metrics').first().innerText().catch(() => '');
  say(`    预览指标: ${metrics.replace(/\s+/g, ' ').trim()}`);

  const goBtn = page.locator('.dispatch-go').first();
  if (await goBtn.isDisabled()) {
    say('    ✗ 下发按钮不可用（预览未成功）');
  } else {
    const previewVol = extractVol(metrics);
    await goBtn.click();
    await page.waitForTimeout(2500);
    const resTxt = await page.locator('.dispatch-result').first().innerText().catch(() => '(无结果)');
    say(`    下发结果: ${resTxt.replace(/\s+/g, ' ').trim().slice(0, 130)}`);
    // 只认本次下发的作业单（从回执里取 missionId），不要匹配到演示数据
    const missionId = (resTxt.match(/作业单\s*(M-[0-9A-Za-z-]+)/) || [])[1];
    say(`    本次作业单 = ${missionId || '(未取到)'}`);

    let used = null;
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(800);
      const usage = await apiGet('/metering/usage');
      const rows = Array.isArray(usage) ? usage : (usage.usage || []);
      const mine = rows.find(u => u.missionId === missionId);
      if (mine) { used = mine.volumeL; break; }
    }
    say(`    预览药量 = ${previewVol ?? '?'} L   实耗药量 = ${used ?? '未产生'} L`);
    if (previewVol != null && used != null) {
      const diff = Math.abs(used - previewVol);
      say(`    偏差 = ${diff.toFixed(3)} L (${(diff / previewVol * 100).toFixed(1)}%)`);
      say(`    ${diff / previewVol < 0.02 ? '✓ 通过（预览与实耗一致）' : '✗ 未通过'}`);
    } else {
      say('    ✗ 未通过（实耗未产生）');
    }
  }
}

/* ============ 汇总 ============ */
say(`\n--- console errors ---`);
say(errors.length ? [...new Set(errors)].slice(0, 10).join('\n') : '(none)');

await browser.close();

function extractVol(txt) {
  const m = txt.match(/预计药液\s*([\d.]+)\s*L/);
  return m ? Number(m[1]) : null;
}
