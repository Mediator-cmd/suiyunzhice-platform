import React, { useMemo } from 'react';
import { DISEASES } from '../../../shared/schema.js';
import { DISEASE_COLOR } from './FieldMap.jsx';

/**
 * 网格档案抽屉 —— 点击地图上的病害网格后展开
 *
 * 这一条交互是「识别结果—地块—坐标—任务」全链路可追溯的落点：
 *   一次识别 → 落到哪个网格（地块+坐标）
 *            → 这个网格被派过哪些任务
 *            → 任务是否已执行、用了多少药
 * 申报书里「每一条识别结论绑定唯一地块编号」这句话，在这里是可点的。
 */

const DISEASE_NAME = Object.fromEntries(DISEASES.map(d => [d.code, d.name]));

function photoLink(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value, document.baseURI);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

export default function GridDetail({ grid, detections, missions, events, onClose }) {
  const inGrid = useMemo(() => {
    if (!grid) return [];
    return (detections || []).filter(d => d.grid?.row === grid.row && d.grid?.col === grid.col);
  }, [grid, detections]);

  const gridEvents = useMemo(() => {
    if (!grid) return [];
    return (events || []).filter(e => e.grid?.row === grid.row && e.grid?.col === grid.col);
  }, [grid, events]);

  const gridMissions = useMemo(() => {
    if (!grid) return [];
    return (missions || []).filter(m => {
      if (m.type !== 'spray') return false;
      const cells = m.target?.cells || [];
      if (!cells.length) return false;
      return cells.some(c => c.row === grid.row && c.col === grid.col);
    });
  }, [grid, missions]);

  const byDisease = useMemo(() => {
    const m = new Map();
    for (const d of inGrid) {
      const k = d.disease || 'unknown';
      const cur = m.get(k) || { count: 0, maxConf: 0, parts: new Set() };
      cur.count += 1;
      cur.maxConf = Math.max(cur.maxConf, d.confidence || 0);
      cur.parts.add(d.part);
      m.set(k, cur);
    }
    return [...m.entries()].sort((a, b) => b[1].count - a[1].count);
  }, [inGrid]);

  if (!grid) return null;
  const photos = inGrid.filter(item => photoLink(item.imageUrl));

  const avgConf = inGrid.length
    ? inGrid.reduce((a, d) => a + (d.confidence || 0), 0) / inGrid.length : 0;
  const confirmed = inGrid.filter(d => (d.confidence || 0) >= 0.75).length;
  const totalVolume = gridMissions.reduce((a, m) => a + (m.plan?.estVolumeL || 0), 0);

  return (
    <div className="grid-detail">
      <div className="grid-detail-head">
        <span className="grid-detail-title">网格 R{grid.row} C{grid.col}</span>
        <span className="pill">5 m × 5 m</span>
        <span className="spacer" />
        <button className="btn" onClick={onClose} aria-label="关闭网格档案">关闭</button>
      </div>

      {inGrid.length === 0 ? (
        <div className="empty">该网格暂无识别结果</div>
      ) : (
        <>
          <div className="grid-detail-kpis">
            {[
              ['检出次数', `${inGrid.length} 次`],
              ['平均置信度', `${(avgConf * 100).toFixed(0)}%`],
              ['确诊', `${confirmed} 处`],
              ['相关任务', `${gridMissions.length} 单`],
            ].map(([l, v]) => (
              <div className="kpi" key={l}>
                <span className="label">{l}</span>
                <span className="value" style={{ fontSize: 20 }}>{v}</span>
              </div>
            ))}
          </div>

          <div className="grid-detail-sec">
            <div className="grid-detail-sec-h">病种分布</div>
            <div className="row wrap" style={{ gap: 8 }}>
              {byDisease.map(([code, info]) => (
                <span key={code} className="pill" style={{
                  color: DISEASE_COLOR[code], borderColor: DISEASE_COLOR[code],
                  background: '#ffffff',
                }}>
                  {DISEASE_NAME[code] || code} · {info.count} 处 · {(info.maxConf * 100).toFixed(0)}%
                </span>
              ))}
            </div>
          </div>

          <div className="grid-detail-sec">
            <div className="grid-detail-sec-h">联动事件 <span className="xs mute">{gridEvents.length} 条</span></div>
            {gridEvents.length === 0 ? (
              <div className="xs mute">无</div>
            ) : (
              <div className="stack" style={{ gap: 4 }}>
                {gridEvents.slice(0, 4).map(e => (
                  <div key={e.eventId} className="xs">
                    <span className="mono mute">{new Date(e.ts).toLocaleTimeString('zh-CN', { hour12: false })}</span>
                    {' · '}
                    <span className={(e.closed ? 'green' : 'amber')}>
                      {e.closed ? '已闭环' : '待复核回传'}
                    </span>
                    {' · '}
                    总时延 {((e.latency?.total || 0) / 1000).toFixed(1)} s
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="grid-detail-sec">
            <div className="grid-detail-sec-h">派工与药耗 <span className="xs mute">{gridMissions.length} 单</span></div>
            {gridMissions.length === 0 ? (
              <div className="xs mute">尚未派发靶向作业单</div>
            ) : (
              <div className="stack" style={{ gap: 4 }}>
                {gridMissions.map(m => (
                  <div key={m.missionId} className="xs">
                    <span className="pill green" style={{ fontSize: 11 }}>{m.zoneName || m.zoneId}</span>
                    {' '}{m.spray?.agent} · 药耗 {m.plan?.estVolumeL} L ·
                    速度 {m.spray?.speed} m/s · 流量 {m.spray?.flow} L/min
                  </div>
                ))}
                {totalVolume > 0 && (
                  <div className="xs green">本网格累计药耗 {totalVolume} L</div>
                )}
              </div>
            )}
          </div>

          {photos.length > 0 && <details><summary>识别原图 · {photos.length} 张</summary>
            {photos.map(item => <div key={item.detId}><a href={photoLink(item.imageUrl)} target="_blank" rel="noreferrer">{DISEASE_NAME[item.disease] || item.disease} · {new Date(item.ts).toLocaleTimeString('zh-CN')} · 查看原图</a></div>)}
          </details>}
          <div className="xs mute" style={{ marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            最近一次识别：{new Date(Math.max(...inGrid.map(d => d.ts || 0))).toLocaleString('zh-CN')}
            {' · '}模型 {inGrid[0]?.model || 'SAN-GAT-RL'}
          </div>
        </>
      )}
    </div>
  );
}
