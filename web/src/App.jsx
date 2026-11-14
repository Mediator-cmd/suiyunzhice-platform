import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { api, subscribe, MODE } from './api.js';
import Overview from './pages/Overview.jsx';
import Realtime from './pages/Realtime.jsx';
import Linkage from './pages/Linkage.jsx';
import Analytics from './pages/Analytics.jsx';
import Planner from './pages/Planner.jsx';
import Planning from './pages/Planning.jsx';
import Farm from './pages/Farm.jsx';
import Architecture from './pages/Architecture.jsx';

const NAV = [
  { id: 'overview',  label: '总览' },
  { id: 'realtime',  label: '实时监控' },
  { id: 'linkage',   label: '空地联动' },
  { id: 'analytics', label: '数据分析' },
  { id: 'planner',   label: '路径规划' },
  { id: 'planning',  label: '方案与部署' },
  { id: 'farm',      label: '农户服务' },
  { id: 'arch',      label: '系统架构' },
];

export default function App() {
  const [page, setPage] = useState('overview');
  const [mode, setMode] = useState(MODE.MOCK);
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
    refreshOverview: async () => {
      try {
        const [ov, br, lm] = await Promise.all([api.overview(), api.briefing(), api.linkMetrics()]);
        setOverview(ov); setBriefing(br); setLinkMetrics(lm);
      } catch { /* ignore */ }
    },
    loadDimension,
  }), [meta, devices, telemetry, detections, missions, events,
      linkMetrics, overview, briefing, mode, lastMsg, loadDimension]);

  const Page = {
    overview: Overview, realtime: Realtime, linkage: Linkage,
    analytics: Analytics, planner: Planner, planning: Planning,
    farm: Farm, arch: Architecture,
  }[page];

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <h1>麦田智翼</h1>
          <span className="sub">空地协同精准植保云平台</span>
        </div>
        <nav className="nav">
          {NAV.map(n => (
            <button key={n.id}
              className={page === n.id ? 'active' : ''}
              onClick={() => setPage(n.id)}>{n.label}</button>
          ))}
        </nav>
        <div className="top-right">
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
        </div>
      </header>

      <main className="main">
        {bootError && mode === MODE.MOCK && (
          <div className="card" style={{ marginBottom: 12, borderColor: 'rgba(251,191,36,.4)' }}>
            <div className="small amber">
              未能连接云端服务（{bootError}），当前使用浏览器内置模拟器演示。
              完整功能与真实设备接入请看「方案与部署」页。
            </div>
          </div>
        )}
        <Page {...shared} onNav={setPage} />
      </main>
    </div>
  );
}
