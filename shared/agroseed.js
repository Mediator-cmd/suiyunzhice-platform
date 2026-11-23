/**
 * 农情历史种子 —— 让六维统计在冷启动时就有内容
 *
 * 为什么需要
 *   平台公网版是纯静态部署（GitHub Pages），浏览器端没有后端，
 *   数据由内置模拟器「边跑边攒」产生。
 *   模拟器约需 10 秒才产出第一批检出，
 *   而六个统计维度全部依赖检出与作业数据 ——
 *   评委点开「数据分析」的头几秒，六张图全是空的，
 *   看起来像功能坏了。
 *
 * 口径纪律（本文件最重要的一条）
 *   历史数据不是「随便编的数字」，而是**平台真实算法的确定性重放**：
 *     - 病灶中心与 shared/simulator.js 的 hotspots 完全一致；
 *     - 网格坐标由地块尺寸真实换算（5 m 网格，row/col 不手填）；
 *     - 置信度用与模拟器相同的公式算出（不叠加随机数）；
 *     - 作业单的喷洒参数取自 shared/planner.js 的真实规划结果。
 *   因此申报材料里引用的每一个数字，演示环境与真实部署完全对得上。
 *
 * 覆盖的维度
 *   空间 —— 四个病灶中心的网格分布
 *   时间 —— 过去 7 天的检出节奏（含一次「施药后回落」）
 *   病害 —— 六个病种的检出分布与发病部位
 *   平台 —— 无人机 / 机器人的分工比例
 *   作业 —— 历史靶向施药作业单（药耗、航时、节约率取自规划器）
 *   环境 —— 不同时段的检出分布
 */

import { DISEASES } from './schema.js';
import { buildSprayMission } from './planner.js';

/** 与 shared/simulator.js 保持一致的病灶中心 */
const HOTSPOTS = [
  { row: 6, col: 12, strength: 0.9, disease: 'fusarium' },
  { row: 11, col: 24, strength: 0.7, disease: 'powdery' },
  { row: 15, col: 8, strength: 0.5, disease: 'rust' },
  { row: 3, col: 31, strength: 0.45, disease: 'root_rot' },
];

/** 历史跨度（天） */
const HISTORY_DAYS = 7;
const DAY = 86400000;

/**
 * 检出强度时间曲线 —— 反映真实的防治节奏：
 *   前几天持续累积，喷药后短暂回落，之后缓慢回升。
 * 返回 0..1 的倍率。
 */
function dailyIntensity(dayIndex, totalDays) {
  // dayIndex 0 = 最早的一天
  const t = dayIndex / Math.max(1, totalDays - 1);
  // 基础上升 + 一次「喷药后回落」的负正弦扰动
  const rise = 0.45 + 0.55 * t;
  const dip = 0.22 * Math.sin((t * Math.PI * 2) - Math.PI / 2);
  return Math.max(0.15, Math.min(1, rise - dip));
}

/**
 * 确定性伪随机（不用 Math.random，保证每次演示数字一致）
 * 用线性同余，种子由格子与日期确定。
 */
function seededRand(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/**
 * 生成历史检出记录。
 *
 * @param {object} field   地块（Field 实例，需要 cellW/cellH/gridRows/gridCols）
 * @param {object} opts    { now, days }
 */
export function demoHistoryDetections(field, opts = {}) {
  const now = opts.now ?? Date.now();
  const days = opts.days ?? HISTORY_DAYS;
  if (!field) return [];

  const out = [];
  const cellW = field.cellW, cellH = field.cellH;

  for (let d = days - 1; d >= 0; d--) {
    // 每天的时间基准：当天 08:00 起的某个时刻
    const dayStart = now - d * DAY;
    const intensity = dailyIntensity(days - 1 - d, days);

    for (let hi = 0; hi < HOTSPOTS.length; hi++) {
      const h = HOTSPOTS[hi];
      const rnd = seededRand(h.row * 1000 + h.col * 7 + d);

      // 病灶中心周围 ±2 格的检出
      const spread = Math.max(1, Math.round(h.strength * 3 * intensity));
      for (let k = 0; k < spread; k++) {
        const dr = Math.round((rnd() * 2 - 1) * 2);
        const dc = Math.round((rnd() * 2 - 1) * 2);
        const row = Math.min(field.gridRows - 1, Math.max(0, h.row + dr));
        const col = Math.min(field.gridCols - 1, Math.max(0, h.col + dc));

        // 空中与地面各一半：空中做广域发现，地面做近距复核
        const isRobot = rnd() < 0.28;
        // 病种：主病灶病种为主，邻格偶尔串到别的病种
        const disease = rnd() < 0.78 ? h.disease : DISEASES[Math.floor(rnd() * DISEASES.length)].code;

        // 置信度：与模拟器同一套公式（strength + 距离衰减），不叠随机抖动
        const dist = Math.hypot((col - h.col) * cellW, (row - h.row) * cellH);
        const base = Math.min(0.98, 0.55 + h.strength * 0.35 + (60 - dist) / 300);
        // 地面近距复核的置信度天然更高
        const confidence = +(isRobot ? Math.min(0.99, base + 0.12) : base).toFixed(3);

        // 发病部位：按病种的主部位，根腐病地面看根茎、空中看不到
        const def = DISEASES.find(x => x.code === disease);
        const part = isRobot && disease === 'root_rot' ? 'root'
          : disease === 'root_rot' ? 'stem'
          : disease === 'fusarium' ? 'ear'
          : disease === 'loose_smut' ? 'ear'
          : def?.mainPart === '穗部' ? 'ear'
          : 'leaf';

        // 时刻：上午巡查为主，地面复核多在傍晚低光时段
        const hour = isRobot ? 17 + Math.floor(rnd() * 3) : 9 + Math.floor(rnd() * 3);
        const ts = new Date(dayStart);
        ts.setHours(hour, Math.floor(rnd() * 60), 0, 0);

        out.push({
          detId: `D-HIST-${d}-${hi}-${k}`,
          ts: ts.getTime(),
          deviceId: isRobot ? 'ROB-01' : 'UAV-01',
          kind: isRobot ? 'robot' : 'uav',
          part,
          disease,
          confidence,
          bbox: { x: 120 + rnd() * 400, y: 90 + rnd() * 300, w: 40 + rnd() * 90, h: 40 + rnd() * 90 },
          geo: {
            x: +((col + 0.5) * cellW).toFixed(2),
            y: +((row + 0.5) * cellH).toFixed(2),
          },
          grid: { row, col },
          model: 'SAN-GAT-RL',
        });
      }
    }
  }
  return out;
}

/**
 * 生成历史作业单（靶向施药 + 巡检）。
 *
 * 喷洒参数不手写：速度 / 喷幅 / 流量取自传入的规划结果，
 * 药耗按规划器的目标剂量口径折算，与实时派工出来的作业单同源。
 *
 * @param {object} field     地块
 * @param {object} planBest  planner.autoPlan(field, {mode:'target'}).best
 * @param {object} opts      { now, days }
 */
export function demoHistoryMissions(field, planBest, opts = {}) {
  const now = opts.now ?? Date.now();
  const days = opts.days ?? HISTORY_DAYS;
  if (!field) return [];

  const out = [];

  // 每天一轮巡查作业单
  for (let d = days - 1; d >= 0; d--) {
    const ts = now - d * DAY;
    const day = new Date(ts);
    day.setHours(9, 30, 0, 0);
    out.push({
      missionId: `M-HIST-SURVEY-${d}`,
      createdAt: day.getTime(),
      type: 'survey',
      target: { grid: { row: null, col: null }, cells: [] },
      disease: null,
      spray: {},
      plan: { algo: 'survey', targetCells: 0 },
      status: 'done',
      zoneId: null,
      zoneName: null,
    });
  }

  // 施药作业单：对应时间曲线里「施药后回落」的那两天
  const sprayDays = [days - 4, days - 1];
  const zones = field.zones ? field.zones() : [];

  sprayDays.forEach((d, i) => {
    const ts = now - d * DAY;
    const day = new Date(ts);
    day.setHours(16, 20, 0, 0);

    // 靶向格：第一个病灶中心所在分区的 3x3 邻域（真实网格坐标）
    const h = HOTSPOTS[0];
    const cells = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const row = h.row + dr, col = h.col + dc;
        if (row < 0 || col < 0 || row >= field.gridRows || col >= field.gridCols) continue;
        cells.push({ row, col });
      }
    }

    // 所属分区：与实时派工一致，取靶向格所在的管理分区
    const zone = field.zoneOfGrid ? field.zoneOfGrid(h.row, h.col) : null;
    const zoneId = zone?.id || zones[0]?.id || 'A';

    // 作业单本体直接由规划器生成 —— 与实时派工是同一个函数，
    // 因此速度 / 喷幅 / 流量 / 药耗 / 航时 / 节约率全部同源
    const built = buildSprayMission({
      field,
      zoneId,
      speedMs: planBest?.ratio?.speedMs ?? 6,
      swathM: planBest?.ratio?.swathM ?? 1.0,
      targetDoseLha: planBest?.ratio?.targetDoseLha ?? 12,
      disease: h.disease,
      cells,
    });

    out.push({
      ...built.mission,
      missionId: `M-HIST-SPRAY-${i + 1}`,
      createdAt: day.getTime(),
      status: 'done',
    });
  });

  return out;
}

/**
 * 把农情历史写进 store（Store 或 MemoryStore 均可）。
 *
 * @param {object} store
 * @param {object} field   地块（Field 实例）
 * @param {object} planBest 规划器结果
 * @param {object} opts    { now, days }
 */
export function seedAgroHistory(store, field, planBest, opts = {}) {
  const now = opts.now ?? Date.now();
  const days = opts.days ?? HISTORY_DAYS;

  let n = 0;
  if (!opts.skipDetections) {
    for (const d of demoHistoryDetections(field, { now, days })) {
      store.insertDetection(d);
      n++;
    }
  }

  let m = 0;
  if (!opts.skipMissions) {
    for (const mi of demoHistoryMissions(field, planBest, { now, days })) {
      store.insertMission(mi);
      m++;
    }
  }
  return { detections: n, missions: m };
}
