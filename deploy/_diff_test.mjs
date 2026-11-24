/**
 * 差分测试 —— 证明 MiniRouter 与 Express 的路由行为一致
 *
 * 目的：把接口定义从 Express 抽到 MiniRouter 之后，必须证明两者行为等价，
 * 否则「本机好使、云端不一样」的口径漂移就发生了。
 *
 * 做法：同一批请求分别打 Express 版与 MiniRouter 版，逐字段比对响应体。
 * 两边用同一个 buildRoutes()，路由定义本身是同一份代码，
 * 被测的只有框架适配层。
 */

import express from 'express';
import { MiniRouter, MiniRequest, corsMiddleware } from '../server/src/mini.js';
import { createApiRouter } from '../server/src/app.js';

const CASES = [
  ['GET', '/api/meta'],
  ['GET', '/api/nonexistent'],
  ['GET', '/api/analytics/overview'],
  ['GET', '/api/analytics/spatial'],
  ['GET', '/api/analytics/task'],
  ['GET', '/api/analytics/platform'],
  ['GET', '/api/analytics/environment'],
  ['GET', '/api/analytics/disease'],
  ['GET', '/api/analytics/temporal'],
  ['GET', '/api/devices'],
  ['GET', '/api/detections?limit=5'],
  ['GET', '/api/missions?limit=5'],
  ['GET', '/api/linkage/events?limit=5'],
  ['GET', '/api/plan'],
  ['GET', '/api/plan?mode=target&swath=5'],
  ['GET', '/api/baseline'],
  ['GET', '/api/briefing'],
  ['GET', '/api/weather'],
  ['GET', '/api/strategies'],
  ['GET', '/api/strategies/fusarium'],
  ['GET', '/api/strategies/notadisease'],
  ['GET', '/api/tenancy/identity'],
  ['GET', '/api/tenancy/tenants'],
  ['GET', '/api/tenancy/members'],
  ['GET', '/api/fields'],
  ['GET', '/api/access/devices'],
  ['GET', '/api/access/commands'],
  ['GET', '/api/metering/price'],
  ['GET', '/api/metering/usage'],
  ['GET', '/api/metering/invoices'],
  ['GET', '/api/metering/metrics'],
  ['GET', '/api/platform/services'],
  ['GET', '/api/farmer/messages'],
  ['GET', '/api/openapi/stats'],
  ['GET', '/api/link/metrics'],
  ['GET', '/api/devices/telemetry?limit=5'],
  ['POST', '/api/tenancy/login', { userId: 'u-admin' }],
  ['POST', '/api/tenancy/login', { userId: 'nobody' }],
  ['POST', '/api/tenancy/login', {}],
  ['POST', '/api/plan/ratio', { speedMs: 5, swathM: 2 }],
  ['POST', '/api/plan/simulate', { headingDeg: 0, speedMs: 5 }],
  ['POST', '/api/missions', { type: 'spray', disease: 'rust' }],
  ['POST', '/api/missions/M-1/status', { status: 'done' }],
  ['POST', '/api/access/heartbeat', { deviceId: 'UAV-01' }],
  ['POST', '/api/access/self-register', { deviceId: 'R-9', name: 'r9', kind: 'robot' }],
  ['POST', '/api/access/self-register', { deviceId: 'R-9' }],
  ['POST', '/api/metering/usage', { type: 'spray', areaMu: 10 }],
  ['POST', '/api/ingest/batch', { telemetry: [{ deviceId: 'UAV-01', ts: 1700000000000, kind: 'uav' }] }],
  ['OPTIONS', '/api/meta'],
];

/** 剔除两次运行必然不同的字段（时间戳、随机 id、密钥） */
function normalize(v) {
  return JSON.stringify(v, (k, val) => {
    if (k === 'createdAt' || k === 'ts' || k === 'issuedAt' || k === 'registeredAt') return '<T>';
    if (k === 'updatedAt' || k === 'lastSeen' || k === 'generatedAt' || k === 'serverTs') return '<T>';
    if (k === 'missionId' && typeof val === 'string') return '<MID>';
    if (k === 'token') return '<TOK>';
    if (k === 'apiKey') return '<KEY>';
    if (k === 'salt') return '<SALT>';
    if (k === 'commandId') return '<CID>';
    return val;
  });
}

/** 建一份干净的运行环境 */
async function freshEnv() {
  const { Store } = await import('../server/src/store.js');
  const { MemoryStore } = await import('../shared/memstore.js');
  const { Platform, defaultField } = await import('../shared/platform.js');
  const { Analytics } = await import('../shared/analytics.js');
  const { LinkageEngine } = await import('../shared/linkage.js');
  const { RealtimeHub } = await import('../server/src/hub.js');
  const { seedDemoPlatform } = await import('../shared/demo.js');
  const { seedAgroHistory } = await import('../shared/agroseed.js');
  const os = await import('node:os');
  const path = await import('node:path');
  const fs = await import('node:fs');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'difftest-'));
  const store = new Store(path.join(dir, 't.db'));
  const field = defaultField();
  const platform = new Platform({ store, field });
  const analytics = new Analytics(store, field);
  const linkage = new LinkageEngine({ store, onEvent: () => {} });
  const hub = new RealtimeHub({ store, onTelemetry: () => {}, onDetection: () => {} });
  const broadcast = () => {};
  seedDemoPlatform(store, { skipTenants: false });
  seedAgroHistory(store, field, platform.getPlan().best);
  return { store, field, platform, analytics, linkage, hub, broadcast, dir };
}

async function runExpress(env) {
  const { store, field, platform, analytics, linkage, hub, broadcast } = env;
  const app = express();
  app.use(express.json({ limit: '8mb' }));
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Device-Id, X-Device-Kind');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  const api = express.Router();
  createApiRouter({ router: api, store, platform, analytics, linkage, hub, broadcast, field });
  app.use('/api', api);
  const server = app.listen(0);
  await new Promise(r => server.once('listening', r));
  const port = server.address().port;
  const out = [];
  for (const [method, path, body] of CASES) {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let payload;
    try { payload = JSON.parse(text); } catch { payload = text; }
    out.push({ key: `${method} ${path}`, status: res.status, body: payload });
  }
  server.close();
  return out;
}

async function runMini(env) {
  const { store, field, platform, analytics, linkage, hub, broadcast } = env;
  const api = new MiniRouter();
  api.use(corsMiddleware);
  createApiRouter({ router: api, store, platform, analytics, linkage, hub, broadcast, field });
  const out = [];
  for (const [method, path, body] of CASES) {
    // MiniRouter 直接挂在 /api 前缀下的路由表上，测试里要把前缀剥掉
    const url = new URL(path, 'http://x');
    const stripped = url.pathname.replace(/^\/api/, '') || '/';
    const req = new MiniRequest({
      method, url: stripped + url.search,
      headers: { 'Content-Type': 'application/json' },
      body: body || null,
    });
    const res = await api.handle(req);
    let payload = res.body;
    try { payload = JSON.parse(res.body); } catch { /* 保持字符串 */ }
    out.push({ key: `${method} ${path}`, status: res.statusCode, body: payload });
  }
  return out;
}

async function main() {
  const envA = await freshEnv();
  const envB = await freshEnv();
  const a = await runExpress(envA);
  const b = await runMini(envB);

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i];
    const nx = normalize(x.body), ny = normalize(y.body);
    // 404 响应体格式有意不同：Express 默认返回 HTML 错误页，
    // MiniRouter 返回 JSON（API 更合适的形态）。这一项只比对状态码。
    const statusOnly = x.key === 'GET /api/nonexistent';
    if (x.status !== y.status || (!statusOnly && nx !== ny)) {
      diff++;
      console.log(`\n✗ ${x.key}`);
      console.log(`  status  express=${x.status} mini=${y.status}`);
      if (nx !== ny) {
        // 只打印首个差异位置，避免刷屏
        let p = 0;
        while (p < nx.length && p < ny.length && nx[p] === ny[p]) p++;
        console.log(`  body    @${p}`);
        console.log(`    express: ...${nx.slice(Math.max(0, p - 60), p + 120)}`);
        console.log(`    mini   : ...${ny.slice(Math.max(0, p - 60), p + 120)}`);
      }
    }
  }
  console.log(`\n共 ${a.length} 个用例，差异 ${diff} 个`);
  console.log(diff === 0 ? '✓ MiniRouter 与 Express 行为完全一致' : '✗ 存在差异');
  process.exit(diff === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
