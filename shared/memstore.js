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
    // 平台底座
    this.tenants = new Map();
    this.members = new Map();
    this.deviceAccess = new Map();
    this.commands = new Map();
    this.usage = [];
  }

  // ---- 地块 ----
  upsertField(f) {
    this.fields.set(f.id, {
      id: f.id, name: f.name, widthM: f.widthM, heightM: f.heightM,
      gridRows: f.gridRows, gridCols: f.gridCols,
      obstacles: f.obstacles || [],
      areaHa: f.totalAreaHa?.() ?? (f.widthM * f.heightM) / 10000,
      lat: f.lat ?? null, lon: f.lon ?? null,
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
      imageUrl: d.imageUrl ?? null,
    };
    if (i >= 0) this.detections[i] = rec; else this.detections.push(rec);
  }
  listDetections(limit = 500) {
    // 排序键与两个 SQL 版存储一致：先按 ts 倒序，同 ts 再按 det_id 倒序。
    // 少了第二排序键，同一批数据在浏览器与云端会返回不同顺序，
    // 页面表格里的行序就会不一致 —— 这是口径漂移的隐蔽来源。
    return this.detections.slice()
      .sort((a, b) => (b.ts - a.ts) || String(b.detId).localeCompare(String(a.detId)))
      .slice(0, limit);
  }

  // ---- 任务 ----
  insertMission(m) {
    const rec = {
      missionId: m.missionId, createdAt: m.createdAt, type: m.type,
      grid: m.target?.grid || { row: null, col: null },
      disease: m.disease ?? null,
      spray: m.spray || {},
      // plan 里的字段必须与 SQLite 版 _missionRow 保持一致，
      // 否则「节药率」等按分区口径的指标在纯静态部署下会算不出来。
      plan: {
        algo: m.plan?.algo ?? null,
        length: m.plan?.length ?? null,
        estMinutes: m.plan?.estMinutes ?? null,
        estVolumeL: m.plan?.estVolumeL ?? m.plan?.estDose ?? null,
        ecoScore: m.plan?.ecoScore ?? null,
        savedVsUniformL: m.plan?.savedVsUniformL ?? null,
        targetCells: m.plan?.targetCells ?? null,
        targetClusters: m.plan?.targetClusters ?? null,
        targetAreaHa: m.plan?.targetAreaHa ?? null,
        targetCoverage: m.plan?.targetCoverage ?? null,
        spillAreaHa: m.plan?.spillAreaHa ?? null,
        zoneAreaHa: m.plan?.zoneAreaHa ?? null,
        uniformZoneL: m.plan?.uniformZoneL ?? null,
        savedVsZoneL: m.plan?.savedVsZoneL ?? null,
        savedRatioVsZone: m.plan?.savedRatioVsZone ?? null,
      },
      status: m.status ?? 'pending',
      cells: m.target?.cells ?? [],
      zoneId: m.zoneId ?? m.target?.zone ?? null,
      zoneName: m.zoneName ?? null,
      recheckParts: m.recheckParts ?? null,
      agent: m.agent ?? m.spray?.agent ?? null,
    };
    const i = this.missions.findIndex(x => x.missionId === rec.missionId);
    if (i >= 0) this.missions[i] = rec; else this.missions.push(rec);
  }
  updateMissionStatus(missionId, status) {
    const m = this.missions.find(x => x.missionId === missionId);
    if (m) m.status = status;
  }
  listMissions(limit = 200) {
    // 与 SQL 版存储的排序键一致（created_at 倒序 → mission_id 倒序）
    return this.missions.slice()
      .sort((a, b) => (b.createdAt - a.createdAt) || String(b.missionId).localeCompare(String(a.missionId)))
      .slice(0, limit);
  }
  /** 按类型取任务：复核任务量远大于施药任务，按类型取可避免统计口径被挤掉 */
  listMissionsByType(type, limit = 200) {
    return this.missions.filter(m => m.type === type)
      .sort((a, b) => (b.createdAt - a.createdAt) || String(b.missionId).localeCompare(String(a.missionId)))
      .slice(0, limit);
  }

  // ---- 联动事件 ----
  insertLinkEvent(e) {
    const rec = {
      eventId: e.eventId, ts: e.ts,
      trigger: e.trigger, chain: e.chain, grid: e.grid,
      disease: e.disease ?? null, latency: e.latency, closed: e.closed,
      mission: e.mission ?? null,
      // 未闭环的原因与地面复核证据 —— 与 SQLite 版保持一致，
      // 否则「空地联动」页在纯静态部署下看不到待闭环说明与复核证据。
      pendingReason: e.pendingReason ?? null,
      groundEvidence: e.groundEvidence ?? null,
    };
    const i = this.linkEvents.findIndex(x => x.eventId === rec.eventId);
    if (i >= 0) this.linkEvents[i] = rec; else this.linkEvents.push(rec);
  }
  listLinkEvents(limit = 200) {
    // 与 SQL 版存储的排序键一致（ts 倒序 → event_id 倒序）
    return this.linkEvents.slice()
      .sort((a, b) => (b.ts - a.ts) || String(b.eventId).localeCompare(String(a.eventId)))
      .slice(0, limit);
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

  /* ================================================================
   * 平台底座：租户 / 成员 / 设备接入 / 指令 / 计量
   * 与服务端 SQLite Store 接口保持一致。
   * ================================================================ */

  // ---- 租户 ----
  upsertTenant(t) {
    const id = t.id || t.tenantId;
    this.tenants.set(id, {
      id, name: t.name, type: t.type || 'farm',
      contact: t.contact ?? null, createdAt: t.createdAt ?? Date.now(),
    });
  }
  listTenants() { return [...this.tenants.values()].sort((a, b) => a.createdAt - b.createdAt); }
  getTenant(id) { return this.tenants.get(id) || null; }

  // ---- 成员 ----
  upsertMember(m) {
    this.members.set(m.userId, {
      userId: m.userId, tenantId: m.tenantId, name: m.name, role: m.role,
      fieldIds: m.fieldIds || [], createdAt: m.createdAt ?? Date.now(),
    });
  }
  listMembers(tenantId = null) {
    const all = [...this.members.values()].sort((a, b) => a.createdAt - b.createdAt);
    return tenantId ? all.filter(m => m.tenantId === tenantId) : all;
  }
  getMember(userId) { return this.members.get(userId) || null; }

  // ---- 设备接入 ----
  upsertDeviceAccess(d) {
    this.deviceAccess.set(d.deviceId, {
      deviceId: d.deviceId, tenantId: d.tenantId, ownerUserId: d.ownerUserId ?? null,
      kind: d.kind, name: d.name, model: d.model ?? '', accessState: d.accessState,
      salt: d.salt, registeredAt: d.registeredAt ?? Date.now(),
      lastSeen: d.lastSeen ?? Date.now(), online: !!d.online,
    });
  }
  listDeviceAccess() {
    return [...this.deviceAccess.values()].sort((a, b) => a.registeredAt - b.registeredAt);
  }
  getDeviceAccess(deviceId) { return this.deviceAccess.get(deviceId) || null; }
  setDeviceAccessState(deviceId, state) {
    const d = this.deviceAccess.get(deviceId);
    if (d) d.accessState = state;
  }

  // ---- 指令 ----
  insertCommand(c) {
    this.commands.set(c.commandId, {
      commandId: c.commandId, deviceId: c.deviceId, tenantId: c.tenantId ?? null,
      type: c.type, missionId: c.missionId ?? null,
      payload: c.payload || {}, state: c.state,
      issuedAt: c.issuedAt ?? Date.now(), ackedAt: c.ackedAt ?? null, doneAt: c.doneAt ?? null,
    });
  }
  listCommands(deviceId = null, limit = 200) {
    // 与 SQL 版存储的排序键一致（issued_at 倒序 → command_id 倒序）
    let all = [...this.commands.values()]
      .sort((a, b) => (b.issuedAt - a.issuedAt) || String(b.commandId).localeCompare(String(a.commandId)));
    if (deviceId) all = all.filter(c => c.deviceId === deviceId);
    return all.slice(0, limit);
  }

  // ---- 计量 ----
  insertUsage(u) {
    this.usage.push({
      ts: u.ts ?? Date.now(), tenantId: u.tenantId, missionId: u.missionId, type: u.type,
      areaMu: u.areaMu ?? null, volumeL: u.volumeL ?? null, minutes: u.minutes ?? null,
      sorties: u.sorties ?? 0, detections: u.detections ?? 0,
      savedL: u.savedL ?? null, amount: u.amount ?? null,
    });
  }
  listUsage(tenantId = null, limit = 500) {
    const arr = tenantId ? this.usage.filter(u => u.tenantId === tenantId) : this.usage;
    // 与 SQL 版存储的排序键一致（ts 倒序 → id 倒序）。
    // usage_records 的 id 是自增列，内存版用插入序号模拟。
    return arr.slice()
      .map((u, i) => ({ u, i }))
      .sort((a, b) => (b.u.ts - a.u.ts) || (b.i - a.i))
      .map(x => x.u)
      .slice(0, limit);
  }
}
