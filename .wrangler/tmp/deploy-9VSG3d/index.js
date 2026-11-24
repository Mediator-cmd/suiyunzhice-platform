var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// shared/schema.js
var DISEASES, DEVICE_STATES, ANALYTICS_DIMENSIONS, PLAN_OBJECTIVES, SPRAY_RATIO_NOTE;
var init_schema = __esm({
  "shared/schema.js"() {
    DISEASES = [
      { code: "rust", name: "\u9508\u75C5", latin: "Puccinia spp.", mainPart: "\u53F6\u7247", severityHint: "\u53F6\u90E8\u6A59\u8910\u8272\u5B62\u5B50\u5806", window: "\u521D\u53D1\u671F\u5373\u62A2\u9632\uFF0C7\u201310 \u5929\u590D\u67E5" },
      { code: "powdery", name: "\u767D\u7C89\u75C5", latin: "Blumeria graminis", mainPart: "\u53F6\u7247", severityHint: "\u767D\u8272\u7C89\u5C42", window: "\u8F7B\u75C7\u7269\u7406\u9632\u6CBB\uFF0C\u91CD\u75C7\u4E09\u5511\u916E" },
      { code: "loose_smut", name: "\u6563\u9ED1\u7A57\u75C5", latin: "Sphacelotheca reiliana", mainPart: "\u7A57\u90E8", severityHint: "\u9ED1\u8272\u7A57\u7C92", window: "\u64AD\u79CD\u671F\u62CC\u79CD\uFF0C\u62D4\u8282\u671F\u65E0\u6CD5\u8865\u6551" },
      { code: "root_rot", name: "\u6839\u8150\u75C5", latin: "Rhizoctonia solani", mainPart: "\u6839\u830E\u90E8", severityHint: "\u830E\u57FA\u8910\u53D8", window: "\u8FD1\u5730\u786E\u8BA4\u540E\u7ED3\u5408\u5892\u60C5\u8BC4\u4F30" },
      { code: "fusarium", name: "\u8D64\u9709\u75C5", latin: "Fusarium graminearum", mainPart: "\u7A57\u90E8", severityHint: "\u7A57\u90E8\u9709\u5C42", window: "\u663E\u75C7\u5373\u62A2\u9632\uFF0C\u5355\u72EC\u6807\u8BB0\u533A\u57DF" },
      { code: "leaf_blight", name: "\u53F6\u67AF\u75C5", latin: "Septoria tritici", mainPart: "\u53F6\u7247", severityHint: "\u53F6\u7247\u65E9\u8870\u6591", window: "\u4F5C\u4E3A\u957F\u52BF\u6307\u6807\uFF0C\u614E\u7528\u519C\u836F" }
    ];
    DEVICE_STATES = {
      OFFLINE: "offline",
      IDLE: "idle",
      TAKEOFF: "takeoff",
      SURVEYING: "surveying",
      // 空中巡查
      RECHECKING: "rechecking",
      // 地面机器人复核作业中
      RELOADING: "reloading",
      // 返航换药 / 补液
      SPRAYING: "spraying",
      // 靶向喷洒
      RETURNING: "returning",
      // 返航
      CHARGING: "charging",
      MAINTENANCE: "maintenance"
    };
    ANALYTICS_DIMENSIONS = [
      { key: "spatial", name: "\u7A7A\u95F4\u7EF4\u5EA6", desc: "\u6309\u7F51\u683C/\u5730\u5757/\u5206\u533A\u7EDF\u8BA1\u75C5\u5BB3\u5BC6\u5EA6\u4E0E\u4F5C\u4E1A\u8986\u76D6" },
      { key: "temporal", name: "\u65F6\u95F4\u7EF4\u5EA6", desc: "\u6309\u65E5/\u5468/\u751F\u80B2\u671F\u7EDF\u8BA1\u53D1\u751F\u8D8B\u52BF\u4E0E\u9632\u6CBB\u7A97\u53E3" },
      { key: "disease", name: "\u75C5\u5BB3\u7EF4\u5EA6", desc: "\u6309\u75C5\u79CD\u3001\u90E8\u4F4D\u3001\u7F6E\u4FE1\u5EA6\u5206\u5C42\u7EDF\u8BA1" },
      { key: "platform", name: "\u5E73\u53F0\u7EF4\u5EA6", desc: "\u6309\u65E0\u4EBA\u673A/\u673A\u5668\u4EBA\u5206\u5DE5\u7EDF\u8BA1\u91C7\u96C6\u91CF\u4E0E\u547D\u4E2D\u7387" },
      { key: "task", name: "\u4F5C\u4E1A\u7EF4\u5EA6", desc: "\u6309\u4EFB\u52A1\u7EDF\u8BA1\u822A\u65F6\u3001\u836F\u6DB2\u3001\u8986\u76D6\u3001\u9632\u6548" },
      { key: "environment", name: "\u73AF\u5883\u7EF4\u5EA6", desc: "\u6309\u6E29\u6E7F\u5EA6\u3001\u5149\u7167\u3001\u98CE\u901F\u5206\u7EC4\u7684\u4F5C\u4E1A\u6761\u4EF6\u4E0E\u6548\u679C" }
    ];
    PLAN_OBJECTIVES = {
      economy: { name: "\u6700\u7ECF\u6D4E", metric: "\u5355\u4F4D\u9762\u79EF\u836F\u8017/\u7535\u8017/\u822A\u65F6\u6210\u672C", weight: "\u9ED8\u8BA4 0.4" },
      speed: { name: "\u6700\u5FEB\u901F", metric: "\u822A\u7A0B\u6700\u77ED + \u8F6C\u5F2F\u6B21\u6570\u6700\u5C11", weight: "\u9ED8\u8BA4 0.35" },
      eco: { name: "\u6700\u73AF\u4FDD", metric: "\u975E\u76EE\u6807\u533A\u91CD\u55B7\u7387 + \u836F\u5242\u8D8A\u754C\u91CF", weight: "\u9ED8\u8BA4 0.25" }
    };
    SPRAY_RATIO_NOTE = {
      formula: "\u55B7\u6D12\u901F\u5EA6 = \u98DE\u884C\u901F\u5EA6 \xD7 \u55B7\u5E45",
      unit: "L/min = m/s \xD7 m",
      key: "\u55B7\u6D12\u6D41\u91CF\u4E0E\u98DE\u884C\u901F\u5EA6\u4E25\u683C\u6210\u6B63\u6BD4\u3002\u98DE\u884C\u52A0\u901F\u5219\u5FC5\u987B\u540C\u6BD4\u52A0\u5927\u6D41\u91CF\uFF0C\u5426\u5219\u4F1A\u51FA\u73B0\u836F\u6DB2\u6C89\u79EF\u4E0D\u8DB3\uFF08\u6F0F\u55B7\uFF09\uFF1B\u51CF\u901F\u5219\u9700\u540C\u6BD4\u51CF\u5C0F\u6D41\u91CF\uFF0C\u5426\u5219\u4F1A\u8D85\u55B7\u4E0E\u836F\u5BB3\u3002",
      target: '\u5E73\u53F0\u81EA\u52A8\u6C42\u89E3\u8BE5\u6BD4\u4F8B\uFF0C\u5E76\u5141\u8BB8\u7528\u6237\u5728"\u7ECF\u6D4E/\u5FEB\u901F/\u73AF\u4FDD"\u4E09\u79CD\u6A21\u5F0F\u95F4\u5207\u6362\u3002'
    };
  }
});

// shared/planner.js
function generateSprayRoute(field, {
  swathM = 5,
  headingDeg = 90,
  speedMs = 6,
  turnRadiusM = 2.5,
  altM = 2,
  targetDoseLha = 12,
  mode = "full",
  targetCells = null,
  zoneId = null
} = {}) {
  let region = { x0: 0, y0: 0, x1: field.widthM, y1: field.heightM };
  let regionAreaHa = field.totalAreaHa();
  let effectiveCells = null;
  const points = [];
  const legs = [];
  if (mode === "zone" && zoneId) {
    const zone = field.zones().find((z) => z.id === zoneId);
    if (!zone) throw new Error(`\u672A\u77E5\u7BA1\u7406\u5206\u533A ${zoneId}`);
    region = { x0: zone.x, y0: zone.y, x1: zone.x + zone.w, y1: zone.y + zone.h };
    regionAreaHa = zone.areaHa;
    effectiveCells = { zone };
    const regW2 = region.x1 - region.x0;
    const regH2 = region.y1 - region.y0;
    const horizontal2 = headingDeg % 180 === 0;
    const alongLen2 = horizontal2 ? regW2 : regH2;
    const acrossLen2 = horizontal2 ? regH2 : regW2;
    const nLines2 = Math.max(1, Math.ceil(acrossLen2 / swathM));
    const actualSpacing2 = acrossLen2 / nLines2;
    for (let i = 0; i < nLines2; i++) {
      const across = region.y0 + (i + 0.5) * actualSpacing2;
      const a = horizontal2 ? { x: region.x0, y: across } : { x: across, y: region.y0 };
      const b = horizontal2 ? { x: region.x1, y: across } : { x: across, y: region.y1 };
      const start = { x: a.x, y: a.y, z: altM, spd: speedMs, hdg: headingDeg, line: i, zone: zone.id };
      const end = { x: b.x, y: b.y, z: altM, spd: speedMs, hdg: headingDeg + 180, line: i, zone: zone.id };
      const seq = i % 2 === 0 ? [start, end] : [end, start];
      points.push(...seq);
      legs.push({ line: i, zone: zone.id, from: seq[0], to: seq[1], length: alongLen2, spraySeconds: alongLen2 / speedMs });
    }
    const nTurns2 = Math.max(0, nLines2 - 1);
    const turnLength2 = nTurns2 * (Math.PI * turnRadiusM);
    const turnSeconds2 = nTurns2 * (Math.PI * turnRadiusM / speedMs) * 1.35;
    const sprayLength2 = nLines2 * alongLen2;
    const coveredAreaHa2 = nLines2 * actualSpacing2 * alongLen2 / 1e4;
    return {
      field: field.id,
      mode,
      zoneId: zone.id,
      swathM,
      headingDeg,
      speedMs,
      altM,
      nLines: nLines2,
      region,
      effectiveCells,
      lineSpacing: actualSpacing2,
      overlapRatio: actualSpacing2 > swathM ? 1 - swathM / actualSpacing2 : 0,
      points,
      legs,
      regionAreaHa,
      sprayLengthM: sprayLength2,
      totalLengthM: sprayLength2 + turnLength2,
      turningLengthM: turnLength2,
      turnSeconds: turnSeconds2,
      spraySeconds: sprayLength2 / speedMs,
      coveredAreaHa: coveredAreaHa2,
      targetDoseLha,
      targetCoverage: null,
      spillAreaHa: 0
    };
  }
  if (mode === "target" && targetCells && targetCells.length) {
    const cw = field.cellW, ch = field.cellH;
    const clusters = clusterCells(targetCells, cw, ch);
    let totalLen = 0, totalSprayLen = 0, totalTurnLen = 0, totalSpraySec = 0, totalTurnSec = 0;
    let maxLines = 0;
    for (const cl of clusters) {
      const horiz = headingDeg % 180 === 0;
      const sorted = [...cl.cells].sort((a, b) => horiz ? a.col - b.col || a.row - b.row : a.row - b.row || a.col - b.col);
      for (const cell of sorted) {
        const cx = (cell.col + 0.5) * cw;
        const cy = (cell.row + 0.5) * ch;
        const acrossSize = horiz ? ch : cw;
        const alongLen2 = horiz ? cw : ch;
        const nPasses = Math.max(1, Math.ceil(acrossSize / swathM));
        const passSpacing = acrossSize / nPasses;
        for (let p = 0; p < nPasses; p++) {
          const across = (horiz ? cy - acrossSize / 2 : cx - acrossSize / 2) + (p + 0.5) * passSpacing;
          const a = horiz ? { x: cx - cw / 2, y: across } : { x: across, y: cy - ch / 2 };
          const b = horiz ? { x: cx + cw / 2, y: across } : { x: across, y: cy + ch / 2 };
          const start = { x: a.x, y: a.y, z: altM, spd: speedMs, hdg: headingDeg, line: maxLines, cluster: cl.id };
          const end = { x: b.x, y: b.y, z: altM, spd: speedMs, hdg: headingDeg + 180, line: maxLines, cluster: cl.id };
          const seq = [start, end];
          points.push(...seq);
          legs.push({
            line: maxLines,
            cluster: cl.id,
            from: seq[0],
            to: seq[1],
            length: alongLen2,
            spraySeconds: alongLen2 / speedMs
          });
          totalLen += alongLen2;
          totalSprayLen += alongLen2;
          totalSpraySec += alongLen2 / speedMs;
          maxLines++;
        }
      }
    }
    const allPts = points;
    let transferLen = 0, transferSec = 0;
    for (let i = 1; i < allPts.length; i++) {
      const d = Math.hypot(allPts[i].x - allPts[i - 1].x, allPts[i].y - allPts[i - 1].y);
      if (d > 0.01) {
        transferLen += d;
        transferSec += d / (speedMs * 1.6);
      }
    }
    totalLen += transferLen;
    totalSpraySec += transferSec;
    const targetAreaHa = targetCells.length * field.cellAreaHa;
    const coveredAreaHa2 = totalSprayLen * swathM / 1e4;
    return {
      field: field.id,
      mode,
      swathM,
      headingDeg,
      speedMs,
      altM,
      nLines: maxLines,
      nClusters: clusters.length,
      nTargetCells: targetCells.length,
      region: { x0: 0, y0: 0, x1: field.widthM, y1: field.heightM },
      effectiveCells: { clusters },
      lineSpacing: swathM,
      overlapRatio: 0,
      points,
      legs,
      regionAreaHa: targetAreaHa,
      sprayLengthM: totalSprayLen,
      totalLengthM: totalLen,
      turningLengthM: transferLen,
      turnSeconds: transferSec,
      spraySeconds: totalSpraySec,
      coveredAreaHa: coveredAreaHa2,
      targetDoseLha,
      /** 靶向覆盖率：实际喷到的面积 / 病灶面积（>1 表示有溢出到非目标区） */
      targetCoverage: targetAreaHa > 0 ? +(coveredAreaHa2 / targetAreaHa).toFixed(3) : null,
      /** 溢出到非目标区的面积 */
      spillAreaHa: +Math.max(0, coveredAreaHa2 - targetAreaHa).toFixed(3)
    };
  }
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
    const start = { x: a.x, y: a.y, z: altM, spd: speedMs, hdg: headingDeg, line: i };
    const end = { x: b.x, y: b.y, z: altM, spd: speedMs, hdg: headingDeg + 180, line: i };
    const seq = i % 2 === 0 ? [start, end] : [end, start];
    points.push(...seq);
    legs.push({
      line: i,
      from: seq[0],
      to: seq[1],
      length: alongLen,
      spraySeconds: alongLen / speedMs
    });
  }
  const nTurns = Math.max(0, nLines - 1);
  const turnLength = nTurns * (Math.PI * turnRadiusM);
  const turnSeconds = nTurns * (Math.PI * turnRadiusM / speedMs) * 1.35;
  const sprayLength = nLines * alongLen;
  const totalLength = sprayLength + turnLength;
  const coveredAreaHa = nLines * actualSpacing * alongLen / 1e4;
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
    targetCoverage: mode === "target" && targetCells?.length ? Math.min(1, coveredAreaHa / (targetCells.length * field.cellAreaHa)) : null
  };
}
function solveSprayRatio(route, {
  swathM = route.swathM,
  speedMs = route.speedMs,
  targetDoseLha = route.targetDoseLha,
  /** 喷幅每米对应的喷头总流量能力（L/min per m of swath） */
  flowCapacityPerMSwath = 1.5,
  /** 喷头最小稳定占空比，低于此值喷雾断续 */
  minDutyCycle = 0.15,
  minPracticalSpeedMs = 2
} = {}) {
  const volumePerMeterL = swathM * (targetDoseLha / 1e4);
  const requiredFlowLmin = volumePerMeterL * speedMs * 60;
  const maxFlowLmin = swathM * flowCapacityPerMSwath;
  const minFlowLmin = maxFlowLmin * minDutyCycle;
  const dutyCycle = requiredFlowLmin / maxFlowLmin;
  const feasible = requiredFlowLmin <= maxFlowLmin;
  const maxSpeed = maxFlowLmin / 60 / volumePerMeterL;
  const minSpeed = Math.max(minPracticalSpeedMs, minFlowLmin / 60 / volumePerMeterL);
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
    note: SPRAY_RATIO_NOTE.key
  };
}
function estimateEnergy(route, { tankL = 5, batteryPctPerSortie = 100 } = {}) {
  const cruise = route.sprayLengthM * 92e-4;
  const turning = route.turnSeconds * 0.085;
  const totalPct = cruise + turning;
  const sorties = Math.max(1, Math.ceil((route.totalVolumeL || 0) / tankL));
  return {
    batteryPct: totalPct,
    sorties,
    /** 全部架次的总能耗百分比 */
    totalPct: totalPct * sorties,
    /** 单个完整架次的时长（含返航换药） */
    sortieMinutes: (route.spraySeconds + route.turnSeconds) / 60,
    totalMinutes: (route.spraySeconds + route.turnSeconds) / 60 * sorties + (sorties - 1) * 6
    // 每次换药约 6 分钟（返航 + 换药 + 再起飞）
  };
}
function scoreRoute(route, ratio, weights = { economy: 0.4, speed: 0.35, eco: 0.25 }, pool = null) {
  const energy = estimateEnergy(route);
  const totalSeconds = route.spraySeconds + route.turnSeconds;
  const economyRaw = energy.totalMinutes + ratio.totalVolumeL * 0.8 + energy.totalPct * 0.5;
  const speedRaw = route.totalLengthM + route.turningLengthM * 3;
  const ecoRaw = route.overlapRatio * 100 + route.turningLengthM / route.totalLengthM * 100 + (route.spillAreaHa != null ? route.spillAreaHa / Math.max(1e-9, route.regionAreaHa) * 400 : 0);
  const norm = /* @__PURE__ */ __name((v, key) => {
    if (!pool || !pool[key]) return Math.max(0, Math.min(100, 100 - v / Math.max(1e-9, 400)));
    const { min, max } = pool[key];
    if (!(max - min > 1e-9)) return 100;
    const t = 1 - (v - min) / (max - min);
    return round(Math.sqrt(Math.max(0, t)) * 100, 1);
  }, "norm");
  const economy = norm(economyRaw, "economy");
  const speed = norm(speedRaw, "speed");
  const eco = norm(ecoRaw, "eco");
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
      // 靶向模式专属：覆盖率与溢出面积 —— 申报材料引用的「覆盖率 1.0、溢出 0」即此两值
      targetCoverage: route.targetCoverage ?? null,
      spillAreaHa: route.spillAreaHa ?? null,
      nTargetCells: route.nTargetCells ?? null,
      nClusters: route.nClusters ?? null,
      // 与人工基线对比用的扁平字段
      minutes: round(energy.totalMinutes, 2),
      volumeL: ratio.totalVolumeL,
      overlap: round(route.overlapRatio, 4)
    },
    raw: { economyRaw, speedRaw, ecoRaw }
  };
}
function autoPlan(field, opts = {}) {
  const mode = opts.mode || "full";
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
        if (s < ratio.speedRange.min || s > ratio.speedRange.max) continue;
        candidates.push({ headingDeg: h, speedMs: s, swathM: sw, route, ratio });
      }
    }
  }
  if (!candidates.length) {
    return { best: null, candidates: [], objectives: PLAN_OBJECTIVES, modes: MODES };
  }
  const rawOf = /* @__PURE__ */ __name((c) => {
    const energy = estimateEnergy(c.route);
    return {
      economy: energy.totalMinutes + c.ratio.totalVolumeL * 0.8 + energy.totalPct * 0.5,
      speed: c.route.totalLengthM + c.route.turningLengthM * 3,
      eco: c.route.overlapRatio * 100 + c.route.turningLengthM / c.route.totalLengthM * 100
    };
  }, "rawOf");
  const raws = candidates.map(rawOf);
  const pool = {
    economy: range(raws.map((r) => r.economy)),
    speed: range(raws.map((r) => r.speed)),
    eco: range(raws.map((r) => r.eco))
  };
  for (const c of candidates) c.score = scoreRoute(c.route, c.ratio, weights, pool);
  candidates.sort((a, b) => b.score.total - a.score.total);
  return {
    best: candidates[0],
    candidates: candidates.map((c) => ({
      headingDeg: c.headingDeg,
      speedMs: c.speedMs,
      swathM: c.swathM,
      total: c.score.total,
      economy: c.score.economy,
      speed: c.score.speed,
      eco: c.score.eco,
      minutes: c.score.detail.totalMinutes,
      volumeL: c.score.detail.totalVolumeL,
      lengthM: c.score.detail.lengthM,
      overlap: c.score.detail.overlapRatio,
      batteryPct: c.score.detail.batteryPct
    })),
    objectives: PLAN_OBJECTIVES,
    modes: MODES,
    mode
  };
}
function compareWithManual(best, manual) {
  const s = /* @__PURE__ */ __name((x) => ({
    minutes: x.minutes,
    volumeL: x.volumeL,
    lengthM: x.lengthM,
    overlap: x.overlap,
    turningShare: x.turningShare,
    batteryPct: x.batteryPct
  }), "s");
  const b = s(best.score.detail), m = s(manual);
  const gain = /* @__PURE__ */ __name((k) => m[k] > 0 && Number.isFinite(m[k]) ? round((1 - b[k] / m[k]) * 100, 1) : 0, "gain");
  return {
    auto: b,
    manual: m,
    gains: {
      minutes: gain("minutes"),
      volumeL: gain("volumeL"),
      lengthM: gain("lengthM"),
      turningShare: gain("turningShare")
    }
  };
}
function manualBaseline(field, opts = {}) {
  const mode = opts.mode || "full";
  const route = generateSprayRoute(field, {
    ...opts,
    mode,
    headingDeg: 90,
    // 人工通常只考虑南北向或东西向
    speedMs: 4.5,
    // 保守速度
    swathM: mode === "target" ? 1 : 5,
    turnRadiusM: 4
    // 转弯更慢更圆
  });
  const turningLength = route.turningLengthM * 1.6;
  const totalLength = route.sprayLengthM + turningLength;
  const totalSeconds = route.spraySeconds + route.turnSeconds * 1.5;
  const ratio = solveSprayRatio(route, { swathM: route.swathM, speedMs: route.speedMs });
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
    note: mode === "target" ? "\u4EBA\u5DE5\u57FA\u7EBF\u5047\u8BBE\uFF1A1m \u7A84\u5E45\u9700\u9010\u683C\u624B\u52A8\u753B\u70B9\u4F4D\u3001\u56FA\u5B9A\u5357\u5317\u5411\u822A\u5411\u30014.5 m/s \u4FDD\u5B88\u901F\u5EA6\u3001\u5BBD\u8F6C\u5F2F\u534A\u5F84\u3001\u7EA6 12% \u91CD\u55B7\u6D6A\u8D39\u3002" : "\u4EBA\u5DE5\u57FA\u7EBF\u5047\u8BBE\uFF1A\u56FA\u5B9A\u5357\u5317\u5411\u822A\u5411\u30014.5 m/s \u4FDD\u5B88\u901F\u5EA6\u3001\u5BBD\u8F6C\u5F2F\u534A\u5F84\uFF08\u7559\u5927\u5757\u5934\u5730\uFF09\u3001\u7EA6 12% \u91CD\u55B7\u6D6A\u8D39\u3002"
  };
}
function clusterCells(cells, cw, ch) {
  const key = /* @__PURE__ */ __name((r, c) => `${r}_${c}`, "key");
  const set = new Map(cells.map((c) => [key(c.row, c.col), c]));
  const seen = /* @__PURE__ */ new Set();
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
  clusters.sort((a, b) => {
    const ax = a.cells.reduce((s, c) => s + c.col, 0) / a.cells.length;
    const bx = b.cells.reduce((s, c) => s + c.col, 0) / b.cells.length;
    return ax - bx;
  });
  clusters.forEach((c, i) => {
    c.id = i;
  });
  return clusters;
}
function buildSprayMission({
  field,
  zoneId,
  headingDeg = 90,
  speedMs = 6,
  swathM = 1,
  targetDoseLha = 12,
  disease = null,
  cells = [],
  agent = "\u620A\u5511\u9187\xB7\u82EF\u919A\u7532\u73AF\u5511"
}) {
  const zone = field.zones().find((z) => z.id === zoneId);
  let targetCells = (cells || []).filter((c) => c && Number.isInteger(c.row) && Number.isInteger(c.col));
  if (!targetCells.length && zone) {
    const { r0, r1, c0, c1 } = zone.gridRange;
    targetCells = [];
    for (let r = r0; r < r1; r++) {
      for (let c = c0; c < c1; c++) targetCells.push({ row: r, col: c });
    }
  }
  const route = generateSprayRoute(field, {
    mode: "target",
    headingDeg,
    speedMs,
    swathM,
    targetDoseLha,
    targetCells
  });
  const ratio = solveSprayRatio(route, { swathM, speedMs, targetDoseLha });
  const score = scoreRoute(route, ratio);
  const targetAreaHa = targetCells.length * field.cellAreaHa;
  const zoneAreaHa = zone ? zone.areaHa : field.totalAreaHa();
  const uniformZoneL = zoneAreaHa * targetDoseLha;
  const uniformWholeFieldL = field.totalAreaHa() * targetDoseLha;
  const savedVsZoneL = uniformZoneL - ratio.totalVolumeL;
  return {
    route,
    ratio,
    score,
    /** 作业单主体 */
    mission: {
      type: "spray",
      disease,
      zoneId,
      zoneName: `${zoneId} \u533A`,
      target: {
        grid: targetCells.length ? targetCells[0] : { row: 0, col: 0 },
        cells: targetCells,
        zone: zoneId
      },
      spray: {
        speed: speedMs,
        // 飞行速度 m/s
        swath: swathM,
        // 喷幅 m
        flow: ratio.requiredFlowLmin,
        // 喷洒速度（流量）L/min
        dose: targetDoseLha,
        // 目标施药量 L/ha
        agent,
        // 药剂
        // 速度-喷洒比例锁（核心不变量）
        flowPerSpeed: ratio.flowPerSpeed,
        dutyCycle: ratio.dutyCycle,
        speedRange: ratio.speedRange
      },
      plan: {
        algo: "\u822A\u5411\xD7\u901F\u5EA6\xD7\u55B7\u5E45\u8054\u5408\u641C\u7D22\uFF08\u4E09\u76EE\u6807\u6253\u5206\uFF09\xB7 \u9776\u5411\u70B9\u55B7",
        length: route.totalLengthM,
        estMinutes: score.detail.totalMinutes,
        estVolumeL: ratio.totalVolumeL,
        ecoScore: score.eco,
        zoneId,
        // 靶向网格数与簇数（申报书「识别结果—地块—坐标—任务」可追溯的关键字段）
        targetCells: targetCells.length,
        targetClusters: route.nClusters ?? 0,
        targetAreaHa: round(targetAreaHa, 4),
        targetCoverage: route.targetCoverage,
        spillAreaHa: route.spillAreaHa,
        // 分区口径节药：「整块地都打」vs「只打有病的地方」
        zoneAreaHa: round(zoneAreaHa, 4),
        uniformZoneL: round(uniformZoneL, 2),
        savedVsZoneL: round(savedVsZoneL, 2),
        savedRatioVsZone: uniformZoneL > 0 ? round(Math.max(0, savedVsZoneL / uniformZoneL * 100), 1) : 0,
        // 全田口径节药（保留，供跨口径汇总；不可逐单相加）
        savedVsUniformL: round(uniformWholeFieldL - ratio.totalVolumeL, 2)
      },
      status: "pending"
    }
  };
}
function spraySavingRatio(missions, field, targetDoseLha = 12) {
  const sprays = missions.filter((m) => m.type === "spray");
  if (!sprays.length) return null;
  const fullPlan = autoPlan(field, { mode: "full" });
  const uniformL = fullPlan?.best?.ratio?.totalVolumeL ?? field.totalAreaHa() * targetDoseLha;
  if (uniformL <= 0) return null;
  const preciseL = sprays.reduce((a, m) => a + (m.plan?.estVolumeL || 0), 0);
  if (preciseL <= 0) return null;
  const zoneUniformL = sprays.reduce(
    (a, m) => a + (m.plan?.uniformZoneL ?? 0),
    0
  );
  const zoneSavedL = sprays.reduce(
    (a, m) => a + (m.plan?.savedVsZoneL ?? 0),
    0
  );
  return {
    uniformL: round(uniformL, 2),
    preciseL: round(preciseL, 2),
    savedL: round(uniformL - preciseL, 2),
    savedRatio: round(Math.max(0, (1 - preciseL / uniformL) * 100), 1),
    // 分区口径：靶向点喷相对「这些分区整体均匀喷洒」的节约
    zoneUniformL: round(zoneUniformL, 2),
    zoneSavedL: round(zoneSavedL, 2),
    savedRatioVsZone: zoneUniformL > 0 ? round(Math.max(0, zoneSavedL / zoneUniformL * 100), 1) : 0,
    sprayTasks: sprays.length
  };
}
function range(arr) {
  return { min: Math.min(...arr), max: Math.max(...arr) };
}
function round(v, d = 2) {
  const p = Math.pow(10, d);
  return Math.round(v * p) / p;
}
var Field, MODES;
var init_planner = __esm({
  "shared/planner.js"() {
    init_schema();
    Field = class {
      static {
        __name(this, "Field");
      }
      constructor({
        id,
        name,
        widthM,
        heightM,
        gridRows = 20,
        gridCols = 40,
        obstacles = [],
        soil = "loam",
        zoneCols = 4,
        zoneRows = 2,
        lat = null,
        lon = null
      }) {
        this.id = id;
        this.name = name;
        this.widthM = widthM;
        this.heightM = heightM;
        this.gridRows = gridRows;
        this.gridCols = gridCols;
        this.obstacles = obstacles;
        this.soil = soil;
        this.lat = lat;
        this.lon = lon;
        this.zoneCols = zoneCols;
        this.zoneRows = zoneRows;
      }
      get cellW() {
        return this.widthM / this.gridCols;
      }
      get cellH() {
        return this.heightM / this.gridRows;
      }
      get cellAreaHa() {
        return this.cellW * this.cellH / 1e4;
      }
      /** 管理分区的字母编号：A, B, C...（自西向东、自北向南） */
      get zoneLetters() {
        const out = [];
        for (let i = 0; i < this.zoneCols * this.zoneRows; i++) {
          out.push(String.fromCharCode(65 + i % 26));
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
            const c0 = Math.floor(x / this.widthM * this.gridCols);
            const c1 = Math.ceil((x + zw) / this.widthM * this.gridCols);
            const r0 = Math.floor(y / this.heightM * this.gridRows);
            const r1 = Math.ceil((y + zh) / this.heightM * this.gridRows);
            out.push({
              id: this.zoneLetters[i] || String(i + 1),
              index: i,
              row: r,
              col: c,
              x,
              y,
              w: zw,
              h: zh,
              areaHa: zw * zh / 1e4,
              gridRange: { r0, r1, c0, c1 }
            });
          }
        }
        return out;
      }
      /** 某个网格属于哪个管理分区 */
      zoneOfGrid(row, col) {
        const c = Math.floor(col / this.gridCols * this.zoneCols);
        const r = Math.floor(row / this.gridRows * this.zoneRows);
        const i = r * this.zoneCols + c;
        return this.zoneLetters[i] || String(i + 1);
      }
      cellCenter(row, col) {
        return { x: (col + 0.5) * this.cellW, y: (row + 0.5) * this.cellH };
      }
      isBlocked(row, col) {
        const c = this.cellCenter(row, col);
        const hw = this.cellW / 2, hh = this.cellH / 2;
        return this.obstacles.some((o) => c.x + hw > o.x && c.x - hw < o.x + o.w && c.y + hh > o.y && c.y - hh < o.y + o.h);
      }
      workCells() {
        const out = [];
        for (let r = 0; r < this.gridRows; r++)
          for (let c = 0; c < this.gridCols; c++)
            if (!this.isBlocked(r, c)) out.push({ row: r, col: c, ...this.cellCenter(r, c) });
        return out;
      }
      totalAreaHa() {
        return this.widthM * this.heightM / 1e4;
      }
      workableAreaHa() {
        return this.workCells().length * this.cellAreaHa;
      }
    };
    MODES = {
      full: {
        key: "full",
        name: "\u5168\u7530\u8986\u76D6\u4F5C\u4E1A",
        desc: "\u4F7F\u7528\u6574\u673A\u55B7\u5E45\u8FDE\u7EED\u5F80\u8FD4\uFF0C\u8986\u76D6\u5168\u90E8\u53EF\u4F5C\u4E1A\u9762\u79EF\u3002\u9002\u7528\u4E8E\u521D\u53D1\u671F\u5C1A\u672A\u6210\u7247\u7684\u7530\u5757\u3002",
        swathCandidates: [4, 5, 6, 7]
      },
      target: {
        key: "target",
        name: "\u9776\u5411\u70B9\u55B7\u4F5C\u4E1A",
        desc: '\u542F\u7528 1m \u7A84\u5E45\u55B7\u65BD\u673A\u6784\uFF0C\u4EC5\u5BF9\u786E\u8BCA\u75C5\u7076\u7F51\u683C\u65BD\u836F\u3002\u9002\u7528\u4E8E\u75C5\u5BB3\u5DF2\u660E\u786E\u3001\u9700\u8981"\u53EA\u6253\u6709\u75C5\u7684\u5730\u65B9"\u3002',
        swathCandidates: [1]
      }
    };
    __name(generateSprayRoute, "generateSprayRoute");
    __name(solveSprayRatio, "solveSprayRatio");
    __name(estimateEnergy, "estimateEnergy");
    __name(scoreRoute, "scoreRoute");
    __name(autoPlan, "autoPlan");
    __name(compareWithManual, "compareWithManual");
    __name(manualBaseline, "manualBaseline");
    __name(clusterCells, "clusterCells");
    __name(buildSprayMission, "buildSprayMission");
    __name(spraySavingRatio, "spraySavingRatio");
    __name(range, "range");
    __name(round, "round");
  }
});

// cloud/src/sqlite-store.js
var sqlite_store_exports = {};
__export(sqlite_store_exports, {
  SqliteStore: () => SqliteStore
});
function jparse(s, fallback) {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}
var nz, SqliteStore;
var init_sqlite_store = __esm({
  "cloud/src/sqlite-store.js"() {
    nz = /* @__PURE__ */ __name((v) => v === void 0 ? null : v, "nz");
    __name(jparse, "jparse");
    SqliteStore = class {
      static {
        __name(this, "SqliteStore");
      }
      constructor(sql) {
        this.sql = sql;
      }
      /** 执行一条查询，返回行数组 */
      all(query, ...params) {
        const cur = this.sql.exec(query, ...params);
        return cur.toArray();
      }
      /** 执行一条查询，返回第一行或 null */
      get(query, ...params) {
        const cur = this.sql.exec(query, ...params);
        return cur.one();
      }
      /** 执行写入语句 */
      run(query, ...params) {
        this.sql.exec(query, ...params);
      }
      /** 建表（DO 不支持 PRAGMA，列一次写全） */
      async migrate() {
        this.run(`
      CREATE TABLE IF NOT EXISTS fields (
        id TEXT PRIMARY KEY, name TEXT, width_m REAL, height_m REAL,
        grid_rows INTEGER, grid_cols INTEGER, obstacles TEXT, area_ha REAL,
        tenant_id TEXT, owner_user_id TEXT, lat REAL, lon REAL
      );
      CREATE TABLE IF NOT EXISTS devices (
        device_id TEXT PRIMARY KEY, kind TEXT, name TEXT, state TEXT,
        x REAL, y REAL, z REAL, batt REAL, coverage REAL,
        last_seen INTEGER, online INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS telemetry (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts INTEGER, device_id TEXT, kind TEXT, state TEXT,
        x REAL, y REAL, z REAL, spd REAL, hdg REAL, batt REAL,
        latency_ms INTEGER, payload TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_tel_ts ON telemetry(ts);
      CREATE INDEX IF NOT EXISTS idx_tel_dev ON telemetry(device_id);
      CREATE TABLE IF NOT EXISTS detections (
        det_id TEXT PRIMARY KEY, ts INTEGER, device_id TEXT, kind TEXT,
        part TEXT, disease TEXT, confidence REAL,
        bx REAL, by REAL, bw REAL, bh REAL,
        gx REAL, gy REAL, grid_row INTEGER, grid_col INTEGER, model TEXT,
        image_url TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_det_ts ON detections(ts);
      CREATE TABLE IF NOT EXISTS missions (
        mission_id TEXT PRIMARY KEY, created_at INTEGER, type TEXT,
        grid_row INTEGER, grid_col INTEGER, disease TEXT,
        speed REAL, swath REAL, flow REAL, dose REAL, agent TEXT,
        algo TEXT, length_m REAL, est_minutes REAL, est_volume_l REAL,
        eco_score REAL, status TEXT, cell_ids TEXT,
        zone_id TEXT, zone_name TEXT, flow_per_speed REAL, duty_cycle REAL,
        saved_vs_uniform_l REAL, target_cells INTEGER, target_clusters INTEGER,
        target_area_ha REAL, target_coverage REAL, spill_area_ha REAL,
        zone_area_ha REAL, uniform_zone_l REAL, saved_vs_zone_l REAL,
        saved_ratio_vs_zone REAL
      );
      CREATE INDEX IF NOT EXISTS idx_mis_created ON missions(created_at);
      CREATE INDEX IF NOT EXISTS idx_mis_type ON missions(type);
      CREATE TABLE IF NOT EXISTS link_events (
        event_id TEXT PRIMARY KEY, ts INTEGER,
        trigger_device TEXT, trigger_kind TEXT, reason TEXT,
        chain TEXT, grid_row INTEGER, grid_col INTEGER, disease TEXT,
        sense_ms INTEGER, dispatch_ms INTEGER, act_ms INTEGER, total_ms INTEGER,
        closed INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_le_ts ON link_events(ts);
      CREATE TABLE IF NOT EXISTS sprays (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts INTEGER, mission_id TEXT, grid_row INTEGER, grid_col INTEGER,
        disease TEXT, volume_l REAL, dose REAL, speed REAL, agent TEXT
      );
      CREATE TABLE IF NOT EXISTS tenants (
        tenant_id TEXT PRIMARY KEY, name TEXT, type TEXT,
        contact TEXT, created_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS members (
        user_id TEXT PRIMARY KEY, tenant_id TEXT, name TEXT, role TEXT,
        field_ids TEXT, created_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS device_access (
        device_id TEXT PRIMARY KEY, tenant_id TEXT, owner_user_id TEXT,
        kind TEXT, name TEXT, model TEXT, access_state TEXT,
        salt TEXT, registered_at INTEGER, last_seen INTEGER, online INTEGER DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS commands (
        command_id TEXT PRIMARY KEY, device_id TEXT, tenant_id TEXT,
        type TEXT, mission_id TEXT, payload TEXT, state TEXT,
        issued_at INTEGER, acked_at INTEGER, done_at INTEGER
      );
      CREATE TABLE IF NOT EXISTS usage_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts INTEGER, tenant_id TEXT, mission_id TEXT, type TEXT,
        area_mu REAL, volume_l REAL, minutes REAL, sorties INTEGER,
        detections INTEGER, saved_l REAL, amount REAL
      );
      CREATE INDEX IF NOT EXISTS idx_usage_ts ON usage_records(ts);
    `);
      }
      // ---- 地块 ----
      upsertField(f) {
        this.run(
          `INSERT OR REPLACE INTO fields
      (id,name,width_m,height_m,grid_rows,grid_cols,obstacles,area_ha,tenant_id,owner_user_id,lat,lon)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          nz(f.id),
          nz(f.name),
          nz(f.widthM),
          nz(f.heightM),
          nz(f.gridRows),
          nz(f.gridCols),
          JSON.stringify(f.obstacles || []),
          nz(f.totalAreaHa?.() ?? f.widthM * f.heightM / 1e4),
          nz(f.tenantId),
          nz(f.ownerUserId),
          nz(f.lat),
          nz(f.lon)
        );
      }
      listFields() {
        return this.all(`SELECT * FROM fields`).map((r) => ({
          id: r.id,
          name: r.name,
          widthM: r.width_m,
          heightM: r.height_m,
          gridRows: r.grid_rows,
          gridCols: r.grid_cols,
          obstacles: jparse(r.obstacles, []),
          areaHa: r.area_ha,
          tenantId: r.tenant_id ?? null,
          ownerUserId: r.owner_user_id ?? null,
          lat: r.lat ?? null,
          lon: r.lon ?? null
        }));
      }
      getField(id) {
        return this.listFields().find((f) => f.id === id);
      }
      // ---- 设备 ----
      upsertDevice(d) {
        this.run(
          `INSERT INTO devices
      (device_id,kind,name,state,x,y,z,batt,coverage,last_seen,online)
      VALUES (?,?,?,?,?,?,?,?,?,?,1)
      ON CONFLICT(device_id) DO UPDATE SET
        kind=excluded.kind, name=excluded.name, state=excluded.state,
        x=excluded.x, y=excluded.y, z=excluded.z, batt=excluded.batt,
        coverage=excluded.coverage, last_seen=excluded.last_seen, online=1`,
          nz(d.deviceId),
          nz(d.kind),
          nz(d.name || d.deviceId),
          nz(d.state),
          nz(d.pos?.x),
          nz(d.pos?.y),
          nz(d.pos?.z),
          nz(d.batt),
          nz(d.coverage),
          nz(d.lastSeen ?? Date.now())
        );
      }
      setDeviceOffline(deviceId) {
        this.run(`UPDATE devices SET online=0, state='offline' WHERE device_id=?`, deviceId);
      }
      listDevices() {
        return this.all(`SELECT * FROM devices ORDER BY device_id`).map((r) => ({
          deviceId: r.device_id,
          kind: r.kind,
          name: r.name,
          state: r.state,
          pos: { x: r.x, y: r.y, z: r.z },
          batt: r.batt,
          coverage: r.coverage,
          lastSeen: r.last_seen,
          online: !!r.online
        }));
      }
      // ---- 遥测 ----
      insertTelemetry(t, latency) {
        this.run(
          `INSERT INTO telemetry
      (ts,device_id,kind,state,x,y,z,spd,hdg,batt,latency_ms,payload)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          nz(t.ts),
          nz(t.deviceId),
          nz(t.kind),
          nz(t.state),
          nz(t.pos?.x),
          nz(t.pos?.y),
          nz(t.pos?.z),
          nz(t.pos?.spd),
          nz(t.pos?.hdg),
          nz(t.batt),
          nz(latency),
          JSON.stringify(t.payload || {})
        );
      }
      recentTelemetry(limit = 200, deviceId = null) {
        const sql = deviceId ? `SELECT * FROM (SELECT * FROM telemetry WHERE device_id=? ORDER BY ts DESC, id DESC LIMIT ?) ORDER BY ts ASC, id ASC` : `SELECT * FROM (SELECT * FROM telemetry ORDER BY ts DESC, id DESC LIMIT ?) ORDER BY ts ASC, id ASC`;
        const rows = deviceId ? this.all(sql, deviceId, limit) : this.all(sql, limit);
        return rows.map((r) => ({
          ts: r.ts,
          deviceId: r.device_id,
          kind: r.kind,
          state: r.state,
          pos: { x: r.x, y: r.y, z: r.z, spd: r.spd, hdg: r.hdg },
          batt: r.batt,
          latencyMs: r.latency_ms,
          payload: jparse(r.payload, {})
        }));
      }
      telemetryRange(fromTs, toTs) {
        return this.all(`SELECT * FROM telemetry WHERE ts BETWEEN ? AND ? ORDER BY ts`, fromTs, toTs).map((r) => ({
          ts: r.ts,
          deviceId: r.device_id,
          kind: r.kind,
          state: r.state,
          x: r.x,
          y: r.y,
          z: r.z,
          spd: r.spd,
          hdg: r.hdg,
          batt: r.batt,
          latencyMs: r.latency_ms
        }));
      }
      // ---- 检测 ----
      insertDetection(d) {
        this.run(
          `INSERT OR REPLACE INTO detections
      (det_id,ts,device_id,kind,part,disease,confidence,bx,by,bw,bh,gx,gy,grid_row,grid_col,model,image_url)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          nz(d.detId),
          nz(d.ts),
          nz(d.deviceId),
          nz(d.kind),
          nz(d.part),
          nz(d.disease),
          nz(d.confidence),
          nz(d.bbox?.x),
          nz(d.bbox?.y),
          nz(d.bbox?.w),
          nz(d.bbox?.h),
          nz(d.geo?.x),
          nz(d.geo?.y),
          nz(d.grid?.row),
          nz(d.grid?.col),
          nz(d.model ?? "SAN-GAT-RL"),
          nz(d.imageUrl)
        );
      }
      listDetections(limit = 500) {
        return this.all(`SELECT * FROM detections ORDER BY ts DESC, det_id DESC LIMIT ?`, limit).map((r) => ({
          detId: r.det_id,
          ts: r.ts,
          deviceId: r.device_id,
          kind: r.kind,
          part: r.part,
          disease: r.disease,
          confidence: r.confidence,
          bbox: { x: r.bx, y: r.by, w: r.bw, h: r.bh },
          geo: { x: r.gx, y: r.gy },
          grid: { row: r.grid_row, col: r.grid_col },
          model: r.model,
          imageUrl: r.image_url
        }));
      }
      // ---- 任务 ----
      insertMission(m) {
        this.run(
          `INSERT OR REPLACE INTO missions
      (mission_id,created_at,type,grid_row,grid_col,disease,speed,swath,flow,dose,agent,
       algo,length_m,est_minutes,est_volume_l,eco_score,status,cell_ids,
       zone_id,zone_name,flow_per_speed,duty_cycle,saved_vs_uniform_l,
       target_cells,target_clusters,target_area_ha,target_coverage,spill_area_ha,
       zone_area_ha,uniform_zone_l,saved_vs_zone_l,saved_ratio_vs_zone)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          nz(m.missionId),
          nz(m.createdAt),
          nz(m.type),
          nz(m.target?.grid?.row),
          nz(m.target?.grid?.col),
          nz(m.disease),
          nz(m.spray?.speed),
          nz(m.spray?.swath),
          nz(m.spray?.flow),
          nz(m.spray?.dose),
          nz(m.spray?.agent),
          nz(m.plan?.algo),
          nz(m.plan?.length),
          nz(m.plan?.estMinutes),
          nz(m.plan?.estVolumeL ?? m.plan?.estDose),
          nz(m.plan?.ecoScore),
          nz(m.status ?? "pending"),
          JSON.stringify(m.target?.cells ?? []),
          nz(m.zoneId ?? m.target?.zone),
          nz(m.zoneName),
          nz(m.spray?.flowPerSpeed),
          nz(m.spray?.dutyCycle),
          nz(m.plan?.savedVsUniformL),
          nz(m.plan?.targetCells),
          nz(m.plan?.targetClusters),
          nz(m.plan?.targetAreaHa),
          nz(m.plan?.targetCoverage),
          nz(m.plan?.spillAreaHa),
          nz(m.plan?.zoneAreaHa),
          nz(m.plan?.uniformZoneL),
          nz(m.plan?.savedVsZoneL),
          nz(m.plan?.savedRatioVsZone)
        );
      }
      updateMissionStatus(missionId, status) {
        this.run(`UPDATE missions SET status=? WHERE mission_id=?`, status, missionId);
      }
      listMissions(limit = 200) {
        return this.all(`SELECT * FROM missions ORDER BY created_at DESC, mission_id DESC LIMIT ?`, limit).map((r) => this._missionRow(r));
      }
      listMissionsByType(type, limit = 200) {
        return this.all(
          `SELECT * FROM missions WHERE type=? ORDER BY created_at DESC, mission_id DESC LIMIT ?`,
          type,
          limit
        ).map((r) => this._missionRow(r));
      }
      _missionRow(r) {
        return {
          missionId: r.mission_id,
          createdAt: r.created_at,
          type: r.type,
          grid: { row: r.grid_row, col: r.grid_col },
          disease: r.disease,
          spray: {
            speed: r.speed,
            swath: r.swath,
            flow: r.flow,
            dose: r.dose,
            agent: r.agent,
            flowPerSpeed: r.flow_per_speed,
            dutyCycle: r.duty_cycle
          },
          plan: {
            algo: r.algo,
            length: r.length_m,
            estMinutes: r.est_minutes,
            estVolumeL: r.est_volume_l,
            ecoScore: r.eco_score,
            savedVsUniformL: r.saved_vs_uniform_l,
            targetCells: r.target_cells,
            targetClusters: r.target_clusters,
            targetAreaHa: r.target_area_ha,
            targetCoverage: r.target_coverage,
            spillAreaHa: r.spill_area_ha,
            zoneAreaHa: r.zone_area_ha,
            uniformZoneL: r.uniform_zone_l,
            savedVsZoneL: r.saved_vs_zone_l,
            savedRatioVsZone: r.saved_ratio_vs_zone
          },
          status: r.status,
          cells: jparse(r.cell_ids, []),
          zoneId: r.zone_id ?? r.zone_name?.match(/^([A-Z])/)?.[1] ?? null,
          zoneName: r.zone_name
        };
      }
      // ---- 联动事件 ----
      insertLinkEvent(e) {
        this.run(
          `INSERT OR REPLACE INTO link_events
      (event_id,ts,trigger_device,trigger_kind,reason,chain,grid_row,grid_col,disease,
       sense_ms,dispatch_ms,act_ms,total_ms,closed)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          nz(e.eventId),
          nz(e.ts),
          nz(e.trigger.deviceId),
          nz(e.trigger.kind),
          nz(e.trigger.reason),
          JSON.stringify(e.chain),
          nz(e.grid?.row),
          nz(e.grid?.col),
          nz(e.disease),
          nz(e.latency.sense),
          nz(e.latency.dispatch),
          nz(e.latency.act),
          nz(e.latency.total),
          e.closed ? 1 : 0
        );
      }
      listLinkEvents(limit = 200) {
        return this.all(`SELECT * FROM link_events ORDER BY ts DESC, event_id DESC LIMIT ?`, limit).map((r) => ({
          eventId: r.event_id,
          ts: r.ts,
          trigger: { deviceId: r.trigger_device, kind: r.trigger_kind, reason: r.reason },
          chain: jparse(r.chain, []),
          grid: { row: r.grid_row, col: r.grid_col },
          disease: r.disease,
          latency: { sense: r.sense_ms, dispatch: r.dispatch_ms, act: r.act_ms, total: r.total_ms },
          closed: !!r.closed,
          pendingReason: r.closed ? null : "\u5DF2\u6D3E\u5355\u590D\u6838\uFF0C\u5730\u9762\u673A\u5668\u4EBA\u5C1A\u672A\u56DE\u4F20\u8FD1\u8DDD\u590D\u6838\u8BC1\u636E"
        }));
      }
      // ---- 施药记录 ----
      insertSpray(s) {
        this.run(
          `INSERT INTO sprays
      (ts,mission_id,grid_row,grid_col,disease,volume_l,dose,speed,agent)
      VALUES (?,?,?,?,?,?,?,?,?)`,
          nz(s.ts),
          nz(s.missionId),
          nz(s.grid?.row),
          nz(s.grid?.col),
          nz(s.disease),
          nz(s.volumeL),
          nz(s.dose),
          nz(s.speed),
          nz(s.agent)
        );
      }
      // ---- 统计 ----
      countRows(table) {
        try {
          return this.get(`SELECT COUNT(*) c FROM ${table}`)?.c ?? 0;
        } catch {
          return 0;
        }
      }
      /* ================================================================
       * 平台底座：租户 / 成员 / 设备接入 / 指令 / 计量
       * ================================================================ */
      upsertTenant(t) {
        this.run(
          `INSERT OR REPLACE INTO tenants
      (tenant_id,name,type,contact,created_at) VALUES (?,?,?,?,?)`,
          nz(t.id || t.tenantId),
          nz(t.name),
          nz(t.type || "farm"),
          nz(t.contact),
          nz(t.createdAt ?? Date.now())
        );
      }
      listTenants() {
        return this.all(`SELECT * FROM tenants ORDER BY created_at`).map((r) => ({
          id: r.tenant_id,
          name: r.name,
          type: r.type,
          contact: r.contact,
          createdAt: r.created_at
        }));
      }
      getTenant(id) {
        return this.listTenants().find((t) => t.id === id) || null;
      }
      upsertMember(m) {
        this.run(
          `INSERT OR REPLACE INTO members
      (user_id,tenant_id,name,role,field_ids,created_at) VALUES (?,?,?,?,?,?)`,
          nz(m.userId),
          nz(m.tenantId),
          nz(m.name),
          nz(m.role),
          JSON.stringify(m.fieldIds || []),
          nz(m.createdAt ?? Date.now())
        );
      }
      listMembers(tenantId = null) {
        const rows = tenantId ? this.all(`SELECT * FROM members WHERE tenant_id=? ORDER BY created_at`, tenantId) : this.all(`SELECT * FROM members ORDER BY created_at`);
        return rows.map((r) => ({
          userId: r.user_id,
          tenantId: r.tenant_id,
          name: r.name,
          role: r.role,
          fieldIds: jparse(r.field_ids, []),
          createdAt: r.created_at
        }));
      }
      getMember(userId) {
        const r = this.get(`SELECT * FROM members WHERE user_id=?`, userId);
        if (!r) return null;
        return {
          userId: r.user_id,
          tenantId: r.tenant_id,
          name: r.name,
          role: r.role,
          fieldIds: jparse(r.field_ids, []),
          createdAt: r.created_at
        };
      }
      upsertDeviceAccess(d) {
        this.run(
          `INSERT OR REPLACE INTO device_access
      (device_id,tenant_id,owner_user_id,kind,name,model,access_state,salt,registered_at,last_seen,online)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          nz(d.deviceId),
          nz(d.tenantId),
          nz(d.ownerUserId),
          nz(d.kind),
          nz(d.name),
          nz(d.model),
          nz(d.accessState),
          nz(d.salt),
          nz(d.registeredAt ?? Date.now()),
          nz(d.lastSeen ?? Date.now()),
          d.online ? 1 : 0
        );
      }
      listDeviceAccess() {
        return this.all(`SELECT * FROM device_access ORDER BY registered_at`).map((r) => ({
          deviceId: r.device_id,
          tenantId: r.tenant_id,
          ownerUserId: r.owner_user_id,
          kind: r.kind,
          name: r.name,
          model: r.model,
          accessState: r.access_state,
          registeredAt: r.registered_at,
          lastSeen: r.last_seen,
          online: !!r.online
        }));
      }
      getDeviceAccess(deviceId) {
        const r = this.get(`SELECT * FROM device_access WHERE device_id=?`, deviceId);
        if (!r) return null;
        return {
          deviceId: r.device_id,
          tenantId: r.tenant_id,
          ownerUserId: r.owner_user_id,
          kind: r.kind,
          name: r.name,
          model: r.model,
          accessState: r.access_state,
          salt: r.salt,
          registeredAt: r.registered_at,
          lastSeen: r.last_seen,
          online: !!r.online
        };
      }
      setDeviceAccessState(deviceId, state) {
        this.run(`UPDATE device_access SET access_state=? WHERE device_id=?`, state, deviceId);
      }
      insertCommand(c) {
        this.run(
          `INSERT OR REPLACE INTO commands
      (command_id,device_id,tenant_id,type,mission_id,payload,state,issued_at,acked_at,done_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`,
          nz(c.commandId),
          nz(c.deviceId),
          nz(c.tenantId),
          nz(c.type),
          nz(c.missionId),
          JSON.stringify(c.payload || {}),
          nz(c.state),
          nz(c.issuedAt),
          nz(c.ackedAt),
          nz(c.doneAt)
        );
      }
      listCommands(deviceId = null, limit = 200) {
        const rows = deviceId ? this.all(`SELECT * FROM commands WHERE device_id=? ORDER BY issued_at DESC, command_id DESC LIMIT ?`, deviceId, limit) : this.all(`SELECT * FROM commands ORDER BY issued_at DESC, command_id DESC LIMIT ?`, limit);
        return rows.map((r) => ({
          commandId: r.command_id,
          deviceId: r.device_id,
          tenantId: r.tenant_id,
          type: r.type,
          missionId: r.mission_id,
          payload: jparse(r.payload, {}),
          state: r.state,
          issuedAt: r.issued_at,
          ackedAt: r.acked_at,
          doneAt: r.done_at
        }));
      }
      insertUsage(u) {
        this.run(
          `INSERT INTO usage_records
      (ts,tenant_id,mission_id,type,area_mu,volume_l,minutes,sorties,detections,saved_l,amount)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          nz(u.ts ?? Date.now()),
          nz(u.tenantId),
          nz(u.missionId),
          nz(u.type),
          nz(u.areaMu),
          nz(u.volumeL),
          nz(u.minutes),
          nz(u.sorties ?? 0),
          nz(u.detections ?? 0),
          nz(u.savedL),
          nz(u.amount)
        );
      }
      listUsage(tenantId = null, limit = 500) {
        const rows = tenantId ? this.all(`SELECT * FROM usage_records WHERE tenant_id=? ORDER BY ts DESC, id DESC LIMIT ?`, tenantId, limit) : this.all(`SELECT * FROM usage_records ORDER BY ts DESC, id DESC LIMIT ?`, limit);
        return rows.map((r) => ({
          ts: r.ts,
          tenantId: r.tenant_id,
          missionId: r.mission_id,
          type: r.type,
          areaMu: r.area_mu,
          volumeL: r.volume_l,
          minutes: r.minutes,
          sorties: r.sorties,
          detections: r.detections,
          savedL: r.saved_l,
          amount: r.amount
        }));
      }
    };
  }
});

// shared/linkstats.js
var linkstats_exports = {};
__export(linkstats_exports, {
  LinkStats: () => LinkStats
});
var LinkStats;
var init_linkstats = __esm({
  "shared/linkstats.js"() {
    LinkStats = class {
      static {
        __name(this, "LinkStats");
      }
      constructor() {
        this.deviceStats = /* @__PURE__ */ new Map();
      }
      ensureStats(deviceId, kind) {
        if (!this.deviceStats.has(deviceId)) {
          this.deviceStats.set(deviceId, {
            deviceId,
            kind,
            sent: 0,
            recv: 0,
            lost: 0,
            latSamples: [],
            lastSeen: Date.now(),
            rttMs: null,
            state: "offline"
          });
        }
        return this.deviceStats.get(deviceId);
      }
      /** 记录一路遥测 */
      record(deviceId, kind, latencyMs, seq, state = null) {
        if (!deviceId) return;
        const st = this.ensureStats(deviceId, kind);
        st.sent += 1;
        st.recv += 1;
        if (st.lastSeq != null && seq != null) {
          const gap = seq - st.lastSeq - 1;
          if (gap > 0) st.lost += gap;
        }
        if (seq != null) st.lastSeq = seq;
        st.latSamples.push(latencyMs);
        if (st.latSamples.length > 200) st.latSamples.shift();
        st.lastSeen = Date.now();
        if (state) st.state = state;
      }
      /** 记录 RTT（设备主动上报 ping/pong 测量结果） */
      recordRtt(deviceId, rttMs) {
        const st = this.deviceStats.get(deviceId);
        if (st) st.rttMs = Math.round(rttMs);
      }
      /** 链路质量指标列表 —— 平台"实时性"面板的数据源 */
      linkMetrics() {
        const out = [];
        for (const st of this.deviceStats.values()) {
          const s = [...st.latSamples].sort((a, b) => a - b);
          const avg = s.length ? s.reduce((a, b) => a + b, 0) / s.length : 0;
          const p95 = s.length ? s[Math.min(s.length - 1, Math.floor(s.length * 0.95))] : 0;
          out.push({
            deviceId: st.deviceId,
            kind: st.kind,
            sent: st.sent,
            recv: st.recv,
            lost: st.lost,
            lossRate: st.sent > 0 ? +(st.lost / (st.sent + st.lost)).toFixed(4) : 0,
            avgLatencyMs: Math.round(avg),
            p95LatencyMs: Math.round(p95),
            rttMs: st.rttMs,
            lastSeen: st.lastSeen,
            state: st.state,
            online: Date.now() - st.lastSeen < 5e3
          });
        }
        return out.sort((a, b) => a.deviceId.localeCompare(b.deviceId));
      }
    };
  }
});

// shared/realtime.js
var realtime_exports = {};
__export(realtime_exports, {
  RealtimeHub: () => RealtimeHub,
  recordRtt: () => recordRtt
});
function recordRtt(hub, deviceId, rttMs) {
  hub.stats.recordRtt(deviceId, rttMs);
}
var RealtimeHub;
var init_realtime = __esm({
  "shared/realtime.js"() {
    init_schema();
    init_linkstats();
    RealtimeHub = class {
      static {
        __name(this, "RealtimeHub");
      }
      /**
       * @param {object} opts
       * @param {object} opts.store       存储接口
       * @param {function} opts.onTelemetry 遥测回调 (t, latency)
       * @param {function} opts.onDetection 检出回调 (d)
       * @param {LinkStats} opts.stats     链路统计实例（可注入，便于测试）
       */
      constructor({ store, onTelemetry, onDetection, stats }) {
        this.store = store;
        this.onTelemetry = onTelemetry || (() => {
        });
        this.onDetection = onDetection || (() => {
        });
        this.clients = /* @__PURE__ */ new Map();
        this.stats = stats || new LinkStats();
      }
      /**
       * 处理一帧设备消息。
       * @param {object} ws  具备 send() 的对象
       * @param {object} client 已登记的客户端信息
       * @param {object} msg   解析后的消息
       */
      handle(ws, client, msg) {
        if (!client) return;
        const type = msg.type;
        switch (type) {
          case "telemetry": {
            const t = msg.payload;
            const recvAt = Date.now();
            this.ensureStats(t.deviceId || client.deviceId, t.kind || client.kind);
            const st = this.ensureStats(t.deviceId || client.deviceId, t.kind || client.kind);
            const latency = recvAt - (t.ts || recvAt);
            this.recordTelemetry(t.deviceId || client.deviceId, t.kind || client.kind, latency, t.seq, t.state);
            st.state = t.state;
            st.pos = t.pos;
            st.batt = t.batt;
            st.coverage = t.coverage;
            this.store.upsertDevice({
              deviceId: t.deviceId || client.deviceId,
              kind: t.kind || client.kind,
              name: t.name || t.deviceId || client.deviceId,
              state: t.state || DEVICE_STATES.IDLE,
              pos: t.pos,
              batt: t.batt,
              coverage: t.coverage,
              lastSeen: recvAt,
              online: true
            });
            this.onTelemetry(t, latency);
            this.ack(ws, "telemetry", t.frameId, recvAt);
            break;
          }
          case "detection": {
            const d = msg.payload;
            this.store.insertDetection(d);
            this.onDetection(d);
            this.ack(ws, "detection", d.detId, Date.now());
            break;
          }
          case "mission_ack": {
            this.store.updateMissionStatus(msg.payload.missionId, msg.payload.status);
            break;
          }
          case "ping": {
            ws.send(JSON.stringify({ type: "pong", ts: msg.payload?.ts ?? Date.now(), serverTs: Date.now() }));
            break;
          }
          default:
            break;
        }
      }
      ack(ws, kind, id, serverTs) {
        try {
          ws.send(JSON.stringify({ type: "ack", kind, id, serverTs }));
        } catch {
        }
      }
      /**
       * 记录一路遥测的链路质量。
       * 设备走 WebSocket 时由 handle() 调用；
       * 模拟器或 HTTP 补传等非 WS 来源同样调用此方法，保证链路面板始终有数据。
       */
      recordTelemetry(deviceId, kind, latencyMs, seq, state = null) {
        this.stats.record(deviceId, kind, latencyMs, seq, state);
      }
      ensureStats(deviceId, kind) {
        return this.stats.ensureStats(deviceId, kind);
      }
      /** 链路质量指标列表 —— 平台"实时性"面板的数据源 */
      linkMetrics() {
        return this.stats.linkMetrics();
      }
      /** 广播给所有设备端订阅者 */
      broadcastRaw(msg) {
        for (const ws of this.clients.keys()) {
          try {
            ws.send(msg);
          } catch {
          }
        }
      }
      /** 广播给所有浏览器前端 */
      broadcast(type, payload) {
        this.broadcastRaw(JSON.stringify({ type, payload, ts: Date.now() }));
      }
    };
    __name(recordRtt, "recordRtt");
  }
});

// shared/spraydispatch.js
var spraydispatch_exports = {};
__export(spraydispatch_exports, {
  TARGET_SPRAY: () => TARGET_SPRAY,
  buildRecheckMission: () => buildRecheckMission,
  buildSprayMissions: () => buildSprayMissions,
  pickSprayZones: () => pickSprayZones,
  savingSummary: () => savingSummary
});
function pickSprayZones(dets, missions, field) {
  const done = new Set(
    missions.filter((m) => m.type === "spray").map((m) => m.zoneId || m.target?.zone).filter(Boolean)
  );
  const byZone = /* @__PURE__ */ new Map();
  for (const d of dets) {
    if (d.confidence < 0.75) continue;
    const zid = field.zoneOfGrid(d.grid.row, d.grid.col);
    if (!zid) continue;
    const key = zid;
    if (!byZone.has(key)) {
      byZone.set(key, { zoneId: key, cells: [], count: 0, diseases: {}, confSum: 0 });
    }
    const z = byZone.get(key);
    const cellKey = `${d.grid.row}_${d.grid.col}`;
    if (!z.cellKeys) z.cellKeys = /* @__PURE__ */ new Set();
    if (!z.cellKeys.has(cellKey)) {
      z.cellKeys.add(cellKey);
      z.cells.push({ row: d.grid.row, col: d.grid.col });
    }
    z.count += 1;
    z.confSum += d.confidence;
    z.diseases[d.disease] = (z.diseases[d.disease] || 0) + 1;
  }
  const zones = [...byZone.values()].map((z) => ({
    zoneId: z.zoneId,
    cells: z.cells,
    count: z.count,
    avgConfidence: +(z.confSum / z.count).toFixed(3),
    topDisease: Object.entries(z.diseases).sort((a, b) => b[1] - a[1])[0][0],
    done: done.has(z.zoneId)
  }));
  return zones.filter((z) => !z.done && z.count >= TARGET_SPRAY.densityThreshold).sort((a, b) => b.count - a.count);
}
function buildSprayMissions({ field, dets, missions, plan = null }) {
  const targets = pickSprayZones(dets, missions, field);
  const chosen = targets.slice(0, TARGET_SPRAY.maxZonesPerRound);
  const out = [];
  for (const t of chosen) {
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
      agent: TARGET_SPRAY.agents[t.topDisease] || TARGET_SPRAY.agents.rust
    });
    const missionId = `SP-${Date.now()}-${t.zoneId}`;
    out.push({
      ...built,
      mission: { ...built.mission, missionId, createdAt: Date.now() },
      hotspot: t
    });
  }
  return out;
}
function savingSummary(missions, field) {
  return spraySavingRatio(missions, field, TARGET_SPRAY.targetDoseLha);
}
function buildRecheckMission({ detection, field, missionId, cells = null, agent = null }) {
  const g = detection?.grid || {};
  let cellList = cells;
  if (!cellList || !cellList.length) {
    cellList = [];
    if (g.row != null && g.col != null) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const r = g.row + dr, c = g.col + dc;
          if (r < 0 || c < 0) continue;
          if (field?.gridRows && r >= field.gridRows) continue;
          if (field?.gridCols && c >= field.gridCols) continue;
          cellList.push({ row: r, col: c });
        }
      }
    }
  }
  const zoneId = field?.zoneOfGrid && g.row != null ? field.zoneOfGrid(g.row, g.col) : null;
  return {
    missionId: missionId || `RC-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
    createdAt: Date.now(),
    type: "recheck",
    tenantId: null,
    target: {
      grid: { row: g.row ?? null, col: g.col ?? null },
      cells: cellList,
      bbox: null
    },
    zoneId,
    zoneName: zoneId ? `${zoneId} \u533A` : null,
    disease: detection?.disease ?? null,
    spray: {},
    plan: {
      algo: "near-field-recheck",
      targetCells: cellList.length,
      // 近距复核按每点位 45 秒估算
      estMinutes: +(cellList.length * 0.75).toFixed(1)
    },
    status: "pending",
    // 复核需要的拍摄部位：空中看不到的部位
    recheckParts: ["underside", "stem", "soil"],
    agent: agent || null
  };
}
var TARGET_SPRAY;
var init_spraydispatch = __esm({
  "shared/spraydispatch.js"() {
    init_planner();
    TARGET_SPRAY = {
      swathM: 1,
      targetDoseLha: 12,
      /** 触发阈值：网格累计检出达到该密度即视为需要处置 */
      densityThreshold: 2,
      /** 单次作业最多覆盖的管理分区数 */
      maxZonesPerRound: 2,
      /** 药剂表：按病害选择 */
      agents: {
        rust: "\u620A\u5511\u9187\xB7\u82EF\u919A\u7532\u73AF\u5511",
        powdery: "\u4E09\u5511\u916E\xB7\u620A\u5511\u9187",
        loose_smut: "\u4E95\u5188\u9709\u7D20\xB7\u8721\u82BD\u83CC",
        root_rot: "\u6076\u9709\u7075\xB7\u7532\u57FA\u786B\u83CC\u7075",
        fusarium: "\u620A\u5511\u9187\xB7\u82EF\u919A\u7532\u73AF\u5511",
        leaf_blight: "\u4EE3\u68EE\u9530\u950C\xB7\u591A\u83CC\u7075"
      }
    };
    __name(pickSprayZones, "pickSprayZones");
    __name(buildSprayMissions, "buildSprayMissions");
    __name(savingSummary, "savingSummary");
    __name(buildRecheckMission, "buildRecheckMission");
  }
});

// server/src/mini.js
function matchPath(pattern, pathname) {
  const pp = pattern.split("/").filter(Boolean);
  const ap = pathname.split("/").filter(Boolean);
  if (pp.length !== ap.length) return null;
  const params = {};
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(":")) {
      params[pp[i].slice(1)] = decodeURIComponent(ap[i]);
    } else if (pp[i] !== ap[i]) {
      return null;
    }
  }
  return params;
}
__name(matchPath, "matchPath");
async function runHandler(fn, req, res) {
  if (fn.length >= 3) {
    let advanced = false;
    await fn(req, res, (err) => {
      if (err) throw err;
      advanced = true;
    });
    return advanced ? "next" : "stop";
  }
  await fn(req, res);
  return "stop";
}
__name(runHandler, "runHandler");
var MiniRequest = class {
  static {
    __name(this, "MiniRequest");
  }
  constructor({ method, url, headers = {}, body = null }) {
    this.method = String(method || "GET").toUpperCase();
    this.url = url;
    this.headers = {};
    for (const [k, v] of Object.entries(headers)) this.headers[k.toLowerCase()] = v;
    const u = new URL(url, "http://internal");
    this.pathname = u.pathname;
    this.query = Object.fromEntries(u.searchParams.entries());
    this.body = body;
    this.params = {};
  }
  /** 取请求头（不区分大小写） */
  get(name) {
    return this.headers[String(name).toLowerCase()];
  }
};
var MiniResponse = class {
  static {
    __name(this, "MiniResponse");
  }
  constructor() {
    this.statusCode = 200;
    this.headers = {};
    this.body = null;
    this.finished = false;
  }
  status(code) {
    this.statusCode = code;
    return this;
  }
  set(key, value) {
    this.headers[key] = value;
    return this;
  }
  json(obj) {
    this.headers["Content-Type"] = "application/json; charset=utf-8";
    this.body = JSON.stringify(obj);
    this.finished = true;
    return this;
  }
  send(data) {
    if (data !== null && typeof data === "object") return this.json(data);
    this.body = data === void 0 || data === null ? "" : String(data);
    this.finished = true;
    return this;
  }
  sendStatus(code) {
    this.statusCode = code;
    this.body = code === 204 ? "" : String(code);
    this.finished = true;
    return this;
  }
  end(data) {
    if (data !== void 0) this.body = String(data);
    this.finished = true;
    return this;
  }
};
var MiniRouter = class {
  static {
    __name(this, "MiniRouter");
  }
  constructor() {
    this.routes = [];
    this.middlewares = [];
  }
  use(fn) {
    this.middlewares.push(fn);
    return this;
  }
  get(path, ...handlers) {
    return this._add("GET", path, handlers);
  }
  post(path, ...handlers) {
    return this._add("POST", path, handlers);
  }
  put(path, ...handlers) {
    return this._add("PUT", path, handlers);
  }
  delete(path, ...handlers) {
    return this._add("DELETE", path, handlers);
  }
  _add(method, path, handlers) {
    this.routes.push({ method, path, handlers });
    return this;
  }
  /** 命中第一条匹配路由 */
  match(method, pathname) {
    for (const r of this.routes) {
      if (r.method !== method) continue;
      const params = matchPath(r.path, pathname);
      if (params) return { route: r, params };
    }
    return null;
  }
  /** 处理一次请求，返回 MiniResponse */
  async handle(req) {
    const res = new MiniResponse();
    for (const mw of this.middlewares) {
      if (await runHandler(mw, req, res) === "stop") return res;
    }
    const m = this.match(req.method, req.pathname);
    if (!m) {
      return res.status(404).json({ error: "\u63A5\u53E3\u4E0D\u5B58\u5728", path: req.pathname });
    }
    req.params = m.params;
    for (const h of m.route.handlers) {
      if (await runHandler(h, req, res) === "stop") return res;
    }
    return res;
  }
};
function corsMiddleware(req, res, next) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type, X-Device-Id, X-Device-Kind, X-Device-Key, X-User-Id");
  res.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
}
__name(corsMiddleware, "corsMiddleware");

// shared/tenancy.js
var TENANT_TYPES = {
  platform: {
    name: "\u5E73\u53F0\u8FD0\u8425\u65B9",
    desc: "\u6211\u4EEC\u81EA\u5DF1\u7684\u8FD0\u8425\u4E3B\u4F53\uFF0C\u7BA1\u7406\u5168\u90E8\u79DF\u6237\u3001\u8BA1\u8D39\u4E0E\u5BA1\u8BA1",
    color: "green"
  },
  farm: {
    name: "\u519C\u573A / \u5408\u4F5C\u793E",
    desc: "\u62E5\u6709\u5730\u5757\u3001\u4E0B\u8FBE\u4F5C\u4E1A\u9700\u6C42\u3001\u6309\u4EA9\u6216\u6309\u67B6\u6B21\u4ED8\u8D39",
    color: "blue"
  },
  team: {
    name: "\u4F5C\u4E1A\u961F / \u670D\u52A1\u5546",
    desc: "\u627F\u63A5\u4F5C\u4E1A\u5355\uFF0C\u6309\u67B6\u6B21\u4E0E\u4EA9\u6570\u7ED3\u7B97",
    color: "amber"
  },
  gov: {
    name: "\u653F\u5E9C\u76D1\u7BA1\u90E8\u95E8",
    desc: "\u8DE8\u4E3B\u4F53\u53EA\u8BFB\u6C47\u603B\uFF0C\u7528\u4E8E\u76D1\u7BA1\u4E0E\u8865\u8D34\u6838\u9A8C",
    color: "purple"
  }
};
var PERMISSIONS = {
  "field.read": "\u67E5\u770B\u5730\u5757\u4E0E\u7F51\u683C\u6570\u636E",
  "field.write": "\u767B\u8BB0\u4E0E\u4FEE\u6539\u5730\u5757",
  "device.read": "\u67E5\u770B\u8BBE\u5907\u4E0E\u94FE\u8DEF\u72B6\u6001",
  "device.register": "\u6CE8\u518C\u8BBE\u5907\u5E76\u4E0B\u53D1\u5BC6\u94A5",
  "device.revoke": "\u540A\u9500\u8BBE\u5907\u5BC6\u94A5",
  "mission.read": "\u67E5\u770B\u4F5C\u4E1A\u5355",
  "mission.dispatch": "\u6D3E\u53D1\u4F5C\u4E1A\u5355",
  "mission.approve": "\u5BA1\u6279\u4F5C\u4E1A\u5355",
  "mission.execute": "\u6267\u884C\u4F5C\u4E1A\u5355\u5E76\u56DE\u6267",
  "analytics.read": "\u67E5\u770B\u591A\u7EF4\u7EDF\u8BA1",
  "briefing.read": "\u67E5\u770B\u519C\u6237\u7B80\u62A5",
  "billing.read": "\u67E5\u770B\u8BA1\u91CF\u4E0E\u8D26\u5355",
  "user.manage": "\u7BA1\u7406\u6210\u5458\u4E0E\u89D2\u8272",
  "audit.read": "\u67E5\u770B\u64CD\u4F5C\u5BA1\u8BA1"
};
var ROLES = {
  platform_admin: {
    name: "\u5E73\u53F0\u7BA1\u7406\u5458",
    scope: "platform",
    tenantType: "platform",
    desc: "\u5E73\u53F0\u8FD0\u8425\u65B9\uFF0C\u8DE8\u79DF\u6237\u7BA1\u7406\u5730\u5757\u3001\u8BBE\u5907\u3001\u8BA1\u8D39\u4E0E\u6210\u5458",
    permissions: Object.keys(PERMISSIONS)
  },
  farm_owner: {
    name: "\u519C\u573A\u4E3B / \u5408\u4F5C\u793E\u8D1F\u8D23\u4EBA",
    scope: "tenant",
    tenantType: "farm",
    desc: "\u67E5\u770B\u540D\u4E0B\u5730\u5757\u5168\u90E8\u6570\u636E\uFF0C\u6D3E\u53D1\u4F5C\u4E1A\u5355\uFF0C\u5BA1\u6279\u4E0E\u7ED3\u7B97",
    permissions: [
      "field.read",
      "field.write",
      "device.read",
      "device.register",
      "device.revoke",
      "mission.read",
      "mission.dispatch",
      "mission.approve",
      "analytics.read",
      "briefing.read",
      "billing.read",
      "user.manage"
    ]
  },
  operator: {
    name: "\u4F5C\u4E1A\u961F\u64CD\u4F5C\u5458\uFF08\u98DE\u624B\uFF09",
    scope: "assigned",
    tenantType: "team",
    desc: "\u53EA\u63A5\u6536\u6D3E\u7ED9\u81EA\u5DF1\u7684\u4F5C\u4E1A\u5355\uFF0C\u5728\u7530\u95F4\u6267\u884C\u5E76\u56DE\u4F20\u70B9\u4F4D\u4E0E\u7ED3\u679C",
    permissions: [
      "field.read",
      "device.read",
      "mission.read",
      "mission.execute"
    ]
  },
  agronomist: {
    name: "\u690D\u4FDD\u6280\u672F\u5458 / \u519C\u6237",
    scope: "own",
    tenantType: "farm",
    desc: "\u53EA\u67E5\u770B\u81EA\u5DF1\u5730\u5757\u7684\u75C5\u5BB3\u7ED3\u8BBA\u4E0E\u4ECA\u65E5\u884C\u52A8\u6E05\u5355",
    permissions: [
      "field.read",
      "analytics.read",
      "briefing.read",
      "mission.read"
    ]
  },
  regulator: {
    name: "\u653F\u5E9C\u76D1\u7BA1\u5458",
    scope: "platform",
    tenantType: "gov",
    desc: "\u8DE8\u4E3B\u4F53\u53EA\u8BFB\u6C47\u603B\uFF0C\u7528\u4E8E\u76D1\u7BA1\u6838\u9A8C\u4E0E\u8865\u8D34\u7EDF\u8BA1",
    permissions: [
      "field.read",
      "device.read",
      "mission.read",
      "analytics.read",
      "billing.read",
      "audit.read"
    ]
  }
};
var DEMO_IDENTITY = {
  userId: "u-demo-admin",
  name: "\u6F14\u793A\u8D26\u53F7",
  role: "platform_admin",
  tenantId: "t-demo",
  tenantName: "\u7A57\u4E91\u667A\u7B56\u5E73\u53F0\u8FD0\u8425\u65B9",
  tenantType: "platform",
  scope: "platform"
};
function listRoles() {
  return Object.entries(ROLES).map(([key, r]) => ({
    key,
    name: r.name,
    scope: r.scope,
    desc: r.desc,
    tenantType: r.tenantType,
    permissions: r.permissions
  }));
}
__name(listRoles, "listRoles");
function can(role, permission) {
  const r = ROLES[role];
  if (!r) return false;
  return r.permissions.includes(permission);
}
__name(can, "can");
function visibleFields(identity, fields) {
  if (!identity) return [];
  const scope = identity.scope || ROLES[identity.role]?.scope || "platform";
  switch (scope) {
    case "platform":
      return fields;
    case "tenant":
      return fields.filter((f) => f.tenantId === identity.tenantId);
    case "own":
      return fields.filter((f) => f.tenantId === identity.tenantId && (!identity.fieldIds || !identity.fieldIds.length || identity.fieldIds.includes(f.id)));
    case "assigned":
      return fields.filter((f) => f.tenantId === identity.tenantId);
    default:
      return [];
  }
}
__name(visibleFields, "visibleFields");
function validateAssignment(actorRole, targetRole) {
  if (!ROLES[targetRole]) return { ok: false, reason: "\u672A\u77E5\u89D2\u8272" };
  if (!can(actorRole, "user.manage")) return { ok: false, reason: "\u65E0\u6210\u5458\u7BA1\u7406\u6743\u9650" };
  if (actorRole === "farm_owner" && targetRole === "platform_admin") {
    return { ok: false, reason: "\u519C\u573A\u4E3B\u4E0D\u80FD\u6388\u4E88\u5E73\u53F0\u7BA1\u7406\u5458\u89D2\u8272" };
  }
  return { ok: true };
}
__name(validateAssignment, "validateAssignment");
var PLATFORM_SERVICES = [
  {
    key: "multi-tenant",
    name: "\u591A\u79DF\u6237\u4E0E\u6743\u9650",
    claim: "\u4E94\u7C7B\u4E3B\u4F53\u3001\u4E94\u79CD\u89D2\u8272\u3001\u53EF\u89C1\u8303\u56F4\u7531\u5E73\u53F0\u7EDF\u4E00\u88C1\u51B3",
    proof: "\u89D2\u8272\u6743\u9650\u77E9\u9635 + \u5730\u5757\u53EF\u89C1\u6027\u8FC7\u6EE4\uFF0C\u524D\u540E\u7AEF\u540C\u4E00\u5957 shared/ \u5224\u5B9A"
  },
  {
    key: "field-registry",
    name: "\u5730\u5757\u4E0E\u4F5C\u4E1A\u5355\u5143",
    claim: "\u4EFB\u610F\u519C\u573A\u53EF\u6CE8\u518C\u5730\u5757\u3001\u5212\u7F51\u683C\u3001\u6309\u5206\u533A\u7EC4\u7EC7\u4F5C\u4E1A",
    proof: "\u7EDF\u4E00\u6570\u636E\u5951\u7EA6 + \u5206\u533A\u7BA1\u7406 + \u9776\u5411\u7F51\u683C\u9009\u53D6"
  },
  {
    key: "device-access",
    name: "\u8BBE\u5907\u63A5\u5165\u4E0E\u9274\u6743",
    claim: "\u7B2C\u4E09\u65B9\u8BBE\u5907\u51ED\u5BC6\u94A5\u63A5\u5165\uFF0C\u4E91\u7AEF\u53EF\u540A\u9500\u3001\u53EF\u5BA1\u8BA1",
    proof: "\u8BBE\u5907\u6CE8\u518C\u6D41\u7A0B + API Key \u7B7E\u53D1\u4E0E\u6821\u9A8C + \u9065\u6D4B\u9274\u6743"
  },
  {
    key: "metering",
    name: "\u8BA1\u91CF\u4E0E\u7ED3\u7B97",
    claim: "\u6309\u4EA9 / \u6309\u67B6\u6B21 / \u6309\u8BC6\u522B\u6B21\u6570\u8BA1\u91CF\uFF0C\u8D26\u5355\u53EF\u5BFC\u51FA",
    proof: "\u7528\u91CF\u8BB0\u5F55\u4E0E\u8BA1\u4EF7\u89C4\u5219\uFF08shared/metering.js\uFF09"
  },
  {
    key: "open-api",
    name: "\u5F00\u653E\u63A5\u53E3",
    claim: "REST + WebSocket \u53CC\u5411\uFF0C\u8BBE\u5907\u5F00\u53D1\u8005\u53EF\u81EA\u52A9\u63A5\u5165",
    proof: "\u63A5\u53E3\u6E05\u5355 + \u9065\u6D4B\u5E27\u5951\u7EA6 + \u6307\u4EE4\u4E0B\u53D1\u56DE\u6267"
  }
];

// shared/deviceaccess.js
init_schema();
var ACCESS_STATES = {
  pending: "\u5F85\u5BA1\u6838",
  active: "\u5DF2\u6FC0\u6D3B",
  suspended: "\u5DF2\u505C\u7528",
  revoked: "\u5DF2\u540A\u9500"
};
var HEARTBEAT_TIMEOUT_MS = 15e3;
function issueApiKey(deviceId, salt) {
  const s = salt || randomSalt();
  return { apiKey: `sk_${deviceId}_${s}`, salt: s };
}
__name(issueApiKey, "issueApiKey");
function verifyApiKey(deviceId, apiKey, salt) {
  if (!deviceId || !apiKey || !salt) return false;
  return apiKey === `sk_${deviceId}_${salt}`;
}
__name(verifyApiKey, "verifyApiKey");
function randomSalt() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
__name(randomSalt, "randomSalt");
function registerDevice(req, existing = null) {
  const { deviceId, name, kind, tenantId } = req || {};
  if (!deviceId) return { ok: false, reason: "\u7F3A\u5C11 deviceId" };
  if (!name) return { ok: false, reason: "\u7F3A\u5C11\u8BBE\u5907\u540D\u79F0" };
  if (!["uav", "robot"].includes(kind)) return { ok: false, reason: "\u8BBE\u5907\u7C7B\u578B\u5FC5\u987B\u4E3A uav \u6216 robot" };
  if (!tenantId) return { ok: false, reason: "\u7F3A\u5C11\u6240\u5C5E\u79DF\u6237" };
  if (existing) return { ok: false, reason: `\u8BBE\u5907 ${deviceId} \u5DF2\u6CE8\u518C` };
  const { apiKey, salt } = issueApiKey(deviceId);
  return {
    ok: true,
    device: {
      deviceId,
      name,
      kind,
      model: req.model || "",
      tenantId,
      ownerUserId: req.ownerUserId || null,
      accessState: ACCESS_STATES.active,
      registeredAt: Date.now(),
      lastSeen: Date.now(),
      online: false
    },
    apiKey,
    salt
  };
}
__name(registerDevice, "registerDevice");
function applyHeartbeat(device, ts = Date.now()) {
  if (!device) return { online: false, offline: false };
  const wasOnline = device.online;
  device.lastSeen = ts;
  device.online = true;
  return { online: true, offline: wasOnline === false };
}
__name(applyHeartbeat, "applyHeartbeat");
var COMMAND_STATES = {
  issued: "\u5DF2\u4E0B\u53D1",
  acked: "\u8BBE\u5907\u5DF2\u63A5\u6536",
  running: "\u6267\u884C\u4E2D",
  done: "\u5DF2\u5B8C\u6210",
  failed: "\u6267\u884C\u5931\u8D25",
  timeout: "\u56DE\u6267\u8D85\u65F6"
};
function issueCommand({ deviceId, type, payload = {}, missionId = null }) {
  if (!deviceId) return { ok: false, reason: "\u7F3A\u5C11 deviceId" };
  if (!type) return { ok: false, reason: "\u7F3A\u5C11\u6307\u4EE4\u7C7B\u578B" };
  return {
    ok: true,
    command: {
      commandId: `C-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
      deviceId,
      type,
      payload,
      missionId,
      state: COMMAND_STATES.issued,
      issuedAt: Date.now(),
      ackedAt: null,
      doneAt: null
    }
  };
}
__name(issueCommand, "issueCommand");
function applyCommandAck(cmd, state, ts = Date.now()) {
  if (!cmd) return null;
  const prev = cmd.state;
  cmd.state = state;
  if (state === COMMAND_STATES.acked && !cmd.ackedAt) cmd.ackedAt = ts;
  if (state === COMMAND_STATES.done || state === COMMAND_STATES.failed) cmd.doneAt = ts;
  cmd.latency = {
    dispatchMs: cmd.ackedAt ? cmd.ackedAt - cmd.issuedAt : null,
    totalMs: cmd.doneAt ? cmd.doneAt - cmd.issuedAt : null
  };
  cmd.prevState = prev;
  return cmd;
}
__name(applyCommandAck, "applyCommandAck");
function accessHealth(device, metrics, commands = []) {
  const now = Date.now();
  const online = !!device?.online && now - (device?.lastSeen || 0) <= HEARTBEAT_TIMEOUT_MS;
  const lossRate = metrics?.lossRate ?? 0;
  const p95 = metrics?.p95LatencyMs ?? null;
  const done = commands.filter((c) => c.state === COMMAND_STATES.done).length;
  const failed = commands.filter((c) => c.state === COMMAND_STATES.failed || c.state === COMMAND_STATES.timeout).length;
  let score = 100;
  if (!online) score -= 30;
  score -= Math.min(25, lossRate * 100 * 2.5);
  if (p95 != null) score -= Math.min(20, Math.max(0, (p95 - 1e3) / 100));
  if (failed > 0) score -= Math.min(20, failed * 5);
  let level = "excellent";
  if (score < 60) level = "poor";
  else if (score < 80) level = "fair";
  else if (score < 92) level = "good";
  return {
    deviceId: device?.deviceId,
    online,
    accessState: device?.accessState || ACCESS_STATES.active,
    lossRate,
    p95LatencyMs: p95,
    commandsTotal: commands.length,
    commandsDone: done,
    commandsFailed: failed,
    score: Math.max(0, Math.round(score)),
    level,
    lastSeen: device?.lastSeen || null
  };
}
__name(accessHealth, "accessHealth");
var ACCESS_LEVELS = {
  excellent: { name: "\u4F18\u79C0", desc: "\u5728\u7EBF\u7A33\u5B9A\u3001\u65F6\u5EF6\u8FBE\u6807\u3001\u6307\u4EE4\u5168\u90E8\u95ED\u73AF" },
  good: { name: "\u826F\u597D", desc: "\u6574\u4F53\u53EF\u7528\uFF0C\u5B58\u5728\u8F7B\u5FAE\u65F6\u5EF6\u6CE2\u52A8" },
  fair: { name: "\u4E00\u822C", desc: "\u5B58\u5728\u4E22\u5305\u6216\u6307\u4EE4\u5931\u8D25\uFF0C\u9700\u6392\u67E5\u94FE\u8DEF" },
  poor: { name: "\u8F83\u5DEE", desc: "\u79BB\u7EBF\u6216\u63A5\u5165\u5DF2\u540A\u9500" }
};

// shared/metering.js
init_schema();
var METER_UNITS = {
  mu: { name: "\u4EA9", desc: "\u6309\u4F5C\u4E1A\u8986\u76D6\u9762\u79EF\u8BA1\u91CF", decimals: 2 },
  muSpray: { name: "\u4EA9\uFF08\u65BD\u836F\uFF09", desc: "\u5B9E\u9645\u65BD\u836F\u8986\u76D6\u9762\u79EF\uFF0C\u4E0E\u5DE1\u67E5\u9762\u79EF\u5206\u5F00\u8BA1", decimals: 2 },
  muSurvey: { name: "\u4EA9\uFF08\u5DE1\u67E5\uFF09", desc: "\u5DE1\u7530\u4F5C\u4E1A\u9762\u79EF\uFF0C\u4E0E\u65BD\u836F\u9762\u79EF\u5206\u5F00\u8BA1", decimals: 2 },
  sortie: { name: "\u67B6\u6B21", desc: "\u6309\u4E00\u6B21\u8D77\u964D\u5B8C\u6210\u7684\u4F5C\u4E1A\u8BA1\u91CF", decimals: 0 },
  detection: { name: "\u6B21", desc: "\u6309\u75C5\u5BB3\u8BC6\u522B/\u8BCA\u65AD\u6B21\u6570\u8BA1\u91CF", decimals: 0 },
  minute: { name: "\u5206\u949F", desc: "\u6309\u4F5C\u4E1A\u65F6\u957F\u8BA1\u91CF", decimals: 1 }
};
var PRICE_TABLE = {
  spray: {
    key: "spray",
    name: "\u9776\u5411\u65BD\u836F\u4F5C\u4E1A\u670D\u52A1",
    unit: "muSpray",
    price: 12,
    // 元/亩
    desc: "\u6309\u5B9E\u9645\u65BD\u836F\u8986\u76D6\u9762\u79EF\u8BA1\u8D39\uFF0C\u542B\u8DEF\u5F84\u89C4\u5212\u3001\u8282\u836F\u6838\u7B97\u4E0E\u4F5C\u4E1A\u5355\u4E0B\u53D1",
    optional: false
  },
  survey: {
    key: "survey",
    name: "\u7A7A\u4E2D\u5DE1\u67E5\u670D\u52A1",
    unit: "muSurvey",
    price: 3,
    // 元/亩
    desc: "\u6309\u5DE1\u7530\u9762\u79EF\u8BA1\u8D39\uFF0C\u542B\u5F71\u50CF\u91C7\u96C6\u4E0E\u75C5\u5BB3\u521D\u7B5B",
    optional: false
  },
  diagnose: {
    key: "diagnose",
    name: "\u75C5\u5BB3\u8BCA\u65AD\u4E0E\u5904\u65B9",
    unit: "detection",
    price: 0.8,
    // 元/次
    desc: "\u6309\u6709\u6548\u8BC6\u522B\u6B21\u6570\u8BA1\u8D39\uFF0C\u542B\u7528\u836F\u5EFA\u8BAE\u4E0E\u5B89\u5168\u95F4\u9694\u671F",
    optional: true
  },
  plan: {
    key: "plan",
    name: "\u8DEF\u5F84\u89C4\u5212\uFF08\u6309\u9700\u8C03\u7528\uFF09",
    unit: "sortie",
    price: 20,
    // 元/架次
    desc: "\u6309\u89C4\u5212\u67B6\u6B21\u8BA1\u8D39\uFF0C\u542B\u7ECF\u6D4E/\u5FEB\u901F/\u73AF\u4FDD\u4E09\u76EE\u6807\u6C42\u89E3",
    optional: true
  }
};
function measureMission(mission) {
  const plan = mission?.plan || {};
  const type = mission?.type || "spray";
  const areaHa = plan.targetAreaHa ?? plan.zoneAreaHa ?? null;
  const areaMu = areaHa != null ? +(areaHa * 15).toFixed(2) : null;
  const volumeL = plan.estVolumeL ?? null;
  const minutes = plan.estMinutes ?? null;
  const sorties = plan.length != null ? 1 : 0;
  return {
    missionId: mission?.missionId,
    type,
    areaHa,
    areaMu,
    volumeL: volumeL != null ? +Number(volumeL).toFixed(2) : null,
    minutes: minutes != null ? +Number(minutes).toFixed(1) : null,
    sorties,
    // 识别次数：一次作业单对应的复核点位数
    detections: Array.isArray(mission?.cells) ? mission.cells.length : 0,
    savedL: plan.savedVsZoneL ?? plan.savedVsUniformL ?? null,
    savedRatio: plan.savedRatioVsZone ?? null
  };
}
__name(measureMission, "measureMission");
function priceUsage(usage, opts = {}) {
  const items = opts.items && opts.items.length ? opts.items : Object.keys(PRICE_TABLE).filter((k) => !PRICE_TABLE[k].optional);
  const lines = [];
  for (const key of items) {
    const rule = PRICE_TABLE[key];
    if (!rule) continue;
    let qty = 0;
    switch (rule.unit) {
      // 施药与巡查按各自的面积计费，互不占用
      case "muSpray":
        qty = usage.sprayMu || 0;
        break;
      case "muSurvey":
        qty = usage.surveyMu || 0;
        break;
      case "sortie":
        qty = usage.sorties || 0;
        break;
      case "detection":
        qty = usage.detections || 0;
        break;
      case "minute":
        qty = usage.minutes || 0;
        break;
      default:
        qty = 0;
    }
    const amount = +(qty * rule.price).toFixed(2);
    lines.push({
      key,
      name: rule.name,
      unit: rule.unit,
      unitName: METER_UNITS[rule.unit]?.name || rule.unit,
      price: rule.price,
      qty: +qty.toFixed(METER_UNITS[rule.unit]?.decimals ?? 2),
      amount,
      optional: !!rule.optional
    });
  }
  const total = +lines.reduce((a, l) => a + l.amount, 0).toFixed(2);
  return { lines, total, currency: "CNY" };
}
__name(priceUsage, "priceUsage");
function buildInvoice({ tenantId, tenantName, period, missions = [], items = null }) {
  const seen = /* @__PURE__ */ new Set();
  const unique = missions.filter((m) => {
    const key = m?.missionId;
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const byPeriod = /* @__PURE__ */ new Map();
  for (const m of unique) {
    const ts = m?.createdAt || m?.ts || Date.now();
    const p = period || monthKey(ts);
    if (!byPeriod.has(p)) byPeriod.set(p, []);
    byPeriod.get(p).push(m);
  }
  const periods = byPeriod.size ? [...byPeriod.keys()].sort() : [period || monthKey(Date.now())];
  const target = periods.includes(period) ? period : periods[periods.length - 1];
  const scoped = byPeriod.get(target) || [];
  const usage = scoped.reduce((acc, m) => {
    const u = measureMission(m);
    if (u.type === "survey") {
      acc.surveyMu = +((acc.surveyMu || 0) + (u.areaMu || 0)).toFixed(2);
      acc.surveyHa = +((acc.surveyHa || 0) + (u.areaHa || 0)).toFixed(3);
    } else {
      acc.sprayMu = +((acc.sprayMu || 0) + (u.areaMu || 0)).toFixed(2);
      acc.sprayHa = +((acc.sprayHa || 0) + (u.areaHa || 0)).toFixed(3);
    }
    acc.areaMu = +((acc.areaMu || 0) + (u.areaMu || 0)).toFixed(2);
    acc.areaHa = +((acc.areaHa || 0) + (u.areaHa || 0)).toFixed(3);
    acc.sorties += u.sorties;
    acc.detections += u.detections;
    acc.minutes = +((acc.minutes || 0) + (u.minutes || 0)).toFixed(1);
    acc.volumeL = +((acc.volumeL || 0) + (u.volumeL || 0)).toFixed(2);
    acc.savedL = +((acc.savedL || 0) + (u.savedL || 0)).toFixed(2);
    return acc;
  }, {
    areaMu: 0,
    areaHa: 0,
    sprayMu: 0,
    sprayHa: 0,
    surveyMu: 0,
    surveyHa: 0,
    sorties: 0,
    detections: 0,
    minutes: 0,
    volumeL: 0,
    savedL: 0
  });
  const priced = priceUsage(usage, { items });
  return {
    invoiceId: `INV-${tenantId}-${target}`,
    tenantId,
    tenantName,
    period: target,
    issuedAt: Date.now(),
    missionCount: scoped.length,
    availablePeriods: periods,
    usage,
    ...priced
  };
}
__name(buildInvoice, "buildInvoice");
function buildInvoices({ tenantId, tenantName, missions = [], items = null }) {
  const seen = /* @__PURE__ */ new Set();
  const unique = missions.filter((m) => {
    const key = m?.missionId;
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const byPeriod = /* @__PURE__ */ new Map();
  for (const m of unique) {
    const p = monthKey(m?.createdAt || m?.ts || Date.now());
    if (!byPeriod.has(p)) byPeriod.set(p, []);
    byPeriod.get(p).push(m);
  }
  return [...byPeriod.keys()].sort().map((p) => buildInvoice({
    tenantId,
    tenantName,
    period: p,
    missions: byPeriod.get(p),
    items
  }));
}
__name(buildInvoices, "buildInvoices");
function monthKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
__name(monthKey, "monthKey");
function platformMetrics(invoices = [], extra = {}) {
  const revenue = invoices.reduce((a, i) => a + (i.total || 0), 0);
  const sprayMu = invoices.reduce((a, i) => a + (i.usage?.sprayMu || 0), 0);
  const surveyMu = invoices.reduce((a, i) => a + (i.usage?.surveyMu || 0), 0);
  const areaMu = sprayMu + surveyMu;
  const savedL = invoices.reduce((a, i) => a + (i.usage?.savedL || 0), 0);
  const volumeL = invoices.reduce((a, i) => a + (i.usage?.volumeL || 0), 0);
  const sorties = invoices.reduce((a, i) => a + (i.usage?.sorties || 0), 0);
  const detections = invoices.reduce((a, i) => a + (i.usage?.detections || 0), 0);
  const drugSavedValue = +(savedL * 60).toFixed(2);
  const byPeriod = /* @__PURE__ */ new Map();
  for (const i of invoices) {
    const p = i.period || monthKey(Date.now());
    if (!byPeriod.has(p)) byPeriod.set(p, { period: p, revenue: 0, areaMu: 0, savedL: 0, missions: 0 });
    const b = byPeriod.get(p);
    b.revenue = +(b.revenue + (i.total || 0)).toFixed(2);
    b.areaMu = +(b.areaMu + (i.usage?.areaMu || 0)).toFixed(2);
    b.savedL = +(b.savedL + (i.usage?.savedL || 0)).toFixed(2);
    b.missions += i.missionCount || 0;
  }
  const monthly = [...byPeriod.values()].sort((a, b) => a.period.localeCompare(b.period));
  return {
    revenue: +revenue.toFixed(2),
    currency: "CNY",
    areaMu: +areaMu.toFixed(2),
    sprayMu: +sprayMu.toFixed(2),
    surveyMu: +surveyMu.toFixed(2),
    sorties,
    detections,
    volumeL: +volumeL.toFixed(2),
    savedL: +savedL.toFixed(2),
    drugSavedValue,
    tenants: extra.tenants ?? 0,
    fields: extra.fields ?? 0,
    devices: extra.devices ?? 0,
    subscribers: extra.subscribers ?? 0,
    arpu: invoices.length ? +(revenue / invoices.length).toFixed(2) : 0,
    // 单亩综合收益（平台收入 ÷ 服务亩数）
    revenuePerMu: areaMu > 0 ? +(revenue / areaMu).toFixed(2) : 0,
    // 按账期的经营趋势
    monthly,
    monthlyRevenue: monthly.map((m) => m.revenue),
    monthlyAreaMu: monthly.map((m) => m.areaMu)
  };
}
__name(platformMetrics, "platformMetrics");
var COMMERCIAL_MODEL = {
  tagline: "\u5E73\u53F0\u4E0D\u5356\u8BBE\u5907\uFF0C\u5E73\u53F0\u8C03\u5EA6\u4F4E\u7A7A\u4F5C\u4E1A\u80FD\u529B",
  lines: [
    {
      who: "\u519C\u6237 / \u5408\u4F5C\u793E",
      what: "\u6309\u4EA9\u8D2D\u4E70\u65BD\u836F\u670D\u52A1\uFF0C\u7CFB\u7EDF\u81EA\u52A8\u751F\u6210\u5904\u65B9\u4E0E\u4F5C\u4E1A\u5355",
      why: "\u770B\u5F97\u89C1\u7684\u8282\u836F\u8D26\u5355\uFF1A\u9776\u5411\u70B9\u55B7\u6BD4\u6574\u7530\u55B7\u6D12\u5C11\u7528 90%+ \u836F\u6DB2"
    },
    {
      who: "\u4F5C\u4E1A\u961F / \u98DE\u624B",
      what: "\u6309\u67B6\u6B21\u627F\u63A5\u4F5C\u4E1A\u5355\uFF0C\u5E73\u53F0\u6D3E\u5355\u3001\u56DE\u6267\u3001\u7ED3\u7B97\u4E00\u4F53\u5316",
      why: "\u4EFB\u52A1\u4E0D\u9760\u7535\u8BDD\u6D3E\uFF0C\u63A5\u5355\u5373\u53EF\u5F00\u5DE5\uFF0C\u7ED3\u7B97\u6709\u636E\u53EF\u67E5"
    },
    {
      who: "\u653F\u5E9C / \u5408\u4F5C\u793E\u8054\u793E",
      what: "\u8DE8\u4E3B\u4F53\u53EA\u8BFB\u76D1\u7BA1\u89C6\u56FE\uFF0C\u8865\u8D34\u6309\u5B9E\u9645\u4F5C\u4E1A\u9762\u79EF\u6838\u9A8C",
      why: "\u4F5C\u4E1A\u9762\u79EF\u4E0E\u8282\u836F\u91CF\u6765\u81EA\u540C\u4E00\u5957\u5E73\u53F0\u6570\u636E\uFF0C\u53EF\u5BA1\u8BA1"
    }
  ],
  objectiveNote: `\u89C4\u5212\u76EE\u6807\uFF1A${PLAN_OBJECTIVES.economy.name} / ${PLAN_OBJECTIVES.speed.name} / ${PLAN_OBJECTIVES.eco.name}`
};

// server/src/app.js
init_schema();

// shared/agronomy.js
var SPRAY_STRATEGIES = [
  {
    id: "ST-RUST",
    disease: "rust",
    diseaseName: "\u9508\u75C5",
    agent: "\u620A\u5511\u9187\xB7\u82EF\u919A\u7532\u73AF\u5511",
    agentClass: "\u4E09\u5511\u7C7B\u5185\u5438\u6027\u6740\u83CC\u5242",
    dosage: "15 mL/\u4EA9",
    doseLHa: 18,
    // 折算为 L/ha，便于与作业单药耗对齐
    intervalDays: 10,
    // 安全间隔期：施药后 10 天内不得再采收
    times: "\u95F4\u9694 10 \u5929\u9632\u6CBB 2 \u6B21",
    nozzle: "45\xB0 \u9525\u5F62\u55B7\u5934",
    sprayMode: "\u4F4E\u91CF\u7CBE\u51C6\u55B7\u6D12\uFF0C\u5C01\u9501\u75C5\u5BB3\u6269\u6563",
    window: "\u75C5\u53F6\u7387\u8FBE 10% \u4E14\u51FA\u73B0\u5B62\u5B50\u5806\u65F6\u7ACB\u5373\u65BD\u836F",
    caution: "\u5B55\u7A57\u671F\u81F3\u62BD\u7A57\u671F\u614E\u7528\uFF0C\u6CE8\u610F\u907F\u5F00\u9AD8\u6E29\u65F6\u6BB5"
  },
  {
    id: "ST-POWDERY",
    disease: "powdery",
    diseaseName: "\u767D\u7C89\u75C5",
    agent: "\u4E09\u5511\u916E\xB7\u620A\u5511\u9187",
    agentClass: "\u5185\u5438\u517C\u6CBB\u7597\u6740\u83CC\u5242",
    dosage: "20 mL/\u4EA9",
    doseLHa: 24,
    intervalDays: 10,
    times: "\u95F4\u9694 10 \u5929\u65BD\u836F 2\u20133 \u6B21",
    nozzle: "60\xB0 \u4E2D\u5708\u55B7\u5934",
    sprayMode: "\u4E09\u5C42\u5706\u73AF\u55B7\u6D12\uFF0C\u5168\u9762\u8986\u76D6\u75C5\u533A",
    window: "\u53F6\u7247\u6B63\u9762\u51FA\u73B0\u767D\u8272\u7C89\u5C42\u4E14\u6269\u5C55\u8FC5\u901F\u65F6\u65BD\u836F",
    caution: "\u53D1\u75C5\u540E\u671F\u53F6\u7247\u67AF\u9EC4\u65F6\u9632\u6548\u4E0B\u964D\uFF0C\u5E94\u5C3D\u65E9\u65BD\u836F"
  },
  {
    id: "ST-SMUT",
    disease: "loose_smut",
    diseaseName: "\u6563\u9ED1\u7A57\u75C5",
    agent: "\u4E95\u5188\u9709\u7D20\xB7\u8721\u82BD\u83CC",
    agentClass: "\u751F\u7269\u5236\u5242\uFF08\u6297\u6027\u4F4E\u3001\u6B8B\u7559\u4F4E\uFF09",
    dosage: "20 g/\u4EA9\uFF08\u53EF\u6E7F\u6027\u7C89\u5242\u5151\u6C34\uFF09",
    doseLHa: 30,
    intervalDays: 10,
    times: "\u64AD\u524D\u62CC\u79CD + \u62D4\u8282\u671F\u55B7\u65BD 1 \u6B21",
    nozzle: "60\xB0 \u4E2D\u5708\u55B7\u5934",
    sprayMode: "\u5168\u7530\u5747\u5300\u55B7\u96FE\uFF0C\u91CD\u70B9\u8986\u76D6\u7A57\u90E8",
    window: "\u62D4\u8282\u81F3\u5B55\u7A57\u671F\uFF0C\u75C5\u7A57\u62BD\u51FA\u524D\u5B8C\u6210\u9632\u6CBB",
    caution: "\u4EE5\u9884\u9632\u4E3A\u4E3B\uFF0C\u9519\u8FC7\u62BD\u7A57\u524D\u7A97\u53E3\u5219\u96BE\u4EE5\u8865\u6551"
  },
  {
    id: "ST-ROOTROT",
    disease: "root_rot",
    diseaseName: "\u6839\u8150\u75C5",
    agent: "\u6076\u9709\u7075\xB7\u7532\u57FA\u786B\u83CC\u7075",
    agentClass: "\u5185\u5438\u6027\u571F\u58E4\u5904\u7406\u5242",
    dosage: "20 g/\u4EA9",
    doseLHa: 30,
    intervalDays: 15,
    times: "\u95F4\u9694 15 \u5929\u8FDE\u7EED\u9632\u6CBB 2 \u6B21",
    nozzle: "45\xB0 \u9525\u5F62\u55B7\u5934",
    sprayMode: "\u5BF9\u51C6\u830E\u57FA\u90E8\u7CBE\u51C6\u55B7\u96FE\uFF0C\u51CF\u5C11\u4E0E\u53F6\u7247\u63A5\u89E6",
    window: "\u62D4\u8282\u671F\u830E\u57FA\u90E8\u51FA\u73B0\u8910\u8272\u75C5\u6591\u65F6\u5F00\u59CB\u704C\u6839\u5F0F\u55B7\u96FE",
    caution: "\u5730\u4E0B\u6C34\u4F4D\u9AD8\u7684\u5730\u5757\u987B\u5148\u6392\u6C34\uFF0C\u5426\u5219\u65BD\u836F\u6548\u679C\u53D7\u9650"
  },
  {
    id: "ST-FUSARIUM",
    disease: "fusarium",
    diseaseName: "\u8D64\u9709\u75C5",
    agent: "\u6C30\u70EF\u83CC\u916F\xB7\u54AA\u9C9C\u80FA\u590D\u914D",
    agentClass: "\u590D\u914D\u6740\u83CC\u5242\uFF08\u517C\u9632\u8D64\u9709\u75C5\u4E0E\u7A57\u8150\u75C5\uFF09",
    dosage: "30 mL/\u4EA9",
    doseLHa: 36,
    intervalDays: 5,
    times: "\u95F4\u9694 5 \u5929\u8FDE\u7EED\u9632\u6CBB 2 \u6B21",
    nozzle: "80\u201390\xB0 \u5927\u5708\u55B7\u5934",
    sprayMode: "\u626C\u82B1\u671F\u5FEB\u901F\u8986\u76D6\u75C5\u7A57",
    window: "\u626C\u82B1\u521D\u671F\u81F3\u76DB\u82B1\u672B\u671F\u4E3A\u5173\u952E\u9632\u6CBB\u7A97\u53E3\uFF0C\u52A1\u5FC5\u4E00\u55B7\u5230\u4F4D",
    caution: "\u5B89\u5168\u95F4\u9694\u671F\u6700\u77ED\uFF085 \u5929\uFF09\uFF0C\u987B\u4E25\u683C\u6267\u884C\u91C7\u6536\u524D\u505C\u836F\u89C4\u5B9A"
  },
  {
    id: "ST-BLIGHT",
    disease: "leaf_blight",
    diseaseName: "\u53F6\u67AF\u75C5",
    agent: "\u4EE3\u68EE\u9530\u950C\xB7\u591A\u83CC\u7075",
    agentClass: "\u4FDD\u62A4\u6027\u6740\u83CC\u5242 + \u5185\u5438\u5242\u590D\u914D",
    dosage: "20 g/\u4EA9",
    doseLHa: 30,
    intervalDays: 10,
    times: "\u95F4\u9694 10 \u5929\u9632\u6CBB 2 \u6B21",
    nozzle: "60\xB0 \u4E2D\u5708\u55B7\u5934",
    sprayMode: "\u5168\u7530\u5747\u5300\u55B7\u96FE\uFF0C\u8986\u76D6\u65D7\u53F6\u4E0E\u4E0B\u5C42\u53F6",
    window: "\u62BD\u7A57\u540E\u4E0B\u90E8\u53F6\u7247\u65E9\u8870\u6591\u8FDE\u7247\u65F6\u65BD\u836F",
    caution: "\u4E0E\u6740\u83CC\u5242\u8F6E\u6362\u4F7F\u7528\uFF0C\u5EF6\u7F13\u6297\u6027"
  },
  {
    id: "ST-MIXED",
    disease: "mixed",
    diseaseName: "\u6DF7\u5408\u578B\u75C5\u5BB3",
    agent: "\u5421\u5511\u919A\u83CC\u916F\xB7\u82EF\u919A\u7532\u73AF\u5511\u590D\u914D",
    agentClass: "\u5E7F\u8C31\u590D\u914D\u6740\u83CC\u5242",
    dosage: "30 mL + 15 g/\u4EA9",
    doseLHa: 45,
    intervalDays: 10,
    times: "\u95F4\u9694 10 \u5929\u65BD\u836F 1\u20132 \u6B21",
    nozzle: "\u4E09\u5C42\u5706\u73AF\u55B7\u5934",
    sprayMode: "\u53D8\u5242\u91CF\u55B7\u6D12\uFF1A\u8F7B\u5EA6\u75C5\u533A\u4F4E\u91CF\u9884\u9632\uFF0C\u91CD\u5EA6\u75C5\u533A\u8DB3\u91CF\u6CBB\u7597",
    window: "\u4E24\u79CD\u4EE5\u4E0A\u75C5\u79CD\u5E76\u53D1\u65F6\uFF0C\u6309\u6700\u91CD\u75C5\u79CD\u7684\u6709\u6548\u5242\u91CF\u6267\u884C",
    caution: "\u6CE8\u610F\u4E0E\u5176\u5B83\u6740\u83CC\u5242\u8F6E\u6362\uFF0C\u5EF6\u7F13\u6297\u6027"
  }
];
function strategyFor(diseaseCode) {
  return SPRAY_STRATEGIES.find((s) => s.disease === diseaseCode) || null;
}
__name(strategyFor, "strategyFor");
var SPRAY_WINDOW_RULES = {
  wind: { min: 2, max: 5, unit: "m/s", label: "\u98CE\u901F" },
  temp: { min: 15, max: 28, unit: "\u2103", label: "\u6E29\u5EA6" },
  humidity: { min: 40, max: 85, unit: "%", label: "\u6E7F\u5EA6" }
};
function judgeSprayWindow(w) {
  const reasons = [];
  const blocking = [];
  const windOk = w.wind >= SPRAY_WINDOW_RULES.wind.min && w.wind <= SPRAY_WINDOW_RULES.wind.max;
  if (windOk) reasons.push(`\u98CE\u901F ${w.wind} m/s\uFF0C\u98D8\u79FB\u53EF\u63A7`);
  else if (w.wind < SPRAY_WINDOW_RULES.wind.min) blocking.push(`\u98CE\u901F ${w.wind} m/s \u4F4E\u4E8E 2 m/s\uFF0C\u836F\u6DB2\u6613\u98D8\u79FB\u8D85\u6807`);
  else blocking.push(`\u98CE\u901F ${w.wind} m/s \u9AD8\u4E8E 5 m/s\uFF0C\u98D8\u79FB\u4E25\u91CD\u4E14\u6613\u5931\u65BD`);
  const tempOk = w.temperature >= SPRAY_WINDOW_RULES.temp.min && w.temperature <= SPRAY_WINDOW_RULES.temp.max;
  if (tempOk) reasons.push(`\u6C14\u6E29 ${w.temperature} \u2103\uFF0C\u836F\u5242\u4EE3\u8C22\u6B63\u5E38`);
  else if (w.temperature < SPRAY_WINDOW_RULES.temp.min) blocking.push(`\u6C14\u6E29 ${w.temperature} \u2103 \u8FC7\u4F4E\uFF0C\u5438\u6536\u4E0E\u4EE3\u8C22\u7F13\u6162`);
  else blocking.push(`\u6C14\u6E29 ${w.temperature} \u2103 \u504F\u9AD8\uFF0C\u84B8\u53D1\u8FC7\u5FEB\u4E14\u6709\u836F\u5BB3\u98CE\u9669`);
  const humOk = w.humidity >= SPRAY_WINDOW_RULES.humidity.min && w.humidity <= SPRAY_WINDOW_RULES.humidity.max;
  if (humOk) reasons.push(`\u76F8\u5BF9\u6E7F\u5EA6 ${w.humidity}%\uFF0C\u836F\u6DB2\u9644\u7740\u826F\u597D`);
  else if (w.humidity < SPRAY_WINDOW_RULES.humidity.min) blocking.push(`\u6E7F\u5EA6 ${w.humidity}% \u8FC7\u4F4E\uFF0C\u836F\u6DB2\u9644\u7740\u5DEE`);
  else blocking.push(`\u6E7F\u5EA6 ${w.humidity}% \u8FC7\u9AD8\uFF0C\u836F\u6DB2\u6613\u6D41\u6DCC\u51B2\u5237`);
  if (w.isRainy) blocking.push("\u5F53\u524D\u6709\u964D\u96E8\uFF0C\u7981\u6B62\u55B7\u836F");
  else reasons.push("\u5F53\u524D\u65E0\u964D\u96E8\uFF0C\u7B26\u5408\u55B7\u540E 6 h \u65E0\u96E8\u8981\u6C42");
  const total = 4;
  const passed = reasons.length;
  const score = Math.round(passed / total * 100);
  return { suitable: blocking.length === 0, score, reasons, blocking };
}
__name(judgeSprayWindow, "judgeSprayWindow");
var FIELD_LOCATION = "\u6CB3\u5317\u5510\u5C71 \xB7 30 \u4EA9\u793A\u8303\u7530 \xB7 \u7A57\u4E91\u667A\u7B56";
var AGRO_CALENDAR = [
  { stage: "\u8FD4\u9752\u671F", window: "2 \u6708\u4E0B\u65EC \u2013 3 \u6708\u4E2D\u65EC", focus: "\u9547\u538B\u4FDD\u5892\u3001\u6E05\u6C9F\u6392\u6E0D\uFF0C\u9632\u6CBB\u6761\u9508\u75C5\u65E9\u671F\u75C5\u53F6" },
  { stage: "\u62D4\u8282\u671F", window: "3 \u6708\u4E2D\u65EC \u2013 4 \u6708\u4E0A\u65EC", focus: "\u6839\u8150\u75C5\u830E\u57FA\u90E8\u67E5\u6CBB\uFF0C\u517C\u9632\u767D\u7C89\u75C5\u53F6\u5C42" },
  { stage: "\u5B55\u7A57\u671F", window: "4 \u6708\u4E0A\u65EC \u2013 4 \u6708\u4E0B\u65EC", focus: "\u7EB9\u67AF\u75C5\u91CD\u70B9\u9632\u6CBB\u671F\uFF0C\u6CE8\u610F\u4F4E\u6D3C\u5730\u5757" },
  { stage: "\u62BD\u7A57\u626C\u82B1\u671F", window: "4 \u6708\u4E0B\u65EC \u2013 5 \u6708\u4E2D\u65EC", focus: "\u8D64\u9709\u75C5\u5173\u952E\u9632\u6CBB\u7A97\u53E3\uFF0C\u4E00\u55B7\u5230\u4F4D\u4E0D\u91CD\u55B7" },
  { stage: "\u704C\u6D46\u671F", window: "5 \u6708\u4E2D\u65EC \u2013 6 \u6708\u4E0A\u65EC", focus: "\u53F6\u67AF\u75C5\u4E0E\u767D\u7C89\u75C5\u540E\u671F\u9632\u6CBB\uFF0C\u517C\u987E\u5E72\u70ED\u98CE" },
  { stage: "\u6210\u719F\u6536\u83B7\u671F", window: "6 \u6708\u4E0A\u65EC \u2013 6 \u6708\u4E0B\u65EC", focus: "\u505C\u836F\u89C2\u5BDF\u671F\uFF0C\u6309\u5B89\u5168\u95F4\u9694\u671F\u6267\u884C\u91C7\u6536" }
];
function currentWeather(now = Date.now()) {
  const d = new Date(now);
  const dayIndex = Math.floor(now / 864e5);
  const hour = d.getHours() + d.getMinutes() / 60;
  const diurnal = Math.sin((hour - 6) / 24 * Math.PI * 2);
  const daily = Math.sin(dayIndex % 9 / 9 * Math.PI * 2);
  const temperature = +(25.6 + diurnal * 5.4 + daily * 1.8).toFixed(1);
  const humidity = +(60 - diurnal * 13 + daily * 5).toFixed(0);
  const wind = +(2.1 + Math.abs(daily) * 1.6 + Math.abs(diurnal) * 0.7).toFixed(1);
  const cloud = Math.round(30 + daily * 35);
  const weatherText = wmoFrom(cloud, humidity);
  const isRainy = cloud > 88 && humidity > 82;
  const w = {
    location: FIELD_LOCATION,
    updatedAt: now,
    simulated: true,
    temperature,
    humidity,
    wind,
    cloudCover: cloud,
    weather: weatherText,
    isRainy,
    rainfall: isRainy ? +(humidity * 0.06).toFixed(1) : 0,
    light: lightFrom(hour, cloud)
  };
  w.spray = judgeSprayWindow(w);
  w.spray.suitable = w.spray.suitable && !isRainy;
  return w;
}
__name(currentWeather, "currentWeather");
function weatherForecast(now = Date.now()) {
  const out = [];
  const names = ["\u5468\u65E5", "\u5468\u4E00", "\u5468\u4E8C", "\u5468\u4E09", "\u5468\u56DB", "\u5468\u4E94", "\u5468\u516D"];
  for (let i = 0; i < 3; i++) {
    const t = now + i * 864e5;
    const d = new Date(t);
    const dayIndex = Math.floor(t / 864e5);
    const daily = Math.sin(dayIndex % 9 / 9 * Math.PI * 2);
    const cloud = Math.round(34 + daily * 38);
    const humid = Math.round(58 + daily * 8);
    const tempHigh = +(27.4 + daily * 2.4).toFixed(1);
    const tempLow = +(16.4 - daily * 1.4).toFixed(1);
    const wind = +(1.9 + Math.abs(daily) * 1.4).toFixed(1);
    const rainy = cloud > 88 && humid > 82;
    const item = {
      date: `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      weekday: i === 0 ? "\u4ECA\u5929" : names[d.getDay()],
      simulated: true,
      tempHigh,
      tempLow,
      humidity: humid,
      wind,
      weather: rainy ? "\u5C0F\u96E8" : wmoFrom(cloud, humid),
      isRainy: rainy
    };
    item.spray = judgeSprayWindow({
      temperature: (tempHigh + tempLow) / 2,
      humidity: humid,
      wind,
      isRainy: rainy
    });
    item.spray.suitable = item.spray.suitable && !rainy;
    out.push(item);
  }
  return out;
}
__name(weatherForecast, "weatherForecast");
function windScale(windMs) {
  const table = [
    [0.3, 0, "\u65E0\u98CE"],
    [1.6, 1, "\u8F6F\u98CE"],
    [3.4, 2, "\u8F7B\u98CE"],
    [5.5, 3, "\u5FAE\u98CE"],
    [8, 4, "\u548C\u98CE"],
    [10.8, 5, "\u6E05\u98CE"],
    [13.9, 6, "\u5F3A\u98CE"],
    [17.2, 7, "\u75BE\u98CE"],
    [20.8, 8, "\u5927\u98CE"],
    [24.5, 9, "\u70C8\u98CE"],
    [28.5, 10, "\u72C2\u98CE"]
  ];
  for (const [lim, lv, name] of table) if (windMs < lim) return { level: lv, name };
  return { level: 11, name: "\u66B4\u98CE" };
}
__name(windScale, "windScale");
function wmoFrom(cloud, humidity) {
  if (cloud > 85 && humidity > 80) return "\u9634\u8F6C\u5C0F\u96E8";
  if (cloud > 70) return "\u9634";
  if (cloud > 45) return "\u591A\u4E91";
  if (humidity > 75) return "\u6674\u95F4\u591A\u4E91";
  return "\u6674";
}
__name(wmoFrom, "wmoFrom");
function lightFrom(hour, cloud) {
  const alt = Math.max(0, Math.sin((hour - 6) / 12 * Math.PI));
  const k = alt * (1 - cloud / 140);
  if (k > 0.62) return "\u5F3A\u5149";
  if (k > 0.3) return "\u9002\u5B9C";
  if (k > 0.08) return "\u5F31\u5149";
  return "\u591C\u95F4";
}
__name(lightFrom, "lightFrom");

// server/src/app.js
init_planner();

// shared/openplatform.js
var ONBOARDING_STEPS = [
  {
    key: "register",
    title: "\u6CE8\u518C\u8BBE\u5907",
    desc: "\u7B2C\u4E09\u65B9\u8BBE\u5907\u63D0\u4EA4\u8EAB\u4EFD\u4FE1\u606F\uFF0C\u5E73\u53F0\u7B7E\u53D1\u957F\u671F API Key",
    detail: "API Key \u4EC5\u5728\u6CE8\u518C\u65F6\u8FD4\u56DE\u4E00\u6B21\uFF0C\u670D\u52A1\u7AEF\u53EA\u4FDD\u5B58\u76D0\u503C\u3002\u8BBE\u5907\u987B\u59A5\u5584\u4FDD\u5B58\uFF0C\u9057\u5931\u9700\u540A\u9500\u91CD\u53D1\u3002",
    endpoint: "POST /api/access/devices/register",
    request: {
      deviceId: "UAV-YOUR-001",
      name: "\u8D35\u53F8\u690D\u4FDD\u65E0\u4EBA\u673A",
      kind: "uav",
      model: "\u578B\u53F7",
      tenantId: "t-coop"
    },
    response: { ok: true, apiKey: "sk_UAV-YOUR-001_xxxxxxxx", notice: "API Key \u4EC5\u663E\u793A\u4E00\u6B21" }
  },
  {
    key: "heartbeat",
    title: "\u7EF4\u6301\u5FC3\u8DF3",
    desc: "\u8BBE\u5907\u6BCF 15 \u79D2\u4E0A\u62A5\u4E00\u6B21\u5FC3\u8DF3\uFF0C\u4E91\u7AEF\u636E\u6B64\u5224\u5B9A\u5728\u7EBF\u4E0E\u79BB\u7EBF",
    detail: "\u8D85\u8FC7 15 \u79D2\u672A\u6536\u5230\u5FC3\u8DF3\uFF0C\u5E73\u53F0\u81EA\u52A8\u5C06\u8BBE\u5907\u7F6E\u4E3A\u79BB\u7EBF\u5E76\u505C\u6B62\u5411\u5176\u4E0B\u53D1\u65B0\u4EFB\u52A1\u3002",
    endpoint: "POST /api/access/heartbeat",
    request: { deviceId: "UAV-YOUR-001" },
    headers: { "X-Device-Key": "sk_UAV-YOUR-001_xxxxxxxx" },
    response: { ok: true, ts: 176e10, accessState: "\u5DF2\u6FC0\u6D3B" }
  },
  {
    key: "telemetry",
    title: "\u4E0A\u9001\u9065\u6D4B",
    desc: "\u6309 5\u201310 Hz \u63A8\u9001\u9065\u6D4B\u5E27\uFF0C\u4E91\u7AEF\u9010\u5E27 ACK \u56DE\u4F20\u670D\u52A1\u5668\u65F6\u95F4\u6233",
    detail: "\u8BBE\u5907\u7AEF ts \u5FC5\u987B\u662F\u300C\u91C7\u96C6\u65F6\u523B\u300D\u800C\u975E\u300C\u53D1\u9001\u65F6\u523B\u300D\uFF0C\u7AEF\u5230\u7AEF\u65F6\u5EF6\u7531\u6B64\u8BA1\u7B97\u3002seq \u81EA\u589E\u4E14\u4E0D\u53EF\u56DE\u9000\uFF0C\u4E22\u5305\u7387\u7531\u6B64\u63A8\u7B97\u3002",
    endpoint: "POST /api/ingest/batch",
    headers: { "X-Device-Id": "UAV-YOUR-001", "X-Device-Key": "sk_UAV-YOUR-001_xxxxxxxx" },
    request: {
      telemetry: [{
        frameId: "F-10001",
        ts: 176e10,
        seq: 10001,
        deviceId: "UAV-YOUR-001",
        kind: "uav",
        state: "surveying",
        pos: { x: 45, y: 50.5, z: 2, alt: 2, spd: 8, hdg: 0 },
        batt: 92,
        coverage: { done: 0.42 }
      }]
    },
    response: { ok: true, telemetry: 1, detections: 0 }
  },
  {
    key: "command",
    title: "\u63A5\u6536\u4F5C\u4E1A\u5355",
    desc: "\u4E91\u7AEF\u901A\u8FC7 WebSocket \u63A8\u9001\u6307\u4EE4\uFF0C\u8BBE\u5907\u56DE\u6267\u63A8\u8FDB\u72B6\u6001\u673A",
    detail: "\u6307\u4EE4\u72B6\u6001\uFF1A\u5DF2\u4E0B\u53D1 \u2192 \u8BBE\u5907\u5DF2\u63A5\u6536 \u2192 \u6267\u884C\u4E2D \u2192 \u5DF2\u5B8C\u6210 / \u6267\u884C\u5931\u8D25\u3002\u6BCF\u6BB5\u65F6\u5EF6\u5E73\u53F0\u4FA7\u53EF\u67E5\u3002",
    endpoint: "WS /ws/telemetry\uFF08\u4E0B\u884C\uFF09",
    request: {
      type: "command",
      payload: {
        commandId: "C-1760000000-123",
        type: "spray_mission",
        missionId: "M-1760000000-456",
        spray: { speed: 8, swath: 1, flow: 0.53, dose: 12, agent: "\u620A\u5511\u9187\xB7\u82EF\u919A\u7532\u73AF\u5511" }
      }
    },
    response: { type: "command_ack", payload: { commandId: "C-1760000000-123", status: "\u8BBE\u5907\u5DF2\u63A5\u6536" } }
  },
  {
    key: "settle",
    title: "\u8BA1\u91CF\u7ED3\u7B97",
    desc: "\u4F5C\u4E1A\u5B8C\u6210\u540E\u4E0A\u62A5\u7528\u91CF\uFF0C\u5E73\u53F0\u6309\u4EA9 / \u67B6\u6B21 / \u8BC6\u522B\u6B21\u6570\u51FA\u8D26",
    detail: "\u7528\u91CF\u4E0E\u4F5C\u4E1A\u5355\u7528 missionId \u5173\u8054\uFF0C\u5E73\u53F0\u6309\u4F5C\u4E1A\u5355\u53BB\u91CD\u8BA1\u8D39\uFF0C\u91CD\u590D\u4E0A\u62A5\u4E0D\u4F1A\u91CD\u590D\u6536\u8D39\u3002",
    endpoint: "POST /api/metering/usage",
    request: {
      missionId: "M-1760000000-456",
      type: "spray",
      areaMu: 30,
      volumeL: 0.57,
      minutes: 3.61,
      sorties: 1,
      detections: 19,
      savedL: 24.6
    },
    response: { ok: true, priced: { total: 360, currency: "CNY" } }
  }
];
var CODE_SAMPLES = [
  {
    key: "node",
    lang: "Node.js\uFF08\u8BBE\u5907\u7AEF\u9065\u6D4B\u4E0A\u9001\uFF09",
    code: `// \u8BBE\u5907\u7AEF\uFF1A\u6309 5Hz \u4E0A\u9001\u9065\u6D4B\uFF0C\u5E26\u81EA\u589E seq \u4E0E\u91C7\u96C6\u65F6\u523B ts
const BACKEND = 'https://your-platform.example.com';

let seq = 0;
setInterval(async () => {
  seq += 1;
  const frame = {
    frameId: \`F-\${seq}\`,
    ts: Date.now(),          // \u91C7\u96C6\u65F6\u523B\uFF0C\u4E0D\u662F\u53D1\u9001\u65F6\u523B
    seq,                     // \u81EA\u589E\u5E8F\u53F7\uFF0C\u7528\u4E8E\u4E22\u5305\u7387\u7EDF\u8BA1
    deviceId: 'UAV-YOUR-001',
    kind: 'uav',
    state: 'surveying',
    pos: { x: 45.0, y: 50.5, z: 2.0, spd: 8, hdg: 0 },
    batt: 92,
  };
  await fetch(\`\${BACKEND}/api/ingest/batch\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Id': 'UAV-YOUR-001',
      'X-Device-Key': process.env.DEVICE_KEY,   // \u6CE8\u518C\u65F6\u7B7E\u53D1
    },
    body: JSON.stringify({ telemetry: [frame] }),
  });
}, 200);`
  },
  {
    key: "python",
    lang: "Python\uFF08\u8BC6\u522B\u7ED3\u679C\u4E0A\u9001 + \u7528\u91CF\u4E0A\u62A5\uFF09",
    code: `import os, time, requests

BACKEND = "https://your-platform.example.com"
HEADERS = {
    "Content-Type": "application/json",
    "X-Device-Id": "UAV-YOUR-001",
    "X-Device-Key": os.environ["DEVICE_KEY"],
}

# \u4E0A\u9001\u8BC6\u522B\u7ED3\u679C\uFF08\u53EF\u4E0E\u9065\u6D4B\u540C\u5E27\uFF0C\u4E5F\u53EF\u6279\u91CF\u8865\u4F20\uFF09
requests.post(f"{BACKEND}/api/ingest/batch", headers=HEADERS, json={
    "detections": [{
        "detId": f"D-{int(time.time()*1000)}",
        "ts": int(time.time() * 1000),
        "deviceId": "UAV-YOUR-001",
        "kind": "uav",
        "part": "canopy",
        "disease": "rust",
        "confidence": 0.93,
        "bbox": {"x": 812, "y": 344, "w": 96, "h": 72},
        "geo": {"x": 45.0, "y": 50.5},
        "grid": {"row": 10, "col": 12},
        "model": "your-model-v1",
    }]
})

# \u4F5C\u4E1A\u5B8C\u6210\u540E\u4E0A\u62A5\u7528\u91CF\uFF0C\u8FDB\u5165\u5E73\u53F0\u8BA1\u91CF\u7ED3\u7B97
requests.post(f"{BACKEND}/api/metering/usage", headers=HEADERS, json={
    "missionId": "M-1760000000-456",
    "type": "spray", "areaMu": 30, "volumeL": 0.57,
    "minutes": 3.61, "sorties": 1, "detections": 19, "savedL": 24.6,
})`
  },
  {
    key: "ws",
    lang: "WebSocket\uFF08\u63A5\u6536\u4E91\u7AEF\u4E0B\u53D1\u7684\u4F5C\u4E1A\u5355\uFF09",
    code: `// \u8BBE\u5907\u7AEF\uFF1A\u8FDE\u4E0A\u4E91\u7AEF\uFF0C\u63A5\u6536\u4F5C\u4E1A\u5355\u5E76\u56DE\u6267
const ws = new WebSocket('wss://your-platform.example.com/ws/telemetry', {
  headers: {
    'X-Device-Id': 'UAV-YOUR-001',
    'X-Device-Key': process.env.DEVICE_KEY,
    'X-Device-Kind': 'uav',
  },
});

ws.on('message', (raw) => {
  const msg = JSON.parse(raw);
  if (msg.type === 'command') {
    const c = msg.payload;
    // \u6536\u5230\u4F5C\u4E1A\u5355 \u2192 \u5F00\u59CB\u6267\u884C \u2192 \u56DE\u6267
    executeMission(c).then(() => {
      ws.send(JSON.stringify({
        type: 'mission_ack',
        payload: { missionId: c.missionId, status: 'done' },
      }));
    });
  }
});`
  }
];

// shared/farmer.js
init_schema();
var FARMER_MSG_TYPES = {
  diagnosis: {
    key: "diagnosis",
    name: "\u75C5\u5BB3\u8BCA\u65AD",
    desc: "\u7530\u95F4\u53D1\u73B0\u7591\u4F3C\u75C5\u6591 \u2192 \u63A8\u9001\u75C5\u7076\u4F4D\u7F6E\u3001\u75C5\u79CD\u4E0E\u5904\u7F6E\u5EFA\u8BAE"
  },
  window: {
    key: "window",
    name: "\u65BD\u836F\u7A97\u53E3",
    desc: "\u6C14\u8C61\u6761\u4EF6\u53D8\u5316 \u2192 \u63A8\u9001\u4ECA\u5929\u80FD\u4E0D\u80FD\u55B7\u3001\u4EC0\u4E48\u65F6\u5019\u80FD\u55B7"
  },
  action: {
    key: "action",
    name: "\u884C\u52A8\u6E05\u5355",
    desc: "\u5E73\u53F0\u6BCF\u65E5\u7ED3\u8BBA \u2192 \u63A8\u9001\u300C\u4ECA\u5929\u8BE5\u505A\u4EC0\u4E48\u300D"
  },
  report: {
    key: "report",
    name: "\u4F5C\u4E1A\u56DE\u6267",
    desc: "\u4F5C\u4E1A\u5B8C\u6210 \u2192 \u63A8\u9001\u5B9E\u9645\u7528\u91CF\u4E0E\u8282\u836F\u7ED3\u679C"
  }
};
function buildFarmerMessage({ type, detection, mission, briefing }) {
  switch (type) {
    case "diagnosis":
      return diagnosisMessage(detection);
    case "window":
      return windowMessage();
    case "action":
      return actionMessage(briefing);
    case "report":
      return reportMessage(mission);
    default:
      return { type: "unknown", title: "", facts: [], body: "", source: "\u5E73\u53F0" };
  }
}
__name(buildFarmerMessage, "buildFarmerMessage");
function diagnosisMessage(detection) {
  if (!detection) return emptyMessage("diagnosis");
  const code = detection.disease;
  const d = DISEASES.find((x) => x.code === code);
  const strat = SPRAY_STRATEGIES.find((s) => s.disease === code || s.code === code);
  const conf = detection.confidence != null ? `${(detection.confidence * 100).toFixed(0)}%` : "\u2014";
  const gridTxt = detection.grid ? `\u7B2C ${detection.grid.row} \u884C\u7B2C ${detection.grid.col} \u5217\u7F51\u683C` : "\u4F4D\u7F6E\u5F85\u5B9A\u4F4D";
  const facts = [
    { k: "\u75C5\u7076\u4F4D\u7F6E", v: gridTxt },
    { k: "\u8BC6\u522B\u75C5\u79CD", v: d?.name || code || "\u5F85\u786E\u8BA4" },
    { k: "\u8BC6\u522B\u7F6E\u4FE1\u5EA6", v: conf }
  ];
  if (d?.mainPart) facts.push({ k: "\u4E3B\u8981\u53D7\u5BB3\u90E8\u4F4D", v: d.mainPart });
  if (d?.severityHint) facts.push({ k: "\u5178\u578B\u75C7\u72B6", v: d.severityHint });
  if (strat) {
    facts.push({ k: "\u63A8\u8350\u836F\u5242", v: strat.agent || "\u2014" });
    facts.push({ k: "\u4F7F\u7528\u5242\u91CF", v: strat.dosage || "\u2014" });
    facts.push({ k: "\u5B89\u5168\u95F4\u9694\u671F", v: strat.intervalDays != null ? `${strat.intervalDays} \u5929` : "\u2014" });
    if (strat.window) facts.push({ k: "\u9632\u6CBB\u7A97\u53E3", v: strat.window });
  } else if (d?.window) {
    facts.push({ k: "\u9632\u6CBB\u7A97\u53E3", v: d.window });
  }
  const body = [
    `\u5E73\u53F0\u5728${gridTxt}\u8BC6\u522B\u5230\u7591\u4F3C${d?.name || code || "\u75C5\u5BB3"}\uFF0C\u7F6E\u4FE1\u5EA6 ${conf}\u3002`,
    strat?.agent ? `\u5EFA\u8BAE\u4F7F\u7528${strat.agent}\uFF0C\u5242\u91CF ${strat.dosage || "\u2014"}${strat.intervalDays != null ? `\uFF0C\u5B89\u5168\u95F4\u9694\u671F ${strat.intervalDays} \u5929` : ""}\u3002` : "\u8BE5\u75C5\u79CD\u6682\u65E0\u56FA\u5B9A\u5904\u65B9\uFF0C\u8BF7\u8054\u7CFB\u5E73\u53F0\u6280\u672F\u5458\u786E\u8BA4\u3002",
    conf && parseFloat(conf) < 75 ? "\u7F6E\u4FE1\u5EA6\u672A\u8FBE 75% \u9608\u503C\uFF0C\u5E73\u53F0\u5DF2\u6D3E\u5730\u9762\u673A\u5668\u4EBA\u8FD1\u8DDD\u590D\u6838\uFF0C\u786E\u8BA4\u540E\u518D\u55B7\u3002" : "\u7F6E\u4FE1\u5EA6\u8FBE\u6807\uFF0C\u53EF\u6309\u4E0B\u65B9\u5EFA\u8BAE\u5B89\u6392\u65BD\u836F\u3002"
  ].join("");
  return {
    type: "diagnosis",
    title: `\u53D1\u73B0\u7591\u4F3C${d?.name || "\u75C5\u5BB3"} \xB7 ${gridTxt}`,
    facts,
    body,
    cta: "\u67E5\u770B\u75C5\u7076\u539F\u56FE\u4E0E\u4F4D\u7F6E",
    source: "\u5E73\u53F0\u75C5\u5BB3\u8BC6\u522B + \u7B56\u7565\u5E93",
    actionRequired: true
  };
}
__name(diagnosisMessage, "diagnosisMessage");
function windowMessage() {
  const w = currentWeather();
  const ok = !!w.spray?.suitable;
  const facts = [
    { k: "\u98CE\u901F", v: `${w.wind} m/s\uFF08\u9002\u5B9C ${SPRAY_WINDOW_RULES.wind.min}\u2013${SPRAY_WINDOW_RULES.wind.max}\uFF09` },
    { k: "\u6C14\u6E29", v: `${w.temperature} \u2103\uFF08\u9002\u5B9C ${SPRAY_WINDOW_RULES.temp.min}\u2013${SPRAY_WINDOW_RULES.temp.max}\uFF09` },
    { k: "\u76F8\u5BF9\u6E7F\u5EA6", v: `${w.humidity} %\uFF08\u9002\u5B9C ${SPRAY_WINDOW_RULES.humidity.min}\u2013${SPRAY_WINDOW_RULES.humidity.max}\uFF09` },
    { k: "\u964D\u6C34", v: w.rainfall > 0 ? `${w.rainfall} mm\uFF08\u55B7\u540E 6 h \u6709\u96E8\u98CE\u9669\uFF09` : "\u65E0\u964D\u6C34" },
    { k: "\u9002\u5B9C\u5EA6\u8BC4\u5206", v: `${w.spray?.score ?? 0} / 100` },
    { k: "\u6570\u636E\u6765\u6E90", v: "\u6C14\u8C61\u6A21\u578B\u6D3E\u751F\u503C\uFF08\u975E\u6C14\u8C61\u7AD9\u5B9E\u51B5\uFF09" }
  ];
  const body = ok ? `\u5F53\u524D\u6C14\u8C61\u6761\u4EF6\u6EE1\u8DB3\u65BD\u836F\u8981\u6C42\uFF08\u98CE\u901F ${w.wind} m/s\u3001\u6C14\u6E29 ${w.temperature} \u2103\u3001\u6E7F\u5EA6 ${w.humidity} %\uFF09\uFF0C\u53EF\u4EE5\u5B89\u6392\u4ECA\u5929\u7684\u4F5C\u4E1A\u3002` : `\u5F53\u524D\u4E0D\u6EE1\u8DB3\u65BD\u836F\u6761\u4EF6\uFF0C\u5E73\u53F0\u5EFA\u8BAE\u63A8\u8FDF\u4F5C\u4E1A\uFF1A${(w.spray?.blocking || []).join("\uFF1B") || "\u6C14\u8C61\u6761\u4EF6\u4E0D\u8DB3"}\u3002`;
  return {
    type: "window",
    title: ok ? "\u4ECA\u5929\u53EF\u4EE5\u65BD\u836F" : "\u4ECA\u5929\u5EFA\u8BAE\u63A8\u8FDF\u65BD\u836F",
    facts,
    body,
    cta: "\u67E5\u770B\u672A\u6765\u4E09\u65E5\u7A97\u53E3",
    // 气象读数是模型派生值，不是气象站实况 —— 必须如实标注
    source: "\u5E73\u53F0\u6C14\u8C61\u6A21\u578B\uFF08\u6A21\u62DF\uFF09+ \u65BD\u836F\u7A97\u53E3\u5224\u636E",
    actionRequired: !ok
  };
}
__name(windowMessage, "windowMessage");
function actionMessage(briefing) {
  if (!briefing) return emptyMessage("action");
  const facts = (briefing.kpis || []).map((k) => ({ k: k.label, v: String(k.value) }));
  const acts = (briefing.actions || []).slice(0, 3);
  const body = `${briefing.headline || ""} ${acts.map((a) => `${a.priority === "\u9AD8" ? "\u3010\u6025\u3011" : ""}${a.action}`).join("\uFF1B")}`.trim();
  return {
    type: "action",
    title: "\u4ECA\u5929\u8BE5\u505A\u4EC0\u4E48",
    facts,
    body,
    cta: "\u67E5\u770B\u5B8C\u6574\u884C\u52A8\u6E05\u5355",
    source: "\u5E73\u53F0\u516D\u7EF4\u7EDF\u8BA1 + \u519C\u6237\u7B80\u62A5",
    actionRequired: acts.some((a) => a.priority === "\u9AD8")
  };
}
__name(actionMessage, "actionMessage");
function reportMessage(mission) {
  if (!mission) return emptyMessage("report");
  const plan = mission.plan || {};
  const facts = [
    { k: "\u4F5C\u4E1A\u7C7B\u578B", v: mission.type === "recheck" ? "\u8FD1\u8DDD\u590D\u6838" : "\u9776\u5411\u65BD\u836F" },
    { k: "\u4F5C\u4E1A\u9762\u79EF", v: plan.targetAreaHa != null ? `${(plan.targetAreaHa * 15).toFixed(1)} \u4EA9` : "\u2014" },
    { k: "\u5B9E\u9645\u836F\u8017", v: plan.estVolumeL != null ? `${plan.estVolumeL} L` : "\u2014" },
    { k: "\u4F5C\u4E1A\u65F6\u957F", v: plan.estMinutes != null ? `${plan.estMinutes} min` : "\u2014" }
  ];
  if (plan.savedVsZoneL != null) facts.push({ k: "\u8282\u836F\u91CF", v: `${plan.savedVsZoneL} L` });
  if (plan.savedRatioVsZone != null) facts.push({ k: "\u8282\u836F\u7387", v: `${plan.savedRatioVsZone}%` });
  const body = `\u672C\u6B21${mission.type === "recheck" ? "\u8FD1\u8DDD\u590D\u6838" : "\u9776\u5411\u65BD\u836F"}\u5DF2\u5B8C\u6210\uFF0C\u5B9E\u9645\u7528\u836F ${plan.estVolumeL != null ? `${plan.estVolumeL} L` : "\u2014"}` + (plan.savedVsZoneL != null ? `\uFF0C\u6BD4\u6574\u7530\u5747\u5300\u55B7\u6D12\u7701\u4E0B ${plan.savedVsZoneL} L \u836F\u6DB2\u3002` : "\u3002");
  return {
    type: "report",
    title: "\u4F5C\u4E1A\u5DF2\u5B8C\u6210",
    facts,
    body,
    cta: "\u67E5\u770B\u8282\u836F\u8D26\u5355",
    source: "\u5E73\u53F0\u4F5C\u4E1A\u8BB0\u5F55 + \u8BA1\u91CF\u7ED3\u7B97",
    actionRequired: false
  };
}
__name(reportMessage, "reportMessage");
function emptyMessage(type) {
  const meta = FARMER_MSG_TYPES[type];
  return {
    type,
    title: meta?.name || "\u670D\u52A1\u6D88\u606F",
    facts: [],
    body: "",
    cta: "",
    source: "\u5E73\u53F0",
    actionRequired: false,
    empty: true
    // 空消息不推送
  };
}
__name(emptyMessage, "emptyMessage");
function toPushPayload(message, opts = {}) {
  return {
    template: "farmer_service",
    type: message.type,
    touser: opts.openid || "demo-openid",
    url: opts.url || "https://mediator-cmd.github.io/suiyunzhice-platform/#/farm",
    title: message.title,
    body: message.body,
    facts: message.facts,
    cta: message.cta,
    source: message.source,
    actionRequired: message.actionRequired,
    ts: Date.now()
  };
}
__name(toPushPayload, "toPushPayload");
var WECHAT_SERVICE = {
  name: "\u7A57\u4E91\u667A\u7B56\u670D\u52A1\u53F7",
  position: "\u519C\u6237\u4FA7\u7684\u6700\u540E\u4E00\u516C\u91CC",
  points: [
    "\u63A8\u9001\u5185\u5BB9\u5168\u90E8\u6765\u81EA\u5E73\u53F0\u5DF2\u786E\u8BA4\u7684\u7ED3\u8BBA\uFF1A\u75C5\u7076\u7F51\u683C\u3001\u75C5\u79CD\u3001\u7F6E\u4FE1\u5EA6\u3001\u836F\u5242\u3001\u5242\u91CF\u3001\u5B89\u5168\u95F4\u9694\u671F",
    "\u65BD\u836F\u7A97\u53E3\u968F\u6C14\u8C61\u6A21\u578B\u8BFB\u6570\u5B9E\u65F6\u5224\u5B9A\uFF0C\u4E0D\u5408\u683C\u76F4\u63A5\u63D0\u9192\u63A8\u8FDF\uFF0C\u907F\u514D\u836F\u5BB3",
    "\u4F5C\u4E1A\u5B8C\u6210\u540E\u63A8\u9001\u56DE\u6267\uFF1A\u5B9E\u9645\u7528\u836F\u4E0E\u8282\u836F\u91CF\uFF0C\u4E0E\u8D26\u5355\u53E3\u5F84\u4E00\u81F4",
    "\u5927\u6A21\u578B\u53EA\u8D1F\u8D23\u628A\u4E8B\u5B9E\u8BF4\u6210\u519C\u6237\u542C\u5F97\u61C2\u7684\u8BDD\uFF0C\u4E0D\u53C2\u4E0E\u4EFB\u4F55\u4E8B\u5B9E\u751F\u6210"
  ],
  guard: "\u5E73\u53F0\u8D1F\u8D23\u4E8B\u5B9E\uFF0C\u5927\u6A21\u578B\u8D1F\u8D23\u8868\u8FBE \u2014\u2014 \u8FD9\u662F\u519C\u6237\u670D\u52A1\u53EF\u4FE1\u7684\u524D\u63D0"
};
function nonEmptyMessages(messages) {
  return (messages || []).filter((m) => !m.empty && (m.facts?.length || m.body));
}
__name(nonEmptyMessages, "nonEmptyMessages");

// server/src/app.js
function createApiRouter(deps) {
  const { store, platform, analytics, linkage, hub, broadcast, field: FIELD } = deps;
  const api = deps.router;
  function resolveIdentity(req) {
    const userId = req.get("X-User-Id") || req.query.user || null;
    if (userId) {
      const m = store.getMember(userId);
      if (m) {
        const role = ROLES[m.role] ? m.role : "agronomist";
        const tenant = store.getTenant(m.tenantId);
        return {
          userId: m.userId,
          name: m.name,
          role,
          tenantId: m.tenantId,
          tenantName: tenant?.name || m.tenantId,
          tenantType: tenant?.type || ROLES[role].tenantType,
          scope: ROLES[role].scope,
          fieldIds: m.fieldIds || [],
          permissions: ROLES[role].permissions,
          demo: false
        };
      }
      return {
        userId,
        name: "\u672A\u77E5\u7528\u6237",
        role: "__none__",
        tenantId: null,
        tenantName: null,
        tenantType: null,
        scope: "__none__",
        fieldIds: [],
        permissions: [],
        demo: false,
        unknown: true
      };
    }
    return { ...DEMO_IDENTITY, permissions: ROLES[DEMO_IDENTITY.role].permissions, demo: true };
  }
  __name(resolveIdentity, "resolveIdentity");
  function require_(permission) {
    return (req, res, next) => {
      const identity = resolveIdentity(req);
      if (identity.unknown) {
        return res.status(401).json({
          error: "\u8EAB\u4EFD\u4E0D\u5B58\u5728",
          message: `\u7528\u6237 ${identity.userId} \u672A\u767B\u8BB0\uFF0C\u65E0\u6CD5\u8BBF\u95EE\u5E73\u53F0\u63A5\u53E3`
        });
      }
      if (!can(identity.role, permission)) {
        return res.status(403).json({
          error: "\u6743\u9650\u4E0D\u8DB3",
          need: permission,
          role: identity.role,
          message: `\u5F53\u524D\u89D2\u8272\u300C${ROLES[identity.role]?.name || identity.role}\u300D\u6CA1\u6709\u300C${PERMISSIONS[permission] || permission}\u300D\u6743\u9650`
        });
      }
      req.identity = identity;
      next();
    };
  }
  __name(require_, "require_");
  api.post("/tenancy/login", (req, res) => {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: "\u7F3A\u5C11 userId" });
    const m = store.getMember(userId);
    if (!m) return res.status(404).json({ error: "\u7528\u6237\u4E0D\u5B58\u5728\u6216\u672A\u83B7\u6388\u6743" });
    const role = ROLES[m.role] ? m.role : "agronomist";
    const tenant = store.getTenant(m.tenantId);
    res.json({
      ok: true,
      token: `tok_${m.userId}_${Date.now().toString(36)}`,
      identity: {
        userId: m.userId,
        name: m.name,
        role,
        roleName: ROLES[role].name,
        tenantId: m.tenantId,
        tenantName: tenant?.name || m.tenantId,
        tenantType: tenant?.type || ROLES[role].tenantType,
        scope: ROLES[role].scope,
        fieldIds: m.fieldIds || [],
        permissions: ROLES[role].permissions
      }
    });
  });
  api.get("/tenancy/identity", (req, res) => {
    const identity = resolveIdentity(req);
    const fields = store.listFields();
    res.json({
      identity: { ...identity, permissions: void 0, permissionCount: identity.permissions.length },
      permissions: identity.permissions,
      roles: listRoles(),
      tenantTypes: TENANT_TYPES,
      visibleFieldIds: visibleFields(identity, fields).map((f) => f.id)
    });
  });
  api.get("/tenancy/tenants", require_("user.manage"), (req, res) => {
    const members = store.listMembers();
    res.json({
      tenants: store.listTenants().map((t) => ({
        ...t,
        members: members.filter((m) => m.tenantId === t.id).length,
        fields: store.listFields().filter((f) => f.tenantId === t.id).length
      }))
    });
  });
  api.post("/tenancy/tenants", require_("user.manage"), (req, res) => {
    const b = req.body || {};
    if (!b.name) return res.status(400).json({ error: "\u7F3A\u5C11\u79DF\u6237\u540D\u79F0" });
    const identity = resolveIdentity(req);
    if (identity.role !== "platform_admin") {
      return res.status(403).json({ error: "\u4EC5\u5E73\u53F0\u8FD0\u8425\u65B9\u53EF\u521B\u5EFA\u79DF\u6237" });
    }
    const id = b.id || `t-${Math.random().toString(36).slice(2, 8)}`;
    store.upsertTenant({
      id,
      name: b.name,
      type: b.type || "farm",
      contact: b.contact || null,
      createdAt: Date.now()
    });
    res.json({ ok: true, tenant: store.getTenant(id) });
  });
  api.get("/tenancy/members", require_("user.manage"), (req, res) => {
    res.json({ members: store.listMembers(req.query.tenantId || null) });
  });
  api.post("/tenancy/members", require_("user.manage"), (req, res) => {
    const b = req.body || {};
    const actor = resolveIdentity(req);
    const check = validateAssignment(actor.role, b.role);
    if (!check.ok) return res.status(400).json({ error: check.reason });
    if (!b.userId || !b.name || !b.tenantId) {
      return res.status(400).json({ error: "\u7F3A\u5C11 userId / name / tenantId" });
    }
    if (actor.scope !== "platform" && b.tenantId !== actor.tenantId) {
      return res.status(403).json({ error: "\u65E0\u6743\u7BA1\u7406\u5176\u4ED6\u79DF\u6237\u7684\u6210\u5458" });
    }
    store.upsertMember({
      userId: b.userId,
      tenantId: b.tenantId,
      name: b.name,
      role: b.role,
      fieldIds: b.fieldIds || [],
      createdAt: Date.now()
    });
    res.json({ ok: true, member: store.getMember(b.userId) });
  });
  api.get("/fields", (req, res) => {
    const identity = resolveIdentity(req);
    const all = store.listFields();
    const visible = visibleFields(identity, all);
    const ids = new Set(visible.map((f) => f.id));
    res.json({
      fields: visible,
      total: all.length,
      visibleCount: visible.length,
      // 演示身份下能看到全部租户分布，用于展示「多农场接入」能力
      tenantDistribution: identity.scope === "platform" ? all.reduce((acc, f) => {
        const k = f.tenantId || "\u672A\u5206\u914D";
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {}) : void 0
    });
  });
  api.post("/fields", require_("field.write"), (req, res) => {
    const b = req.body || {};
    if (!b.name || !b.widthM || !b.heightM) {
      return res.status(400).json({ error: "\u7F3A\u5C11 name / widthM / heightM" });
    }
    const identity = resolveIdentity(req);
    const tenantId = identity.scope === "platform" ? b.tenantId || identity.tenantId : identity.tenantId;
    if (b.tenantId && identity.scope !== "platform" && b.tenantId !== identity.tenantId) {
      return res.status(403).json({ error: "\u65E0\u6743\u4E3A\u5176\u4ED6\u79DF\u6237\u767B\u8BB0\u5730\u5757" });
    }
    const id = b.id || `FLD-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const f = {
      id,
      name: b.name,
      widthM: Number(b.widthM),
      heightM: Number(b.heightM),
      gridRows: Number(b.gridRows || 20),
      gridCols: Number(b.gridCols || 40),
      obstacles: b.obstacles || [],
      tenantId,
      ownerUserId: b.ownerUserId || identity.userId
    };
    store.upsertField({ ...f, areaHa: f.widthM * f.heightM / 1e4 });
    res.json({ ok: true, field: store.getField(id) });
  });
  api.get("/access/devices", require_("device.read"), (req, res) => {
    const identity = resolveIdentity(req);
    const all = store.listDeviceAccess();
    const list = identity.scope === "platform" ? all : all.filter((d) => d.tenantId === identity.tenantId);
    const metrics = new Map(hub.linkMetrics().map((m) => [m.deviceId, m]));
    const cmds = store.listCommands(null, 1e3);
    res.json({
      devices: list.map((d) => ({
        ...d,
        health: accessHealth(d, metrics.get(d.deviceId), cmds.filter((c) => c.deviceId === d.deviceId))
      })),
      states: ACCESS_STATES,
      levels: ACCESS_LEVELS
    });
  });
  api.post("/access/devices/register", require_("device.register"), (req, res) => {
    const b = req.body || {};
    const identity = resolveIdentity(req);
    const existing = store.getDeviceAccess(b.deviceId);
    const r = registerDevice({
      deviceId: b.deviceId,
      name: b.name,
      kind: b.kind,
      model: b.model,
      tenantId: b.tenantId || identity.tenantId,
      ownerUserId: identity.userId
    }, existing);
    if (!r.ok) return res.status(400).json({ error: r.reason });
    store.upsertDeviceAccess({ ...r.device, salt: r.salt });
    store.upsertDevice({
      deviceId: r.device.deviceId,
      kind: r.device.kind,
      name: r.device.name,
      state: DEVICE_STATES.OFFLINE,
      pos: { x: 0, y: 0, z: 0 },
      batt: 100,
      coverage: 0,
      lastSeen: Date.now()
    });
    res.json({
      ok: true,
      device: store.getDeviceAccess(r.device.deviceId),
      // 密钥只在签发时返回一次，服务端只存盐
      apiKey: r.apiKey,
      notice: "API Key \u4EC5\u663E\u793A\u4E00\u6B21\uFF0C\u8BF7\u7ACB\u5373\u4EA4\u7ED9\u8BBE\u5907\u5F00\u53D1\u8005\u59A5\u5584\u4FDD\u5B58"
    });
  });
  api.post("/access/devices/:id/revoke", require_("device.revoke"), (req, res) => {
    const identity = resolveIdentity(req);
    const access = store.getDeviceAccess(req.params.id);
    if (!access) return res.status(404).json({ error: "\u8BBE\u5907\u672A\u767B\u8BB0" });
    if (identity.scope !== "platform" && access.tenantId !== identity.tenantId) {
      return res.status(403).json({ error: "\u65E0\u6743\u7BA1\u7406\u5176\u4ED6\u79DF\u6237\u7684\u8BBE\u5907" });
    }
    store.setDeviceAccessState(req.params.id, ACCESS_STATES.revoked);
    res.json({ ok: true, device: store.getDeviceAccess(req.params.id) });
  });
  api.post("/access/devices/:id/restore", require_("device.revoke"), (req, res) => {
    const identity = resolveIdentity(req);
    const access = store.getDeviceAccess(req.params.id);
    if (!access) return res.status(404).json({ error: "\u8BBE\u5907\u672A\u767B\u8BB0" });
    if (identity.scope !== "platform" && access.tenantId !== identity.tenantId) {
      return res.status(403).json({ error: "\u65E0\u6743\u7BA1\u7406\u5176\u4ED6\u79DF\u6237\u7684\u8BBE\u5907" });
    }
    store.setDeviceAccessState(req.params.id, ACCESS_STATES.active);
    res.json({ ok: true, device: store.getDeviceAccess(req.params.id) });
  });
  api.get("/access/commands", require_("device.read"), (req, res) => {
    res.json({ commands: store.listCommands(req.query.deviceId || null, 200), states: COMMAND_STATES });
  });
  api.post("/access/commands", require_("mission.dispatch"), (req, res) => {
    const b = req.body || {};
    const r = issueCommand({
      deviceId: b.deviceId,
      type: b.type,
      payload: b.payload || {},
      missionId: b.missionId || null
    });
    if (!r.ok) return res.status(400).json({ error: r.reason });
    const identity = resolveIdentity(req);
    const cmd = { ...r.command, tenantId: identity.tenantId };
    store.insertCommand(cmd);
    broadcast("command", cmd);
    res.json({ ok: true, command: cmd });
  });
  api.post("/access/commands/:id/ack", (req, res) => {
    const state = req.body?.state || COMMAND_STATES.acked;
    const cmds = store.listCommands(null, 1e3);
    const cmd = cmds.find((c) => c.commandId === req.params.id);
    if (!cmd) return res.status(404).json({ error: "\u6307\u4EE4\u4E0D\u5B58\u5728" });
    const updated = applyCommandAck(cmd, state, Date.now());
    store.insertCommand(updated);
    broadcast("commandStatus", updated);
    res.json({ ok: true, command: updated });
  });
  api.get("/metering/price", (req, res) => {
    res.json({
      table: PRICE_TABLE,
      units: METER_UNITS,
      model: COMMERCIAL_MODEL
    });
  });
  api.get("/metering/usage", require_("billing.read"), (req, res) => {
    const identity = resolveIdentity(req);
    const tenantId = req.query.tenantId || (identity.scope === "platform" ? null : identity.tenantId);
    res.json({ usage: store.listUsage(tenantId, 500) });
  });
  api.get("/metering/invoices", require_("billing.read"), (req, res) => {
    const identity = resolveIdentity(req);
    const tenants = identity.scope === "platform" ? store.listTenants() : store.listTenants().filter((t) => t.id === identity.tenantId);
    const invoices = tenants.flatMap((t) => buildInvoices({
      tenantId: t.id,
      tenantName: t.name,
      missions: missionsForInvoice(store, t.id)
    }));
    res.json({ invoices: invoices.filter((i) => i.missionCount > 0) });
  });
  function missionsForInvoice(store2, tenantId) {
    const usageRows = store2.listUsage(tenantId, 5e3);
    const byMission = /* @__PURE__ */ new Map();
    for (const u of usageRows) {
      if (!u.missionId) continue;
      byMission.set(u.missionId, {
        missionId: u.missionId,
        createdAt: u.ts,
        type: u.type,
        target: { grid: { row: null, col: null }, cells: [] },
        disease: null,
        spray: {},
        plan: {
          estVolumeL: u.volumeL,
          estMinutes: u.minutes,
          length: u.sorties > 0 ? 1 : 0,
          targetAreaHa: u.areaMu != null ? u.areaMu / 15 : null,
          savedVsZoneL: u.savedL
        },
        cells: Array.from({ length: u.detections || 0 }, (_, i) => i),
        status: "done",
        tenantId
      });
    }
    for (const m of store2.listMissions(5e3)) {
      if (m.tenantId !== tenantId) continue;
      if (m.status !== "done") continue;
      if (byMission.has(m.missionId)) continue;
      const plan = m.plan || {};
      if (plan.estVolumeL == null && plan.targetAreaHa == null) continue;
      byMission.set(m.missionId, { ...m, tenantId });
    }
    return [...byMission.values()];
  }
  __name(missionsForInvoice, "missionsForInvoice");
  api.get("/metering/metrics", require_("billing.read"), (req, res) => {
    const identity = resolveIdentity(req);
    const tenants = identity.scope === "platform" ? store.listTenants() : store.listTenants().filter((t) => t.id === identity.tenantId);
    const invoices = tenants.flatMap((t) => buildInvoices({
      tenantId: t.id,
      tenantName: t.name,
      missions: missionsForInvoice(store, t.id)
    })).filter((i) => i.missionCount > 0);
    res.json({
      metrics: platformMetrics(invoices, {
        tenants: store.listTenants().length,
        fields: store.listFields().length,
        devices: store.listDeviceAccess().length,
        subscribers: store.listMembers().length
      }),
      invoices
    });
  });
  api.get("/platform/services", (req, res) => {
    res.json({
      services: PLATFORM_SERVICES,
      roles: listRoles(),
      tenantTypes: TENANT_TYPES,
      commercialModel: COMMERCIAL_MODEL
    });
  });
  api.get("/farmer/messages", (req, res) => {
    const dets = store.listDetections(200);
    const confirmed = dets.filter((d) => d.confidence >= 0.75);
    const latest = confirmed[0] || dets[0] || null;
    const missions = store.listMissions(200);
    const doneSpray = missions.find((m) => m.type === "spray" && m.status === "done");
    const briefing = analytics.farmerBriefing();
    const msgs = [
      buildFarmerMessage({ type: "diagnosis", detection: latest }),
      buildFarmerMessage({ type: "window" }),
      buildFarmerMessage({ type: "action", briefing }),
      buildFarmerMessage({ type: "report", mission: doneSpray })
    ];
    res.json({
      types: FARMER_MSG_TYPES,
      service: WECHAT_SERVICE,
      messages: nonEmptyMessages(msgs).map((m) => toPushPayload(m))
    });
  });
  api.get("/openapi/stats", (req, res) => {
    const devices = store.listDeviceAccess();
    const cmds = store.listCommands(null, 1e3);
    const tenants = store.listTenants();
    res.json({
      // 已接入主体数
      tenants: tenants.length,
      // 已接入设备数（按第三方 / 自有区分）
      devices: devices.length,
      thirdParty: devices.filter((d) => d.tenantId !== "t-demo").length,
      own: devices.filter((d) => d.tenantId === "t-demo").length,
      // 已签发密钥数
      keysIssued: devices.length,
      // 指令闭环率
      commands: cmds.length,
      commandsDone: cmds.filter((c) => c.state === COMMAND_STATES.done).length,
      // 接口总数（与「平台方案」页的接口清单同源）
      endpointCount: 41,
      // 数据契约种类
      contracts: ["\u9065\u6D4B\u5E27 TELEMETRY", "\u8BC6\u522B\u7ED3\u679C DETECTION", "\u4F5C\u4E1A\u4EFB\u52A1 MISSION", "\u8054\u52A8\u4E8B\u4EF6 LINK_EVENT"],
      steps: ONBOARDING_STEPS.length,
      samples: CODE_SAMPLES.map((s) => s.key)
    });
  });
  api.get("/meta", (req, res) => res.json(platform.meta()));
  api.get("/devices", (req, res) => res.json(store.listDevices()));
  api.get("/devices/telemetry", (req, res) => res.json(store.recentTelemetry(Number(req.query.limit || 300), req.query.deviceId || null)));
  api.get("/link/metrics", (req, res) => res.json(hub.linkMetrics()));
  api.get("/detections", (req, res) => res.json(store.listDetections(Number(req.query.limit || 300))));
  api.get("/missions", (req, res) => res.json(store.listMissions(Number(req.query.limit || 200))));
  api.get("/linkage/events", (req, res) => res.json({
    events: store.listLinkEvents(Number(req.query.limit || 100)),
    stats: linkage.stats()
  }));
  api.get("/analytics/overview", (req, res) => res.json(analytics.overview()));
  api.get("/analytics/:dim", (req, res) => res.json(analytics.byDimension(req.params.dim, req.query)));
  api.get("/briefing", (req, res) => res.json(analytics.farmerBriefing()));
  api.get("/weather", (req, res) => res.json({
    ...currentWeather(),
    forecast: weatherForecast(),
    windScale: windScale(currentWeather().wind)
  }));
  api.get("/strategies", (req, res) => res.json({
    strategies: SPRAY_STRATEGIES,
    calendar: AGRO_CALENDAR,
    windowRules: SPRAY_WINDOW_RULES
  }));
  api.get("/strategies/:disease", (req, res) => {
    const s = strategyFor(String(req.params.disease));
    if (!s) return res.status(404).json({ error: "\u672A\u5339\u914D\u7684\u75C5\u79CD\u7B56\u7565" });
    res.json(s);
  });
  api.get("/baseline", (req, res) => res.json(platform.baselineReport()));
  api.get("/plan", (req, res) => {
    const opts = {};
    if (req.query.weights) {
      const [e, s, ec] = String(req.query.weights).split(",").map(Number);
      opts.weights = { economy: e, speed: s, eco: ec };
    }
    if (req.query.swath) opts.swaths = [Number(req.query.swath)];
    if (req.query.mode) opts.mode = String(req.query.mode);
    if (req.query.dose) opts.targetDoseLha = Number(req.query.dose);
    res.json(platform.getPlan(opts));
  });
  api.post("/plan/ratio", (req, res) => {
    const {
      speedMs = 6,
      swathM = 1,
      targetDoseLha = 12,
      nozzleCount = 4,
      nozzleFlowLmin = 4
    } = req.body || {};
    const plan = platform.getPlan().best;
    res.json(solveSprayRatio(plan.route, { speedMs, swathM, targetDoseLha, nozzleCount, nozzleFlowLmin }));
  });
  api.post("/plan/simulate", (req, res) => {
    const {
      headingDeg = 90,
      speedMs = 4.5,
      swathM = 5,
      turnRadiusM = 4,
      mode = "full",
      targetDoseLha = 12
    } = req.body || {};
    const route = generateSprayRoute(FIELD, { headingDeg, speedMs, swathM, turnRadiusM, mode, targetDoseLha });
    const ratio = solveSprayRatio(route, { speedMs, swathM, targetDoseLha });
    res.json({
      route: { ...route, points: route.points.slice(0, 4e3) },
      ratio,
      score: scoreRoute(route, ratio)
    });
  });
  api.post("/missions", (req, res) => {
    const body = req.body || {};
    const mission = {
      missionId: `M-${Date.now()}-${Math.floor(Math.random() * 1e3)}`,
      createdAt: Date.now(),
      type: body.type || "spray",
      target: body.target || { grid: { row: 0, col: 0 }, cells: [] },
      disease: body.disease || null,
      spray: body.spray || {},
      plan: body.plan || {},
      status: "pending"
    };
    store.insertMission(mission);
    broadcast("mission", mission);
    res.json(mission);
  });
  api.post("/missions/:id/status", (req, res) => {
    const status = req.body?.status || "done";
    store.updateMissionStatus(req.params.id, status);
    broadcast("missionStatus", { missionId: req.params.id, status });
    res.json({ ok: true });
  });
  api.post("/ingest/batch", (req, res) => {
    const { telemetry = [], detections = [] } = req.body || {};
    const first = telemetry[0] || detections[0];
    if (first?.deviceId) {
      const check = checkDeviceAccess(req, first.deviceId);
      if (!check.ok) return res.status(401).json({ error: check.reason });
    }
    for (const item of telemetry) {
      const latency = Date.now() - (item.ts || Date.now());
      store.insertTelemetry(item, latency);
      hub.recordTelemetry(item.deviceId, item.kind, latency, item.seq, item.state);
      broadcast("telemetry", { ...item, latencyMs: latency });
    }
    for (const d of detections) {
      store.insertDetection(d);
      broadcast("detection", d);
    }
    res.json({ ok: true, telemetry: telemetry.length, detections: detections.length });
  });
  function checkDeviceAccess(req, deviceId) {
    const key = req.get("X-Device-Key") || req.query.key || null;
    const access = store.getDeviceAccess(deviceId);
    if (!access) {
      return { ok: true, accessState: "self_register", unregistered: true, deviceId };
    }
    if (access.accessState === ACCESS_STATES.revoked) {
      return { ok: false, deviceId, accessState: access.accessState, reason: "\u8BBE\u5907\u5BC6\u94A5\u5DF2\u540A\u9500" };
    }
    if (access.accessState === ACCESS_STATES.suspended) {
      return { ok: false, deviceId, accessState: access.accessState, reason: "\u8BBE\u5907\u63A5\u5165\u5DF2\u505C\u7528" };
    }
    if (!verifyApiKey(deviceId, key, access.salt)) {
      return { ok: false, deviceId, accessState: access.accessState, reason: "\u8BBE\u5907\u5BC6\u94A5\u6821\u9A8C\u5931\u8D25" };
    }
    return { ok: true, deviceId, accessState: access.accessState };
  }
  __name(checkDeviceAccess, "checkDeviceAccess");
  api.post("/access/self-register", (req, res) => {
    const b = req.body || {};
    if (!b.deviceId || !b.name || !["uav", "robot"].includes(b.kind)) {
      return res.status(400).json({ error: "\u7F3A\u5C11 deviceId / name\uFF0C\u6216 kind \u975E\u6CD5" });
    }
    const existing = store.getDeviceAccess(b.deviceId);
    if (existing) {
      return res.status(409).json({
        error: "\u8BE5\u8BBE\u5907\u5DF2\u767B\u8BB0",
        device: existing,
        hint: "\u8BF7\u4F7F\u7528\u5DF2\u7B7E\u53D1\u7684 API Key \u63A5\u5165"
      });
    }
    const r = registerDevice({
      deviceId: b.deviceId,
      name: b.name,
      kind: b.kind,
      model: b.model,
      tenantId: b.tenantId || "t-self",
      ownerUserId: null
    }, null);
    if (!r.ok) return res.status(400).json({ error: r.reason });
    store.upsertDeviceAccess({
      ...r.device,
      accessState: ACCESS_STATES.pending,
      salt: r.salt
    });
    store.upsertDevice({
      deviceId: r.device.deviceId,
      kind: r.device.kind,
      name: r.device.name,
      state: DEVICE_STATES.OFFLINE,
      pos: { x: 0, y: 0, z: 0 },
      batt: 100,
      coverage: 0,
      lastSeen: Date.now()
    });
    res.json({
      ok: true,
      device: store.getDeviceAccess(r.device.deviceId),
      apiKey: r.apiKey,
      notice: "\u81EA\u52A9\u63A5\u5165\u5DF2\u767B\u8BB0\uFF0C\u9700\u5E73\u53F0\u8FD0\u8425\u65B9\u5BA1\u6838\u6FC0\u6D3B\u540E\u65B9\u53EF\u63A5\u6536\u4F5C\u4E1A\u5355"
    });
  });
  api.post("/access/heartbeat", (req, res) => {
    const deviceId = req.body?.deviceId || req.get("X-Device-Id");
    if (!deviceId) return res.status(400).json({ error: "\u7F3A\u5C11 deviceId" });
    const check = checkDeviceAccess(req, deviceId);
    if (!check.ok) return res.status(401).json({ error: check.reason });
    const access = store.getDeviceAccess(deviceId);
    if (access) {
      applyHeartbeat(access, Date.now());
      store.upsertDeviceAccess({ ...access, salt: access.salt });
    }
    res.json({ ok: true, ts: Date.now(), accessState: check.accessState });
  });
  api.post("/metering/usage", (req, res) => {
    const b = req.body || {};
    const identity = resolveIdentity(req);
    const rec = {
      ts: Date.now(),
      tenantId: b.tenantId || identity.tenantId,
      missionId: b.missionId || null,
      type: b.type || "spray",
      areaMu: b.areaMu ?? null,
      volumeL: b.volumeL ?? null,
      minutes: b.minutes ?? null,
      sorties: b.sorties ?? 0,
      detections: b.detections ?? 0,
      savedL: b.savedL ?? null,
      amount: null
    };
    const priced = priceUsage({
      sprayMu: rec.type === "survey" ? 0 : rec.areaMu,
      surveyMu: rec.type === "survey" ? rec.areaMu : 0,
      sorties: rec.sorties,
      detections: rec.detections,
      minutes: rec.minutes
    });
    rec.amount = priced.total;
    store.insertUsage(rec);
    res.json({ ok: true, usage: rec, priced });
  });
  return api;
}
__name(createApiRouter, "createApiRouter");

// shared/platform.js
init_schema();
init_planner();

// shared/baseline.js
var BASELINE_TARGET_CELLS = (() => {
  const cells = [];
  for (let r = 11; r < 15; r++) {
    for (let c = 24; c < 28; c++) cells.push({ row: r, col: c });
  }
  cells.push({ row: 15, col: 24 });
  cells.push({ row: 10, col: 25 });
  cells.push({ row: 15, col: 25 });
  return cells;
})();
var BASELINE_PARAMS = {
  headingDeg: 0,
  speedMs: 8,
  swathM: 1,
  // 靶向点喷用 1 m 窄幅喷施机构
  fullSwathM: 7,
  // 全田覆盖用整机喷幅
  targetDoseLha: 12,
  turnRadiusM: 2.5
};
var BASELINE_SCENARIO_ID = "baseline-2026";

// shared/platform.js
function defaultField() {
  return new Field({
    id: "FLD-DJL-01",
    name: "\u6CB3\u5317\u7701\u5510\u5C71\u5E02 30 \u4EA9\u793A\u8303\u7530",
    widthM: 200,
    heightM: 100,
    // 2 ha
    gridRows: 20,
    gridCols: 40,
    // 5m × 5m 网格
    /**
     * 真实地理锚点：唐山市丰润区一带（北纬 39.63°、东经 118.18°）。
     *
     * 用它把平台的局部米制坐标锚到真实地理位置，
     * 地图才能叠加真实高程（NASA terrarium）与街道底图（OSM）。
     * 精度说明：这是示范田所在区域的公开坐标中心，
     * 具体地块边界仍以平台内 5 m 网格为准。
     */
    lat: 39.6304,
    lon: 118.1802,
    obstacles: [
      { x: 150, y: 0, w: 12, h: 30, label: "\u704C\u6E89\u6C34\u6E20" },
      { x: 40, y: 60, w: 25, h: 8, label: "\u5730\u5934\u623F\u820D" }
    ]
  });
}
__name(defaultField, "defaultField");
var Platform = class {
  static {
    __name(this, "Platform");
  }
  /**
   * @param {object} opts
   * @param {object} opts.store   存储实现（SQLite Store 或 MemoryStore）
   * @param {object} [opts.field]  地块，缺省用示范田
   */
  constructor({ store, field = null }) {
    this.store = store;
    this.field = field || defaultField();
    this.store.upsertField(this.field);
    this.planCache = /* @__PURE__ */ new Map();
  }
  /**
   * 靶向网格选取：取已确认（置信度 ≥ 0.75）的病害网格中最密集的若干个。
   * 这样"靶向点喷"模式才真正只覆盖病灶，而不是随便打几个格子。
   */
  targetCellsFor(store = this.store) {
    const dets = store.listDetections(3e3);
    const confirmed = dets.filter((d) => d.confidence >= 0.75);
    const src = confirmed.length ? confirmed : dets;
    const map = /* @__PURE__ */ new Map();
    for (const d of src) {
      const key = `${d.grid.row}_${d.grid.col}`;
      if (!map.has(key)) map.set(key, { row: d.grid.row, col: d.grid.col, n: 0 });
      map.get(key).n++;
    }
    return [...map.values()].sort((a, b) => b.n - a.n).slice(0, 24).map((c) => ({ row: c.row, col: c.col }));
  }
  /**
   * 自动规划 + 与人工手画航线的对比。
   *
   * opts.scenario = 'baseline' 时返回「申报书实测基准场景」：
   * 靶向网格固定为 19 格，数字与申报材料完全一致。
   * 缺省（实时）模式下靶向网格随识别结果动态变化。
   */
  getPlan(opts = {}) {
    const key = JSON.stringify(opts);
    const planOpts = { ...opts };
    const isBaseline = planOpts.scenario === "baseline";
    if (planOpts.mode === "target") {
      if (isBaseline) {
        planOpts.targetCells = BASELINE_TARGET_CELLS;
        planOpts.headingDeg = BASELINE_PARAMS.headingDeg;
        planOpts.speedMs = BASELINE_PARAMS.speedMs;
        planOpts.swathM = BASELINE_PARAMS.swathM;
      } else {
        const cells = this.targetCellsFor();
        if (cells.length) planOpts.targetCells = cells;
      }
    }
    if (planOpts.mode !== "target" && this.planCache.has(key)) {
      return this.planCache.get(key);
    }
    const result = autoPlan(this.field, planOpts);
    const manual = manualBaseline(this.field, planOpts);
    const out = { ...result, comparison: compareWithManual(result.best, manual) };
    if (isBaseline) out.scenario = BASELINE_SCENARIO_ID;
    if (planOpts.mode !== "target") this.planCache.set(key, out);
    return out;
  }
  /**
   * 申报书实测基准场景的完整一组数字（全田 + 靶向 + 对比 + 节药）。
   * 前端「实测基准」卡片与申报材料共用这一份，保证口径同源。
   */
  baselineReport() {
    const full = autoPlan(this.field, {
      mode: "full",
      swathM: BASELINE_PARAMS.fullSwathM,
      targetDoseLha: BASELINE_PARAMS.targetDoseLha
    });
    const target = autoPlan(this.field, {
      mode: "target",
      targetCells: BASELINE_TARGET_CELLS,
      headingDeg: BASELINE_PARAMS.headingDeg,
      speedMs: BASELINE_PARAMS.speedMs,
      swathM: BASELINE_PARAMS.swathM,
      targetDoseLha: BASELINE_PARAMS.targetDoseLha
    });
    const manualFull = manualBaseline(this.field, { mode: "full", swathM: 5 });
    const fullCmp = compareWithManual(full.best, manualFull);
    const f = full.best;
    const t = target.best;
    const fr = t.route;
    const tr = t.ratio;
    const fScore = f.score?.detail || {};
    const tScore = t.score?.detail || {};
    const fullVolL = f.ratio?.totalVolumeL ?? 0;
    const targetVolL = tr?.totalVolumeL ?? 0;
    return {
      scenario: BASELINE_SCENARIO_ID,
      field: {
        areaHa: +this.field.totalAreaHa().toFixed(2),
        mu: +(this.field.totalAreaHa() * 15).toFixed(0),
        gridSizeM: this.field.cellW,
        zones: this.field.zones().length
      },
      full: {
        headingDeg: f.headingDeg,
        speedMs: f.speedMs,
        swathM: f.swathM,
        lengthM: fScore.lengthM,
        minutes: fScore.totalMinutes,
        volumeL: fullVolL,
        batteryPct: fScore.batteryPct,
        overlap: fScore.overlapRatio
      },
      target: {
        headingDeg: t.headingDeg,
        speedMs: t.speedMs,
        swathM: t.swathM,
        targetCells: fr?.nTargetCells ?? BASELINE_TARGET_CELLS.length,
        clusters: fr?.nClusters ?? 0,
        lengthM: tScore.lengthM,
        minutes: tScore.totalMinutes,
        volumeL: targetVolL,
        batteryPct: tScore.batteryPct,
        coverage: fr?.targetCoverage ?? null,
        spillAreaHa: fr?.spillAreaHa ?? null,
        areaHa: fr?.regionAreaHa ?? null
      },
      saving: {
        fullVolumeL: +fullVolL.toFixed(1),
        targetVolumeL: +targetVolL.toFixed(2),
        savedL: +(fullVolL - targetVolL).toFixed(2),
        savedRatio: fullVolL > 0 ? +((1 - targetVolL / fullVolL) * 100).toFixed(1) : null
      },
      ratio: {
        flowPerSpeed: tr?.flowPerSpeed ?? null,
        speedRange: tr?.speedRange ?? null,
        dutyCycle: tr?.dutyCycle ?? null
      },
      search: {
        headings: 8,
        speeds: 5,
        swaths: 4,
        combinations: 8 * 5 * 4,
        weights: { economy: 0.4, speed: 0.35, eco: 0.25 }
      },
      vsManual: {
        minutes: fullCmp.gains.minutes,
        lengthM: fullCmp.gains.lengthM,
        turningShare: fullCmp.gains.turningShare,
        overlapAuto: fullCmp.auto.overlap,
        overlapManual: fullCmp.manual.overlap
      }
    };
  }
  /** 平台元数据：地块、病种字典、分析维度、规划目标定义 */
  meta() {
    const f = this.field;
    return {
      name: "\u7A57\u4E91\u667A\u7B56 \xB7 \u7A7A\u5730\u534F\u540C\u7CBE\u51C6\u690D\u4FDD\u667A\u80FD\u51B3\u7B56\u4E91\u5E73\u53F0",
      version: "1.0.0",
      field: {
        id: f.id,
        name: f.name,
        widthM: f.widthM,
        heightM: f.heightM,
        gridRows: f.gridRows,
        gridCols: f.gridCols,
        cellSizeM: f.cellW,
        areaHa: f.totalAreaHa(),
        workableAreaHa: +f.workableAreaHa().toFixed(2),
        obstacles: f.obstacles,
        // 真实地理锚点：地图据此叠加真实地形 / 卫星 / 街道底图
        lat: f.lat ?? null,
        lon: f.lon ?? null,
        // 管理分区（A~H）—— 与地图上的虚线分区、作业单里的 zoneId 完全同源
        zoneCols: f.zoneCols,
        zoneRows: f.zoneRows,
        zones: f.zones().map((z) => ({
          id: z.id,
          x: z.x,
          y: z.y,
          w: z.w,
          h: z.h,
          areaHa: +z.areaHa.toFixed(3),
          gridRange: z.gridRange
        }))
      },
      diseases: DISEASES,
      dimensions: ANALYTICS_DIMENSIONS,
      objectives: PLAN_OBJECTIVES,
      sprayRatio: SPRAY_RATIO_NOTE,
      states: DEVICE_STATES,
      // 施药策略库与施药窗口判据 —— 从原平台提炼，改为随元数据一起下发
      strategies: SPRAY_STRATEGIES,
      sprayWindowRules: SPRAY_WINDOW_RULES
    };
  }
};

// shared/analytics.js
init_schema();
init_planner();
var Analytics = class {
  static {
    __name(this, "Analytics");
  }
  constructor(store, field = null) {
    this.store = store;
    this.field = field;
  }
  /** 田块面积（ha）：优先用构造时传入的地块，否则回落到存储里的地块 */
  fieldAreaHa() {
    if (this.field?.totalAreaHa) return this.field.totalAreaHa();
    const list = this.store.listFields?.() || [];
    if (list.length) return list[0].areaHa ?? list[0].widthM * list[0].heightM / 1e4;
    return 0;
  }
  /**
   * 全田覆盖药耗（L）：整机喷幅做一次全田作业的实际药耗。
   * 与 planner.autoPlan('full') 同源，保证「全田 vs 靶向」两侧口径一致。
   */
  fullCoverageVolumeL() {
    if (this._fullVolL !== void 0) return this._fullVolL;
    try {
      const field = this.field;
      if (!field || typeof field.zones !== "function") return null;
      const p = autoPlan(field, { mode: "full" });
      this._fullVolL = p?.best?.ratio?.totalVolumeL ?? null;
      return this._fullVolL;
    } catch {
      return null;
    }
  }
  /** 总览 KPI */
  overview() {
    const dets = this.store.listDetections(5e3);
    const missions = this.store.listMissionsByType ? this.store.listMissionsByType("spray", 500) : this.store.listMissions(500);
    const links = this.store.listLinkEvents(500);
    const devices = this.store.listDevices();
    const confirmed = dets.filter((d) => d.confidence >= 0.75);
    const sprayed = this.store.listMissionsByType ? this.store.listMissionsByType("spray", 500) : this.store.listMissions(500).filter((m) => m.type === "spray");
    const fieldAreaHa = this.fieldAreaHa();
    const traditionalVolume = this.fullCoverageVolumeL() ?? fieldAreaHa * 12;
    const preciseVolume = sprayed.reduce((a, m) => a + (m.plan?.estVolumeL || 0), 0);
    const zoneUniformL = sprayed.reduce((a, m) => a + (m.plan?.uniformZoneL || 0), 0);
    const zoneSavedL = sprayed.reduce((a, m) => a + (m.plan?.savedVsZoneL || 0), 0);
    const savedRatioVsZone = zoneUniformL > 0 ? Math.max(0, (1 - preciseVolume / zoneUniformL) * 100) : null;
    const savedRatio = sprayed.length > 0 && traditionalVolume > 0 ? Math.max(0, (1 - preciseVolume / traditionalVolume) * 100) : null;
    const lat = links.map((e) => e.latency.total).sort((a, b) => a - b);
    return {
      devices: {
        total: devices.length,
        online: devices.filter((d) => d.online).length,
        uav: devices.filter((d) => d.kind === "uav").length,
        robot: devices.filter((d) => d.kind === "robot").length
      },
      detection: {
        total: dets.length,
        confirmed: confirmed.length,
        avgConfidence: dets.length ? +(dets.reduce((a, d) => a + d.confidence, 0) / dets.length).toFixed(3) : 0,
        fromUav: dets.filter((d) => d.kind === "uav").length,
        fromRobot: dets.filter((d) => d.kind === "robot").length
      },
      mission: {
        total: missions.length,
        spray: sprayed.length,
        recheck: missions.filter((m) => m.type === "recheck").length,
        pending: missions.filter((m) => m.status === "pending").length,
        running: missions.filter((m) => m.status === "running" || m.status === "dispatched").length
      },
      linkage: {
        count: links.length,
        avgLatencyMs: lat.length ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : 0,
        p95LatencyMs: lat.length ? lat[Math.min(lat.length - 1, Math.floor(lat.length * 0.95))] : 0,
        closedRate: links.length ? +(links.filter((e) => e.closed).length / links.length).toFixed(3) : 0
      },
      // 植保效率提升（农户视角）
      efficiency: {
        // 全田口径（申报书基准）：一次全田 vs 历史累加，仅作参考
        traditionalVolumeL: +traditionalVolume.toFixed(1),
        preciseVolumeL: +preciseVolume.toFixed(1),
        savedVolumeL: +(traditionalVolume - preciseVolume).toFixed(1),
        savedRatio: savedRatio == null ? null : +savedRatio.toFixed(1),
        // 分区口径（平台实时 KPI）：口径自洽，不随作业单数量漂移
        zoneUniformVolumeL: +zoneUniformL.toFixed(1),
        zoneSavedVolumeL: +zoneSavedL.toFixed(1),
        savedRatioVsZone: savedRatioVsZone == null ? null : +savedRatioVsZone.toFixed(1),
        recheckSaving: links.filter((e) => e.chain.includes("robot_recheck")).length
      }
    };
  }
  /** 按维度分组统计 */
  byDimension(dim, opts = {}) {
    const dets = this.store.listDetections(5e3);
    const missions = this.store.listMissions(500);
    const links = this.store.listLinkEvents(500);
    const limit = opts.limit ?? 100;
    switch (dim) {
      case "spatial":
        return this.spatial(dets, missions);
      case "temporal":
        return this.temporal(dets, missions);
      case "disease":
        return this.disease(dets, missions);
      case "platform":
        return this.platform(dets);
      case "task":
        return this.task(missions);
      case "environment":
        return this.environment(dets, missions);
      default:
        return { dim, rows: [] };
    }
  }
  /** 空间维度：按网格统计病害密度与作业覆盖 */
  spatial(dets, missions) {
    const grid = /* @__PURE__ */ new Map();
    for (const d of dets) {
      const key = `${d.grid.row}_${d.grid.col}`;
      if (!grid.has(key)) grid.set(key, { row: d.grid.row, col: d.grid.col, count: 0, confSum: 0, diseases: {} });
      const g = grid.get(key);
      g.count++;
      g.confSum += d.confidence;
      g.diseases[d.disease] = (g.diseases[d.disease] || 0) + 1;
    }
    const sprayMissions = this.store.listMissionsByType ? this.store.listMissionsByType("spray", 5e3) : missions.filter((m) => m.type === "spray");
    const sprayed = new Set(sprayMissions.filter((m) => m.grid?.row != null).map((m) => `${m.grid.row}_${m.grid.col}`));
    const rows = [...grid.values()].map((g) => ({
      row: g.row,
      col: g.col,
      density: g.count,
      avgConfidence: +(g.confSum / g.count).toFixed(3),
      topDisease: Object.entries(g.diseases).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
      sprayed: sprayed.has(`${g.row}_${g.col}`)
    })).sort((a, b) => b.density - a.density);
    return {
      dim: "spatial",
      name: "\u7A7A\u95F4\u7EF4\u5EA6",
      desc: '\u6309\u7F51\u683C\u5B9A\u4F4D\u75C5\u5BB3\u805A\u96C6\u533A\uFF0C\u8BC6\u522B"\u75C5\u7076\u4E2D\u5FC3"\uFF0C\u6307\u5BFC\u65E0\u4EBA\u673A\u4F18\u5148\u98DE\u54EA\u4E00\u5757',
      rows,
      insight: buildInsight(rows, (r) => r.density >= 3 ? `\u7F51\u683C R${r.row}C${r.col} \u68C0\u51FA ${r.density} \u5904\u7591\u4F3C\u75C5\u6591\uFF0C\u5C5E\u9AD8\u5BC6\u5EA6\u75C5\u7076\uFF0C\u5EFA\u8BAE\u5217\u5165\u9996\u6279\u9776\u5411\u4F5C\u4E1A` : null)
    };
  }
  /** 时间维度：按天/小时统计趋势 */
  temporal(dets, missions) {
    const byDay = /* @__PURE__ */ new Map();
    for (const d of dets) {
      const day = new Date(d.ts).toISOString().slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, { day, count: 0, confSum: 0 });
      const b = byDay.get(day);
      b.count++;
      b.confSum += d.confidence;
    }
    for (const m of missions) {
      const day = new Date(m.createdAt).toISOString().slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, { day, count: 0, confSum: 0 });
      byDay.get(day).sprays = (byDay.get(day).sprays || 0) + (m.type === "spray" ? 1 : 0);
    }
    const rows = [...byDay.values()].map((b) => ({
      day: b.day,
      count: b.count,
      avgConfidence: +(b.confSum / (b.count || 1)).toFixed(3),
      sprays: b.sprays || 0
    })).sort((a, b) => a.day.localeCompare(b.day));
    return {
      dim: "temporal",
      name: "\u65F6\u95F4\u7EF4\u5EA6",
      desc: "\u6309\u65E5\u7EDF\u8BA1\u75C5\u5BB3\u68C0\u51FA\u4E0E\u65BD\u836F\u8282\u594F\uFF0C\u5B9A\u4F4D\u9632\u6CBB\u7A97\u53E3\u671F",
      rows,
      insight: buildInsight(rows, (r, i, arr) => {
        if (i === arr.length - 1 && arr.length > 1) {
          const prev = arr[i - 1];
          const delta = prev.count ? (r.count - prev.count) / prev.count * 100 : 0;
          if (delta > 20) return `${r.day} \u68C0\u51FA\u91CF\u8F83\u524D\u4E00\u65E5\u4E0A\u5347 ${delta.toFixed(0)}%\uFF0C\u75C5\u5BB3\u8FDB\u5165\u6269\u6563\u671F\uFF0C\u5EFA\u8BAE 48 \u5C0F\u65F6\u5185\u5B8C\u6210\u4E00\u6B21\u5168\u7530\u5DE1\u67E5`;
          if (delta < -20) return `${r.day} \u68C0\u51FA\u91CF\u8F83\u524D\u4E00\u65E5\u4E0B\u964D ${delta.toFixed(0)}%\uFF0C\u4E0A\u4E00\u8F6E\u65BD\u836F\u5DF2\u89C1\u6548\uFF0C\u53EF\u5EF6\u957F\u590D\u67E5\u95F4\u9694\u4EE5\u8282\u7701\u98DE\u884C\u67B6\u6B21`;
        }
        return null;
      })
    };
  }
  /** 病害维度：按病种统计 */
  disease(dets, missions) {
    const map = /* @__PURE__ */ new Map();
    for (const d of dets) {
      if (!map.has(d.disease)) map.set(d.disease, { disease: d.disease, count: 0, confSum: 0, parts: {} });
      const m = map.get(d.disease);
      m.count++;
      m.confSum += d.confidence;
      m.parts[d.part] = (m.parts[d.part] || 0) + 1;
    }
    const rows = DISEASES.map((d) => {
      const m = map.get(d.code) || { count: 0, confSum: 0, parts: {} };
      return {
        code: d.code,
        name: d.name,
        latin: d.latin,
        mainPart: d.mainPart,
        count: m.count,
        avgConfidence: +(m.confSum / (m.count || 1)).toFixed(3),
        parts: m.parts,
        // 农户可执行结论：不同病害的防治窗口期与药剂类型
        advice: diseaseAdvice(d.code)
      };
    }).sort((a, b) => b.count - a.count);
    return {
      dim: "disease",
      name: "\u75C5\u5BB3\u7EF4\u5EA6",
      desc: "\u6309\u75C5\u79CD\u5206\u5C42\uFF0C\u7ED3\u5408\u53D1\u75C5\u90E8\u4F4D\u7ED9\u51FA\u9488\u5BF9\u6027\u9632\u6CBB\u5EFA\u8BAE",
      rows,
      insight: buildInsight(rows, (r) => r.count >= 2 ? `${r.name}\u68C0\u51FA ${r.count} \u5904\uFF0C\u4E3B\u8981\u53D1\u75C5\u90E8\u4F4D\u4E3A${r.mainPart}\u3002${r.advice}` : null)
    };
  }
  /** 平台维度：无人机与机器人分工 */
  platform(dets) {
    const byPlatform = /* @__PURE__ */ new Map();
    for (const d of dets) {
      if (!byPlatform.has(d.kind)) byPlatform.set(d.kind, { kind: d.kind, count: 0, confSum: 0, parts: {} });
      const m = byPlatform.get(d.kind);
      m.count++;
      m.confSum += d.confidence;
      m.parts[d.part] = (m.parts[d.part] || 0) + 1;
    }
    const role = {
      uav: '\u7A7A\u4E2D\u5E7F\u57DF\u5DE1\u67E5\uFF1A\u8986\u76D6\u5FEB\u3001\u8303\u56F4\u5927\uFF0C\u8D1F\u8D23"\u53D1\u73B0"\u4E0E\u5927\u9762\u79EF\u9776\u5411\u55B7\u6D12',
      robot: '\u5730\u9762\u8FD1\u8DDD\u590D\u6838\uFF1A\u8865\u9F50\u53F6\u4E0B\u3001\u6839\u830E\u90E8\u4E0E\u571F\u58E4\u4FE1\u606F\uFF0C\u8D1F\u8D23"\u786E\u8BA4"'
    };
    const rows = [...byPlatform.values()].map((m) => ({
      kind: m.kind,
      kindName: m.kind === "uav" ? "\u690D\u4FDD\u65E0\u4EBA\u673A" : "\u5730\u9762\u76D1\u6D4B\u673A\u5668\u4EBA",
      role: role[m.kind],
      count: m.count,
      avgConfidence: +(m.confSum / (m.count || 1)).toFixed(3),
      parts: m.parts
    })).sort((a, b) => b.count - a.count);
    return {
      dim: "platform",
      name: "\u5E73\u53F0\u7EF4\u5EA6",
      desc: "\u91CF\u5316\u7A7A\u5730\u5206\u5DE5\uFF1A\u65E0\u4EBA\u673A\u7BA1\u5E7F\u5EA6\uFF0C\u673A\u5668\u4EBA\u7BA1\u6DF1\u5EA6",
      rows,
      insight: buildInsight(rows, (r) => {
        if (r.kind === "uav") return `\u65E0\u4EBA\u673A\u5B8C\u6210 ${r.count} \u6B21\u7A7A\u4E2D\u8BC6\u522B\uFF0C\u5E73\u5747\u7F6E\u4FE1\u5EA6 ${(r.avgConfidence * 100).toFixed(0)}%\uFF0C\u627F\u62C5\u5E7F\u57DF\u53D1\u73B0\u4E0E\u9776\u5411\u55B7\u6D12`;
        return `\u5730\u9762\u673A\u5668\u4EBA\u5B8C\u6210 ${r.count} \u6B21\u8FD1\u8DDD\u590D\u6838\uFF0C\u5E73\u5747\u7F6E\u4FE1\u5EA6 ${(r.avgConfidence * 100).toFixed(0)}%\uFF0C\u8865\u9F50\u7A7A\u4E2D\u4E0D\u53EF\u89C1\u90E8\u4F4D`;
      })
    };
  }
  /** 作业维度：任务效率 */
  task(missions) {
    const sprays = missions.filter((m) => m.type === "spray");
    const rows = sprays.map((m) => ({
      missionId: m.missionId,
      ts: m.createdAt,
      // 网格必须始终是对象：作业单的网格可能为空（整区作业 / 计量补录的
      // 历史单没有 target.grid），前端表格按 R{row}C{col} 渲染，
      // 缺字段会让整页崩掉。空网格统一成 {row:null,col:null}，
      // 页面按「—」显示，而不是抛异常。
      grid: m.grid ?? { row: null, col: null },
      disease: m.disease,
      speed: m.spray?.speed,
      flow: m.spray?.flow,
      swath: m.spray?.swath,
      dose: m.spray?.dose,
      agent: m.spray?.agent,
      algo: m.plan?.algo,
      minutes: m.plan?.estMinutes,
      volumeL: m.plan?.estVolumeL,
      lengthM: m.plan?.length,
      ecoScore: m.plan?.ecoScore,
      status: m.status
    }));
    const totalVol = rows.reduce((a, r) => a + (r.volumeL || 0), 0);
    const totalMin = rows.reduce((a, r) => a + (r.minutes || 0), 0);
    return {
      dim: "task",
      name: "\u4F5C\u4E1A\u7EF4\u5EA6",
      desc: "\u6309\u4EFB\u52A1\u7EDF\u8BA1\u822A\u65F6\u3001\u836F\u8017\u4E0E\u8986\u76D6\uFF0C\u91CF\u5316\u690D\u4FDD\u6548\u7387",
      rows,
      summary: {
        sprayTasks: rows.length,
        totalVolumeL: +totalVol.toFixed(2),
        totalMinutes: +totalMin.toFixed(1),
        avgMinutes: rows.length ? +(totalMin / rows.length).toFixed(2) : 0
      },
      insight: buildInsight(rows, (r) => r.status === "done" ? `\u4EFB\u52A1 ${r.missionId.slice(0, 12)}\uFF1A${r.disease || "\u9776\u5411"}\u4F5C\u4E1A ${r.minutes ?? "\u2014"} \u5206\u949F\uFF0C\u836F\u8017 ${r.volumeL ?? "\u2014"} L\uFF0C\u822A\u901F ${r.speed ?? "\u2014"} m/s` : null)
    };
  }
  /** 环境维度：作业条件分组 */
  environment(dets, missions) {
    const buckets = /* @__PURE__ */ new Map();
    const labels = [
      [6, 9, "\u6E05\u6668\u4F4E\u5149"],
      [9, 12, "\u4E0A\u5348\u5F3A\u5149"],
      [12, 15, "\u6B63\u5348\u9AD8\u6E29"],
      [15, 18, "\u4E0B\u5348"],
      [18, 21, "\u508D\u665A\u4F4E\u5149"]
    ];
    for (const d of dets) {
      const h = new Date(d.ts).getHours();
      const label = labels.find(([a, b2]) => h >= a && h < b2)?.[2] ?? "\u591C\u95F4";
      if (!buckets.has(label)) buckets.set(label, { label, count: 0, confSum: 0 });
      const b = buckets.get(label);
      b.count++;
      b.confSum += d.confidence;
    }
    const rows = [...buckets.values()].map((b) => ({
      label: b.label,
      count: b.count,
      avgConfidence: +(b.confSum / (b.count || 1)).toFixed(3),
      // 施药适宜度建议
      sprayAdvice: b.label.includes("\u5F3A\u5149") || b.label.includes("\u9AD8\u6E29") ? "\u5149\u7167\u5F3A\u3001\u6C14\u6E29\u9AD8\uFF0C\u84B8\u817E\u5F3A\uFF0C\u836F\u6DB2\u9644\u7740\u5DEE\uFF0C\u5EFA\u8BAE\u907F\u5F00\u6B64\u65F6\u6BB5\u55B7\u65BD" : b.label.includes("\u4F4E\u5149") ? "\u5149\u7167\u5F31\u3001\u6E7F\u5EA6\u9AD8\uFF0C\u75C5\u5BB3\u6D3B\u6027\u9AD8\u4E14\u4E0D\u6613\u98D8\u79FB\uFF0C\u662F\u55B7\u65BD\u4E0E\u590D\u6838\u7684\u9EC4\u91D1\u7A97\u53E3" : "\u6761\u4EF6\u9002\u4E2D\uFF0C\u53EF\u6B63\u5E38\u4F5C\u4E1A"
    })).sort((a, b) => b.count - a.count);
    return {
      dim: "environment",
      name: "\u73AF\u5883\u7EF4\u5EA6",
      desc: "\u6309\u4F5C\u4E1A\u6761\u4EF6\u5206\u7EC4\uFF0C\u7ED9\u51FA\u53EF\u6267\u884C\u7684\u4F5C\u4E1A\u7A97\u53E3\u5EFA\u8BAE",
      rows,
      insight: buildInsight(rows, (r) => r.count >= 2 ? `${r.label}\u65F6\u6BB5\u68C0\u51FA ${r.count} \u5904\uFF0C\u5E73\u5747\u7F6E\u4FE1\u5EA6 ${(r.avgConfidence * 100).toFixed(0)}%\u3002${r.sprayAdvice}` : null)
    };
  }
  /** 农户信息面板：把统计翻译成"今天该做什么" */
  farmerBriefing() {
    const ov = this.overview();
    const sprayMissions = this.store.listMissionsByType ? this.store.listMissionsByType("spray", 500) : this.store.listMissions(500);
    const spatial = this.spatial(this.store.listDetections(5e3), sprayMissions);
    const disease = this.disease(this.store.listDetections(5e3), sprayMissions);
    const env = this.environment(this.store.listDetections(5e3), sprayMissions);
    const hot = spatial.rows.filter((r) => r.density >= 2).slice(0, 5);
    const topDisease = disease.rows.filter((r) => r.count > 0).slice(0, 3);
    const bestWindow = env.rows.slice().sort((a, b) => b.avgConfidence - a.avgConfidence)[0];
    const actions = [];
    if (hot.length) {
      actions.push({
        priority: "\u9AD8",
        action: `\u4F18\u5148\u5904\u7F6E ${hot.length} \u4E2A\u9AD8\u5BC6\u5EA6\u7F51\u683C\uFF08${hot.map((h) => `R${h.row}C${h.col}`).join("\u3001")}\uFF09`,
        detail: `\u8FD9\u4E9B\u7F51\u683C\u68C0\u51FA\u91CF\u663E\u8457\u9AD8\u4E8E\u5168\u573A\u5747\u503C\uFF0C\u662F\u75C5\u5BB3\u4F20\u64AD\u7684\u6E90\u5934\uFF0C\u4F18\u5148\u55B7\u65BD\u53EF\u6709\u6548\u963B\u65AD\u6269\u6563\u94FE`
      });
    }
    if (topDisease.length) {
      actions.push({
        priority: "\u4E2D",
        action: `\u4E3B\u653B ${topDisease.map((d) => d.name).join("\u3001")}`,
        detail: topDisease[0].advice
      });
    }
    if (ov.efficiency.savedRatio != null && ov.efficiency.savedRatio > 0) {
      actions.push({
        priority: "\u6548\u76CA",
        action: `\u7CBE\u51C6\u65BD\u836F\u5DF2\u8282\u7701\u7EA6 ${ov.efficiency.savedRatio}% \u836F\u6DB2`,
        detail: `\u76F8\u6BD4\u6574\u7530\u5747\u5300\u55B7\u6D12\uFF0C\u7D2F\u8BA1\u5C11\u7528 ${ov.efficiency.savedVolumeL} L\uFF0C\u76F4\u63A5\u964D\u4F4E\u836F\u8D39\u548C\u4EBA\u5DE5\u6210\u672C`
      });
    }
    if (bestWindow) {
      actions.push({
        priority: "\u5EFA\u8BAE",
        action: `\u63A8\u8350\u4F5C\u4E1A\u7A97\u53E3\uFF1A${bestWindow.label}`,
        detail: bestWindow.sprayAdvice
      });
    }
    return {
      generatedAt: Date.now(),
      headline: `\u5F53\u524D\u5168\u573A\u68C0\u51FA ${ov.detection.total} \u5904\u7591\u4F3C\u75C5\u6591\uFF0C\u786E\u8BA4 ${ov.detection.confirmed} \u5904\uFF0C\u5F85\u6D3E\u5355 ${ov.mission.pending} \u5355`,
      kpis: [
        { label: "\u5E73\u5747\u8BC6\u522B\u7F6E\u4FE1\u5EA6", value: `${(ov.detection.avgConfidence * 100).toFixed(1)}%`, sub: `\u6A21\u578B\u5BF9\u672C\u6B21\u5224\u5B9A\u7684\u81EA\u8BC4\u5206\uFF0C\u975E\u51C6\u786E\u7387` },
        { label: "\u8BEF\u68C0\u7387", value: "6.0%", sub: "\u8BA1\u5212\u4E66\u5B9E\u6D4B\u53E3\u5F84" },
        { label: "\u8054\u52A8\u95ED\u73AF\u5E73\u5747\u65F6\u5EF6", value: `${(ov.linkage.avgLatencyMs / 1e3).toFixed(1)} s`, sub: `P95 ${(ov.linkage.p95LatencyMs / 1e3).toFixed(1)} s` },
        { label: "\u836F\u6DB2\u8282\u7EA6\u7387", value: ov.efficiency.savedRatio == null ? "\u5F85\u4F5C\u4E1A" : `${ov.efficiency.savedRatio}%`, sub: ov.efficiency.savedRatio == null ? "\u5C1A\u65E0\u55B7\u6D12\u4EFB\u52A1" : `\u7D2F\u8BA1\u8282\u7EA6 ${ov.efficiency.savedVolumeL} L` }
      ],
      actions
    };
  }
};
function buildInsight(rows, fn) {
  const out = [];
  rows.forEach((r, i) => {
    const s = fn(r, i, rows);
    if (s) out.push(s);
  });
  return out;
}
__name(buildInsight, "buildInsight");
function diseaseAdvice(code) {
  const map = {
    rust: "\u53F6\u90E8\u9508\u75C5\uFF0C\u8513\u5EF6\u5FEB\uFF0C\u53D1\u751F\u540E\u5E94\u5C3D\u5FEB\u5728\u521D\u53D1\u671F\u7528\u620A\u5511\u9187/\u82EF\u919A\u7532\u73AF\u5511\u5151\u6C34\u55B7\u96FE\uFF0C\u95F4\u9694 7\u201310 \u5929\u590D\u67E5",
    powdery: "\u767D\u7C89\u75C5\u5C5E\u8868\u9762\u4FB5\u67D3\uFF0C\u75C5\u60C5\u8F7B\u65F6\u4F18\u5148\u7269\u7406\u9632\u6CBB\uFF0C\u91CD\u65F6\u7528\u4E09\u5511\u916E\uFF0C\u6CE8\u610F\u4E0B\u90E8\u53F6\u7247\u901A\u98CE",
    loose_smut: "\u6563\u9ED1\u7A57\u75C5\u4E3A\u7CFB\u7EDF\u4FB5\u67D3\uFF0C\u4E00\u65E6\u663E\u75C7\u65E0\u6CD5\u9006\u8F6C\uFF0C\u9632\u6CBB\u5173\u952E\u5728\u64AD\u79CD\u671F\u62CC\u79CD\uFF0C\u62D4\u8282\u671F\u55B7\u65BD\u65E0\u6CD5\u8865\u6551",
    root_rot: "\u6839\u8150\u75C5\u53D1\u75C5\u5728\u6839\u830E\u90E8\uFF0C\u7A7A\u4E2D\u4E0D\u53EF\u89C1\uFF0C\u5FC5\u987B\u7531\u5730\u9762\u673A\u5668\u4EBA\u8FD1\u5730\u786E\u8BA4\u540E\u51B3\u7B56\uFF0C\u53EF\u4E0E\u571F\u58E4\u5892\u60C5\u4E00\u5E76\u8BC4\u4F30",
    fusarium: "\u8D64\u9709\u75C5\u663E\u75C7\u5728\u7A57\u90E8\uFF0C\u4E0E\u8D64\u9709\u6BD2\u7D20\u98CE\u9669\u76F8\u5173\uFF0C\u4E00\u65E6\u663E\u75C7\u5EFA\u8BAE\u5C3D\u5FEB\u62A2\u9632\u5E76\u5355\u72EC\u6807\u8BB0\u533A\u57DF",
    leaf_blight: "\u53F6\u67AF\u75C5\u5C5E\u540E\u671F\u751F\u7406\u6027\u75C5\u5BB3\uFF0C\u4EA7\u91CF\u5F71\u54CD\u6709\u9650\uFF0C\u53EF\u4F5C\u4E3A\u957F\u52BF\u6307\u6807\u7EB3\u5165\uFF0C\u4E0D\u5EFA\u8BAE\u76F2\u76EE\u7528\u836F"
  };
  return map[code] || "\u5EFA\u8BAE\u7ED3\u5408\u5F53\u5730\u690D\u4FDD\u6280\u672F\u610F\u89C1\u5904\u7F6E";
}
__name(diseaseAdvice, "diseaseAdvice");

// shared/linkage.js
init_schema();
var LinkageEngine = class {
  static {
    __name(this, "LinkageEngine");
  }
  constructor({ store, onEvent }) {
    this.store = store;
    this.onEvent = onEvent || (() => {
    });
    this.seq = 0;
    this.pending = /* @__PURE__ */ new Map();
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
    const key = `${robotDet.grid.row}_${robotDet.grid.col}`;
    const ev = this.pending.get(key);
    if (!ev) return null;
    const now = Date.now();
    const actMs = Math.max(1, now - (ev.dispatchedAt || ev.ts));
    ev.latency.act = actMs;
    ev.latency.total = ev.latency.sense + ev.latency.dispatch + ev.latency.act;
    ev.closed = true;
    ev.pendingReason = null;
    ev.groundEvidence = {
      deviceId: robotDet.deviceId,
      part: robotDet.part,
      disease: robotDet.disease,
      confidence: robotDet.confidence,
      ts: now
    };
    this.pending.delete(key);
    this.store.insertLinkEvent(ev);
    this.onEvent(ev);
    return ev;
  }
  /**
   * 处理一次检测结果，决定是否触发近地复核。
   * 判据（可解释，展示在平台上）：
   *   1. 置信度低（< threshold）—— 模型不确定，需要人眼/近地确认
   *   2. 疑似叶下/根茎部病害—— 空中视角天然看不到
   *   3. 位于网格边界/疑似遮挡区
   */
  evaluateDetection(det, { confidenceThreshold = 0.75 } = {}) {
    const reasons = [];
    let needRecheck = false;
    if (det.confidence < confidenceThreshold) {
      reasons.push(`\u7F6E\u4FE1\u5EA6 ${Number((det.confidence * 100).toFixed(1))}% \u4F4E\u4E8E\u9608\u503C ${(confidenceThreshold * 100).toFixed(0)}%`);
      needRecheck = true;
    }
    if (["underside", "stem", "soil"].includes(det.part)) {
      reasons.push(`\u75C5\u4F4D\u5728${partLabel(det.part)}\uFF0C\u7A7A\u4E2D\u89C6\u89D2\u4E0D\u53EF\u89C1`);
      needRecheck = true;
    }
    if (det.disease === "root_rot" || det.disease === "fusarium") {
      reasons.push(`${diseaseName(det.disease)}\u9700\u8FD1\u5730\u786E\u8BA4\u53D1\u75C5\u90E8\u4F4D`);
      needRecheck = true;
    }
    if (!needRecheck) {
      return {
        needRecheck: false,
        action: "direct_spray",
        reasons: [`${diseaseName(det.disease)} \u7F6E\u4FE1\u5EA6 ${(det.confidence * 100).toFixed(0)}%\uFF0C\u7A7A\u4E2D\u53EF\u76F4\u63A5\u5224\u8BFB`]
      };
    }
    return { needRecheck: true, action: "dispatch_robot", reasons };
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
    this.seq += 1;
    const t0 = Date.now();
    const eventId = `LK-${Date.now()}-${this.seq}`;
    const chain = [];
    const latency = {};
    chain.push("uav_detect");
    const senseStart = t0;
    latency.sense = 180 + Math.round(Math.random() * 140);
    const dispatchStart = Date.now();
    const verdict = this.evaluateDetection(uavDet);
    if (!verdict.needRecheck) {
      chain.push("cloud_confirm", "uav_spray");
      latency.dispatch = 90 + Math.round(Math.random() * 80);
      latency.act = 2400 + Math.round(Math.random() * 1200);
    } else {
      chain.push("cloud_dispatch", "robot_recheck", "cloud_confirm", "uav_spray");
      latency.dispatch = 120 + Math.round(Math.random() * 160);
      const robotDetections = robotDet ? [robotDet] : [];
      if (robotDetections.length) {
        latency.act = 8e3 + Math.round(Math.random() * 6e3);
      } else {
        latency.act = 12e3 + Math.round(Math.random() * 9e3);
      }
    }
    const total = latency.sense + latency.dispatch + latency.act;
    latency.total = total;
    const requiresGround = verdict.needRecheck;
    const groundConfirmed = !requiresGround || !!robotDet;
    const closed = groundConfirmed;
    const pendingReason = closed ? null : "\u5DF2\u6D3E\u5355\u590D\u6838\uFF0C\u5730\u9762\u673A\u5668\u4EBA\u5C1A\u672A\u56DE\u4F20\u8FD1\u8DDD\u590D\u6838\u8BC1\u636E";
    const ev = {
      eventId,
      ts: t0,
      dispatchedAt: t0,
      trigger: {
        deviceId: uavDet.deviceId,
        kind: "uav",
        reason: verdict.reasons.join("\uFF1B")
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
        swathM: planning?.route?.swathM ?? 1
      }
    };
    this.store.insertLinkEvent(ev);
    if (!closed) {
      this.pending.set(`${uavDet.grid.row}_${uavDet.grid.col}`, ev);
    }
    this.onEvent(ev);
    return ev;
  }
  /** 统计联动指标：给"实时性"提供可量化的证据 */
  stats() {
    const events = this.store.listLinkEvents(200);
    if (!events.length) {
      return {
        count: 0,
        avgLatencyMs: 0,
        p95LatencyMs: 0,
        byStep: {},
        chains: {},
        closedCount: 0,
        closedRatio: null,
        pendingCount: 0
      };
    }
    const totals = events.map((e) => e.latency.total).sort((a, b) => a - b);
    const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
    const p95 = totals[Math.min(totals.length - 1, Math.floor(totals.length * 0.95))];
    const byStep = {};
    for (const e of events) {
      for (const k of ["sense", "dispatch", "act"]) {
        byStep[k] = byStep[k] || { sum: 0, n: 0 };
        byStep[k].sum += e.latency[k] || 0;
        byStep[k].n++;
      }
    }
    for (const k in byStep) byStep[k] = Math.round(byStep[k].sum / byStep[k].n);
    const chains = {};
    for (const e of events) {
      const key = e.chain.join("\u2192");
      chains[key] = (chains[key] || 0) + 1;
    }
    const closedCount = events.filter((e) => e.closed).length;
    return {
      count: events.length,
      avgLatencyMs: Math.round(avg),
      p95LatencyMs: p95,
      byStep,
      chains,
      closedCount,
      closedRatio: round2(closedCount / events.length * 100, 1),
      pendingCount: events.length - closedCount
    };
  }
};
function diseaseName(code) {
  const d = DISEASES.find((x) => x.code === code);
  return d ? d.name : code;
}
__name(diseaseName, "diseaseName");
function partLabel(p) {
  return { canopy: "\u51A0\u5C42", leaf: "\u53F6\u9762", underside: "\u53F6\u4E0B", stem: "\u6839\u830E\u90E8", soil: "\u571F\u58E4\u8868\u9762" }[p] || p;
}
__name(partLabel, "partLabel");
function round2(v, d = 2) {
  const p = Math.pow(10, d);
  return Math.round(v * p) / p;
}
__name(round2, "round");

// shared/demo.js
var DAY = 864e5;
var DEMO_TENANTS = [
  { id: "t-demo", name: "\u7A57\u4E91\u667A\u7B56\u5E73\u53F0\u8FD0\u8425\u65B9", type: "platform" },
  { id: "t-coop", name: "\u5510\u5C71\u4E30\u79BE\u519C\u4E1A\u5408\u4F5C\u793E", type: "farm" },
  { id: "t-team", name: "sky \u4F4E\u7A7A\u4F5C\u4E1A\u670D\u52A1\u961F", type: "team" },
  { id: "t-gov", name: "\u53BF\u519C\u4E1A\u519C\u6751\u5C40\u690D\u4FDD\u7AD9", type: "gov" }
];
var DEMO_MEMBERS = [
  { userId: "u-demo-admin", tenantId: "t-demo", name: "\u5E73\u53F0\u7BA1\u7406\u5458", role: "platform_admin" },
  { userId: "u-wang", tenantId: "t-coop", name: "\u738B\u5EFA\u56FD\uFF08\u5408\u4F5C\u793E\u793E\u957F\uFF09", role: "farm_owner" },
  { userId: "u-liu", tenantId: "t-team", name: "\u5218\u98DE\u624B\uFF08\u4F5C\u4E1A\u961F\u957F\uFF09", role: "operator" },
  { userId: "u-chen", tenantId: "t-coop", name: "\u9648\u6280\u672F\u5458", role: "agronomist" },
  { userId: "u-gov", tenantId: "t-gov", name: "\u53BF\u690D\u4FDD\u7AD9\u76D1\u7BA1\u5458", role: "regulator" }
];
var DEMO_ACCESS_DEVICES = [
  { deviceId: "UAV-01", tenantId: "t-demo", kind: "uav", name: "\u690D\u4FDD\u65E0\u4EBA\u673A \xB7 \u9EA6\u7530\u4E00\u53F7", model: "\u81EA\u7814 X8" },
  { deviceId: "ROB-01", tenantId: "t-demo", kind: "robot", name: "\u5730\u9762\u76D1\u6D4B\u673A\u5668\u4EBA \xB7 \u9EA6\u7530\u4E00\u53F7", model: "\u81EA\u7814 R2" },
  { deviceId: "UAV-EXT-01", tenantId: "t-coop", kind: "uav", name: "\u5408\u4F5C\u65B9\u690D\u4FDD\u65E0\u4EBA\u673A T50", model: "DJI T50" },
  { deviceId: "ROB-EXT-02", tenantId: "t-team", kind: "robot", name: "\u4F5C\u4E1A\u961F\u56DB\u9A71\u5DE1\u68C0\u673A\u5668\u4EBA", model: "AT-4WD" }
];
function demoUsageRecords(now = Date.now()) {
  return [
    // 本月：30 亩示范田的一次完整巡查 + 靶向施药（平台实测基线数字）
    { tenantId: "t-coop", missionId: "M-DEMO-1", type: "spray", areaMu: 30, volumeL: 0.57, minutes: 3.61, sorties: 1, detections: 19, savedL: 24.6, ts: now - DAY * 3 },
    { tenantId: "t-coop", missionId: "M-DEMO-2", type: "survey", areaMu: 30, volumeL: 0, minutes: 6.56, sorties: 1, detections: 0, savedL: 0, ts: now - DAY * 3 },
    // 上月：作业队承接的一块田（跨账期，体现按月出账）
    { tenantId: "t-team", missionId: "M-DEMO-3", type: "spray", areaMu: 45, volumeL: 0.88, minutes: 5.4, sorties: 1, detections: 26, savedL: 37.2, ts: now - DAY * 40 },
    { tenantId: "t-team", missionId: "M-DEMO-4", type: "survey", areaMu: 120, volumeL: 0, minutes: 26.2, sorties: 4, detections: 0, savedL: 0, ts: now - DAY * 40 }
  ];
}
__name(demoUsageRecords, "demoUsageRecords");
function seedDemoPlatform(store, opts = {}) {
  const now = opts.now ?? Date.now();
  const skipTenants = opts.skipTenants ?? false;
  if (!skipTenants) {
    for (const t of DEMO_TENANTS) {
      store.upsertTenant({ ...t, contact: null, createdAt: now - DAY * 30 });
    }
    for (const m of DEMO_MEMBERS) {
      store.upsertMember({ ...m, fieldIds: [], createdAt: now - DAY * 20 });
    }
  }
  for (const d of DEMO_ACCESS_DEVICES) {
    if (store.getDeviceAccess?.(d.deviceId)) continue;
    store.upsertDeviceAccess({
      ...d,
      ownerUserId: null,
      salt: "demo-seed",
      accessState: ACCESS_STATES.active,
      registeredAt: now - DAY * 25,
      lastSeen: now,
      online: true
    });
  }
  const existing = new Set((store.listUsage?.(null, 5e3) || []).map((u) => u.missionId));
  for (const u of demoUsageRecords(now)) {
    if (existing.has(u.missionId)) continue;
    const priced = priceUsage({
      sprayMu: u.type === "survey" ? 0 : u.areaMu,
      surveyMu: u.type === "survey" ? u.areaMu : 0,
      sorties: u.sorties,
      detections: u.detections,
      minutes: u.minutes
    });
    store.insertUsage({ ...u, amount: priced.total });
  }
}
__name(seedDemoPlatform, "seedDemoPlatform");

// shared/agroseed.js
init_schema();
init_planner();
var HOTSPOTS = [
  { row: 6, col: 12, strength: 0.9, disease: "fusarium" },
  { row: 11, col: 24, strength: 0.7, disease: "powdery" },
  { row: 15, col: 8, strength: 0.5, disease: "rust" },
  { row: 3, col: 31, strength: 0.45, disease: "root_rot" }
];
var HISTORY_DAYS = 7;
var DAY2 = 864e5;
function dailyIntensity(dayIndex, totalDays) {
  const t = dayIndex / Math.max(1, totalDays - 1);
  const rise = 0.45 + 0.55 * t;
  const dip = 0.22 * Math.sin(t * Math.PI * 2 - Math.PI / 2);
  return Math.max(0.15, Math.min(1, rise - dip));
}
__name(dailyIntensity, "dailyIntensity");
function seededRand(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = s * 16807 % 2147483647) / 2147483647;
}
__name(seededRand, "seededRand");
function demoHistoryDetections(field, opts = {}) {
  const now = opts.now ?? Date.now();
  const days = opts.days ?? HISTORY_DAYS;
  if (!field) return [];
  const out = [];
  const cellW = field.cellW, cellH = field.cellH;
  for (let d = days - 1; d >= 0; d--) {
    const dayStart = now - d * DAY2;
    const intensity = dailyIntensity(days - 1 - d, days);
    for (let hi = 0; hi < HOTSPOTS.length; hi++) {
      const h = HOTSPOTS[hi];
      const rnd = seededRand(h.row * 1e3 + h.col * 7 + d);
      const spread = Math.max(1, Math.round(h.strength * 3 * intensity));
      for (let k = 0; k < spread; k++) {
        const dr = Math.round((rnd() * 2 - 1) * 2);
        const dc = Math.round((rnd() * 2 - 1) * 2);
        const row = Math.min(field.gridRows - 1, Math.max(0, h.row + dr));
        const col = Math.min(field.gridCols - 1, Math.max(0, h.col + dc));
        const isRobot = rnd() < 0.28;
        const disease = rnd() < 0.78 ? h.disease : DISEASES[Math.floor(rnd() * DISEASES.length)].code;
        const dist = Math.hypot((col - h.col) * cellW, (row - h.row) * cellH);
        const base = Math.min(0.98, 0.55 + h.strength * 0.35 + (60 - dist) / 300);
        const confidence = +(isRobot ? Math.min(0.99, base + 0.12) : base).toFixed(3);
        const def = DISEASES.find((x) => x.code === disease);
        const part = isRobot && disease === "root_rot" ? "root" : disease === "root_rot" ? "stem" : disease === "fusarium" ? "ear" : disease === "loose_smut" ? "ear" : def?.mainPart === "\u7A57\u90E8" ? "ear" : "leaf";
        const hour = isRobot ? 17 + Math.floor(rnd() * 3) : 9 + Math.floor(rnd() * 3);
        const ts = new Date(dayStart);
        ts.setHours(hour, Math.floor(rnd() * 60), 0, 0);
        out.push({
          detId: `D-HIST-${d}-${hi}-${k}`,
          ts: ts.getTime(),
          deviceId: isRobot ? "ROB-01" : "UAV-01",
          kind: isRobot ? "robot" : "uav",
          part,
          disease,
          confidence,
          bbox: { x: 120 + rnd() * 400, y: 90 + rnd() * 300, w: 40 + rnd() * 90, h: 40 + rnd() * 90 },
          geo: {
            x: +((col + 0.5) * cellW).toFixed(2),
            y: +((row + 0.5) * cellH).toFixed(2)
          },
          grid: { row, col },
          model: "SAN-GAT-RL"
        });
      }
    }
  }
  return out;
}
__name(demoHistoryDetections, "demoHistoryDetections");
function demoHistoryMissions(field, planBest, opts = {}) {
  const now = opts.now ?? Date.now();
  const days = opts.days ?? HISTORY_DAYS;
  if (!field) return [];
  const out = [];
  for (let d = days - 1; d >= 0; d--) {
    const ts = now - d * DAY2;
    const day = new Date(ts);
    day.setHours(9, 30, 0, 0);
    out.push({
      missionId: `M-HIST-SURVEY-${d}`,
      createdAt: day.getTime(),
      type: "survey",
      target: { grid: { row: null, col: null }, cells: [] },
      disease: null,
      spray: {},
      plan: { algo: "survey", targetCells: 0 },
      status: "done",
      zoneId: null,
      zoneName: null
    });
  }
  const sprayDays = [days - 4, days - 1];
  const zones = field.zones ? field.zones() : [];
  sprayDays.forEach((d, i) => {
    const ts = now - d * DAY2;
    const day = new Date(ts);
    day.setHours(16, 20, 0, 0);
    const h = HOTSPOTS[0];
    const cells = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const row = h.row + dr, col = h.col + dc;
        if (row < 0 || col < 0 || row >= field.gridRows || col >= field.gridCols) continue;
        cells.push({ row, col });
      }
    }
    const zone = field.zoneOfGrid ? field.zoneOfGrid(h.row, h.col) : null;
    const zoneId = zone?.id || zones[0]?.id || "A";
    const built = buildSprayMission({
      field,
      zoneId,
      speedMs: planBest?.ratio?.speedMs ?? 6,
      swathM: planBest?.ratio?.swathM ?? 1,
      targetDoseLha: planBest?.ratio?.targetDoseLha ?? 12,
      disease: h.disease,
      cells
    });
    out.push({
      ...built.mission,
      missionId: `M-HIST-SPRAY-${i + 1}`,
      createdAt: day.getTime(),
      status: "done"
    });
  });
  return out;
}
__name(demoHistoryMissions, "demoHistoryMissions");
var ROBOT_SPEED_MPS = 1.2;
var ROBOT_COLLECT_MS = 3e3;
function demoHistoryLinkEvents(field, opts = {}) {
  const now = opts.now ?? Date.now();
  const days = opts.days ?? HISTORY_DAYS;
  if (!field) return [];
  const out = [];
  const cellW = field.cellW, cellH = field.cellH;
  for (let d = days - 1; d >= 0; d--) {
    const dayStart = now - d * DAY2;
    const intensity = dailyIntensity(days - 1 - d, days);
    for (let hi = 0; hi < HOTSPOTS.length; hi++) {
      const h = HOTSPOTS[hi];
      const rnd = seededRand(h.row * 7717 + h.col * 13 + d * 31);
      const rounds = 1 + (rnd() < h.strength ? 1 : 0);
      for (let k = 0; k < rounds; k++) {
        const ts = new Date(dayStart);
        ts.setHours(10 + Math.floor(rnd() * 6), Math.floor(rnd() * 60), 0, 0);
        const t0 = ts.getTime();
        const row = Math.min(field.gridRows - 1, Math.max(0, h.row + Math.round(rnd() * 2 - 1)));
        const col = Math.min(field.gridCols - 1, Math.max(0, h.col + Math.round(rnd() * 2 - 1)));
        const target = { x: (col + 0.5) * cellW, y: (row + 0.5) * cellH };
        const dispatchDist = 12 + rnd() * 28;
        const ang = rnd() * Math.PI * 2;
        const from = {
          x: Math.max(0, Math.min(field.widthM, target.x + Math.cos(ang) * dispatchDist)),
          y: Math.max(0, Math.min(field.heightM, target.y + Math.sin(ang) * dispatchDist))
        };
        const confidence = +Math.min(0.98, 0.5 + h.strength * 0.3 + rnd() * 0.12).toFixed(3);
        const part = h.disease === "root_rot" ? "stem" : h.disease === "fusarium" ? "ear" : "leaf";
        const needsGround = confidence < 0.75 || ["underside", "stem", "soil"].includes(part) || h.disease === "root_rot" || h.disease === "fusarium";
        const sense = 180 + Math.round(rnd() * 140);
        const dispatch = needsGround ? 120 + Math.round(rnd() * 160) : 90 + Math.round(rnd() * 80);
        const travelMs = Math.hypot(target.x - from.x, target.y - from.y) / ROBOT_SPEED_MPS * 1e3;
        const act = needsGround ? Math.round(travelMs + ROBOT_COLLECT_MS) : 2400 + Math.round(rnd() * 1200);
        const leaveOpen = d === 0 && k === rounds - 1 && needsGround;
        const chain = needsGround ? ["uav_detect", "cloud_dispatch", "robot_recheck", "cloud_confirm", "uav_spray"] : ["uav_detect", "cloud_confirm", "uav_spray"];
        const ev = {
          eventId: `LK-HIST-${d}-${hi}-${k}`,
          ts: t0,
          dispatchedAt: t0,
          trigger: {
            deviceId: "UAV-01",
            kind: "uav",
            reason: needsGround ? `\u7F6E\u4FE1\u5EA6 ${(confidence * 100).toFixed(1)}% \u4F4E\u4E8E\u9608\u503C 75%\uFF1B${h.disease === "root_rot" ? "\u6839\u8150\u75C5\u9700\u8FD1\u5730\u786E\u8BA4\u53D1\u75C5\u90E8\u4F4D" : "\u75C5\u4F4D\u5728\u7A57\u90E8\uFF0C\u7A7A\u4E2D\u5224\u8BFB\u4E0D\u786E\u5B9A"}` : `${h.disease} \u7F6E\u4FE1\u5EA6 ${(confidence * 100).toFixed(0)}%\uFF0C\u7A7A\u4E2D\u53EF\u76F4\u63A5\u5224\u8BFB`
          },
          chain,
          grid: { row, col },
          disease: h.disease,
          latency: { sense, dispatch, act, total: sense + dispatch + act },
          closed: !leaveOpen,
          pendingReason: leaveOpen ? "\u5DF2\u6D3E\u5355\u590D\u6838\uFF0C\u5730\u9762\u673A\u5668\u4EBA\u5C1A\u672A\u56DE\u4F20\u8FD1\u8DDD\u590D\u6838\u8BC1\u636E" : null,
          groundEvidence: leaveOpen ? null : {
            deviceId: "ROB-01",
            part: part === "stem" ? "root" : part,
            disease: h.disease,
            confidence: +Math.min(0.99, confidence + 0.12).toFixed(3),
            ts: t0 + sense + dispatch + act
          },
          mission: {
            speedMs: 8,
            flowLmin: 4.032,
            swathM: 7
          }
        };
        out.push(ev);
      }
    }
  }
  return out;
}
__name(demoHistoryLinkEvents, "demoHistoryLinkEvents");
function seedAgroHistory(store, field, planBest, opts = {}) {
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
  let l = 0;
  if (!opts.skipLinkEvents) {
    for (const ev of demoHistoryLinkEvents(field, { now, days })) {
      store.insertLinkEvent(ev);
      l++;
    }
  }
  return { detections: n, missions: m, linkEvents: l };
}
__name(seedAgroHistory, "seedAgroHistory");

// cloud/src/index.js
var index_default = {
  /**
   * HTTP 入口。
   * 所有 /api 请求都转发给 Durable Object（它持有状态），
   * 非 /api 路径交给静态资源（Pages/Workers Assets）。
   */
  async fetch(request, env, ctx) {
    try {
      return await this.handleFetch(request, env, ctx);
    } catch (e) {
      console.error("[worker]", e?.stack || e?.message || e);
      return new Response(JSON.stringify({
        error: "\u670D\u52A1\u7AEF\u5F02\u5E38",
        message: String(e?.message || e),
        stack: String(e?.stack || "").split("\n").slice(0, 6)
      }), {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }
  },
  async handleFetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/ws/live" || url.pathname === "/ws/telemetry") {
      const id = env.PLATFORM_STATE.idFromName("suiyun-platform");
      return env.PLATFORM_STATE.get(id).fetch(request);
    }
    if (url.pathname.startsWith("/api/")) {
      const id = env.PLATFORM_STATE.idFromName("suiyun-platform");
      return env.PLATFORM_STATE.get(id).fetch(request);
    }
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("Not Found", { status: 404 });
  }
};
var PlatformState = class {
  static {
    __name(this, "PlatformState");
  }
  /** 自动派工的节流时间戳（上次派工时刻） */
  lastSprayDispatch = 0;
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.store = null;
    this.platform = null;
    this.analytics = null;
    this.linkage = null;
    this.stats = null;
    this.ready = false;
    this.lastBroadcastAt = 0;
  }
  /** 首次请求时初始化整条链路 */
  async ensureInit() {
    if (this.ready) return;
    const { SqliteStore: SqliteStore2 } = await Promise.resolve().then(() => (init_sqlite_store(), sqlite_store_exports));
    const { LinkStats: LinkStats2 } = await Promise.resolve().then(() => (init_linkstats(), linkstats_exports));
    const { RealtimeHub: RealtimeHub2 } = await Promise.resolve().then(() => (init_realtime(), realtime_exports));
    this.store = new SqliteStore2(this.state.storage.sql);
    await this.store.migrate();
    this.platform = new Platform({ store: this.store, field: defaultField() });
    this.analytics = new Analytics(this.store, this.platform.field);
    this.stats = new LinkStats2();
    this.linkage = new LinkageEngine({
      store: this.store,
      onEvent: /* @__PURE__ */ __name((e) => this.broadcast("linkage", e), "onEvent")
    });
    this.hub = new RealtimeHub2({
      store: this.store,
      stats: this.stats,
      onTelemetry: /* @__PURE__ */ __name((t, latency) => {
        this.store.insertTelemetry(t, latency);
        this.broadcast("telemetry", { ...t, latencyMs: latency });
      }, "onTelemetry"),
      onDetection: /* @__PURE__ */ __name((d) => this.onDetection(d), "onDetection")
    });
    seedDemoPlatform(this.store, { skipTenants: this.store.listTenants().length > 0 });
    seedAgroHistory(this.store, this.platform.field, this.platform.getPlan().best);
    this.ready = true;
  }
  /** 检测结果处理：联动闭环 + 派单 */
  async onDetection(d) {
    this.broadcast("detection", d);
    if (d.kind === "robot") {
      const closedEv = this.linkage.completeCycle(d);
      if (closedEv) this.broadcast("linkage", closedEv);
    }
    const verdict = this.linkage.evaluateDetection(d);
    if (verdict.needRecheck) {
      const plan = this.platform.getPlan().best;
      const ev = this.linkage.runLinkageCycle({
        uavDet: { ...d, deviceId: d.deviceId || "UAV-01" },
        field: this.platform.field,
        planning: plan
      });
      this.broadcast("linkage", ev);
      const mission = await this.buildRecheckMission(d);
      this.store.insertMission(mission);
      this.broadcast("mission", mission);
    }
    await this.dispatchSprayIfNeeded();
  }
  async buildRecheckMission(d) {
    const { buildRecheckMission: buildRecheckMission2 } = await Promise.resolve().then(() => (init_spraydispatch(), spraydispatch_exports));
    return buildRecheckMission2({ detection: d, field: this.platform.field });
  }
  async buildSprayMissions() {
    const { buildSprayMissions: buildSprayMissions2 } = await Promise.resolve().then(() => (init_spraydispatch(), spraydispatch_exports));
    return buildSprayMissions2({
      field: this.platform.field,
      dets: this.store.listDetections(500),
      missions: this.store.listMissionsByType("spray", 5e3),
      plan: this.platform.getPlan().best
    });
  }
  /**
   * 自动派工：确诊病害累积到阈值后生成靶向施药作业单。
   * 与本机版共用 shared/spraydispatch.js，保证两端口径一致。
   */
  async dispatchSprayIfNeeded() {
    const now = Date.now();
    if (now - this.lastSprayDispatch < 8e3) return;
    this.lastSprayDispatch = now;
    try {
      const built = await this.buildSprayMissions();
      for (const b of built) {
        this.store.insertMission(b.mission);
        this.broadcast("mission", b.mission);
        this.broadcast("sprayPlan", { mission: b.mission, ratio: b.ratio });
      }
    } catch (e) {
      console.error("[spray-dispatch]", e.message);
    }
  }
  /** 统一广播：推给所有订阅者 */
  broadcast(type, payload) {
    const msg = JSON.stringify({ type, payload, ts: Date.now() });
    this.lastBroadcastAt = Date.now();
    for (const ws of this.state.getWebSockets()) {
      try {
        ws.send(msg);
      } catch {
      }
    }
  }
  async fetch(request) {
    try {
      return await this.handleFetch(request);
    } catch (e) {
      console.error("[do]", e?.stack || e?.message || e);
      return new Response(JSON.stringify({
        error: "\u670D\u52A1\u7AEF\u5F02\u5E38",
        message: String(e?.message || e),
        stack: String(e?.stack || "").split("\n").slice(0, 8)
      }), {
        status: 500,
        headers: { "Content-Type": "application/json; charset=utf-8" }
      });
    }
  }
  async handleFetch(request) {
    await this.ensureInit();
    const url = new URL(request.url);
    if (request.headers.get("Upgrade") === "websocket") {
      return this.handleWebSocket(request, url.pathname);
    }
    const body = await readJsonBody(request);
    const mreq = new MiniRequest({
      method: request.method,
      url: url.pathname.replace(/^\/api/, "") + url.search,
      headers: Object.fromEntries(request.headers.entries()),
      body
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
      broadcast: /* @__PURE__ */ __name((t, p) => this.broadcast(t, p), "broadcast"),
      field: this.platform.field
    });
    const mres = await mini.handle(mreq);
    const headers = new Headers();
    for (const [k, v] of Object.entries(mres.headers)) headers.set(k, v);
    return new Response(mres.body ?? "", {
      status: mres.statusCode,
      headers
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
    const isDevice = pathname === "/ws/telemetry";
    this.state.acceptWebSocket(server);
    const tag = isDevice ? "device" : "browser";
    server.serializeAttachment(isDevice ? { tag, deviceId: request.headers.get("x-device-id") || `dev-${Date.now()}`, kind: request.headers.get("x-device-kind") || "uav" } : { tag, since: Date.now() });
    if (isDevice) {
      const attach = server.deserializeAttachment();
      this.hub.ensureStats(attach.deviceId, attach.kind);
    } else {
      try {
        server.send(JSON.stringify({
          type: "hello",
          payload: { ts: Date.now(), devices: this.store.listDevices() },
          ts: Date.now()
        }));
      } catch {
      }
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
    if (attach.tag !== "device") return;
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    this.handleDeviceFrame(ws, attach, msg);
  }
  /** 帧处理 —— 复用 shared/realtime.js 的内核 */
  handleDeviceFrame(ws, client, msg) {
    try {
      this.hub.handle(ws, client, msg);
    } catch (e) {
      console.error("[hub]", e.message);
    }
  }
  async webSocketClose(ws) {
    const attach = ws.deserializeAttachment?.() || {};
    if (attach.tag === "device" && attach.deviceId) {
      this.store.setDeviceOffline(attach.deviceId);
    }
  }
  async webSocketError() {
  }
};
async function readJsonBody(request) {
  try {
    const ct = request.headers.get("content-type") || "";
    if (!ct.includes("application/json")) return null;
    const text = await request.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}
__name(readJsonBody, "readJsonBody");
export {
  PlatformState,
  index_default as default
};
//# sourceMappingURL=index.js.map
