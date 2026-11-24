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
import { buildSprayMissions, buildRecheckMission } from '../../shared/spraydispatch.js';
import {
  generateSprayRoute, solveSprayRatio, scoreRoute,
} from '../../shared/planner.js';
import {
  DEMO_IDENTITY, ROLES, visibleFields, listRoles,
} from '../../shared/tenancy.js';
import {
  ACCESS_STATES, COMMAND_STATES, ACCESS_LEVELS,
  registerDevice, verifyApiKey, applyHeartbeat, sweepOffline,
  issueCommand, applyCommandAck, accessHealth,
} from '../../shared/deviceaccess.js';
import {
  PRICE_TABLE, METER_UNITS, measureMission, priceUsage,
  buildInvoice, buildInvoices, platformMetrics, COMMERCIAL_MODEL,
} from '../../shared/metering.js';
import { seedDemoPlatform } from '../../shared/demo.js';
import { seedAgroHistory } from '../../shared/agroseed.js';
import {
  FARMER_MSG_TYPES, buildFarmerMessage, toPushPayload, WECHAT_SERVICE, nonEmptyMessages,
} from '../../shared/farmer.js';

/**
 * 云端后端地址。
 *
 * 纯静态托管（GitHub Pages）与平台同源部署都能用：
 *   · 同源部署（Cloudflare Worker）—— 直接用当前站点的 /api
 *   · GitHub Pages —— 指向云端 Worker
 * 后端不可达时前端会退回浏览器内引擎，功能依然完整。
 */
const CLOUD_API_BASE = 'https://suiyunzhice-platform.3403775603.workers.dev';

const API_BASE = (() => {
  if (import.meta.env.VITE_API_BASE) return import.meta.env.VITE_API_BASE;
  // GitHub Pages 等纯静态托管没有 /api，改为指向云端后端
  const h = window.location.hostname;
  if (h.endsWith('.github.io') || h.endsWith('.github.dev')) return CLOUD_API_BASE;
  return '';
})();

const WS_BASE = (() => {
  if (import.meta.env.VITE_WS_BASE) return import.meta.env.VITE_WS_BASE;
  // API 指向了别的源（如云端后端、本地后端 8080）时，
  // WebSocket 必须跟着 API 走，否则会连到前端自身的端口上握手失败。
  if (API_BASE) {
    return API_BASE.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
  }
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

async function probeBackend() {
  if (backendState !== null) return backendState;
  if (!backendProbe) {
    backendProbe = (async () => {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 4000);
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
    this.analytics = new Analytics(this.store, this.field);
    this.linkage = new LinkageEngine({ store: this.store, onEvent: () => {} });
    this.stats = new LinkStats();
    this.listeners = new Set();
    this.missions = [];
    this.sim = null;
  }

  start() {
    if (this.sim) return;
    this.seedDemoTenancy();
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
        // 地面机器人回传近距复核证据 → 闭合此前派单的联动事件
        if (d.kind === 'robot') {
          const closedEv = this.linkage.completeCycle(d);
          if (closedEv) this.emit('linkage', closedEv);
        }
        // 与服务端一致的联动判据：需近地复核则派单并记录闭环事件
        const verdict = this.linkage.evaluateDetection(d);
        if (verdict.needRecheck) {
          const plan = this.platform.getPlan().best;
          const ev = this.linkage.runLinkageCycle({
            uavDet: { ...d, deviceId: d.deviceId || 'UAV-01' },
            field: this.field, planning: plan,
          });
          this.emit('linkage', ev);
          const mission = buildRecheckMission({ detection: d, field: this.field });
          this.store.insertMission(mission);
          this.emit('mission', mission);
        }
        // 确诊结果累积到一定密度 → 自动生成靶向施药作业单（省药闭环）
        this.maybeDispatchSpray();
      },
    });
    this.sim.start();
  }

  /**
   * 自动派工：确诊病害在某个管理分区累积到阈值后，
   * 生成一条带「飞行速度 × 喷洒速度」比例的靶向施药作业单。
   * 与服务端共用 shared/spraydispatch.js，保证两端口径一致。
   */
  maybeDispatchSpray() {
    const now = Date.now();
    if (now - (this.lastSprayDispatch || 0) < 8000) return;  // 节流，避免刷屏
    this.lastSprayDispatch = now;

    const dets = this.store.listDetections(500);
    // 只取施药任务：pickSprayZones 用它判断「哪些分区已派过工」，
    // 混入大量复核任务会把已派工分区挤出窗口，导致重复派工。
    const missions = this.store.listMissionsByType('spray', 5000);
    const built = buildSprayMissions({
      field: this.field,
      dets,
      missions,
      plan: this.platform.getPlan().best,
    });
    for (const b of built) {
      this.store.insertMission(b.mission);
      this.emit('mission', b.mission);
      this.emit('sprayPlan', { mission: b.mission, ratio: b.ratio });
    }
  }

  stop() { this.sim?.stop(); this.sim = null; }

  /**
   * 播种演示用的平台底座数据。
   * 与服务端共用 shared/demo.js —— 同一套租户、成员、设备与用量记录，
   * 纯静态部署与真实部署看到的平台底座完全一致。
   */
  seedDemoTenancy() {
    seedDemoPlatform(this.store);
    // 农情历史：冷启动即有过去 7 天的检出与作业记录，
    // 六维统计页不需要等模拟器攒够数据才有内容。
    seedAgroHistory(this.store, this.field, this.platform.getPlan().best);
  }

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
  baseline() { return this.platform.baselineReport(); }
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

  /* ================================================================
   * 平台底座 —— 与服务端 REST 路由一一对应
   * 浏览器端跑同一套 shared/ 逻辑，保证演示模式功能不缺失。
   * ================================================================ */

  identity(userId = null) {
    const m = userId ? this.store.getMember(userId) : null;
    if (!m) {
      return {
        identity: { ...DEMO_IDENTITY, permissionCount: ROLES[DEMO_IDENTITY.role].permissions.length },
        permissions: ROLES[DEMO_IDENTITY.role].permissions,
        roles: listRoles(),
        visibleFieldIds: visibleFields(DEMO_IDENTITY, this.store.listFields()).map(f => f.id),
      };
    }
    const role = ROLES[m.role] ? m.role : 'agronomist';
    const tenant = this.store.getTenant(m.tenantId);
    const identity = {
      userId: m.userId, name: m.name, role,
      tenantId: m.tenantId, tenantName: tenant?.name || m.tenantId,
      tenantType: tenant?.type || ROLES[role].tenantType,
      scope: ROLES[role].scope, fieldIds: m.fieldIds || [],
      permissions: ROLES[role].permissions,
      permissionCount: ROLES[role].permissions.length,
    };
    return {
      identity, permissions: identity.permissions, roles: listRoles(),
      visibleFieldIds: visibleFields(identity, this.store.listFields()).map(f => f.id),
    };
  }

  tenants() {
    const members = this.store.listMembers();
    return {
      tenants: this.store.listTenants().map(t => ({
        ...t,
        members: members.filter(m => m.tenantId === t.id).length,
        fields: this.store.listFields().filter(f => f.tenantId === t.id).length,
      })),
    };
  }

  addTenant(body) {
    const id = body.id || `t-${Math.random().toString(36).slice(2, 8)}`;
    this.store.upsertTenant({
      id, name: body.name, type: body.type || 'farm',
      contact: body.contact || null, createdAt: Date.now(),
    });
    return { ok: true, tenant: this.store.getTenant(id) };
  }

  addMember(body) {
    this.store.upsertMember({
      userId: body.userId, tenantId: body.tenantId, name: body.name,
      role: body.role, fieldIds: body.fieldIds || [], createdAt: Date.now(),
    });
    return { ok: true, member: this.store.getMember(body.userId) };
  }

  listMembers(tenantId = null) {
    return { members: this.store.listMembers(tenantId) };
  }

  fieldsList() {
    const all = this.store.listFields();
    return { fields: all, total: all.length, visibleCount: all.length };
  }

  accessDevices() {
    const all = this.store.listDeviceAccess();
    const metrics = new Map(this.stats.linkMetrics().map(m => [m.deviceId, m]));
    const cmds = this.store.listCommands(null, 1000);
    return {
      devices: all.map(d => ({
        ...d,
        health: accessHealth(d, metrics.get(d.deviceId), cmds.filter(c => c.deviceId === d.deviceId)),
      })),
      states: ACCESS_STATES, levels: ACCESS_LEVELS,
    };
  }

  registerAccessDevice(body) {
    const existing = this.store.getDeviceAccess(body.deviceId);
    const r = registerDevice({
      deviceId: body.deviceId, name: body.name, kind: body.kind,
      model: body.model, tenantId: body.tenantId || DEMO_IDENTITY.tenantId,
      ownerUserId: DEMO_IDENTITY.userId,
    }, existing);
    if (!r.ok) return { error: r.reason };
    this.store.upsertDeviceAccess({ ...r.device, salt: r.salt });
    this.store.upsertDevice({
      deviceId: r.device.deviceId, kind: r.device.kind, name: r.device.name,
      state: 'offline', pos: { x: 0, y: 0, z: 0 },
      batt: 100, coverage: 0, lastSeen: Date.now(),
    });
    return { ok: true, device: this.store.getDeviceAccess(r.device.deviceId), apiKey: r.apiKey };
  }

  revokeDevice(deviceId, restore = false) {
    this.store.setDeviceAccessState(deviceId, restore ? ACCESS_STATES.active : ACCESS_STATES.revoked);
    return { ok: true, device: this.store.getDeviceAccess(deviceId) };
  }

  commands(deviceId = null) {
    return { commands: this.store.listCommands(deviceId, 200), states: COMMAND_STATES };
  }

  issueCommandAction(body) {
    const r = issueCommand({
      deviceId: body.deviceId, type: body.type,
      payload: body.payload || {}, missionId: body.missionId || null,
    });
    if (!r.ok) return { error: r.reason };
    const cmd = { ...r.command, tenantId: DEMO_IDENTITY.tenantId };
    this.store.insertCommand(cmd);
    this.emit('command', cmd);
    return { ok: true, command: cmd };
  }

  ackCommand(commandId, state) {
    const cmd = this.store.listCommands(null, 1000).find(c => c.commandId === commandId);
    if (!cmd) return { error: '指令不存在' };
    const updated = applyCommandAck(cmd, state, Date.now());
    this.store.insertCommand(updated);
    this.emit('commandStatus', updated);
    return { ok: true, command: updated };
  }

  priceTable() {
    return { table: PRICE_TABLE, units: METER_UNITS, model: COMMERCIAL_MODEL };
  }

  usageList(tenantId = null) {
    return { usage: this.store.listUsage(tenantId, 500) };
  }

  reportUsage(body) {
    const rec = {
      ts: Date.now(),
      tenantId: body.tenantId || DEMO_IDENTITY.tenantId,
      missionId: body.missionId || null, type: body.type || 'spray',
      areaMu: body.areaMu ?? null, volumeL: body.volumeL ?? null,
      minutes: body.minutes ?? null, sorties: body.sorties ?? 0,
      detections: body.detections ?? 0, savedL: body.savedL ?? null, amount: null,
    };
    const priced = priceUsage({
      sprayMu: rec.type === 'survey' ? 0 : rec.areaMu,
      surveyMu: rec.type === 'survey' ? rec.areaMu : 0,
      sorties: rec.sorties, detections: rec.detections, minutes: rec.minutes,
    });
    rec.amount = priced.total;
    this.store.insertUsage(rec);
    return { ok: true, usage: rec, priced };
  }

  invoices() {
    const tenants = this.store.listTenants();
    const invs = tenants.flatMap(t => buildInvoices({
      tenantId: t.id, tenantName: t.name,
      missions: this.missionsForInvoice(t.id),
    })).filter(i => i.missionCount > 0);
    return { invoices: invs };
  }

  /**
   * 取参与计费的作业单 —— 与服务端 missionsForInvoice 同源。
   * 两个来源都要算：usage_records 用量表 + 已完成的 missions 作业单。
   */
  missionsForInvoice(tenantId) {
    const byMission = new Map();
    for (const u of this.store.listUsage(tenantId, 5000)) {
      if (!u.missionId) continue;
      byMission.set(u.missionId, {
        missionId: u.missionId,
        createdAt: u.ts,
        type: u.type,
        target: { grid: { row: null, col: null }, cells: [] },
        disease: null,
        spray: {},
        plan: {
          estVolumeL: u.volumeL,
          estMinutes: u.minutes,
          length: u.sorties > 0 ? 1 : 0,
          targetAreaHa: u.areaMu != null ? u.areaMu / 15 : null,
          savedVsZoneL: u.savedL,
        },
        cells: Array.from({ length: u.detections || 0 }, (_, i) => i),
        status: 'done',
        tenantId,
      });
    }
    for (const m of this.store.listMissions(5000)) {
      if (m.tenantId !== tenantId) continue;
      if (m.status !== 'done') continue;
      if (byMission.has(m.missionId)) continue;
      const plan = m.plan || {};
      if (plan.estVolumeL == null && plan.targetAreaHa == null) continue;
      byMission.set(m.missionId, { ...m, tenantId });
    }
    return [...byMission.values()];
  }

  meteringMetrics() {
    const { invoices } = this.invoices();
    return {
      metrics: platformMetrics(invoices, {
        tenants: this.store.listTenants().length,
        fields: this.store.listFields().length,
        devices: this.store.listDeviceAccess().length,
        subscribers: this.store.listMembers().length,
      }),
      invoices,
    };
  }

  /** 农户服务消息 —— 与服务端 /farmer/messages 同源 */
  farmerMessages() {
    const dets = this.store.listDetections(200);
    const confirmed = dets.filter(d => d.confidence >= 0.75);
    const latest = confirmed[0] || dets[0] || null;
    const missions = this.store.listMissions(200);
    const doneSpray = missions.find(m => m.type === 'spray' && m.status === 'done');
    const briefing = this.analytics.farmerBriefing();

    const msgs = [
      buildFarmerMessage({ type: 'diagnosis', detection: latest }),
      buildFarmerMessage({ type: 'window' }),
      buildFarmerMessage({ type: 'action', briefing }),
      buildFarmerMessage({ type: 'report', mission: doneSpray }),
    ];

    return {
      types: FARMER_MSG_TYPES,
      service: WECHAT_SERVICE,
      messages: nonEmptyMessages(msgs).map(m => toPushPayload(m)),
    };
  }

  /** 开放平台接入现状 —— 与服务端 /openapi/stats 同源 */  openApiStats() {
    const devices = this.store.listDeviceAccess();
    const cmds = this.store.listCommands(null, 1000);
    return {
      tenants: this.store.listTenants().length,
      devices: devices.length,
      thirdParty: devices.filter(d => d.tenantId !== 't-demo').length,
      own: devices.filter(d => d.tenantId === 't-demo').length,
      keysIssued: devices.length,
      commands: cmds.length,
      commandsDone: cmds.filter(c => c.state === 'done').length,
      endpointCount: 41,
      contracts: ['遥测帧 TELEMETRY', '识别结果 DETECTION', '作业任务 MISSION', '联动事件 LINK_EVENT'],
      steps: 5,
      samples: ['node', 'python', 'ws'],
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
  /** 申报书实测基准场景：与申报材料完全一致的一组数字 */
  baseline: () =>
    withFallback(() => get('/baseline'), () => getLocalEngine().baseline()),

  /* ---- 平台底座 ---- */
  identity: (userId) =>
    withFallback(() => get(`/tenancy/identity${userId ? `?user=${userId}` : ''}`),
      () => getLocalEngine().identity(userId)),
  tenants: () =>
    withFallback(() => get('/tenancy/tenants'), () => getLocalEngine().tenants()),
  members: (tenantId) =>
    withFallback(() => get(`/tenancy/members${tenantId ? `?tenantId=${tenantId}` : ''}`),
      () => getLocalEngine().listMembers(tenantId)),
  fieldsList: () =>
    withFallback(() => get('/fields'), () => getLocalEngine().fieldsList()),
  accessDevices: () =>
    withFallback(() => get('/access/devices'), () => getLocalEngine().accessDevices()),
  commands: (deviceId) =>
    withFallback(() => get(`/access/commands${deviceId ? `?deviceId=${deviceId}` : ''}`),
      () => getLocalEngine().commands(deviceId)),
  priceTable: () =>
    withFallback(() => get('/metering/price'), () => getLocalEngine().priceTable()),
  usageList: (tenantId) =>
    withFallback(() => get(`/metering/usage${tenantId ? `?tenantId=${tenantId}` : ''}`),
      () => getLocalEngine().usageList(tenantId)),
  invoices: () =>
    withFallback(() => get('/metering/invoices'), () => getLocalEngine().invoices()),
  meteringMetrics: () =>
    withFallback(() => get('/metering/metrics'), () => getLocalEngine().meteringMetrics()),
  platformServices: () =>
    withFallback(() => get('/platform/services'), () => ({
      services: [], roles: listRoles(), tenantTypes: {}, commercialModel: COMMERCIAL_MODEL,
    })),
  /** 注册第三方设备（需 device.register 权限） */
  registerAccessDevice: (body) => post('/access/devices/register', body),  /** 吊销 / 恢复设备密钥 */
  revokeDevice: (deviceId, restore = false) =>
    post(`/access/devices/${deviceId}/${restore ? 'restore' : 'revoke'}`, {}),
  /** 下发指令 */
  issueCommand: (body) => post('/access/commands', body),
  /** 创建租户 / 成员 */
  addTenant: (body) => post('/tenancy/tenants', body),
  addMember: (body) => post('/tenancy/members', body),
  /** 开放平台接入现状 */
  openApiStats: () =>
    withFallback(() => get('/openapi/stats'), () => getLocalEngine().openApiStats()),
  /** 批量上报遥测与识别结果（掌上端回传走这里） */
  ingestBatch: (body) => post('/ingest/batch', body),
  /** 农户服务消息（公众号 / 小程序推送内容） */
  farmerMessages: () =>
    withFallback(() => get('/farmer/messages'), () => getLocalEngine().farmerMessages()),
};

/** 带身份的 GET（底座接口需要 X-User-Id） */
export async function getAs(path, userId) {
  try {
    if (!(await probeBackend())) throw new Error('no backend');
    const res = await fetch(`${API_BASE}/api${path}`, {
      headers: userId ? { 'X-User-Id': userId } : {},
    });
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } catch {
    return null;
  }
}

/** 带身份的 POST */
export async function postAs(path, body, userId) {
  try {
    if (!(await probeBackend())) throw new Error('no backend');
    const res = await fetch(`${API_BASE}/api${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(userId ? { 'X-User-Id': userId } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.error || String(res.status));
    }
    return await res.json();
  } catch {
    return null;
  }
}

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
    // ---- 平台底座：本地引擎兜底 ----
    if (path === '/access/devices/register') return e.registerAccessDevice(body);
    if (path.startsWith('/access/devices/') && path.endsWith('/revoke')) {
      return e.revokeDevice(path.split('/')[3], false);
    }
    if (path.startsWith('/access/devices/') && path.endsWith('/restore')) {
      return e.revokeDevice(path.split('/')[3], true);
    }
    if (path === '/access/commands') return e.issueCommandAction(body);
    if (path === '/tenancy/tenants') return e.addTenant(body);
    if (path === '/tenancy/members') return e.addMember(body);
    if (path === '/metering/usage') return e.reportUsage(body);
    if (path === '/ingest/batch') {
      // 掌上端回传：识别结果与遥测批量入本地引擎
      const { telemetry = [], detections = [] } = body || {};
      for (const item of telemetry) {
        const latency = Date.now() - (item.ts || Date.now());
        e.store.insertTelemetry(item, latency);
        e.stats.record(item.deviceId, item.kind, latency, item.seq, item.state);
        e.emit('telemetry', { ...item, latencyMs: latency });
      }
      for (const d of detections) {
        e.store.insertDetection(d);
        e.emit('detection', d);
        // 地面端回传证据 → 闭合此前派单的联动事件（与后端同一逻辑）
        if (d.kind === 'robot') {
          const closed = e.linkage.completeCycle(d);
          if (closed) e.emit('linkage', closed);
        }
      }
      return { ok: true, telemetry: telemetry.length, detections: detections.length };
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
