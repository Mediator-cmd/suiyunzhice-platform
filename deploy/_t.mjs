import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1680, height: 1050 } });
const reqs = [];
page.on('response', r => { if (r.status() >= 400) reqs.push(`${r.status()} ${r.url()}`); });
page.on('requestfailed', r => reqs.push(`FAILED ${r.url()} ${r.failure()?.errorText}`));
await page.goto('https://mediator-cmd.github.io/suiyunzhice-platform/', { waitUntil: 'load', timeout: 60000 });
await page.waitForTimeout(20000);
const t0 = Date.now();
await page.locator('.nav button', { hasText: '实时监控' }).first().click();
let waited = 0;
while (waited < 30000) {
  const txt = await page.locator('main').innerText();
  if (!txt.includes('正在加载')) { console.log('渲染耗时(ms):', Date.now() - t0); break; }
  await page.waitForTimeout(500); waited += 500;
}
const main = await page.locator('main').innerText();
console.log('字符数:', main.replace(/\s+/g,'').length);
console.log(main.slice(0, 300));
console.log('--- 失败请求 ---');
console.log(reqs.length ? reqs.join('\n') : '(none)');
await browser.close();
