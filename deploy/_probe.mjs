import { chromium } from 'playwright-core';
const EXE = 'C:/Users/ASUS/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe';
const browser = await chromium.launch({ executablePath: EXE });
const page = await browser.newPage();
const bad = [];
page.on('response', r => { if (r.status() >= 400) bad.push(`RESP ${r.status()} ${r.url()}`); });
page.on('requestfailed', r => bad.push(`FAILED ${r.url()}`));
page.on('console', m => { if (m.type()==='error') bad.push(`CONSOLE ${m.text()} @ ${JSON.stringify(m.location())}`); });
await page.goto('https://mediator-cmd.github.io/maitian-platform/', { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(8000);
for (const l of ['总览','实时监控','空地联动','数据分析','路径规划','方案与部署','农户服务','系统架构']) {
  await page.locator('.nav button', { hasText: l }).first().click();
  await page.waitForTimeout(1500);
}
console.log(bad.join('\n') || '(clean)');
await browser.close();
