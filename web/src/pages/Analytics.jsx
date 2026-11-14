import { CHART } from '../theme.js';
import React, { useEffect, useState, useMemo } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip,
  CartesianGrid, Legend, PieChart, Pie, Cell, AreaChart, Area, LineChart, Line,
} from 'recharts';

const COLORS = CHART.series;

const DIM_LABEL = {
  spatial: '空间维度', temporal: '时间维度', disease: '病害维度',
  platform: '平台维度', task: '作业维度', environment: '环境维度',
};

export default function Analytics({ meta, loadDimension, detections }) {
  const [dim, setDim] = useState('spatial');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    loadDimension(dim).then(d => { if (alive) { setData(d); setLoading(false); } });
    return () => { alive = false; };
  }, [dim, loadDimension]);

  const dims = meta?.dimensions || [];

  return (
    <>
      <div className="page-head">
        <h2>数据分析 · 六个维度</h2>
        <p>
          数据统计分析分成哪些维度？—— 空间、时间、病害、平台、作业、环境。
          每一个维度不只给图表，而是同时给出「这意味着农户该做什么」的结论。
        </p>
      </div>

      {/* 维度切换 */}
      <div className="row wrap" style={{ marginBottom: 12, gap: 6 }}>
        {dims.map(d => (
          <button key={d.key}
            className={`btn ${dim === d.key ? 'primary' : ''}`}
            onClick={() => setDim(d.key)}
            title={d.desc}>
            {d.name}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <div className="card"><div className="empty">正在统计…</div></div>
      ) : data && (
        <>
          <div className="card" style={{ marginBottom: 12 }}>
            <h3>{data.name} <span className="tag">{data.rows?.length ?? 0} 条记录</span></h3>
            <p className="hint">{data.desc}</p>
            {data.insight?.length > 0 && (
              <ul className="insights">
                {data.insight.slice(0, 6).map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            )}
          </div>

          {dim === 'spatial' && <SpatialView data={data} meta={meta} detections={detections} />}
          {dim === 'temporal' && <TemporalView data={data} />}
          {dim === 'disease' && <DiseaseView data={data} />}
          {dim === 'platform' && <PlatformView data={data} />}
          {dim === 'task' && <TaskView data={data} />}
          {dim === 'environment' && <EnvironmentView data={data} />}
        </>
      )}
    </>
  );
}

/* ---------------- 空间维度 ---------------- */
function SpatialView({ data, meta, detections }) {
  const heat = useMemo(() => {
    if (!meta?.field) return [];
    const f = meta.field;
    const cw = f.widthM / f.gridCols, ch = f.heightM / f.gridRows;
    return (data.rows || []).map(r => ({
      x: (r.col + 0.5) * cw, y: (r.row + 0.5) * ch,
      z: r.density, row: r.row, col: r.col,
    }));
  }, [data, meta]);

  const top = (data.rows || []).slice(0, 12);

  return (
    <div className="grid g-2-1">
      <div className="card">
        <h3>网格密度分布 <span className="tag">空间热度</span></h3>
        <p className="hint">横轴为网格列，纵轴为网格行，颜色越亮表示该网格检出量越多。</p>
        <Heatmap rows={data.rows || []} field={meta?.field} />
      </div>
      <div className="card">
        <h3>高密度网格 Top 12</h3>
        <table className="tbl">
          <thead><tr><th>网格</th><th className="right">检出</th><th className="right">置信度</th><th>主病种</th><th>状态</th></tr></thead>
          <tbody>
            {top.map(r => (
              <tr key={`${r.row}_${r.col}`}>
                <td className="mono xs">R{r.row}C{r.col}</td>
                <td className="num">{r.density}</td>
                <td className="num">{(r.avgConfidence * 100).toFixed(0)}%</td>
                <td className="xs">{diseaseName(r.topDisease)}</td>
                <td>{r.sprayed ? <span className="pill ok">已施药</span> : <span className="pill warn">待处置</span>}</td>
              </tr>
            ))}
            {top.length === 0 && <tr><td colSpan={5}><div className="empty">暂无空间统计</div></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Heatmap({ rows, field }) {
  if (!field) return <div className="empty">无地块信息</div>;
  const map = new Map(rows.map(r => [`${r.row}_${r.col}`, r]));
  const cells = [];
  for (let r = 0; r < field.gridRows; r++) {
    for (let c = 0; c < field.gridCols; c++) {
      const g = map.get(`${r}_${c}`);
      const d = g?.density || 0;
      cells.push(
        <div key={`${r}_${c}`} title={d ? `R${r}C${c} · 检出 ${d} 处` : ''} style={{
          // 检出越密颜色越深；无检出的格子保持浅灰，与地块底色一致
          background: d === 0 ? 'var(--panel-2)' : `rgba(220,38,38,${Math.min(0.88, 0.4 + d * 0.12)})`,
          border: d === 0 ? '1px solid var(--border)' : '1px solid rgba(185,28,28,.25)',
        }} />
      );
    }
  }
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${field.gridCols}, 1fr)`,
      // 网格按地块实际长宽比渲染，而不是压成方形
      gridAutoRows: '1fr',
      gap: 1,
      aspectRatio: `${field.widthM} / ${field.heightM}`,
      maxHeight: 420,
      borderRadius: 4, overflow: 'hidden',
      background: 'var(--panel-2)',
    }}>{cells}</div>
  );
}

/* ---------------- 时间维度 ---------------- */
function TemporalView({ data }) {
  return (
    <div className="grid g-2-1">
      <div className="card">
        <h3>检出与施药趋势</h3>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={data.rows || []}>
            <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
            <XAxis dataKey="day" stroke={CHART.axis} tick={{ fontSize: 10 }} />
            <YAxis stroke={CHART.axis} tick={{ fontSize: 10 }} />
            <RTooltip contentStyle={{ background: CHART.tooltipBg, border: `1px solid ${CHART.tooltipBorder}`, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11.5 }} />
            <Area type="monotone" dataKey="count" name="检出量" stroke={CHART.blue} fill={CHART.blue} fillOpacity={0.22} />
            <Area type="monotone" dataKey="sprays" name="施药任务数" stroke={CHART.green} fill={CHART.green} fillOpacity={0.16} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="card">
        <h3>逐日明细</h3>
        <table className="tbl">
          <thead><tr><th>日期</th><th className="right">检出</th><th className="right">均信</th><th className="right">施药</th></tr></thead>
          <tbody>
            {(data.rows || []).map(r => (
              <tr key={r.day}>
                <td className="mono xs">{r.day}</td>
                <td className="num">{r.count}</td>
                <td className="num">{(r.avgConfidence * 100).toFixed(0)}%</td>
                <td className="num">{r.sprays ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- 病害维度 ---------------- */
function DiseaseView({ data }) {
  const rows = (data.rows || []).filter(r => r.count > 0);
  const pie = rows.map(r => ({ name: r.name, value: r.count }));
  return (
    <div className="grid g-1-2">
      <div className="card">
        <h3>病种分布</h3>
        {pie.length === 0 ? <div className="empty">暂无数据</div> : (
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={78} innerRadius={42}>
                {pie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <RTooltip contentStyle={{ background: CHART.tooltipBg, border: `1px solid ${CHART.tooltipBorder}`, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11.5 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
      <div className="card">
        <h3>分病种防治建议 <span className="tag">可执行结论</span></h3>
        <table className="tbl">
          <thead><tr><th>病种</th><th>拉丁名</th><th>发病部位</th><th className="right">检出</th><th>建议</th></tr></thead>
          <tbody>
            {(data.rows || []).map(r => (
              <tr key={r.code}>
                <td><b>{r.name}</b></td>
                <td className="xs mute" style={{ fontStyle: 'italic' }}>{r.latin}</td>
                <td className="xs">{r.mainPart}</td>
                <td className="num">{r.count}</td>
                <td className="xs dim" style={{ whiteSpace: 'normal', maxWidth: 300 }}>{r.advice}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- 平台维度 ---------------- */
function PlatformView({ data }) {
  return (
    <div className="grid g2">
      {(data.rows || []).map(r => (
        <div className="card" key={r.kind}>
          <div className="row" style={{ marginBottom: 7 }}>
            <span className={`pill ${r.kind}`} style={{ fontSize: 12.5, padding: '3px 11px' }}>
              {r.kind === 'uav' ? '植保无人机' : '地面监测机器人'}
            </span>
            <span className="spacer" />
            <span className="mono" style={{ fontSize: 21, color: r.kind === 'uav' ? 'var(--uav)' : 'var(--robot)' }}>
              {r.count}
            </span>
          </div>
          <div className="xs dim" style={{ marginBottom: 8 }}>{r.role}</div>
          <div className="row" style={{ gap: 10, marginBottom: 8 }}>
            <span className="xs dim">平均置信度</span>
            <div className="bar" style={{ flex: 1 }}>
              <i style={{ width: `${(r.avgConfidence * 100).toFixed(0)}%`, background: r.kind === 'uav' ? 'var(--uav)' : 'var(--robot)' }} />
            </div>
            <span className="xs mono">{(r.avgConfidence * 100).toFixed(0)}%</span>
          </div>
          <div className="row wrap" style={{ gap: 5 }}>
            {Object.entries(r.parts || {}).map(([part, n]) => (
              <span key={part} className="pill xs">{partLabel(part)} × {n}</span>
            ))}
          </div>
        </div>
      ))}
      {data.insight?.length > 0 && (
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <h3>分工结论</h3>
          <ul className="insights">{data.insight.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

/* ---------------- 作业维度 ---------------- */
function TaskView({ data }) {
  const s = data.summary || {};
  return (
    <>
      <div className="grid g4" style={{ marginBottom: 12 }}>
        {[
          ['喷洒任务数', s.sprayTasks ?? 0, '单', ''],
          ['累计药耗', `${s.totalVolumeL ?? 0}`, 'L', 'green'],
          ['累计作业时长', `${s.totalMinutes ?? 0}`, 'min', 'blue'],
          ['单任务平均', `${s.avgMinutes ?? 0}`, 'min', 'amber'],
        ].map(([label, val, unit, cls]) => (
          <div className="card" key={label}>
            <div className="kpi">
              <span className="label">{label}</span>
              <span className={`value ${cls}`}>{val}<span className="xs mute"> {unit}</span></span>
            </div>
          </div>
        ))}
      </div>
      <div className="card">
        <h3>任务明细</h3>
        <div className="table-scroll">
          <table className="tbl">
            <thead><tr>
              <th>时间</th><th>网格</th><th>病害</th><th className="right">航速</th><th className="right">流量</th>
              <th className="right">药量</th><th className="right">时长</th><th>状态</th>
            </tr></thead>
            <tbody>
              {(data.rows || []).map(r => (
                <tr key={r.missionId}>
                  <td className="mono xs mute nowrap">{new Date(r.ts).toLocaleTimeString('zh-CN', { hour12: false })}</td>
                  <td className="mono xs">R{r.grid.row}C{r.grid.col}</td>
                  <td className="xs">{r.disease ? diseaseName(r.disease) : '—'}</td>
                  <td className="num">{r.speed ?? '—'}</td>
                  <td className="num">{r.flow ?? '—'}</td>
                  <td className="num">{r.volumeL ?? '—'}</td>
                  <td className="num">{r.minutes ?? '—'}</td>
                  <td><span className={`pill ${r.status === 'done' ? 'ok' : 'warn'}`}>{statusLabel(r.status)}</span></td>
                </tr>
              ))}
              {(data.rows || []).length === 0 && (
                <tr><td colSpan={8}><div className="empty">暂无喷洒任务</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ---------------- 环境维度 ---------------- */
function EnvironmentView({ data }) {
  return (
    <div className="grid g-2-1">
      <div className="card">
        <h3>各时段检出与置信度</h3>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data.rows || []}>
            <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
            <XAxis dataKey="label" stroke={CHART.axis} tick={{ fontSize: 10 }} />
            <YAxis yAxisId="l" stroke={CHART.axis} tick={{ fontSize: 10 }} />
            <YAxis yAxisId="r" orientation="right" stroke={CHART.axis} tick={{ fontSize: 10 }} domain={[0, 1]} />
            <RTooltip contentStyle={{ background: CHART.tooltipBg, border: `1px solid ${CHART.tooltipBorder}`, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 11.5 }} />
            <Bar yAxisId="l" dataKey="count" name="检出量" fill={CHART.blue} />
            <Line yAxisId="r" dataKey="avgConfidence" name="平均置信度" stroke={CHART.green} strokeWidth={2} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="card">
        <h3>作业窗口建议</h3>
        <div className="stack" style={{ gap: 8 }}>
          {(data.rows || []).map(r => (
            <div key={r.label} style={{ padding: '9px 11px', background: 'var(--panel-2)', borderRadius: 6 }}>
              <div className="row">
                <b className="small">{r.label}</b>
                <span className="spacer" />
                <span className="xs mono mute">{r.count} 处 · {(r.avgConfidence * 100).toFixed(0)}%</span>
              </div>
              <div className="xs dim" style={{ marginTop: 3 }}>{r.sprayAdvice}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- helpers ---------------- */
function diseaseName(code) {
  if (!code) return '—';
  return ({ rust: '锈病', powdery: '白粉病', loose_smut: '散黑穗病',
    root_rot: '根腐病', fusarium: '赤霉病', leaf_blight: '叶枯病' })[code] || code;
}
function partLabel(p) {
  return ({ canopy: '冠层', leaf: '叶面', underside: '叶下', stem: '根茎部', soil: '土壤' })[p] || p;
}
function statusLabel(s) {
  return ({ pending: '待派单', approved: '已批准', dispatched: '已下发',
    running: '执行中', done: '已完成', rejected: '已驳回' })[s] || s;
}
