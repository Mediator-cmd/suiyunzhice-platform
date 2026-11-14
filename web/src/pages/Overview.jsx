import React from 'react';
import { CHART, MAP } from '../theme.js';
import { FieldMap, DISEASE_COLOR } from '../components/FieldMap.jsx';

export default function Overview({ meta, devices, telemetry, detections, events, overview, briefing, mode, onNav }) {
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
    { label: '药液节约率', value: eff.savedRatio == null ? '待作业' : `${eff.savedRatio}%`, sub: eff.savedRatio == null ? '尚无喷洒任务' : `累计少用 ${eff.savedVolumeL || 0} L`, cls: 'green' },
  ];

  const recentEvents = (events || []).slice(0, 6);
  const latestTelemetry = (telemetry || []).slice(-30).reverse();

  return (
    <>
      <div className="page-head">
        <h2>平台总览</h2>
        <p>
          面向小麦病害防控的空地协同精准施药系统。植保无人机负责空中广域巡查，地面监测机器人负责近距复核，
          云端平台完成数据接入、实时决策、多维分析与作业下发，形成「监测—决策—执行—反馈」闭环。
        </p>
      </div>

      {/* KPI */}
      <div className="grid g5" style={{ marginBottom: 12 }}>
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

      {/* 地图 + 侧栏 */}
      <div className="grid g-2-1" style={{ marginBottom: 12 }}>
        <div className="card pad0" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '13px 15px 0' }}>
            <h3>地块态势 <span className="tag">实时</span></h3>
          </div>
          <FieldMap field={meta.field} devices={devices} detections={detections} events={events} height={430} />
          <div style={{ padding: '9px 15px 13px' }}>
            <div className="legend">
              <span><i style={{ background: CHART.blue }} />植保无人机</span>
              <span><i style={{ background: CHART.purple }} />地面监测机器人</span>
              <span><i style={{ background: CHART.amber }} />联动事件</span>
              <span><i style={{ background: CHART.green }} />规划航线</span>
              <span><i style={{ background: MAP.obstacleStroke }} />障碍区</span>
              {Object.entries(DISEASE_COLOR).map(([k, v]) => (
                <span key={k}><i style={{ background: v }} />{meta.diseases.find(d => d.code === k)?.name || k}</span>
              ))}
            </div>
          </div>
        </div>

        <div className="stack">
          <div className="card">
            <h3>平台四大能力</h3>
            <div className="stack" style={{ gap: 9 }}>
              {[
                ['① 实时数据传输', '无人机/机器人经 WebSocket 遥测通道按 5Hz 上报，云端 ACK 计时，端到端时延可量化；弱网环境支持批量补传。', 'onNav', 'realtime'],
                ['② 多维统计分析', '空间/时间/病害/平台/作业/环境六维，每维输出可直接执行的农户结论，而非仅图表。', 'onNav', 'analytics'],
                ['③ 空地实时联动', '空中发现→置信度判定→派单机器人→近距复核→确认→靶向喷洒，全链时延逐段可查。', 'onNav', 'linkage'],
                ['④ 自动路径规划', '航向/速度/喷幅联合搜索，自动求解速度-喷洒比例，按经济/快速/环保三目标打分。', 'onNav', 'planner'],
              ].map(([t, d, _, id]) => (
                <div key={t} style={{ cursor: 'pointer' }} onClick={() => onNav(id)}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent-2)' }}>{t}</div>
                  <div className="small dim" style={{ marginTop: 2 }}>{d}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <h3>最近联动闭环</h3>
            {recentEvents.length === 0 ? (
              <div className="empty">等待联动事件…（低置信度或根茎部病害将自动触发机器人复核）</div>
            ) : (
              <div className="stack" style={{ gap: 8 }}>
                {recentEvents.map(e => (
                  <div key={e.eventId} style={{ borderLeft: '2px solid var(--warn)', paddingLeft: 9 }}>
                    <div className="row" style={{ gap: 6 }}>
                      <span className="pill warn">{(e.latency.total / 1000).toFixed(1)}s</span>
                      <span className="xs mono mute">R{e.grid.row}C{e.grid.col}</span>
                      <span className="xs mute">{new Date(e.ts).toLocaleTimeString('zh-CN')}</span>
                    </div>
                    <div className="xs dim" style={{ marginTop: 3 }}>{e.trigger.reason}</div>
                    <div className="chain" style={{ marginTop: 4 }}>
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

      {/* 结论 */}
      {briefing && (
        <div className="card">
          <h3>今日作业结论</h3>
          <div className="conclusion" style={{ marginBottom: 11 }}>{briefing.headline}</div>
          <div className="grid g4">
            {briefing.kpis.map(k => (
              <div className="kpi" key={k.label}>
                <span className="label">{k.label}</span>
                <span className="value" style={{ fontSize: 21 }}>{k.value}</span>
                <span className="sub">{k.sub}</span>
              </div>
            ))}
          </div>
          <div className="grid g2" style={{ marginTop: 12 }}>
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
      )}
    </>
  );
}

export function chainLabel(c) {
  return {
    uav_detect: '空中发现',
    cloud_dispatch: '云端派单',
    robot_recheck: '机器人复核',
    cloud_confirm: '云端确认',
    uav_spray: '靶向喷洒',
  }[c] || c;
}
