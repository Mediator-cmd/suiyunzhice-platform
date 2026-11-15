/**
 * 路径规划求解器 —— 平台"自动规划"核心
 *
 * 老师的问题：
 *   在大面积喷洒时，怎么飞？飞行速度和喷洒速度的比例怎么调？
 *   轨迹怎么调最经济、最快速、最环保？
 *
 * 本模块实现：
 *   1) 田块 → 网格化；两种作业模式：全田覆盖 / 靶向点喷
 *   2) 覆盖率驱动的航线生成（蛇形往返 + 头地转弯），支持任意航向
 *   3) 速度-喷洒比例自动求解（流量 = 速度 × 喷幅 × 剂量），并给出不漏喷/不超喷的可行速度区间
 *   4) 多目标打分：经济 / 快速 / 环保，三者加权可调，评分在候选集内归一化
 *   5) 与人工手画航线对比，量化效率提升
 */

import { PLAN_OBJECTIVES, SPRAY_RATIO_NOTE } from './schema.js';

/** 田块：外接矩形 + 不作业障碍区（渠道、水塘、房舍） */
export class Field {
  constructor({ id, name, widthM, heightM, gridRows = 20, gridCols = 40, obstacles = [], soil = 'loam', zoneCols = 4, zoneRows = 2 }) {
    this.id = id;
    this.name = name;
    this.widthM = widthM;
    this.heightM = heightM;
    this.gridRows = gridRows;
    this.gridCols = gridCols;
    this.obstacles = obstacles;
    this.soil = soil;
    /** 管理分区：把田块划成 zoneCols × zoneRows 个作业分区（A~H） */
    this.zoneCols = zoneCols;
    this.zoneRows = zoneRows;
  }

  get cellW() { return this.widthM / this.gridCols; }
  get cellH() { return this.heightM / this.gridRows; }
  get cellAreaHa() { return (this.cellW * this.cellH) / 10000; }

  /** 管理分区的字母编号：A, B, C...（自西向东、自北向南） */
  get zoneLetters() {
    const out = [];
    for (let i = 0; i < this.zoneCols * this.zoneRows; i++) {
      out.push(String.fromCharCode(65 + (i % 26)));
    }
    return out;
  }

  /** 列出全部管理分区及其几何范围（与前端地图上的 A~H 划分一致） */
  zones() {
    const zw = this.widthM / this.zoneCols;
    const zh = this.heightM / this.zoneRows;
    const out = [];
    for (let r = 0; r < this.zoneRows; r++) {
      for (let c = 0; c < this.zoneCols; c++) {
        const i = r * this.zoneCols + c;
        const x = c * zw, y = r * zh;
        // 分区内的网格列/行范围
        const c0 = Math.floor((x / this.widthM) * this.gridCols);
        const c1 = Math.ceil(((x + zw) / this.widthM) * this.gridCols);
        const r0 = Math.floor((y / this.heightM) * this.gridRows);
        const r1 = Math.ceil(((y + zh) / this.heightM) * this.gridRows);
        out.push({
          id: this.zoneLetters[i] || String(i + 1),
          index: i, row: r, col: c,
          x, y, w: zw, h: zh,
          areaHa: (zw * zh) / 10000,
          gridRange: { r0, r1, c0, c1 },
        });
      }
    }
    return out;
  }

  /** 某个网格属于哪个管理分区 */
  zoneOfGrid(row, col) {
    const c = Math.floor((col / this.gridCols) * this.zoneCols);
    const r = Math.floor((row / this.gridRows) * this.zoneRows);
    const i = r * this.zoneCols + c;
    return this.zoneLetters[i] || String(i + 1);
  }

  cellCenter(row, col) {
    return { x: (col + 0.5) * this.cellW, y: (row + 0.5) * this.cellH };
  }

  isBlocked(row, col) {
    const c = this.cellCenter(row, col);
    const hw = this.cellW / 2, hh = this.cellH / 2;
    return this.obstacles.some(o =>
      c.x + hw > o.x && c.x - hw < o.x + o.w &&
      c.y + hh > o.y && c.y - hh < o.y + o.h);
  }

  workCells() {
    const out = [];
    for (let r = 0; r < this.gridRows; r++)
      for (let c = 0; c < this.gridCols; c++)
        if (!this.isBlocked(r, c)) out.push({ row: r, col: c, ...this.cellCenter(r, c) });
    return out;
  }

  totalAreaHa() { return (this.widthM * this.heightM) / 10000; }
  workableAreaHa() { return this.workCells().length * this.cellAreaHa; }
}

/**
 * 作业模式
 *  full   全田作业：整机喷幅（4–7m），追求覆盖率与效率
 *  target 靶向点喷：1m 窄幅（申报书窄幅喷施机构），只覆盖病灶网格
 */
export const MODES = {
  full: {
    key: 'full', name: '全田覆盖作业',
    desc: '使用整机喷幅连续往返，覆盖全部可作业面积。适用于初发期尚未成片的田块。',
    swathCandidates: [4.0, 5.0, 6.0, 7.0],
  },
  target: {
    key: 'target', name: '靶向点喷作业',
    desc: '启用 1m 窄幅喷施机构，仅对确诊病灶网格施药。适用于病害已明确、需要"只打有病的地方"。',
    swathCandidates: [1.0],
  },
};

/**
 * 生成喷洒航线（蛇形往返）。
 * 关键点：喷幅决定行距；航向决定主轴；头地（turning bay）占用额外土地，是经济性的主要来源。
 */
export function generateSprayRoute(field, {
  swathM = 5.0,
  headingDeg = 90,
  speedMs = 6,
  turnRadiusM = 2.5,
  altM = 2.0,
  targetDoseLha = 12,
  mode = 'full',
  targetCells = null,
  zoneId = null,
} = {}) {
  // 作业区域：全田 / 单个管理分区 / 靶向网格
  let region = { x0: 0, y0: 0, x1: field.widthM, y1: field.heightM };
  let regionAreaHa = field.totalAreaHa();
  let effectiveCells = null;

  const points = [];
  const legs = [];

  // ---- 管理分区作业：只喷指定的 A~H 分区（如"仅处置 C 区"） ----
  if (mode === 'zone' && zoneId) {
    const zone = field.zones().find(z => z.id === zoneId);
    if (!zone) throw new Error(`未知管理分区 ${zoneId}`);
    region = { x0: zone.x, y0: zone.y, x1: zone.x + zone.w, y1: zone.y + zone.h };
    regionAreaHa = zone.areaHa;
    effectiveCells = { zone };

    const regW = region.x1 - region.x0;
    const regH = region.y1 - region.y0;
    const horizontal = headingDeg % 180 === 0;
    const alongLen = horizontal ? regW : regH;
    const acrossLen = horizontal ? regH : regW;
    const nLines = Math.max(1, Math.ceil(acrossLen / swathM));
    const actualSpacing = acrossLen / nLines;

    for (let i = 0; i < nLines; i++) {
      const across = region.y0 + (i + 0.5) * actualSpacing;
      const a = horizontal ? { x: region.x0, y: across } : { x: across, y: region.y0 };
      const b = horizontal ? { x: region.x1, y: across } : { x: across, y: region.y1 };
      const start = { x: a.x, y: a.y, z: altM, spd: speedMs, hdg: headingDeg, line: i, zone: zone.id };
      const end = { x: b.x, y: b.y, z: altM, spd: speedMs, hdg: headingDeg + 180, line: i, zone: zone.id };
      const seq = i % 2 === 0 ? [start, end] : [end, start];
      points.push(...seq);
      legs.push({ line: i, zone: zone.id, from: seq[0], to: seq[1], length: alongLen, spraySeconds: alongLen / speedMs });
    }

    const nTurns = Math.max(0, nLines - 1);
    const turnLength = nTurns * (Math.PI * turnRadiusM);
    const turnSeconds = nTurns * (Math.PI * turnRadiusM / speedMs) * 1.35;
    const sprayLength = nLines * alongLen;
    const coveredAreaHa = (nLines * actualSpacing * alongLen) / 10000;

    return {
      field: field.id, mode, zoneId: zone.id, swathM, headingDeg, speedMs, altM,
      nLines, region, effectiveCells,
      lineSpacing: actualSpacing,
      overlapRatio: actualSpacing > swathM ? 1 - swathM / actualSpacing : 0,
      points, legs,
      regionAreaHa,
      sprayLengthM: sprayLength,
      totalLengthM: sprayLength + turnLength,
      turningLengthM: turnLength,
      turnSeconds,
      spraySeconds: sprayLength / speedMs,
      coveredAreaHa,
      targetDoseLha,
      targetCoverage: null,
      spillAreaHa: 0,
    };
  }

  if (mode === 'target' && targetCells && targetCells.length) {
    const cw = field.cellW, ch = field.cellH;
    // 把散乱的病灶网格聚成若干簇，每簇单独规划
    const clusters = clusterCells(targetCells, cw, ch);
    let totalLen = 0, totalSprayLen = 0, totalTurnLen = 0, totalSpraySec = 0, totalTurnSec = 0;
    let maxLines = 0;

    for (const cl of clusters) {
      const horiz = headingDeg % 180 === 0;
      // 簇内网格排序：沿主轴方向排序，形成连续往返
      const sorted = [...cl.cells].sort((a, b) =>
        horiz ? (a.col - b.col) || (a.row - b.row) : (a.row - b.row) || (a.col - b.col));

      for (const cell of sorted) {
        const cx = (cell.col + 0.5) * cw;   // 网格中心
        const cy = (cell.row + 0.5) * ch;
        // 窄幅喷幅不足以覆盖整个 5m 网格 → 需在网格内并排多条喷洒带
        // 条带数 = ceil(跨向网格尺寸 / 喷幅)
        const acrossSize = horiz ? ch : cw;      // 跨航向的网格尺寸
        const alongLen = horiz ? cw : ch;       // 沿航向穿过整个网格
        const nPasses = Math.max(1, Math.ceil(acrossSize / swathM));
        const passSpacing = acrossSize / nPasses;

        for (let p = 0; p < nPasses; p++) {
          const across = (horiz ? cy - acrossSize / 2 : cx - acrossSize / 2) + (p + 0.5) * passSpacing;
          const a = horiz
            ? { x: cx - cw / 2, y: across }
            : { x: across, y: cy - ch / 2 };
          const b = horiz
            ? { x: cx + cw / 2, y: across }
            : { x: across, y: cy + ch / 2 };
          const start = { x: a.x, y: a.y, z: altM, spd: speedMs, hdg: headingDeg, line: maxLines, cluster: cl.id };
          const end = { x: b.x, y: b.y, z: altM, spd: speedMs, hdg: headingDeg + 180, line: maxLines, cluster: cl.id };
          const seq = [start, end];
          points.push(...seq);
          legs.push({
            line: maxLines, cluster: cl.id, from: seq[0], to: seq[1],
            length: alongLen, spraySeconds: alongLen / speedMs,
          });
          totalLen += alongLen;
          totalSprayLen += alongLen;
          totalSpraySec += alongLen / speedMs;
          maxLines++;
        }
      }
    }

    // 簇间与格间转移航程（不喷药）
    const allPts = points;
    let transferLen = 0, transferSec = 0;
    for (let i = 1; i < allPts.length; i++) {
      const d = Math.hypot(allPts[i].x - allPts[i - 1].x, allPts[i].y - allPts[i - 1].y);
      if (d > 0.01) {
        transferLen += d;
        transferSec += d / (speedMs * 1.6);   // 转场提速
      }
    }
    totalLen += transferLen;
    totalSpraySec += transferSec;

    const targetAreaHa = targetCells.length * field.cellAreaHa;
    // 实际喷到的面积 = 喷洒长度 × 喷幅（1m 窄幅扫过网格）
    const coveredAreaHa = (totalSprayLen * swathM) / 10000;

    return {
      field: field.id, mode, swathM, headingDeg, speedMs, altM,
      nLines: maxLines, nClusters: clusters.length, nTargetCells: targetCells.length,
      region: { x0: 0, y0: 0, x1: field.widthM, y1: field.heightM },
      effectiveCells: { clusters },
      lineSpacing: swathM,
      overlapRatio: 0,
      points, legs,
      regionAreaHa: targetAreaHa,
      sprayLengthM: totalSprayLen,
      totalLengthM: totalLen,
      turningLengthM: transferLen,
      turnSeconds: transferSec,
      spraySeconds: totalSpraySec,
      coveredAreaHa,
      targetDoseLha,
      /** 靶向覆盖率：实际喷到的面积 / 病灶面积（>1 表示有溢出到非目标区） */
      targetCoverage: targetAreaHa > 0 ? +(coveredAreaHa / targetAreaHa).toFixed(3) : null,
      /** 溢出到非目标区的面积 */
      spillAreaHa: +(Math.max(0, coveredAreaHa - targetAreaHa)).toFixed(3),
    };
  }

  const regW = region.x1 - region.x0;
  const regH = region.y1 - region.y0;
  const horizontal = headingDeg % 180 === 0;

  // 行距 = 喷幅；沿航向长度 / 跨行方向长度
  const alongLen = horizontal ? regW : regH;
  const acrossLen = horizontal ? regH : regW;

  const nLines = Math.max(1, Math.ceil(acrossLen / swathM));
  const actualSpacing = acrossLen / nLines;

  for (let i = 0; i < nLines; i++) {
    const across = region.y0 + (i + 0.5) * actualSpacing;
    const a = horizontal ? { x: region.x0, y: across } : { x: across, y: region.y0 };
    const b = horizontal ? { x: region.x1, y: across } : { x: across, y: region.y1 };
    const start = { x: a.x, y: a.y, z: altM, spd: speedMs, hdg: headingDeg, line: i };
    const end = { x: b.x, y: b.y, z: altM, spd: speedMs, hdg: headingDeg + 180, line: i };
    const seq = i % 2 === 0 ? [start, end] : [end, start];
    points.push(...seq);
    legs.push({
      line: i,
      from: seq[0], to: seq[1],
      length: alongLen,
      spraySeconds: alongLen / speedMs,
    });
  }

  const nTurns = Math.max(0, nLines - 1);
  const turnLength = nTurns * (Math.PI * turnRadiusM);
  const turnSeconds = nTurns * (Math.PI * turnRadiusM / speedMs) * 1.35; // 转弯含减速与悬停余量

  const sprayLength = nLines * alongLen;
  const totalLength = sprayLength + turnLength;

  // 实际喷洒覆盖面积（含重叠）
  const coveredAreaHa = (nLines * actualSpacing * alongLen) / 10000;
  // 重喷（重叠）浪费的药液面积
  const overlapRatio = actualSpacing > swathM ? 1 - swathM / actualSpacing : 0;

  return {
    field: field.id,
    mode,
    swathM,
    headingDeg,
    speedMs,
    altM,
    nLines,
    region,
    effectiveCells,
    lineSpacing: actualSpacing,
    overlapRatio,
    points,
    legs,
    regionAreaHa,
    sprayLengthM: sprayLength,
    totalLengthM: totalLength,
    turningLengthM: turnLength,
    turnSeconds,
    spraySeconds: sprayLength / speedMs,
    coveredAreaHa,
    targetDoseLha,
    // 靶向模式下的覆盖率（占靶向网格的比例）
    targetCoverage: mode === 'target' && targetCells?.length
      ? Math.min(1, coveredAreaHa / (targetCells.length * field.cellAreaHa))
      : null,
  };
}

/**
 * 速度-喷洒比例求解。
 *
 * 物理约束：喷头流量必须与「前进速度 × 喷幅」成正比，否则漏喷或超喷。
 * 建模：喷阀采用 PWM 占空比调流，因此流量可在 0 ~ 最大流量之间连续可调；
 *       最大流量与喷幅匹配（喷幅越宽，喷头数量越多，总流量上限越高）。
 *       单位面积药液量 = 目标施药量(L/ha) / 10000，与速度无关 —— 这正是"比例自动锁定"的物理基础。
 */
export function solveSprayRatio(route, {
  swathM = route.swathM,
  speedMs = route.speedMs,
  targetDoseLha = route.targetDoseLha,
  /** 喷幅每米对应的喷头总流量能力（L/min per m of swath） */
  flowCapacityPerMSwath = 1.5,
  /** 喷头最小稳定占空比，低于此值喷雾断续 */
  minDutyCycle = 0.15,
  minPracticalSpeedMs = 2.0,
} = {}) {
  // 每前进 1m 需喷洒的药液体积（L）—— 只由喷幅与剂量决定，与速度无关
  const volumePerMeterL = swathM * (targetDoseLha / 10000);
  // 流量 = 每米体积 × 速度 × 60
  const requiredFlowLmin = volumePerMeterL * speedMs * 60;
  const maxFlowLmin = swathM * flowCapacityPerMSwath;
  const minFlowLmin = maxFlowLmin * minDutyCycle;

  const dutyCycle = requiredFlowLmin / maxFlowLmin;
  const feasible = requiredFlowLmin <= maxFlowLmin;

  // 可行速度上限：再快则喷头到达流量极限，出现漏喷
  const maxSpeed = (maxFlowLmin / 60) / volumePerMeterL;
  // 可行速度下限：再慢则喷阀占空比过低出现断续喷雾
  const minSpeed = Math.max(minPracticalSpeedMs, (minFlowLmin / 60) / volumePerMeterL);

  const totalVolumeL = route.sprayLengthM * volumePerMeterL;

  return {
    speedMs,
    swathM,
    targetDoseLha,
    requiredFlowLmin: round(requiredFlowLmin, 3),
    maxFlowLmin: round(maxFlowLmin, 2),
    minFlowLmin: round(minFlowLmin, 3),
    feasible,
    /** 喷阀 PWM 占空比（0-1） */
    dutyCycle: round(Math.min(1, dutyCycle), 3),
    /** 关键不变量：流量 ÷ 速度 = 常数，单位 L/(m·min)。变速时按此比例同步调整。 */
    flowPerSpeed: round(requiredFlowLmin / speedMs, 4),
    /** 流量随速度变化的线性系数：flow = flowSlope × speed */
    flowSlope: round(volumePerMeterL * 60, 4),
    /** 可行速度区间（保证不漏喷、不超喷、不断续） */
    speedRange: { min: round(minSpeed, 2), max: round(maxSpeed, 2) },
    totalVolumeL: round(totalVolumeL, 2),
    note: SPRAY_RATIO_NOTE.key,
  };
}

/**
 * 能耗与架次模型。
 * 巡航按里程耗电，转弯段因减速与悬停耗电更高。
 * 参数标定依据申报书竞品表：极目EA-30X 续航 22.7min / 大疆T25 续航 40min（5L 载荷下）。
 */
function estimateEnergy(route, { tankL = 5, batteryPctPerSortie = 100 } = {}) {
  // 巡航：0.0092 %/m —— 对应约 10870 m 巡航里程耗尽，接近 22 分钟航时量级
  const cruise = route.sprayLengthM * 0.0092;
  // 转弯：悬停+减速，按 0.085 %/s
  const turning = route.turnSeconds * 0.085;
  const totalPct = cruise + turning;
  // 5L 药箱：药液耗尽即需返航换药，架次 = 药量 / 箱容
  const sorties = Math.max(1, Math.ceil((route.totalVolumeL || 0) / tankL));
  return {
    batteryPct: totalPct,
    sorties,
    /** 全部架次的总能耗百分比 */
    totalPct: totalPct * sorties,
    /** 单个完整架次的时长（含返航换药） */
    sortieMinutes: (route.spraySeconds + route.turnSeconds) / 60,
    totalMinutes: ((route.spraySeconds + route.turnSeconds) / 60) * sorties
      + (sorties - 1) * 6,   // 每次换药约 6 分钟（返航 + 换药 + 再起飞）
  };
}

/**
 * 多目标评分：经济 / 快速 / 环保。
 * 在候选集内归一化，因此得分是相对的（同一批候选中谁更优）。
 */
export function scoreRoute(route, ratio, weights = { economy: 0.4, speed: 0.35, eco: 0.25 }, pool = null) {
  const energy = estimateEnergy(route);
  const totalSeconds = route.spraySeconds + route.turnSeconds;

  // 原始代价（越小越好）—— 经济性含换药架次与总作业时长
  const economyRaw = energy.totalMinutes + ratio.totalVolumeL * 0.8 + energy.totalPct * 0.5;
  const speedRaw = route.totalLengthM + route.turningLengthM * 3;
  const ecoRaw = route.overlapRatio * 100 + (route.turningLengthM / route.totalLengthM) * 100
    // 靶向模式下，非目标区被喷到的面积是环保性的核心指标
    + (route.spillAreaHa != null ? (route.spillAreaHa / Math.max(1e-9, route.regionAreaHa)) * 400 : 0);

  // 归一化到 0-100：候选集内最优=100，最差=0
  // pool 形如 { economy:{min,max}, speed:{min,max}, eco:{min,max} }
  const norm = (v, key) => {
    if (!pool || !pool[key]) return Math.max(0, Math.min(100, 100 - v / Math.max(1e-9, 400)));
    const { min, max } = pool[key];
    if (!(max - min > 1e-9)) return 100;
    // 平方根拉伸：让高分区间也拉开差距，避免所有候选都挤在 95-100
    const t = (1 - (v - min) / (max - min));
    return round(Math.sqrt(Math.max(0, t)) * 100, 1);
  };

  const economy = norm(economyRaw, 'economy');
  const speed = norm(speedRaw, 'speed');
  const eco = norm(ecoRaw, 'eco');
  const total = weights.economy * economy + weights.speed * speed + weights.eco * eco;

  return {
    economy: round(economy),
    speed: round(speed),
    eco: round(eco),
    total: round(total),
    weights,
    detail: {
      totalMinutes: round(energy.totalMinutes, 2),
      /** 单架次作业时长（不含换药） */
      sortieMinutes: round(energy.sortieMinutes, 2),
      sorties: energy.sorties,
      totalVolumeL: ratio.totalVolumeL,
      batteryPct: round(energy.batteryPct, 1),
      totalBatteryPct: round(energy.totalPct, 1),
      overlapRatio: round(route.overlapRatio, 4),
      turningShare: round(route.totalLengthM > 0 ? route.turningLengthM / route.totalLengthM : 0, 4),
      lengthM: round(route.totalLengthM, 1),
      areaHa: round(route.regionAreaHa, 3),
      coveredAreaHa: round(route.coveredAreaHa, 3),
      nLines: route.nLines,
      // 与人工基线对比用的扁平字段
      minutes: round(energy.totalMinutes, 2),
      volumeL: ratio.totalVolumeL,
      overlap: round(route.overlapRatio, 4),
    },
    raw: { economyRaw, speedRaw, ecoRaw },
  };
}

/**
 * 航向/速度/喷幅联合搜索 —— 这正是"人工手画效率太低"要替代的部分。
 */
export function autoPlan(field, opts = {}) {
  const mode = opts.mode || 'full';
  const modeSpec = MODES[mode];
  const headings = opts.headings ?? [0, 30, 45, 60, 90, 120, 135, 150];
  const speeds = opts.speeds ?? [4, 5, 6, 7, 8];
  const swaths = opts.swaths ?? modeSpec.swathCandidates;
  const weights = opts.weights ?? { economy: 0.4, speed: 0.35, eco: 0.25 };

  const candidates = [];
  for (const h of headings) {
    for (const s of speeds) {
      for (const sw of swaths) {
        const route = generateSprayRoute(field, { ...opts, headingDeg: h, speedMs: s, swathM: sw, mode });
        const ratio = solveSprayRatio(route, { ...opts, swathM: sw, speedMs: s });
        if (!ratio.feasible) continue;
        // 可行速度必须落在喷头能力区间内
        if (s < ratio.speedRange.min || s > ratio.speedRange.max) continue;
        candidates.push({ headingDeg: h, speedMs: s, swathM: sw, route, ratio });
      }
    }
  }
  if (!candidates.length) {
    return { best: null, candidates: [], objectives: PLAN_OBJECTIVES, modes: MODES };
  }

  // 先算原始代价，再在候选集内归一化打分
  const rawOf = (c) => {
    const energy = estimateEnergy(c.route);
    return {
      economy: energy.totalMinutes + c.ratio.totalVolumeL * 0.8 + energy.totalPct * 0.5,
      speed: c.route.totalLengthM + c.route.turningLengthM * 3,
      eco: c.route.overlapRatio * 100 + (c.route.turningLengthM / c.route.totalLengthM) * 100,
    };
  };
  const raws = candidates.map(rawOf);
  const pool = {
    economy: range(raws.map(r => r.economy)),
    speed: range(raws.map(r => r.speed)),
    eco: range(raws.map(r => r.eco)),
  };

  for (const c of candidates) c.score = scoreRoute(c.route, c.ratio, weights, pool);
  candidates.sort((a, b) => b.score.total - a.score.total);

  return {
    best: candidates[0],
    candidates: candidates.map(c => ({
      headingDeg: c.headingDeg, speedMs: c.speedMs, swathM: c.swathM,
      total: c.score.total, economy: c.score.economy, speed: c.score.speed, eco: c.score.eco,
      minutes: c.score.detail.totalMinutes,
      volumeL: c.score.detail.totalVolumeL,
      lengthM: c.score.detail.lengthM,
      overlap: c.score.detail.overlapRatio,
      batteryPct: c.score.detail.batteryPct,
    })),
    objectives: PLAN_OBJECTIVES,
    modes: MODES,
    mode,
  };
}

/**
 * 与"人工手画航线"对比 —— 给老师看效率提升的地方。
 * 人工手画的典型特征：航向单一、转弯多、速度凭经验保守、重喷明显。
 */
export function compareWithManual(best, manual) {
  const s = (x) => ({
    minutes: x.minutes, volumeL: x.volumeL, lengthM: x.lengthM,
    overlap: x.overlap, turningShare: x.turningShare,
    batteryPct: x.batteryPct,
  });
  const b = s(best.score.detail), m = s(manual);
  const gain = (k) => (m[k] > 0 && Number.isFinite(m[k]) ? round((1 - b[k] / m[k]) * 100, 1) : 0);
  return {
    auto: b,
    manual: m,
    gains: {
      minutes: gain('minutes'),
      volumeL: gain('volumeL'),
      lengthM: gain('lengthM'),
      turningShare: gain('turningShare'),
    },
  };
}

/** 手动航线基线：沿主风向手画、来回不均匀、头地留得很大、速度保守 */
export function manualBaseline(field, opts = {}) {
  const mode = opts.mode || 'full';
  const route = generateSprayRoute(field, {
    ...opts,
    mode,
    headingDeg: 90,          // 人工通常只考虑南北向或东西向
    speedMs: 4.5,            // 保守速度
    swathM: mode === 'target' ? 1.0 : 5.0,
    turnRadiusM: 4.0,        // 转弯更慢更圆
  });
  // 人工留 6m 头地，且会绕开障碍物 → 航程增加
  const turningLength = route.turningLengthM * 1.6;
  const totalLength = route.sprayLengthM + turningLength;
  const totalSeconds = route.spraySeconds + route.turnSeconds * 1.5;
  const ratio = solveSprayRatio(route, { swathM: route.swathM, speedMs: route.speedMs });
  // 约 12% 重喷浪费
  const volume = ratio.totalVolumeL * 1.12;
  const energy = estimateEnergy(route);

  return {
    minutes: round(totalSeconds / 60, 2),
    volumeL: round(volume, 2),
    lengthM: round(totalLength, 1),
    overlap: round(route.overlapRatio + 0.12, 4),
    turningShare: round(totalLength > 0 ? turningLength / totalLength : 0, 4),
    batteryPct: round(energy.batteryPct * 1.15, 1),
    headingDeg: 90,
    speedMs: 4.5,
    swathM: route.swathM,
    mode,
    note: mode === 'target'
      ? '人工基线假设：1m 窄幅需逐格手动画点位、固定南北向航向、4.5 m/s 保守速度、宽转弯半径、约 12% 重喷浪费。'
      : '人工基线假设：固定南北向航向、4.5 m/s 保守速度、宽转弯半径（留大块头地）、约 12% 重喷浪费。',
  };
}

/**
 * 把散乱的靶向网格聚成簇。
 * 相邻（八邻域连通）的格子属于同一簇，每簇单独规划一小段航线。
 */
function clusterCells(cells, cw, ch) {
  const key = (r, c) => `${r}_${c}`;
  const set = new Map(cells.map(c => [key(c.row, c.col), c]));
  const seen = new Set();
  const clusters = [];
  let id = 0;
  for (const c of cells) {
    const k = key(c.row, c.col);
    if (seen.has(k)) continue;
    const stack = [c];
    const group = [];
    seen.add(k);
    while (stack.length) {
      const cur = stack.pop();
      group.push(cur);
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nk = key(cur.row + dr, cur.col + dc);
          if (set.has(nk) && !seen.has(nk)) {
            seen.add(nk);
            stack.push(set.get(nk));
          }
        }
      }
    }
    clusters.push({ id: id++, cells: group });
  }
  // 按 x 排序，让簇间转场尽量短
  clusters.sort((a, b) => {
    const ax = a.cells.reduce((s, c) => s + c.col, 0) / a.cells.length;
    const bx = b.cells.reduce((s, c) => s + c.col, 0) / b.cells.length;
    return ax - bx;
  });
  clusters.forEach((c, i) => { c.id = i; });
  return clusters;
}

/**
 * 生成一次「靶向施药」任务的完整参数。
 *
 * 老师关心的比例关系在这里落地成可下发的数字：
 *   喷洒速度（流量）÷ 飞行速度 = 常数，即 flowPerSpeed，
 *   变速飞行时喷阀按同一比例同步调流，保证单位面积药量恒定。
 *
 * 服务端（Node + SQLite）与浏览器（静态演示）共用本函数，
 * 保证两边生成的作业单完全一致。
 */
export function buildSprayMission({
  field, zoneId, headingDeg = 90, speedMs = 6, swathM = 1.0,
  targetDoseLha = 12, disease = null, cells = [], agent = '戊唑醇·苯醚甲环唑',
}) {
  const route = generateSprayRoute(field, {
    mode: 'zone', zoneId, headingDeg, speedMs, swathM, targetDoseLha,
  });
  const ratio = solveSprayRatio(route, { swathM, speedMs, targetDoseLha });
  const score = scoreRoute(route, ratio);
  const zone = field.zones().find(z => z.id === zoneId);

  return {
    route,
    ratio,
    score,
    /** 作业单主体 */
    mission: {
      type: 'spray',
      disease,
      zoneId,
      zoneName: `${zoneId} 区`,
      target: {
        grid: cells.length ? cells[0] : { row: zone.gridRange.r0, col: zone.gridRange.c0 },
        cells,
        zone: zoneId,
      },
      spray: {
        speed: speedMs,               // 飞行速度 m/s
        swath: swathM,                 // 喷幅 m
        flow: ratio.requiredFlowLmin, // 喷洒速度（流量）L/min
        dose: targetDoseLha,           // 目标施药量 L/ha
        agent,                         // 药剂
        // 速度-喷洒比例锁（核心不变量）
        flowPerSpeed: ratio.flowPerSpeed,
        dutyCycle: ratio.dutyCycle,
        speedRange: ratio.speedRange,
      },
      plan: {
        algo: '航向×速度×喷幅联合搜索（三目标打分）',
        length: route.totalLengthM,
        estMinutes: score.detail.totalMinutes,
        estVolumeL: ratio.totalVolumeL,
        ecoScore: score.eco,
        zoneId,
        // 相对整田均匀喷施的节药量
        savedVsUniformL: round(
          (field.totalAreaHa() * targetDoseLha) - ratio.totalVolumeL, 2),
      },
      status: 'pending',
    },
  };
}

/**
 * 相对「整田均匀喷施」的药液节约率。
 *
 * 口径：整田均匀喷施 = 全田面积 × 目标施药量；
 *       精准靶向 = 实际喷洒面积 × 目标施药量。
 * 只有存在喷洒任务时才有意义，否则返回 null（平台显示「待作业」而非编造数字）。
 */
export function spraySavingRatio(missions, field, targetDoseLha = 12) {
  const sprays = missions.filter(m => m.type === 'spray');
  if (!sprays.length) return null;
  const uniformL = field.totalAreaHa() * targetDoseLha;
  if (uniformL <= 0) return null;
  const preciseL = sprays.reduce((a, m) => a + (m.plan?.estVolumeL || 0), 0);
  if (preciseL <= 0) return null;
  return {
    uniformL: round(uniformL, 2),
    preciseL: round(preciseL, 2),
    savedL: round(uniformL - preciseL, 2),
    savedRatio: round(Math.max(0, (1 - preciseL / uniformL) * 100), 1),
    sprayTasks: sprays.length,
  };
}

function range(arr) {
  return { min: Math.min(...arr), max: Math.max(...arr) };
}
function round(v, d = 2) {
  const p = Math.pow(10, d);
  return Math.round(v * p) / p;
}
