/**
 * 虚拟装备执行层 —— 让平台下发的指令真的被执行
 *
 * 定位：
 *   shared/simulator.js 负责「设备在跑」，但它只跑固定巡逻航线，
 *   平台下发的指令没人接 —— 界面点下去没有任何反应。
 *   本模块补上缺失的那一环：把指令变成设备的真实动作，
 *   并产出遥测帧、识别结果与指令回执。
 *
 * 与 simulator.js 的关系：
 *   simulator.js 是「自主巡田」的行为（自主发现病灶、自主巡逻）
 *   fleet-executor 是「受控执行」的行为（听平台指挥，去指定位置、做指定事）
 *   两者共用同一份设备状态与遥测产出，因此同一个设备在平台上是连续的，
 *   不是两个互不相干的动画。
 *
 * 纪律：
 *   - 纯 JS，不碰任何 I/O（不读文件、不发网络）
 *   - 事件通过回调交给宿主（服务端 / 浏览器）落库与广播
 */

import { DEVICE_STATES } from './schema.js';
import {
  operationMode, directCommand, validateCommand, buildOperationPlan,
  stepOrder, applyOrderAck, ORDER_STATE, MISSION_STATUS,
  UAV_HOME, ROBOT_HOME,
} from './fleet.js';

/**
 * 一台虚拟装备的执行状态。
 *
 * 同时服务无人机与地面机器人 —— 两者都靠 order（当前指令）驱动，
 * 只是路径与运动学参数不同。
 */
export class FleetExecutor {
  /**
   * @param {object} opts
   * @param {Field}  opts.field
   * @param {string} opts.deviceId
   * @param {string} opts.deviceKind  uav | robot
   * @param {function} opts.onTelemetry  (telemetry) => void
   * @param {function} opts.onDetection  (detection) => void
   * @param {function} opts.onCommand    (command) => void
   * @param {function} [opts.onMission]  (mission) => void
   * @param {function} [opts.onUsage]    (usage) => void
   * @param {object}  [opts.state]      初始状态（从持久化存储恢复）
   */
  constructor(opts) {
    this.field = opts.field;
    this.deviceId = opts.deviceId;
    this.deviceKind = opts.deviceKind;
    this.onTelemetry = opts.onTelemetry || (() => {});
    this.onDetection = opts.onDetection || (() => {});
    this.onCommand = opts.onCommand || (() => {});
    this.onMission = opts.onMission || (() => {});
    this.onUsage = opts.onUsage || (() => {});
    /** 共享的设备状态与遥测序号 —— 与 simulator.js 共用同一份，避免双发遥测 */
    this.shared = opts.shared || {};

    this.detSeq = 0;
    /** 当前正在执行的指令执行体 */
    this.order = null;
    /** 暂停前的执行体（供「继续」指令恢复） */
    this.savedOrder = null;
    /** 已下达但尚未开始的指令队列 */
    this.queue = [];
    /** 执行历史 */
    this.history = [];

    if (!this.shared.dev) {
      this.shared.dev = {
        x: this.deviceKind === 'uav' ? UAV_HOME.x : ROBOT_HOME.x,
        y: this.deviceKind === 'uav' ? UAV_HOME.y : ROBOT_HOME.y,
        z: 0,
        hdg: 0,
        spd: 0,
        batt: this.deviceKind === 'uav' ? 92 : 78,
        state: DEVICE_STATES.IDLE,
      };
    }
    this.dev = this.shared.dev;

    if (opts.state) {
      Object.assign(this.dev, opts.state.dev || {});
      this.queue = opts.state.queue || [];
      if (opts.state.order) this.order = this.restoreOrder(opts.state.order);
      if (opts.state.savedOrder) this.savedOrder = this.restoreOrder(opts.state.savedOrder);
    }
  }

  /** 导出可持久化状态 */
  snapshot() {
    return {
      dev: { ...this.dev },
      queue: this.queue,
      order: this.order ? JSON.parse(JSON.stringify(this.order)) : null,
      savedOrder: this.savedOrder ? JSON.parse(JSON.stringify(this.savedOrder)) : null,
    };
  }

  /** 恢复执行体（对象方法丢失，用 Object.assign 补回） */
  restoreOrder(o) {
    if (!o) return null;
    return Object.assign({
      phase: 'transit', progress: 0, elapsedSec: 0,
      path: [], targetCells: [], spray: null,
      speedMs: 6, spdMs: 2.4, home: UAV_HOME,
      volumeL: 0, sprayedAreaHa: 0, sprayDistanceM: 0, distanceM: 0,
    }, o);
  }

  /* ================================================================
   * 指令下发入口
   * ================================================================ */

  /**
   * 接收平台下发的指令。
   *
   * @param {object} cmd  指令对象 { commandId, deviceId, type, payload, missionId }
   * @returns {{ok:boolean, reason?:string, command?:object}}
   */
  receive(cmd) {
    const check = validateCommand({
      type: cmd?.type, deviceId: cmd?.deviceId, deviceKind: this.deviceKind,
    });
    if (!check.ok) {
      const failed = applyOrderAck(
        { ...cmd, state: ORDER_STATE.failed }, ORDER_STATE.failed, Date.now());
      this.onCommand(failed);
      return { ok: false, reason: check.reason, command: failed };
    }

    // 记住原始指令字段，回执要原样带回（存储层是 INSERT OR REPLACE）
    this.lastCmd = { ...cmd };

    // ---- 直接指令：立刻改变设备状态 ----
    const direct = directCommand(cmd.type);
    if (direct) {
      const applied = this.applyDirect(direct, cmd);
      return applied;
    }

    // ---- 作业方式：需要构建航线，交给宿主处理（要读识别结果） ----
    return { ok: true, needsPlan: true, command: cmd };
  }

  /**
   * 结束当前正在执行的指令（被新指令取代时调用）。
   *
   * 「起飞」这类持续指令会一直挂在「执行中」，
   * 下达新指令前必须先把它结掉，否则指令列表里永远挂着一条
   * 永远不结束的记录。
   */
  supersedeCurrent(reason = '被新指令取代') {
    const order = this.order;
    if (!order || order.phase === 'done') return null;
    // 已经回执完成过的指令不必再结一次
    if (order.commandReported) { this.order = null; return null; }
    const now = Date.now();
    const cmd = applyOrderAck({
      commandId: order.commandId,
      deviceId: order.deviceId,
      tenantId: order.tenantId ?? this.lastCmd?.tenantId,
      type: order.type,
      missionId: order.missionId || null,
      payload: order.payload || this.lastCmd?.payload || {},
      issuedAt: order.startedAt,
    }, ORDER_STATE.done, now);
    cmd.note = reason;
    this.onCommand(cmd);
    this.order = null;
    return cmd;
  }

  /**
   * 执行一条「作业方式」指令。宿主负责先算好作业计划再调用这里。
   *
   * @param {object} cmd
   * @param {object} plan buildOperationPlan 返回的 plan
   */
  startOperation(cmd, plan) {
    this.supersedeCurrent('被新作业指令取代');
    const order = {
      commandId: cmd.commandId,
      deviceId: this.deviceId,
      deviceKind: this.deviceKind,
      type: cmd.type,
      missionId: cmd.missionId || null,
      tenantId: cmd.tenantId || null,
      payload: cmd.payload || {},
      phase: this.deviceKind === 'uav' && this.dev.z < 0.5 ? 'takeoff' : 'transit',
      progress: 0,
      elapsedSec: 0,
      captureT: 0,
      captureSeconds: 3,
      path: plan.path,
      targetCells: plan.targetCells || [],
      spray: plan.spray || null,
      speedMs: plan.speedMs || 6,
      spdMs: 2.4,
      home: this.deviceKind === 'uav' ? UAV_HOME : ROBOT_HOME,
      altM: this.deviceKind === 'uav' ? 2.0 : 0,
      volumeL: 0,
      sprayedAreaHa: 0,
      sprayDistanceM: 0,
      distanceM: 0,
      startedAt: Date.now(),
    };
    this.order = order;
    this.queue = [];

    // 指令状态机推进：已下发 → 设备已接收 → 执行中
    const acked = applyOrderAck({ ...cmd }, ORDER_STATE.acked, Date.now());
    this.onCommand(acked);
    const running = applyOrderAck({ ...acked }, ORDER_STATE.running, Date.now());
    this.onCommand(running);

    // 作业单同步落库（宿主负责持久化）
    if (plan.mission) {
      const mission = {
        ...plan.mission,
        missionId: cmd.missionId || plan.mission.missionId || `M-${Date.now()}-${this.deviceId}`,
        status: MISSION_STATUS.running,
        deviceId: this.deviceId,
        operationMode: cmd.type,
      };
      this.onMission(mission);
    }
    return { ok: true, command: running, order };
  }

  /** 执行直接指令（起飞 / 悬停 / 降落 / 返航 / 暂停 / 继续 / 充电） */
  applyDirect(direct, cmd) {
    const now = Date.now();
    // 暂停 / 继续 不取代当前指令，只是把它收起或放回
    if (direct.id !== 'stop' && direct.id !== 'resume') {
      this.supersedeCurrent('被新指令取代');
    }
    const ack = applyOrderAck({ ...cmd }, ORDER_STATE.acked, now);
    this.onCommand(ack);

    /**
     * 持续型指令（起飞 / 返航）不立刻报完成 ——
     * 它们建立的是一种**持续状态**，真正结束要等设备到位。
     * 之前一律当场报 done，导致界面显示「已完成」而设备其实还没动。
     */
    let continuous = false;

    switch (direct.id) {
      case 'takeoff':
        if (this.deviceKind !== 'uav') {
          const bad = applyOrderAck(ack, ORDER_STATE.failed, now);
          this.onCommand(bad);
          return { ok: false, reason: '地面机器人无起飞指令' };
        }
        this.order = {
          commandId: cmd.commandId, deviceId: this.deviceId, deviceKind: this.deviceKind,
          type: cmd.type, phase: 'takeoff', progress: 0, elapsedSec: 0,
          path: [], targetCells: [], spray: null, speedMs: 0, spdMs: 2.4,
          home: UAV_HOME, altM: 2.0, volumeL: 0, sprayedAreaHa: 0,
          sprayDistanceM: 0, distanceM: 0, startedAt: now,
          // 起飞指令在「升到作业高度」时就算完成，
          // 但设备继续悬停待命 —— 指令完结 ≠ 设备停机。
          // 这两件事之前被混在一起，导致起飞要么永远「执行中」，
          // 要么升空后立刻返航。
          commandReported: false,
        };
        continuous = true;
        break;

      case 'hover':
        if (this.deviceKind !== 'uav') {
          const bad = applyOrderAck(ack, ORDER_STATE.failed, now);
          this.onCommand(bad);
          return { ok: false, reason: '地面机器人无悬停指令' };
        }
        this.dev.state = DEVICE_STATES.SURVEYING;
        this.dev.spd = 0;
        break;

      case 'land':
        if (this.deviceKind !== 'uav') {
          const bad = applyOrderAck(ack, ORDER_STATE.failed, now);
          this.onCommand(bad);
          return { ok: false, reason: '地面机器人无降落指令' };
        }
        this.dev.state = DEVICE_STATES.IDLE;
        this.dev.z = 0;
        this.dev.spd = 0;
        break;

      case 'return_home':
        this.order = {
          commandId: cmd.commandId, deviceId: this.deviceId, deviceKind: this.deviceKind,
          type: cmd.type, phase: 'return', progress: 0, elapsedSec: 0,
          path: [], targetCells: [], spray: null,
          speedMs: this.deviceKind === 'uav' ? 6 : 2.4, spdMs: 2.4,
          home: this.deviceKind === 'uav' ? UAV_HOME : ROBOT_HOME,
          altM: 0, volumeL: 0, sprayedAreaHa: 0, sprayDistanceM: 0,
          distanceM: 0, startedAt: now,
        };
        continuous = true;
        break;

      case 'stop':
        if (this.order && this.order.phase !== 'done') {
          this.savedOrder = this.order;
          this.order = null;
          this.dev.spd = 0;
          // 被暂停的指令要结掉 —— 指令状态机里没有「暂停」态，
          // 不结掉它就会永远挂在「执行中」，指令列表看着像出了故障。
          const paused = applyOrderAck({
            commandId: this.savedOrder.commandId,
            deviceId: this.savedOrder.deviceId,
            tenantId: this.savedOrder.tenantId ?? this.lastCmd?.tenantId,
            type: this.savedOrder.type,
            missionId: this.savedOrder.missionId || null,
            payload: this.savedOrder.payload || {},
            issuedAt: this.savedOrder.startedAt,
          }, ORDER_STATE.done, now);
          paused.note = '已暂停';
          this.onCommand(paused);
        }
        break;

      case 'resume':
        if (this.savedOrder) {
          this.order = this.savedOrder;
          this.savedOrder = null;
          // 恢复执行：把之前那条已结束的指令重新推回「执行中」
          const resumed = applyOrderAck({
            commandId: this.order.commandId,
            deviceId: this.order.deviceId,
            tenantId: this.order.tenantId ?? this.lastCmd?.tenantId,
            type: this.order.type,
            missionId: this.order.missionId || null,
            payload: this.order.payload || {},
            issuedAt: this.order.startedAt,
          }, ORDER_STATE.running, now);
          resumed.ackedAt = null;
          this.onCommand(resumed);
        }
        break;

      case 'charge':
        this.order = null;
        this.dev.state = DEVICE_STATES.CHARGING;
        this.dev.spd = 0;
        this.dev.x = this.deviceKind === 'uav' ? UAV_HOME.x : ROBOT_HOME.x;
        this.dev.y = this.deviceKind === 'uav' ? UAV_HOME.y : ROBOT_HOME.y;
        if (this.deviceKind === 'uav') this.dev.z = 0;
        break;
      default:
        break;
    }

    /* ---- 即时指令：当场报完成；持续指令：等执行层推进到 done ---- */
    if (!continuous) {
      const done = applyOrderAck(ack, ORDER_STATE.done, now);
      this.onCommand(done);
      this.history.unshift({
        commandId: cmd.commandId, type: cmd.type, ts: now,
        result: { note: direct.name },
      });
      this.history = this.history.slice(0, 50);
      return { ok: true, command: done };
    }
    const running = applyOrderAck(ack, ORDER_STATE.running, now);
    this.onCommand(running);
    return { ok: true, command: running };
  }

  /* ================================================================
   * 推进一帧
   * ================================================================ */

  /**
   * 推进 dt 秒。
   *
   * @param {number} dt
   * @returns {Array} 产生的事件
   */
  /**
   * 推进一拍。
   *
   * @param {number} dt 本拍推进的仿真秒数
   * @param {object} [opts]
   * @param {number} [opts.subSteps] 把这一拍拆成多少个固定子步。
   *   用于「演示加速」：把 15 秒一拍拆成 75 个 0.2 秒子步，
   *   设备在几分钟的任务在几十秒内跑完，但电量、药耗、里程
   *   仍按真实经过的仿真时间计算 —— 加速的是墙钟，不是物理。
   */
  tick(dt, opts = {}) {
    const events = [];
    const subSteps = Math.max(1, Math.min(300, Math.round(opts.subSteps || 1)));
    if (subSteps > 1) {
      // 子步长固定为 0.2 s（物理步长），子步数量由调用方给出。
      // 这样一轮推进的总时长 = subSteps × 0.2，
      // 由调用方保证它等于「本拍 × 加速倍率」，加速的是仿真时间。
      const sub = 0.2;
      for (let i = 0; i < subSteps; i++) {
        const r = this.tickOnce(sub);
        for (const e of r) events.push(e);
        if (!this.order) break;   // 指令已完成，提前收工
      }
      return events;
    }
    return this.tickOnce(dt);
  }

  /** 单步推进（不加速） */
  tickOnce(dt) {
    const events = [];

    // 充电中：电量回升
    if (this.dev.state === DEVICE_STATES.CHARGING) {
      this.dev.batt = Math.min(100, this.dev.batt + 0.25 * (dt / 0.2));
      this.emitTelemetry();
      return events;
    }

    if (this.order) {
      this.order.elapsedSec = (this.order.elapsedSec || 0) + dt;
      const before = this.order;
      const r = stepOrder(this.dev, this.order, dt);
      // 累加飞行里程
      this.order.distanceM = (this.order.distanceM || 0)
        + (Number.isFinite(this.dev.spd) ? this.dev.spd * dt : 0);

      for (const e of r.events) {
        if (e.type === 'capture') {
          const det = this.makeRobotDetection(e.cell);
          if (det) {
            this.onDetection(det);
            events.push({ type: 'detection', detection: det });
          }
        } else if (e.type === 'done') {
          const cmd = this.onOrderDone(e.result);
          events.push({ type: 'commandDone', command: cmd });
        } else if (e.type === 'phase' && e.phase === 'hover') {
          // 起飞到位：指令到此完成，但设备继续悬停待命。
          // 指令完结 ≠ 设备停机 —— 这两件事必须分开。
          const cmd = this.reportCommandDone('已升空，进入悬停待命');
          if (cmd) events.push({ type: 'commandDone', command: cmd });
        }
      }
      if (this.order === before && before.phase === 'done') this.order = null;
    }

    this.emitTelemetry();
    return events;
  }

  /**
   * 只回执指令完成，不结束执行体（设备继续按当前阶段运行）。
   *
   * 用于「起飞」：升空即算指令完成，设备转入悬停待命，
   * 等待降落 / 返航 / 新作业指令。
   */
  reportCommandDone(note) {
    const order = this.order;
    if (!order || order.commandReported) return null;
    order.commandReported = true;
    const now = Date.now();
    const cmd = applyOrderAck({
      commandId: order.commandId,
      deviceId: order.deviceId,
      tenantId: order.tenantId ?? this.lastCmd?.tenantId,
      type: order.type,
      missionId: order.missionId || null,
      payload: order.payload || this.lastCmd?.payload || {},
      issuedAt: order.startedAt,
    }, ORDER_STATE.done, now);
    cmd.note = note;
    this.onCommand(cmd);
    return cmd;
  }

  /** 指令执行完毕：推进回执状态、结算用量、归档 */
  onOrderDone(result) {
    const order = this.order;
    if (!order) return null;
    const now = Date.now();
    // 回执必须带全字段：存储层是 INSERT OR REPLACE，
    // 少给一个字段（比如 type）那一条就被写成 null，
    // 指令列表里会出现「类型为空的指令」。
    const cmd = applyOrderAck({
      commandId: order.commandId,
      deviceId: order.deviceId,
      tenantId: order.tenantId ?? this.lastCmd?.tenantId,
      type: order.type,
      missionId: order.missionId || null,
      payload: order.payload || this.lastCmd?.payload || {},
      issuedAt: order.startedAt,
    }, ORDER_STATE.done, now);    this.onCommand(cmd);
    this.history.unshift({
      commandId: order.commandId, type: order.type, ts: now, result,
    });
    this.history = this.history.slice(0, 50);
    this.order = null;

    // 作业单回写为「已完成」—— 否则作业单会永远停在「执行中」，
    // 总览页的待作业计数与节药统计都会算错。
    //
    // 这里只回写状态，不回写整条作业单：
    // 存储层的插入是 INSERT OR REPLACE，整条回写会把原始字段
    // （航线、药耗、节药率）全部覆盖成空值，节药率立刻算不出来。
    if (order.missionId) {
      this.onMission({
        missionId: order.missionId,
        status: MISSION_STATUS.done,
        completedAt: now,
        result,
      });
    }

    // 用量结算：喷洒按亩计费，巡查按亩计费
    if (result && (result.volumeL != null || result.points)) {
      this.onUsage({
        deviceId: this.deviceId,
        missionId: order.missionId || null,
        type: order.type === 'recheck_area' ? 'survey' : (order.spray ? 'spray' : 'survey'),
        areaMu: result.sprayedAreaHa ? +(result.sprayedAreaHa * 15).toFixed(1) : null,
        volumeL: result.volumeL ?? 0,
        minutes: result.minutes ?? null,
        detections: result.points ?? 0,
        savedL: null,
      });
    }
    return cmd;
  }

  /* ================================================================
   * 遥测与识别产出
   * ================================================================ */

  /** 产出一帧遥测 */
  emitTelemetry() {
    const ts = Date.now();
    // 序号必须由模拟器统一分配 —— 两边各自计会重号，
    // 链路的丢包率统计会把重号当成丢帧，指标立刻失真。
    this.shared.seq = (this.shared.seq || 0) + 1;
    const seq = this.shared.seq;
    const t = {
      frameId: `F-${this.deviceId}-${seq}`,
      ts,
      seq,
      deviceId: this.deviceId,
      kind: this.deviceKind,
      name: this.deviceKind === 'uav' ? '植保无人机 · 麦田一号' : '地面监测机器人 · 麦田一号',
      state: this.dev.state,
      pos: {
        x: +this.dev.x.toFixed(2), y: +this.dev.y.toFixed(2), z: +this.dev.z.toFixed(2),
        alt: +this.dev.z.toFixed(2), spd: +this.dev.spd.toFixed(2), hdg: +this.dev.hdg.toFixed(1),
      },
      batt: +this.dev.batt.toFixed(1),
      payload: this.deviceKind === 'uav'
        ? {
            waterL: 5, flowLmin: this.order?.spray?.flow ?? 1.44,
            swathM: this.order?.spray?.swath ?? 1.0,
            camera: '可见光+多光谱', mode: this.order?.type || 'idle',
          }
        : {
            camera: '近距可见光', arm: '叶下/根茎/土壤三工位',
            mode: this.order?.type || 'idle',
          },
      coverage: 0,
    };
    this.onTelemetry(t);
  }

  /**
   * 机器人在复核点位采集到近距图像 → 生成识别结果。
   *
   * 这一步是「空地联动闭环」的物理依据：机器人真的到点位拍了，
   * 才有证据闭合此前派单的联动事件。置信度刻意高于空中视角
   * （近距目标更清晰），符合实际。
   */
  makeRobotDetection(cell) {
    if (!cell) return null;
    const ts = Date.now();
    this.detSeq += 1;
    const disease = cell.disease || pickDiseaseNear(this.field, cell.x, cell.y);
    const confidence = +(0.80 + Math.random() * 0.17).toFixed(3);
    const part = ['underside', 'stem', 'soil'][Math.floor(Math.random() * 3)];
    return {
      detId: `D-${ts}-${this.detSeq}`,
      ts,
      deviceId: this.deviceId,
      kind: 'robot',
      part,
      disease,
      confidence,
      bbox: { x: 100 + Math.random() * 380, y: 80 + Math.random() * 280, w: 60 + Math.random() * 100, h: 60 + Math.random() * 100 },
      geo: { x: +cell.x.toFixed(2), y: +cell.y.toFixed(2) },
      grid: { row: cell.row, col: cell.col },
      model: 'SAN-GAT-RL（近距复核）',
    };
  }
}

/** 依病灶中心挑一个病种（近距复核点的病害） */
function pickDiseaseNear(field, x, y) {
  const spots = [
    { x: 12 * 5 + 2.5, y: 6 * 5 + 2.5, d: 'rust' },
    { x: 24 * 5 + 2.5, y: 11 * 5 + 2.5, d: 'fusarium' },
    { x: 8 * 5 + 2.5, y: 15 * 5 + 2.5, d: 'root_rot' },
    { x: 31 * 5 + 2.5, y: 3 * 5 + 2.5, d: 'powdery' },
  ];
  let best = spots[0], bd = Infinity;
  for (const s of spots) {
    const d = Math.hypot(s.x - x, s.y - y);
    if (d < bd) { bd = d; best = s; }
  }
  return best.d;
}

export { buildOperationPlan };
