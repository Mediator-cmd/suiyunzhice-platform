/**
 * 掌上端内核 —— 移动端田间作业模式
 *
 * PPT 与申报材料里写了「穗云智策掌上端 APP」，但早期平台没有这个端。
 * 低空经济赛道把重心移到平台后，三端联动必须有实物：
 *
 *   PC 端（调度台）—— 平台运营方 / 合作社：看全局、下发作业单
 *   掌上端（田间）—— 作业飞手 / 农户：接点位、拍照回传、异常提示
 *   公众号（服务）—— 农户：看病斑、拿处方、知道哪天能喷
 *
 * 这份内核定义掌上端与 PC 端之间真正的联动：
 *   1. 作业单从 PC 端下发，掌上端按 missionId 领取
 *   2. 掌上端回传点位证据，云端据此闭合联动事件
 *   3. 同一套 shared/ 判据在两端跑，口径不会分叉
 *
 * 关键：不做成"手机上能看的网页"，而是做成"田间真能用的作业工具"——
 * 大按钮、离线可用、弱网可补传、拍照回传有明确进度。
 */

/** 掌上端作业模式 */
export const FIELD_MODES = {
  dispatch: {
    key: 'dispatch',
    name: '接单',
    desc: '接收云端派发的作业单，确认后开始执行',
  },
  execute: {
    key: 'execute',
    name: '执行',
    desc: '按点位导航作业，到位拍照回传',
  },
  report: {
    key: 'report',
    name: '异常',
    desc: '上报现场异常：漏喷、设备故障、疑似漏诊',
  },
};

/** 点位状态机 */
export const POINT_STATES = {
  pending: '待作业',
  navigating: '前往中',
  arrived: '已到位',
  captured: '已拍照',
  confirmed: '已确认',
  skipped: '已跳过',
};

/**
 * 生成掌上端的作业清单。
 *
 * 输入是 PC 端下发的作业单，输出是按顺序排好的点位列表。
 * 每个点位带：网格坐标、作业类型、建议速度与喷幅、是否需拍照。
 */
export function buildFieldChecklist(mission, field) {
  if (!mission) return { points: [], meta: null };
  const cells = mission.target?.cells || [];
  const gridRows = field?.gridRows || 20;
  const gridCols = field?.gridCols || 40;
  const cellW = field?.cellW || 5;
  const cellH = field?.cellH || 5;

  const points = cells.map((c, i) => {
    const row = typeof c === 'object' ? c.row : c;
    const col = typeof c === 'object' ? c.col : c;
    return {
      index: i + 1,
      row, col,
      x: +((col + 0.5) * cellW).toFixed(1),
      y: +((row + 0.5) * cellH).toFixed(1),
      zone: field?.zoneOfGrid ? field.zoneOfGrid(row, col) : null,
      state: POINT_STATES.pending,
      needPhoto: true,        // 近距复核点必须拍照
      photoUrl: null,
      note: '',
    };
  });

  return {
    missionId: mission.missionId,
    type: mission.type,
    disease: mission.disease,
    spray: mission.spray || {},
    points,
    meta: {
      pointCount: points.length,
      gridRows, gridCols,
      // 估算步行距离：按网格相邻跳数
      estDistanceM: estimateWalk(points),
      // 田间作业预算：每点位 45 秒（到位 + 拍照 + 确认）
      estMinutes: +(points.length * 0.75).toFixed(1),
    },
  };
}

/** 估算点位间步行距离（曼哈顿距离） */
function estimateWalk(points) {
  let d = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    d += Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }
  return Math.round(d);
}

/**
 * 掌上端 → 云端的回传。
 *
 * 这里是「三端联动」真正的实现点：地面端回传证据，
 * 云端据此把此前派单的联动事件闭合。
 */
export function buildPointUpload(point, opts = {}) {
  const { deviceId = 'ROB-01', ts = Date.now() } = opts;
  return {
    detId: `P-${point.row}-${point.col}-${ts}`,
    ts,
    deviceId,
    kind: 'robot',
    part: opts.part || 'underside',   // 近距看叶下 / 根茎 / 土壤
    disease: opts.disease || null,
    confidence: opts.confidence ?? null,
    bbox: opts.bbox || null,
    geo: { x: point.x, y: point.y },
    grid: { row: point.row, col: point.col },
    model: opts.model || 'SAN-GAT-RL',
    imageUrl: opts.imageUrl || null,
    // 点位作业回执：与作业单关联
    missionId: opts.missionId || null,
    pointIndex: point.index,
  };
}

/**
 * 弱网补传队列。
 *
 * 田间信号差是常态，掌上端必须能离线攒帧、恢复后补传。
 * 这是与设备端同一套幂等思路，只是载体从无人机换成了手机。
 */
export class FieldOutbox {
  constructor() {
    this.queue = [];
    this.sent = 0;
  }

  /** 入队（离线也先收下） */
  enqueue(payload) {
    this.queue.push({ ...payload, queuedAt: Date.now() });
    return this.queue.length;
  }

  /** 恢复网络后按序补传 */
  flush(uploader) {
    const pending = this.queue.slice();
    let ok = 0;
    for (const item of pending) {
      try {
        uploader(item);
        ok += 1;
      } catch {
        break;   // 仍不通网就停下，剩下的留到下次
      }
    }
    this.queue = this.queue.slice(ok);
    this.sent += ok;
    return { sent: ok, remain: this.queue.length };
  }

  get pendingCount() { return this.queue.length; }
}

/**
 * 掌上端的田间可读性约束。
 *
 * 界面全部按这个规格做：户外强光下要能看清，按钮要能戴手套点。
 */
export const FIELD_UI_SPEC = {
  minTouchTargetPx: 48,
  minFontPx: 15,
  minButtonFontPx: 17,
  highContrast: true,        // 强光下深底浅字
  offlineFirst: true,        // 断网不白屏
  oneHandReach: true,        // 关键操作在屏幕下半区
};

/**
 * 三端职责与联动关系 —— 页面与申报材料共用
 */
export const THREE_TERMS = [
  {
    key: 'pc',
    name: 'PC 调度端',
    role: '平台运营方 / 合作社负责人',
    duty: '看全局态势、下发作业单、审批与结算',
    carries: '地块态势 · 联动事件 · 作业单 · 账单',
    links: '向掌上端派发作业单；接收掌上端回传的证据后闭合联动事件',
    color: 'var(--accent)',
  },
  {
    key: 'mobile',
    name: '掌上端',
    role: '作业飞手 / 植保技术员',
    duty: '接单、导航到点位、拍照回传、异常上报',
    carries: '作业清单 · 点位状态 · 现场影像 · 异常记录',
    links: '与 PC 端共用同一份作业单与判据；弱网先本地攒帧，恢复后幂等补传',
    color: 'var(--accent-2)',
  },
  {
    key: 'wechat',
    name: '公众号',
    role: '农户',
    duty: '看病斑、拿处方、知道哪天能喷',
    carries: '病害结论 · 药剂与剂量 · 安全间隔期 · 作业记录',
    links: '推送的是平台已确认的结论，与 PC 端、掌上端同源，不另算一套',
    color: 'var(--warn)',
  },
];

/**
 * 三端联动的完整时序 —— 平台"三端数据联动"的文字化实现
 */
export const THREE_TERM_FLOW = [
  { step: 'PC', action: '空地联动引擎判定需近地复核，生成作业单', ms: 0 },
  { step: 'PC', action: '作业单下发到掌上端（携带点位网格与喷洒参数）', ms: 120 },
  { step: '掌上端', action: '飞手接单，按网格导航到目标点位', ms: 1800 },
  { step: '掌上端', action: '到位拍照，图像与识别结果回传云端', ms: 900 },
  { step: 'PC', action: '云端融合空地证据完成确诊，生成靶向喷洒作业单', ms: 260 },
  { step: 'PC', action: '作业单下发无人机（携带速度-喷洒比例）', ms: 150 },
  { step: '公众号', action: '向农户推送「今天该做什么」的行动清单', ms: 400 },
];

/** 田间模式的核心交互检查清单（界面实现须逐条满足） */
export const FIELD_CHECKLIST = [
  '点位列表按网格顺序排列，可一键开始下一个点位',
  '每个点位显示网格坐标、分区编号与是否需拍照',
  '拍照回传有明确进度与失败重试，不静默失败',
  '弱网时提示"已离线缓存 N 帧"，恢复后自动补传',
  '异常上报三选一：漏喷 / 设备故障 / 疑似漏诊',
  '关键按钮在屏幕下半区，戴手套可点',
  '强光下深底浅字，最小字号 15 px',
];
