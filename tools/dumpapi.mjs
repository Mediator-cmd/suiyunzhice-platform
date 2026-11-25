/**
 * 申报材料事实快照 —— 把平台真实接口的返回原样导出，
 * 供计划书正文/图表引用，避免手抄数字出错。
 *
 * 用法：node tools/dumpapi.mjs > ../_plan_work/facts.json
 */
import { Platform } from '../shared/platform.js';
import { MemoryStore } from '../shared/memstore.js';
import { Analytics } from '../shared/analytics.js';
import { LinkageEngine } from '../shared/linkage.js';
import { LinkStats } from '../shared/linkstats.js';
import { seedDemoPlatform } from '../shared/demo.js';
import { seedAgroHistory } from '../shared/agroseed.js';
import { createApiRouter } from '../server/src/app.js';
import { MiniRouter, MiniRequest } from '../server/src/mini.js';

const store = new MemoryStore();
const platform = new Platform({ store });
const analytics = new Analytics(store, platform.field);
const linkage = new LinkageEngine({ store });
const hub = new LinkStats();
seedDemoPlatform(store, {});
seedAgroHistory(store, platform.field, platform.getPlan().best);

const router = new MiniRouter();
createApiRouter({ router, store, platform, analytics, linkage, hub, broadcast: () => {}, field: platform.field });

async function call(method, path, body = null) {
  const req = new MiniRequest({ method, url: path, headers: {}, body });
  const res = await router.handle(req);
  let parsed = res.body;
  try { parsed = JSON.parse(res.body); } catch { /* not json */ }
  return { status: res.statusCode, body: parsed };
}

const GETS = [
  '/meta', '/baseline', '/platform/services', '/openapi/stats',
  '/link/metrics', '/analytics/overview', '/devices', '/fleet/status',
  '/fleet/modes', '/detections', '/missions', '/linkage/events',
  '/tenancy/tenants', '/tenancy/identity', '/tenancy/members',
  '/access/devices', '/access/commands', '/metering/price',
  '/metering/metrics', '/metering/usage', '/metering/invoices',
  '/farmer/messages', '/weather', '/strategies', '/fields',
  '/briefing',
];

const out = { generatedAt: new Date().toISOString(), routes: router.routes.length, gets: {} };
for (const p of GETS) {
  const r = await call('GET', p);
  out.gets[p] = r.body;
  console.error(p, r.status);
}
console.log(JSON.stringify(out, null, 1));
