/**
 * 穗云智策 · 空地协同云平台 —— 服务端入口（Node 运行时）
 *
 * 启动：node server/src/index.js
 * 环境变量：
 *   PORT           监听端口，默认 8080
 *   DB_PATH        SQLite 路径，默认 ./data/suiyun.db
 *   SIM            是否启动内置数据模拟器，默认 1
 *
 * 架构说明：
 *   接口定义在 server/src/app.js（运行时无关），本文件只负责 Node 侧的装配：
 *   Express 适配、SQLite 存储、WebSocket 广播、内置模拟器。
 *   云端版（Cloudflare Worker）复用同一份 app.js，
 *   因此两边的接口行为与统计口径天然一致，不会随时间漂移。
 */

import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { WebSocketServer } from 'ws';

import { Store } from './store.js';
import { RealtimeHub } from './hub.js';
import { createApiRouter } from './app.js';
import { MiniRouter, MiniRequest, corsMiddleware } from './mini.js';
import { Analytics } from '../../shared/analytics.js';
import { LinkageEngine } from '../../shared/linkage.js';
import { Platform, defaultField } from '../../shared/platform.js';
import { Simulator } from '../../shared/simulator.js';
import { buildSprayMissions, buildRecheckMission } from '../../shared/spraydispatch.js';
import { DEVICE_STATES } from '../../shared/schema.js';
import { seedDemoPlatform } from '../../shared/demo.js';
import { seedAgroHistory } from '../../shared/agroseed.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');

const PORT = Number(process.env.PORT || 8080);
const DB_PATH = process.env.DB_PATH || join(ROOT, 'data', 'suiyun.db');
const SIM = process.env.SIM !== '0';

const store = new Store(DB_PATH);

// ---- 地块定义：河北省唐山市 30 亩示范田 ----
const FIELD = defaultField();
const platform = new Platform({ store, field: FIELD });

const analytics = new Analytics(store, FIELD);

const getPlan = (opts = {}) => platform.getPlan(opts);
// ---- 实时中枢 ----
const liveClients = new Set();

const hub = new RealtimeHub({
  store,
  onTelemetry: (t, latency) => {
    store.insertTelemetry(t, latency);
    broadcast('telemetry', { ...t, latencyMs: latency });
  },
  onDetection: (d) => {
    broadcast('detection', d);
    // 地面机器人回传近距复核证据 → 闭合此前派单的联动事件
    if (d.kind === 'robot') {
      const closedEv = linkage.completeCycle(d);
      if (closedEv) broadcast('linkage', closedEv);
    }
    const verdict = linkage.evaluateDetection(d);
    if (verdict.needRecheck) {
      const plan = getPlan().best;
      const ev = linkage.runLinkageCycle({
        uavDet: { ...d, deviceId: d.deviceId || 'UAV-01' },
        field: FIELD, planning: plan,
      });
      broadcast('linkage', ev);
      const mission = buildRecheckMission({ detection: d, field: FIELD });
      store.insertMission(mission);
      broadcast('mission', mission);
    }
    dispatchSprayIfNeeded();
  },
});

/**
 * 自动派工：确诊病害在某个管理分区累积到阈值后，
 * 生成带「飞行速度 × 喷洒比例」的靶向施药作业单。
 * 与浏览器端共用 shared/spraydispatch.js，保证两端口径一致。
 */
let lastSprayDispatch = 0;
function dispatchSprayIfNeeded() {
  const now = Date.now();
  if (now - lastSprayDispatch < 8000) return;   // 节流，避免刷屏
  lastSprayDispatch = now;
  try {
    const built = buildSprayMissions({
      field: FIELD,
      dets: store.listDetections(500),
      missions: store.listMissionsByType('spray', 5000),
      plan: getPlan().best,
    });
    for (const b of built) {
      store.insertMission(b.mission);
      broadcast('mission', b.mission);
      broadcast('sprayPlan', { mission: b.mission, ratio: b.ratio });
    }
  } catch (e) {
    console.error('[spray-dispatch]', e.message);
  }
}

const linkage = new LinkageEngine({ store, onEvent: (e) => broadcast('linkage', e) });

/** 统一广播：同时推给设备通道与浏览器通道 */
function broadcast(type, payload) {
  const msg = JSON.stringify({ type, payload, ts: Date.now() });
  for (const relay of liveClients) { try { relay(msg); } catch { /* ignore */ } }
  hub.broadcastRaw(msg);
}

/* ================================================================
 * HTTP 应用
 *
 * 接口定义复用 server/src/app.js —— 与云端 Worker 版同一份代码。
 * 这里用 MiniRouter 承载，再由一层薄适配转成 Express 响应，
 * 好处是本机版与云端版走的是完全相同的路由与中间件逻辑，
 * 不会出现「本机好使、云端字段不一样」的口径漂移。
 * ================================================================ */

const mini = new MiniRouter();
mini.use(corsMiddleware);
createApiRouter({
  router: mini, store, platform, analytics, linkage, hub, broadcast, field: FIELD,
});

const app = express();
app.use(express.json({ limit: '8mb' }));

// MiniRouter → Express 适配层
app.use('/api', async (req, res) => {
  const url = new URL(req.originalUrl, 'http://internal');
  const mreq = new MiniRequest({
    method: req.method,
    url: url.pathname.replace(/^\/api/, '') + url.search,
    headers: req.headers,
    body: req.body ?? null,
  });
  const mres = await mini.handle(mreq);
  for (const [k, v] of Object.entries(mres.headers)) res.setHeader(k, v);
  res.status(mres.statusCode);
  res.send(mres.body ?? '');
});

// ---- 前端静态资源 ----
const WEB_DIST = join(ROOT, 'web', 'dist');
app.use(express.static(WEB_DIST));
app.get(/^\/(?!api|ws).*/, (req, res, next) => {
  res.sendFile(join(WEB_DIST, 'index.html'), (err) => err && next());
});

// ---- 启动 ----
const server = createServer(app);
const telemetryWss = hub.attach(server, '/ws/telemetry');

// 浏览器实时订阅通道
const liveWss = new WebSocketServer({ noServer: true });
liveWss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'hello', payload: { ts: Date.now(), devices: store.listDevices() } }));
  const relay = (msg) => { try { ws.send(msg); } catch { /* ignore */ } };
  liveClients.add(relay);
  ws.on('close', () => liveClients.delete(relay));
  ws.on('error', () => liveClients.delete(relay));
});

// 统一处理 upgrade：按路径分发到对应的 WebSocketServer。
// （若分别用 { server, path } 挂载，先挂载者会抢走 upgrade 并对其它路径返回 400）
server.on('upgrade', (req, socket, head) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  if (pathname === '/ws/live') {
    liveWss.handleUpgrade(req, socket, head, (ws) => liveWss.emit('connection', ws, req));
  } else if (pathname === '/ws/telemetry') {
    telemetryWss.handleUpgrade(req, socket, head, (ws) => telemetryWss.emit('connection', ws, req));
  } else {
    socket.destroy();
  }
});

if (SIM) {
  const sim = new Simulator({
    field: FIELD,
    onDevice: (d) => store.upsertDevice(d),
    onTelemetry: (t, latency) => {
      store.insertTelemetry(t, latency);
      // 模拟器不经 WebSocket，需显式登记链路质量，否则「实时监控」页无指标
      hub.recordTelemetry(t.deviceId, t.kind, latency, t.seq, t.state);
      broadcast('telemetry', { ...t, latencyMs: latency });
    },
    onDetection: (d) => {
      try {
        store.insertDetection(d);
        broadcast('detection', d);
        // 地面机器人回传近距复核证据 → 闭合此前派单的联动事件
        if (d.kind === 'robot') {
          const closedEv = linkage.completeCycle(d);
          if (closedEv) broadcast('linkage', closedEv);
        }
        const verdict = linkage.evaluateDetection(d);
        if (verdict.needRecheck) {
          const plan = getPlan().best;
          const ev = linkage.runLinkageCycle({
            uavDet: { ...d, deviceId: d.deviceId || 'UAV-01' },
            field: FIELD, planning: plan,
          });
          broadcast('linkage', ev);
          const mission = buildRecheckMission({ detection: d, field: FIELD });
          store.insertMission(mission);
          broadcast('mission', mission);
        }
        dispatchSprayIfNeeded();
      } catch (e) {
        console.error('[detect]', e.message);
      }
    },
  });
  sim.start();
  console.log('[sim] 内置数据模拟器已启动');
}

// 平台底座演示数据（与浏览器端共用 shared/demo.js）
// 真实部署时若已有真实租户数据，用 skipTenants 避免覆盖。
seedDemoPlatform(store, { skipTenants: store.listTenants().length > 0 });

// 农情历史（与浏览器端共用 shared/agroseed.js）：
// 过去 7 天的检出与作业记录，让六维统计冷启动即有内容。
// 数字由规划器与病灶模型确定性生成，与实时派工同源。
seedAgroHistory(store, FIELD, platform.getPlan().best);

server.listen(PORT, () => {
  console.log(`穗云智策平台已启动: http://localhost:${PORT}`);
  console.log(`  API  : http://localhost:${PORT}/api`);
  console.log(`  遥测 : ws://localhost:${PORT}/ws/telemetry`);
  console.log(`  实时 : ws://localhost:${PORT}/ws/live`);
});
