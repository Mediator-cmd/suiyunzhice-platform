import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { api, subscribe, MODE } from './api.js';
import { dedupeLinkEvents } from './events.js';
import NavIcon from './components/NavIcon.jsx';
import Overview from './pages/Overview.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { BRAND, BRAND_FULL, OFFICIAL_URL, OFFICIAL_URL_TEXT, TEAM, VERSION } from './platform-info.js';

/*
 * 页面加载策略：从分包改为整包同步导入。
 *
 * 原本每个页面是一个 lazy chunk，实测公网（GitHub Pages）首次切页要等
 * 15.9 秒才渲染出来 —— 评委现场点一下看到十几秒空白，这是致命的。
 * 分包省下来的那点首屏时间，代价是每一次切页都要付一次网络往返。
 *
 * 现在改为同步导入：全部页面打进主 chunk，切页零延迟。
 * 实测总包约 1.05 MB / gzip 309 KB（其中 Recharts 与 Leaflet 占大头），
 * 一次下载完全可接受；且 Recharts 与 Leaflet 本来就被多数页面共用，
 * 分包并没有省下多少。
 */
import Realtime     from './pages/Realtime.jsx';
import Linkage      from './pages/Linkage.jsx';
import Analytics    from './pages/Analytics.jsx';
import Agro         from './pages/Agro.jsx';
import Planner      from './pages/Planner.jsx';
import Planning     from './pages/Planning.jsx';
import Farm         from './pages/Farm.jsx';
import Architecture from './pages/Architecture.jsx';
import Tenancy      from './pages/Tenancy.jsx';
import Access       from './pages/Access.jsx';
import Metering     from './pages/Metering.jsx';
import Developers   from './pages/Developers.jsx';
import Mobile       from './pages/Mobile.jsx';

/**
 * 板块设置（信息架构）
 *
 * 相对早期版本的 15 个板块做了删改，取其精华去其糟粕：
 *   保留 —— 实时监测（含实景与地图）、数据分析、施药决策（并入路径规划与农情策略）、
 *           策略库（独立为「农情与策略」）、空地协同调度（即空地联动）
 *   合并 —— 系统首页 + 指挥中心 + 病害识别 → 总览（KPI + 地块态势 + 作业单）
 *           地面站 + 多机协同规划 + 航线与处方 → 路径规划（一个规划器统一算）
 *   新增 —— 农情与策略（气象、施药窗口、药剂与安全间隔期、病种实拍图）
 *   舍弃 —— 3D 实景、飘移仿真、病害推演、智能助手（演示性占位，无可验证结论）
 *
 * 平台底座（低空经济赛道新增）：
 *   租户与权限 —— 平台服务哪些主体、谁能看什么
 *   设备接入   —— 第三方设备怎么进来、怎么鉴权、怎么吊销
 *   计量结算   —— 平台按什么口径收费、账单与经营指标
 *   开发者门户 —— 第三方开发者接一次设备要做什么、写多少代码
 *   三端联动   —— PC 调度台 / 掌上端 / 公众号怎么协同
 *
 * 这五块是「平台化」的核心证据：评委看完就能确认
 * 我们的工作量在平台的设计与开发，而不只是硬件集成。
 *
 * 分组：按「评委的提问顺序」组织，而不是按开发顺序。
 *   作战指挥 —— 你怎么干活？（看得见、控得住）
 *   智能决策 —— 凭什么比人强？（算得出、讲得清）
 *   平台底座 —— 这是不是一个平台？（多租户、可接入、可计量）
 *   交付与说明 —— 给谁用、怎么用、架构长什么样
 */
const NAV_GROUPS = [
  {
    group: '作战指挥',
    items: [
      { id: 'overview',   label: '总览',     icon: 'grid',   sub: '平台全局指标与地块态势' },
      { id: 'realtime',   label: '实时监控', icon: 'radar',  sub: '现场实景、链路质量与气象条件' },
      { id: 'linkage',    label: '空地联动', icon: 'link',   sub: '三者实时协同闭环' },
    ],
  },
  {
    group: '智能决策',
    items: [
      { id: 'analytics',  label: '数据分析', icon: 'chart',  sub: '六维统计与结论' },
      { id: 'agro',       label: '农情策略', icon: 'leaf',   sub: '气象、施药窗口与策略库' },
      { id: 'planner',    label: '路径规划', icon: 'route',  sub: '自动规划与比例求解' },
      { id: 'planning',   label: '平台方案', icon: 'doc',    sub: '能力、硬件与接入协议' },
    ],
  },
  {
    group: '平台底座',
    items: [
      { id: 'tenancy',    label: '租户与权限', icon: 'shield',   sub: '五类主体与可见范围裁决' },
      { id: 'access',     label: '设备接入',   icon: 'plug',     sub: '第三方设备鉴权与调度' },
      { id: 'developers', label: '开发者门户', icon: 'code',     sub: '接入流程、代码与模拟器' },
      { id: 'metering',   label: '计量结算',   icon: 'gear',     sub: '价目表、账单与经营指标' },
    ],
  },
  {
    group: '交付与说明',
    items: [
      { id: 'mobile',     label: '三端联动', icon: 'phone', sub: 'PC / 掌上端 / 公众号协同' },
      { id: 'farm',       label: '农户服务', icon: 'leaf',  sub: '今日行动清单' },
      { id: 'arch',       label: '系统架构', icon: 'layers', sub: '场景与流程图' },
    ],
  },
];

/** 扁平化的全部板块（用于 hash 校验与搜索） */
const NAV = NAV_GROUPS.flatMap(g => g.items);

/** 板块 id → 所属分组名（顶栏面包屑用） */
const NAV_GROUP_OF = Object.fromEntries(NAV_GROUPS.map(g => [g.id, g.group]));

export default function App() {
  // 用 location.hash 记录当前板块：可深链接、可后退，刷新不丢位置
  const [page, setPage] = useState(() => {
    const h = (window.location.hash || '').replace(/^#\/?/, '');
    return NAV.some(n => n.id === h) ? h : 'overview';
  });
  const [mode, setMode] = useState(MODE.MOCK);
  const [caseId, selectCase] = useState('powdery-07');
  useEffect(() => {
    document.querySelector('.content')?.scrollTo(0, 0);
    if (window.matchMedia('(max-width: 700px)').matches) {
      document.querySelector('.nav .active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [page]);
  const [meta, setMeta] = useState(null);
  const [devices, setDevices] = useState([]);
  const [telemetry, setTelemetry] = useState([]);
  const [detections, setDetections] = useState([]);
  const [missions, setMissions] = useState([]);
  const [events, setEvents] = useState([]);
  const [linkMetrics, setLinkMetrics] = useState([]);
  const [overview, setOverview] = useState(null);
  const [briefing, setBriefing] = useState(null);
  const [dimCache, setDimCache] = useState({});
  const [lastMsg, setLastMsg] = useState(null);
  const [bootError, setBootError] = useState(null);
  // 当前登录身份（平台底座）。默认取演示身份，登录后由后端返回真实身份。
  const [identity, setIdentity] = useState(null);
  // 全局搜索
  const [q, setQ] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef(null);

  // ---- 板块 ↔ URL hash 双向同步 ----
  useEffect(() => {
    const onHash = () => {
      const h = (window.location.hash || '').replace(/^#\/?/, '');
      if (NAV.some(n => n.id === h)) setPage(h);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (window.location.hash.replace(/^#\/?/, '') !== page) {
      window.location.hash = `/${page}`;
    }
  }, [page]);

  // ---- 首次加载静态数据 ----
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [m, d, t, det, ms, ev, ov, br] = await Promise.all([
          api.meta(), api.devices(), api.telemetry(400), api.detections(400),
          api.missions(200), api.linkageEvents(), api.overview(), api.briefing(),
        ]);
        if (!alive) return;
        setMeta(m); setDevices(d); setTelemetry(t); setDetections(det);
        setMissions(ms); setEvents(dedupeLinkEvents(ev.events || [])); setOverview(ov); setBriefing(br);
        setLinkMetrics(await api.linkMetrics());
        // 身份与平台基础数据一起加载，避免租户页首次进入时闪烁
        const idn = await api.identity();
        if (alive && idn?.identity) setIdentity(idn.identity);
      } catch (e) {
        if (alive) setBootError(e.message);
      }
    })();
    return () => { alive = false; };
  }, []);

  // ---- 实时订阅 ----
  // 后端可达 → WebSocket 实时推送；不可达 → 自动切到浏览器内引擎，
  // 页面显示「演示模式」，功能完整，数据来自内置模拟器。
  useEffect(() => {
    let closed = false;

    const onMessage = (type, payload) => {
      setLastMsg({ type, ts: Date.now() });
      switch (type) {
        case 'telemetry':
          setTelemetry(prev => [...prev.slice(-499), payload]);
          setDevices(prev => prev.map(d => d.deviceId === payload.deviceId
            ? { ...d, state: payload.state, pos: payload.pos, batt: payload.batt,
                coverage: payload.coverage, online: true, lastSeen: payload.ts }
            : d));
          break;
        case 'detection':
          setDetections(prev => [payload, ...prev].slice(0, 400));
          break;
        case 'linkage':
          // 同一条联动事件可能被推送两次：先推送未闭环版本，
          // 地面证据回传后再推送已闭环版本（eventId 不变）。
          // 按 eventId 覆盖而不是追加，避免重复条目、重复 React key
          // 以及统计口径翻倍。
          setEvents(prev => dedupeLinkEvents([payload, ...prev]).slice(0, 120));
          break;
        case 'mission':
          setMissions(prev => [payload, ...prev].slice(0, 200));
          break;
        case 'missionStatus':
          setMissions(prev => prev.map(m => m.missionId === payload.missionId
            ? { ...m, status: payload.status } : m));
          break;
        default: break;
      }
    };

    const stop = subscribe({
      onStatus: (m) => setMode(m),
      onMessage,
    });

    return () => { closed = true; stop(); };
  }, []);

  // ---- 定期刷新聚合指标（实时面板的统计类指标）----
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const [ov, br, lm] = await Promise.all([api.overview(), api.briefing(), api.linkMetrics()]);
        setOverview(ov); setBriefing(br); setLinkMetrics(lm);
      } catch { /* mock 模式忽略 */ }
    }, 5000);
    return () => clearInterval(t);
  }, []);

  /**
   * 载入某一维度的统计。
   *
   * 缓存语义：只缓存「有数据」的结果。
   * 演示模式下模拟器是边跑边攒数据的，若首次进入时把「空结果」也缓存住，
   * 之后检测数据到齐了页面仍停在 0 条记录 —— 这是之前空间维度显示为空的原因。
   * 空结果直接回源重取，让页面随数据积累自动补上。
   */
  const loadDimension = useCallback(async (dim) => {
    const cached = dimCache[dim];
    if (cached && (cached.rows?.length || cached.insight?.length)) return cached;
    try {
      const d = await api.dimension(dim);
      if (d) setDimCache(prev => ({ ...prev, [dim]: d }));
      return d;
    } catch { return null; }
  }, [dimCache]);

  const shared = useMemo(() => ({
    meta, devices, telemetry, detections, missions, events,
    linkMetrics, overview, briefing, mode, lastMsg,
    identity,
    onIdentityChange: setIdentity,
    refreshOverview: async () => {
      try {
        const [ov, br, lm] = await Promise.all([api.overview(), api.briefing(), api.linkMetrics()]);
        setOverview(ov); setBriefing(br); setLinkMetrics(lm);
      } catch { /* ignore */ }
    },
    loadDimension,
  }), [meta, devices, telemetry, detections, missions, events,
      linkMetrics, overview, briefing, mode, lastMsg, loadDimension, identity]);

  const Page = {
    overview: Overview, realtime: Realtime, linkage: Linkage,
    analytics: Analytics, agro: Agro, planner: Planner, planning: Planning,
    farm: Farm, arch: Architecture,
    tenancy: Tenancy, access: Access, metering: Metering, developers: Developers,
    mobile: Mobile,
  }[page];

  /* ---------- 侧边栏计数（实时口径，不写死） ---------- */
  const counts = useMemo(() => {
    const online = devices.filter(d => d.online).length;
    const pending = missions.filter(m => m.status === 'pending' || m.status === 'dispatched').length;
    const open = events.filter(e => !e.closed).length;
    return { online, pending, open };
  }, [devices, missions, events]);

  const countOf = useCallback((id) => ({
    realtime: counts.online,
    linkage: counts.open,
    overview: counts.pending,
    access: devices.length,
  })[id], [counts, devices.length]);

  /* ---------- 全局搜索：板块 + 设备 + 作业单 ---------- */
  const results = useMemo(() => {
    const kw = q.trim().toLowerCase();
    if (!kw) return [];
    const hit = (s) => String(s || '').toLowerCase().includes(kw);
    const out = [];
    for (const n of NAV) {
      if (hit(n.label) || hit(n.sub)) out.push({ kind: 'nav', id: n.id, label: n.label, hint: n.sub, icon: n.icon });
    }
    for (const d of devices) {
      if (hit(d.deviceId) || hit(d.name) || hit(d.kind)) {
        out.push({ kind: 'device', id: d.deviceId, label: d.deviceId, hint: `${d.kind} · ${d.name || ''}`, icon: 'plug' });
      }
    }
    for (const m of missions) {
      if (hit(m.missionId) || hit(m.type) || hit(m.zoneName)) {
        out.push({ kind: 'mission', id: m.missionId, label: m.missionId, hint: `${m.type || '作业'} · ${m.zoneName || m.zoneId || ''}`, icon: 'grid' });
      }
    }
    return out.slice(0, 12);
  }, [q, devices, missions]);

  // 点搜索结果：板块跳转；设备/作业单跳到对应板块
  const gotoResult = useCallback((r) => {
    if (r.kind === 'nav') setPage(r.id);
    else if (r.kind === 'device') setPage('realtime');
    else if (r.kind === 'mission') setPage('overview');
    setQ(''); setSearchOpen(false);
  }, []);

  // 点击外部关闭搜索面板
  useEffect(() => {
    if (!searchOpen) return;
    const onDown = (e) => { if (!searchRef.current?.contains(e.target)) setSearchOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [searchOpen]);

  // ⌘K / Ctrl+K 聚焦搜索
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.querySelector('input')?.focus();
        setSearchOpen(true);
      }
      if (e.key === 'Escape') { setSearchOpen(false); searchRef.current?.querySelector('input')?.blur(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const current = NAV.find(n => n.id === page);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-text">
            <b>{BRAND}</b>
            <i>{BRAND_FULL}</i>
          </span>
        </div>

        <nav className="nav">
          {NAV_GROUPS.map(g => (
            <div className="nav-group" key={g.group}>
              <div className="nav-group-title">{g.group}</div>
              {g.items.map(n => {
                const c = countOf(n.id);
                return (
                  <button key={n.id}
                    className={page === n.id ? 'active' : ''}
                    title={n.sub}
                    onClick={() => setPage(n.id)}>
                    <NavIcon name={n.icon} size={16} className="nav-ico" />
                    <span className="nav-label">{n.label}</span>
                    {c ? <span className="nav-count mono">{c}</span> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="side-foot">
          <div className="who">
            <span className="ava">{(identity?.name || '管').slice(0, 1)}</span>
            <span className="who-text">
              <b>{identity?.name || '平台管理员'}</b>
              <i>{identity?.tenantName || identity?.tenantId || '中国民航大学 · 演示身份'}</i>
            </span>
          </div>
          <a className="official" href={OFFICIAL_URL} target="_blank" rel="noreferrer noopener"
            title={`${BRAND} ${BRAND_FULL} 官方网站`}>
            <span className="label">官方网站</span>
            <span className="mono url">{OFFICIAL_URL_TEXT}</span>
          </a>
          <span className="copyright">{TEAM} · {VERSION}</span>
        </div>
      </aside>

      <div className="main">
        {/* ---------- 顶栏 ---------- */}
        <header className="topbar">
          <div className="crumb">
            <span>{NAV_GROUP_OF[page]}</span>
            <span className="sep">/</span>
            <b>{current?.label}</b>
          </div>

          <div className="search" ref={searchRef}>
            <NavIcon name="search" size={15} className="search-ico" />
            <input
              value={q}
              placeholder="搜索板块、设备、作业单"
              onChange={e => { setQ(e.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              aria-label="全局搜索"
            />
            {q
              ? <button className="search-clear" onClick={() => setQ('')} aria-label="清除">×</button>
              : <span className="kbd">⌘K</span>}
            {searchOpen && q.trim() && (
              <div className="search-panel">
                {results.length === 0
                  ? <div className="search-empty">没有匹配「{q.trim()}」的结果</div>
                  : results.map(r => (
                    <button key={`${r.kind}-${r.id}`} className="search-item" onClick={() => gotoResult(r)}>
                      <NavIcon name={r.icon} size={15} />
                      <b>{r.label}</b>
                      <span>{r.hint}</span>
                    </button>
                  ))}
              </div>
            )}
          </div>

          <span className={`modechip ${mode}`}>
            <span className="dot" />
            {mode === MODE.LIVE ? '实时接入' : '演示模式'}
          </span>

          {meta && (
            <span className="topbar-field mono" title="当前地块">
              {meta.field.name} · {meta.field.areaHa?.toFixed(1)} ha
            </span>
          )}
        </header>

        {/* ---------- 内容区 ---------- */}
        <main className="content">
          {bootError && mode === MODE.MOCK && (
            <div className="card" style={{ marginBottom: 16, borderColor: 'var(--warn)' }}>
              <div className="small amber">
                当前为演示模式，数据由浏览器内置模拟器产生，功能完整可用。
                接入真实设备后顶栏将显示「实时接入」。
              </div>
            </div>
          )}
          <ErrorBoundary label={current?.label}>
            <div>
              <Page {...shared} onNav={setPage} caseId={caseId} selectCase={selectCase} />
            </div>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
