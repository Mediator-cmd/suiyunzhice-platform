/**
 * 计量与结算 —— 把「平台」变成可收费的服务
 *
 * 低空经济赛道的商业性提问很直接：平台靠什么赚钱？
 * 低空植保服务只有三种成熟的计费口径：
 *
 *   按亩计费  —— 农户最容易理解，也是政府补贴核验的口径
 *   按架次计费 —— 作业队与平台的结算口径（一次起降完成一块田 = 一架次）
 *   按识别次数 —— 识别与诊断服务量，用于纯软件增值
 *
 * 三种口径同时算出来，平台才能同时服务「付费农户」和「付费作业队」。
 *
 * 计价规则、费率表、账单生成全部放 shared/：
 * 服务端据此出账单，前端据此展示账单，两者永远一致。
 */

import { PLAN_OBJECTIVES } from './schema.js';

/** 计量单位 */
export const METER_UNITS = {
  mu: { name: '亩', desc: '按作业覆盖面积计量', decimals: 2 },
  muSpray: { name: '亩（施药）', desc: '实际施药覆盖面积，与巡查面积分开计', decimals: 2 },
  muSurvey: { name: '亩（巡查）', desc: '巡田作业面积，与施药面积分开计', decimals: 2 },
  sortie: { name: '架次', desc: '按一次起降完成的作业计量', decimals: 0 },
  detection: { name: '次', desc: '按病害识别/诊断次数计量', decimals: 0 },
  minute: { name: '分钟', desc: '按作业时长计量', decimals: 1 },
};

/** 平台服务价目表（元） */
export const PRICE_TABLE = {
  spray: {
    key: 'spray',
    name: '靶向施药作业服务',
    unit: 'muSpray',
    price: 12,          // 元/亩
    desc: '按实际施药覆盖面积计费，含路径规划、节药核算与作业单下发',
    optional: false,
  },
  survey: {
    key: 'survey',
    name: '空中巡查服务',
    unit: 'muSurvey',
    price: 3,           // 元/亩
    desc: '按巡田面积计费，含影像采集与病害初筛',
    optional: false,
  },
  diagnose: {
    key: 'diagnose',
    name: '病害诊断与处方',
    unit: 'detection',
    price: 0.8,         // 元/次
    desc: '按有效识别次数计费，含用药建议与安全间隔期',
    optional: true,
  },
  plan: {
    key: 'plan',
    name: '路径规划（按需调用）',
    unit: 'sortie',
    price: 20,          // 元/架次
    desc: '按规划架次计费，含经济/快速/环保三目标求解',
    optional: true,
  },
};

/**
 * 把一条作业单折算成可计量的用量。
 *
 * 注意：施药面积与巡查面积必须分开 —— 同一块田先巡查后施药，
 * 两条服务各自按自己的面积计一次，不能共用同一个"亩"数字，
 * 否则同一块地会被重复计费。
 *
 * @param {object} mission  作业单
 * @returns {object} 用量明细
 */
export function measureMission(mission) {
  const plan = mission?.plan || {};
  const type = mission?.type || 'spray';

  // 覆盖面积：优先用规划给出的目标面积，否则用分区面积
  const areaHa = plan.targetAreaHa ?? plan.zoneAreaHa ?? null;
  const areaMu = areaHa != null ? +(areaHa * 15).toFixed(2) : null;

  // 药液用量（节药率核算的输入）
  const volumeL = plan.estVolumeL ?? null;

  // 作业时长（分钟）
  const minutes = plan.estMinutes ?? null;

  // 架次：按规划航线长度估算（默认按 1 架次）
  const sorties = plan.length != null ? 1 : 0;

  return {
    missionId: mission?.missionId,
    type,
    areaHa, areaMu,
    volumeL: volumeL != null ? +Number(volumeL).toFixed(2) : null,
    minutes: minutes != null ? +Number(minutes).toFixed(1) : null,
    sorties,
    // 识别次数：一次作业单对应的复核点位数
    detections: Array.isArray(mission?.cells) ? mission.cells.length : 0,
    savedL: plan.savedVsZoneL ?? plan.savedVsUniformL ?? null,
    savedRatio: plan.savedRatioVsZone ?? null,
  };
}

/**
 * 按价目表算钱。
 *
 * @param {object} usage  聚合后的用量
 * @param {object} opts   { items: ['spray','diagnose',...] }  订阅的计费项
 * @returns {object} 费用明细
 */
export function priceUsage(usage, opts = {}) {
  const items = opts.items && opts.items.length
    ? opts.items
    : Object.keys(PRICE_TABLE).filter(k => !PRICE_TABLE[k].optional);

  const lines = [];
  for (const key of items) {
    const rule = PRICE_TABLE[key];
    if (!rule) continue;
    let qty = 0;
    switch (rule.unit) {
      // 施药与巡查按各自的面积计费，互不占用
      case 'muSpray': qty = usage.sprayMu || 0; break;
      case 'muSurvey': qty = usage.surveyMu || 0; break;
      case 'sortie': qty = usage.sorties || 0; break;
      case 'detection': qty = usage.detections || 0; break;
      case 'minute': qty = usage.minutes || 0; break;
      default: qty = 0;
    }
    const amount = +(qty * rule.price).toFixed(2);
    lines.push({
      key, name: rule.name, unit: rule.unit, unitName: METER_UNITS[rule.unit]?.name || rule.unit,
      price: rule.price, qty: +qty.toFixed(METER_UNITS[rule.unit]?.decimals ?? 2),
      amount,
      optional: !!rule.optional,
    });
  }
  const total = +lines.reduce((a, l) => a + l.amount, 0).toFixed(2);
  return { lines, total, currency: 'CNY' };
}

/**
 * 生成一份账单。
 *
 * 账期按「用量发生的月份」归集，而不是按出账当天 ——
 * 否则跨月作业会被错误地并进当前账期。
 *
 * @param {object} p { tenantId, tenantName, period: 'YYYY-MM', missions, items }
 */
export function buildInvoice({ tenantId, tenantName, period, missions = [], items = null }) {
  // 同一条作业单可能被上报多次（重试、批量补传），计费必须按作业单去重，
  // 否则同一笔作业会被收两次钱。
  const seen = new Set();
  const unique = missions.filter(m => {
    const key = m?.missionId;
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // 账期归集：按作业时间分月
  const byPeriod = new Map();
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
    // 面积按作业类型分流：施药面积与巡查面积各自累计
    if (u.type === 'survey') {
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
  }, { areaMu: 0, areaHa: 0, sprayMu: 0, sprayHa: 0, surveyMu: 0, surveyHa: 0,
       sorties: 0, detections: 0, minutes: 0, volumeL: 0, savedL: 0 });

  const priced = priceUsage(usage, { items });
  return {
    invoiceId: `INV-${tenantId}-${target}`,
    tenantId, tenantName, period: target,
    issuedAt: Date.now(),
    missionCount: scoped.length,
    availablePeriods: periods,
    usage,
    ...priced,
  };
}

/**
 * 按账期生成一组账单（每个账期一份）。
 * 平台侧「累计经营指标」用全部账期汇总，
 * 展示层按账期逐份列出 —— 与真实开票方式一致。
 */
export function buildInvoices({ tenantId, tenantName, missions = [], items = null }) {
  const seen = new Set();
  const unique = missions.filter(m => {
    const key = m?.missionId;
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const byPeriod = new Map();
  for (const m of unique) {
    const p = monthKey(m?.createdAt || m?.ts || Date.now());
    if (!byPeriod.has(p)) byPeriod.set(p, []);
    byPeriod.get(p).push(m);
  }
  return [...byPeriod.keys()].sort().map(p => buildInvoice({
    tenantId, tenantName, period: p, missions: byPeriod.get(p), items,
  }));
}

/** 时间戳 → 'YYYY-MM' 账期键 */
export function monthKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * 平台侧经营指标 —— 给投资人看的那一版。
 *
 * @param {Array} invoices  账单列表
 * @param {object} extra     { tenants, fields, devices, subscribers }
 */
export function platformMetrics(invoices = [], extra = {}) {
  const revenue = invoices.reduce((a, i) => a + (i.total || 0), 0);
  const sprayMu = invoices.reduce((a, i) => a + (i.usage?.sprayMu || 0), 0);
  const surveyMu = invoices.reduce((a, i) => a + (i.usage?.surveyMu || 0), 0);
  const areaMu = sprayMu + surveyMu;
  const savedL = invoices.reduce((a, i) => a + (i.usage?.savedL || 0), 0);
  const volumeL = invoices.reduce((a, i) => a + (i.usage?.volumeL || 0), 0);
  const sorties = invoices.reduce((a, i) => a + (i.usage?.sorties || 0), 0);
  const detections = invoices.reduce((a, i) => a + (i.usage?.detections || 0), 0);

  // 平台侧节约的药液成本：农户按整田喷洒要花钱，靶向省下的药就是农户省下的钱
  const drugSavedValue = +(savedL * 60).toFixed(2);   // 药剂成本按 60 元/L 估

  // 按账期汇总：平台经营是持续的，不是一笔成交
  const byPeriod = new Map();
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
    currency: 'CNY',
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
    monthlyRevenue: monthly.map(m => m.revenue),
    monthlyAreaMu: monthly.map(m => m.areaMu),
  };
}

/** 平台服务能力的商业化说明（用于"平台方案"页与申报材料） */
export const COMMERCIAL_MODEL = {
  tagline: '平台不卖设备，平台调度低空作业能力',
  lines: [
    {
      who: '农户 / 合作社',
      what: '按亩购买施药服务，系统自动生成处方与作业单',
      why: '看得见的节药账单：靶向点喷比整田喷洒少用 90%+ 药液',
    },
    {
      who: '作业队 / 飞手',
      what: '按架次承接作业单，平台派单、回执、结算一体化',
      why: '任务不靠电话派，接单即可开工，结算有据可查',
    },
    {
      who: '政府 / 合作社联社',
      what: '跨主体只读监管视图，补贴按实际作业面积核验',
      why: '作业面积与节药量来自同一套平台数据，可审计',
    },
  ],
  objectiveNote: `规划目标：${PLAN_OBJECTIVES.economy.name} / ${PLAN_OBJECTIVES.speed.name} / ${PLAN_OBJECTIVES.eco.name}`,
};
