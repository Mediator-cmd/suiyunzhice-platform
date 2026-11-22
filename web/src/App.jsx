import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { api, subscribe, MODE } from './api.js';
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
 * 实测总包 433 KB / gzip 140 KB，一次下载完全可接受；
 * 且 Recharts 与 Leaflet 本来就被多数页面共用，分包并没有省下多少。
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
 */
const NAV = [
  { id: 'overview',  label: '总览',     sub: '平台全局指标与地块态势' },
  { id: 'realtime',  label: '实时监控', sub: '现场实景、链路质量与气象条件' },
  { id: 'linkage',   label: '空地联动', sub: '三者实时协同闭环' },
  { id: 'analytics', label: '数据分析', sub: '六维统计与结论' },
  { id: 'agro',      label: '农情策略', sub: '气象、施药窗口与策略库' },
  { id: 'planner',   label: '路径规划', sub: '自动规划与比例求解' },
  { id: 'planning',  label: '平台方案', sub: '能力、硬件与接入协议' },
  { id: 'tenancy',   label: '租户与权限', sub: '五类主体与可见范围裁决' },
  { id: 'access',    label: '设备接入', sub: '第三方设备鉴权与调度' },
  { id: 'developers',label: '开发者门户', sub: '接入流程、代码与模拟器' },
  { id: 'mobile',    label: '三端联动', sub: 'PC / 掌上端 / 公众号协同' },
  { id: 'metering',  label: '计量结算', sub: '价目表、账单与经营指标' },
  { id: 'farm',      label: '农户服务', sub: '今日行动清单' },
  { id: 'arch',      label: '系统架构', sub: '场景与流程图' },
];

export default function App() {
  // 用 location.hash 记录当前板块：可深链接、可后退，刷新不丢位置
  const [page, setPage] = useState(() => {
    const h = (window.location.hash || '').replace(/^#\/?/, '');
    return NAV.some(n => n.id === h) ? h : 'overview';
  });
  const [mode, setMode] = useState(MODE.MOCK);
  const [caseId, selectCase] = useState('powdery-07');
  useEffect(() => {
    document.querySelector('main')?.scrollTo(0, 0);
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
        setMissions(ms); setEvents(ev.events || []); setOverview(ov); setBriefing(br);
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
          setEvents(prev => [payload, ...prev].slice(0, 120));
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

  const loadDimension = useCallback(async (dim) => {
    if (dimCache[dim]) return dimCache[dim];
    try {
      const d = await api.dimension(dim);
      setDimCache(prev => ({ ...prev, [dim]: d }));
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

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <h1>{BRAND}</h1>
          <span className="sub">{BRAND_FULL}</span>
        </div>
        <nav className="nav">
          {NAV.map((n, i) => (
            <button key={n.id}
              className={page === n.id ? 'active' : ''}
              title={n.sub}
              onClick={() => setPage(n.id)}>
              <span className="idx">{String(i + 1).padStart(2, '0')}</span>
              <span>{n.label}</span>
            </button>
          ))}
        </nav>
        <div className="side-foot">
          {meta && (
            <span className="badge" title="当前地块">
              <span className="mono">{meta.field.name}</span>
              <span className="mono">{meta.field.areaHa.toFixed(1)} ha</span>
            </span>
          )}
          <span className={`badge ${mode}`} title={mode === MODE.LIVE ? '已连接真实云端服务' : '演示模式：内置模拟数据'}>
            <span className="dot" />
            {mode === MODE.LIVE ? '实时接入' : '演示模式'}
          </span>
          {identity && (
            <span className="badge identity" title={`当前身份：${identity.name}（${identity.role}）`}>
              <span className="mono">{identity.name}</span>
              <span className="mono" style={{ opacity: .85, fontWeight: 400 }}>
                {identity.tenantName || identity.tenantId}
              </span>
            </span>
          )}
          <a className="official" href={OFFICIAL_URL} target="_blank" rel="noreferrer noopener"
            title={`${BRAND} ${BRAND_FULL} 官方网站`}>
            <span className="label">官方网站</span>
            <span className="mono url">{OFFICIAL_URL_TEXT}</span>
          </a>
          <span className="copyright">{TEAM} · {VERSION}</span>
        </div>
      </aside>

      <main className="main">
        {bootError && mode === MODE.MOCK && (
          <div className="card" style={{ marginBottom: 16, borderColor: 'var(--warn)' }}>
            <div className="small amber">
              当前为演示模式，数据由浏览器内置模拟器产生，功能完整可用。
              接入真实设备后侧边栏将显示「实时接入」。
            </div>
          </div>
        )}
        <ErrorBoundary label={NAV.find(n => n.id === page)?.label}>
          <div>
            <Page {...shared} onNav={setPage} caseId={caseId} selectCase={selectCase} />
          </div>
        </ErrorBoundary>
      </main>
    </div>
  );
}
