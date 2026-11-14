/**
 * 前端数据层
 *
 * 优先级：
 *   1. 连上真实后端 → 全部走 REST / WebSocket，页面显示「实时接入」
 *   2. 连不上 → 退回浏览器内引擎（与后端同一套 shared/ 计算逻辑）
 *      页面显示「演示模式」，功能完整，只是数据来自模拟器而非真实设备。
 *
 * 这样纯静态部署（GitHub Pages）也能完整演示平台的全部功能，
 * 包括老师最关心的路径规划与速度-喷洒比例求解。
 */

import { Platform } from '../../shared/platform.js';
import { MemoryStore } from '../../shared/memstore.js';
import { Analytics } from '../../shared/analytics.js';
import { LinkageEngine } from '../../shared/linkage.js';
import { Simulator } from '../../shared/simulator.js';
import { LinkStats } from '../../shared/linkstats.js';
import {
  generateSprayRoute, solveSprayRatio, scoreRoute,
} from '../../shared/planner.js';

const API_BASE = import.meta.env.VITE_API_BASE || '';
const WS_BASE = (() => {
  if (import.meta.env.VITE_WS_BASE) return import.meta.env.VITE_WS_BASE;
  const p = window.location.protocol;
  return `${p === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;
})();

export const MODE = { LIVE: 'live', MOCK: 'mock' };

async function get(path) {
  const res = await fetch(`${API_BASE}/api${path}`);
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

/**
 * 后端可用性探测
 *
 * 纯静态部署（GitHub Pages）没有 /api 与 /ws。如果每次请求都去试一遍，
 * 浏览器控制台会刷出一堆 404。这里做三件事：
 *   1. 已知静态托管域名直接判定为「无后端」，一次网络请求都不发；
 *   2. 其余情况只探测一次，并把进行中的探测 promise 缓存起来，
 *      避免首屏并发请求同时发起多次探测；
 *   3. 探测失败后全部走本地引擎，不再发起任何网络请求。
 */
let backendState = null;      // null=未探测, true=可用, false=不可用
let backendProbe = null;      // 进行中的探测 promise

function isKnownStaticHost() {
  const h = window.location.hostname;
  return h.endsWith('.github.io') || h.endsWith('.github.dev');
}

async function probeBackend() {
  if (backendState !== null) return backendState;
  if (isKnownStaticHost()) { backendState = false; return false; }
  if (!backendProbe) {
    backendProbe = (async () => {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 2500);
        const res = await fetch(`${API_BASE}/api/meta`, { signal: ctrl.signal });
        clearTimeout(timer);
        backendState = res.ok;
      } catch {
        backendState = false;
      }
      return backendState;
    })();
  }
  return backendProbe;
}

/* =====================================================================
 * 浏览器内引擎 —— 与服务端共享 shared/ 下的同一套逻辑
 * ===================================================================== */

class LocalEngine {
  constructor() {
    this.store = new MemoryStore();
    this.platform = new Platform({ store: this.store });
    this.field = this.platform.field;
    this.analytics = new Analytics(this.store);
    this.linkage = new LinkageEngine({ store: this.store, onEvent: () => {} });
    this.stats = new LinkStats();
    this.listeners = new Set();
    this.missions = [];
    this.sim = null;
  }

  start() {
    if (this.sim) return;
    this.sim = new Simulator({
      field: this.field,
      onDevice: (d) => this.store.upsertDevice(d),
      onTelemetry: (t, latency) => {
        this.store.insertTelemetry(t, latency);
        this.stats.record(t.deviceId, t.kind, latency, t.seq, t.state);
        this.emit('telemetry', { ...t, latencyMs: latency });
      },
      onDetection: (d) => {
        this.store.insertDetection(d);
        this.emit('detection', d);
        // 与服务端一致的联动判据：需近地复核则派单并记录闭环事件
        const verdict = this.linkage.evaluateDetection(d);
        if (verdict.needRecheck) {
          const plan = this.platform.getPlan().best;
          const ev = this.linkage.runLinkageCycle({
            uavDet: { ...d, deviceId: d.deviceId || 'UAV-01' },
            field: this.field, planning: plan,
          });
          this.emit('linkage', ev);
          const mission = {
            missionId: `M-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            createdAt: Date.now(), type: 'recheck',
            target: { grid: d.grid, cells: [] },
            disease: d.disease, spray: {}, plan: {}, status: 'pending',
          };
          this.store.insertMission(mission);
          this.emit('mission', mission);
        }
      },
    });
    this.sim.start();
  }

  stop() { this.sim?.stop(); this.sim = null; }

  onMessage(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(type, payload) {
    for (const fn of this.listeners) {
      try { fn(type, payload, Date.now()); } catch { /* ignore */ }
    }
  }

  /* --- 与后端 REST 路由一一对应 --- */
  meta() { return this.platform.meta(); }
  devices() { return this.store.listDevices(); }
  telemetry(limit = 300) { return this.store.recentTelemetry(limit); }
  linkMetrics() { return this.stats.linkMetrics(); }
  detections(limit = 300) { return this.store.listDetections(limit); }
  missionsList(limit = 200) { return this.store.listMissions(limit); }
  linkageEvents() {
    return { events: this.store.listLinkEvents(100), stats: this.linkage.stats() };
  }
  overview() { return this.analytics.overview(); }
  dimension(dim) { return this.analytics.byDimension(dim, {}); }
  briefing() { return this.analytics.farmerBriefing(); }
  plan(weights) { return this.platform.getPlan(weights || {}); }
  planRatio(body) {
    const {
      speedMs = 6, swathM = 1.0, targetDoseLha = 12,
      nozzleCount = 4, nozzleFlowLmin = 4.0,
    } = body || {};
    const plan = this.platform.getPlan().best;
    return solveSprayRatio(plan.route, { speedMs, swathM, targetDoseLha, nozzleCount, nozzleFlowLmin });
  }
  planSimulate(body) {
    const {
      headingDeg = 90, speedMs = 4.5, swathM = 5.0, turnRadiusM = 4.0,
      mode = 'full', targetDoseLha = 12,
    } = body || {};
    const route = generateSprayRoute(this.field, {
      headingDeg, speedMs, swathM, turnRadiusM, mode, targetDoseLha,
    });
    const ratio = solveSprayRatio(route, { speedMs, swathM, targetDoseLha });
    return {
      route: { ...route, points: route.points.slice(0, 4000) },
      ratio,
      score: scoreRoute(route, ratio),
    };
  }
}

/** 全局唯一的后端不可达时的本地引擎 */
let localEngine = null;
export function getLocalEngine() {
  if (!localEngine) {
    localEngine = new LocalEngine();
    localEngine.start();
  }
  return localEngine;
}

/* =====================================================================
 * API 门面 —— 优先走网络，失败自动降级到本地引擎
 * ===================================================================== */

async function withFallback(fn, localFn) {
  if (!(await probeBackend())) return localFn();
  try {
    return await fn();
  } catch {
    return localFn();
  }
}

export const api = {
  meta: () => withFallback(() => get('/meta'), () => getLocalEngine().meta()),
  devices: () => withFallback(() => get('/devices'), () => getLocalEngine().devices()),
  telemetry: (limit = 300) =>
    withFallback(() => get(`/devices/telemetry?limit=${limit}`), () => getLocalEngine().telemetry(limit)),
  linkMetrics: () =>
    withFallback(() => get('/link/metrics'), () => getLocalEngine().linkMetrics()),
  detections: (limit = 300) =>
    withFallback(() => get(`/detections?limit=${limit}`), () => getLocalEngine().detections(limit)),
  missions: (limit = 200) =>
    withFallback(() => get(`/missions?limit=${limit}`), () => getLocalEngine().missionsList(limit)),
  linkageEvents: () =>
    withFallback(() => get('/linkage/events'), () => getLocalEngine().linkageEvents()),
  overview: () =>
    withFallback(() => get('/analytics/overview'), () => getLocalEngine().overview()),
  dimension: (dim) =>
    withFallback(() => get(`/analytics/${dim}`), () => getLocalEngine().dimension(dim)),
  briefing: () =>
    withFallback(() => get('/briefing'), () => getLocalEngine().briefing()),
  plan: (query) =>
    withFallback(() => get(`/plan${query ? `?${query}` : ''}`),
      () => getLocalEngine().plan(parsePlanQuery(query))),
};

function parsePlanQuery(q) {
  if (!q) return {};
  const p = new URLSearchParams(String(q).replace(/^\?/, ''));
  const opts = {};
  if (p.get('weights')) {
    const [e, s, ec] = p.get('weights').split(',').map(Number);
    opts.weights = { economy: e, speed: s, eco: ec };
  }
  if (p.get('mode')) opts.mode = p.get('mode');
  if (p.get('dose')) opts.targetDoseLha = Number(p.get('dose'));
  if (p.get('swath')) opts.swaths = [Number(p.get('swath'))];
  return opts;
}

export async function post(path, body) {
  try {
    if (!(await probeBackend())) throw new Error('no backend');
    const res = await fetch(`${API_BASE}/api${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } catch {
    const e = getLocalEngine();
    if (path === '/plan/ratio') return e.planRatio(body);
    if (path === '/plan/simulate') return e.planSimulate(body);
    if (path === '/missions') {
      const mission = {
        missionId: `M-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        createdAt: Date.now(),
        type: body?.type || 'spray',
        target: body?.target || { grid: { row: 0, col: 0 }, cells: [] },
        disease: body?.disease || null,
        spray: body?.spray || {}, plan: body?.plan || {}, status: 'pending',
      };
      e.store.insertMission(mission);
      e.emit('mission', mission);
      return mission;
    }
    if (path.endsWith('/status')) {
      const id = path.split('/')[2];
      e.store.updateMissionStatus(id, body?.status || 'done');
      e.emit('missionStatus', { missionId: id, status: body?.status || 'done' });
      return { ok: true };
    }
    throw new Error(`本地引擎不支持 ${path}`);
  }
}

/**
 * 建立实时订阅。
 * 有后端 → WebSocket；无后端 → 订阅本地引擎的消息流。
 * 返回 close 函数。
 */
export function subscribe(handlers) {
  let ws;
  let closed = false;
  let retry = 0;
  let offLocal = null;

  const connect = () => {
    if (closed) return;
    try {
      ws = new WebSocket(`${WS_BASE}/ws/live`);
    } catch {
      scheduleRetry();
      return;
    }
    ws.onopen = () => { retry = 0; handlers.onStatus?.(MODE.LIVE); };
    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      handlers.onMessage?.(msg.type, msg.payload, msg.ts);
    };
    ws.onclose = () => {
      if (closed) return;
      handlers.onStatus?.(MODE.MOCK);
      startLocal();
      scheduleRetry();
    };
    ws.onerror = () => { try { ws.close(); } catch { /* ignore */ } };
  };

  /** 后端不可达 → 切到本地引擎，页面继续完整可用 */
  const startLocal = () => {
    if (offLocal || closed) return;
    const eng = getLocalEngine();
    offLocal = eng.onMessage((type, payload, ts) => {
      handlers.onMessage?.(type, payload, ts);
    });
  };

  const scheduleRetry = () => {
    if (closed) return;
    retry = Math.min(retry + 1, 6);
    setTimeout(connect, 1000 * retry);
  };

  // 先探测后端：有则走 WebSocket，无则直接用本地引擎，
  // 避免在纯静态托管环境里反复触发 404 的握手失败。
  probeBackend().then(ok => {
    if (closed) return;
    if (ok) connect();
    else { startLocal(); handlers.onStatus?.(MODE.MOCK); }
  });

  return () => {
    closed = true;
    try { ws?.close(); } catch { /* ignore */ }
    offLocal?.();
  };
}
