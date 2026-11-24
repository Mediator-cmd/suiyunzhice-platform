/**
 * 内置数据模拟器 —— 让平台在没有真实设备时也能完整演示
 *
 * 模拟两台设备：
 *   UAV-01  植保无人机   —— 按自动规划航线飞行，沿途采集并识别
 *   ROB-01  地面监测机器人 —— 接到复核派单后驶向目标网格，近距采集
 *
 * 模拟器刻意制造"真实感"：
 *   - 遥测按 5Hz 上报，带真实时延波动
 *   - 识别结果里混入低置信度样本，触发机器人复核派单
 *   - 电池随作业消耗，航时受限
 */

import { DISEASES, DEVICE_STATES } from './schema.js';

export class Simulator {
  constructor({ field, onTelemetry, onDetection, onDevice, dt = 0.2, detectChance = null }) {
    this.field = field;
    this.onTelemetry = onTelemetry || (() => {});
    this.onDetection = onDetection || (() => {});
    this.onDevice = onDevice || (() => {});
    this.timer = null;
    this.seq = { 'UAV-01': 0, 'ROB-01': 0 };
    this.detSeq = 0;

    /**
     * 每拍推进的模拟时长（秒）。
     *
     * 默认 0.2 是配合 200ms 的定时间隔 —— 本机版一直这么跑。
     * 云端受 Durable Object 的免费额度限制，只能每 15 秒唤醒一次，
     * 此时 dt 仍是 0.2 会让设备看起来慢放 75 倍（跨完一块地要几小时）。
     * 所以云端把 dt 调成 1，让「每拍推进 1 秒」与「每 15 秒醒一次」相配合：
     * 设备运动速度与真实一致，只是刷新频率低一些。
     */
    this.dt = dt;
    /**
     * 每次触发的检出概率。
     *
     * 默认按 dt 缩放（dt=0.2 时等于 0.16，行为与从前完全一致）。
     * 但云端不能这样缩放：云端 15 秒才醒一拍，缩放后概率会超过 1 ——
     * 每拍必检出，检出量反而暴涨。而 Durable Object 免费额度按行写入计，
     * 最耗额度的恰恰是检出与联动事件。
     * 所以云端显式传 detectChance，把它压到每拍一个小概率。
     */
    this.detectChance = detectChance ?? (0.16 * (dt / 0.2));
    /** 电量消耗按 dt 缩放，保持「每小时耗电多少」与真实一致。 */
    this.k = dt / 0.2;

    // 病害分布：几个病灶中心
    this.hotspots = [
      { row: 6, col: 12, strength: 0.9 },
      { row: 11, col: 24, strength: 0.7 },
      { row: 15, col: 8, strength: 0.5 },
      { row: 3, col: 31, strength: 0.45 },
    ];

    this.uav = {
      deviceId: 'UAV-01', name: '植保无人机 · 麦田一号',
      x: 10, y: 50, z: 2.0, hdg: 90, spd: 6, batt: 92,
      state: DEVICE_STATES.SURVEYING,
      line: 0, dir: 1, coverage: 0,
    };
    this.robot = {
      deviceId: 'ROB-01', name: '地面监测机器人 · 麦田一号',
      x: 5, y: 5, z: 0, hdg: 0, spd: 1.2, batt: 78,
      state: DEVICE_STATES.IDLE,
      target: null, coverage: 0,
    };
    this.pendingRechecks = [];
  }

  /**
   * 启动模拟器。
   *
   * @param {number} intervalMs 定时器间隔
   * @param {object} opts
   * @param {boolean} opts.manual 手动模式：不起定时器，改由外部调用 tick()。
   *        云端（Durable Object）必须用手动模式 —— Worker 里 setInterval
   *        不可靠（对象被驱逐就停），要用持久化的 alarm 驱动。
   * @param {object} opts.state 初始状态（用于从持久化存储恢复）
   */
  start(intervalMs = 200, opts = {}) {
    // 注册设备到设备表
    this.onDevice({
      deviceId: this.uav.deviceId, kind: 'uav', name: this.uav.name,
      state: this.uav.state, pos: { x: this.uav.x, y: this.uav.y, z: this.uav.z },
      batt: this.uav.batt, coverage: this.uav.coverage, lastSeen: Date.now(), online: true,
    });
    this.onDevice({
      deviceId: this.robot.deviceId, kind: 'robot', name: this.robot.name,
      state: this.robot.state, pos: { x: this.robot.x, y: this.robot.y, z: this.robot.z },
      batt: this.robot.batt, coverage: this.robot.coverage, lastSeen: Date.now(), online: true,
    });
    // 恢复上次的位置与电量（云端对象被驱逐后设备不该瞬移回起点）
    if (opts.state) {
      Object.assign(this.uav, opts.state.uav || {});
      Object.assign(this.robot, opts.state.robot || {});
      this.seq = { ...this.seq, ...(opts.state.seq || {}) };
    }
    if (!opts.manual) {
      this.timer = setInterval(() => this.tick(), intervalMs);
    }
    return this;
  }
  stop() { if (this.timer) clearInterval(this.timer); }

  /** 导出可持久化的状态（云端对象被驱逐后据此恢复） */
  snapshot() {
    return {
      uav: { ...this.uav },
      robot: { ...this.robot },
      seq: { ...this.seq },
    };
  }

  tick() {
    const dt = this.dt; // 构造时指定，云端用 1s，本机用 0.2s
    try { this.stepUav(dt); } catch (e) { logErr('stepUav', e); }
    try { this.stepRobot(dt); } catch (e) { logErr('stepRobot', e); }
  }

  stepUav(dt) {
    const u = this.uav;
    // 沿自动规划航线往返（简化：沿 X 方向，Y 方向每条航线换一行）
    const lineHeight = 5; // 网格 5m
    const maxY = this.field.heightM;
    u.x += u.dir * u.spd * dt;
    if (u.x > this.field.widthM - 5) { u.x = this.field.widthM - 5; u.dir = -1; u.line++; u.y += lineHeight; }
    if (u.x < 5) { u.x = 5; u.dir = 1; u.line++; u.y += lineHeight; }
    if (u.y >= maxY) {
      // 一轮巡田结束，转为喷洒状态再重开
      u.state = DEVICE_STATES.SPRAYING;
      u.y = 50; u.x = 10; u.dir = 1; u.line = 0;
      u.coverage = 0;
    }
    u.batt = Math.max(15, u.batt - 0.012 * this.k);
    u.coverage = Math.min(1, (u.line * lineHeight) / maxY);

    this.emitTelemetry(u);
    this.syncDevice(u);

    // 沿途识别：按概率产生检测结果
    if (Math.random() < this.detectChance) this.emitDetection(u);
  }

  stepRobot(dt) {
    const r = this.robot;
    if (r.state === DEVICE_STATES.IDLE) {
      // 等待派单
      if (this.pendingRechecks.length && Math.random() < 0.5) {
        r.target = this.pendingRechecks.shift();
        r.state = DEVICE_STATES.RECHECKING;
      }
    } else if (r.state === DEVICE_STATES.RECHECKING) {
      // 驶向目标
      const tx = r.target.geo.x, ty = r.target.geo.y;
      const dx = tx - r.x, dy = ty - r.y;
      const d = Math.hypot(dx, dy);
      if (d < 1.2) {
        r.state = DEVICE_STATES.SURVEYING;   // 到位，开始近距采集
        r.collectT = 0;
      } else {
        r.x += (dx / d) * r.spd * dt;
        r.y += (dy / d) * r.spd * dt;
        r.hdg = (Math.atan2(dx, dy) * 180 / Math.PI + 360) % 360;
      }
    } else if (r.state === DEVICE_STATES.SURVEYING) {
      r.collectT = (r.collectT || 0) + dt;
      r.batt = Math.max(10, r.batt - 0.008 * this.k);
      if (r.collectT > 3) {
        // 采集完成，回传近距识别结果
        this.emitRobotDetection(r);
        r.state = DEVICE_STATES.IDLE;
        r.target = null;
      }
    }
    this.emitTelemetry(r);
    this.syncDevice(r);
  }

  /** 把设备当前状态同步到设备表，供「设备状态」面板读取 */
  syncDevice(d) {
    this.onDevice({
      deviceId: d.deviceId, kind: d.deviceId.startsWith('UAV') ? 'uav' : 'robot',
      name: d.name, state: d.state,
      pos: { x: +d.x.toFixed(2), y: +d.y.toFixed(2), z: +d.z.toFixed(2) },
      batt: +d.batt.toFixed(1), coverage: d.coverage,
      lastSeen: Date.now(), online: true,
    });
  }

  emitTelemetry(d) {
    const ts = Date.now();
    this.seq[d.deviceId] = (this.seq[d.deviceId] || 0) + 1;
    this.onTelemetry({
      frameId: `F-${d.deviceId}-${this.seq[d.deviceId]}`,
      ts,
      seq: this.seq[d.deviceId],
      deviceId: d.deviceId,
      kind: d.deviceId.startsWith('UAV') ? 'uav' : 'robot',
      name: d.name,
      state: d.state,
      pos: { x: +d.x.toFixed(2), y: +d.y.toFixed(2), z: +d.z.toFixed(2), alt: +d.z.toFixed(2), spd: +d.spd.toFixed(2), hdg: +d.hdg.toFixed(1) },
      batt: +d.batt.toFixed(1),
      payload: d.deviceId.startsWith('UAV')
        ? { waterL: 5, flowLmin: 1.44, swathM: 1.0, camera: '可见光+多光谱' }
        : { camera: '近距可见光', arm: '叶下/根茎/土壤三工位' },
      coverage: +d.coverage.toFixed(3),
    }, 20 + Math.random() * 60);
  }

  emitDetection(u) {
    const d = this.detectAt(u.x, u.y, 'canopy', 'uav');
    if (d) this.onDetection(d);
  }

  emitRobotDetection(r) {
    const t = r.target;
    const d = this.detectAt(t.geo.x, t.geo.y, t.part || 'underside', 'robot', t.disease);
    if (d) this.onDetection(d);
  }

  detectAt(x, y, part, kind, forceDisease = null) {
    // 找最近病灶中心
    let best = null, bestDist = 1e9;
    for (const h of this.hotspots) {
      const c = this.field.cellCenter(h.row, h.col);
      const dist = Math.hypot(c.x - x, c.y - y);
      if (dist < bestDist) { bestDist = dist; best = h; }
    }
    // 距病灶越近，检出概率越高
    const prob = Math.max(0, best.strength - bestDist / 60);
    if (Math.random() > prob) return null;

    const row = Math.min(this.field.gridRows - 1, Math.max(0, Math.floor(y / this.field.cellH)));
    const col = Math.min(this.field.gridCols - 1, Math.max(0, Math.floor(x / this.field.cellW)));

    // 病种：靠近赤霉/根腐（需要近地复核）概率更高
    const needsGround = ['root_rot', 'fusarium'];
    let disease = forceDisease;
    if (!disease) {
      const pool = needsGround.filter(d => Math.random() < 0.35);
      disease = pool.length ? pool[Math.floor(Math.random() * pool.length)]
        : DISEASES[Math.floor(Math.random() * 4)].code;
    }

    // 空中看不清叶下/根茎 → 这些部位标记为需复核
    const effectivePart = kind === 'uav' && needsGround.includes(disease) ? 'stem' : part;

    // 置信度：近病灶高、远低；部分样本刻意偏低触发复核
    const base = Math.min(0.98, 0.55 + best.strength * 0.35 + (60 - bestDist) / 300);
    const confidence = +(Math.random() < 0.3 ? base * (0.55 + Math.random() * 0.25) : base).toFixed(3);

    const det = {
      detId: `D-${Date.now()}-${++this.detSeq}`,
      ts: Date.now(),
      deviceId: kind === 'uav' ? 'UAV-01' : 'ROB-01',
      kind,
      part: effectivePart,
      disease,
      confidence,
      bbox: { x: 120 + Math.random() * 400, y: 90 + Math.random() * 300, w: 40 + Math.random() * 90, h: 40 + Math.random() * 90 },
      geo: { x: +x.toFixed(2), y: +y.toFixed(2) },
      grid: { row, col },
      model: 'SAN-GAT-RL',
    };

    // 需要近地复核 → 派单给机器人
    if (kind === 'uav' && (confidence < 0.75 || ['stem', 'underside', 'soil'].includes(effectivePart))) {
      this.pendingRechecks.push({
        detId: det.detId, geo: det.geo, disease: det.disease, part: effectivePart,
      });
    }
    return det;
  }
}

function logErr(where, e) {
  // 本模块同时运行在 Node 服务端与浏览器中，process 可能不存在
  if (typeof process !== 'undefined' && process.env?.LOG === '0') return;
  console.error(`[sim:${where}]`, e.message);
}
