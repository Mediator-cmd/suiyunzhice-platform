/**
 * 靶向施药任务生成器 —— 把「确诊病灶」翻译成「可下发的无人机作业单」
 *
 * 完整闭环：
 *   UAV 发现 → 云端复核 → 机器人近距确认 → 云端确诊
 *     → 生成分区靶向施药作业单（航向×速度×喷幅）
 *     → 下发 UAV（速度-喷洒比例锁定）→ 执行 → 回传节药数据
 *
 * 为什么放在 shared/：
 *   服务端（Node + SQLite）与浏览器（GitHub Pages 静态演示）必须算出
 *   完全相同的作业单与节药率，否则申报材料里的数字对不上现场演示。
 *
 * 作业单里的核心不变量（老师提问的「飞行速度与喷洒速度的比例」）：
 *   喷洒流量(L/min) ÷ 飞行速度(m/s) = 常数 flowPerSpeed
 *   变速飞行时喷阀按同一比例同步调流 → 单位面积药量恒定 → 不漏喷、不超喷。
 */

import { buildSprayMission, spraySavingRatio } from './planner.js';

/** 靶向点喷：1m 窄幅喷施机构（申报书中的窄幅喷头） */
export const TARGET_SPRAY = {
  swathM: 1.0,
  targetDoseLha: 12,
  /** 触发阈值：网格累计检出达到该密度即视为需要处置 */
  densityThreshold: 2,
  /** 单次作业最多覆盖的管理分区数 */
  maxZonesPerRound: 2,
  /** 药剂表：按病害选择 */
  agents: {
    rust: '戊唑醇·苯醚甲环唑',
    powdery: '三唑酮·戊唑醇',
    loose_smut: '井冈霉素·蜡芽菌',
    root_rot: '恶霉灵·甲基硫菌灵',
    fusarium: '戊唑醇·苯醚甲环唑',
    leaf_blight: '代森锰锌·多菌灵',
  },
};

/**
 * 依据确诊结果挑选需要作业的管理分区。
 *
 * @param {object[]} dets   检测结果
 * @param {object[]} missions 已有任务（用于跳过已派工分区）
 * @param {Field} field
 */
export function pickSprayZones(dets, missions, field) {
  // 注意：必须用「全部」任务判断已派工，而不是列表前 N 条 ——
  // 复核任务数量远多于施药任务，取前 N 条会把早先的施药记录挤掉，
  // 导致同一分区被反复派工。
  const done = new Set(
    missions.filter(m => m.type === 'spray').map(m => m.zoneId || m.target?.zone)
      .filter(Boolean));

  // 网格 → 分区 聚合密度
  const byZone = new Map();
  for (const d of dets) {
    if (d.confidence < 0.75) continue;           // 只对确诊的病灶派工
    const zid = field.zoneOfGrid(d.grid.row, d.grid.col);
    if (!zid) continue;
    const key = zid;
    if (!byZone.has(key)) {
      byZone.set(key, { zoneId: key, cells: [], count: 0, diseases: {}, confSum: 0 });
    }
    const z = byZone.get(key);
    z.cells.push({ row: d.grid.row, col: d.grid.col });
    z.count += 1;
    z.confSum += d.confidence;
    z.diseases[d.disease] = (z.diseases[d.disease] || 0) + 1;
  }

  const zones = [...byZone.values()].map(z => ({
    zoneId: z.zoneId,
    cells: z.cells,
    count: z.count,
    avgConfidence: +(z.confSum / z.count).toFixed(3),
    topDisease: Object.entries(z.diseases).sort((a, b) => b[1] - a[1])[0][0],
    done: done.has(z.zoneId),
  }));

  // 未派工 + 密度达标 → 优先处置
  return zones
    .filter(z => !z.done && z.count >= TARGET_SPRAY.densityThreshold)
    .sort((a, b) => b.count - a.count);
}

/**
 * 生成一批靶向施药作业单。
 *
 * @returns {Array<{mission: object, route: object, ratio: object}>}
 */
export function buildSprayMissions({ field, dets, missions, plan = null }) {
  const targets = pickSprayZones(dets, missions, field);
  const chosen = targets.slice(0, TARGET_SPRAY.maxZonesPerRound);
  const out = [];

  for (const t of chosen) {
    // 用平台自动规划出的航向/速度/喷幅做靶向喷洒
    const heading = plan?.route?.headingDeg ?? 90;
    const speed = plan?.route?.speedMs ?? 6;
    const built = buildSprayMission({
      field,
      zoneId: t.zoneId,
      headingDeg: heading,
      speedMs: speed,
      swathM: TARGET_SPRAY.swathM,
      targetDoseLha: TARGET_SPRAY.targetDoseLha,
      disease: t.topDisease,
      cells: t.cells,
      agent: TARGET_SPRAY.agents[t.topDisease] || TARGET_SPRAY.agents.rust,
    });

    const missionId = `SP-${Date.now()}-${t.zoneId}`;
    out.push({
      ...built,
      mission: { ...built.mission, missionId, createdAt: Date.now() },
      hotspot: t,
    });
  }
  return out;
}

/**
 * 节药率统计（直接复用 planner 的口径，保证与作业单一致）
 */
export function savingSummary(missions, field) {
  return spraySavingRatio(missions, field, TARGET_SPRAY.targetDoseLha);
}
