/**
 * 多租户与角色权限 —— 平台从「单块示范田的演示系统」走向「可被接入的产品」的第一层底座
 *
 * 为什么必须有这一层：
 *   低空经济赛道的评委会问「你这个平台给谁用、谁能看什么、怎么收费」。
 *   没有租户与角色，任何「平台化」的说法都站不住。
 *   所以平台要能同时服务五类主体，而它们的可见范围完全不同：
 *
 *     平台运营方（我们）  —— 全部租户、全部地块、计费与审计
 *     农场主 / 合作社    —— 自己名下地块的全部数据、下发作业单
 *     作业队 / 飞手      —— 只看派给自己的任务与点位，执行与回执
 *     植保技术员 / 农户  —— 只看自己地块的结论与行动清单
 *     政府监管部门        —— 跨租户只读汇总与合规报表
 *
 * 关键设计：这一层是**纯逻辑**，不碰任何 Node 专有 API。
 * 服务端用它做接口鉴权，浏览器端用它做界面裁剪 —— 同一套判定，两端口径一致。
 * 纯静态部署（GitHub Pages）里没有登录态时，退化为「单租户演示身份」，
 * 平台仍然完整可用（这与 README 里"两种环境数字口径一致"的约定一致）。
 */

/** 租户类型 */
export const TENANT_TYPES = {
  platform: {
    name: '平台运营方',
    desc: '我们自己的运营主体，管理全部租户、计费与审计',
    color: 'green',
  },
  farm: {
    name: '农场 / 合作社',
    desc: '拥有地块、下达作业需求、按亩或按架次付费',
    color: 'blue',
  },
  team: {
    name: '作业队 / 服务商',
    desc: '承接作业单，按架次与亩数结算',
    color: 'amber',
  },
  gov: {
    name: '政府监管部门',
    desc: '跨主体只读汇总，用于监管与补贴核验',
    color: 'purple',
  },
};

/**
 * 角色与权限矩阵
 *
 * 权限用「资源.动作」表示，避免散落的 if 判断。
 * scope 决定可见范围：
 *   platform —— 全平台
 *   tenant   —— 本租户名下地块
 *   assigned —— 仅指派给自己的作业单与点位
 *   own      —— 仅自己名下地块
 */
export const PERMISSIONS = {
  'field.read': '查看地块与网格数据',
  'field.write': '登记与修改地块',
  'device.read': '查看设备与链路状态',
  'device.register': '注册设备并下发密钥',
  'device.revoke': '吊销设备密钥',
  'mission.read': '查看作业单',
  'mission.dispatch': '派发作业单',
  'mission.approve': '审批作业单',
  'mission.execute': '执行作业单并回执',
  'analytics.read': '查看多维统计',
  'briefing.read': '查看农户简报',
  'billing.read': '查看计量与账单',
  'user.manage': '管理成员与角色',
  'audit.read': '查看操作审计',
};

export const ROLES = {
  platform_admin: {
    name: '平台管理员',
    scope: 'platform',
    tenantType: 'platform',
    desc: '平台运营方，跨租户管理地块、设备、计费与成员',
    permissions: Object.keys(PERMISSIONS),
  },
  farm_owner: {
    name: '农场主 / 合作社负责人',
    scope: 'tenant',
    tenantType: 'farm',
    desc: '查看名下地块全部数据，派发作业单，审批与结算',
    permissions: [
      'field.read', 'field.write', 'device.read', 'device.register', 'device.revoke',
      'mission.read', 'mission.dispatch', 'mission.approve',
      'analytics.read', 'briefing.read', 'billing.read', 'user.manage',
    ],
  },
  operator: {
    name: '作业队操作员（飞手）',
    scope: 'assigned',
    tenantType: 'team',
    desc: '只接收派给自己的作业单，在田间执行并回传点位与结果',
    permissions: [
      'field.read', 'device.read', 'mission.read', 'mission.execute',
    ],
  },
  agronomist: {
    name: '植保技术员 / 农户',
    scope: 'own',
    tenantType: 'farm',
    desc: '只查看自己地块的病害结论与今日行动清单',
    permissions: [
      'field.read', 'analytics.read', 'briefing.read', 'mission.read',
    ],
  },
  regulator: {
    name: '政府监管员',
    scope: 'platform',
    tenantType: 'gov',
    desc: '跨主体只读汇总，用于监管核验与补贴统计',
    permissions: [
      'field.read', 'device.read', 'mission.read',
      'analytics.read', 'billing.read', 'audit.read',
    ],
  },
};

/** 演示身份：无后端时的默认身份，保证静态部署下平台功能完整 */
export const DEMO_IDENTITY = {
  userId: 'u-demo-admin',
  name: '演示账号',
  role: 'platform_admin',
  tenantId: 't-demo',
  tenantName: '穗云智策平台运营方',
  tenantType: 'platform',
  scope: 'platform',
};

/** 角色列表（供界面下拉） */
export function listRoles() {
  return Object.entries(ROLES).map(([key, r]) => ({
    key, name: r.name, scope: r.scope, desc: r.desc,
    tenantType: r.tenantType,
    permissions: r.permissions,
  }));
}

/** 角色是否有某权限 */
export function can(role, permission) {
  const r = ROLES[role];
  if (!r) return false;
  return r.permissions.includes(permission);
}

/** 批量判定 */
export function canAll(role, permissions) {
  return permissions.every(p => can(role, p));
}

/**
 * 计算用户可见的地块集合。
 *
 * @param {object} identity  { role, tenantId, fieldIds }
 * @param {Array}  fields    全部地块（每块带 tenantId / ownerUserId）
 * @returns {Array} 可见地块
 */
export function visibleFields(identity, fields) {
  if (!identity) return [];
  const scope = identity.scope || ROLES[identity.role]?.scope || 'platform';
  switch (scope) {
    case 'platform':
      return fields;
    case 'tenant':
      return fields.filter(f => f.tenantId === identity.tenantId);
    case 'own':
      return fields.filter(f =>
        f.tenantId === identity.tenantId &&
        (!identity.fieldIds || !identity.fieldIds.length || identity.fieldIds.includes(f.id)));
    case 'assigned':
      // 作业队看的是被指派的作业单所在地块，由任务侧反查；此处先给租户内全部
      return fields.filter(f => f.tenantId === identity.tenantId);
    default:
      return [];
  }
}

/** 界面级裁剪：返回该角色能看到的导航项 */
export function visibleNav(role, navItems) {
  const scoped = {
    overview: 'analytics.read',
    realtime: 'device.read',
    linkage: 'analytics.read',
    analytics: 'analytics.read',
    agro: 'briefing.read',
    planner: 'field.read',
    planning: 'field.read',
    farm: 'briefing.read',
    arch: 'field.read',
    tenancy: 'user.manage',
    access: 'device.register',
    metering: 'billing.read',
  };
  return navItems.filter(n => {
    const need = scoped[n.id];
    return !need || can(role, need);
  });
}

/**
 * 成员邀请 / 角色校验
 * 校验一个角色分配是否合法（不能把只读监管角色升为可下发作业）
 */
export function validateAssignment(actorRole, targetRole) {
  if (!ROLES[targetRole]) return { ok: false, reason: '未知角色' };
  if (!can(actorRole, 'user.manage')) return { ok: false, reason: '无成员管理权限' };
  if (actorRole === 'farm_owner' && targetRole === 'platform_admin') {
    return { ok: false, reason: '农场主不能授予平台管理员角色' };
  }
  return { ok: true };
}

/** 平台服务能力的对外说明（供"平台方案"页与申报材料引用） */
export const PLATFORM_SERVICES = [
  {
    key: 'multi-tenant',
    name: '多租户与权限',
    claim: '五类主体、五种角色、可见范围由平台统一裁决',
    proof: '角色权限矩阵 + 地块可见性过滤，前后端同一套 shared/ 判定',
  },
  {
    key: 'field-registry',
    name: '地块与作业单元',
    claim: '任意农场可注册地块、划网格、按分区组织作业',
    proof: '统一数据契约 + 分区管理 + 靶向网格选取',
  },
  {
    key: 'device-access',
    name: '设备接入与鉴权',
    claim: '第三方设备凭密钥接入，云端可吊销、可审计',
    proof: '设备注册流程 + API Key 签发与校验 + 遥测鉴权',
  },
  {
    key: 'metering',
    name: '计量与结算',
    claim: '按亩 / 按架次 / 按识别次数计量，账单可导出',
    proof: '用量记录与计价规则（shared/metering.js）',
  },
  {
    key: 'open-api',
    name: '开放接口',
    claim: 'REST + WebSocket 双向，设备开发者可自助接入',
    proof: '接口清单 + 遥测帧契约 + 指令下发回执',
  },
];
