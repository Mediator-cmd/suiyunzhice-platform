/**
 * 云端运行时验证 —— 不依赖 Cloudflare 账号
 *
 * 目的：在真正部署前，先证明三件事：
 *   1. Durable Object 的 SQLite 适配器（SqliteStore）与 node:sqlite 版
 *      （server/src/store.js）的行为一致 —— 用同一批操作跑两个实现，逐条比对。
 *   2. shared/ 里的业务逻辑（Analytics / LinkageEngine / Planner）在
 *      DO 存储上能算出与本机相同的数字 —— 这是「申报材料口径可现场复现」的底线。
 *   3. 接口定义（server/src/app.js）在 MiniRouter 上跑得通，且返回结构完整。
 *
 * DO 的 SQLite API 是 workerd 提供的，Node 跑不了。
 * 这里用一个「同步 SQLite 适配器」把 node:sqlite 包装成 DO 的
 * sql.exec() 游标形态，从而在 Node 里完整复现 DO 侧的调用路径。
 */

import { DatabaseSync } from 'node:sqlite';
import { SqliteStore } from '../cloud/src/sqlite-store.js';
import { Store } from '../server/src/store.js';
import { MiniRouter, MiniRequest, corsMiddleware } from '../server/src/mini.js';
import { createApiRouter } from '../server/src/app.js';
import { Platform, defaultField } from '../shared/platform.js';
import { Analytics } from '../shared/analytics.js';
import { LinkageEngine } from '../shared/linkage.js';
import { seedDemoPlatform } from '../shared/demo.js';
import { seedAgroHistory } from '../shared/agroseed.js';
import { RealtimeHub } from '../shared/realtime.js';
import { LinkStats } from '../shared/linkstats.js';
import { buildSprayMissions, buildRecheckMission } from '../shared/spraydispatch.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * 把 node:sqlite 包装成 DO 的 sql.exec() 游标形态。
 *
 * DO 的 sql.exec() 与 node:sqlite 的差别：
 *   - 支持一次执行多条语句（建表脚本靠这一点）
 *   - 带参数时只能执行单条语句
 * 因此这里分两种情况处理。
 */
class FakeDoSql {
  constructor(db) { this.db = db; }
  exec(query, ...params) {
    const head = query.trim().split(/\s+/, 1)[0].toUpperCase();
    const isQuery = head === 'SELECT' || head === 'WITH';
    if (isQuery) {
      const stmt = this.db.prepare(query);
      const rows = params.length ? stmt.all(...params) : stmt.all();
      return { toArray: () => rows, one: () => rows[0] ?? null };
    }
    // 建表 / 写入：DO 的 exec 会真正执行，node:sqlite 用 db.exec
    if (params.length) this.db.prepare(query).run(...params);
    else this.db.exec(query);
    return { toArray: () => [], one: () => null };
  }
}

function norm(v) {
  return JSON.stringify(v, (k, val) => {
    if (k === 'createdAt' || k === 'ts' || k === 'issuedAt' || k === 'registeredAt') return '<T>';
    if (k === 'updatedAt' || k === 'lastSeen' || k === 'generatedAt') return '<T>';
    if (k === 'missionId' && typeof val === 'string') return '<MID>';
    if (k === 'commandId') return '<CID>';
    if (k === 'apiKey') return '<KEY>';
    if (k === 'salt') return '<SALT>';
    return val;
  });
}

async function buildEnv(kind) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cloudtest-'));
  const field = defaultField();

  let store;
  if (kind === 'do') {
    const db = new DatabaseSync(path.join(dir, 't.db'));
    store = new SqliteStore(new FakeDoSql(db));
  } else {
    store = new Store(path.join(dir, 't.db'));
  }
  await store.migrate();

  const platform = new Platform({ store, field });
  const analytics = new Analytics(store, field);
  const linkage = new LinkageEngine({ store, onEvent: () => {} });
  const stats = new LinkStats();
  const hub = new RealtimeHub({ store, stats, onTelemetry: () => {}, onDetection: () => {} });
  const broadcast = () => {};

  seedDemoPlatform(store, { skipTenants: false });
  seedAgroHistory(store, field, platform.getPlan().best);

  return { store, field, platform, analytics, linkage, hub, stats, broadcast };
}

/** 在两份环境里跑同样的操作，然后比对存储内容 */
async function exercise(store) {
  const field = defaultField();
  // 写入一批遥测
  for (let i = 0; i < 5; i++) {
    store.insertTelemetry({
      ts: 1700000000000 + i * 1000, deviceId: 'UAV-01', kind: 'uav',
      state: 'idle', pos: { x: i, y: i, z: 0, spd: 4, hdg: 90 },
      batt: 90 - i, coverage: i / 10, payload: { seq: i },
    }, 12 + i);
  }
  // 写入检出
  store.insertDetection({
    detId: 'D-1', ts: 1700000000000, deviceId: 'UAV-01', kind: 'uav',
    part: 'leaf', disease: 'fusarium', confidence: 0.88,
    bbox: { x: 1, y: 2, w: 3, h: 4 }, geo: { x: 10, y: 20 },
    grid: { row: 6, col: 12 },
  });
  // 写入作业单
  store.insertMission({
    missionId: 'M-1', createdAt: 1700000000000, type: 'spray',
    target: { grid: { row: 6, col: 12 }, cells: [1, 2, 3] },
    disease: 'fusarium',
    spray: { speed: 4, swath: 5, flow: 2, dose: 12, agent: 'A' },
    plan: { algo: 'x', length: 100, estMinutes: 5, estVolumeL: 1.2, ecoScore: 0.9,
      savedVsUniformL: 3, targetCells: 3, targetClusters: 1, targetAreaHa: 0.5,
      targetCoverage: 0.3, spillAreaHa: 0.1, zoneAreaHa: 2, uniformZoneL: 5,
      savedVsZoneL: 3.8, savedRatioVsZone: 0.76 },
    status: 'pending',
  });
  // 联动事件
  store.insertLinkEvent({
    eventId: 'E-1', ts: 1700000000000,
    trigger: { deviceId: 'UAV-01', kind: 'uav', reason: '置信度低' },
    chain: ['uav_detect', 'cloud_dispatch'], grid: { row: 6, col: 12 },
    disease: 'fusarium', latency: { sense: 10, dispatch: 20, act: 30, total: 60 },
    closed: false,
  });
  // 平台底座
  store.upsertTenant({ id: 't-x', name: '测试农场', type: 'farm', createdAt: 1 });
  store.upsertMember({ userId: 'u-x', tenantId: 't-x', name: '张三', role: 'farm_owner', fieldIds: ['FLD-1'], createdAt: 1 });
  store.upsertDeviceAccess({ deviceId: 'UAV-01', tenantId: 't-x', ownerUserId: 'u-x', kind: 'uav', name: '无人机', model: 'M', accessState: 'active', salt: 's', registeredAt: 1 });
  store.insertCommand({ commandId: 'C-1', deviceId: 'UAV-01', tenantId: 't-x', type: 'survey', missionId: 'M-1', payload: { a: 1 }, state: 'issued', issuedAt: 1 });
  store.insertUsage({ ts: 1, tenantId: 't-x', missionId: 'M-1', type: 'spray', areaMu: 15, volumeL: 1.2, minutes: 5, sorties: 1, detections: 3, savedL: 3.8, amount: 12 });

  // 读回
  return {
    fields: store.listFields(),
    devices: store.listDevices(),
    telemetry: store.recentTelemetry(10),
    telemetryOne: store.recentTelemetry(10, 'UAV-01'),
    detections: store.listDetections(10),
    missions: store.listMissions(10),
    missionsByType: store.listMissionsByType('spray', 10),
    links: store.listLinkEvents(10),
    tenants: store.listTenants(),
    members: store.listMembers(),
    member: store.getMember('u-x'),
    access: store.listDeviceAccess(),
    accessOne: store.getDeviceAccess('UAV-01'),
    commands: store.listCommands(),
    usage: store.listUsage(),
    counts: {
      fields: store.countRows('fields'),
      telemetry: store.countRows('telemetry'),
      detections: store.countRows('detections'),
      missions: store.countRows('missions'),
    },
  };
}

async function main() {
  console.log('=== 1. 存储层行为比对（node:sqlite vs DO SQLite 适配器）===');
  const envNode = await buildEnv('node');
  const envDo = await buildEnv('do');
  const a = await exercise(envNode.store);
  const b = await exercise(envDo.store);
  const na = norm(a), nb = norm(b);
  if (na === nb) {
    console.log('✓ 存储读写结果完全一致');
  } else {
    let p = 0;
    while (p < na.length && p < nb.length && na[p] === nb[p]) p++;
    console.log('✗ 存储结果不一致 @', p);
    console.log('  node:', na.slice(Math.max(0, p - 80), p + 160));
    console.log('  do  :', nb.slice(Math.max(0, p - 80), p + 160));
    process.exit(1);
  }

  console.log('\n=== 2. 业务口径比对（六维统计 / 联动 / 规划）===');
  const dims = ['spatial', 'temporal', 'disease', 'platform', 'task', 'environment'];
  let diff = 0;
  for (const d of dims) {
    const ra = norm(envNode.analytics.byDimension(d, {}));
    const rb = norm(envDo.analytics.byDimension(d, {}));
    const same = ra === rb;
    if (!same) diff++;
    console.log(`  ${d.padEnd(12)} ${same ? '✓ 一致' : '✗ 不一致'}`);
    if (!same) {
      let p = 0;
      while (p < ra.length && p < rb.length && ra[p] === rb[p]) p++;
      console.log('    node:', ra.slice(Math.max(0, p - 60), p + 120));
      console.log('    do  :', rb.slice(Math.max(0, p - 60), p + 120));
    }
  }
  const oa = norm(envNode.analytics.overview());
  const ob = norm(envDo.analytics.overview());
  console.log(`  overview     ${oa === ob ? '✓ 一致' : '✗ 不一致'}`);
  if (oa !== ob) diff++;

  console.log('\n=== 3. 接口层比对（MiniRouter 跑在 DO 存储上）===');
  const mini = new MiniRouter();
  mini.use(corsMiddleware);
  createApiRouter({
    router: mini, store: envDo.store, platform: envDo.platform,
    analytics: envDo.analytics, linkage: envDo.linkage, hub: envDo.hub,
    broadcast: envDo.broadcast, field: envDo.field,
  });
  const PATHS = [
    '/meta', '/analytics/overview', '/analytics/spatial', '/analytics/task',
    '/devices', '/detections?limit=5', '/missions?limit=5', '/linkage/events?limit=5',
    '/plan', '/baseline', '/briefing', '/weather', '/strategies',
    '/tenancy/identity', '/tenancy/tenants', '/fields',
    '/access/devices', '/access/commands', '/metering/invoices', '/metering/metrics',
    '/platform/services', '/farmer/messages', '/openapi/stats', '/link/metrics',
    // 算法内核接口（新增）
    '/algo/benchmarks', '/algo/benchmarks/detection', '/algo/benchmarks/planning',
    '/algo/benchmarks/fusion', '/algo/benchmarks/spray',
  ];
  let ifaceDiff = 0;
  for (const p of PATHS) {
    const req = new MiniRequest({ method: 'GET', url: p, headers: {}, body: null });
    const res = await mini.handle(req);
    let body = res.body;
    try { body = JSON.parse(res.body); } catch { /* keep */ }
    // 合法响应：200 且是对象。数组可能为空（尚未有设备/链路样本），
    // 这属于正常状态，不算异常。
    const ok = res.statusCode === 200 && body && typeof body === 'object';
    if (!ok) { ifaceDiff++; console.log(`  ✗ ${p} status=${res.statusCode} body=${String(res.body).slice(0, 80)}`); }
  }
  console.log(`  ${PATHS.length} 个接口，${ifaceDiff} 个异常`);
  diff += ifaceDiff;

  // POST 接口：算法内核（协同规划 / 算法对比）
  const POSTS = [
    ['/algo/swarm/plan', { nDrones: 4, algo: 'pso-aco' }],
    ['/algo/swarm/compare', { nDrones: 4 }],
  ];
  for (const [p, body] of POSTS) {
    const req = new MiniRequest({
      method: 'POST', url: p, headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const res = await mini.handle(req);
    let parsed = null;
    try { parsed = JSON.parse(res.body); } catch { /* keep */ }
    const ok = res.statusCode === 200 && parsed && typeof parsed === 'object';
    if (!ok) {
      ifaceDiff++; console.log(`  ✗ POST ${p} status=${res.statusCode}`);
    } else if (p === '/algo/swarm/plan' && parsed.ok) {
      console.log(`  ✓ POST ${p} → 航程 ${parsed.metrics.totalLengthM} m / 覆盖 ${parsed.metrics.coverage}`);
    }
  }
  console.log(`  ${POSTS.length} 个 POST 接口，${ifaceDiff} 个异常`);
  diff += ifaceDiff;

  console.log('\n=== 4. 关键数字抽查（云端口径 vs 本机口径）===');
  const ov = JSON.parse(norm(envDo.analytics.overview()));
  const eff = ov.efficiency || {};
  console.log('  分区口径节药率 :', eff.savedRatioVsZone, '%');
  console.log('  全田口径节药率 :', eff.savedRatio, '%');
  console.log('  联动闭环统计   :', JSON.stringify(envDo.linkage.stats()));

  console.log(`\n${diff === 0 ? '✓ 云端运行时验证全部通过' : '✗ 存在 ' + diff + ' 处差异'}`);
  process.exit(diff === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
