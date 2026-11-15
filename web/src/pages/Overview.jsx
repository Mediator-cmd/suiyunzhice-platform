import React from 'react';
import { CHART, MAP } from '../theme.js';
import { FieldMap, DISEASE_COLOR } from '../components/FieldMap.jsx';
import {
  IconScan, IconChart, IconDispatch, IconRoute,
} from '../components/Icons.jsx';

const CAPABILITIES = [
  { icon: IconScan,    title: '实时数据传输', desc: '5Hz 遥测上报，弱网批量补传，时延可量化', id: 'realtime',  color: 'var(--uav)' },
  { icon: IconDispatch,title: '空地实时联动', desc: '发现→派单→复核→确认→喷洒，全链时延可查', id: 'linkage',   color: 'var(--accent)' },
  { icon: IconChart,   title: '多维统计分析', desc: '六维并行统计，每维输出可执行结论',       id: 'analytics', color: 'var(--warn)' },
  { icon: IconRoute,   title: '自动路径规划', desc: '航向×速度×喷幅联合搜索，三目标打分',       id: 'planner',   color: 'var(--robot)' },
];

export default function Overview({ meta, devices, telemetry, detections, events, overview, briefing, missions, mode, onNav }) {
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
    { label: '药液节约率', value: eff.savedRatio == null ? '待作业' : `${eff.savedRatio}%`, sub: eff.savedRatio == null ? '尚无喷洒任务' : `对比整田均匀喷施少用 ${eff.savedVolumeL || 0} L`, cls: 'green' },
  ];

  const recentEvents = (events || []).slice(0, 5);
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

      {/* 地图 + 侧栏：等高排布，避免大片留白 */}
      <div className="grid g-2-1" style={{ marginBottom: 16, alignItems: 'stretch' }}>
        <div className="card pad0" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 24px 0' }}>
            <h3>
              地块态势
              <span className="tag">实时</span>
              <span className="spacer" />
              <span className="xs mono mute">
                {f.name} · {f.widthM}×{f.heightM} m · {f.areaHa?.toFixed(1)} ha
              </span>
            </h3>
          </div>
          <FieldMap field={meta.field} devices={devices} detections={detections} events={events} missions={missions} height={504} />
          <div style={{ padding: '8px 24px 16px' }}>
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
                      比例锁 流量÷速度 = {m.spray?.flowPerSpeed}，药耗 {m.plan?.estVolumeL} L，
                      较整田均匀喷施（{f.areaHa?.toFixed(1)} ha × 12 L/ha）省 {m.plan?.savedVsUniformL} L
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

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

function chainLabel(c) {
  return {
    uav_detect: '空中发现',
    cloud_dispatch: '云端派单',
    robot_recheck: '机器人复核',
    cloud_confirm: '云端确认',
    uav_spray: '靶向喷洒',
  }[c] || c;
}
