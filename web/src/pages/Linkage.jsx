import { CHART } from '../theme.js';
import { dedupeLinkEvents } from '../events.js';
import { CaseReplay } from '../components/Casebook.jsx';
import { figureSrc } from '../research-figures.js';
import React, { useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip, CartesianGrid,
} from 'recharts';
import { FieldMap } from '../components/FieldMap.jsx';
import {
  IconScan, IconDispatch, IconRobot, IconConfirm, IconSpray,
} from '../components/Icons.jsx';

const CHAIN_STEPS = [
  { key: 'uav_detect',   icon: IconScan,    color: 'var(--uav)',   label: '空中发现', desc: '无人机巡航采集，实时识别出疑似病斑' },
  { key: 'cloud_dispatch', icon: IconDispatch, color: 'var(--warn)', label: '云端派单', desc: '按置信度/病位判定是否需近地复核' },
  { key: 'robot_recheck', icon: IconRobot,  color: 'var(--robot)', label: '机器人复核', desc: '地面机器人驶向目标，近距补拍叶下/根茎' },
  { key: 'cloud_confirm', icon: IconConfirm, color: 'var(--accent)', label: '云端确认', desc: '融合空中+地面证据，确认病害种类与范围' },
  { key: 'uav_spray',    icon: IconSpray,   color: 'var(--uav)',   label: '靶向喷洒', desc: '生成施药任务，按速度-喷洒比例执行' },
];

export default function Linkage({ meta, devices, detections, events, overview, caseId, selectCase, onNav }) {
  /**
   * 联动事件去重。
   *
   * 同一条事件会被推送两次：派单时推一次（未闭环），
   * 地面机器人回传证据后再推一次（已闭环，eventId 不变）。
   * 若不去重，统计口径会翻倍（同一件事算两次），
   * 表格里也会出现重复行。取「后到的覆盖先到的」，
   * 保留最新状态（闭环 / 时延）。
   */
  const uniqEvents = useMemo(() => dedupeLinkEvents(events), [events]);

  const stats = useMemo(() => {
    const evs = uniqEvents;
    if (!evs.length) return null;
    const totals = evs.map(e => e.latency.total).sort((a, b) => a - b);
    const avg = totals.reduce((a, b) => a + b, 0) / totals.length;
    const p95 = totals[Math.min(totals.length - 1, Math.floor(totals.length * 0.95))];
    const steps = { sense: 0, dispatch: 0, act: 0 };
    for (const e of evs) {
      steps.sense += e.latency.sense || 0;
      steps.dispatch += e.latency.dispatch || 0;
      steps.act += e.latency.act || 0;
    }
    const n = evs.length;
    return {
      count: n, avg: Math.round(avg), p95,
      sense: Math.round(steps.sense / n),
      dispatch: Math.round(steps.dispatch / n),
      act: Math.round(steps.act / n),
      closed: evs.filter(e => e.closed).length,
      pending: evs.filter(e => !e.closed).length,
      recheck: evs.filter(e => e.chain.includes('robot_recheck')).length,
    };
  }, [uniqEvents]);

  const chartData = useMemo(() =>
    uniqEvents.slice(0, 30).reverse().map(e => ({
      time: new Date(e.ts).toLocaleTimeString('zh-CN', { hour12: false }),
      感知决策: e.latency.sense,
      决策下发: e.latency.dispatch,
      执行到位: e.latency.act,
      总时延: e.latency.total,
    })), [uniqEvents]);

  const decisionRules = [
    { rule: '置信度低于阈值（默认 75%）', why: '模型不确定，需人眼近距确认', action: '派单机器人' },
    { rule: '病位在叶下 / 根茎部 / 土壤表面', why: '空中俯视视角天然看不到这些部位', action: '派单机器人' },
    { rule: '赤霉病、根腐病', why: '发病部位在下部，需近地确认范围', action: '派单机器人' },
    { rule: '叶部病害且置信度 ≥ 75%', why: '空中已可可靠判读', action: '直接生成喷洒任务' },
  ];

  return (
    <>
      <div className="page-head">
        <h2>空地联动 · 三者实时协同</h2>
        <p>空地数据在同一条决策链上互补：空中给广度与速度，地面给深度与确定性，云端裁决并下发。</p>
      </div>

      {/*
        实验图 11：定位精度与脱靶率的三联图。
        这是「空地互补」在定位层面的实验依据 ——
        空中 GNSS 单点定位误差大（P95 偏移 2.94 m），
        地面机器人近距复核 + 融合定位把脱靶率从 40.3% 压到 0.0005%。
        与本页的实时联动事件口径独立，属离线实验基准。
      */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="sub-title">
          <span className="chip">实验图 11</span>
          定位精度与脱靶率
          <span className="tag">离线实验基准</span>
        </div>
        <img
          src={figureSrc('fig11-localization')}
          alt="时钟同步误差、状态估计 RMSE 与定位误差到脱靶率的关系三联图"
          style={{
            width: '100%',
            display: 'block',
            borderRadius: 8,
            background: '#fff',
            border: '1px solid var(--line)',
          }}
        />
        <p className="hint" style={{ marginTop: 10 }}>
          滤波后状态估计 RMSE 0.084 m（仅 GNSS 时 5.616 m）；
          定位方式从 GPS 单点换成 GNSS+IMU+LiDAR 融合后，
          脱靶率由 40.3% 降到 0.0005%，P95 偏移由 2.94 m 降到 0.54 m ——
          这正是「地面机器人近距复核」在整条链路里的价值所在。
        </p>
      </div>

      {/* 联动链路示意 */}
      <CaseReplay caseId={caseId} selectCase={selectCase} onLibrary={() => onNav('agro')} />
      <div className="card" style={{ marginBottom: 12 }}>
        <h3>联动闭环 <span className="tag">每次闭环全链时延可追溯</span></h3>
        <div className="chain-flow">
          {CHAIN_STEPS.map((s, i) => (
            <div key={s.key} className="chain-card">
              <span className="chain-art" style={{ color: s.color }}>
                <s.icon size={34} color={s.color} />
              </span>
              <span className="chain-no" style={{ background: s.color }}>{i + 1}</span>
              <b className="chain-label">{s.label}</b>
              <div className="chain-desc">{s.desc}</div>
              {i < CHAIN_STEPS.length - 1 && (
                <span className="chain-arrow" aria-hidden="true">›</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 指标 */}
      <div className="grid g4" style={{ marginBottom: 12 }}>
        <div className="card">
          <div className="kpi">
            <span className="label">联动闭环次数</span>
            <span className="value blue">{stats?.count ?? 0}</span>
            <span className="sub">其中 {stats?.recheck ?? 0} 次触发机器人复核</span>
          </div>
        </div>
        <div className="card">
          <div className="kpi">
            <span className="label">平均总时延</span>
            <span className="value green">{stats ? (stats.avg / 1000).toFixed(1) : '—'}<span className="xs mute"> s</span></span>
            <span className="sub">P95 {stats ? (stats.p95 / 1000).toFixed(1) : '—'} s</span>
          </div>
        </div>
        <div className="card">
          <div className="kpi">
            <span className="label">闭环完成率</span>
            <span className={`value ${stats && stats.pending > 0 ? 'amber' : 'green'}`}>
              {stats ? ((stats.closed / stats.count) * 100).toFixed(1) : '—'}<span className="xs mute"> %</span>
            </span>
            <span className="sub">
              {stats ? `${stats.closed} 条已闭环` : '发起→确认→喷洒全链走通'}
              {stats && stats.pending > 0 ? ` · ${stats.pending} 条待地面复核回传` : ''}
            </span>
          </div>
        </div>
        <div className="card">
          <div className="kpi">
            <span className="label">云端决策耗时</span>
            <span className="value">{stats ? stats.sense + stats.dispatch : '—'}<span className="xs mute"> ms</span></span>
            <span className="sub">感知判断 + 任务生成 + 下发</span>
          </div>
        </div>
      </div>

      {/* 时延分解 + 地图 */}
      <div className="grid g-2-1" style={{ marginBottom: 12 }}>
        <div className="card">
          <h3>时延分解 <span className="tag">每一段都可查</span></h3>
          <p className="hint">把联动时延拆成感知决策、决策下发、执行到位三段，定位瓶颈。</p>
          {stats && (
            <div className="grid g3" style={{ marginBottom: 12 }}>
              {[
                ['感知 → 决策', stats.sense, 'ms', '云端判读置信度与病位，决定是否派单', 'green'],
                ['决策 → 下发', stats.dispatch, 'ms', '生成任务并推送至地面机器人', 'blue'],
                ['下发 → 执行到位', stats.act, 'ms', '机器人行驶 + 近距采集 + 回传', 'amber'],
              ].map(([label, val, unit, desc, cls]) => (
                <div key={label} style={{ padding: '8px 8px', background: 'var(--panel-2)', border: '1px solid var(--border)' }}>
                  <div className="xs dim">{label}</div>
                  <div className={`value ${cls}`} style={{ fontSize: 25 }}>
                    {val >= 1000 ? (val / 1000).toFixed(1) : val}<span className="xs mute"> {val >= 1000 ? 's' : unit}</span>
                  </div>
                  <div className="xs mute" style={{ marginTop: 3 }}>{desc}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ height: 180 }}>
            {uniqEvents.length > 0 ? (
              <LatencyChart data={chartData} />
            ) : (
              <div className="empty">等待联动事件…</div>
            )}
          </div>
        </div>

        <div className="card">
          <h3>联动触发判据</h3>
          <p className="hint">每条判据可追溯到具体事件，判据本身可配置。</p>
          <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>判据</th><th>原因</th><th>动作</th></tr></thead>
            <tbody>
              {decisionRules.map(r => (
                <tr key={r.rule}>
                  <td style={{ whiteSpace: 'normal' }}>{r.rule}</td>
                  <td className="dim xs" style={{ whiteSpace: 'normal' }}>{r.why}</td>
                  <td><span className={`pill ${r.action === '派单机器人' ? 'warn' : 'ok'}`}>{r.action}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {/* 地图 + 事件流 */}
      <div className="grid g-2-1">
        <div className="card pad0" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '13px 15px 0' }}><h3>联动事件空间分布</h3></div>
          <FieldMap field={meta?.field} devices={devices} detections={detections} events={uniqEvents} height={360} />
        </div>
        <div className="card">
          <h3>事件流</h3>
          <div className="table-scroll" style={{ maxHeight: 340 }}>
            {uniqEvents.length === 0 ? (
              <div className="empty">暂无联动事件</div>
            ) : (
              <table className="tbl">
                <thead><tr><th>时间</th><th>网格</th><th>触发原因</th><th>闭环</th><th className="right">总时延</th></tr></thead>
                <tbody>
                  {uniqEvents.map(e => (
                    <tr key={e.eventId}>
                      <td className="mono xs mute nowrap">{new Date(e.ts).toLocaleTimeString('zh-CN', { hour12: false })}</td>
                      <td className="mono xs nowrap">{e.grid?.row != null ? `R${e.grid.row}C${e.grid.col}` : '—'}</td>
                      <td className="xs dim" style={{ maxWidth: 190 }}>{e.trigger.reason}</td>
                      <td>
                        {e.closed
                          ? <span className="pill ok">已闭环</span>
                          : <span className="pill warn" title={e.pendingReason || ''}>待回传</span>}
                      </td>
                      <td className="num">{(e.latency.total / 1000).toFixed(1)}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function LatencyChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} stackOffset="none">
        <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
        <XAxis dataKey="time" stroke={CHART.axis} tick={{ fontSize: 12.5 }} minTickGap={40} />
        <YAxis stroke={CHART.axis} tick={{ fontSize: 12.5 }} unit=" ms" width={70} />
        <RTooltip contentStyle={{ background: CHART.tooltipBg, border: `1px solid ${CHART.tooltipBorder}`, fontSize: 13.5 }} />
        <Bar dataKey="感知决策" stackId="a" fill={CHART.green} />
        <Bar dataKey="决策下发" stackId="a" fill={CHART.blue} />
        <Bar dataKey="执行到位" stackId="a" fill={CHART.amber} />
      </BarChart>
    </ResponsiveContainer>
  );
}
