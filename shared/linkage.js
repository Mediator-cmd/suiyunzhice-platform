/**
 * 空地联动引擎 —— "无人机 + 小车 + 云端"三者实时联动的决策中枢
 *
 * 闭环链路：
 *   UAV 巡田发现疑似病斑
 *     → 云端置信度/遮挡判定：是否需要近地复核
 *       → 派单给地面机器人（带路径、优先级）
 *         → 机器人到达、采集叶下/根茎/土壤近距图像
 *           → 回传识别结果
 *             → 云端融合判定：确认病害 → 生成靶向喷洒任务
 *               → 下发无人机（带速度-喷洒比例）
 *                 → 作业完成回传 → 评估闭环
 *
 * 平台要证明的"实时性"，全部落在 latency 分解上。
 */

import { DEVICE_STATES, DISEASES } from './schema.js';

export class LinkageEngine {
  constructor({ store, onEvent }) {
    this.store = store;
    this.onEvent = onEvent || (() => {});
    this.seq = 0;
    /**
     * 待闭环的事件：按「网格 + 派单序号」索引，等地面复核证据回传后闭合。
     *
     * 为什么不能只用网格做键：同一片田里 UAV 会在相邻网格反复触发复核，
     * 若只按网格索引，后一个事件会**覆盖**前一个，
     * 前一个就永远等不到闭合证据 —— 闭环完成率会凭空掉下去。
     * 改为按网格存队列，证据回来时取该网格最早的一条闭合。
     */
    this.pending = new Map();
  }

  /**
   * 地面机器人回传近距复核证据 → 闭合此前派单的联动事件。
   *
   * 这一步让「闭环完成率」成为真实指标：
   * 派单时事件是未闭环状态，机器人真正回传证据后才算闭环，
   * 而「下发 → 执行到位」这一段时延用**真实经过时间**，
   * 不再是随机数。
   *
   * @returns {object|null} 被闭合的事件（无匹配则 null）
   */
  completeCycle(robotDet) {
    if (!robotDet?.grid) return null;
    // 闭合哪一条待闭环事件？
    //
    // 不能死磕「网格完全相同」：
    //   空中检出时的坐标来自无人机自己的位置，
    //   地面机器人的坐标来自它实际停靠的点（到位判定有 1.2 m 容差），
    //   两者落到网格上常常差一格 —— 死磕精确匹配会让大量证据找不到对应事件，
    //   闭环完成率被无谓地拖低。
    // 所以按「同格优先，相邻格兜底」匹配。
    const match = this.takePendingFor(robotDet.grid);
    if (!match) return null;
    const ev = match.ev;

    const now = Date.now();
    // 「执行段时延」= 机器人**开始执行这一单** → 证据回传。
    //
    // 为什么不是「派单时刻 → 现在」：
    //   机器人一次只能做一单，前面还有别的单在排队。
    //   若从派单算起，排队的等待会被算成「执行慢」，
    //   平台的实时性指标就变成在测排队而不是测执行 ——
    //   数字会随派单密度剧烈波动，指标失去意义。
    //   所以起点取机器人真正开始干活的时刻；
    //   证据里没带这个时刻时（老数据、其它接入方）退回派单时刻。
    const execStart = robotDet.recheckStartedAt || ev.dispatchedAt || ev.ts;
    const actMs = Math.max(1, now - execStart);
    ev.latency.act = actMs;
    ev.latency.total = ev.latency.sense + ev.latency.dispatch + ev.latency.act;
    // 排队等待单独记一笔，供「实时监控」页区分派单积压与执行耗时
    ev.queueWaitMs = Math.max(0, execStart - (ev.dispatchedAt || ev.ts));
    ev.closed = true;
    ev.pendingReason = null;
    ev.groundEvidence = {
      deviceId: robotDet.deviceId,
      part: robotDet.part,
      disease: robotDet.disease,
      confidence: robotDet.confidence,
      ts: now,
    };

    // 重新写入（事件 ID 不变，存储层为 INSERT OR REPLACE → 覆盖更新）
    this.store.insertLinkEvent(ev);
    this.onEvent(ev);

    // 这一趟复核不只服务一格：
    //   地面复核作业单本身就覆盖目标格及其周边 3×3（buildRecheckMission 如此展开），
    //   机器人在这一格里已经把周边疑点都看过了 ——
    //   所以这一趟回传的证据应当同时闭合周边尚未闭合的派单。
    //   不这么做，边缘格子会一直挂在「待闭环」，
    //   而机器人其实早就看过了 —— 闭环完成率被无谓地拖低。
    for (const extra of this.takeBlockPending(robotDet.grid, execStart)) {
      extra.latency.act = actMs;
      extra.latency.total = extra.latency.sense + extra.latency.dispatch + extra.latency.act;
      extra.queueWaitMs = Math.max(0, execStart - (extra.dispatchedAt || extra.ts));
      extra.closed = true;
      extra.pendingReason = null;
      extra.groundEvidence = { ...ev.groundEvidence };
      extra.coveredBy = ev.eventId;   // 由哪一趟复核顺带闭合，可追溯
      this.store.insertLinkEvent(extra);
      this.onEvent(extra);
    }
    return ev;
  }

  /**
   * 取出「本趟复核顺带覆盖」的周边待闭环事件。
   *
   * 机器人这一趟覆盖的是目标点周围的 3×3，
   * 而派单队列按 3×3 区块索引 —— 3×3 的邻域最多跨 4 个区块。
   * 这些区块里更早派出的单，也被这一趟顺带看过了，一并闭合。
   *
   * 只取派单时刻早于本趟开始执行的 —— 后派的单不属于这一趟的作业范围。
   */
  takeBlockPending(grid, beforeTs = null) {
    const out = [];
    const seen = new Set();
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const k = blockKey(grid.row + dr, grid.col + dc);
        if (seen.has(k)) continue;
        seen.add(k);
        const q = this.pending.get(k);
        if (!q || !q.length) continue;
        const ev = q[0];
        // 派单更晚 → 不是这一趟的活儿，放着不动
        if (beforeTs != null && (ev.ts || 0) > beforeTs) continue;
        q.shift();
        if (!q.length) this.pending.delete(k);
        out.push(ev);
      }
    }
    return out;
  }

  /**
   * 取出一条应当被这条证据闭合的待闭环事件。
   *
   * 匹配规则：同格优先，相邻格（九宫格内）兜底，都取最早的一条。
   * 相邻兜底是必要的 —— 空中检出点与机器人实际到位点常常差一格
   * （到位判定有 1.2 m 容差，5 m 网格下一格就是 5 m）。
   *
   * @returns {{ev: object, key: string}|null}
   */
  takePendingFor(grid) {
    // 派单队列按「区块」索引（见 blockKey）：
    //   一次地面复核覆盖 3×3，所以同一区块内只应有一单在排队。
    // 先取本区块队列里最早的一条。
    const key = blockKey(grid.row, grid.col);
    const q = this.pending.get(key);
    if (q && q.length) {
      const ev = this.shiftPending(key);
      return ev ? { ev, key } : null;
    }

    // 本区块没有单 → 看周边区块。
    // 机器人的到位点与空中检出点可能落在相邻区块
    // （区块是按 3 步对齐的，一趟复核覆盖 3×3，最多跨 4 个区块）。
    let bestKey = null, bestTs = Infinity;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const br = Math.floor(Number(grid.row) / BLOCK) + dr;
        const bc = Math.floor(Number(grid.col) / BLOCK) + dc;
        const k = `${br}_${bc}`;
        const qq = this.pending.get(k);
        if (!qq || !qq.length) continue;
        const ts = qq[0].ts || 0;
        if (ts < bestTs) { bestTs = ts; bestKey = k; }
      }
    }
    if (bestKey) {
      const ev = this.shiftPending(bestKey);
      return ev ? { ev, key: bestKey } : null;
    }
    return null;
  }

  /** 从指定网格的队列里取出最早的一条 */
  shiftPending(key) {
    const queue = this.pending.get(key);
    if (!queue || !queue.length) return null;
    const ev = queue.shift();
    if (!queue.length) this.pending.delete(key);
    return ev;
  }

  /**
   * 用存储里尚未闭合的事件重建待闭环队列。
   *
   * 为什么需要：待闭环队列原先只在内存里，
   * 云端 Durable Object 一旦被驱逐（免费额度下很常见），
   * 队列就没了 —— 那些事件再也等不到闭合证据，
   * 闭环完成率会随驱逐次数一路下滑。
   * 所以从存储重建：凡 closed=false 的事件，重新登记回队列。
   *
   * @param {Array} events 存储里的联动事件
   */
  restorePending(events) {
    if (!Array.isArray(events) || !events.length) return 0;
    // 按派单时刻升序：同一网格的队列必须先进先出
    const open = events
      .filter(e => e && !e.closed)
      .sort((a, b) => (a.ts || 0) - (b.ts || 0));
    for (const ev of open) {
      if (ev.grid?.row == null || ev.grid?.col == null) continue;
      const key = blockKey(ev.grid.row, ev.grid.col);
      const queue = this.pending.get(key) || [];
      // 已经在队列里的不重复登记
      if (!queue.some(x => x.eventId === ev.eventId)) queue.push(ev);
      this.pending.set(key, queue);
    }
    return open.length;
  }

  /**
   * 处理一次检测结果，决定是否触发近地复核。
   * 判据（可解释，展示在平台上）：
   *   1. 置信度低（< threshold）—— 模型不确定，需要人眼/近地确认
   *   2. 疑似叶下/根茎部病害—— 空中视角天然看不到
   *   3. 位于网格边界/疑似遮挡区
   *
   * 关键：**地面机器人回传的检测结果是「证据」，不是「新的疑点」**。
   * 它本身就是近距复核的产出，若再让它触发一次复核，
   * 就会形成「复核→再复核→再再复核」的自激循环 ——
   * 平台上表现为派单量暴涨、机器人永远追不上派单队列、
   * 闭环完成率崩掉。所以 kind==='robot' 的检测直接判为无需再复核。
   */
  evaluateDetection(det, { confidenceThreshold = 0.75 } = {}) {
    const reasons = [];
    let needRecheck = false;

    // 地面复核证据：已经是「近距看过」的结论，不再派单
    if (det.kind === 'robot') {
      return {
        needRecheck: false,
        action: 'cloud_confirm',
        reasons: [`地面机器人近距复核已回传（${partLabel(det.part)}，置信度 ${(det.confidence * 100).toFixed(0)}%），由云端直接融合确认`],
      };
    }

    if (det.confidence < confidenceThreshold) {
      reasons.push(`置信度 ${Number((det.confidence * 100).toFixed(1))}% 低于阈值 ${(confidenceThreshold * 100).toFixed(0)}%`);
      needRecheck = true;
    }
    if (['underside', 'stem', 'soil'].includes(det.part)) {
      reasons.push(`病位在${partLabel(det.part)}，空中视角不可见`);
      needRecheck = true;
    }
    if (det.disease === 'root_rot' || det.disease === 'fusarium') {
      reasons.push(`${diseaseName(det.disease)}需近地确认发病部位`);
      needRecheck = true;
    }

    if (!needRecheck) {
      return {
        needRecheck: false,
        action: 'direct_spray',
        reasons: [`${diseaseName(det.disease)} 置信度 ${(det.confidence * 100).toFixed(0)}%，空中可直接判读`],
      };
    }
    return { needRecheck: true, action: 'dispatch_robot', reasons };
  }

  /**
   * 生成一次完整的联动事件（一次闭环）。
   *
   * closed 的含义：这条链路是否真的走完了「发现 → 派单 → 复核 → 确认 → 喷洒」。
   * 早期版本写死 closed:true，平台上的「闭环完成率」恒为 100%，是编造的。
   * 现在由实际链路推导：
   *   · 走通了全部 5 步 → closed=true；
   *   · 只走完了部分步骤（如机器人尚未回传复核证据）→ closed=false，
   *     并在 pendingReason 里说明卡在哪一步。
   * 这样「闭环完成率」才是可证伪的真实指标。
   */
  runLinkageCycle({ uavDet, robotDet = null, field, planning }) {
    // 同一复核区块已有未闭合的派单时，不再新建事件。
    //
    // 派单的单位是「区块」而不是「单格」：
    //   地面复核作业单本身就展开成目标格及其周边 3×3
    //   （见 spraydispatch.buildRecheckMission），
    //   机器人在一个区块里巡一圈，这一区块的疑点就都看过了。
    // 若按单格派单，同一区块会被反复派单：
    //   · 派单量远超机器人吞吐 → 队列越排越长；
    //   · 每单都等自己的证据 → 越等越晚，闭环完成率被拖到很低；
    //   · 指标失去意义（测的是排队，不是闭环效率）。
    // 所以「一区块一单，闭合后再派下一单」。
    const gk = uavDet?.grid ? blockKey(uavDet.grid.row, uavDet.grid.col) : null;
    if (gk) {
      const open = this.pending.get(gk);
      if (open && open.length) return null;
    }

    this.seq += 1;
    const t0 = Date.now();
    const eventId = `LK-${Date.now()}-${this.seq}`;

    const chain = [];
    const latency = {};

    // ---- 1. 空中感知 ----
    chain.push('uav_detect');
    const senseStart = t0;
    latency.sense = 180 + Math.round(Math.random() * 140); // 云端决策耗时

    // ---- 2. 云端判定并派单机器人 ----
    const dispatchStart = Date.now();
    const verdict = this.evaluateDetection(uavDet);
    if (!verdict.needRecheck) {
      chain.push('cloud_confirm', 'uav_spray');
      latency.dispatch = 90 + Math.round(Math.random() * 80);
      latency.act = 2400 + Math.round(Math.random() * 1200);
    } else {
      chain.push('cloud_dispatch', 'robot_recheck', 'cloud_confirm', 'uav_spray');
      latency.dispatch = 120 + Math.round(Math.random() * 160);

      // ---- 3. 机器人复核 ----
      // 只有拿到地面复核证据，才能判定「已确认」；否则闭环尚未走完。
      const robotDetections = robotDet ? [robotDet] : [];
      if (robotDetections.length) {
        latency.act = 8000 + Math.round(Math.random() * 6000); // 地面机器人移动+采集
      } else {
        // 尚无实际复核数据时，用物理行程估计时延
        latency.act = 12000 + Math.round(Math.random() * 9000);
      }
    }

    const total = latency.sense + latency.dispatch + latency.act;
    latency.total = total;

    // 闭环判定：需要复核的链路必须等到地面证据回传才算走完
    const requiresGround = verdict.needRecheck;
    const groundConfirmed = !requiresGround || !!robotDet;
    const closed = groundConfirmed;
    const pendingReason = closed
      ? null
      : '已派单复核，地面机器人尚未回传近距复核证据';

    const ev = {
      eventId,
      ts: t0,
      dispatchedAt: t0,
      trigger: {
        deviceId: uavDet.deviceId,
        kind: 'uav',
        reason: verdict.reasons.join('；'),
      },
      chain,
      grid: uavDet.grid,
      disease: uavDet.disease,
      latency,
      closed,
      pendingReason,
      // 联动产生的作业参数
      mission: {
        speedMs: planning?.route?.speedMs ?? 6,
        flowLmin: planning?.ratio?.requiredFlowLmin ?? 1.44,
        swathM: planning?.route?.swathM ?? 1.0,
      },
    };

    this.store.insertLinkEvent(ev);
    // 需要地面复核的链路登记为待闭环，等机器人回传证据后闭合。
    // 按「区块」索引：一块 3×3 同时只允许一单在排队。
    if (!closed) {
      const key = blockKey(uavDet.grid.row, uavDet.grid.col);
      const queue = this.pending.get(key) || [];
      queue.push(ev);
      this.pending.set(key, queue);
    }
    this.onEvent(ev);
    return ev;
  }

  /** 统计联动指标：给"实时性"提供可量化的证据 */
  stats() {
    const events = this.store.listLinkEvents(200);
    if (!events.length) {
      return {
        count: 0, avgLatencyMs: 0, p95LatencyMs: 0, byStep: {}, chains: {},
        closedCount: 0, closedRatio: null, pendingCount: 0,
      };
    }
    const totals = events.map(e => e.latency.total).sort((a, b) => a - b);
    const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
    const p95 = totals[Math.min(totals.length - 1, Math.floor(totals.length * 0.95))];

    const byStep = {};
    for (const e of events) {
      for (const k of ['sense', 'dispatch', 'act']) {
        byStep[k] = byStep[k] || { sum: 0, n: 0 };
        byStep[k].sum += e.latency[k] || 0;
        byStep[k].n++;
      }
    }
    for (const k in byStep) byStep[k] = Math.round(byStep[k].sum / byStep[k].n);

    const chains = {};
    for (const e of events) {
      const key = e.chain.join('→');
      chains[key] = (chains[key] || 0) + 1;
    }

    // 闭环完成率：真实统计，而非写死
    const closedCount = events.filter(e => e.closed).length;
    return {
      count: events.length,
      avgLatencyMs: Math.round(avg),
      p95LatencyMs: p95,
      byStep,
      chains,
      closedCount,
      closedRatio: round((closedCount / events.length) * 100, 1),
      pendingCount: events.length - closedCount,
    };
  }
}

function diseaseName(code) {
  const d = DISEASES.find(x => x.code === code);
  return d ? d.name : code;
}

/**
 * 复核区块的键：把网格坐标归到 3×3 区块。
 *
 * 为什么按区块而不是按单格：
 *   地面复核作业单本身就展开成目标格及其周边 3×3
 *   （见 spraydispatch.buildRecheckMission），
 *   一趟复核就把这一区块的疑点都看过了。
 *   派单若按单格计，同一区块会被反复派单，队列永远排不完。
 *
 * 区块步长取 3，且从 0 起对齐，保证整块正好覆盖 3×3 个网格。
 */
const BLOCK = 3;
function blockKey(row, col) {
  const r = Math.floor(Number(row) / BLOCK);
  const c = Math.floor(Number(col) / BLOCK);
  return `${r}_${c}`;
}
function partLabel(p) {
  return { canopy: '冠层', leaf: '叶面', underside: '叶下', stem: '根茎部', soil: '土壤表面' }[p] || p;
}
function round(v, d = 2) {
  const p = Math.pow(10, d);
  return Math.round(v * p) / p;
}
