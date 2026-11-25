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
import { FleetExecutor } from './fleet-executor.js';

export class Simulator {
  constructor({ field, onTelemetry, onDetection, onDevice, dt = 0.2, detectChance = null,
    onCommand, onMission, onUsage }) {
    this.field = field;
    this.onTelemetry = onTelemetry || (() => {});
    this.onDetection = onDetection || (() => {});
    this.onDevice = onDevice || (() => {});
    /** 受控执行层的回调（指令回执 / 作业单 / 用量） */
    this.onCommand = onCommand || (() => {});
    this.onMission = onMission || (() => {});
    this.onUsage = onUsage || (() => {});
    this.timer = null;
    this.seq = { 'UAV-01': 0, 'ROB-01': 0 };
    this.detSeq = 0;
    /** 外部接管标记：平台下发了受控作业指令时，暂停自主巡逻 */
    this.manualControl = false;

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
    /**
     * 受控执行的加速档位（1 = 实时）。
     *
     * 一趟靶向点喷要飞十几分钟，评审现场不能干等。
     * 加速是把「仿真时间」一次推进多个固定子步，
     * 电量、药耗、里程仍按真实经过的仿真时间计算 ——
     * 加速的是墙钟等待，不是物理量。
     *
     * 只作用于受控执行：自主巡逻的检出与遥测密度保持不变，
     * 否则云端 Durable Object 的免费额度会被打爆。
     */
    this.execSpeedFactor = 1;

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

    /* ================================================================
     * 受控执行层 —— 平台下发指令时由它驱动设备
     *
     * 与自主巡逻并存，不是二选一：
     *   · 没有指令时，设备按固定路线自主巡田（发现病灶、触发复核）
     *   · 平台下了作业指令，执行器接管对应设备，按平台给的航线执行
     *
     * 关键：执行器与自主逻辑**共用同一份设备状态与遥测序号**
     * （this.shared.dev / this.shared.seq），
     * 否则一台设备会同时发两路遥测、序号重号，
     * 链路的丢包率统计会把重号当成丢帧。
     * ================================================================ */
    this.shared = {
      'UAV-01': { dev: this.uav, seq: 0 },
      'ROB-01': { dev: this.robot, seq: 0 },
    };
    this.executors = {};
  }

  /** 取（或建）某台设备的执行器 */
  executorFor(deviceId) {
    if (this.executors[deviceId]) return this.executors[deviceId];
    const kind = deviceId.startsWith('UAV') ? 'uav' : 'robot';
    const dev = this.shared[deviceId]?.dev
      || (kind === 'uav' ? this.uav : this.robot);
    this.shared[deviceId] = { dev, seq: this.shared[deviceId]?.seq || 0 };
    const ex = new FleetExecutor({
      field: this.field,
      deviceId,
      deviceKind: kind,
      shared: this.shared[deviceId],
      // 受控执行期间的遥测也必须同步设备表 ——
      // 否则作业过程中 /fleet/status 拿到的还是作业前的旧位置，
      // 地图上的设备图标在无人机飞行时不会跟着动。
      onTelemetry: (t) => {
        this.onTelemetry(t, 20 + Math.random() * 60);
        const d = this.shared[deviceId]?.dev;
        if (d) this.syncDevice(d);
      },
      onDetection: (d) => this.onDetection(d),
      onCommand: (c) => this.onCommand(c),
      onMission: (m) => this.onMission(m),
      onUsage: (u) => this.onUsage(u),
    });
    this.executors[deviceId] = ex;
    return ex;
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

  /**
   * 接收平台下发的指令。
   *
   * 这是「平台能操控设备」的落点：指令进来 → 设备真的动起来。
   *
   * @param {object} cmd  { commandId, deviceId, type, payload, missionId }
   * @param {object} [plan] 作业方式指令需要先算好航线
   * @returns {{ok:boolean, reason?:string}}
   */
  receiveCommand(cmd, plan = null) {
    const ex = this.executorFor(cmd.deviceId);
    const r = ex.receive(cmd);
    // 作业方式指令：宿主已算好作业计划，这里才真正开始执行
    if (r.needsPlan && plan) {
      const started = ex.startOperation(cmd, plan);
      return { ok: true, command: started.command };
    }
    return r;
  }

  /** 导出可持久化状态（含执行层） */
  snapshot() {
    const execs = {};
    for (const [id, ex] of Object.entries(this.executors)) {
      execs[id] = ex.snapshot();
    }
    return {
      uav: { ...this.uav },
      robot: { ...this.robot },
      seq: { ...this.seq },
      execs,
    };
  }

  /**
   * 设置受控执行的加速档位。
   *
   * @param {number} factor 1 = 实时，10 / 60 / 300 = 加速
   * @returns {{ok:boolean, factor?:number, reason?:string}}
   */
  setExecSpeed(factor) {
    const f = Number(factor);
    if (!Number.isFinite(f) || f < 1 || f > 600) {
      return { ok: false, reason: '加速档位需在 1~600 之间' };
    }
    this.execSpeedFactor = f;
    return { ok: true, factor: f };
  }

  /**
   * 推进一拍。
   */
  tick() {
    const dt = this.dt; // 构造时指定，云端用 1s，本机用 0.2s
    // 受控执行优先：平台下了作业指令的设备由执行器驱动，
    // 自主巡逻只跑在「空闲」设备上，避免两个逻辑抢同一台设备的位置。
    //
    // 执行器只在「手上有指令」时才推进 —— 否则它会与自主逻辑各发一帧遥测，
    // 设备同一时刻出现两个位置，地图上的图标会来回跳。
    const uavEx = this.executors['UAV-01'];
    const robEx = this.executors['ROB-01'];
    const uavBusy = uavEx?.order != null;
    const robBusy = robEx?.order != null;
    try { if (!uavBusy) this.stepUav(dt); } catch (e) { logErr('stepUav', e); }
    try { if (!robBusy) this.stepRobot(dt); } catch (e) { logErr('stepRobot', e); }
    // 受控执行按加速档位推进：加速的是墙钟等待，物理量仍按仿真时间计
    const sub = this.execSpeedFactor > 1
      ? Math.round((dt * this.execSpeedFactor) / 0.2)
      : 1;
    try { if (uavBusy) uavEx.tick(dt, { subSteps: sub }); } catch (e) { logErr('execUav', e); }
    try { if (robBusy) robEx.tick(dt, { subSteps: sub }); } catch (e) { logErr('execRob', e); }
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
        // 该区块的「待复核」标记可以撤掉了：
        // 这一单已被机器人领走，同区块再有新疑点会重新派单。
        if (this.pendingRecheckKeys && r.target) {
          const tr = Math.floor(r.target.geo.y / this.field.cellH);
          const tc = Math.floor(r.target.geo.x / this.field.cellW);
          this.pendingRecheckKeys.delete(`${Math.floor(tr / 3)}_${Math.floor(tc / 3)}`);
        }
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
        // 开始执行的时刻 —— 执行段时延从此刻算起，不含排队等待
        r.target.startedAt = Date.now();
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
    // 序号统一由 shared.seq 分配：自主巡逻与受控执行共用同一条序列，
    // 否则两路遥测各自从 1 开始，链路统计会把重号当成丢帧。
    const sh = this.shared[d.deviceId] || (this.shared[d.deviceId] = { dev: d, seq: 0 });
    sh.seq = (sh.seq || 0) + 1;
    this.seq[d.deviceId] = sh.seq;
    const seq = sh.seq;
    this.onTelemetry({
      frameId: `F-${d.deviceId}-${seq}`,
      ts,
      seq,
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
    if (d) {
      // 把「机器人开始执行这一单的时刻」一并带上：
      // 云端据此区分「排队等待」与「实际执行」，执行段时延只算后者。
      d.recheckStartedAt = t.startedAt || Date.now();
      this.onDetection(d);
    }
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
    //
    // 地面复核**必须**出结果：
    //   机器人是被「空中发现了疑似病斑」派过去的，
    //   它到了目标点就是要看叶下/根茎 —— 这一趟必须有结论。
    //   若这里还按概率随机失败，平台会看到
    //   「派了单、机器人也到了、却什么都没回传」，
    //   派单事件永远闭不上，闭环完成率被无谓地拉低 ——
    //   这是平台自身的缺陷，不是真实的作业失败。
    //   所以地面复核一律出结果；置信度按接近程度给，偏低即表示「仍不确定」。
    if (kind === 'robot') {
      // 近距复核：置信度高于空中判读（离得近、看得清）
      const conf = +Math.min(0.99, 0.72 + best.strength * 0.2 + Math.random() * 0.06).toFixed(3);
      const row = Math.min(this.field.gridRows - 1, Math.max(0, Math.floor(y / this.field.cellH)));
      const col = Math.min(this.field.gridCols - 1, Math.max(0, Math.floor(x / this.field.cellW)));
      const disease = forceDisease
        || (['root_rot', 'fusarium'].includes(best.disease) ? best.disease : best.disease);
      return {
        detId: `D-${Date.now()}-${++this.detSeq}`,
        ts: Date.now(),
        deviceId: 'ROB-01',
        kind: 'robot',
        part: part || 'underside',
        disease,
        confidence: conf,
        bbox: { x: 120 + Math.random() * 400, y: 90 + Math.random() * 300, w: 40 + Math.random() * 90, h: 40 + Math.random() * 90 },
        geo: { x: +x.toFixed(2), y: +y.toFixed(2) },
        grid: { row, col },
        model: 'SAN-GAT-RL',
      };
    }
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
      // 同一**区块**只保留一单待复核：
      //   地面复核的作业范围本来就是目标格及其周边 3×3，
      //   同一区块内重复派单是重复劳动 ——
      //   会把机器人的复核队列撑爆，队列越长单越排不上，
      //   闭环完成率反而被拖低。
      //   区块步长与 shared/linkage.js 的 blockKey 一致（3）。
      const key = `${Math.floor(row / 3)}_${Math.floor(col / 3)}`;
      if (!this.pendingRecheckKeys) this.pendingRecheckKeys = new Set();
      if (!this.pendingRecheckKeys.has(key)) {
        this.pendingRecheckKeys.add(key);
        this.pendingRechecks.push({
          detId: det.detId, geo: det.geo, disease: det.disease, part: effectivePart,
          // 派单时刻：机器人真正开始执行这一单的时刻要单独记，
          // 否则「排队等待」会被算进「执行段时延」，
          // 平台上的实时性指标就会把排队误读成执行慢。
          dispatchedAt: Date.now(),
        });
      }
    }
    return det;
  }
}

function logErr(where, e) {
  // 本模块同时运行在 Node 服务端与浏览器中，process 可能不存在
  if (typeof process !== 'undefined' && process.env?.LOG === '0') return;
  console.error(`[sim:${where}]`, e.message);
}
