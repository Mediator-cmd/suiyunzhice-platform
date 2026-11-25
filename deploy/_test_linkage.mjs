/**
 * 联动闭环回归测试 —— 针对三个真实缺陷：
 *
 *   BUG 1 地面复核证据自激循环
 *        evaluateDetection() 不知道这条检测来自机器人，
 *        机器人回传的近距复核结果又被判为「需复核」→ 再派单 → 再复核，
 *        形成自激循环。表现为派单量暴涨、机器人追不上派单队列。
 *
 *   BUG 2 待闭环事件互相覆盖
 *        pending 用网格做键，同一网格上的后一个事件覆盖前一个，
 *        前一个永远等不到闭合证据 → 闭环完成率被凭空拉低。
 *
 *   BUG 3 执行段时延被派单积压放大
 *        completeCycle 的 act = 落到现在 − 派单时刻，
 *        派单积压（BUG 1）会把这段时延放大到几百秒。
 *
 * 修法（shared/linkage.js，三运行时共用）：
 *   1. evaluateDetection 对 kind==='robot' 直接判为无需再复核；
 *   2. pending 改为「网格 → 队列」，闭合时取最早一条；
 *   3. act 改为「下发 → 到位」中扣掉排队等待，只计本条事件的执行时长。
 */

import { LinkageEngine } from '../shared/linkage.js';
import { MemoryStore } from '../shared/memstore.js';

/* ---------- 极简 store：只实现 LinkageEngine 用到的两个方法 ---------- */
class FakeStore {
  constructor() { this.events = []; }
  insertLinkEvent(e) {
    const i = this.events.findIndex(x => x.eventId === e.eventId);
    if (i >= 0) this.events[i] = e; else this.events.push(e);
  }
  listLinkEvents(limit = 200) {
    return this.events.slice()
      .sort((a, b) => (b.ts - a.ts) || String(b.eventId).localeCompare(String(a.eventId)))
      .slice(0, limit);
  }
}

let pass = 0, fail = 0;
function check(name, cond, detail = '') {
  if (cond) { pass++; console.log(`✓ ${name}`); }
  else { fail++; console.log(`✗ ${name} ${detail}`); }
}

const det = (over = {}) => ({
  detId: 'D-1', ts: Date.now(), deviceId: 'UAV-01', kind: 'uav',
  part: 'leaf', disease: 'rust', confidence: 0.6,
  grid: { row: 5, col: 7 }, ...over,
});

/* ============ BUG 1：地面复核证据不得再触发复核 ============ */
{
  const store = new FakeStore();
  const engine = new LinkageEngine({ store });

  // 1) 空中低置信度 → 需要复核
  const v1 = engine.evaluateDetection(det());
  check('BUG1 空中低置信度仍判为需复核', v1.needRecheck === true);

  // 2) 地面机器人回传的复核证据 → 不得再触发复核
  const v2 = engine.evaluateDetection(det({
    kind: 'robot', deviceId: 'ROB-01', part: 'stem',
    disease: 'fusarium', confidence: 0.93,
  }));
  check('BUG1 地面复核证据不再触发复核', v2.needRecheck === false,
    `实际 needRecheck=${v2.needRecheck}`);

  // 3) 走完整闭环：空中派单 → 机器人证据 → 闭合，且不再产生第二条事件
  const ev = engine.runLinkageCycle({ uavDet: det(), field: null, planning: null });
  check('BUG1 派单后事件数为 1', store.events.length === 1);
  check('BUG1 派单事件初始为未闭环', ev.closed === false);

  const closed = engine.completeCycle(det({
    kind: 'robot', deviceId: 'ROB-01', part: 'stem',
    disease: 'rust', confidence: 0.93,
    grid: { row: 5, col: 7 },
  }));
  check('BUG1 复核证据闭合了派单事件', closed && closed.closed === true);
  check('BUG1 闭合后事件数仍为 1（无自激增殖）', store.events.length === 1,
    `实际 ${store.events.length}`);
}

/* ============ BUG 2：每条派单都要能各自闭合（不得互相覆盖） ============ */
{
  const store = new FakeStore();
  const engine = new LinkageEngine({ store });

  // 四个**不同区块**各派一单（区块步长 3）
  const grids = [[1, 1], [4, 10], [7, 7], [10, 13]];
  for (const [r, c] of grids) {
    engine.runLinkageCycle({ uavDet: det({ grid: { row: r, col: c } }), field: null, planning: null });
  }
  check('BUG2 四个区块派单建了 4 条事件', store.events.length === 4,
    `实际 ${store.events.length}`);

  // 4 份证据依次到达，应闭合 4 条
  let closedCount = 0;
  for (const [r, c] of grids) {
    const c2 = engine.completeCycle(det({
      kind: 'robot', deviceId: 'ROB-01', part: 'stem', confidence: 0.9,
      grid: { row: r, col: c },
    }));
    if (c2 && c2.closed) closedCount++;
  }
  check('BUG2 四份证据闭合四条事件', closedCount === 4, `实际 ${closedCount}`);

  const st = engine.stats();
  check('BUG2 闭环完成率 100%', st.closedRatio === 100, `实际 ${st.closedRatio}%`);
  check('BUG2 无待闭环残留', st.pendingCount === 0, `实际 ${st.pendingCount}`);
}

/* ============ BUG 3：执行段时延不被派单积压放大 ============ */
{
  const store = new FakeStore();
  const engine = new LinkageEngine({ store });

  const ev = engine.runLinkageCycle({ uavDet: det(), field: null, planning: null });
  // 模拟「机器人在队列里等了很久才轮到这一单」：
  // 派单时刻在 300 秒前，机器人 20 秒前才开始干这一单，现在证据到达。
  ev.dispatchedAt = Date.now() - 300_000;
  ev.ts = ev.dispatchedAt;
  const startedAt = Date.now() - 20_000;

  const closed = engine.completeCycle(det({
    kind: 'robot', deviceId: 'ROB-01', part: 'stem', confidence: 0.9,
    grid: { row: 5, col: 7 },
    recheckStartedAt: startedAt,
  }));
  check('BUG3 证据闭合成功', !!closed);
  // 执行段时延应当是本条事件自身的执行时长，不应包含前面排队的时间
  const act = closed.latency.act;
  check('BUG3 执行段时延不含排队时间（< 60s）', act < 60_000, `实际 ${act}ms`);
  check('BUG3 排队等待被单独记录', closed.queueWaitMs > 250_000,
    `实际 ${closed.queueWaitMs}ms`);
}

/* ============ BUG 3b：证据无开始时刻时退回派单时刻 ============ */
{
  const store = new FakeStore();
  const engine = new LinkageEngine({ store });
  const ev = engine.runLinkageCycle({ uavDet: det(), field: null, planning: null });
  ev.dispatchedAt = Date.now() - 10_000;
  const closed = engine.completeCycle(det({
    kind: 'robot', deviceId: 'ROB-01', part: 'stem', confidence: 0.9,
    grid: { row: 5, col: 7 },
  }));
  check('BUG3b 无开始时刻时退回派单时刻计时',
    closed.latency.act >= 9_000 && closed.latency.act < 30_000,
    `实际 ${closed.latency.act}ms`);
}

/* ============ 回归：相邻格证据也能闭合（空中点与地面点差一格） ============ */
{
  const store = new FakeStore();
  const engine = new LinkageEngine({ store });
  engine.runLinkageCycle({ uavDet: det(), field: null, planning: null });
  // 机器人实际到位点落在相邻网格（到位判定有 1.2 m 容差，5 m 网格下会差一格）
  const closed = engine.completeCycle(det({
    kind: 'robot', deviceId: 'ROB-01', part: 'stem', confidence: 0.9,
    grid: { row: 5, col: 8 },
  }));
  check('相邻格证据能闭合事件', !!closed && closed.closed === true);
  check('相邻格闭合后闭环完成率 100%', engine.stats().closedRatio === 100,
    `实际 ${engine.stats().closedRatio}%`);
}

/* ============ 回归：远处网格的证据不得闭合 ============ */
{
  const store = new FakeStore();
  const engine = new LinkageEngine({ store });
  engine.runLinkageCycle({ uavDet: det(), field: null, planning: null });
  const c = engine.completeCycle(det({
    kind: 'robot', deviceId: 'ROB-01', part: 'stem', confidence: 0.9,
    grid: { row: 12, col: 19 },
  }));
  check('远处网格的证据不闭合事件', c === null);
}

/* ============ 回归：无证据时不得凭空闭合 ============ */
{
  const store = new FakeStore();
  const engine = new LinkageEngine({ store });
  const c = engine.completeCycle(det({ kind: 'robot', grid: { row: 99, col: 99 } }));
  check('无关网格的证据不闭合任何事件', c === null);
}

/* ============ 回归：同格已有未闭合派单时不再重复建事件 ============ */
{
  const store = new FakeStore();
  const engine = new LinkageEngine({ store });

  const e1 = engine.runLinkageCycle({ uavDet: det(), field: null, planning: null });
  check('同格首次派单建事件', !!e1);
  const e2 = engine.runLinkageCycle({ uavDet: det(), field: null, planning: null });
  check('同格二次派单不再建事件', e2 === null);
  check('同格派单后事件数仍为 1', store.events.length === 1, `实际 ${store.events.length}`);

  // 闭合后同格可以再派
  engine.completeCycle(det({
    kind: 'robot', deviceId: 'ROB-01', part: 'stem', confidence: 0.9,
    grid: { row: 5, col: 7 },
  }));
  const e3 = engine.runLinkageCycle({ uavDet: det(), field: null, planning: null });
  check('闭合后同格可再次派单', !!e3);
}

/* ============ 回归：一趟复核顺带闭合周边区块的派单 ============ */
{
  const store = new FakeStore();
  const engine = new LinkageEngine({ store });

  // 相邻两个区块各派一单：
  //   区块 (1,2) = 行3-5/列6-8；区块 (2,2) = 行6-8/列6-8
  //   机器人在 (5,7) 一趟，覆盖行4-6/列6-8 → 跨这两个区块
  engine.runLinkageCycle({ uavDet: det({ grid: { row: 5, col: 7 } }), field: null, planning: null });
  engine.runLinkageCycle({ uavDet: det({ grid: { row: 6, col: 8 } }), field: null, planning: null });
  check('相邻两区块建了 2 条事件', store.events.length === 2, `实际 ${store.events.length}`);

  // 机器人在中心格完成复核 —— 一趟 3×3 覆盖到隔壁区块
  engine.completeCycle(det({
    kind: 'robot', deviceId: 'ROB-01', part: 'stem', confidence: 0.9,
    grid: { row: 5, col: 7 },
  }));
  const st = engine.stats();
  check('一趟复核闭合了相邻区块的两条事件', st.closedCount === 2, `实际 ${st.closedCount}`);
  check('顺带闭合后无待闭环残留', st.pendingCount === 0, `实际 ${st.pendingCount}`);
}

/* ============ 回归：远处区块的派单不被顺带闭合 ============ */
{
  const store = new FakeStore();
  const engine = new LinkageEngine({ store });

  engine.runLinkageCycle({ uavDet: det({ grid: { row: 5, col: 7 } }), field: null, planning: null });
  engine.runLinkageCycle({ uavDet: det({ grid: { row: 10, col: 10 } }), field: null, planning: null });

  engine.completeCycle(det({
    kind: 'robot', deviceId: 'ROB-01', part: 'stem', confidence: 0.9,
    grid: { row: 5, col: 7 },
  }));
  const st = engine.stats();
  check('远处派单不被顺带闭合', st.closedCount === 1 && st.pendingCount === 1,
    `closed=${st.closedCount} pending=${st.pendingCount}`);
}

/* ============ 回归：DO 被驱逐后能从存储重建待闭环队列 ============ */
{
  const store = new FakeStore();
  const engine = new LinkageEngine({ store });
  // 两个**不同**网格各派一单，都等闭合
  engine.runLinkageCycle({ uavDet: det(), field: null, planning: null });
  engine.runLinkageCycle({ uavDet: det({ grid: { row: 5, col: 9 } }), field: null, planning: null });
  // 只给一份证据 → 另一单仍未闭合
  engine.completeCycle(det({
    kind: 'robot', deviceId: 'ROB-01', part: 'stem', confidence: 0.9,
    grid: { row: 5, col: 7 },
  }));
  const openBefore = store.events.filter(e => !e.closed).length;
  check('DO 驱逐前：恰好一条未闭合', openBefore === 1, `实际 ${openBefore}`);

  // 模拟 DO 被驱逐：新建引擎（内存队列为空），但存储还在
  const engine2 = new LinkageEngine({ store });
  const n = engine2.restorePending(store.listLinkEvents(200));
  check('从存储重建出 1 条待闭环事件', n === 1, `实际 ${n}`);

  // 重建后，迟到的证据仍能闭合它（证据落在未闭合那一格）
  const closed = engine2.completeCycle(det({
    kind: 'robot', deviceId: 'ROB-01', part: 'stem', confidence: 0.9,
    grid: { row: 5, col: 9 },
  }));
  check('重建后迟到的证据能闭合事件', !!closed && closed.closed === true);
  check('重建后闭环完成率 100%', engine2.stats().closedRatio === 100,
    `实际 ${engine2.stats().closedRatio}%`);
}

console.log(`\n联动闭环回归测试：${pass} 通过 / ${fail} 失败`);
if (fail) process.exit(1);
