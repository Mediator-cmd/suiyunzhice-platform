/**
 * 穗云智策 · 空地协同云平台 —— Cloudflare Worker 入口
 *
 * 目标：把后端真正跑在公网，得到一个「有服务器支撑」的地址，而不是只有静态页面。
 *
 * 运行时架构：
 *   Worker（无状态）      —— 处理 HTTP 请求，路由定义复用 server/src/app.js
 *   Durable Object（有状态）—— 单一实例：持有 SQLite（同步 API，与 node:sqlite 同形）、
 *                               WebSocket 广播、内存中的链路统计
 *   D1（可选）           —— 冷启动时从 D1 恢复历史数据；不绑定也能跑
 *
 * 为什么用 Durable Object 而不是纯 Worker + D1：
 *   shared/analytics.js 对存储是同步调用（`this.store.listDetections(500)` 直接拿数组），
 *   而 D1 是异步的。要让同一套业务代码零改动跑在云端，存储必须是同步 API ——
 *   Durable Object 内置的 SQLite 正是同步的，与 node:sqlite 同形。
 *
 * 为什么不用 node:sqlite 兼容层：
 *   Worker 运行时没有文件系统，node:sqlite 无法使用。
 *
 * 与本机版的关系：
 *   路由与业务逻辑（server/src/app.js、shared/*）完全共用，
 *   只有「存储实现」和「广播实现」随运行时不同 —— 因此两端口径一致。
 */

import { MiniRouter, MiniRequest, corsMiddleware } from '../../server/src/mini.js';
import { createApiRouter } from '../../server/src/app.js';
import { Platform, defaultField } from '../../shared/platform.js';
import { Analytics } from '../../shared/analytics.js';
import { LinkageEngine } from '../../shared/linkage.js';
import { seedDemoPlatform } from '../../shared/demo.js';
import { seedAgroHistory } from '../../shared/agroseed.js';

/** 遥测保留时长：1 小时。平台上用不到更早的遥测。 */
const TELEMETRY_KEEP_MS = 60 * 60 * 1000;

/**
 * 云端模拟器节奏：每 15 秒推进一次。
 *
 * 为什么不是 1 秒或 5 秒：Durable Object 免费额度按「行写入」计，
 * 而遥测是产出速率固定的（每拍每设备 1 条），批量落库只能减少往返、
 * 不能减少总行数 —— 真正的杠杆是把产出速率压下来。
 *
 * 15 秒一拍 × 2 台设备 = 每天 1.15 万行遥测；
 * 加上裁剪删除（稳态≈写入量）、设备 upsert、检出与联动事件，
 * 合计约 5.2 万行/天，在 10 万行/天的免费额度内留足余量。
 *
 * 代价：页面上的实时曲线刷新间隔变成 15 秒。
 * 这不影响演示 —— 遥测的时延、P95、丢包率等指标本身是在设备侧产生的真实值。
 */
const SIM_TICK_MS = 15000;

/**
 * 每多少拍把遥测缓冲刷进库。
 *
 * 遥测在库里只用于「页面首屏画一条历史曲线」，
 * 实时曲线由 WebSocket 推送，不依赖库的写入频率。
 * 批量落库主要减少往返开销，不减少总行数。
 */
const TELEMETRY_FLUSH_EVERY_TICKS = 3;

/**
 * 每多少拍裁剪一次遥测。
 *
 * 每拍写 2 行遥测，保留 1 小时 = 240 行；裁剪周期必须远小于保留窗口，
 * 否则「删掉的行数」会和「写入的行数」打平，白白吃掉一半额度。
 * 60 拍 = 15 分钟一次，保留窗口 1 小时 = 4 倍余量，安全。
 */
const PRUNE_EVERY_TICKS = 60;

export default {
  /**
   * HTTP 入口。
   * 所有 /api 请求都转发给 Durable Object（它持有状态），
   * 非 /api 路径交给静态资源（Pages/Workers Assets）。
   */
  async fetch(request, env, ctx) {
    try {
      return await this.handleFetch(request, env, ctx);
    } catch (e) {
      // 出错时把堆栈写进响应体，方便在没有 tail 通道的环境里排查
      console.error('[worker]', e?.stack || e?.message || e);
      return new Response(JSON.stringify({
        error: '服务端异常',
        message: String(e?.message || e),
        stack: String(e?.stack || '').split('\n').slice(0, 6),
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }
  },

  async handleFetch(request, env, ctx) {
    const url = new URL(request.url);

    // 设备遥测 WebSocket：/ws/telemetry 与 /ws/live 都由 Durable Object 承载
    if (url.pathname === '/ws/live' || url.pathname === '/ws/telemetry') {
      const id = env.PLATFORM_STATE.idFromName('suiyun-platform');
      return env.PLATFORM_STATE.get(id).fetch(request);
    }

    if (url.pathname.startsWith('/api/')) {
      const id = env.PLATFORM_STATE.idFromName('suiyun-platform');
      return env.PLATFORM_STATE.get(id).fetch(request);
    }

    // 非 API 路径：交给静态资源绑定
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Not Found', { status: 404 });
  }
};

/* ================================================================
 * Durable Object —— 平台状态持有者
 * ================================================================ */

export class PlatformState {
  /** 自动派工的节流时间戳（上次派工时刻） */
  lastSprayDispatch = 0;
  /** 内置模拟器（云端有真实后端，就该有设备在跑） */
  sim = null;

  constructor(state, env) {
    this.state = state;
    this.env = env;

    /** @type {import('./sqlite-store.js').SqliteStore | null} */
    this.store = null;
    this.platform = null;
    this.analytics = null;
    this.linkage = null;
    /** 链路质量统计（内存态，与本机版共用 shared/linkstats.js） */
    this.stats = null;
    /** 已初始化标记 */
    this.ready = false;
    /** 最近一次广播的时刻 */
    this.lastBroadcastAt = 0;
  }

  /** 首次请求时初始化整条链路 */
  async ensureInit() {
    if (this.ready) return;
    // Durable Object 的 SQL 是同步 API —— 与 node:sqlite 同形，
    // 因此 shared/ 里的业务代码可以零改动复用。
    const { SqliteStore } = await import('./sqlite-store.js');
    const { LinkStats } = await import('../../shared/linkstats.js');
    const { RealtimeHub } = await import('../../shared/realtime.js');

    this.store = new SqliteStore(this.state.storage.sql);
    await this.store.migrate();

    this.platform = new Platform({ store: this.store, field: defaultField() });
    this.analytics = new Analytics(this.store, this.platform.field);
    this.stats = new LinkStats();
    // 恢复链路统计：Durable Object 被驱逐后内存态会清空，
    // 而「实时监控」页的链路质量面板依赖这些计数。
    // 遥测数据本身存在 SQLite 里，统计项则随 KV 一起持久化。
    const statsSnap = await this.state.storage.get('linkStats');
    if (statsSnap) this.stats.restore(statsSnap);
    this.linkage = new LinkageEngine({
      store: this.store,
      onEvent: (e) => this.broadcast('linkage', e),
    });
    // 重建待闭环队列：Durable Object 被驱逐后内存队列会丢，
    // 而存储里的事件还标着「未闭环」——
    // 不重建的话，这些事件永远等不到闭合证据，闭环完成率一路下滑。
    this.linkage.restorePending(this.store.listLinkEvents(200));
    this.hub = new RealtimeHub({
      store: this.store,
      stats: this.stats,
      onTelemetry: (t, latency) => {
        this.store.insertTelemetry(t, latency);
        this.broadcast('telemetry', { ...t, latencyMs: latency });
      },
      onDetection: (d) => this.onDetection(d),
    });

    // 演示数据与农情历史（与本机版共用同一份 shared/ 代码）
    //
    // 只播种一次：Durable Object 被驱逐后重新唤醒时会再走一遍初始化，
    // 若重复播种，历史记录的时间戳会被重置成「现在」，
    // 七天的农情历史就失真了。用一个持久化标记保证只播一次。
    const seeded = await this.state.storage.get('seeded');
    if (!seeded) {
      seedDemoPlatform(this.store, { skipTenants: this.store.listTenants().length > 0 });
      seedAgroHistory(this.store, this.platform.field, this.platform.getPlan().best);
      await this.state.storage.put('seeded', Date.now());
    }

    this.ready = true;

    // 启动内置模拟器：让云端真的有设备在跑
    // （有真实后端却空空如也，比静态版还"空"，这正是要避免的）
    await this.startSimulator();
  }

  /**
   * 启动内置数据模拟器。
   *
   * 用 Durable Object 的 alarm 而不是 setInterval：
   *   setInterval 在 Worker 里不可靠（对象被驱逐就停，且不保证触发）；
   *   alarm 是持久化的 —— 对象即使被驱逐出内存，到点也会被唤醒继续跑。
   *
   * 频率取 1 秒一次：模拟器内部按 dt=0.2s 的步长推进，
   * 5Hz 的遥测在云端意义不大（每秒 2 帧足以展示实时性），
   * 而 1 秒一次能把 DO 的调用量压在免费额度内。
   */
  async startSimulator() {
    if (this.env.SIM === '0') return;      // 生产环境可关掉
    if (this.sim) return;
    const { Simulator } = await import('../../shared/simulator.js');
    // 恢复上次的位置状态：对象被驱逐后设备不该瞬移回起点
    const saved = await this.state.storage.get('simState');
    this.sim = new Simulator({
      field: this.platform.field,
      // 每拍推进 15 秒：与「每 15 秒醒一次」相配合，设备运动速度与真实一致
      dt: 15,
      // 每拍检出概率。云端一拍的时长是本机的 75 倍，
      // 若沿用按 dt 缩放的比例，概率会超过 1（每拍必检出），
      // 检出与联动事件会瞬间吃掉 DO 的免费额度。
      // 这里取一个与「每分钟约 1 条检出」相称的小概率。
      detectChance: 0.16,
      onDevice: (d) => {
        // 设备表是高频 upsert（每拍 2 次），按节流窗口合并写入，
        // 否则光设备表一天就是 3 万多次写入，很快撞上 DO 免费额度。
        this.pendingDevice = this.pendingDevice || new Map();
        this.pendingDevice.set(d.deviceId, d);
      },
      onTelemetry: (t, latency) => {
        // 遥测入内存缓冲，按固定间隔批量落库。
        //
        // 为什么要批量、间隔还这么长：
        //   实时曲��完全由 WebSocket 推送（每拍都发），
        //   库里的遥测只用于「页面首次加载时画一条历史曲线」。
        //   而 Durable Object 免费额度按行写入计，
        //   每拍 2 行直接落库，一天就是 3.4 万行遥测 + 3.4 万行裁剪删除，
        //   再加检出与联动事件会直接爆掉 10 万行/天的额度。
        //   所以只在需要时落一小批：首屏有曲线可画，额度几乎不占。
        this.pendingTelemetry = this.pendingTelemetry || [];
        this.pendingTelemetry.push({ t, latency });

        // 模拟器不经 WebSocket，需显式登记链路质量，否则「实时监控」页无指标
        this.hub.recordTelemetry(t.deviceId, t.kind, latency, t.seq, t.state);
        this.broadcast('telemetry', { ...t, latencyMs: latency });
      },
      onDetection: (d) => { this.onDetection(d); },
      /* ---- 受控执行层回调：平台指令的执行回执 ---- */
      onCommand: (c) => {
        this.store.insertCommand(c);
        this.broadcast('commandStatus', c);
      },
      onMission: (m) => {
        // 完整作业单 → 插入；只有状态 → 更新
        // （INSERT OR REPLACE 会覆盖原始字段，把航线与药耗清空）
        if (m.plan || m.target) {
          this.store.insertMission(m);
          this.broadcast('mission', m);
        } else {
          this.store.updateMissionStatus(m.missionId, m.status);
          this.broadcast('missionStatus', { missionId: m.missionId, status: m.status });
        }
      },
      onUsage: (u) => {
        this.store.insertUsage({
          ts: Date.now(),
          tenantId: u.tenantId || 't-demo',
          missionId: u.missionId || null,
          type: u.type || 'spray',
          areaMu: u.areaMu ?? null,
          volumeL: u.volumeL ?? null,
          minutes: u.minutes ?? null,
          sorties: 1,
          detections: u.detections ?? 0,
          savedL: u.savedL ?? null,
          amount: null,
        });
      },
    });
    // 手动模式：不用 setInterval，由 alarm 驱动 tick()
    this.sim.start(SIM_TICK_MS, { manual: true, state: saved });
    // 立刻排一次 alarm，并让它按固定节奏再触发
    const existing = await this.state.storage.getAlarm();
    if (!existing) await this.state.storage.setAlarm(Date.now() + SIM_TICK_MS);
  }

  /** 把节流攒下的设备状态落库 */
  flushDevices() {
    if (!this.pendingDevice || this.pendingDevice.size === 0) return;
    for (const d of this.pendingDevice.values()) this.store.upsertDevice(d);
    this.pendingDevice.clear();
  }

  /** 把节流攒下的遥测落库 */
  flushTelemetry() {
    const buf = this.pendingTelemetry;
    if (!buf || buf.length === 0) return;
    for (const { t, latency } of buf) this.store.insertTelemetry(t, latency);
    buf.length = 0;
  }

  /**
   * 把平台下发的指令交给设备执行层。
   *
   * 云端与本机走的是同一套 shared/ 执行逻辑，
   * 因此「云端下发的指令会真的执行」这件事两端一致。
   */
  deliverCommand(cmd, plan) {
    if (!this.sim) return { ok: false, reason: '设备执行层未启用（SIM=0）' };
    const r = this.sim.receiveCommand(cmd, plan);
    if (r && r.ok === false) return r;
    return { ok: true };
  }

  /**
   * alarm 回调：推进模拟器并排下一次。
   * 这是云端持续产生真实数据的心跳。
   */
  async alarm() {
    await this.ensureInit();
    try {
      if (this.sim) {
        this.sim.tick();
        // 每 10 次存一次状态：位置变化是连续的，存太频繁没意义
        this.simTickCount = (this.simTickCount || 0) + 1;
        if (this.simTickCount % 10 === 0) {
          await this.state.storage.put('simState', this.sim.snapshot());
        }
      }
      // 设备表与遥测落库
      //
      // 遥测每 15 拍（75 秒）落一批即可：库里只用于首屏曲线，
      // 实时部分由 WebSocket 推送，不依赖库的写入频率。
      this.flushTick = (this.flushTick || 0) + 1;
      if (this.flushTick % 3 === 0) this.flushDevices();
      if (this.flushTick % TELEMETRY_FLUSH_EVERY_TICKS === 0) this.flushTelemetry();
      // 定期裁剪遥测表。
      //
      // 遥测是高频表，不裁剪会一直涨，最终撞上免费额度。
      // 平台上真正用到的遥测只有「最近一小时」——
      // 实时监控看曲线、链路质量看 P95/丢包率，都用不到更早的数据。
      //
      // 注意：裁剪本身也是写操作（DELETE 同样计费），
      // 所以保留窗口要留够余量，别让「写进去」和「删掉」的量打平。
      this.pruneTick = (this.pruneTick || 0) + 1;
      if (this.pruneTick % PRUNE_EVERY_TICKS === 0) {
        this.store.pruneTelemetry(TELEMETRY_KEEP_MS);
      }
      // 链路统计是内存态，持久化后对象被驱逐也不丢
      if (this.pruneTick % 5 === 0) {
        await this.state.storage.put('linkStats', this.stats.snapshot());
      }
    } catch (e) {
      console.error('[sim]', e?.message || e);
    }
    // 排下一次
    await this.state.storage.setAlarm(Date.now() + SIM_TICK_MS);
  }

  /** 检测结果处理：联动闭环 + 派单 */
  async onDetection(d) {
    this.broadcast('detection', d);
    if (d.kind === 'robot') {
      const closedEv = this.linkage.completeCycle(d);
      if (closedEv) this.broadcast('linkage', closedEv);
    }
    const verdict = this.linkage.evaluateDetection(d);
    if (verdict.needRecheck) {
      const plan = this.platform.getPlan().best;
      const ev = this.linkage.runLinkageCycle({
        uavDet: { ...d, deviceId: d.deviceId || 'UAV-01' },
        field: this.platform.field, planning: plan,
      });
      // ev 为 null 表示该网格已有未闭合的复核派单，无需重复派单
      if (ev) {
        this.broadcast('linkage', ev);
        const mission = await this.buildRecheckMission(d);
        this.store.insertMission(mission);
        this.broadcast('mission', mission);
      }
    }
    await this.dispatchSprayIfNeeded();
  }

  async buildRecheckMission(d) {
    const { buildRecheckMission } = await import('../../shared/spraydispatch.js');
    return buildRecheckMission({ detection: d, field: this.platform.field });
  }

  async buildSprayMissions() {
    const { buildSprayMissions } = await import('../../shared/spraydispatch.js');
    return buildSprayMissions({
      field: this.platform.field,
      dets: this.store.listDetections(500),
      missions: this.store.listMissionsByType('spray', 5000),
      plan: this.platform.getPlan().best,
    });
  }

  /**
   * 自动派工：确诊病害累积到阈值后生成靶向施药作业单。
   * 与本机版共用 shared/spraydispatch.js，保证两端口径一致。
   */
  async dispatchSprayIfNeeded() {
    const now = Date.now();
    if (now - this.lastSprayDispatch < 8000) return;   // 节流，避免刷屏
    this.lastSprayDispatch = now;
    try {
      const built = await this.buildSprayMissions();
      for (const b of built) {
        this.store.insertMission(b.mission);
        this.broadcast('mission', b.mission);
        this.broadcast('sprayPlan', { mission: b.mission, ratio: b.ratio });
      }
    } catch (e) {
      console.error('[spray-dispatch]', e.message);
    }
  }

  /** 统一广播：推给所有订阅者 */
  broadcast(type, payload) {
    const msg = JSON.stringify({ type, payload, ts: Date.now() });
    this.lastBroadcastAt = Date.now();
    // 用 getWebSockets() 而不是内存里的 Map：
    // Hibernation API 允许对象被驱逐出内存，此时内存 Map 会清空，
    // 而 getWebSockets() 始终返回全部存活连接。
    for (const ws of this.state.getWebSockets()) {
      try { ws.send(msg); } catch { /* ignore */ }
    }
  }

  async fetch(request) {
    try {
      return await this.handleFetch(request);
    } catch (e) {
      console.error('[do]', e?.stack || e?.message || e);
      return new Response(JSON.stringify({
        error: '服务端异常',
        message: String(e?.message || e),
        stack: String(e?.stack || '').split('\n').slice(0, 8),
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }
  }

  async handleFetch(request) {
    await this.ensureInit();
    const url = new URL(request.url);

    // ---- WebSocket 升级 ----
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request, url.pathname);
    }

    // ---- HTTP 接口 ----
    const body = await readJsonBody(request);
    const mreq = new MiniRequest({
      method: request.method,
      url: url.pathname.replace(/^\/api/, '') + url.search,
      headers: Object.fromEntries(request.headers.entries()),
      body,
    });

    const mini = new MiniRouter();
    mini.use(corsMiddleware);
    createApiRouter({
      router: mini,
      store: this.store,
      platform: this.platform,
      analytics: this.analytics,
      linkage: this.linkage,
      hub: this.hub,
      broadcast: (t, p) => this.broadcast(t, p),
      field: this.platform.field,
      // 把指令交给设备执行层 —— 云端下发的指令同样会真的执行
      deliverCommand: (cmd, plan) => this.deliverCommand(cmd, plan),
      // 演示加速档位：云端每拍 15 秒，加速同样按仿真时间计物理量
      execSpeed: () => this.sim?.execSpeedFactor ?? 1,
      setExecSpeed: (f) => (this.sim
        ? this.sim.setExecSpeed(f)
        : { ok: false, reason: '设备执行层未启用' }),
    });

    const mres = await mini.handle(mreq);
    const headers = new Headers();
    for (const [k, v] of Object.entries(mres.headers)) headers.set(k, v);
    return new Response(mres.body ?? '', {
      status: mres.statusCode,
      headers,
    });
  }

  /**
   * WebSocket 处理。
   *
   * /ws/live     —— 浏览器订阅实时事件
   * /ws/telemetry —— 设备推送遥测帧
   *
   * 用 Hibernation API（acceptWebSocket）而非普通 accept：
   * 空闲对象可以被驱逐出内存，连接保持不断，醒来后继续用
   * getWebSocket() 恢复。省下的是「对象常驻 24 小时」的那份时长计费。
   */
  async handleWebSocket(request, pathname) {
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    const isDevice = pathname === '/ws/telemetry';

    this.state.acceptWebSocket(server);
    const tag = isDevice ? 'device' : 'browser';
    // 把身份信息放进 attachment —— 对象被驱逐后仍能从 socket 读回来
    server.serializeAttachment(isDevice
      ? { tag, deviceId: request.headers.get('x-device-id') || `dev-${Date.now()}`, kind: request.headers.get('x-device-kind') || 'uav' }
      : { tag, since: Date.now() });

    if (isDevice) {
      const attach = server.deserializeAttachment();
      this.hub.ensureStats(attach.deviceId, attach.kind);
    } else {
      // 打招呼：让前端立刻拿到设备清单
      try {
        server.send(JSON.stringify({
          type: 'hello',
          payload: { ts: Date.now(), devices: this.store.listDevices() },
          ts: Date.now(),
        }));
      } catch { /* ignore */ }
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  /* ================================================================
   * Hibernation API 回调
   *
   * 用了 acceptWebSocket() 之后，对象可以被驱逐出内存而连接不断。
   * 消息到达时框架会重新唤醒对象并调用下面这几个方法。
   * ================================================================ */

  /**
   * 设备帧到达。
   * 只处理设备通道（/ws/telemetry）；浏览器通道是单向订阅，不发帧。
   */
  async webSocketMessage(ws, raw) {
    await this.ensureInit();
    const attach = ws.deserializeAttachment?.() || {};
    if (attach.tag !== 'device') return;
    let msg;
    try { msg = JSON.parse(String(raw)); } catch { return; }
    this.handleDeviceFrame(ws, attach, msg);
  }

  /** 帧处理 —— 复用 shared/realtime.js 的内核 */
  handleDeviceFrame(ws, client, msg) {
    try {
      this.hub.handle(ws, client, msg);
    } catch (e) {
      console.error('[hub]', e.message);
    }
  }

  async webSocketClose(ws) {
    const attach = ws.deserializeAttachment?.() || {};
    if (attach.tag === 'device' && attach.deviceId) {
      this.store.setDeviceOffline(attach.deviceId);
    }
  }

  async webSocketError() {
    // 连接已由框架清理，无需额外处理
  }
}

/** 解析请求体（JSON）；非 JSON 或空体返回 null */
async function readJsonBody(request) {
  try {
    const ct = request.headers.get('content-type') || '';
    if (!ct.includes('application/json')) return null;
    const text = await request.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}
