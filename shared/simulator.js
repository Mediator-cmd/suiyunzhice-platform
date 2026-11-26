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

import { DEVICE_STATES } from './schema.js';
import { FleetExecutor } from './fleet-executor.js';
import {
  workingPoint, detectOccurs, sampleConfidence,
  patchMissProbability, falsePositiveRatio,
} from './detectionmodel.js';

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
    /**
     * 斑块级漏检判定缓存。
     *
     * 每一片病灶「是否被整体漏掉」只摇一次 —— 摇定之后，这片在本次运行里
     * 就一直是「看不见的」。每次扫描都重摇的话，漏检会时有时无，
     * 平台看到的是「偶发漏检」而不是「一片病没被发现」，
     * 而后者才是先确认再喷这套策略真正要解决的情况。
     *
     * key：病灶的 row_col
     * value：true = 这片被漏掉了
     */
    this.patchMissCache = new Map();
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
    //
    // 纪律：**病灶中心必须落在可作业区**，且 5×5 邻域内不得有障碍。
    //
    // 之前 (3,31) 落在「灌溉水渠」里、(15,8) 紧贴「地头房舍」，
    // 检测在障碍格上照样报出病害 —— 物理上荒谬（病害长在水渠里？），
    // 实务上更糟：那些格飞不进去，协同规划只能把它们剔除，
    // 云端实测每次规划有 5 个「非法格」被丢掉，答辩现场像是在漏作业。
    //
    // 修法：位置选在空地，并用 relocateHotspots() 兜底 ——
    // 以后改障碍配置也不必再手工核这一遍。
    //
    // 每片病灶带三个字段：
    //   disease    病种（决定用哪一组检测工作点）
    //   strength   严重度 [0,1]
    //   targets    这片里的目标数 —— 斑块级漏检概率的输入。
    //
    // targets 的量级取自队友实验的真实分布（data/fields/*.npz，
    // 三个病种 18 地块共 283 个斑块）：
    //   P5 = 84，P25 = 832，中位 = 1396，P95 = 4233
    // 注意这个量级 —— 它直接决定了下面「斑块级漏检」的机制
    // 在什么情况下才会触发（见 detectionmodel.js 的说明）。
    this.hotspots = this.relocateHotspots([
      { row: 6, col: 12, strength: 0.9, disease: 'rust', targets: 2160 },
      { row: 11, col: 24, strength: 0.7, disease: 'fusarium', targets: 840 },
      { row: 15, col: 8, strength: 0.5, disease: 'leaf_blight', targets: 234 },
      { row: 3, col: 31, strength: 0.45, disease: 'powdery', targets: 84 },
    ]);

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
    const prevX = u.x, prevY = u.y;
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

    // 沿途识别。
    //
    // 这里**不能**只取飞机当前位置一个点。
    // 云端一拍是 15 秒仿真时间，无人机以 6 m/s 飞过 **90 m**，
    // 单点取样等于「飞了 90 m，只在落点抽了一次」——
    // 采到的点几乎随机落在背景区或病灶区，
    // 于是两个后果：
    //   · 检出量与航线覆盖无关（飞没飞过那片田都一样）
    //   · 误检几乎不出现（背景点虽多，但真检出基数小，配额发不出去）
    //
    // 正确做法：沿这一拍飞过的**整段航线**等间距取样，
    // 每个采样点独立走检测器工作点判定。
    // 节流仍在（每拍只扫一次），但采样覆盖的是实际飞过的路径。
    this.scanSegment(prevX, prevY, u.x, u.y);
  }

  /**
   * 沿一段航线等间距取样，逐点判定检出。
   *
   * 节流方式：**调节采样密度，而不是丢弃整段**。
   *
   * 早前这里写成「按 detectChance 决定这一段扫不扫」——
   * 于是 84% 的航段完全不被采样，飞机明明飞过了那片田，
   * 平台却一次检出都没有。这不是节流，是漏扫：
   * 云端一拍飞 90 m，漏掉 84% 的航段意味着大部分田块从未被看过，
   * 派单量随缘，闭环数据也就失去意义。
   *
   * 现在改成：每一段都扫，采样点间距随 detectChance 变粗
   * （detectChance 越小 → 采样越稀 → 产出越少，额度压力不变）。
   * 覆盖完整，产出可控。
   *
   * @param {number} x0 起点 x
   * @param {number} y0 起点 y
   * @param {number} x1 终点 x
   * @param {number} y1 终点 y
   */
  scanSegment(x0, y0, x1, y1) {
    const len = Math.hypot(x1 - x0, y1 - y0);
    // 采样间距 = 5 m（一个网格）× 密度倒数
    // detectChance=1 → 5 m 一个点；detectChance=0.16 → 约 31 m 一个点
    const spacing = 5 / Math.max(0.05, this.detectChance);
    const n = Math.max(1, Math.min(30, Math.round(len / spacing)));
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const x = x0 + (x1 - x0) * t;
      const y = y0 + (y1 - y0) * t;
      this.emitDetectionAt(x, y, 'canopy', 'uav');
    }
  }

  /**
   * 记录「这个格的这个病种已经报过了」。
   *
   * 航线连续扫描时，相邻采样点落在同一个格里是常事；
   * 不去重的话，同一片病害会被反复报出，
   // 派单量与检出量都会虚高。
   *
   * 去重键：病种 + 格（row_col）。
   * 误检不去重 —— 误检本来就该发生在不同位置，
   * 而且它的数量本就该按 Poisson 配额来，不该被去重压掉。
   */
  markReported(det) {
    if (!this.reportedKeys) this.reportedKeys = new Set();
    const key = `${det.disease}_${det.grid.row}_${det.grid.col}`;
    if (this.reportedKeys.has(key)) return false;
    this.reportedKeys.add(key);
    return true;
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
        // 单步位移必须按剩余距离截断。
        //
        // 云端一拍 15 秒，机器人 1.2 m/s → 每步最多走 18 m。
        // 若目标只剩 4.7 m 还照走 18 m，就会跨过目标，
        // 下一拍又朝回走 18 m —— 在目标两侧来回震荡，
        // 永远进不了 1.2 m 的到位判定。
        // 实测：机器人在距目标 4.7 m 处卡死 30 拍，
        // 复核一单都没完成，队列无限堆积。
        const step = Math.min(r.spd * dt, d);
        r.x += (dx / d) * step;
        r.y += (dy / d) * step;
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
    this.emitDetectionAt(u.x, u.y, 'canopy', 'uav');
  }

  /** 单点检出并上报（真检出按格去重，误检不去重） */
  emitDetectionAt(x, y, part, kind) {
    const d = this.detectAt(x, y, part, kind);
    if (!d) return null;
    // 去重放在上报这一层 —— 无论调用方是谁（航线扫描 / 定点采集），
    // 同一格同一病种只报一次，规则才是一致的。
    if (!d.falsePositive && !this.markReported(d)) return null;
    this.onDetection(d);
    return d;
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

  /**
   * 病灶中心合法性检查与就近挪移。
   *
   * 判据（两条都要满足）：
   *   ① 中心格本身不落在障碍上；
   *   ② 中心周围 5×5 邻域内没有障碍格 ——
   *      因为检出是按设备位置落格的，病灶中心附近一圈都会出检出，
   *      邻域里有障碍就意味着又会在障碍格上报出病害。
   *
   * 不满足时按「先横后竖、逐格外扩」的顺序找最近的合法位置。
   * 找不到就退回原位（宁可保留一个已知问题，也不要静默丢掉一个病灶）。
   */
  relocateHotspots(hotspots) {
    const f = this.field;
    const blocked = (r, c) => {
      if (r < 0 || r >= f.gridRows || c < 0 || c >= f.gridCols) return true;
      for (const o of f.obstacles) {
        const c0 = Math.floor(o.x / f.cellW), c1 = Math.ceil((o.x + o.w) / f.cellW);
        const r0 = Math.floor(o.y / f.cellH), r1 = Math.ceil((o.y + o.h) / f.cellH);
        if (r >= r0 && r < r1 && c >= c0 && c < c1) return true;
      }
      return false;
    };
    const neighborhoodClean = (r, c) => {
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) if (blocked(r + dr, c + dc)) return false;
      }
      return true;
    };
    return hotspots.map(h => {
      if (!blocked(h.row, h.col) && neighborhoodClean(h.row, h.col)) return h;
      for (let d = 1; d < Math.max(f.gridRows, f.gridCols); d++) {
        for (let dr = -d; dr <= d; dr++) {
          for (let dc = -d; dc <= d; dc++) {
            // 只看当前外扩环
            if (Math.max(Math.abs(dr), Math.abs(dc)) !== d) continue;
            const r = h.row + dr, c = h.col + dc;
            if (!blocked(r, c) && neighborhoodClean(r, c)) {
              return { ...h, row: r, col: c };
            }
          }
        }
      }
      return h;
    });
  }

  /**
   * 发放一次误检机会。
   *
   * 配额按 Poisson 期望累积：
   *   期望误检数 = 真检出数 × fpRatio × 0.35
   *   fpRatio = (1 − precision) / precision
   *
   * 做法：维护「已发放的误检数」与「按期望应发放的数」两个计数，
   * 只有当已发放数 < 应发放数时才真正放行。
   * 这与队友 detection_map.py 的 Poisson 采样同量级，
   * 但不引入随机方差 —— 平台的演示数据需要稳定可复现。
   *
   * @returns {boolean} true = 本次放行一次误检
   */
  consumeFalsePositiveSlot(precision) {
    const fpRatio = falsePositiveRatio(precision);
    const hits = this.expectedTrueHits || 0;
    // 期望误检数 = 格级真检出数 × fpRatio × 0.35（与队友 Poisson 模型同口径）
    const expected = hits * fpRatio * 0.35;
    this.falsePositiveIssued = this.falsePositiveIssued || 0;
    // 下限 1：真检出已经攒到一定量时，至少放行一次误检。
    //
    // 为什么需要下限：云端采样密度约 31 m/点，而病灶影响半径只有 ~7 m，
    // 采样点大多落在病灶附近，背景区很少被采到 ——
    // 于是「期望误检数」虽然有 5 次，但没人去背景区领这个配额，
    // 误检就一次都不出现，平台看不到「派了单却是假警报」的代价。
    //
    // 队友模型里 n_fp 是 Poisson 采样，期望为 5 时几乎必然至少出现 1 次；
    // 确定性实现要还原这个性质，就不能只按「领配额」的方式发。
    const quota = Math.max(expected, hits >= 8 ? 1 : 0);
    if (this.falsePositiveIssued >= quota) return false;
    this.falsePositiveIssued++;
    return true;
  }

  /**
   * 这片病灶本次运行中是否被整体漏掉。
   *
   * 判定只摇一次并缓存 —— 摇定之后这片就一直「看不见」。
   * 概率取自队友模型：p_miss = (1 − recall·0.85)^n_targets
   *
   * @returns {boolean} true = 被漏掉
   */
  patchDetectable(hotspot, wp) {
    const key = `${hotspot.row}_${hotspot.col}`;
    if (!this.patchMissCache.has(key)) {
      const pMiss = patchMissProbability(wp.recall, hotspot.targets || 1);
      this.patchMissCache.set(key, Math.random() < pMiss);
    }
    return !this.patchMissCache.get(key);
  }

  /**
   * 构造一次误检（背景误报）。
   *
   * 误报落在健康区域 —— 权重 w = 1 − 0.7·severity，
   * 即越健康的地方越容易误报。这里用「离最近病灶的距离」近似健康度：
   * 离病灶越远越可能是背景。
   *
   * 误检会真的走完后面的流程 —— 派单、复核、施药 ——
   * 所以它在平台里表现为「查出来不是病害、白跑一趟」，
   * 这正是误检的真实代价。
   */
  makeFalsePositive(x, y, part, kind, disease) {
    const row = Math.min(this.field.gridRows - 1, Math.max(0, Math.floor(y / this.field.cellH)));
    const col = Math.min(this.field.gridCols - 1, Math.max(0, Math.floor(x / this.field.cellW)));
    // 误报的置信度普遍不高 —— 高置信度误报是少数，正是它们最伤
    const confidence = +(0.30 + Math.random() * 0.35).toFixed(3);
    return {
      detId: `D-${Date.now()}-${++this.detSeq}`,
      ts: Date.now(),
      deviceId: kind === 'uav' ? 'UAV-01' : 'ROB-01',
      kind,
      part: part || 'leaf',
      disease,
      confidence,
      bbox: { x: 120 + Math.random() * 400, y: 90 + Math.random() * 300, w: 40 + Math.random() * 90, h: 40 + Math.random() * 90 },
      geo: { x: +x.toFixed(2), y: +y.toFixed(2) },
      grid: { row, col },
      model: 'SAN-GAT-RL',
      falsePositive: true,
    };
  }

  detectAt(x, y, part, kind, forceDisease = null) {
    // 找最近病灶中心
    let best = null, bestDist = 1e9;
    for (const h of this.hotspots) {
      const c = this.field.cellCenter(h.row, h.col);
      const dist = Math.hypot(c.x - x, c.y - y);
      if (dist < bestDist) { bestDist = dist; best = h; }
    }
    if (!best) return null;

    const disease = forceDisease || best.disease || 'rust';
    const wp = workingPoint(disease);
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

    // ---- 空中检出：按检测器工作点判定，而不是「离得近就检得出」----
    //
    // 三个机制（与队友 code/detection_map.py 对齐）：
    //   ① 斑块级漏检：整片病灶的目标全漏 → 这片直接没了
    //   ② 单目标检出概率随严重度上升（早期症状难发现）
    //   ③ 背景误检：健康处也会有误报，会变成真实的误喷
    //
    // 没有①的话平台永远看不到「一片病害没被发现」，
    // 没有③的话平台永远看不到「派了单却不是病害」的返工。
    const patchOk = this.patchDetectable(best, wp);
    if (!patchOk) return null;

    // 采样点必须落在这片病灶的影响范围内。
    //
    // 这里刻意**不**把「距离」乘进检出概率 ——
    // 队友的模型是格级的：检出概率只由该格的严重度决定
    // （p_det = recall · (0.15 + 0.85·σ(6(sev−0.22)))），
    // 因为「严重度」本身已经编码了「这片有多明显」。
    // 若再乘一个距离因子，等于把同一个量算了两次，
    // 结果是离病灶稍远就几乎检不出（实测采样 4000 点零检出）。
    //
    // 位置只该决定「有没有采到这个格」，不该决定「采到了能不能检出」。
    const reach = 10 + best.strength * 14;   // 4.5~7 m，随严重度
    if (bestDist > reach) {
      // 落在背景区 —— 这里才可能出**误检**。
      //
      // 误检按**计数**给出，而不是每次采样独立摇一次：
      //   误检数 ~ Poisson(真检出数 × fpRatio × 0.35)
      // 这与队友 detection_map.py 一致（那里也是 Poisson 采样）。
      //
      // 若改成「每次采样独立判定」，误检占比会随采样密度漂移 ——
      // 扫得越密，背景区的采样点越多，误检占比越高，
      // 最后会离谱到「每三条检出有一条是假的」。
      // 计数式的量级只跟真检出数挂钩，与采样密度无关。
      if (this.consumeFalsePositiveSlot(wp.precision)) {
        return this.makeFalsePositive(x, y, part, kind, disease);
      }
      return null;
    }

    if (!detectOccurs(wp.recall, best.strength, Math.random)) return null;
    // 工作点检出计数 —— 误检配额的基数。
    //
    // 口径说明：这里计的是**格级**真检出（同一格同一病种只计一次），
    // 与队友 detection_map.py 的「检测地图」同口径 ——
    // 他的模型是格级的，每格各自决定检不检出，误检数是
    // Poisson(格级真检出期望 × fpRatio × 0.35)。
    //
    // 之前这里计的是「判为检出的次数」（含重复采样），
    // 而上报时又按格去重，两者口径不一致 ——
    // 结果误检占比被推到 46%，比设计值 35% 高出一截。
    // 统一到格级后，误检占比才会落在真实量级上。
    const row = Math.min(this.field.gridRows - 1, Math.max(0, Math.floor(y / this.field.cellH)));
    const col = Math.min(this.field.gridCols - 1, Math.max(0, Math.floor(x / this.field.cellW)));
    const gridKey = `${disease}_${row}_${col}`;
    if (!this.trueHitGrids) this.trueHitGrids = new Set();
    if (!this.trueHitGrids.has(gridKey)) {
      this.trueHitGrids.add(gridKey);
      this.expectedTrueHits = (this.expectedTrueHits || 0) + 1;
    }

    // 病种由病灶本身决定 —— 必须与上面取工作点用的是同一个病种，
    // 否则「按 A 病种的工作点判定、按 B 病种派单」，口径就脱节了。
    // 需要近地复核的病种：根茎部与穗部潜藏，空中看不清。
    const needsGround = ['root_rot', 'fusarium', 'loose_smut'];

    // 空中看不清叶下/根茎 → 这些部位标记为需复核
    const effectivePart = kind === 'uav' && needsGround.includes(disease) ? 'stem' : part;

    // 置信度：按该病种的检测工作点抽样。
    //   高置信度（≥0.75）的比例 = 精确率 —— 这部分直接派单；
    //   低置信度的部分 = 漏掉的真阳性 + 一部分误检，会转地面复核。
    //   这样平台的派单量直接受检测器工作点约束，
    //   而不是「只要飞过就一定派单」。
    const confidence = sampleConfidence(wp.precision, Math.random);

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
