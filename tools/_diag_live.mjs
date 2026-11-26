/** 线上算法基准页诊断：抓网络失败与控制台错误 */
import { chromium } from 'playwright-core';
const EXE = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const URL = process.argv[2] || 'https://suiyunzhice-platform.3403775603.workers.dev';

const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage({ viewport: { width: 1680, height: 1050 } });
const fails = [];
page.on('requestfailed', r => fails.push(`[reqfail] ${r.method()} ${r.url()} :: ${r.failure()?.errorText}`));
page.on('response', r => { if (r.status() >= 400) fails.push(`[http${r.status()}] ${r.url()}`); });
page.on('console', m => { if (m.type() === 'error') fails.push(`[console] ${m.text()}`); });
page.on('pageerror', e => fails.push(`[pageerror] ${e.message}`));

await page.goto(`${URL}/`, { waitUntil: 'load', timeout: 45000 });
await page.waitForTimeout(6000);
const btn = page.locator('.nav button', { hasText: '算法基准' }).first();
await btn.click();
await page.waitForTimeout(6000);
const main = await page.locator('main.content, main').first().innerText();
console.log('--- 页面文本 ---');
console.log(main.slice(0, 1200));
console.log('\n--- 失败项 ---');
console.log([...new Set(fails)].slice(0, 25).join('\n') || '(none)');
await page.screenshot({ path: 'C:/Users/ASUS/_shots/live-algo.png', fullPage: false });
await browser.close();
