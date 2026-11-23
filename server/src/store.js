/**
 * 存储层 —— 使用 Node 内置 node:sqlite（零原生依赖，Node 22+）
 * 数据表：地块 / 设备 / 遥测 / 检测 / 任务 / 联动事件 / 施药记录
 */

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/** SQLite 不能绑定 undefined，统一转 null */
const nz = (v) => (v === undefined ? null : v);

export class Store {
  constructor(dbPath = process.env.SUIYUN_DB || './data/suiyun.db') {
    if (dbPath !== ':memory:') mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new DatabaseSync(dbPath);
    this.migrate();
  }

  migrate() {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS fields (
        id TEXT PRIMARY KEY, name TEXT, width_m REAL, height_m REAL,
        grid_rows INTEGER, grid_cols INTEGER, obstacles TEXT, area_ha REAL
      );
      CREATE TABLE IF NOT EXISTS devices (
        device_id TEXT PRIMARY KEY, kind TEXT, name TEXT, state TEXT,
        x REAL, y REAL, z REAL, batt REAL, coverage REAL,
        last_seen INTEGER, online INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS telemetry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts INTEGER, device_id TEXT, kind TEXT, state TEXT,
        x REAL, y REAL, z REAL, spd REAL, hdg REAL, batt REAL,
        latency_ms INTEGER, payload TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_tel_ts ON telemetry(ts);
      CREATE INDEX IF NOT EXISTS idx_tel_dev ON telemetry(device_id);
      CREATE TABLE IF NOT EXISTS detections (
        det_id TEXT PRIMARY KEY, ts INTEGER, device_id TEXT, kind TEXT,
        part TEXT, disease TEXT, confidence REAL,
        bx REAL, by REAL, bw REAL, bh REAL,
        gx REAL, gy REAL, grid_row INTEGER, grid_col INTEGER, model TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_det_ts ON detections(ts);
      CREATE TABLE IF NOT EXISTS missions (
        mission_id TEXT PRIMARY KEY, created_at INTEGER, type TEXT,
        grid_row INTEGER, grid_col INTEGER, disease TEXT,
        speed REAL, swath REAL, flow REAL, dose REAL, agent TEXT,
        algo TEXT, length_m REAL, est_minutes REAL, est_volume_l REAL,
        eco_score REAL, status TEXT, cell_ids TEXT
      );
      CREATE TABLE IF NOT EXISTS link_events (
        event_id TEXT PRIMARY KEY, ts INTEGER,
        trigger_device TEXT, trigger_kind TEXT, reason TEXT,
        chain TEXT, grid_row INTEGER, grid_col INTEGER, disease TEXT,
        sense_ms INTEGER, dispatch_ms INTEGER, act_ms INTEGER, total_ms INTEGER,
        closed INTEGER
      );
      CREATE TABLE IF NOT EXISTS sprays (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts INTEGER, mission_id TEXT, grid_row INTEGER, grid_col INTEGER,
        disease TEXT, volume_l REAL, dose REAL, speed REAL, agent TEXT
      );

      /* ---- 平台底座：租户 / 成员 / 地块归属 / 设备接入 / 指令 / 计量 ---- */
      CREATE TABLE IF NOT EXISTS tenants (
        tenant_id TEXT PRIMARY KEY, name TEXT, type TEXT,
        contact TEXT, created_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS members (
        user_id TEXT PRIMARY KEY, tenant_id TEXT, name TEXT, role TEXT,
        field_ids TEXT, created_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS device_access (
        device_id TEXT PRIMARY KEY, tenant_id TEXT, owner_user_id TEXT,
        kind TEXT, name TEXT, model TEXT, access_state TEXT,
        salt TEXT, registered_at INTEGER, last_seen INTEGER, online INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS commands (
        command_id TEXT PRIMARY KEY, device_id TEXT, tenant_id TEXT,
        type TEXT, mission_id TEXT, payload TEXT, state TEXT,
        issued_at INTEGER, acked_at INTEGER, done_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS usage_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts INTEGER, tenant_id TEXT, mission_id TEXT, type TEXT,
        area_mu REAL, volume_l REAL, minutes REAL, sorties INTEGER, detections INTEGER,
        saved_l REAL, amount REAL
      );
    `);
    this.migrateMissions();
    if (!this.db.prepare('PRAGMA table_info(detections)').all().some(column => column.name === 'image_url')) {
      this.db.exec('ALTER TABLE detections ADD COLUMN image_url TEXT');
    }
    // 地块归属租户（多租户底座）
    if (!this.db.prepare('PRAGMA table_info(fields)').all().some(column => column.name === 'tenant_id')) {
      this.db.exec('ALTER TABLE fields ADD COLUMN tenant_id TEXT');
      this.db.exec('ALTER TABLE fields ADD COLUMN owner_user_id TEXT');
    }
    // 地块真实地理锚点（地图叠加真实地形 / 卫星 / 街道底图用）
    const fieldCols = this.db.prepare('PRAGMA table_info(fields)').all().map(c => c.name);
    if (!fieldCols.includes('lat')) this.db.exec('ALTER TABLE fields ADD COLUMN lat REAL');
    if (!fieldCols.includes('lon')) this.db.exec('ALTER TABLE fields ADD COLUMN lon REAL');
  }

  /**
   * 任务表补列（幂等）。
   * 新增字段用于承载靶向施药作业单的完整参数：
   *   zone_id       作业管理分区（A~H）
   *   zone_name     分区显示名
   *   flow_per_speed 流量÷飞行速度 的比例锁
   *   duty_cycle    喷阀占空比
   *   saved_vs_uniform_l 相对整田均匀喷施节约的药量
   * 靶向点喷专用（保证「识别结果—地块—坐标—任务」全链路可追溯）：
   *   target_cells / target_clusters / target_area_ha
   *   target_coverage / spill_area_ha
   *   saved_vs_same_area_l / saved_ratio_vs_same_area
   */
  migrateMissions() {
    const cols = this.db.prepare(`PRAGMA table_info(missions)`).all().map(c => c.name);
    const add = [
      ['zone_id', 'TEXT'],
      ['zone_name', 'TEXT'],
      ['flow_per_speed', 'REAL'],
      ['duty_cycle', 'REAL'],
      ['saved_vs_uniform_l', 'REAL'],
      ['target_cells', 'INTEGER'],
      ['target_clusters', 'INTEGER'],
      ['target_area_ha', 'REAL'],
      ['target_coverage', 'REAL'],
      ['spill_area_ha', 'REAL'],
      ['zone_area_ha', 'REAL'],
      ['uniform_zone_l', 'REAL'],
      ['saved_vs_zone_l', 'REAL'],
      ['saved_ratio_vs_zone', 'REAL'],
    ];
    for (const [name, type] of add) {
      if (!cols.includes(name)) {
        this.db.exec(`ALTER TABLE missions ADD COLUMN ${name} ${type}`);
      }
    }
  }

  // ---- 地块 ----
  upsertField(f) {
    this.db.prepare(`INSERT OR REPLACE INTO fields
      (id,name,width_m,height_m,grid_rows,grid_cols,obstacles,area_ha,tenant_id,owner_user_id,lat,lon)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(nz(f.id), nz(f.name), nz(f.widthM), nz(f.heightM), nz(f.gridRows), nz(f.gridCols),
        JSON.stringify(f.obstacles || []), nz(f.totalAreaHa?.() ?? (f.widthM * f.heightM) / 10000),
        nz(f.tenantId), nz(f.ownerUserId), nz(f.lat), nz(f.lon));
  }
  listFields() {
    return this.db.prepare(`SELECT * FROM fields`).all().map(r => ({
      id: r.id, name: r.name, widthM: r.width_m, heightM: r.height_m,
      gridRows: r.grid_rows, gridCols: r.grid_cols,
      obstacles: JSON.parse(r.obstacles || '[]'), areaHa: r.area_ha,
      tenantId: r.tenant_id ?? null, ownerUserId: r.owner_user_id ?? null,
      lat: r.lat ?? null, lon: r.lon ?? null,
    }));
  }
  getField(id) { return this.listFields().find(f => f.id === id); }

  // ---- 设备 ----
  upsertDevice(d) {
    this.db.prepare(`INSERT INTO devices
      (device_id,kind,name,state,x,y,z,batt,coverage,last_seen,online)
      VALUES (?,?,?,?,?,?,?,?,?,?,1)
      ON CONFLICT(device_id) DO UPDATE SET
        kind=excluded.kind, name=excluded.name, state=excluded.state,
        x=excluded.x, y=excluded.y, z=excluded.z, batt=excluded.batt,
        coverage=excluded.coverage, last_seen=excluded.last_seen, online=1`)
      .run(nz(d.deviceId), nz(d.kind), nz(d.name || d.deviceId), nz(d.state),
        nz(d.pos?.x), nz(d.pos?.y), nz(d.pos?.z),
        nz(d.batt), nz(d.coverage), nz(d.lastSeen ?? Date.now()));
  }
  setDeviceOffline(deviceId) {
    this.db.prepare(`UPDATE devices SET online=0, state='offline' WHERE device_id=?`).run(deviceId);
  }
  listDevices() {
    return this.db.prepare(`SELECT * FROM devices ORDER BY device_id`).all().map(r => ({
      deviceId: r.device_id, kind: r.kind, name: r.name, state: r.state,
      pos: { x: r.x, y: r.y, z: r.z }, batt: r.batt, coverage: r.coverage,
      lastSeen: r.last_seen, online: !!r.online,
    }));
  }

  // ---- 遥测 ----
  insertTelemetry(t, latency) {
    this.db.prepare(`INSERT INTO telemetry
      (ts,device_id,kind,state,x,y,z,spd,hdg,batt,latency_ms,payload)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(nz(t.ts), nz(t.deviceId), nz(t.kind), nz(t.state),
        nz(t.pos?.x), nz(t.pos?.y), nz(t.pos?.z),
        nz(t.pos?.spd), nz(t.pos?.hdg), nz(t.batt),
        nz(latency), JSON.stringify(t.payload || {}));
  }
  recentTelemetry(limit = 200, deviceId = null) {
    const sql = deviceId
      ? `SELECT * FROM (SELECT * FROM telemetry WHERE device_id=? ORDER BY ts DESC LIMIT ?) ORDER BY ts`
      : `SELECT * FROM (SELECT * FROM telemetry ORDER BY ts DESC LIMIT ?) ORDER BY ts`;
    const args = deviceId ? [deviceId, limit] : [limit];
    return this.db.prepare(sql).all(...args).map(r => ({
      ts: r.ts, deviceId: r.device_id, kind: r.kind, state: r.state,
      pos: { x: r.x, y: r.y, z: r.z, spd: r.spd, hdg: r.hdg },
      batt: r.batt, latencyMs: r.latency_ms, payload: JSON.parse(r.payload || '{}'),
    }));
  }
  telemetryRange(fromTs, toTs) {
    return this.db.prepare(`SELECT * FROM telemetry WHERE ts BETWEEN ? AND ? ORDER BY ts`)
      .all(fromTs, toTs).map(r => ({
        ts: r.ts, deviceId: r.device_id, kind: r.kind, state: r.state,
        x: r.x, y: r.y, z: r.z, spd: r.spd, hdg: r.hdg, batt: r.batt, latencyMs: r.latency_ms,
      }));
  }

  // ---- 检测 ----
  insertDetection(d) {
    this.db.prepare(`INSERT OR REPLACE INTO detections
      (det_id,ts,device_id,kind,part,disease,confidence,bx,by,bw,bh,gx,gy,grid_row,grid_col,model,image_url)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(nz(d.detId), nz(d.ts), nz(d.deviceId), nz(d.kind), nz(d.part), nz(d.disease), nz(d.confidence),
        nz(d.bbox?.x), nz(d.bbox?.y), nz(d.bbox?.w), nz(d.bbox?.h),
        nz(d.geo?.x), nz(d.geo?.y), nz(d.grid?.row), nz(d.grid?.col),
        nz(d.model ?? 'SAN-GAT-RL'), nz(d.imageUrl));
  }
  listDetections(limit = 500) {
    return this.db.prepare(`SELECT * FROM detections ORDER BY ts DESC LIMIT ?`).all(limit).map(r => ({
      detId: r.det_id, ts: r.ts, deviceId: r.device_id, kind: r.kind, part: r.part,
      disease: r.disease, confidence: r.confidence,
      bbox: { x: r.bx, y: r.by, w: r.bw, h: r.bh },
      geo: { x: r.gx, y: r.gy }, grid: { row: r.grid_row, col: r.grid_col },
      model: r.model, imageUrl: r.image_url,
    }));
  }

  // ---- 任务 ----
  insertMission(m) {
    this.db.prepare(`INSERT OR REPLACE INTO missions
      (mission_id,created_at,type,grid_row,grid_col,disease,speed,swath,flow,dose,agent,
       algo,length_m,est_minutes,est_volume_l,eco_score,status,cell_ids,
       zone_id,zone_name,flow_per_speed,duty_cycle,saved_vs_uniform_l,
       target_cells,target_clusters,target_area_ha,target_coverage,spill_area_ha,
       zone_area_ha,uniform_zone_l,saved_vs_zone_l,saved_ratio_vs_zone)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(nz(m.missionId), nz(m.createdAt), nz(m.type), nz(m.target?.grid?.row),
        nz(m.target?.grid?.col), nz(m.disease),
        nz(m.spray?.speed), nz(m.spray?.swath), nz(m.spray?.flow),
        nz(m.spray?.dose), nz(m.spray?.agent),
        nz(m.plan?.algo), nz(m.plan?.length), nz(m.plan?.estMinutes),
        // 修正：原先误写 estDose，导致 est_volume_l 恒为空、节药率算不出来
        nz(m.plan?.estVolumeL ?? m.plan?.estDose),
        nz(m.plan?.ecoScore),
        nz(m.status ?? 'pending'), JSON.stringify(m.target?.cells ?? []),
        nz(m.zoneId ?? m.target?.zone), nz(m.zoneName),
        nz(m.spray?.flowPerSpeed), nz(m.spray?.dutyCycle),
        nz(m.plan?.savedVsUniformL),
        nz(m.plan?.targetCells), nz(m.plan?.targetClusters), nz(m.plan?.targetAreaHa),
        nz(m.plan?.targetCoverage), nz(m.plan?.spillAreaHa),
        nz(m.plan?.zoneAreaHa), nz(m.plan?.uniformZoneL),
        nz(m.plan?.savedVsZoneL), nz(m.plan?.savedRatioVsZone));
  }
  updateMissionStatus(missionId, status) {
    this.db.prepare(`UPDATE missions SET status=? WHERE mission_id=?`).run(status, missionId);
  }
  listMissions(limit = 200) {
    return this.db.prepare(`SELECT * FROM missions ORDER BY created_at DESC LIMIT ?`).all(limit).map(r => this._missionRow(r));
  }

  /**
   * 按任务类型取任务（不限条数上限语义：只取该类型最新 limit 条）。
   *
   * 为什么需要它：复核任务（recheck）的产生速率远高于施药任务，
   * 一次「最新 N 条」窗口会被复核任务占满，导致施药任务被挤出窗口，
   * 节药率统计随之变成「待作业」。按类型取可以保证口径稳定。
   */
  listMissionsByType(type, limit = 200) {
    return this.db.prepare(
      `SELECT * FROM missions WHERE type=? ORDER BY created_at DESC LIMIT ?`)
      .all(type, limit).map(r => this._missionRow(r));
  }

  _missionRow(r) {
    return {
      missionId: r.mission_id, createdAt: r.created_at, type: r.type,
      grid: { row: r.grid_row, col: r.grid_col }, disease: r.disease,
      spray: {
        speed: r.speed, swath: r.swath, flow: r.flow, dose: r.dose, agent: r.agent,
        flowPerSpeed: r.flow_per_speed, dutyCycle: r.duty_cycle,
      },
      plan: {
        algo: r.algo, length: r.length_m, estMinutes: r.est_minutes,
        estVolumeL: r.est_volume_l, ecoScore: r.eco_score,
        savedVsUniformL: r.saved_vs_uniform_l,
        targetCells: r.target_cells, targetClusters: r.target_clusters,
        targetAreaHa: r.target_area_ha, targetCoverage: r.target_coverage,
        spillAreaHa: r.spill_area_ha,
        zoneAreaHa: r.zone_area_ha, uniformZoneL: r.uniform_zone_l,
        savedVsZoneL: r.saved_vs_zone_l, savedRatioVsZone: r.saved_ratio_vs_zone,
      },
      status: r.status, cells: JSON.parse(r.cell_ids || '[]'),
      zoneId: r.zone_id ?? r.zone_name?.match(/^([A-Z])/)?.[1] ?? null,
      zoneName: r.zone_name,
    };
  }

  // ---- 联动事件 ----
  insertLinkEvent(e) {
    this.db.prepare(`INSERT OR REPLACE INTO link_events
      (event_id,ts,trigger_device,trigger_kind,reason,chain,grid_row,grid_col,disease,
       sense_ms,dispatch_ms,act_ms,total_ms,closed)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(nz(e.eventId), nz(e.ts), nz(e.trigger.deviceId), nz(e.trigger.kind), nz(e.trigger.reason),
        JSON.stringify(e.chain), nz(e.grid?.row), nz(e.grid?.col), nz(e.disease),
        nz(e.latency.sense), nz(e.latency.dispatch), nz(e.latency.act), nz(e.latency.total), e.closed ? 1 : 0);
  }
  listLinkEvents(limit = 200) {
    return this.db.prepare(`SELECT * FROM link_events ORDER BY ts DESC LIMIT ?`).all(limit).map(r => ({
      eventId: r.event_id, ts: r.ts,
      trigger: { deviceId: r.trigger_device, kind: r.trigger_kind, reason: r.reason },
      chain: JSON.parse(r.chain || '[]'),
      grid: { row: r.grid_row, col: r.grid_col }, disease: r.disease,
      latency: { sense: r.sense_ms, dispatch: r.dispatch_ms, act: r.act_ms, total: r.total_ms },
      closed: !!r.closed,
      // 未闭环的原因：派单后地面复核证据尚未回传
      pendingReason: r.closed ? null : '已派单复核，地面机器人尚未回传近距复核证据',
    }));
  }

  // ---- 施药记录 ----
  insertSpray(s) {
    this.db.prepare(`INSERT INTO sprays
      (ts,mission_id,grid_row,grid_col,disease,volume_l,dose,speed,agent)
      VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(nz(s.ts), nz(s.missionId), nz(s.grid?.row), nz(s.grid?.col), nz(s.disease),
        nz(s.volumeL), nz(s.dose), nz(s.speed), nz(s.agent));
  }

  // ---- 统计 ----
  countRows(table) {
    try { return this.db.prepare(`SELECT COUNT(*) c FROM ${table}`).get().c; }
    catch { return 0; }
  }

  /* ================================================================
   * 平台底座：租户 / 成员 / 设备接入 / 指令 / 计量
   * ================================================================ */

  // ---- 租户 ----
  upsertTenant(t) {
    this.db.prepare(`INSERT OR REPLACE INTO tenants
      (tenant_id,name,type,contact,created_at) VALUES (?,?,?,?,?)`)
      .run(nz(t.id || t.tenantId), nz(t.name), nz(t.type || 'farm'),
        nz(t.contact), nz(t.createdAt ?? Date.now()));
  }
  listTenants() {
    return this.db.prepare(`SELECT * FROM tenants ORDER BY created_at`).all().map(r => ({
      id: r.tenant_id, name: r.name, type: r.type, contact: r.contact, createdAt: r.created_at,
    }));
  }
  getTenant(id) { return this.listTenants().find(t => t.id === id) || null; }

  // ---- 成员 ----
  upsertMember(m) {
    this.db.prepare(`INSERT OR REPLACE INTO members
      (user_id,tenant_id,name,role,field_ids,created_at) VALUES (?,?,?,?,?,?)`)
      .run(nz(m.userId), nz(m.tenantId), nz(m.name), nz(m.role),
        JSON.stringify(m.fieldIds || []), nz(m.createdAt ?? Date.now()));
  }
  listMembers(tenantId = null) {
    const rows = tenantId
      ? this.db.prepare(`SELECT * FROM members WHERE tenant_id=? ORDER BY created_at`).all(tenantId)
      : this.db.prepare(`SELECT * FROM members ORDER BY created_at`).all();
    return rows.map(r => ({
      userId: r.user_id, tenantId: r.tenant_id, name: r.name, role: r.role,
      fieldIds: JSON.parse(r.field_ids || '[]'), createdAt: r.created_at,
    }));
  }
  getMember(userId) {
    const r = this.db.prepare(`SELECT * FROM members WHERE user_id=?`).get(userId);
    if (!r) return null;
    return {
      userId: r.user_id, tenantId: r.tenant_id, name: r.name, role: r.role,
      fieldIds: JSON.parse(r.field_ids || '[]'), createdAt: r.created_at,
    };
  }

  // ---- 设备接入 ----
  upsertDeviceAccess(d) {
    this.db.prepare(`INSERT OR REPLACE INTO device_access
      (device_id,tenant_id,owner_user_id,kind,name,model,access_state,salt,registered_at,last_seen,online)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run(nz(d.deviceId), nz(d.tenantId), nz(d.ownerUserId), nz(d.kind), nz(d.name), nz(d.model),
        nz(d.accessState), nz(d.salt), nz(d.registeredAt ?? Date.now()),
        nz(d.lastSeen ?? Date.now()), d.online ? 1 : 0);
  }
  listDeviceAccess() {
    return this.db.prepare(`SELECT * FROM device_access ORDER BY registered_at`).all().map(r => ({
      deviceId: r.device_id, tenantId: r.tenant_id, ownerUserId: r.owner_user_id,
      kind: r.kind, name: r.name, model: r.model, accessState: r.access_state,
      registeredAt: r.registered_at, lastSeen: r.last_seen, online: !!r.online,
    }));
  }
  getDeviceAccess(deviceId) {
    const r = this.db.prepare(`SELECT * FROM device_access WHERE device_id=?`).get(deviceId);
    if (!r) return null;
    return {
      deviceId: r.device_id, tenantId: r.tenant_id, ownerUserId: r.owner_user_id,
      kind: r.kind, name: r.name, model: r.model, accessState: r.access_state,
      salt: r.salt, registeredAt: r.registered_at, lastSeen: r.last_seen, online: !!r.online,
    };
  }
  setDeviceAccessState(deviceId, state) {
    this.db.prepare(`UPDATE device_access SET access_state=? WHERE device_id=?`).run(state, deviceId);
  }

  // ---- 指令 ----
  insertCommand(c) {
    this.db.prepare(`INSERT OR REPLACE INTO commands
      (command_id,device_id,tenant_id,type,mission_id,payload,state,issued_at,acked_at,done_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(nz(c.commandId), nz(c.deviceId), nz(c.tenantId), nz(c.type), nz(c.missionId),
        JSON.stringify(c.payload || {}), nz(c.state),
        nz(c.issuedAt), nz(c.ackedAt), nz(c.doneAt));
  }
  listCommands(deviceId = null, limit = 200) {
    const rows = deviceId
      ? this.db.prepare(`SELECT * FROM commands WHERE device_id=? ORDER BY issued_at DESC LIMIT ?`).all(deviceId, limit)
      : this.db.prepare(`SELECT * FROM commands ORDER BY issued_at DESC LIMIT ?`).all(limit);
    return rows.map(r => ({
      commandId: r.command_id, deviceId: r.device_id, tenantId: r.tenant_id,
      type: r.type, missionId: r.mission_id, payload: JSON.parse(r.payload || '{}'),
      state: r.state, issuedAt: r.issued_at, ackedAt: r.acked_at, doneAt: r.done_at,
    }));
  }

  // ---- 计量 ----
  insertUsage(u) {
    this.db.prepare(`INSERT INTO usage_records
      (ts,tenant_id,mission_id,type,area_mu,volume_l,minutes,sorties,detections,saved_l,amount)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run(nz(u.ts ?? Date.now()), nz(u.tenantId), nz(u.missionId), nz(u.type),
        nz(u.areaMu), nz(u.volumeL), nz(u.minutes), nz(u.sorties ?? 0), nz(u.detections ?? 0),
        nz(u.savedL), nz(u.amount));
  }
  listUsage(tenantId = null, limit = 500) {
    const rows = tenantId
      ? this.db.prepare(`SELECT * FROM usage_records WHERE tenant_id=? ORDER BY ts DESC LIMIT ?`).all(tenantId, limit)
      : this.db.prepare(`SELECT * FROM usage_records ORDER BY ts DESC LIMIT ?`).all(limit);
    return rows.map(r => ({
      ts: r.ts, tenantId: r.tenant_id, missionId: r.mission_id, type: r.type,
      areaMu: r.area_mu, volumeL: r.volume_l, minutes: r.minutes,
      sorties: r.sorties, detections: r.detections, savedL: r.saved_l, amount: r.amount,
    }));
  }
}
