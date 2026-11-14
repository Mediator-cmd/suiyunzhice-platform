/**
 * 内存存储 —— 与服务端 SQLite Store 接口一致的轻量实现
 *
 * 用途：纯静态部署（GitHub Pages 等）没有后端时，浏览器端用同一套
 * Analytics / LinkageEngine / Planner 计算逻辑跑出完整演示。
 *
 * 与 SQLite 版的关键差异：数据只存在内存中，刷新页面即重置。
 * 这对演示是合理的 —— README「已知边界」里也如实说明了这一点。
 */

/** SQLite 不能绑定 undefined，统一转 null；此处保持同样的数据规约 */
const nz = (v) => (v === undefined ? null : v);

export class MemoryStore {
  constructor() {
    this.fields = new Map();
    this.devices = new Map();
    this.telemetry = [];
    this.detections = [];
    this.missions = [];
    this.linkEvents = [];
    this.sprays = [];
  }

  // ---- 地块 ----
  upsertField(f) {
    this.fields.set(f.id, {
      id: f.id, name: f.name, widthM: f.widthM, heightM: f.heightM,
      gridRows: f.gridRows, gridCols: f.gridCols,
      obstacles: f.obstacles || [],
      areaHa: f.totalAreaHa?.() ?? (f.widthM * f.heightM) / 10000,
    });
  }
  listFields() { return [...this.fields.values()]; }
  getField(id) { return this.listFields().find(f => f.id === id); }

  // ---- 设备 ----
  upsertDevice(d) {
    this.devices.set(d.deviceId, {
      deviceId: d.deviceId, kind: d.kind, name: d.name || d.deviceId,
      state: d.state, pos: { x: d.pos?.x, y: d.pos?.y, z: d.pos?.z },
      batt: d.batt, coverage: d.coverage,
      lastSeen: d.lastSeen ?? Date.now(), online: true,
    });
  }
  setDeviceOffline(deviceId) {
    const d = this.devices.get(deviceId);
    if (d) { d.online = false; d.state = 'offline'; }
  }
  listDevices() {
    return [...this.devices.values()]
      .sort((a, b) => a.deviceId.localeCompare(b.deviceId))
      .map(d => ({ ...d, pos: { ...d.pos } }));
  }

  // ---- 遥测 ----
  insertTelemetry(t, latency) {
    this.telemetry.push({
      ts: t.ts, deviceId: t.deviceId, kind: t.kind, state: t.state,
      pos: { x: t.pos?.x, y: t.pos?.y, z: t.pos?.z, spd: t.pos?.spd, hdg: t.pos?.hdg },
      batt: t.batt, latencyMs: latency, payload: t.payload || {},
    });
    if (this.telemetry.length > 2000) this.telemetry.shift();
  }
  recentTelemetry(limit = 200, deviceId = null) {
    const arr = deviceId ? this.telemetry.filter(t => t.deviceId === deviceId) : this.telemetry;
    return arr.slice(-limit);
  }
  telemetryRange(fromTs, toTs) {
    return this.telemetry.filter(t => t.ts >= fromTs && t.ts <= toTs);
  }

  // ---- 检测 ----
  insertDetection(d) {
    const i = this.detections.findIndex(x => x.detId === d.detId);
    const rec = {
      detId: d.detId, ts: d.ts, deviceId: d.deviceId, kind: d.kind,
      part: d.part, disease: d.disease, confidence: d.confidence,
      bbox: d.bbox || {}, geo: d.geo || {}, grid: d.grid || {},
      model: d.model ?? 'SAN-GAT-RL',
    };
    if (i >= 0) this.detections[i] = rec; else this.detections.push(rec);
  }
  listDetections(limit = 500) {
    return this.detections.slice().sort((a, b) => b.ts - a.ts).slice(0, limit);
  }

  // ---- 任务 ----
  insertMission(m) {
    const rec = {
      missionId: m.missionId, createdAt: m.createdAt, type: m.type,
      grid: m.target?.grid || { row: null, col: null },
      disease: m.disease ?? null,
      spray: m.spray || {},
      plan: m.plan || {},
      status: m.status ?? 'pending',
      cells: m.target?.cells ?? [],
      zoneId: m.zoneId ?? m.target?.zone ?? null,
      zoneName: m.zoneName ?? null,
    };
    const i = this.missions.findIndex(x => x.missionId === rec.missionId);
    if (i >= 0) this.missions[i] = rec; else this.missions.push(rec);
  }
  updateMissionStatus(missionId, status) {
    const m = this.missions.find(x => x.missionId === missionId);
    if (m) m.status = status;
  }
  listMissions(limit = 200) {
    return this.missions.slice().sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  }

  // ---- 联动事件 ----
  insertLinkEvent(e) {
    const rec = {
      eventId: e.eventId, ts: e.ts,
      trigger: e.trigger, chain: e.chain, grid: e.grid,
      disease: e.disease ?? null, latency: e.latency, closed: e.closed,
      mission: e.mission ?? null,
    };
    const i = this.linkEvents.findIndex(x => x.eventId === rec.eventId);
    if (i >= 0) this.linkEvents[i] = rec; else this.linkEvents.push(rec);
  }
  listLinkEvents(limit = 200) {
    return this.linkEvents.slice().sort((a, b) => b.ts - a.ts).slice(0, limit);
  }

  // ---- 施药记录 ----
  insertSpray(s) { this.sprays.push(s); }

  countRows(table) {
    return {
      fields: this.fields.size, devices: this.devices.size,
      telemetry: this.telemetry.length, detections: this.detections.length,
      missions: this.missions.length, link_events: this.linkEvents.length,
      sprays: this.sprays.length,
    }[table] || 0;
  }
}
