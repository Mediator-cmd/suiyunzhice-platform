/**
 * 平台 API 定义 —— 运行时无关
 *
 * 本模块只依赖 MiniRouter（server/src/mini.js）的极小接口，
 * 不引用 Express、node:sqlite、ws 任何一个专有模块。
 * 因此同一份路由定义可以跑在：
 *   · 本机 Node 服务端（Express 适配层）  —— 局域网 / 自有服务器
 *   · Cloudflare Worker（Fetch 适配层）    —— 公网 Serverless
 *   · 浏览器（内存 Store）                  —— 纯静态部署时的降级演示
 *
 * 这样接口行为只有一份实现，不会出现「本机好使、云端字段不一样」的口径漂移。
 *
 * 依赖注入的运行时能力：
 *   store     —— 存储接口（三种实现同签名）
 *   broadcast —— 实时事件广播（Express 版走 WebSocket，Worker 版走 Durable Object）
 *   hub       —— 链路质量统计（提供 linkMetrics()）
 */

import {
  ROLES, TENANT_TYPES, PERMISSIONS, listRoles, can, canAll,
  visibleFields, visibleNav, validateAssignment, DEMO_IDENTITY,
  PLATFORM_SERVICES,
} from '../../shared/tenancy.js';
import {
  ACCESS_STATES, COMMAND_STATES, ACCESS_LEVELS,
  registerDevice, verifyApiKey, applyHeartbeat, sweepOffline,
  issueCommand, applyCommandAck, accessHealth,
} from '../../shared/deviceaccess.js';
import {
  PRICE_TABLE, METER_UNITS, measureMission, priceUsage,
  buildInvoice, buildInvoices, platformMetrics, COMMERCIAL_MODEL,
} from '../../shared/metering.js';
import {
  DISEASES, ANALYTICS_DIMENSIONS, DEVICE_STATES, PLAN_OBJECTIVES, SPRAY_RATIO_NOTE,
} from '../../shared/schema.js';
import {
  SPRAY_STRATEGIES, AGRO_CALENDAR, SPRAY_WINDOW_RULES,
  currentWeather, weatherForecast, windScale, strategyFor,
} from '../../shared/agronomy.js';
import {
  solveSprayRatio, generateSprayRoute, scoreRoute,
} from '../../shared/planner.js';
import { sprayFeasibilityReport } from '../../shared/droplets.js';
import { ONBOARDING_STEPS, CODE_SAMPLES } from '../../shared/openplatform.js';
import {
  FARMER_MSG_TYPES, buildFarmerMessage, toPushPayload, WECHAT_SERVICE, nonEmptyMessages,
} from '../../shared/farmer.js';
import {
  OPERATION_MODES, DIRECT_COMMANDS, COMMAND_TYPES,
  operationMode, directCommand, validateCommand,
  buildOperationPlan, cellsInArea, confirmedCellsInArea,
} from '../../shared/fleet.js';
import { swarmPlan } from '../../shared/swarm.js';
import {
  BENCHMARKS, benchmarkCatalog, benchmarkNotice,
} from '../../shared/benchmarks.js';

/**
 * 创建 API 路由表。
 *
 * @param {object} deps
 * @param {object} deps.store     存储接口
 * @param {object} deps.platform  平台实例（getPlan / meta / baselineReport）
 * @param {object} deps.analytics 统计实例
 * @param {object} deps.linkage   联动引擎（stats）
 * @param {object} deps.hub       链路质量统计（linkMetrics）
 * @param {function} deps.broadcast 实时广播
 * @param {object} deps.field     地块定义
 * @param {function} [deps.deliverCommand] 把指令交给设备执行层
 * @param {function} [deps.planOperation]  为作业方式指令计算航线（宿主实现）
 */
export function createApiRouter(deps) {
  const {
    store, platform, analytics, linkage, hub, broadcast, field: FIELD,
    deliverCommand = null, planOperation = null,
  } = deps;

  const api = deps.router;

  /* ================================================================
   * 平台底座 —— 身份解析与角色鉴权
   *
   * 身份通过 X-User-Id 头（或 ?user= 查询参数）解析。
   * 未提供或解析不到时，退化为演示身份（平台管理员），
   * 保证纯演示与未登录访问下平台功能完整。
   * 角色判定逻辑全部来自 shared/tenancy.js，前后端一致。
   * ================================================================ */

  function resolveIdentity(req) {
    const userId = req.get('X-User-Id') || req.query.user || null;
    if (userId) {
      const m = store.getMember(userId);
      if (m) {
        const role = ROLES[m.role] ? m.role : 'agronomist';
        const tenant = store.getTenant(m.tenantId);
        return {
          userId: m.userId, name: m.name, role,
          tenantId: m.tenantId,
          tenantName: tenant?.name || m.tenantId,
          tenantType: tenant?.type || ROLES[role].tenantType,
          scope: ROLES[role].scope,
          fieldIds: m.fieldIds || [],
          permissions: ROLES[role].permissions,
          demo: false,
        };
      }
      // 传了身份但查不到 —— 绝不降级为管理员，直接判定为未授权身份
      return {
        userId, name: '未知用户', role: '__none__',
        tenantId: null, tenantName: null, tenantType: null, scope: '__none__',
        fieldIds: [], permissions: [], demo: false, unknown: true,
      };
    }
    return { ...DEMO_IDENTITY, permissions: ROLES[DEMO_IDENTITY.role].permissions, demo: true };
  }

  /** 角色守卫：路由声明需要的权限，不满足直接 403 */
  function require_(permission) {
    return (req, res, next) => {
      const identity = resolveIdentity(req);
      if (identity.unknown) {
        return res.status(401).json({
          error: '身份不存在',
          message: `用户 ${identity.userId} 未登记，无法访问平台接口`,
        });
      }
      if (!can(identity.role, permission)) {
        return res.status(403).json({
          error: '权限不足',
          need: permission,
          role: identity.role,
          message: `当前角色「${ROLES[identity.role]?.name || identity.role}」没有「${PERMISSIONS[permission] || permission}」权限`,
        });
      }
      req.identity = identity;
      next();
    };
  }

  /**
   * 登录：按 userId 换取身份。
   *
   * 平台层刻意不做密码体系 —— 实名认证与口令由统一身份系统承接，
   * 平台只维护「主体 → 租户 → 角色 → 可见范围」的映射关系。
   * 这是平台与业务系统解耦的正确边界。
   */
  api.post('/tenancy/login', (req, res) => {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: '缺少 userId' });
    const m = store.getMember(userId);
    if (!m) return res.status(404).json({ error: '用户不存在或未获授权' });
    const role = ROLES[m.role] ? m.role : 'agronomist';
    const tenant = store.getTenant(m.tenantId);
    res.json({
      ok: true,
      token: `tok_${m.userId}_${Date.now().toString(36)}`,
      identity: {
        userId: m.userId, name: m.name, role,
        roleName: ROLES[role].name,
        tenantId: m.tenantId,
        tenantName: tenant?.name || m.tenantId,
        tenantType: tenant?.type || ROLES[role].tenantType,
        scope: ROLES[role].scope,
        fieldIds: m.fieldIds || [],
        permissions: ROLES[role].permissions,
      },
    });
  });

  /* ---- 底座：租户与成员 ---- */

  api.get('/tenancy/identity', (req, res) => {
    const identity = resolveIdentity(req);
    const fields = store.listFields();
    res.json({
      identity: { ...identity, permissions: undefined, permissionCount: identity.permissions.length },
      permissions: identity.permissions,
      roles: listRoles(),
      tenantTypes: TENANT_TYPES,
      visibleFieldIds: visibleFields(identity, fields).map(f => f.id),
    });
  });

  api.get('/tenancy/tenants', require_('user.manage'), (req, res) => {
    const members = store.listMembers();
    res.json({
      tenants: store.listTenants().map(t => ({
        ...t,
        members: members.filter(m => m.tenantId === t.id).length,
        fields: store.listFields().filter(f => f.tenantId === t.id).length,
      })),
    });
  });

  api.post('/tenancy/tenants', require_('user.manage'), (req, res) => {
    const b = req.body || {};
    if (!b.name) return res.status(400).json({ error: '缺少租户名称' });
    const identity = resolveIdentity(req);
    // 只有平台运营方能开租户；农场主建租户会被 user.manage 拦下，
    // 这里再兜一层，防止角色矩阵被误改后越权开租户
    if (identity.role !== 'platform_admin') {
      return res.status(403).json({ error: '仅平台运营方可创建租户' });
    }
    const id = b.id || `t-${Math.random().toString(36).slice(2, 8)}`;
    store.upsertTenant({
      id, name: b.name, type: b.type || 'farm',
      contact: b.contact || null, createdAt: Date.now(),
    });
    res.json({ ok: true, tenant: store.getTenant(id) });
  });

  api.get('/tenancy/members', require_('user.manage'), (req, res) => {
    res.json({ members: store.listMembers(req.query.tenantId || null) });
  });

  api.post('/tenancy/members', require_('user.manage'), (req, res) => {
    const b = req.body || {};
    const actor = resolveIdentity(req);
    const check = validateAssignment(actor.role, b.role);
    if (!check.ok) return res.status(400).json({ error: check.reason });
    if (!b.userId || !b.name || !b.tenantId) {
      return res.status(400).json({ error: '缺少 userId / name / tenantId' });
    }
    // 非平台管理员只能在自己租户内授权
    if (actor.scope !== 'platform' && b.tenantId !== actor.tenantId) {
      return res.status(403).json({ error: '无权管理其他租户的成员' });
    }
    store.upsertMember({
      userId: b.userId, tenantId: b.tenantId, name: b.name,
      role: b.role, fieldIds: b.fieldIds || [], createdAt: Date.now(),
    });
    res.json({ ok: true, member: store.getMember(b.userId) });
  });

  /* ---- 底座：地块登记（多农场接入） ---- */

  api.get('/fields', (req, res) => {
    const identity = resolveIdentity(req);
    const all = store.listFields();
    const visible = visibleFields(identity, all);
    const ids = new Set(visible.map(f => f.id));
    res.json({
      fields: visible,
      total: all.length,
      visibleCount: visible.length,
      // 演示身份下能看到全部租户分布，用于展示「多农场接入」能力
      tenantDistribution: identity.scope === 'platform'
        ? all.reduce((acc, f) => {
          const k = f.tenantId || '未分配';
          acc[k] = (acc[k] || 0) + 1;
          return acc;
        }, {})
        : undefined,
    });
  });

  api.post('/fields', require_('field.write'), (req, res) => {
    const b = req.body || {};
    if (!b.name || !b.widthM || !b.heightM) {
      return res.status(400).json({ error: '缺少 name / widthM / heightM' });
    }
    const identity = resolveIdentity(req);
    // 地块归属：非平台管理员只能登记到自己名下租户
    const tenantId = identity.scope === 'platform' ? (b.tenantId || identity.tenantId) : identity.tenantId;
    if (b.tenantId && identity.scope !== 'platform' && b.tenantId !== identity.tenantId) {
      return res.status(403).json({ error: '无权为其他租户登记地块' });
    }
    const id = b.id || `FLD-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    const f = {
      id, name: b.name, widthM: Number(b.widthM), heightM: Number(b.heightM),
      gridRows: Number(b.gridRows || 20), gridCols: Number(b.gridCols || 40),
      obstacles: b.obstacles || [],
      tenantId,
      ownerUserId: b.ownerUserId || identity.userId,
    };
    store.upsertField({ ...f, areaHa: (f.widthM * f.heightM) / 10000 });
    res.json({ ok: true, field: store.getField(id) });
  });

  /* ---- 底座：设备接入与鉴权 ---- */

  api.get('/access/devices', require_('device.read'), (req, res) => {
    const identity = resolveIdentity(req);
    const all = store.listDeviceAccess();
    const list = identity.scope === 'platform' ? all : all.filter(d => d.tenantId === identity.tenantId);
    const metrics = new Map(hub.linkMetrics().map(m => [m.deviceId, m]));
    const cmds = store.listCommands(null, 1000);
    res.json({
      devices: list.map(d => ({
        ...d,
        health: accessHealth(d, metrics.get(d.deviceId), cmds.filter(c => c.deviceId === d.deviceId)),
      })),
      states: ACCESS_STATES,
      levels: ACCESS_LEVELS,
    });
  });

  api.post('/access/devices/register', require_('device.register'), (req, res) => {
    const b = req.body || {};
    const identity = resolveIdentity(req);
    const existing = store.getDeviceAccess(b.deviceId);
    const r = registerDevice({
      deviceId: b.deviceId, name: b.name, kind: b.kind,
      model: b.model, tenantId: b.tenantId || identity.tenantId,
      ownerUserId: identity.userId,
    }, existing);
    if (!r.ok) return res.status(400).json({ error: r.reason });
    store.upsertDeviceAccess({ ...r.device, salt: r.salt });
    // 同时登记到设备表，实时监控页立刻可见
    store.upsertDevice({
      deviceId: r.device.deviceId, kind: r.device.kind, name: r.device.name,
      state: DEVICE_STATES.OFFLINE, pos: { x: 0, y: 0, z: 0 },
      batt: 100, coverage: 0, lastSeen: Date.now(),
    });
    res.json({
      ok: true, device: store.getDeviceAccess(r.device.deviceId),
      // 密钥只在签发时返回一次，服务端只存盐
      apiKey: r.apiKey,
      notice: 'API Key 仅显示一次，请立即交给设备开发者妥善保存',
    });
  });

  api.post('/access/devices/:id/revoke', require_('device.revoke'), (req, res) => {
    const identity = resolveIdentity(req);
    const access = store.getDeviceAccess(req.params.id);
    if (!access) return res.status(404).json({ error: '设备未登记' });
    // 租户级操作必须校验归属：非平台管理员只能管理自己租户的设备
    if (identity.scope !== 'platform' && access.tenantId !== identity.tenantId) {
      return res.status(403).json({ error: '无权管理其他租户的设备' });
    }
    store.setDeviceAccessState(req.params.id, ACCESS_STATES.revoked);
    res.json({ ok: true, device: store.getDeviceAccess(req.params.id) });
  });

  api.post('/access/devices/:id/restore', require_('device.revoke'), (req, res) => {
    const identity = resolveIdentity(req);
    const access = store.getDeviceAccess(req.params.id);
    if (!access) return res.status(404).json({ error: '设备未登记' });
    if (identity.scope !== 'platform' && access.tenantId !== identity.tenantId) {
      return res.status(403).json({ error: '无权管理其他租户的设备' });
    }
    store.setDeviceAccessState(req.params.id, ACCESS_STATES.active);
    res.json({ ok: true, device: store.getDeviceAccess(req.params.id) });
  });

  /* ---- 底座：指令下发与回执 ---- */

  api.get('/access/commands', require_('device.read'), (req, res) => {
    res.json({ commands: store.listCommands(req.query.deviceId || null, 200), states: COMMAND_STATES });
  });

  api.post('/access/commands', require_('mission.dispatch'), (req, res) => {
    const b = req.body || {};
    const r = issueCommand({
      deviceId: b.deviceId, type: b.type,
      payload: b.payload || {}, missionId: b.missionId || null,
    });
    if (!r.ok) return res.status(400).json({ error: r.reason });
    const identity = resolveIdentity(req);
    const cmd = { ...r.command, tenantId: identity.tenantId };
    store.insertCommand(cmd);
    broadcast('command', cmd);
    res.json({ ok: true, command: cmd });
  });

  api.post('/access/commands/:id/ack', (req, res) => {
    const state = req.body?.state || COMMAND_STATES.acked;
    const cmds = store.listCommands(null, 1000);
    const cmd = cmds.find(c => c.commandId === req.params.id);
    if (!cmd) return res.status(404).json({ error: '指令不存在' });
    const updated = applyCommandAck(cmd, state, Date.now());
    store.insertCommand(updated);
    broadcast('commandStatus', updated);
    res.json({ ok: true, command: updated });
  });

  /* ---- 底座：计量与结算 ---- */

  api.get('/metering/price', (req, res) => {
    res.json({
      table: PRICE_TABLE, units: METER_UNITS, model: COMMERCIAL_MODEL,
    });
  });

  api.get('/metering/usage', require_('billing.read'), (req, res) => {
    const identity = resolveIdentity(req);
    const tenantId = req.query.tenantId || (identity.scope === 'platform' ? null : identity.tenantId);
    res.json({ usage: store.listUsage(tenantId, 500) });
  });

  api.get('/metering/invoices', require_('billing.read'), (req, res) => {
    const identity = resolveIdentity(req);
    const tenants = identity.scope === 'platform'
      ? store.listTenants()
      : store.listTenants().filter(t => t.id === identity.tenantId);
    const invoices = tenants.flatMap(t => buildInvoices({
      tenantId: t.id, tenantName: t.name,
      missions: missionsForInvoice(store, t.id),
    }));
    // 没有计量记录的租户不出现在账单里 —— 空账单只会让页面上多出 0 元行，
    // 对外展示时没有意义
    res.json({ invoices: invoices.filter(i => i.missionCount > 0) });
  });

  /**
   * 取参与计费的作业单。
   *
   * 计量有两个来源，必须都算进去，否则账单会漏：
   *   1. usage_records 表 —— 通过 /api/metering/usage 上报或作业完成时落库的用量
   *   2. missions 表 —— 状态为 done 且已带完整用量字段的作业单
   * 两者按 missionId 去重：同一条作业单优先取用量记录（它是结算口径的权威来源）。
   */
  function missionsForInvoice(store, tenantId) {
    const usageRows = store.listUsage(tenantId, 5000);
    const byMission = new Map();
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
          savedVsZoneL: u.savedL,
        },
        cells: Array.from({ length: u.detections || 0 }, (_, i) => i),
        status: 'done',
        tenantId,
      });
    }
    // 作业单里有用量但没有用量记录的（历史数据），补进来
    for (const m of store.listMissions(5000)) {
      if (m.tenantId !== tenantId) continue;
      if (m.status !== 'done') continue;
      if (byMission.has(m.missionId)) continue;
      const plan = m.plan || {};
      if (plan.estVolumeL == null && plan.targetAreaHa == null) continue;
      byMission.set(m.missionId, { ...m, tenantId });
    }
    return [...byMission.values()];
  }

  api.get('/metering/metrics', require_('billing.read'), (req, res) => {
    const identity = resolveIdentity(req);
    const tenants = identity.scope === 'platform' ? store.listTenants() : store.listTenants().filter(t => t.id === identity.tenantId);
    const invoices = tenants.flatMap(t => buildInvoices({
      tenantId: t.id, tenantName: t.name,
      missions: missionsForInvoice(store, t.id),
    })).filter(i => i.missionCount > 0);
    res.json({
      metrics: platformMetrics(invoices, {
        tenants: store.listTenants().length,
        fields: store.listFields().length,
        devices: store.listDeviceAccess().length,
        subscribers: store.listMembers().length,
      }),
      invoices,
    });
  });

  /* ---- 平台服务能力说明（对外统一出口） ---- */
  api.get('/platform/services', (req, res) => {
    res.json({
      services: PLATFORM_SERVICES,
      roles: listRoles(),
      tenantTypes: TENANT_TYPES,
      commercialModel: COMMERCIAL_MODEL,
    });
  });

  /* ---- 农户服务：公众号 / 小程序推送内容 ---- */
  api.get('/farmer/messages', (req, res) => {
    const dets = store.listDetections(200);
    const confirmed = dets.filter(d => d.confidence >= 0.75);
    const latest = confirmed[0] || dets[0] || null;
    const missions = store.listMissions(200);
    const doneSpray = missions.find(m => m.type === 'spray' && m.status === 'done');
    const briefing = analytics.farmerBriefing();

    const msgs = [
      buildFarmerMessage({ type: 'diagnosis', detection: latest }),
      buildFarmerMessage({ type: 'window' }),
      buildFarmerMessage({ type: 'action', briefing }),
      buildFarmerMessage({ type: 'report', mission: doneSpray }),
    ];

    res.json({
      types: FARMER_MSG_TYPES,
      service: WECHAT_SERVICE,
      messages: nonEmptyMessages(msgs).map(m => toPushPayload(m)),
    });
  });

  /* ---- 开发者门户：接入现状与接入清单 ---- */
  api.get('/openapi/stats', (req, res) => {
    const devices = store.listDeviceAccess();
    const cmds = store.listCommands(null, 1000);
    const tenants = store.listTenants();
    res.json({
      // 已接入主体数
      tenants: tenants.length,
      // 已接入设备数（按第三方 / 自有区分）
      devices: devices.length,
      thirdParty: devices.filter(d => d.tenantId !== 't-demo').length,
      own: devices.filter(d => d.tenantId === 't-demo').length,
      // 已签发密钥数
      keysIssued: devices.length,
      // 指令闭环率
      commands: cmds.length,
      commandsDone: cmds.filter(c => c.state === COMMAND_STATES.done).length,
      // 接口总数（与「平台方案」页的接口清单同源）
      endpointCount: 55,
      // 数据契约种类
      contracts: ['遥测帧 TELEMETRY', '识别结果 DETECTION', '作业任务 MISSION', '联动事件 LINK_EVENT'],
      steps: ONBOARDING_STEPS.length,
      samples: CODE_SAMPLES.map(s => s.key),
    });
  });

  /* ================================================================
   * 装备操控 —— 让平台从「只能看」变成「能操控」
   *
   * 这一组接口是老师要的「平台真正可操控可使用」的落点：
   *   · /fleet/modes        作业方式与直接指令目录（前端渲染按钮用）
   *   · /fleet/plan         作业方式 + 作业范围 → 航线预览（不下发）
   *   · /fleet/command      下发指令 → 设备真的执行 → 回执推进
   *   · /fleet/status       装备台：每台设备的状态、当前指令、执行历史
   *
   * 关键：下发指令不是「记一条日志」，而是真的交给设备执行层
   * （deps.deliverCommand），设备按航线飞、拍、回传，链路才闭合。
   * ================================================================ */

  api.get('/fleet/modes', (req, res) => {
    res.json({
      modes: OPERATION_MODES,
      directCommands: DIRECT_COMMANDS,
      types: COMMAND_TYPES,
    });
  });

  /**
   * 作业范围预览：把「作业方式 + 范围」翻译成航线与作业单。
   * 只算不下发 —— 前端用它画航线预览，用户确认后再调 /fleet/command。
   */
  api.post('/fleet/plan', (req, res) => {
    const b = req.body || {};
    const modeId = b.modeId || b.mode;
    const mode = operationMode(modeId);
    if (!mode) return res.status(400).json({ error: `未知作业方式 ${modeId}` });

    const area = b.area || null;
    // 靶向点喷要读识别结果来挑确诊网格
    const dets = mode.id === 'spray_target'
      ? store.listDetections(Number(b.detectionLimit || 2000))
      : [];

    const built = buildOperationPlan({
      field: FIELD,
      modeId,
      detections: dets,
      area,
      zoneId: b.zoneId || null,
      disease: b.disease || null,
      agent: b.agent || null,
      speedMs: Number(b.speedMs || 6),
      swathM: b.swathM != null ? Number(b.swathM) : null,
      doseLha: b.doseLha != null ? Number(b.doseLha) : null,
      headingDeg: Number(b.headingDeg || 90),
      deviceId: b.deviceId || null,
    });
    if (!built.ok) return res.status(400).json({ error: built.reason });

    const plan = built.plan;
    res.json({
      mode: plan.mode,
      // 航线路径：前端画线用（点数可能很多，截断避免响应过大）
      path: plan.path.slice(0, 6000),
      pathTotal: plan.path.length,
      targetCells: plan.targetCells,
      spray: plan.spray,
      summary: plan.summary,
      ratio: plan.ratio
        ? {
            requiredFlowLmin: plan.ratio.requiredFlowLmin,
            dutyCycle: plan.ratio.dutyCycle,
            flowPerSpeed: plan.ratio.flowPerSpeed,
            speedRange: plan.ratio.speedRange,
            feasible: plan.ratio.feasible,
            totalVolumeL: plan.ratio.totalVolumeL,
          }
        : null,
      // 预览用的作业单（不下发时只回显）
      mission: plan.mission,
    });
  });

  /**
   * 下发指令。
   *
   * 这是整个操控链路的入口：
   *   校验指令类型 → 建指令 → 落库 → 交给设备执行层 → 广播
   * 执行层会随后产生回执（设备已接收 / 执行中 / 已完成），
   * 回执由 /access/commands/:id/ack 之外的路���推送。
   */
  api.post('/fleet/command', require_('mission.dispatch'), (req, res) => {
    const b = req.body || {};
    const deviceId = b.deviceId;
    if (!deviceId) return res.status(400).json({ error: '缺少 deviceId' });

    // 设备必须已登记接入（与「设备接入」页的口径一致）
    const access = store.getDeviceAccess(deviceId);
    const device = store.listDevices().find(d => d.deviceId === deviceId);
    const kind = device?.kind || access?.kind;
    if (!kind) return res.status(404).json({ error: `设备 ${deviceId} 未登记` });

    const check = validateCommand({ type: b.type, deviceId, deviceKind: kind });
    if (!check.ok) return res.status(400).json({ error: check.reason });

    const identity = resolveIdentity(req);
    const cmd = {
      commandId: `C-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      deviceId,
      tenantId: identity.tenantId,
      type: b.type,
      missionId: b.missionId || null,
      payload: b.payload || {},
      state: COMMAND_STATES.issued,
      issuedAt: Date.now(),
      ackedAt: null,
      doneAt: null,
    };

    // 作业方式指令：先算航线，算不出来就不下发
    let plan = null;
    const mode = operationMode(b.type);
    if (mode) {
      const dets = mode.id === 'spray_target'
        ? store.listDetections(Number(b.detectionLimit || 2000))
        : [];
      const built = buildOperationPlan({
        field: FIELD,
        modeId: b.type,
        detections: dets,
        area: b.area || null,
        zoneId: b.zoneId || null,
        disease: b.disease || null,
        agent: b.agent || null,
        speedMs: Number(b.speedMs || 6),
        swathM: b.swathM != null ? Number(b.swathM) : null,
        doseLha: b.doseLha != null ? Number(b.doseLha) : null,
        headingDeg: Number(b.headingDeg || 90),
        deviceId,
      });
      if (!built.ok) return res.status(400).json({ error: built.reason });
      plan = built.plan;
      // 作业单先落库（待下发 → 执行中由执行层推进）
      const mission = {
        ...plan.mission,
        missionId: cmd.missionId || `M-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        createdAt: Date.now(),
        status: 'pending',
        deviceId,
        operationMode: b.type,
      };
      cmd.missionId = mission.missionId;
      store.insertMission(mission);
      broadcast('mission', mission);
    }

    store.insertCommand(cmd);
    broadcast('command', cmd);

    // 交给设备执行层：指令真的会执行
    if (deliverCommand) {
      try {
        const r = deliverCommand(cmd, plan);
        if (r && r.ok === false) {
          return res.status(400).json({ error: r.reason || '指令下发失败' });
        }
      } catch (e) {
        return res.status(500).json({ error: `指令下发异常：${e.message}` });
      }
    }

    res.json({ ok: true, command: cmd, plan: plan ? plan.summary : null });
  });

  /** 装备台状态：设备、当前指令、执行历史 */
  api.get('/fleet/status', (req, res) => {
    const devices = store.listDevices();
    const cmds = store.listCommands(null, 200);
    const active = new Map();
    for (const c of cmds) {
      // 取每台设备最新的一条未终结指令
      if (c.state === COMMAND_STATES.done || c.state === COMMAND_STATES.failed) continue;
      const prev = active.get(c.deviceId);
      if (!prev || c.issuedAt > prev.issuedAt) active.set(c.deviceId, c);
    }
    res.json({
      devices,
      active: [...active.values()],
      recent: cmds.slice(0, 40),
      states: COMMAND_STATES,
      speed: deps.execSpeed ? deps.execSpeed() : 1,
    });
  });

  /**
   * 演示加速档位。
   *
   * 一趟靶向点喷要飞十几分钟，评审现场不能干等。
   * 加速的是墙钟等待 —— 电量、药耗、里程仍按真实经过的仿真时间计算。
   */
  api.post('/fleet/speed', (req, res) => {
    if (!deps.setExecSpeed) return res.json({ error: '当前运行时不支持加速' }, 400);
    const r = deps.setExecSpeed(Number(req.body?.factor ?? 1));
    if (!r.ok) return res.json({ error: r.reason }, 400);
    res.json(r);
  });

  api.get('/meta', (req, res) => res.json(platform.meta()));

  api.get('/devices', (req, res) => res.json(store.listDevices()));
  api.get('/devices/telemetry', (req, res) =>
    res.json(store.recentTelemetry(Number(req.query.limit || 300), req.query.deviceId || null)));
  api.get('/link/metrics', (req, res) => res.json(hub.linkMetrics()));
  api.get('/detections', (req, res) =>
    res.json(store.listDetections(Number(req.query.limit || 300))));
  api.get('/missions', (req, res) => res.json(store.listMissions(Number(req.query.limit || 200))));
  api.get('/linkage/events', (req, res) => res.json({
    events: store.listLinkEvents(Number(req.query.limit || 100)),
    stats: linkage.stats(),
  }));
  api.get('/analytics/overview', (req, res) => res.json(analytics.overview()));
  api.get('/analytics/:dim', (req, res) => res.json(analytics.byDimension(req.params.dim, req.query)));
  api.get('/briefing', (req, res) => res.json(analytics.farmerBriefing()));

  /* ---- 农情：气象实况 / 施药窗口 / 三日预报 / 施药策略库 ---- */
  api.get('/weather', (req, res) => res.json({
    ...currentWeather(),
    forecast: weatherForecast(),
    windScale: windScale(currentWeather().wind),
  }));

  api.get('/strategies', (req, res) => res.json({
    strategies: SPRAY_STRATEGIES,
    calendar: AGRO_CALENDAR,
    windowRules: SPRAY_WINDOW_RULES,
  }));

  api.get('/strategies/:disease', (req, res) => {
    const s = strategyFor(String(req.params.disease));
    if (!s) return res.status(404).json({ error: '未匹配的病种策略' });
    res.json(s);
  });

  // 申报书实测基准场景：一次返回申报材料引用的全部数字
  api.get('/baseline', (req, res) => res.json(platform.baselineReport()));

  api.get('/plan', (req, res) => {
    const opts = {};
    if (req.query.weights) {
      const [e, s, ec] = String(req.query.weights).split(',').map(Number);
      opts.weights = { economy: e, speed: s, eco: ec };
    }
    if (req.query.swath) opts.swaths = [Number(req.query.swath)];
    if (req.query.mode) opts.mode = String(req.query.mode);
    if (req.query.dose) opts.targetDoseLha = Number(req.query.dose);
    res.json(platform.getPlan(opts));
  });

  api.post('/plan/ratio', (req, res) => {
    const {
      speedMs = 6, swathM = 1.0, targetDoseLha = 12,
      nozzleCount = 4, nozzleFlowLmin = 4.0,
    } = req.body || {};
    const plan = platform.getPlan().best;
    res.json(solveSprayRatio(plan.route, { speedMs, swathM, targetDoseLha, nozzleCount, nozzleFlowLmin }));
  });

  api.post('/plan/simulate', (req, res) => {
    const {
      headingDeg = 90, speedMs = 4.5, swathM = 5.0, turnRadiusM = 4.0,
      mode = 'full', targetDoseLha = 12,
    } = req.body || {};
    const route = generateSprayRoute(FIELD, { headingDeg, speedMs, swathM, turnRadiusM, mode, targetDoseLha });
    const ratio = solveSprayRatio(route, { speedMs, swathM, targetDoseLha });
    res.json({
      route: { ...route, points: route.points.slice(0, 4000) },
      ratio,
      score: scoreRoute(route, ratio),
    });
  });

  api.post('/missions', (req, res) => {
    const body = req.body || {};
    const mission = {
      missionId: `M-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      createdAt: Date.now(),
      type: body.type || 'spray',
      target: body.target || { grid: { row: 0, col: 0 }, cells: [] },
      disease: body.disease || null,
      spray: body.spray || {},
      plan: body.plan || {},
      status: 'pending',
    };
    store.insertMission(mission);
    broadcast('mission', mission);
    res.json(mission);
  });

  api.post('/missions/:id/status', (req, res) => {
    const status = req.body?.status || 'done';
    store.updateMissionStatus(req.params.id, status);
    broadcast('missionStatus', { missionId: req.params.id, status });
    res.json({ ok: true });
  });

  // 弱网批量补传
  api.post('/ingest/batch', (req, res) => {
    const { telemetry = [], detections = [] } = req.body || {};
    // 已登记设备必须通过密钥校验；未登记设备允许首次自助接入
    const first = telemetry[0] || detections[0];
    if (first?.deviceId) {
      const check = checkDeviceAccess(req, first.deviceId);
      if (!check.ok) return res.status(401).json({ error: check.reason });
    }
    for (const item of telemetry) {
      const latency = Date.now() - (item.ts || Date.now());
      store.insertTelemetry(item, latency);
      hub.recordTelemetry(item.deviceId, item.kind, latency, item.seq, item.state);
      broadcast('telemetry', { ...item, latencyMs: latency });
    }
    for (const d of detections) { store.insertDetection(d); broadcast('detection', d); }
    res.json({ ok: true, telemetry: telemetry.length, detections: detections.length });
  });

  /* ================================================================
   * 设备密钥校验 —— 让「凭密钥接入」成为真实约束
   *
   * 规则：
   *   - 已在 device_access 登记的设备：必须校验 X-Device-Key
   *   - 未登记的设备：允许「首次接入自动登记」（自助接入流程），
   *     但会明确标记为 pending，由平台运营方审核后才可下发作业单
   * ================================================================ */

  /**
   * 校验设备接入凭证。返回 { ok, deviceId, accessState, reason }
   */
  function checkDeviceAccess(req, deviceId) {
    const key = req.get('X-Device-Key') || req.query.key || null;
    const access = store.getDeviceAccess(deviceId);
    if (!access) {
      return { ok: true, accessState: 'self_register', unregistered: true, deviceId };
    }
    if (access.accessState === ACCESS_STATES.revoked) {
      return { ok: false, deviceId, accessState: access.accessState, reason: '设备密钥已吊销' };
    }
    if (access.accessState === ACCESS_STATES.suspended) {
      return { ok: false, deviceId, accessState: access.accessState, reason: '设备接入已停用' };
    }
    if (!verifyApiKey(deviceId, key, access.salt)) {
      return { ok: false, deviceId, accessState: access.accessState, reason: '设备密钥校验失败' };
    }
    return { ok: true, deviceId, accessState: access.accessState };
  }

  /** 设备自助接入：首次连接即登记（pending 状态，需运营方激活） */
  api.post('/access/self-register', (req, res) => {
    const b = req.body || {};
    if (!b.deviceId || !b.name || !['uav', 'robot'].includes(b.kind)) {
      return res.status(400).json({ error: '缺少 deviceId / name，或 kind 非法' });
    }
    const existing = store.getDeviceAccess(b.deviceId);
    if (existing) {
      return res.status(409).json({
        error: '该设备已登记',
        device: existing,
        hint: '请使用已签发的 API Key 接入',
      });
    }
    const r = registerDevice({
      deviceId: b.deviceId, name: b.name, kind: b.kind, model: b.model,
      tenantId: b.tenantId || 't-self', ownerUserId: null,
    }, null);
    if (!r.ok) return res.status(400).json({ error: r.reason });
    // 自助接入先置为 pending，运营方激活后才可接作业单
    store.upsertDeviceAccess({
      ...r.device, accessState: ACCESS_STATES.pending, salt: r.salt,
    });
    store.upsertDevice({
      deviceId: r.device.deviceId, kind: r.device.kind, name: r.device.name,
      state: DEVICE_STATES.OFFLINE, pos: { x: 0, y: 0, z: 0 },
      batt: 100, coverage: 0, lastSeen: Date.now(),
    });
    res.json({
      ok: true,
      device: store.getDeviceAccess(r.device.deviceId),
      apiKey: r.apiKey,
      notice: '自助接入已登记，需平台运营方审核激活后方可接收作业单',
    });
  });

  /** 设备心跳：维持在线状态 */
  api.post('/access/heartbeat', (req, res) => {
    const deviceId = req.body?.deviceId || req.get('X-Device-Id');
    if (!deviceId) return res.status(400).json({ error: '缺少 deviceId' });
    const check = checkDeviceAccess(req, deviceId);
    if (!check.ok) return res.status(401).json({ error: check.reason });
    const access = store.getDeviceAccess(deviceId);
    if (access) {
      applyHeartbeat(access, Date.now());
      store.upsertDeviceAccess({ ...access, salt: access.salt });
    }
    res.json({ ok: true, ts: Date.now(), accessState: check.accessState });
  });

  /** 计量上报：设备或第三方系统上报一次用量 */
  api.post('/metering/usage', (req, res) => {
    const b = req.body || {};
    const identity = resolveIdentity(req);
    const rec = {
      ts: Date.now(),
      tenantId: b.tenantId || identity.tenantId,
      missionId: b.missionId || null,
      type: b.type || 'spray',
      areaMu: b.areaMu ?? null,
      volumeL: b.volumeL ?? null,
      minutes: b.minutes ?? null,
      sorties: b.sorties ?? 0,
      detections: b.detections ?? 0,
      savedL: b.savedL ?? null,
      amount: null,
    };
    const priced = priceUsage({
      sprayMu: rec.type === 'survey' ? 0 : rec.areaMu,
      surveyMu: rec.type === 'survey' ? rec.areaMu : 0,
      sorties: rec.sorties,
      detections: rec.detections, minutes: rec.minutes,
    });
    rec.amount = priced.total;
    store.insertUsage(rec);
    res.json({ ok: true, usage: rec, priced });
  });

  /* ================================================================
   * 算法内核 —— 把队友交付的研究算法接进平台
   *
   * 这一组接口把原先只存在于申报材料里的算法能力变成**可查询、可调用**：
   *   · /algo/benchmarks      离线实验基准（检测/规划/融合/喷洒四组）
   *   · /algo/benchmarks/:key 取单组基准的完整数据
   *   · /algo/swarm/plan      多机协同规划（现场算，含风场与障碍约束）
   *   · /algo/swarm/compare   五种分配算法在同一批病灶上的对比
   *
   * 口径纪律：离线基准与平台实时数据是两套东西，接口里用 notice 标明，
   * 前端也必须分别标注，不许混着说。
   * ================================================================ */

  api.get('/algo/benchmarks', (req, res) => {
    res.json({
      notice: benchmarkNotice(),
      catalog: benchmarkCatalog(),
    });
  });

  api.get('/algo/benchmarks/:key', (req, res) => {
    const b = BENCHMARKS[req.params.key];
    if (!b) {
      return res.status(404).json({
        error: '基准不存在',
        available: Object.keys(BENCHMARKS),
      });
    }
    res.json({ notice: benchmarkNotice(), key: req.params.key, benchmark: b });
  });

  /**
   * 多机协同规划：病灶格 → 多机分工 + 绕障航线 + 风偏代价。
   *
   * 病灶来源两种：
   *   ① 默认取平台已确认的病害网格（置信度 ≥ 0.75），与平台既有口径一致；
   *   ② 请求里给 cells 则用请求的（供答辩现场做对照实验）。
   */
  api.post('/algo/swarm/plan', (req, res) => {
    const b = req.body || {};
    const identity = resolveIdentity(req);

    // 病灶格
    let cells = Array.isArray(b.cells) ? b.cells : null;
    if (!cells) {
      const dets = store.listDetections(3000);
      const confirmed = dets.filter(d => d.confidence >= 0.75);
      const src = confirmed.length ? confirmed : dets;
      const map = new Map();
      for (const d of src) {
        const key = `${d.grid.row}_${d.grid.col}`;
        if (!map.has(key)) map.set(key, { row: d.grid.row, col: d.grid.col, n: 0, severity: 0 });
        const e = map.get(key);
        e.n++;
        e.severity = Math.max(e.severity, d.confidence);
      }
      cells = [...map.values()].sort((a, b2) => b2.n - a.n).slice(0, 20);
    }

    const hotspots = cells.map(c => ({
      r: c.row, c: c.col,
      area: 25,
      severity: c.severity ?? 0.6,
    }));

    // 风场：默认用平台实时气象（施药适宜度判定同源），也可用请求覆盖
    const weather = currentWeather();
    const windSpeed = b.windSpeed ?? weather.wind ?? 3;
    const windDirDeg = b.windDirDeg ?? 45;

    const result = swarmPlan(FIELD, hotspots, {
      nDrones: b.nDrones ?? 4,
      windSpeed,
      windDirDeg,
      swathM: b.swathM ?? 1.0,
      transitSpeedMs: b.transitSpeedMs ?? 8.0,
      spraySpeedMs: b.spraySpeedMs ?? 4.5,
      doseLha: b.doseLha ?? 12,
      algo: b.algo ?? 'pso-aco',
      seed: b.seed ?? 0,
    });

    if (!result.ok) {
      return res.status(400).json({ error: result.reason, reason: result.reason });
    }
    res.json({
      ...result,
      source: {
        cells: hotspots.length,
        origin: Array.isArray(b.cells) ? '请求指定' : '平台已确认病害网格',
        requestedBy: identity.userId,
        weather: { windSpeed, windDirDeg, simulated: true },
      },
    });
  });

  /** 五种分配算法在同一批病灶上的对比（现场算，答辩现场可现场展示） */
  api.post('/algo/swarm/compare', (req, res) => {
    const b = req.body || {};
    const dets = store.listDetections(3000);
    const confirmed = dets.filter(d => d.confidence >= 0.75);
    const src = confirmed.length ? confirmed : dets;
    const map = new Map();
    for (const d of src) {
      const key = `${d.grid.row}_${d.grid.col}`;
      if (!map.has(key)) map.set(key, { row: d.grid.row, col: d.grid.col, severity: 0 });
      map.get(key).severity = Math.max(map.get(key).severity, d.confidence);
    }
    const hotspots = [...map.values()].sort((a, c) => c.severity - a.severity)
      .slice(0, b.maxCells ?? 16)
      .map(c => ({ r: c.row, c: c.col, area: 25, severity: c.severity }));

    if (hotspots.length < 2) {
      return res.status(400).json({ error: '可用病害格不足，无法做算法对比' });
    }

    const weather = currentWeather();
    const windSpeed = b.windSpeed ?? weather.wind ?? 3;
    const windDirDeg = b.windDirDeg ?? 45;
    const algos = ['nearest', 'ga', 'pso', 'aco', 'pso-aco'];
    const rows = [];
    for (const algo of algos) {
      const r = swarmPlan(FIELD, hotspots, {
        nDrones: b.nDrones ?? 4, windSpeed, windDirDeg,
        swathM: b.swathM ?? 1.0, doseLha: b.doseLha ?? 12,
        algo, seed: b.seed ?? 0,
      });
      if (!r.ok) continue;
      rows.push({
        algo,
        name: {
          nearest: '最近邻均分', ga: '遗传算法 GA', pso: '粒子群 PSO',
          aco: '蚁群 ACO', 'pso-aco': 'PSO-ACO 混合',
        }[algo],
        totalLengthM: r.metrics.totalLengthM,
        totalMinutes: r.metrics.totalMinutes,
        makespanMinutes: r.metrics.makespanMinutes,
        energyWh: r.metrics.energyWh,
        turns: r.metrics.turns,
        coverage: r.metrics.coverage,
        overRatio: r.metrics.overRatio,
        overAreaHa: r.metrics.overAreaHa,
        coveredAreaHa: r.metrics.coveredAreaHa,
        targetAreaHa: r.metrics.targetAreaHa,
        invalidCells: r.invalidCells?.length || 0,
        minClearanceM: r.metrics.minClearanceM,
        elapsedMs: r.elapsedMs,
      });
    }
    // 以 PSO-ACO 为基准算相对增益
    const best = rows.find(r => r.algo === 'pso-aco');
    for (const r of rows) {
      r.gainVsPsoAco = best && r !== best ? {
        length: +(((r.totalLengthM - best.totalLengthM) / Math.max(1, best.totalLengthM)) * 100).toFixed(1),
        energy: +(((r.energyWh - best.energyWh) / Math.max(1, best.energyWh)) * 100).toFixed(1),
        makespan: +(((r.makespanMinutes - best.makespanMinutes) / Math.max(1, best.makespanMinutes)) * 100).toFixed(1),
      } : null;
    }
    res.json({
      cells: hotspots.length,
      nDrones: b.nDrones ?? 4,
      wind: { windSpeed, windDirDeg },
      rows,
      notice: {
        label: '平台实时计算',
        desc: '以下结果由平台协同规划内核在当前病害网格与实时风场下现场算出，'
          + '与「离线实验基准」相互独立。',
      },
    });
  });

  /**
   * 喷洒可行性评估 —— 雾滴输运模型（shared/droplets.js）
   *
   * 回答两个现场最常被问的问题：
   *   ① 当前风速下还能不能喷？
   *   ② 喷出去的药有多少落在靶区之外？
   *
   * 返回三档雾滴谱（110 / 140 / 170 μm）下的靶区命中率、P95 漂移，
   * 以及 0–8 m/s 的作业窗口曲线。
   *
   * 耗时说明：一次调用要跑 3 档雾滴谱 × 1 组 + 9 组作业窗口 = 12 次单次喷洒
   * 模拟，每次 2500 滴。按优化后的内核（终端速度查表 + d² 上积分）
   * 单次约 30 ms，整接口约 350 ms —— 前端滑块可以实时跟手。
   *
   * POST /algo/spray/feasibility
   *   body: { windSpeed?, windDirDeg?, vmd?, swath?, tempC?, rh?, n? }
   */
  api.post('/algo/spray/feasibility', (req, res) => {
    const b = req.body || {};
    const weather = currentWeather();
    res.json(sprayFeasibilityReport({
      windSpeed: b.windSpeed ?? weather.wind ?? 3,
      windDirDeg: b.windDirDeg ?? 45,
      swath: b.swath ?? 5,
      vmd: b.vmd ?? 140,
      tempC: b.tempC ?? 22,
      rh: b.rh ?? 0.6,
      n: b.n,
      vmds: b.vmds,
    }));
  });

  return api;
}
