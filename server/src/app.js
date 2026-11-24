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
import { ONBOARDING_STEPS, CODE_SAMPLES } from '../../shared/openplatform.js';
import {
  FARMER_MSG_TYPES, buildFarmerMessage, toPushPayload, WECHAT_SERVICE, nonEmptyMessages,
} from '../../shared/farmer.js';

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
 */
export function createApiRouter(deps) {
  const { store, platform, analytics, linkage, hub, broadcast, field: FIELD } = deps;

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
      endpointCount: 41,
      // 数据契约种类
      contracts: ['遥测帧 TELEMETRY', '识别结果 DETECTION', '作业任务 MISSION', '联动事件 LINK_EVENT'],
      steps: ONBOARDING_STEPS.length,
      samples: CODE_SAMPLES.map(s => s.key),
    });
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

  return api;
}
