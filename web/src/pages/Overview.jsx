import React, { useMemo, useState } from 'react';
import { CHART, MAP } from '../theme.js';
import { dedupeLinkEvents } from '../events.js';
import { FieldMap, DISEASE_COLOR } from '../components/FieldMap.jsx';
import GridDetail from '../components/GridDetail.jsx';
import NavIcon from '../components/NavIcon.jsx';
import {
  IconScan, IconChart, IconDispatch, IconRoute,
} from '../components/Icons.jsx';

const CAPABILITIES = [
  { icon: IconScan,    title: '实时数据传输', desc: '5Hz 遥测上报，弱网批量补传，时延可量化', id: 'realtime',  color: 'var(--uav)' },
  { icon: IconDispatch,title: '空地实时联动', desc: '发现→派单→复核→确认→喷洒，全链时延可查', id: 'linkage',   color: 'var(--accent)' },
  { icon: IconChart,   title: '多维统计分析', desc: '六维并行统计，每维输出可执行结论',       id: 'analytics', color: 'var(--warn)' },
  { icon: IconRoute,   title: '自动路径规划', desc: '航向×速度×喷幅联合搜索，三目标打分',       id: 'planner',   color: 'var(--robot)' },
];

/* ============================================================================
   作业队列 —— 左侧栏
   ========================================================================== */

/** 作业单类型 → 中文 */
const MISSION_TYPE = {
  spray: '靶向施药',
  recheck: '近距复核',
  survey: '巡检飞行',
  diagnose: '病害诊断',
};

/** 作业单状态 → { 标签, 色, 语义 } */
const MISSION_STATUS = {
  pending:   { label: '待派单', tone: 'warn' },
  approved:  { label: '已审批', tone: 'mute' },
  dispatched:{ label: '已下发', tone: 'accent' },
  running:   { label: '执行中', tone: 'accent' },
  done:      { label: '已完成', tone: 'ok' },
  rejected:  { label: '已退回', tone: 'danger' },
};

/** 队列排序权重：执行中 > 已下发 > 待派单 > 已完成 */
const STATUS_RANK = { running: 0, dispatched: 1, pending: 2, approved: 3, done: 4, rejected: 5 };

export default function Overview({ meta, devices, telemetry, detections, events, overview, briefing, missions, mode, onNav }) {
  // 点击地图上的病害网格 → 展开该网格的完整档案（识别—地块—任务 可追溯）
  const [selGrid, setSelGrid] = React.useState(null);
  // 右侧详情栏当前选中的作业单
  const [selMissionId, setSelMissionId] = useState(null);

  // 按 eventId 去重：同一条联动事件先推未闭环版、后推已闭环版，ID 相同
  // 注意：Hook 必须写在任何提前 return 之前，否则首帧与后续帧的 Hook 数量不一致
  const uniqEvents = useMemo(() => dedupeLinkEvents(events), [events]);

  /* ---------- 作业队列 ---------- */
  const queue = useMemo(() => {
    const list = (missions || []).map(m => ({
      m,
      st: MISSION_STATUS[m.status] || { label: m.status || '未知', tone: 'mute' },
      rank: STATUS_RANK[m.status] ?? 6,
      ts: m.createdAt || m.ts || 0,
    }));
    // 执行中的排前面，其余按创建时间倒序
    list.sort((a, b) => (a.rank - b.rank) || (b.ts - a.ts));
    return list;
  }, [missions]);

  // 选中的作业单：优先用户点选的，否则默认第一条
  const activeMission = useMemo(() => {
    const found = queue.find(q => q.m.missionId === selMissionId);
    return found?.m || queue[0]?.m || null;
  }, [queue, selMissionId]);

  // 与选中作业单对应的联动事件（用于闭环链路与时延分解）
  const activeEvent = useMemo(() => {
    if (!activeMission) return null;
    const gid = activeMission.target?.grid;
    if (!gid || gid.row == null) return null;
    return uniqEvents.find(e => e.grid?.row === gid.row && e.grid?.col === gid.col) || null;
  }, [activeMission, uniqEvents]);

  if (!meta) return <div className="empty">正在加载平台数据…</div>;
  const ov = overview || {};
  const det = ov.detection || {};
  const link = ov.linkage || {};
  const eff = ov.efficiency || {};
  const dv = ov.devices || {};

  const kpis = [
    { label: '接入设备', value: `${dv.online || 0}/${dv.total || 0}`, sub: `无人机 ${dv.uav || 0} · 机器人 ${dv.robot || 0}`, cls: 'blue' },
    { label: '累计识别', value: det.total || 0, sub: `已确认 ${det.confirmed || 0} 处`, cls: '' },
    { label: '平均置信度', value: `${((det.avgConfidence || 0) * 100).toFixed(1)}%`, sub: 'SAN-GAT-RL 多模态模型', cls: 'green' },
    { label: '联动闭环时延', value: `${((link.avgLatencyMs || 0) / 1000).toFixed(1)}s`, sub: `P95 ${((link.p95LatencyMs || 0) / 1000).toFixed(1)}s`, cls: 'amber' },
    { label: '药液节约率', value: eff.savedRatioVsZone == null ? '待作业' : `${eff.savedRatioVsZone}%`, sub: eff.savedRatioVsZone == null ? '尚无喷洒任务' : `靶向点喷对比分区整片喷施少用 ${eff.zoneSavedVolumeL || 0} L`, cls: 'green' },
  ];

  const recentEvents = uniqEvents.slice(0, 5);
  const f = meta.field || {};
  const sprayMissions = (missions || []).filter(m => m.type === 'spray');

  return (
    <>
      <div className="page-head">
        <h2>平台总览</h2>
        <p>平台全局指标与地块态势：无人机空中巡查、机器人近距复核，云端完成决策与下发。</p>
      </div>

      {/* KPI */}
      <div className="grid g5" style={{ marginBottom: 16 }}>
        {kpis.map(k => (
          <div className="card" key={k.label}>
            <div className="kpi">
              <span className="label">{k.label}</span>
              <span className={`value ${k.cls}`}>{k.value}</span>
              <span className="sub">{k.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ===== 三栏指挥台：作业队列 | 地块态势 | 作业单详情 ===== */}
      <div className="console" style={{ marginBottom: 16 }}>
        {/* ---------- 左：作业队列 ---------- */}
        <div className="pane">
          <div className="phead">
            <b>作业队列</b>
            <span className="spacer" />
            <span className="chip">{queue.length}</span>
          </div>
          <div className="qlist">
            {queue.length === 0 ? (
              <div className="empty" style={{ padding: 24 }}>等待派单</div>
            ) : queue.map(q => {
              const m = q.m;
              const isActive = activeMission?.missionId === m.missionId;
              return (
                <button
                  key={m.missionId}
                  className={`qrow ${isActive ? 'on' : ''}`}
                  onClick={() => setSelMissionId(m.missionId)}
                >
                  <span className={`st ${q.st.tone}`} />
                  <span className="qbody">
                    <b>{MISSION_TYPE[m.type] || m.type || '作业'}{m.zoneName ? ` · ${m.zoneName}` : ''}</b>
                    <p>{q.st.label}{m.disease ? ` · ${diseaseName(m.disease)}` : ''}</p>
                    <span className="mono">{m.missionId}</span>
                  </span>
                  <span className="qt mono">{fmtTime(q.ts)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ---------- 中：地块态势 ---------- */}
        <div className="pane">
          <div className="phead">
            <b>地块态势</b>
            <span className="chip teal">链路正常</span>
            <span className="spacer" />
            <span className="xs mono mute">{f.widthM}×{f.heightM} m · {f.areaHa?.toFixed(1)} ha</span>
          </div>
          <div className="stage">
            <FieldMap field={meta.field} devices={devices} detections={detections} events={uniqEvents} missions={missions}
              height={470} onGridClick={setSelGrid} selectedGrid={selGrid} />
            {selGrid && (
              <div className="grid-drawer">
                <GridDetail grid={selGrid} detections={detections} missions={missions} events={uniqEvents}
                  onClose={() => setSelGrid(null)} />
              </div>
            )}
          </div>
          <div className="pfoot">
            <div className="legend">
              <span><i style={{ background: CHART.blue }} />植保无人机</span>
              <span><i style={{ background: CHART.robot }} />地面监测机器人</span>
              <span><i style={{ background: CHART.amber }} />联动事件</span>
              <span><i style={{ background: CHART.green }} />规划航线</span>
              <span><i style={{ background: MAP.obstacleStroke }} />障碍区</span>
              {Object.entries(DISEASE_COLOR).map(([k, v]) => (
                <span key={k}><i style={{ background: v }} />{meta.diseases.find(d => d.code === k)?.name || k}</span>
              ))}
            </div>
          </div>
        </div>

        {/* ---------- 右：作业单详情 ---------- */}
        <div className="pane">
          <div className="phead">
            <b>作业单详情</b>
            <span className="spacer" />
            {activeMission && (
              <span className={`chip ${MISSION_STATUS[activeMission.status]?.tone || ''}`}>
                {MISSION_STATUS[activeMission.status]?.label || activeMission.status}
              </span>
            )}
          </div>
          <div className="pbody">
            {!activeMission ? (
              <div className="empty">暂无作业单</div>
            ) : (
              <>
                <div className="sec">
                  <div className="sech"><NavIcon name="doc" size={13} />作业单</div>
                  <div className="kv"><span>编号</span><b className="mono">{activeMission.missionId}</b></div>
                  <div className="kv"><span>类型</span><b>{MISSION_TYPE[activeMission.type] || activeMission.type}</b></div>
                  <div className="kv"><span>作业分区</span><b>{activeMission.zoneName || '—'}</b></div>
                  <div className="kv"><span>目标网格</span><b className="mono">
                    {activeMission.target?.grid?.row != null
                      ? `R${activeMission.target.grid.row}C${activeMission.target.grid.col}` : '—'}
                  </b></div>
                  {activeMission.disease && (
                    <div className="kv"><span>目标病种</span><b>{diseaseName(activeMission.disease)}</b></div>
                  )}
                </div>

                <div className="sec">
                  <div className="sech"><NavIcon name="link" size={13} />闭环链路</div>
                  <div className="chain">
                    {(activeEvent?.chain || []).map((c, i) => (
                      <React.Fragment key={i}>
                        {i > 0 && <span className="arrow">›</span>}
                        <span className={`node ${activeEvent?.closed ? 'on' : ''}`}>{chainLabel(c)}</span>
                      </React.Fragment>
                    ))}
                    {!activeEvent && <span className="node">等待联动事件</span>}
                  </div>
                  {activeEvent?.latency && (
                    <>
                      <div className="kv" style={{ marginTop: 8 }}>
                        <span>闭环总时延</span>
                        <b style={{ color: 'var(--warn)' }}>{(activeEvent.latency.total / 1000).toFixed(1)} s</b>
                      </div>
                      <div className="bars">
                        <LatencyBar label="感知" ms={activeEvent.latency.sense} total={activeEvent.latency.total} tone="accent" />
                        <LatencyBar label="派单" ms={activeEvent.latency.dispatch} total={activeEvent.latency.total} tone="accent" />
                        <LatencyBar label="执行" ms={activeEvent.latency.act} total={activeEvent.latency.total} tone="warn" />
                      </div>
                    </>
                  )}
                </div>

                <div className="sec">
                  <div className="sech"><NavIcon name="leaf" size={13} />喷洒参数</div>
                  {activeMission.type === 'spray' ? (
                    <>
                      <div className="kv"><span>飞行速度</span><b>{activeMission.spray?.speed} m/s</b></div>
                      <div className="kv"><span>流量 / 喷幅</span><b>{activeMission.spray?.flow} L/min · {activeMission.spray?.swath} m</b></div>
                      <div className="kv"><span>比例锁 流量÷速度</span><b>{activeMission.spray?.flowPerSpeed}</b></div>
                      <div className="kv"><span>靶向格数</span><b>{activeMission.plan?.targetCells} 格 / {activeMission.plan?.targetClusters} 簇</b></div>
                      <div className="kv"><span>药耗</span><b style={{ color: 'var(--accent-2)' }}>{activeMission.plan?.estVolumeL} L</b></div>
                      {activeMission.plan?.savedRatioVsZone != null && (
                        <div className="kv"><span>相对整区节约</span><b style={{ color: 'var(--accent-2)' }}>{activeMission.plan.savedRatioVsZone}%</b></div>
                      )}
                    </>
                  ) : (
                    <div className="kv"><span>点位清单</span><b>{activeMission.plan?.targetCells} 格</b></div>
                  )}
                </div>

                {activeMission.recheckParts && (
                  <div className="sec">
                    <div className="sech"><NavIcon name="alert" size={13} />复核要点</div>
                    <div className="note">
                      需复核部位：{(activeMission.recheckParts || []).join('、')}。
                      根腐病发病在根茎部，空中不可见，必须由地面机器人近地取证后方可放行。
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ===== 下方：能力 + 作业单 + 联动闭环 + 今日结论 ===== */}
      <div className="grid g-2-1" style={{ marginBottom: 16, alignItems: 'stretch' }}>
        <div className="stack" style={{ gap: 16 }}>
          <div className="card">
            <h3>平台四大能力 <span className="tag">点击进入</span></h3>
            <div className="stack" style={{ gap: 8 }}>
              {CAPABILITIES.map(c => (
                <div key={c.id}
                  className="cap-row"
                  style={{ cursor: 'pointer' }}
                  onClick={() => onNav(c.id)}>
                  <span className="cap-art" style={{ color: c.color }}>
                    <c.icon size={26} color={c.color} />
                  </span>
                  <span className="cap-body">
                    <b className="cap-title">{c.title}</b>
                    <span className="cap-desc">{c.desc}</span>
                  </span>
                  <span className="cap-go">›</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3>靶向施药作业单 <span className="tag">{sprayMissions.length} 单</span></h3>
            {sprayMissions.length === 0 ? (
              <div className="empty">等待确诊病灶累积，自动派工</div>
            ) : (
              <div className="stack" style={{ gap: 8 }}>
                {sprayMissions.slice(0, 3).map(m => (
                  <div key={m.missionId} className="ev-row">
                    <div className="row" style={{ gap: 8 }}>
                      <span className="pill green">{m.zoneName || `${m.zoneId} 区`}</span>
                      <span className="spacer" />
                      <span className="xs mute">{m.spray?.agent}</span>
                    </div>
                    <div className="row" style={{ gap: 8, marginTop: 8 }}>
                      <span className="tag">飞行 {m.spray?.speed} m/s</span>
                      <span className="tag">喷洒 {m.spray?.flow} L/min</span>
                      <span className="tag">喷幅 {m.spray?.swath} m</span>
                    </div>
                    <div className="xs dim" style={{ marginTop: 8 }}>
                      靶向 {m.plan?.targetCells ?? '—'} 格 / {m.plan?.targetClusters ?? '—'} 簇，
                      比例锁 流量÷速度 = {m.spray?.flowPerSpeed}，药耗 {m.plan?.estVolumeL} L
                    </div>
                    <div className="xs dim" style={{ marginTop: 4 }}>
                      分区整喷 {m.plan?.uniformZoneL ?? '—'} L → 本单省 {m.plan?.savedVsZoneL ?? '—'} L
                      {m.plan?.savedRatioVsZone != null ? `（${m.plan.savedRatioVsZone}%）` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          <div className="card" style={{ flex: 1 }}>
            <h3>最近联动闭环 <span className="tag">{recentEvents.length} 条</span></h3>
            {recentEvents.length === 0 ? (
              <div className="empty">等待联动事件</div>
            ) : (
              <div className="stack" style={{ gap: 8 }}>
                {recentEvents.map(e => (
                  <div key={e.eventId} className="ev-row">
                    <div className="row" style={{ gap: 8 }}>
                      <span className="pill warn">{(e.latency.total / 1000).toFixed(1)}s</span>
                      <span className="xs mono mute">R{e.grid.row}C{e.grid.col}</span>
                      <span className="spacer" />
                      <span className="xs mute">{new Date(e.ts).toLocaleTimeString('zh-CN')}</span>
                    </div>
                    <div className="xs dim" style={{ marginTop: 4 }}>{e.trigger.reason}</div>
                    <div className="chain" style={{ marginTop: 8 }}>
                      {e.chain.map((c, i) => (
                        <React.Fragment key={i}>
                          {i > 0 && <span className="arrow">›</span>}
                          <span className="node on">{chainLabel(c)}</span>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 今日作业结论 + 行动清单：左右并排，填满整行 */}
      {briefing && (
        <div className="grid g-2-1">
          <div className="card">
            <h3>今日作业结论</h3>
            <div className="conclusion" style={{ marginBottom: 16 }}>{briefing.headline}</div>
            <div className="grid g4">
              {briefing.kpis.map(k => (
                <div className="kpi" key={k.label}>
                  <span className="label">{k.label}</span>
                  <span className="value" style={{ fontSize: 25 }}>{k.value}</span>
                  <span className="sub">{k.sub}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3>行动清单 <span className="tag">{briefing.actions.length} 条</span></h3>
            <div className="stack" style={{ gap: 8 }}>
              {briefing.actions.map((a, i) => (
                <div className="action" key={i}>
                  <div className={`pri ${a.priority}`}>{a.priority}</div>
                  <div className="body">
                    <div className="title">{a.action}</div>
                    <div className="detail">{a.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ---------- 时延分解条 ---------- */
function LatencyBar({ label, ms, total, tone = 'accent' }) {
  const pct = total > 0 ? Math.min(100, Math.max(2, (ms / total) * 100)) : 0;
  return (
    <div className="barl">
      <span>{label}</span>
      <span className="bw"><i className={tone} style={{ width: `${pct}%` }} /></span>
      <b className="mono">{(ms / 1000).toFixed(1)} s</b>
    </div>
  );
}

function chainLabel(c) {
  return {
    uav_detect: '空中发现',
    cloud_dispatch: '云端派单',
    robot_recheck: '机器人复核',
    cloud_confirm: '云端确认',
    uav_spray: '靶向喷洒',
  }[c] || c;
}

function diseaseName(code) {
  return {
    rust: '锈病',
    powdery: '白粉病',
    loose_smut: '散黑穗病',
    root_rot: '根腐病',
    fusarium: '赤霉病',
    leaf_blight: '叶枯病',
  }[code] || code;
}

function fmtTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}
