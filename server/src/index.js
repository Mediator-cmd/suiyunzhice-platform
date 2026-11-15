/**
 * 穗云智策 · 空地协同云平台 —— 服务端入口
 *
 * 启动：node server/src/index.js
 * 环境变量：
 *   PORT           监听端口，默认 8080
 *   DB_PATH        SQLite 路径，默认 ./data/suiyun.db
 *   SIM            是否启动内置数据模拟器，默认 1
 */

import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { WebSocketServer } from 'ws';

import { Store } from './store.js';
import { RealtimeHub } from './hub.js';
import { Analytics } from '../../shared/analytics.js';
import { LinkageEngine } from '../../shared/linkage.js';
import { Platform, defaultField } from '../../shared/platform.js';
import {
  solveSprayRatio, generateSprayRoute, scoreRoute,
} from '../../shared/planner.js';
import { Simulator } from '../../shared/simulator.js';
import { buildSprayMissions } from '../../shared/spraydispatch.js';
import {
  DISEASES, ANALYTICS_DIMENSIONS, DEVICE_STATES, PLAN_OBJECTIVES, SPRAY_RATIO_NOTE,
} from '../../shared/schema.js';
import {
  SPRAY_STRATEGIES, AGRO_CALENDAR, SPRAY_WINDOW_RULES,
  currentWeather, weatherForecast, windScale, strategyFor,
} from '../../shared/agronomy.js';

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
      const mission = {
        missionId: `M-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        createdAt: Date.now(), type: 'recheck',
        target: { grid: d.grid, cells: [] },
        disease: d.disease,
        spray: {}, plan: {}, status: 'pending',
      };
      store.insertMission(mission);
      broadcast('mission', mission);
    }
    dispatchSprayIfNeeded();
  },
});

/**
 * 自动派工：确诊病害在某个管理分区累积到阈值后，
 * 生成带「飞行速度 × 喷洒速度」比例的靶向施药作业单。
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
      missions: store.listMissions(5000),
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

// ---- HTTP 应用 ----
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

api.get('/meta', (req, res) => res.json(platform.meta()));

api.get('/devices', (req, res) => res.json(store.listDevices()));
api.get('/devices/telemetry', (req, res) =>
  res.json(store.recentTelemetry(Number(req.query.limit || 300), req.query.deviceId || null)));
api.get('/link/metrics', (req, res) => res.json(hub.linkMetrics()));
api.get('/detections', (req, res) =>
  res.json(store.listDetections(Number(req.query.limit || 300))));
api.get('/missions', (req, res) => res.json(store.listMissions(Number(req.query.limit || 200))));
api.get('/linkage/events', (req, res) => res.json({
  events: store.listLinkEvents(Number(req.query.limit || 100)),
  stats: linkage.stats(),
}));
api.get('/analytics/overview', (req, res) => res.json(analytics.overview()));
api.get('/analytics/:dim', (req, res) => res.json(analytics.byDimension(req.params.dim, req.query)));
api.get('/briefing', (req, res) => res.json(analytics.farmerBriefing()));

/* ---- 农情：气象实况 / 施药窗口 / 三日预报 / 施药策略库 ---- */
api.get('/weather', (req, res) => res.json({
  ...currentWeather(),
  forecast: weatherForecast(),
  windScale: windScale(currentWeather().wind),
}));

api.get('/strategies', (req, res) => res.json({
  strategies: SPRAY_STRATEGIES,
  calendar: AGRO_CALENDAR,
  windowRules: SPRAY_WINDOW_RULES,
}));

api.get('/strategies/:disease', (req, res) => {
  const s = strategyFor(String(req.params.disease));
  if (!s) return res.status(404).json({ error: '未匹配的病种策略' });
  res.json(s);
});

api.get('/plan', (req, res) => {
  const opts = {};
  if (req.query.weights) {
    const [e, s, ec] = String(req.query.weights).split(',').map(Number);
    opts.weights = { economy: e, speed: s, eco: ec };
  }
  if (req.query.swath) opts.swaths = [Number(req.query.swath)];
  if (req.query.mode) opts.mode = String(req.query.mode);
  if (req.query.dose) opts.targetDoseLha = Number(req.query.dose);
  res.json(getPlan(opts));
});

api.post('/plan/ratio', (req, res) => {
  const {
    speedMs = 6, swathM = 1.0, targetDoseLha = 12,
    nozzleCount = 4, nozzleFlowLmin = 4.0,
  } = req.body || {};
  const plan = getPlan().best;
  res.json(solveSprayRatio(plan.route, { speedMs, swathM, targetDoseLha, nozzleCount, nozzleFlowLmin }));
});

api.post('/plan/simulate', (req, res) => {
  const {
    headingDeg = 90, speedMs = 4.5, swathM = 5.0, turnRadiusM = 4.0,
    mode = 'full', targetDoseLha = 12,
  } = req.body || {};
  const route = generateSprayRoute(FIELD, { headingDeg, speedMs, swathM, turnRadiusM, mode, targetDoseLha });
  const ratio = solveSprayRatio(route, { speedMs, swathM, targetDoseLha });
  res.json({
    route: { ...route, points: route.points.slice(0, 4000) },
    ratio,
    score: scoreRoute(route, ratio),
  });
});

api.post('/missions', (req, res) => {
  const body = req.body || {};
  const mission = {
    missionId: `M-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    createdAt: Date.now(),
    type: body.type || 'spray',
    target: body.target || { grid: { row: 0, col: 0 }, cells: [] },
    disease: body.disease || null,
    spray: body.spray || {},
    plan: body.plan || {},
    status: 'pending',
  };
  store.insertMission(mission);
  broadcast('mission', mission);
  res.json(mission);
});

api.post('/missions/:id/status', (req, res) => {
  const status = req.body?.status || 'done';
  store.updateMissionStatus(req.params.id, status);
  broadcast('missionStatus', { missionId: req.params.id, status });
  res.json({ ok: true });
});

// 弱网批量补传
api.post('/ingest/batch', (req, res) => {
  const { telemetry = [], detections = [] } = req.body || {};
  for (const item of telemetry) {
    const latency = Date.now() - (item.ts || Date.now());
    store.insertTelemetry(item, latency);
    hub.recordTelemetry(item.deviceId, item.kind, latency, item.seq, item.state);
    broadcast('telemetry', { ...item, latencyMs: latency });
  }
  for (const d of detections) { store.insertDetection(d); broadcast('detection', d); }
  res.json({ ok: true, telemetry: telemetry.length, detections: detections.length });
});

app.use('/api', api);

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
          const mission = {
            missionId: `M-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            createdAt: Date.now(), type: 'recheck',
            target: { grid: d.grid, cells: [] },
            disease: d.disease,
            spray: {}, plan: {}, status: 'pending',
          };
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

server.listen(PORT, () => {
  console.log(`穗云智策平台已启动: http://localhost:${PORT}`);
  console.log(`  API  : http://localhost:${PORT}/api`);
  console.log(`  遥测 : ws://localhost:${PORT}/ws/telemetry`);
  console.log(`  实时 : ws://localhost:${PORT}/ws/live`);
});
