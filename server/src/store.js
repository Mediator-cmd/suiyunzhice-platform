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
  constructor(dbPath = './data/maitian.db') {
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
    `);
  }

  // ---- 地块 ----
  upsertField(f) {
    this.db.prepare(`INSERT OR REPLACE INTO fields
      (id,name,width_m,height_m,grid_rows,grid_cols,obstacles,area_ha) VALUES (?,?,?,?,?,?,?,?)`)
      .run(nz(f.id), nz(f.name), nz(f.widthM), nz(f.heightM), nz(f.gridRows), nz(f.gridCols),
        JSON.stringify(f.obstacles || []), nz(f.totalAreaHa?.() ?? (f.widthM * f.heightM) / 10000));
  }
  listFields() {
    return this.db.prepare(`SELECT * FROM fields`).all().map(r => ({
      id: r.id, name: r.name, widthM: r.width_m, heightM: r.height_m,
      gridRows: r.grid_rows, gridCols: r.grid_cols,
      obstacles: JSON.parse(r.obstacles || '[]'), areaHa: r.area_ha,
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
      (det_id,ts,device_id,kind,part,disease,confidence,bx,by,bw,bh,gx,gy,grid_row,grid_col,model)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(nz(d.detId), nz(d.ts), nz(d.deviceId), nz(d.kind), nz(d.part), nz(d.disease), nz(d.confidence),
        nz(d.bbox?.x), nz(d.bbox?.y), nz(d.bbox?.w), nz(d.bbox?.h),
        nz(d.geo?.x), nz(d.geo?.y), nz(d.grid?.row), nz(d.grid?.col),
        nz(d.model ?? 'SAN-GAT-RL'));
  }
  listDetections(limit = 500) {
    return this.db.prepare(`SELECT * FROM detections ORDER BY ts DESC LIMIT ?`).all(limit).map(r => ({
      detId: r.det_id, ts: r.ts, deviceId: r.device_id, kind: r.kind, part: r.part,
      disease: r.disease, confidence: r.confidence,
      bbox: { x: r.bx, y: r.by, w: r.bw, h: r.bh },
      geo: { x: r.gx, y: r.gy }, grid: { row: r.grid_row, col: r.grid_col },
      model: r.model,
    }));
  }

  // ---- 任务 ----
  insertMission(m) {
    this.db.prepare(`INSERT OR REPLACE INTO missions
      (mission_id,created_at,type,grid_row,grid_col,disease,speed,swath,flow,dose,agent,
       algo,length_m,est_minutes,est_volume_l,eco_score,status,cell_ids)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(nz(m.missionId), nz(m.createdAt), nz(m.type), nz(m.target?.grid?.row),
        nz(m.target?.grid?.col), nz(m.disease),
        nz(m.spray?.speed), nz(m.spray?.swath), nz(m.spray?.flow),
        nz(m.spray?.dose), nz(m.spray?.agent),
        nz(m.plan?.algo), nz(m.plan?.length), nz(m.plan?.estMinutes),
        nz(m.plan?.estDose), nz(m.plan?.ecoScore),
        nz(m.status ?? 'pending'), JSON.stringify(m.target?.cells ?? []));
  }
  updateMissionStatus(missionId, status) {
    this.db.prepare(`UPDATE missions SET status=? WHERE mission_id=?`).run(status, missionId);
  }
  listMissions(limit = 200) {
    return this.db.prepare(`SELECT * FROM missions ORDER BY created_at DESC LIMIT ?`).all(limit).map(r => ({
      missionId: r.mission_id, createdAt: r.created_at, type: r.type,
      grid: { row: r.grid_row, col: r.grid_col }, disease: r.disease,
      spray: { speed: r.speed, swath: r.swath, flow: r.flow, dose: r.dose, agent: r.agent },
      plan: { algo: r.algo, length: r.length_m, estMinutes: r.est_minutes, estVolumeL: r.est_volume_l, ecoScore: r.eco_score },
      status: r.status, cells: JSON.parse(r.cell_ids || '[]'),
    }));
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
}
