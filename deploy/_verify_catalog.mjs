import { chromium } from 'playwright-core';

/** 核对「平台方案」页的接口清单条数与方法分布，以及「开发者门户」页显示的接口数 */
const BASE = process.argv[2] || 'http://localhost:4181';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';

const browser = await chromium.launch({ executablePath: EXE, headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
await page.goto(`${BASE}/`, { waitUntil: 'load', timeout: 45000 });
await page.waitForTimeout(8000);

// 平台方案页
await page.locator('.nav button', { hasText: '平台方案' }).first().click();
await page.waitForTimeout(3000);
const planText = await page.locator('main.content, main').first().innerText();
const m = planText.match(/接口清单\s*\n?\s*(\d+)\s*个/);
console.log('平台方案页 接口清单标签:', m ? m[1] : '未找到');
const rows = await page.locator('table tr').count();
console.log('表格行数:', rows);

// 开发者门户页
await page.locator('.nav button', { hasText: '开发者门户' }).first().click();
await page.waitForTimeout(3000);
const devText = await page.locator('main.content, main').first().innerText();
const idx = devText.indexOf('接口');
console.log('开发者门户片段:', devText.slice(idx - 60, idx + 120).replace(/\n+/g, ' | '));

await page.screenshot({ path: 'C:/Users/ASUS/_shots/verify-planning.png', fullPage: false });
await browser.close();
