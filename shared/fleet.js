/**
 * 装备操控内核 —— 把「平台能下发指令」变成「设备真能执行」
 *
 * 背景（为什么这块以前是空的）：
 *   平台早就有指令下发骨架（shared/deviceaccess.js 的 issueCommand /
 *   applyCommandAck），也有遥测、识别、作业单、计量四条链路，
 *   但**没有任何设备执行层** —— 指令发出去就没人接，
 *   模拟器只按固定路线来回巡逻。于是平台看起来「能控」，
 *   实际点下去没有任何反应，评审一问就穿。
 *
 * 本模块提供「虚拟装备」需要的全部纯逻辑，服务端与浏览器共用：
 *   1) 作业方式目录（人话描述 + 默认参数 + 适用设备）
 *   2) 直接指令目录（起飞 / 悬停 / 降落 / 返航 / 暂停 / 继续 / 充电）
 *   3) 作业计划构建：作业方式 + 作业范围 → 航线 + 速度喷洒比例 + 作业单
 *   4) 指令执行运动学：设备沿航线推进、耗电、耗药、触发采集
 *   5) 指令回执推进（已下发 → 设备已接收 → 执行中 → 已完成）
 *
 * 架构纪律（与项目其余部分一致）：
 *   - 纯 JS，不依赖任何 Node 专有 API（node: / fs / path / Buffer 都不用）
 *   - 服务端（Node + SQLite / Cloudflare Durable Object）与浏览器（静态演示）
 *     跑同一份代码，保证「界面上看到的执行结果」两边一致
 */

import { generateSprayRoute, buildSprayMission } from './planner.js';
import { COMMAND_STATES } from './deviceaccess.js';

/* ================================================================
 * 一、作业方式目录
 * ================================================================ */

/**
 * 四种作业方式。
 *
 * 每一种都对应一条完整的「平台 → 设备 → 回执」链路，
 * 而不是界面上换个标题的同一件事：
 *   survey_full  —— 无人机沿航线巡查，途中持续识别，不喷洒
 *   spray_target —— 无人机只对已确诊病灶格点喷（1 m 窄幅）
 *   spray_zone   —— 无人机对指定管理分区整区连续喷洒（整机喷幅）
 *   recheck_area —— 地面机器人驶入区域，近距补拍三工位，闭合联动链路
 */
export const OPERATION_MODES = [
  {
    id: 'survey_full',
    name: '全田巡查',
    device: 'uav',
    deviceLabel: 'UAV-01 植保无人机',
    desc: '沿自动规划航线低空巡航，全程开启可见光与多光谱相机识别，沿途产出带网格定位的识别结果，不喷洒任何药液。',
    routeDesc: '全田蛇形覆盖，喷幅位按相机有效覆盖宽度 5 m 取值',
    defaultSwathM: 5.0,
    defaultDoseLha: null,
    needsRange: false,
    needsDisease: false,
  },
  {
    id: 'spray_target',
    name: '靶向点喷',
    device: 'uav',
    deviceLabel: 'UAV-01 植保无人机',
    desc: '只对平台已确诊（置信度 ≥ 75%）的病灶网格喷药，启用 1 m 窄幅喷施机构，喷洒流量与飞行速度严格成正比。',
    routeDesc: '按确诊网格聚簇规划，簇内逐格并排喷洒，簇间转场不喷药',
    defaultSwathM: 1.0,
    defaultDoseLha: 12,
    needsRange: true,
    needsDisease: true,
  },
  {
    id: 'spray_zone',
    name: '分区施药',
    device: 'uav',
    deviceLabel: 'UAV-01 植保无人机',
    desc: '对指定管理分区（A~H）做整区连续喷洒，使用整机喷幅，适用于病害已成片、需要整体处置的分区。',
    routeDesc: '分区范围内蛇形往返，头地转弯占额外土地',
    defaultSwathM: 5.0,
    defaultDoseLha: 12,
    needsRange: false,
    needsDisease: true,
  },
  {
    id: 'recheck_area',
    name: '近距复核',
    device: 'robot',
    deviceLabel: 'ROB-01 地面监测机器人',
    desc: '地面机器人驶入指定区域，对叶下、根茎部、土壤表面三个工位逐点补拍，回传近距证据，闭合空地联动链路。',
    routeDesc: '按网格中心逐点巡回，到点停稳采集 3 秒',
    defaultSwathM: null,
    defaultDoseLha: null,
    needsRange: true,
    needsDisease: false,
  },
];

/** 作业方式 id → 作业方式对象 */
export function operationMode(id) {
  return OPERATION_MODES.find(m => m.id === id) || null;
}

/* ================================================================
 * 二、直接指令目录
 * ================================================================ */

/**
 * 直接指令：不涉及航线规划，直接改变设备状态。
 * 与作业方式是两条独立通道 —— 评审现场常见的问题是
 * 「先下发个起飞指令看看」，这个必须立刻有反应。
 */
export const DIRECT_COMMANDS = [
  { id: 'takeoff',     name: '起飞',   device: 'uav',   desc: '解锁旋翼、垂直爬升至作业高度' },
  { id: 'hover',      name: '悬停',   device: 'uav',   desc: '原地悬停，相机与识别保持工作' },
  { id: 'land',       name: '降落',   device: 'uav',   desc: '下降到地面并锁定，进入维护状态' },
  { id: 'return_home',name: '返航',   device: 'uav',   desc: '返回起降点，途中不再作业' },
  { id: 'stop',       name: '暂停',   device: 'any',   desc: '暂停当前任务，保持当前位置与姿态' },
  { id: 'resume',     name: '继续',   device: 'any',   desc: '从暂停处继续执行原任务' },
  { id: 'charge',     name: '充电',   device: 'any',   desc: '回到起降点并开始充电，电量回升' },
];

/** 直接指令 id → 指令定义 */
export function directCommand(id) {
  return DIRECT_COMMANDS.find(c => c.id === id) || null;
}

/* ================================================================
 * 三、指令与作业单构造
 * ================================================================ */

/** 指令类型白名单（服务端下发前必须过这一关） */
export const COMMAND_TYPES = [
  ...OPERATION_MODES.map(m => m.id),
  ...DIRECT_COMMANDS.map(c => c.id),
];

/**
 * 校验一条指令是否可以下发到指定设备。
 * @returns {{ok:boolean, reason?:string}}
 */
export function validateCommand({ type, deviceId, deviceKind }) {
  if (!deviceId) return { ok: false, reason: '缺少 deviceId' };
  const mode = operationMode(type);
  if (mode) {
    if (deviceKind && mode.device !== deviceKind) {
      return { ok: false, reason: `「${mode.name}」只能下发给${mode.device === 'uav' ? '无人机' : '地面机器人'}` };
    }
    return { ok: true };
  }
  const cmd = directCommand(type);
  if (!cmd) return { ok: false, reason: `未知指令类型 ${type}` };
  if (cmd.device !== 'any' && deviceKind && cmd.device !== deviceKind) {
    return { ok: false, reason: `「${cmd.name}」只能下发给${cmd.device === 'uav' ? '无人机' : '地面机器人'}` };
  }
  return { ok: true };
}

/** 作业单状态机（作业单自身的状态，与指令状态机并行） */
export const MISSION_STATUS = {
  pending: '待下发',
  dispatched: '已下发',
  running: '执行中',
  done: '已完成',
  failed: '执行失败',
  rejected: '已驳回',
};

/** 指令状态（直接复用 deviceaccess.js 的定义，状态机只有一份） */
export const ORDER_STATE = COMMAND_STATES;

/* ================================================================
 * 四、作业范围 → 网格
 * ================================================================ */

/**
 * 落在作业矩形内的网格（返回网格中心坐标，便于直接当路径点）。
 *
 * @param {Field} field
 * @param {{x:number,y:number,w:number,h:number}} area  局部 ENU 米制矩形
 */
export function cellsInArea(field, area) {
  if (!field || !area) return [];
  const out = [];
  const cw = field.cellW, ch = field.cellH;
  for (let r = 0; r < field.gridRows; r++) {
    for (let c = 0; c < field.gridCols; c++) {
      const x = (c + 0.5) * cw, y = (r + 0.5) * ch;
      if (x >= area.x && x <= area.x + area.w && y >= area.y && y <= area.y + area.h) {
        out.push({ row: r, col: c, x, y });
      }
    }
  }
  return out;
}

/**
 * 从识别结果里挑出作业范围内的「已确诊」网格。
 *
 * 口径与联动引擎一致：置信度 ≥ 0.75 才算确诊，
 * 否则只有空中视角的疑点，不能据此决定喷药。
 */
export function confirmedCellsInArea(dets, area, field, threshold = 0.75) {
  if (!area) return [];
  const cw = field.cellW, ch = field.cellH;
  const map = new Map();
  for (const d of dets || []) {
    if ((d.confidence ?? 0) < threshold) continue;
    const gx = d.geo?.x, gy = d.geo?.y;
    if (!Number.isFinite(gx) || !Number.isFinite(gy)) continue;
    if (gx < area.x || gx > area.x + area.w) continue;
    if (gy < area.y || gy > area.y + area.h) continue;
    const row = d.grid?.row ?? Math.floor(gy / ch);
    const col = d.grid?.col ?? Math.floor(gx / cw);
    const key = `${row}_${col}`;
    if (!map.has(key)) {
      map.set(key, { row, col, x: (col + 0.5) * cw, y: (row + 0.5) * ch, n: 0, diseases: {} });
    }
    const cell = map.get(key);
    cell.n += 1;
    cell.diseases[d.disease] = (cell.diseases[d.disease] || 0) + 1;
  }
  return [...map.values()].map(c => ({
    ...c,
    disease: Object.entries(c.diseases).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
  }));
}

/**
 * 疑点网格：置信度低于确诊阈值、但确有检出的格子。
 *
 * 这正是「近距复核」该去的地方 —— 空中看不清的疑点，
 * 地面机器人到了才能拍清楚。把整个作业范围都排进复核，
 * 480 格要跑 86 分钟，既没有作业价值，现场演示也等不了。
 */
export function suspectCellsInArea(dets, area, field, threshold = 0.75) {
  if (!area) return [];
  const cw = field.cellW, ch = field.cellH;
  const map = new Map();
  for (const d of dets || []) {
    const conf = d.confidence ?? 0;
    if (conf >= threshold) continue;          // 已确诊的不用复核
    const gx = d.geo?.x, gy = d.geo?.y;
    if (!Number.isFinite(gx) || !Number.isFinite(gy)) continue;
    if (gx < area.x || gx > area.x + area.w) continue;
    if (gy < area.y || gy > area.y + area.h) continue;
    const row = d.grid?.row ?? Math.floor(gy / ch);
    const col = d.grid?.col ?? Math.floor(gx / cw);
    const key = `${row}_${col}`;
    if (!map.has(key)) {
      map.set(key, { row, col, x: (col + 0.5) * cw, y: (row + 0.5) * ch, n: 0, minConf: 1, diseases: {} });
    }
    const cell = map.get(key);
    cell.n += 1;
    cell.minConf = Math.min(cell.minConf, conf);
    cell.diseases[d.disease] = (cell.diseases[d.disease] || 0) + 1;
  }
  return [...map.values()].map(c => ({
    ...c,
    disease: Object.entries(c.diseases).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
  }));
}

/* ================================================================
 * 五、作业计划构建
 * ================================================================ */

/**
 * 把「作业方式 + 作业范围 + 参数」翻译成一条可下发的作业单与一条可执行路径。
 *
 * 这是操控台与调度页共用的唯一入口 —— 页面里画的航线、页面里显示的药耗，
 * 与真正下发给设备执行的是同一份数据，不会出现「预览一套、下发另一套」。
 *
 * @param {object} p
 * @param {Field} p.field
 * @param {string} p.modeId            作业方式 id
 * @param {Array}  [p.detections]      用于靶向点 spray 的识别结果
 * @param {object} [p.area]            作业矩形 {x,y,w,h}
 * @param {string} [p.zoneId]          分区 id（spray_zone）
 * @param {string} [p.disease]
 * @param {string} [p.agent]
 * @param {number} [p.speedMs]
 * @param {number} [p.swathM]
 * @param {number} [p.doseLha]
 * @param {number} [p.headingDeg]
 * @param {string} [p.deviceId]
 * @returns {{ok:boolean, reason?:string, plan?:object}}
 */
export function buildOperationPlan({
  field, modeId, detections = [], area = null, zoneId = null,
  disease = null, agent = null, speedMs = 6, swathM = null, doseLha = 12,
  headingDeg = 90, deviceId = null, now = Date.now(),
}) {
  const mode = operationMode(modeId);
  if (!mode) return { ok: false, reason: `未知作业方式 ${modeId}` };

  const sw = swathM ?? mode.defaultSwathM ?? 1.0;
  const dose = doseLha ?? mode.defaultDoseLha ?? 12;
  const spd = speedMs ?? 6;

  /* ---------- 全田巡查 ---------- */
  if (mode.id === 'survey_full') {
    const route = generateSprayRoute(field, {
      mode: 'full', headingDeg, speedMs: spd, swathM: sw, targetDoseLha: dose,
    });
    const mission = {
      type: 'survey',
      disease: null,
      zoneId: null,
      zoneName: '全田',
      target: { grid: { row: 0, col: 0 }, cells: [], bbox: area ? { ...area } : null },
      spray: {},
      plan: {
        algo: '全田蛇形覆盖航线（相机有效覆盖 5 m）',
        length: route.totalLengthM,
        estMinutes: +((route.spraySeconds + route.turnSeconds) / 60).toFixed(2),
        estVolumeL: 0,
        ecoScore: null,
      },
      status: MISSION_STATUS.pending,
    };
    return {
      ok: true,
      plan: {
        mode, route, ratio: null, mission,
        path: route.points.map(p => ({ x: p.x, y: p.y, z: route.altM ?? 2.0 })),
        spray: null,
        targetCells: [],
        summary: {
          lengthM: round(route.totalLengthM, 1),
          minutes: round((route.spraySeconds + route.turnSeconds) / 60, 2),
          volumeL: 0,
          areaHa: round(route.coveredAreaHa, 3),
          cells: 0,
        },
      },
    };
  }

  /* ---------- 靶向点喷 ---------- */
  if (mode.id === 'spray_target') {
    const cells = confirmedCellsInArea(detections, area, field);
    if (!cells.length) {
      return {
        ok: false,
        reason: '所选作业范围内没有已确诊（置信度 ≥ 75%）的病灶网格，平台不会对疑点喷药。请先完成巡查或扩大范围。',
      };
    }
    const built = buildSprayMission({
      field,
      zoneId: zoneId || field.zoneOfGrid(cells[0].row, cells[0].col),
      headingDeg, speedMs: spd, swathM: sw, targetDoseLha: dose,
      disease: disease || cells[0].disease,
      cells: cells.map(c => ({ row: c.row, col: c.col })),
      agent: agent || defaultAgentFor(disease || cells[0].disease),
    });
    const mission = built.mission;
    mission.type = 'spray';
    mission.plan.algo = '靶向点喷 · 航向×速度×喷幅联合搜索';
    return {
      ok: true,
      plan: {
        mode, route: built.route, ratio: built.ratio, mission,
        path: sprayPathFromRoute(built.route),
        spray: {
          flow: built.ratio.requiredFlowLmin,
          swath: sw, dose, agent: mission.spray.agent,
          flowPerSpeed: built.ratio.flowPerSpeed,
          dutyCycle: built.ratio.dutyCycle,
          speedRange: built.ratio.speedRange,
        },
        targetCells: cells,
        summary: {
          lengthM: round(built.route.totalLengthM, 1),
          minutes: round(mission.plan.estMinutes, 2),
          volumeL: round(built.ratio.totalVolumeL, 2),
          areaHa: round(built.route.coveredAreaHa, 3),
          cells: cells.length,
          savedRatioVsZone: mission.plan.savedRatioVsZone,
        },
      },
    };
  }

  /* ---------- 分区施药 ---------- */
  if (mode.id === 'spray_zone') {
    if (!zoneId) return { ok: false, reason: '请先选择一个管理分区' };
    const zone = field.zones().find(z => z.id === zoneId);
    if (!zone) return { ok: false, reason: `未知管理分区 ${zoneId}` };
    const built = buildSprayMission({
      field, zoneId, headingDeg, speedMs: spd, swathM: sw, targetDoseLha: dose,
      disease: disease || 'rust', cells: [], agent: agent || defaultAgentFor(disease || 'rust'),
    });
    const mission = built.mission;
    mission.type = 'spray';
    mission.plan.algo = '分区整区连续喷洒 · 整机喷幅';
    return {
      ok: true,
      plan: {
        mode, route: built.route, ratio: built.ratio, mission,
        // 分区模式：喷洒带连续并排，但**头地转弯段不喷药**。
        // 与预览口径（sprayLengthM 只含喷洒段）保持一致，
        // 否则「预览 3 L、实耗 9.5 L」，现场对不上账。
        path: sprayPathFromRoute(built.route, { allBandsSpray: true }),
        spray: {
          flow: built.ratio.requiredFlowLmin,
          swath: sw, dose, agent: mission.spray.agent,
          flowPerSpeed: built.ratio.flowPerSpeed,
          dutyCycle: built.ratio.dutyCycle,
          speedRange: built.ratio.speedRange,
        },
        targetCells: [],
        summary: {
          lengthM: round(built.route.totalLengthM, 1),
          minutes: round(mission.plan.estMinutes, 2),
          volumeL: round(built.ratio.totalVolumeL, 2),
          areaHa: round(built.route.coveredAreaHa, 3),
          cells: 0,
          zoneName: zoneNameOf(zone),
        },
      },
    };
  }

  /* ---------- 近距复核 ---------- */
  if (mode.id === 'recheck_area') {
    // 复核的对象是「疑点格」——置信度不足以空中确诊的检出。
    // 若范围内没有疑点，说明空中已经能判读，无需地面复核。
    let cells = suspectCellsInArea(detections, area, field);
    if (!cells.length) {
      return {
        ok: false,
        reason: '所选作业范围内没有需要近距复核的疑点格。'
          + '疑点指空中识别置信度低于 75%、无法直接判读的检出点；'
          + '若要做全范围踏勘，请改用「全田巡查」。',
      };
    }
    // 疑点密度高时按置信度从低到高取前 N 个，保证一趟能跑完
    const RECHECK_LIMIT = 24;
    const truncated = cells.length > RECHECK_LIMIT;
    if (truncated) {
      cells = [...cells].sort((a, b) => a.minConf - b.minConf).slice(0, RECHECK_LIMIT);
    }
    // 逐点巡回：按行优先排序，路径短、转场少
    const sorted = [...cells].sort((a, b) => (a.row - b.row) || (a.col - b.col));
    const path = sorted.map(c => ({ x: c.x, y: c.y, z: 0 }));
    const totalLen = path.length > 1
      ? path.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - path[i].x, p.y - path[i].y), 0)
      : 0;
    const minutes = (totalLen / ROBOT_SPEED_MS + sorted.length * 3) / 60;
    const mission = {
      type: 'recheck',
      disease,
      zoneId: zoneId || field.zoneOfGrid(sorted[0].row, sorted[0].col),
      zoneName: zoneNameOf(field.zones().find(z => z.id === field.zoneOfGrid(sorted[0].row, sorted[0].col))),
      target: {
        grid: { row: sorted[0].row, col: sorted[0].col },
        cells: sorted.map(c => ({ row: c.row, col: c.col })),
        bbox: area ? { ...area } : null,
      },
      spray: {},
      plan: {
        algo: '近距复核 · 逐点巡回采集（叶下 / 根茎 / 土壤三工位）',
        length: round(totalLen, 1),
        estMinutes: +minutes.toFixed(2),
        estVolumeL: 0,
        targetCells: sorted.length,
      },
      status: MISSION_STATUS.pending,
      recheckParts: ['underside', 'stem', 'soil'],
    };
    return {
      ok: true,
      plan: {
        mode, route: null, ratio: null, mission,
        path,
        spray: null,
        targetCells: sorted,
        summary: {
          lengthM: round(totalLen, 1),
          minutes: round(minutes, 2),
          volumeL: 0,
          areaHa: round(sorted.length * field.cellAreaHa, 3),
          cells: sorted.length,
          truncated,
        },
      },
    };
  }

  return { ok: false, reason: `未实现的作业方式 ${modeId}` };
}

/* ================================================================
 * 六、执行运动学 —— 设备沿路径推进
 * ================================================================ */

/**
 * 把规划器航线转成带「本段是否喷洒」标记的路径。
 *
 * 关键：靶向点喷的航线里混着**簇间转场段**（从一个病灶簇飞到下一个簇），
 * 这段路不喷药。预览的药量按 sprayLengthM 算（只算喷洒段），
 * 如果执行时不分段就会把转场段也喷上，实际耗药会多出好几倍 ——
 * 于是「预览 0.63 L、实耗 1.85 L」，现场对不上账。
 *
 * 判据不能靠距离 —— 靶向模式下相邻喷洒带是「来回」排列的，
 * 从 (0.5,45) 到 (1.5,40) 的直线距离有 5.1 m，但它是并排喷同一个网格，
 * 属于喷洒段；真正的簇间转场可能只有几米，远距离反而少见。
 *
 * 可靠判据是**簇标识**：route.legs[].cluster 在 target 模式下给出，
 * 簇号变了才是转场。距离阈值只作兜底（cluster 缺失时用）。
 */
function sprayPathFromRoute(route, opts = {}) {
  const allBandsSpray = !!opts.allBandsSpray;
  const pts = route.points || [];
  const legs = route.legs || [];
  if (!legs.length || !pts.length) {
    return pts.map(p => ({ x: p.x, y: p.y, z: route.altM ?? 2.0, hdg: p.hdg, spray: false }));
  }
  // 每条 leg 覆盖 2 个路径点（start / end），即：
  //   段 (2k → 2k+1) 是这条喷洒带本身 —— 喷药
  //   段 (2k+1 → 2k+2) 是带到下一条带的转向段 —— 不喷药
  // 规划器的 sprayLengthM 只累加了前者，与路径的真实喷洒段一一对应。
  const perLeg = Math.max(1, Math.round(pts.length / legs.length));
  const hasCluster = legs.some(l => l.cluster !== undefined && l.cluster !== null);
  const transferThreshold = Math.max(2, (route.swathM || 1) * 3);

  return pts.map((p, i) => {
    const legIndex = Math.floor(i / perLeg);
    const leg = legs[legIndex];
    const offset = i % perLeg;
    // 只有「落在 leg 的终点」的那一段才是这条喷洒带：
    //   段 (2k → 2k+1)  = leg k 的喷洒带 —— 喷药
    //   段 (2k+1 → 2k+2) = 带到下一条带的转向段 —— 不喷药
    // 规划器的 sprayLengthM 只累加了前者，所以标记必须与之一一对应。
    let spray = !!(leg && leg.length > 0) && offset === perLeg - 1;
    if (spray && legIndex > 0 && !allBandsSpray) {
      const prev = legs[legIndex - 1];
      if (hasCluster && prev?.cluster !== undefined && leg.cluster !== undefined) {
        // 簇号变了 → 这条带属于另一个病灶簇，仍然喷（每个簇都要喷）
      } else if (prev?.to && leg.from) {
        const gap = Math.hypot(leg.from.x - prev.to.x, leg.from.y - prev.to.y);
        if (gap > transferThreshold) spray = false;
      }
    }
    return {
      x: p.x, y: p.y, z: route.altM ?? 2.0,
      hdg: p.hdg,
      spray,
    };
  });
}

/** 无人机默认起降点 */
export const UAV_HOME = { x: 10, y: 50 };
/** 机器人默认驻守点 */
export const ROBOT_HOME = { x: 5, y: 5 };
/**
 * 地面机器人巡航速度（m/s）。
 *
 * 单点取值，前后两处（计划预计时长、执行运动学）共用，
 * 避免出现「预计 13 分钟、实际跑 6 分钟」这种对不上的情况。
 */
export const ROBOT_SPEED_MS = 2.4;

/**
 * 推进一条指令的执行。
 *
 * 返回 { events }，事件由调用方（模拟器）转成遥测 / 识别 / 回执：
 *   { type:'capture', cell }  机器人到位完成一次近距采集
 *   { type:'done', result }    指令执行完毕
 *
 * 这里只管运动学与消耗（电、药、时间），不碰任何 I/O ——
 * 这样同一份代码能在 Node、Worker、浏览器里跑出完全一致的结果。
 *
 * @param {object} dev   设备当前状态 { x, y, z, hdg, spd, batt, state }
 * @param {object} order 指令执行体
 * @param {number} dt    本拍推进的秒数
 */
export function stepOrder(dev, order, dt) {
  const events = [];
  if (!order || order.phase === 'done') return { events, done: true };

  const isUav = order.deviceKind === 'uav';

  /* ---------- 起飞 ---------- */
  if (order.phase === 'takeoff') {
    const alt = order.altM ?? 2.0;
    dev.z = Math.min(alt, (dev.z || 0) + 1.2 * dt);
    dev.spd = 0;
    dev.state = 'takeoff';
    if (dev.z >= alt - 1e-6) {
      // 起飞是**持续状态**：升到作业高度后进入悬停待命，
      // 而不是接着走一条空航线再自动返航 ——
      // 之前「起飞」的效果是升空后立刻返航降落，设备又落回地面，
      // 界面显示「已完成」而现场什么也没发生。
      // 无人机没有作业航线时 → 悬停；机器人没有航线时 → 直接到位。
      order.phase = (order.path && order.path.length) ? 'transit' : 'hover';
      events.push({ type: 'phase', phase: order.phase });
    }
    return { events, done: false };
  }

  /* ---------- 悬停待命 ---------- */
  if (order.phase === 'hover') {
    dev.spd = 0;
    dev.state = 'surveying';
    dev.batt = Math.max(8, dev.batt - 0.008 * (dt / 0.2));
    // 悬停期间指令保持「执行中」，等待降落 / 返航 / 新作业指令接管
    return { events, done: false };
  }

  /* ---------- 作业中 / 转场中 ---------- */
  if (order.phase === 'transit' || order.phase === 'working' || order.phase === 'capture') {
    if (isUav) {
      const wp = order.path[order.progress];
      if (!wp) {
        order.phase = 'return';
        events.push({ type: 'phase', phase: 'return' });
        return { events, done: false };
      }
      const dx = wp.x - dev.x, dy = wp.y - dev.y;
      const d = Math.hypot(dx, dy);
      const stepLen = order.speedMs * dt;
      // 逐段决定是否喷洒：簇间转场段不喷（否则实际耗药远大于预览）
      const sprayOn = !!order.spray && wp.spray !== false;
      dev.state = sprayOn ? 'spraying' : 'surveying';
      if (d <= stepLen) {
        dev.x = wp.x; dev.y = wp.y;
        dev.z = wp.z ?? dev.z;
        dev.hdg = wp.hdg ?? dev.hdg;
        order.progress += 1;
        // 按**实际位移**累加，不是按本拍理论步长 ——
        // 到达路径点的那一拍可能只走了 d < stepLen，用 stepLen 会多记药量，
        // 误差随路径段数量线性放大（实测能差出一倍多）。
        if (sprayOn) accrueSpray(order, d);
        if (order.progress >= order.path.length) {
          order.phase = 'return';
          events.push({ type: 'phase', phase: 'return' });
        }
      } else {
        dev.x += (dx / d) * stepLen;
        dev.y += (dy / d) * stepLen;
        dev.hdg = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
        dev.spd = order.speedMs;
        if (sprayOn) accrueSpray(order, stepLen);
      }
      dev.batt = Math.max(8, dev.batt - (sprayOn ? 0.020 : 0.014) * (dt / 0.2));
      return { events, done: false };
    }

    /* ---------- 地面机器人 ---------- */
    const wp = order.path[order.progress];
    if (!wp) {
      order.phase = 'done';
      events.push({ type: 'done', result: finishOrder(order) });
      return { events, done: true };
    }
    const dx = wp.x - dev.x, dy = wp.y - dev.y;
    const d = Math.hypot(dx, dy);
    const stepLen = order.spdMs * dt;
    if (order.phase === 'capture') {
      dev.spd = 0;
      dev.state = 'rechecking';
      order.captureT = (order.captureT || 0) + dt;
      dev.batt = Math.max(8, dev.batt - 0.008 * (dt / 0.2));
      if (order.captureT >= (order.captureSeconds ?? 3)) {
        const cell = order.targetCells?.[order.progress] || null;
        order.progress += 1;
        order.phase = 'transit';
        events.push({ type: 'capture', cell });
        if (order.progress >= order.path.length) {
          order.phase = 'done';
          events.push({ type: 'done', result: finishOrder(order) });
        }
      }
      return { events, done: false };
    }
    dev.state = 'rechecking';
    if (d <= stepLen) {
      dev.x = wp.x; dev.y = wp.y;
      dev.spd = 0;
      order.phase = 'capture';
      order.captureT = 0;
    } else {
      dev.x += (dx / d) * stepLen;
      dev.y += (dy / d) * stepLen;
      dev.hdg = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
      dev.spd = order.spdMs;
    }
    dev.batt = Math.max(8, dev.batt - 0.010 * (dt / 0.2));
    return { events, done: false };
  }

  /* ---------- 返航 / 收尾 ---------- */
  if (order.phase === 'return') {
    const home = order.home || UAV_HOME;
    const dx = home.x - dev.x, dy = home.y - dev.y;
    const d = Math.hypot(dx, dy);
    const stepLen = order.speedMs * dt;
    if (d <= stepLen) {
      dev.x = home.x; dev.y = home.y;
      dev.z = 0; dev.spd = 0;
      dev.state = 'idle';
      order.phase = 'done';
      events.push({ type: 'done', result: finishOrder(order) });
      return { events, done: true };
    }
    dev.x += (dx / d) * stepLen;
    dev.y += (dy / d) * stepLen;
    dev.hdg = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
    dev.spd = order.speedMs;
    dev.state = 'returning';
    dev.batt = Math.max(8, dev.batt - 0.012 * (dt / 0.2));
    return { events, done: false };
  }

  return { events, done: false };
}

/**
 * 累加喷洒消耗。
 *
 * 口径必须与预览（solveSprayRatio）完全一致：
 *   单位面积药量 = 目标施药量(L/ha) / 10000 —— 只由喷幅与剂量决定，与速度无关；
 *   走过一段距离 d 的药量 = d × 喷幅 × 剂量/10000。
 *
 * 不用「流量 × 时间」推算：那是等价的，但一旦路径点的实际位移与理论步长
 * 不一致（到达点的那一拍只走了部分距离），累积误差会线性放大，
 * 实测能差出一倍多。这里直接按位移算，与预览同源同口径。
 */
function accrueSpray(order, distM) {
  if (!order.spray) return;
  const swath = order.spray.swath || 1;
  const dose = order.spray.dose || 12;
  const volumePerMeterL = swath * (dose / 10000);
  order.volumeL = (order.volumeL || 0) + distM * volumePerMeterL;
  order.sprayedAreaHa = (order.sprayedAreaHa || 0) + (distM * swath) / 10000;
  order.sprayDistanceM = (order.sprayDistanceM || 0) + distM;
}

/** 收尾：汇总一条指令的执行结果 */
function finishOrder(order) {
  const minutes = ((order.elapsedSec || 0)) / 60;
  return {
    volumeL: round(order.volumeL || 0, 2),
    sprayedAreaHa: round(order.sprayedAreaHa || 0, 3),
    sprayDistanceM: round(order.sprayDistanceM || 0, 1),
    points: order.targetCells?.length || 0,
    minutes: round(minutes, 2),
    distanceM: round(order.distanceM || 0, 1),
  };
}

/* ================================================================
 * 七、指令回执推进
 * ================================================================ */

/**
 * 把一次执行事件翻译成指令状态机的推进。
 *
 * 复用 shared/deviceaccess.js 的 applyCommandAck —— 状态机只有一份定义，
 * 平台「设备接入」页展示的指令状态与实际执行用的是同一套语义。
 *
 * @param {object} cmd   指令对象
 * @param {string} state 目标状态
 * @param {number} ts
 */
export function applyOrderAck(cmd, state, ts = Date.now()) {
  if (!cmd) return null;
  cmd.state = state;
  if (state === ORDER_STATE.acked && !cmd.ackedAt) cmd.ackedAt = ts;
  if (state === ORDER_STATE.done || state === ORDER_STATE.failed) cmd.doneAt = ts;
  cmd.latency = {
    dispatchMs: cmd.ackedAt ? cmd.ackedAt - cmd.issuedAt : null,
    totalMs: cmd.doneAt ? cmd.doneAt - cmd.issuedAt : null,
  };
  return cmd;
}

/* ================================================================
 * 八、辅助
 * ================================================================ */

/** 药剂默认值（与 shared/spraydispatch.js 的药剂表一致） */
function defaultAgentFor(disease) {
  const table = {
    rust: '戊唑醇·苯醚甲环唑',
    powdery: '三唑酮·戊唑醇',
    loose_smut: '井冈霉素·蜡芽菌',
    root_rot: '恶霉灵·甲基硫菌灵',
    fusarium: '戊唑醇·苯醚甲环唑',
    leaf_blight: '代森锰锌·多菌灵',
  };
  return table[disease] || table.rust;
}

function zoneNameOf(zone) {
  return zone ? `${zone.id} 区` : null;
}

function round(v, d = 2) {
  const p = Math.pow(10, d);
  return Math.round(v * p) / p;
}
