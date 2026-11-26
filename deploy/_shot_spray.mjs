import { chromium } from 'playwright-core';

/**
 * 施药窗口页专项验收
 *
 * 用法：node deploy/_shot_spray.mjs http://localhost:4180
 *
 * 检查：滑块改参数后，页面上的数字是否真的跟着变（证明是现场计算，
 * 不是静态文案），以及图表是否画出来了。
 */
const BASE = process.argv[2] || 'http://localhost:4180';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const browser = await chromium.launch({ executablePath: EXE });
const ctx = await browser.newContext({ viewport: { width: 1680, height: 1050 } });
const page = await ctx.newPage();

const errors = [];
page.on('console', m => { if (m.type() === 'error' && !/favicon/i.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push(e.message));

await page.goto(`${BASE}/`, { waitUntil: 'load', timeout: 45000 });
await page.waitForTimeout(9000);

const btn = page.locator('.nav button', { hasText: '施药窗口' }).first();
await btn.click();
await page.waitForTimeout(2500);

const readState = async () => ({
  verdict: (await page.locator('.kpi .value').first().innerText()).trim(),
  onTarget: (await page.locator('.kpi .value').nth(1).innerText()).trim(),
  drift: (await page.locator('.kpi .value').nth(2).innerText()).trim(),
  p95: (await page.locator('.kpi .value').nth(3).innerText()).trim(),
  lines: await page.locator('.recharts-line').count(),
  bars: await page.locator('.recharts-bar').count(),
  rows: await page.locator('table.tbl tbody tr').count(),
  chips: await page.locator('table.tbl .chip').allInnerTexts(),
});

const problems = [];
const s4 = await readState();
console.log('风速 4 m/s：', JSON.stringify(s4));
if (s4.lines < 1) problems.push('作业窗口折线图没有画出来');
if (s4.bars < 1) problems.push('雾滴谱对比柱图没有画出来');
if (s4.rows !== 3) problems.push(`雾滴谱行数应为 3，实际 ${s4.rows}`);
if (!/%/.test(s4.onTarget)) problems.push('靶区命中率没有渲染成百分比');

// 拉到 8 m/s，数字必须变
const slider = page.locator('input[type=range]').first();
await slider.fill('8');
await page.waitForTimeout(2000);
const s8 = await readState();
console.log('风速 8 m/s：', JSON.stringify(s8));
if (s8.onTarget === s4.onTarget) problems.push('改风速后靶区命中率没变 —— 不是现场计算');
if (!/超窗口/.test(s8.verdict)) problems.push(`风速 8 m/s 判定应为「超窗口」，实际「${s8.verdict}」`);
if (s8.p95 === s4.p95) problems.push('改风速后 P95 漂移没变');

// 换最粗雾滴谱后，当前档位行应被高亮
await page.locator('select').first().selectOption('170');
await page.waitForTimeout(1800);
const highlighted = await page.locator('table.tbl tbody tr.strong td').first().innerText().catch(() => '');
console.log('选 170 μm 后高亮行：', highlighted.trim());
if (!/170/.test(highlighted)) problems.push('雾滴谱选择没有反映到表格高亮');

await page.screenshot({ path: 'C:/Users/ASUS/_shots/spray_window.png', fullPage: false });

console.log('\nconsole errors:', errors.length ? errors.slice(0, 5) : 'none');
if (errors.length) problems.push(`${errors.length} 个控制台错误`);
console.log(problems.length ? `\n✗ ${problems.length} 项：\n  - ${problems.join('\n  - ')}` : '\n✓ 施药窗口页验收通过');
await browser.close();
process.exit(problems.length ? 1 : 0);
