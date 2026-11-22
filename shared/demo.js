/**
 * 平台底座演示数据 —— 服务端与浏览器端共用
 *
 * 为什么要播：公网链接（GitHub Pages 纯静态）没有后端，
 * 评委点开「租户与权限 / 设备接入 / 计量结算」三页时，
 * 必须是"一个有内容、有数字的平台"，而不是三张空表格。
 *
 * 关键约束：这里的数字全部取自平台实测基线，不另造数 ——
 *   30 亩示范田、靶向点喷 0.57 L / 3.61 min / 19 个病灶格、
 *   整田 25.2 L、节约 24.6 L（97.7%）
 * 与申报材料和 PPT 的口径完全一致，不会出现两套数。
 */

import { ACCESS_STATES } from './deviceaccess.js';
import { priceUsage } from './metering.js';

const DAY = 86400000;

/** 演示租户 */
export const DEMO_TENANTS = [
  { id: 't-demo', name: '穗云智策平台运营方', type: 'platform' },
  { id: 't-coop', name: '唐山丰禾农业合作社', type: 'farm' },
  { id: 't-team', name: 'sky 低空作业服务队', type: 'team' },
  { id: 't-gov', name: '县农业农村局植保站', type: 'gov' },
];

/** 演示成员（覆盖五种角色，让权限矩阵有真实的人可切） */
export const DEMO_MEMBERS = [
  { userId: 'u-demo-admin', tenantId: 't-demo', name: '平台管理员', role: 'platform_admin' },
  { userId: 'u-wang', tenantId: 't-coop', name: '王建国（合作社社长）', role: 'farm_owner' },
  { userId: 'u-liu', tenantId: 't-team', name: '刘飞手（作业队长）', role: 'operator' },
  { userId: 'u-chen', tenantId: 't-coop', name: '陈技术员', role: 'agronomist' },
  { userId: 'u-gov', tenantId: 't-gov', name: '县植保站监管员', role: 'regulator' },
];

/** 演示接入设备（含第三方设备，用来证明平台不绑定自家硬件） */
export const DEMO_ACCESS_DEVICES = [
  { deviceId: 'UAV-01', tenantId: 't-demo', kind: 'uav', name: '植保无人机 · 麦田一号', model: '自研 X8' },
  { deviceId: 'ROB-01', tenantId: 't-demo', kind: 'robot', name: '地面监测机器人 · 麦田一号', model: '自研 R2' },
  { deviceId: 'UAV-EXT-01', tenantId: 't-coop', kind: 'uav', name: '合作方植保无人机 T50', model: 'DJI T50' },
  { deviceId: 'ROB-EXT-02', tenantId: 't-team', kind: 'robot', name: '作业队四驱巡检机器人', model: 'AT-4WD' },
];

/**
 * 演示用量记录 —— 数字取自平台实测基线
 * M1/M2 是 30 亩示范田的一次完整巡查 + 靶向施药
 */
export function demoUsageRecords(now = Date.now()) {
  return [
    // 本月：30 亩示范田的一次完整巡查 + 靶向施药（平台实测基线数字）
    { tenantId: 't-coop', missionId: 'M-DEMO-1', type: 'spray', areaMu: 30, volumeL: 0.57, minutes: 3.61, sorties: 1, detections: 19, savedL: 24.6, ts: now - DAY * 3 },
    { tenantId: 't-coop', missionId: 'M-DEMO-2', type: 'survey', areaMu: 30, volumeL: 0, minutes: 6.56, sorties: 1, detections: 0, savedL: 0, ts: now - DAY * 3 },
    // 上月：作业队承接的一块田（跨账期，体现按月出账）
    { tenantId: 't-team', missionId: 'M-DEMO-3', type: 'spray', areaMu: 45, volumeL: 0.88, minutes: 5.4, sorties: 1, detections: 26, savedL: 37.2, ts: now - DAY * 40 },
    { tenantId: 't-team', missionId: 'M-DEMO-4', type: 'survey', areaMu: 120, volumeL: 0, minutes: 26.2, sorties: 4, detections: 0, savedL: 0, ts: now - DAY * 40 },
  ];
}

/**
 * 把演示数据写入一个 store（Store 或 MemoryStore 均可）。
 *
 * @param {object} store  存储实现
 * @param {object} opts   { now, skipTenants }  skipTenants: 已存在租户时不重复写
 */
export function seedDemoPlatform(store, opts = {}) {
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
      ...d, ownerUserId: null, salt: 'demo-seed',
      accessState: ACCESS_STATES.active,
      registeredAt: now - DAY * 25, lastSeen: now, online: true,
    });
  }

  const existing = new Set((store.listUsage?.(null, 5000) || []).map(u => u.missionId));
  for (const u of demoUsageRecords(now)) {
    if (existing.has(u.missionId)) continue;
    const priced = priceUsage({
      sprayMu: u.type === 'survey' ? 0 : u.areaMu,
      surveyMu: u.type === 'survey' ? u.areaMu : 0,
      sorties: u.sorties, detections: u.detections, minutes: u.minutes,
    });
    store.insertUsage({ ...u, amount: priced.total });
  }
}
