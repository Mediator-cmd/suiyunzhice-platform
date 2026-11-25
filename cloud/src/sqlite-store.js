/**
 * Durable Object SQLite 存储 —— 与 server/src/store.js 同形
 *
 * Cloudflare Durable Object 内置的 SQLite 是**同步** API，
 * 这正是本项目需要的：shared/analytics.js 对存储是同步调用
 * （`this.store.listDetections(500)` 直接拿数组用），
 * 而 D1 是异步的。DO 的同步 SQLite 让同一套业务代码零改动跑在云端。
 *
 * 与 node:sqlite 的 API 差异只有一处：
 *   node:sqlite  → db.prepare(sql).run/all/get(...params)
 *   DO SQLite    → sql.exec(sql, ...params) 返回游标
 * 这里把差异全部封在本文件内，对外暴露的方法名与签名与
 * server/src/store.js 完全一致。
 *
 * 另一处差异：DO 的 SQL 不支持 PRAGMA，因此建表时一次性写全所有列，
 * 不做「查询列再 ALTER」的增量迁移 —— 新表结构直接在这里演进。
 */

/** SQLite 不能绑定 undefined，统一转 null */
const nz = (v) => (v === undefined ? null : v);

/** JSON 安全解析 */
function jparse(s, fallback) {
  try { return JSON.parse(s); } catch { return fallback; }
}

export class SqliteStore {
  constructor(sql) {
    this.sql = sql;
  }

  /** 执行一条查询，返回行数组 */
  all(query, ...params) {
    const cur = this.sql.exec(query, ...params);
    return cur.toArray();
  }

  /**
   * 执行一条查询，返回第一行或 null。
   *
   * 注意语义差异：DO 的 cursor.one() 在没有结果时会**抛异常**
   * （"Expected exactly one result from SQL query, but got no results."），
   * 而 node:sqlite 的 get() 返回 undefined。
   * 这里统一成 node:sqlite 的语义（查不到返回 null），
   * 否则 getDeviceAccess 这类「查不到就返回 null」的调用在云端会崩。
   * 用 toArray()[0] 而不是 one()，正是为了避开这个抛异常行为。
   */
  get(query, ...params) {
    const cur = this.sql.exec(query, ...params);
    const rows = cur.toArray();
    return rows.length ? rows[0] : null;
  }

  /** 执行写入语句 */
  run(query, ...params) {
    this.sql.exec(query, ...params);
  }

  /** 建表（DO 不支持 PRAGMA，列一次写全） */
  async migrate() {
    this.run(`
      CREATE TABLE IF NOT EXISTS fields (
        id TEXT PRIMARY KEY, name TEXT, width_m REAL, height_m REAL,
        grid_rows INTEGER, grid_cols INTEGER, obstacles TEXT, area_ha REAL,
        tenant_id TEXT, owner_user_id TEXT, lat REAL, lon REAL
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
        gx REAL, gy REAL, grid_row INTEGER, grid_col INTEGER, model TEXT,
        image_url TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_det_ts ON detections(ts);
      CREATE TABLE IF NOT EXISTS missions (
        mission_id TEXT PRIMARY KEY, created_at INTEGER, type TEXT,
        grid_row INTEGER, grid_col INTEGER, disease TEXT,
        speed REAL, swath REAL, flow REAL, dose REAL, agent TEXT,
        algo TEXT, length_m REAL, est_minutes REAL, est_volume_l REAL,
        eco_score REAL, status TEXT, cell_ids TEXT,
        zone_id TEXT, zone_name TEXT, flow_per_speed REAL, duty_cycle REAL,
        saved_vs_uniform_l REAL, target_cells INTEGER, target_clusters INTEGER,
        target_area_ha REAL, target_coverage REAL, spill_area_ha REAL,
        zone_area_ha REAL, uniform_zone_l REAL, saved_vs_zone_l REAL,
        saved_ratio_vs_zone REAL
      );
      CREATE INDEX IF NOT EXISTS idx_mis_created ON missions(created_at);
      CREATE INDEX IF NOT EXISTS idx_mis_type ON missions(type);
      CREATE TABLE IF NOT EXISTS link_events (
        event_id TEXT PRIMARY KEY, ts INTEGER,
        trigger_device TEXT, trigger_kind TEXT, reason TEXT,
        chain TEXT, grid_row INTEGER, grid_col INTEGER, disease TEXT,
        sense_ms INTEGER, dispatch_ms INTEGER, act_ms INTEGER, total_ms INTEGER,
        closed INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_le_ts ON link_events(ts);
      CREATE TABLE IF NOT EXISTS sprays (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts INTEGER, mission_id TEXT, grid_row INTEGER, grid_col INTEGER,
        disease TEXT, volume_l REAL, dose REAL, speed REAL, agent TEXT
      );
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
        area_mu REAL, volume_l REAL, minutes REAL, sorties INTEGER,
        detections INTEGER, saved_l REAL, amount REAL
      );
      CREATE INDEX IF NOT EXISTS idx_usage_ts ON usage_records(ts);
    `);
  }

  // ---- 地块 ----
  upsertField(f) {
    this.run(`INSERT OR REPLACE INTO fields
      (id,name,width_m,height_m,grid_rows,grid_cols,obstacles,area_ha,tenant_id,owner_user_id,lat,lon)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      nz(f.id), nz(f.name), nz(f.widthM), nz(f.heightM),
      nz(f.gridRows), nz(f.gridCols),
      JSON.stringify(f.obstacles || []),
      nz(f.totalAreaHa?.() ?? (f.widthM * f.heightM) / 10000),
      nz(f.tenantId), nz(f.ownerUserId), nz(f.lat), nz(f.lon));
  }
  listFields() {
    return this.all(`SELECT * FROM fields`).map(r => ({
      id: r.id, name: r.name, widthM: r.width_m, heightM: r.height_m,
      gridRows: r.grid_rows, gridCols: r.grid_cols,
      obstacles: jparse(r.obstacles, []), areaHa: r.area_ha,
      tenantId: r.tenant_id ?? null, ownerUserId: r.owner_user_id ?? null,
      lat: r.lat ?? null, lon: r.lon ?? null,
    }));
  }
  getField(id) { return this.listFields().find(f => f.id === id); }

  // ---- 设备 ----
  upsertDevice(d) {
    this.run(`INSERT INTO devices
      (device_id,kind,name,state,x,y,z,batt,coverage,last_seen,online)
      VALUES (?,?,?,?,?,?,?,?,?,?,1)
      ON CONFLICT(device_id) DO UPDATE SET
        kind=excluded.kind, name=excluded.name, state=excluded.state,
        x=excluded.x, y=excluded.y, z=excluded.z, batt=excluded.batt,
        coverage=excluded.coverage, last_seen=excluded.last_seen, online=1`,
      nz(d.deviceId), nz(d.kind), nz(d.name || d.deviceId), nz(d.state),
      nz(d.pos?.x), nz(d.pos?.y), nz(d.pos?.z),
      nz(d.batt), nz(d.coverage), nz(d.lastSeen ?? Date.now()));
  }
  setDeviceOffline(deviceId) {
    this.run(`UPDATE devices SET online=0, state='offline' WHERE device_id=?`, deviceId);
  }
  listDevices() {
    return this.all(`SELECT * FROM devices ORDER BY device_id`).map(r => ({
      deviceId: r.device_id, kind: r.kind, name: r.name, state: r.state,
      pos: { x: r.x, y: r.y, z: r.z }, batt: r.batt, coverage: r.coverage,
      lastSeen: r.last_seen, online: !!r.online,
    }));
  }

  // ---- 遥测 ----
  insertTelemetry(t, latency) {
    this.run(`INSERT INTO telemetry
      (ts,device_id,kind,state,x,y,z,spd,hdg,batt,latency_ms,payload)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      nz(t.ts), nz(t.deviceId), nz(t.kind), nz(t.state),
      nz(t.pos?.x), nz(t.pos?.y), nz(t.pos?.z),
      nz(t.pos?.spd), nz(t.pos?.hdg), nz(t.batt),
      nz(latency), JSON.stringify(t.payload || {}));
  }
  /**
   * 裁剪过期的遥测数据。
   *
   * 遥测是高频表（2 台设备 × 1 Hz ≈ 每天 17 万行），
   * 不裁剪会持续占用存储，最终撞上免费额度。
   * 平台上真正用到的只有「最近一小时」——
   * 实时监控看曲线、链路质量看 P95 与丢包率，都用不到更早的数据。
   *
   * 本机版没有这个方法：本地 SQLite 文件不存在免费额度问题。
   */
  pruneTelemetry(keepMs) {
    const cutoff = Date.now() - keepMs;
    this.run(`DELETE FROM telemetry WHERE ts < ?`, cutoff);
  }

  /**
   * 删除指定时刻之前的联动事件（一次性清理用）。
   *
   * 用途：修复联动缺陷之前产生的联动事件，其时延与闭环状态是错的
   * （执行段时延把排队等待算了进去、待闭环事件互相覆盖导致永远闭不上）。
   * 这些事件会持续污染总览页的时延与闭环完成率，
   * 所以在部署修复后需要把旧数据清掉，让新数据用正确的口径重新累积。
   *
   * 播种的历史事件（LK-HIST- 前缀）不在清理范围内 ——
   * 它们由 shared/agroseed.js 确定性生成，数值本来就是对的。
   *
   * @param {number} beforeTs 只删除 ts 早于该时刻的事件
   * @returns {number} 删除行数
   */
  deleteLinkEventsBefore(beforeTs) {
    // DO 的 exec() 不返回受影响行数，先删再数还剩多少，
    // 差值就是删除量（只对这一次性清理有意义）。
    const before = this.all(`SELECT COUNT(*) AS n FROM link_events
      WHERE ts < ? AND event_id NOT LIKE 'LK-HIST-%'`, beforeTs)[0]?.n ?? 0;
    this.run(`DELETE FROM link_events WHERE ts < ? AND event_id NOT LIKE 'LK-HIST-%'`, beforeTs);
    return before;
  }
  recentTelemetry(limit = 200, deviceId = null) {
    // 与 server/src/store.js 同一条 SQL：取最近 N 条、按时间正序返回，
    // 并用 id 做第二排序键，避免同刻多帧的顺序在两端不一致。
    const sql = deviceId
      ? `SELECT * FROM (SELECT * FROM telemetry WHERE device_id=? ORDER BY ts DESC, id DESC LIMIT ?) ORDER BY ts ASC, id ASC`
      : `SELECT * FROM (SELECT * FROM telemetry ORDER BY ts DESC, id DESC LIMIT ?) ORDER BY ts ASC, id ASC`;
    const rows = deviceId
      ? this.all(sql, deviceId, limit)
      : this.all(sql, limit);
    return rows.map(r => ({
      ts: r.ts, deviceId: r.device_id, kind: r.kind, state: r.state,
      pos: { x: r.x, y: r.y, z: r.z, spd: r.spd, hdg: r.hdg },
      batt: r.batt, latencyMs: r.latency_ms, payload: jparse(r.payload, {}),
    }));
  }
  telemetryRange(fromTs, toTs) {
    return this.all(`SELECT * FROM telemetry WHERE ts BETWEEN ? AND ? ORDER BY ts`, fromTs, toTs)
      .map(r => ({
        ts: r.ts, deviceId: r.device_id, kind: r.kind, state: r.state,
        x: r.x, y: r.y, z: r.z, spd: r.spd, hdg: r.hdg, batt: r.batt, latencyMs: r.latency_ms,
      }));
  }

  // ---- 检测 ----
  insertDetection(d) {
    this.run(`INSERT OR REPLACE INTO detections
      (det_id,ts,device_id,kind,part,disease,confidence,bx,by,bw,bh,gx,gy,grid_row,grid_col,model,image_url)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      nz(d.detId), nz(d.ts), nz(d.deviceId), nz(d.kind), nz(d.part),
      nz(d.disease), nz(d.confidence),
      nz(d.bbox?.x), nz(d.bbox?.y), nz(d.bbox?.w), nz(d.bbox?.h),
      nz(d.geo?.x), nz(d.geo?.y), nz(d.grid?.row), nz(d.grid?.col),
      nz(d.model ?? 'SAN-GAT-RL'), nz(d.imageUrl));
  }
  listDetections(limit = 500) {
    return this.all(`SELECT * FROM detections ORDER BY ts DESC, det_id DESC LIMIT ?`, limit).map(r => ({
      detId: r.det_id, ts: r.ts, deviceId: r.device_id, kind: r.kind, part: r.part,
      disease: r.disease, confidence: r.confidence,
      bbox: { x: r.bx, y: r.by, w: r.bw, h: r.bh },
      geo: { x: r.gx, y: r.gy }, grid: { row: r.grid_row, col: r.grid_col },
      model: r.model, imageUrl: r.image_url,
    }));
  }

  // ---- 任务 ----
  insertMission(m) {
    this.run(`INSERT OR REPLACE INTO missions
      (mission_id,created_at,type,grid_row,grid_col,disease,speed,swath,flow,dose,agent,
       algo,length_m,est_minutes,est_volume_l,eco_score,status,cell_ids,
       zone_id,zone_name,flow_per_speed,duty_cycle,saved_vs_uniform_l,
       target_cells,target_clusters,target_area_ha,target_coverage,spill_area_ha,
       zone_area_ha,uniform_zone_l,saved_vs_zone_l,saved_ratio_vs_zone)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      nz(m.missionId), nz(m.createdAt), nz(m.type),
      nz(m.target?.grid?.row), nz(m.target?.grid?.col), nz(m.disease),
      nz(m.spray?.speed), nz(m.spray?.swath), nz(m.spray?.flow),
      nz(m.spray?.dose), nz(m.spray?.agent),
      nz(m.plan?.algo), nz(m.plan?.length), nz(m.plan?.estMinutes),
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
    this.run(`UPDATE missions SET status=? WHERE mission_id=?`, status, missionId);
  }
  listMissions(limit = 200) {
    return this.all(`SELECT * FROM missions ORDER BY created_at DESC, mission_id DESC LIMIT ?`, limit)
      .map(r => this._missionRow(r));
  }
  listMissionsByType(type, limit = 200) {
    return this.all(
      `SELECT * FROM missions WHERE type=? ORDER BY created_at DESC, mission_id DESC LIMIT ?`, type, limit)
      .map(r => this._missionRow(r));
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
      status: r.status, cells: jparse(r.cell_ids, []),
      zoneId: r.zone_id ?? r.zone_name?.match(/^([A-Z])/)?.[1] ?? null,
      zoneName: r.zone_name,
    };
  }

  // ---- 联动事件 ----
  insertLinkEvent(e) {
    this.run(`INSERT OR REPLACE INTO link_events
      (event_id,ts,trigger_device,trigger_kind,reason,chain,grid_row,grid_col,disease,
       sense_ms,dispatch_ms,act_ms,total_ms,closed)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      nz(e.eventId), nz(e.ts), nz(e.trigger.deviceId), nz(e.trigger.kind),
      nz(e.trigger.reason), JSON.stringify(e.chain),
      nz(e.grid?.row), nz(e.grid?.col), nz(e.disease),
      nz(e.latency.sense), nz(e.latency.dispatch), nz(e.latency.act),
      nz(e.latency.total), e.closed ? 1 : 0);
  }
  listLinkEvents(limit = 200) {
    return this.all(`SELECT * FROM link_events ORDER BY ts DESC, event_id DESC LIMIT ?`, limit).map(r => ({
      eventId: r.event_id, ts: r.ts,
      trigger: { deviceId: r.trigger_device, kind: r.trigger_kind, reason: r.reason },
      chain: jparse(r.chain, []),
      grid: { row: r.grid_row, col: r.grid_col }, disease: r.disease,
      latency: { sense: r.sense_ms, dispatch: r.dispatch_ms, act: r.act_ms, total: r.total_ms },
      closed: !!r.closed,
      pendingReason: r.closed ? null : '已派单复核，地面机器人尚未回传近距复核证据',
    }));
  }

  // ---- 施药记录 ----
  insertSpray(s) {
    this.run(`INSERT INTO sprays
      (ts,mission_id,grid_row,grid_col,disease,volume_l,dose,speed,agent)
      VALUES (?,?,?,?,?,?,?,?,?)`,
      nz(s.ts), nz(s.missionId), nz(s.grid?.row), nz(s.grid?.col),
      nz(s.disease), nz(s.volumeL), nz(s.dose), nz(s.speed), nz(s.agent));
  }

  // ---- 统计 ----
  countRows(table) {
    try { return this.get(`SELECT COUNT(*) c FROM ${table}`)?.c ?? 0; }
    catch { return 0; }
  }

  /* ================================================================
   * 平台底座：租户 / 成员 / 设备接入 / 指令 / 计量
   * ================================================================ */

  upsertTenant(t) {
    this.run(`INSERT OR REPLACE INTO tenants
      (tenant_id,name,type,contact,created_at) VALUES (?,?,?,?,?)`,
      nz(t.id || t.tenantId), nz(t.name), nz(t.type || 'farm'),
      nz(t.contact), nz(t.createdAt ?? Date.now()));
  }
  listTenants() {
    return this.all(`SELECT * FROM tenants ORDER BY created_at`).map(r => ({
      id: r.tenant_id, name: r.name, type: r.type, contact: r.contact, createdAt: r.created_at,
    }));
  }
  getTenant(id) { return this.listTenants().find(t => t.id === id) || null; }

  upsertMember(m) {
    this.run(`INSERT OR REPLACE INTO members
      (user_id,tenant_id,name,role,field_ids,created_at) VALUES (?,?,?,?,?,?)`,
      nz(m.userId), nz(m.tenantId), nz(m.name), nz(m.role),
      JSON.stringify(m.fieldIds || []), nz(m.createdAt ?? Date.now()));
  }
  listMembers(tenantId = null) {
    const rows = tenantId
      ? this.all(`SELECT * FROM members WHERE tenant_id=? ORDER BY created_at`, tenantId)
      : this.all(`SELECT * FROM members ORDER BY created_at`);
    return rows.map(r => ({
      userId: r.user_id, tenantId: r.tenant_id, name: r.name, role: r.role,
      fieldIds: jparse(r.field_ids, []), createdAt: r.created_at,
    }));
  }
  getMember(userId) {
    const r = this.get(`SELECT * FROM members WHERE user_id=?`, userId);
    if (!r) return null;
    return {
      userId: r.user_id, tenantId: r.tenant_id, name: r.name, role: r.role,
      fieldIds: jparse(r.field_ids, []), createdAt: r.created_at,
    };
  }

  upsertDeviceAccess(d) {
    this.run(`INSERT OR REPLACE INTO device_access
      (device_id,tenant_id,owner_user_id,kind,name,model,access_state,salt,registered_at,last_seen,online)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      nz(d.deviceId), nz(d.tenantId), nz(d.ownerUserId), nz(d.kind),
      nz(d.name), nz(d.model), nz(d.accessState), nz(d.salt),
      nz(d.registeredAt ?? Date.now()), nz(d.lastSeen ?? Date.now()),
      d.online ? 1 : 0);
  }
  listDeviceAccess() {
    return this.all(`SELECT * FROM device_access ORDER BY registered_at`).map(r => ({
      deviceId: r.device_id, tenantId: r.tenant_id, ownerUserId: r.owner_user_id,
      kind: r.kind, name: r.name, model: r.model, accessState: r.access_state,
      registeredAt: r.registered_at, lastSeen: r.last_seen, online: !!r.online,
    }));
  }
  getDeviceAccess(deviceId) {
    const r = this.get(`SELECT * FROM device_access WHERE device_id=?`, deviceId);
    if (!r) return null;
    return {
      deviceId: r.device_id, tenantId: r.tenant_id, ownerUserId: r.owner_user_id,
      kind: r.kind, name: r.name, model: r.model, accessState: r.access_state,
      salt: r.salt, registeredAt: r.registered_at, lastSeen: r.last_seen, online: !!r.online,
    };
  }
  setDeviceAccessState(deviceId, state) {
    this.run(`UPDATE device_access SET access_state=? WHERE device_id=?`, state, deviceId);
  }

  insertCommand(c) {
    this.run(`INSERT OR REPLACE INTO commands
      (command_id,device_id,tenant_id,type,mission_id,payload,state,issued_at,acked_at,done_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`,
      nz(c.commandId), nz(c.deviceId), nz(c.tenantId), nz(c.type),
      nz(c.missionId), JSON.stringify(c.payload || {}), nz(c.state),
      nz(c.issuedAt), nz(c.ackedAt), nz(c.doneAt));
  }
  listCommands(deviceId = null, limit = 200) {
    const rows = deviceId
      ? this.all(`SELECT * FROM commands WHERE device_id=? ORDER BY issued_at DESC, command_id DESC LIMIT ?`, deviceId, limit)
      : this.all(`SELECT * FROM commands ORDER BY issued_at DESC, command_id DESC LIMIT ?`, limit);
    return rows.map(r => ({
      commandId: r.command_id, deviceId: r.device_id, tenantId: r.tenant_id,
      type: r.type, missionId: r.mission_id, payload: jparse(r.payload, {}),
      state: r.state, issuedAt: r.issued_at, ackedAt: r.acked_at, doneAt: r.done_at,
    }));
  }

  insertUsage(u) {
    this.run(`INSERT INTO usage_records
      (ts,tenant_id,mission_id,type,area_mu,volume_l,minutes,sorties,detections,saved_l,amount)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      nz(u.ts ?? Date.now()), nz(u.tenantId), nz(u.missionId), nz(u.type),
      nz(u.areaMu), nz(u.volumeL), nz(u.minutes), nz(u.sorties ?? 0),
      nz(u.detections ?? 0), nz(u.savedL), nz(u.amount));
  }
  listUsage(tenantId = null, limit = 500) {
    const rows = tenantId
      ? this.all(`SELECT * FROM usage_records WHERE tenant_id=? ORDER BY ts DESC, id DESC LIMIT ?`, tenantId, limit)
      : this.all(`SELECT * FROM usage_records ORDER BY ts DESC, id DESC LIMIT ?`, limit);
    return rows.map(r => ({
      ts: r.ts, tenantId: r.tenant_id, missionId: r.mission_id, type: r.type,
      areaMu: r.area_mu, volumeL: r.volume_l, minutes: r.minutes,
      sorties: r.sorties, detections: r.detections, savedL: r.saved_l, amount: r.amount,
    }));
  }
}
