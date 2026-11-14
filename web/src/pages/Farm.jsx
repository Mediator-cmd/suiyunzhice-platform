import React from 'react';
import { FieldMap } from '../components/FieldMap.jsx';

export default function Farm({ meta, briefing, detections, devices, events, missions }) {
  if (!briefing) return <div className="empty">正在生成农户简报…</div>;

  const byDisease = new Map();
  for (const d of detections || []) {
    byDisease.set(d.disease, (byDisease.get(d.disease) || 0) + 1);
  }
  const sprayMissions = (missions || []).filter(m => m.type === 'spray');

  return (
    <>
      <div className="page-head">
        <h2>农户服务 · 今天该做什么</h2>
        <p>把多维统计翻译成可执行的动作清单：先喷哪里、喷什么药、什么时候喷、省了多少钱。</p>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <div className="conclusion">
          <b>今日结论：</b>{briefing.headline}
        </div>
        <div className="grid g4" style={{ marginTop: 12 }}>
          {briefing.kpis.map(k => (
            <div className="kpi" key={k.label}>
              <span className="label">{k.label}</span>
              <span className="value green" style={{ fontSize: 26 }}>{k.value}</span>
              <span className="sub">{k.sub}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid g-2-1" style={{ marginBottom: 12 }}>
        <div className="card">
          <h3>行动清单 <span className="tag">按优先级</span></h3>
          <div className="stack" style={{ gap: 9 }}>
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

        <div className="card">
          <h3>病种分布速览</h3>
          <table className="tbl">
            <thead><tr><th>病种</th><th className="right">检出</th><th>防治窗口</th></tr></thead>
            <tbody>
              {Array.from(byDisease.entries()).sort((a, b) => b[1] - a[1]).map(([code, n]) => (
                <tr key={code}>
                  <td>{DISEASE_NAME[code] || code}</td>
                  <td className="num">{n}</td>
                  <td className="xs dim">{WINDOW[code] || '—'}</td>
                </tr>
              ))}
              {byDisease.size === 0 && <tr><td colSpan={3}><div className="empty">暂无检出</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card pad0" style={{ overflow: 'hidden', marginBottom: 12 }}>
        <div style={{ padding: '13px 15px 0' }}><h3>我的地块</h3></div>
        <FieldMap field={meta?.field} devices={devices} detections={detections} events={events} missions={missions} height={380} />
      </div>

      <div className="card">
        <h3>今日施药作业单 <span className="tag">{sprayMissions.length} 单</span></h3>
        {sprayMissions.length === 0 ? (
          <div className="empty">确诊病灶累积后自动派工，作业单会显示喷洒区、药剂与速度-喷洒比例</div>
        ) : (
          <table className="tbl">
            <thead>
              <tr>
                <th>喷洒区</th><th>药剂</th><th className="right">飞行速度</th>
                <th className="right">喷洒流量</th><th className="right">药耗</th><th className="right">节药</th>
              </tr>
            </thead>
            <tbody>
              {sprayMissions.map(m => (
                <tr key={m.missionId}>
                  <td><b>{m.zoneName || `${m.zoneId} 区`}</b></td>
                  <td className="xs">{m.spray?.agent}</td>
                  <td className="num">{m.spray?.speed} m/s</td>
                  <td className="num">{m.spray?.flow} L/min</td>
                  <td className="num">{m.plan?.estVolumeL} L</td>
                  <td className="num"><span className="green">−{m.plan?.savedVsUniformL} L</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

const DISEASE_NAME = {
  rust: '锈病', powdery: '白粉病', loose_smut: '散黑穗病',
  root_rot: '根腐病', fusarium: '赤霉病', leaf_blight: '叶枯病',
};

const WINDOW = {
  rust: '初发期即抢防，7–10 天复查',
  powdery: '轻症物理防治，重症三唑酮',
  loose_smut: '播种期拌种，拔节期无法补救',
  root_rot: '近地确认后结合墒情评估',
  fusarium: '显症即抢防，单独标记区域',
  leaf_blight: '作为长势指标，慎用农药',
};
