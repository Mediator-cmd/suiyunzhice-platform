import React, { useEffect, useMemo, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip,
  CartesianGrid, LineChart, Line, Legend, Cell,
} from 'recharts';
import { CHART } from '../theme.js';
import { api } from '../api.js';
import { RESEARCH_FIGURES, FIGURE_GROUPS, figureSrc } from '../research-figures.js';

/**
 * 算法基准页 —— 把研究代码的实验结论变成平台内可查、可引用的数据
 *
 * 这一页有两类数据，**必须分开标注**：
 *   ① 「离线实验基准」：队友交付的研究代码在仿真数据上跑出的实验结果，
 *      在平台内是固化数据集（只读）。检测 mAP、融合精度、漂移曲线等属此类。
 *   ② 「平台实时计算」：协同规划内核在当前病害网格与实时风场下现场算出，
 *      答辩现场可现场改参数、立即看到结果变化。
 *
 * 混着说会被评委当场问倒：一个是离线实验，一个是平台在线算的，
 * 而且检测基准是**渲染合成数据集**上的结果，不是田间实测。
 */

const TABS = [
  { key: 'detection', label: '检测模型' },
  { key: 'planning', label: '协同规划' },
  { key: 'fusion', label: '多传感器融合' },
  { key: 'spray', label: '施药与沉积' },
  { key: 'live', label: '平台实时计算' },
  { key: 'figures', label: '实验图集' },
];

const pct = (v, d = 1) => (v == null ? '—' : `${(v * 100).toFixed(d)}%`);
const num = (v, d = 2) => (v == null ? '—' : Number(v).toFixed(d));

export default function Algorithms({ onNav }) {
  const [tab, setTab] = useState('detection');
  const [bench, setBench] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    if (tab === 'figures') { setLoading(false); return undefined; }
    setLoading(true);
    api.algoBenchmark(tab === 'live' ? 'detection' : tab)
      .then(r => { if (alive) setBench(r); })
      .catch(() => { if (alive) setBench(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [tab]);

  return (
    <div>
      <div className="page-head">
        <h2>算法基准</h2>
        <p>
          研究代码的实验结论在平台内可查、可引用：检测模型对照、多机协同规划、
          多传感器融合精度、变量施药与雾滴沉积。四组离线实验数据 + 一组平台实时计算，
          后者可现场调参立即见效。
        </p>
      </div>

      <div className="tabs" role="tablist">
        {TABS.map(t => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className={`tab ${tab === t.key ? 'on' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <div className="empty">正在加载算法基准…</div>}
      {!loading && tab !== 'live' && tab !== 'figures' && bench?.benchmark && (
        <BenchView key={tab} bench={bench.benchmark} notice={bench.notice} />
      )}
      {!loading && tab === 'live' && <LiveView onNav={onNav} />}
      {!loading && tab === 'figures' && <FiguresView onPick={setTab} />}
    </div>
  );
}

/* =====================================================================
 * 离线实验基准
 * ===================================================================== */

function BenchView({ bench, notice }) {
  if (bench.id.startsWith('rfag-pda')) return <DetectionBench bench={bench} notice={notice} />;
  if (bench.id.startsWith('swarm-planning')) return <PlanningBench bench={bench} notice={notice} />;
  if (bench.id.startsWith('multisensor')) return <FusionBench bench={bench} notice={notice} />;
  return <SprayBench bench={bench} notice={notice} />;
}

/* =====================================================================
 * 实验图集
 * ===================================================================== */

/** 图 → 承载其数字的标签页（图只是可视化，结论在数据里） */
const FIGURE_DATA_TAB = {
  detection: 'detection',
  fusion: 'fusion',
  planning: 'planning',
  spray: 'spray',
  feedback: 'spray',
  architecture: 'planning',
  terrain: 'detection',
};

/** 一组实验图（图号 + 标题 + 图 + 图注），供各数据页内嵌 */
function PaperFigureGroup({ ids, columns = 2 }) {
  return (
    <div className="grid g2">
      {ids.map(id => {
        const f = RESEARCH_FIGURES.find(x => x.id === id);
        if (!f) return null;
        return (
          <figure className="card" key={f.id} style={{ margin: 0 }}>
            <img
              src={figureSrc(f.id)}
              alt={f.alt}
              loading="lazy"
              style={{
                width: '100%',
                display: 'block',
                borderRadius: 8,
                background: '#fff',
                border: '1px solid var(--line)',
              }}
            />
            <figcaption style={{ marginTop: 10 }}>
              <div className="sub-title">
                <span className="chip">{f.paper}</span>
                {f.title}
              </div>
              <p className="hint" style={{ margin: '6px 0 0' }}>{f.caption}</p>
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

function FiguresView({ onPick }) {
  const [group, setGroup] = useState('all');
  const list = useMemo(
    () => (group === 'all'
      ? RESEARCH_FIGURES
      : RESEARCH_FIGURES.filter(f => f.group === group)),
    [group]
  );

  return (
    <div>
      <div className="notice-line">
        <span className="chip mute">实验图集</span>
        <span>
          队友交付的 18 张矢量图（matplotlib 生成），已转 WebP 静态托管。
          图是数据的可视化 —— 每张图对应的数字在下方标注的数据页里，
          两者口径一致。
        </span>
        <span className="src mono">E:\挑战杯\新加入材料\矢图打包(1)</span>
      </div>

      <div className="tabs small" style={{ marginBottom: 14 }}>
        <button
          className={`tab ${group === 'all' ? 'on' : ''}`}
          onClick={() => setGroup('all')}
        >
          全部 {RESEARCH_FIGURES.length}
        </button>
        {FIGURE_GROUPS.map(g => {
          const n = RESEARCH_FIGURES.filter(f => f.group === g.id).length;
          if (!n) return null;
          return (
            <button
              key={g.id}
              className={`tab ${group === g.id ? 'on' : ''}`}
              onClick={() => setGroup(g.id)}
            >
              {g.label} {n}
            </button>
          );
        })}
      </div>

      <div className="grid g2">
        {list.map(f => {
          const tab = FIGURE_DATA_TAB[f.group];
          return (
            <figure className="card" key={f.id} style={{ margin: 0 }}>
              <img
                src={figureSrc(f.id)}
                alt={f.alt}
                loading="lazy"
                style={{
                  width: '100%',
                  display: 'block',
                  borderRadius: 8,
                  background: '#fff',
                  border: '1px solid var(--line)',
                }}
              />
              <figcaption style={{ marginTop: 10 }}>
                <div className="sub-title">
                  <span className="chip">{f.paper}</span>
                  {f.title}
                </div>
                <p className="hint" style={{ margin: '6px 0 0' }}>{f.caption}</p>
                <button
                  className="link-btn"
                  style={{ marginTop: 8 }}
                  onClick={() => onPick(tab)}
                >
                  查看对应数据 →
                </button>
              </figcaption>
            </figure>
          );
        })}
      </div>
    </div>
  );
}

function BenchNotice({ notice }) {
  if (!notice) return null;
  return (
    <div className="notice-line">
      <span className="chip mute">{notice.label}</span>
      <span>{notice.desc}</span>
      <span className="src mono">{notice.source}</span>
    </div>
  );
}

function DetectionBench({ bench, notice }) {
  const [split, setSplit] = useState('test');
  const cur = bench.results.find(r => r.split === split) || bench.results[0];

  const mapChart = useMemo(() => bench.results.map(r => ({
    name: r.splitName,
    RFAG_PDA: +(r.map50 * 100).toFixed(2),
    YOLOv8n基线: +((r.baselineMap50 ?? r.map50) * 100).toFixed(2),
  })), [bench]);

  const classChart = useMemo(() => cur.perClass.map(c => ({
    name: c.name,
    AP50: +(c.ap50 * 100).toFixed(2),
    精确率: +(c.precision * 100).toFixed(2),
    召回率: +(c.recall * 100).toFixed(2),
  })), [cur]);

  const sizeChart = useMemo(() => bench.sizeBins.map(b => ({
    name: b.label,
    召回率: +(b.recall * 100).toFixed(1),
    样本数: b.n,
  })), [bench]);

  const gain = cur.baselineMap50
    ? (((cur.map50 - cur.baselineMap50) / cur.baselineMap50) * 100).toFixed(1)
    : null;
  const paramGain = (((bench.models[0].paramsM - bench.models[1].paramsM) / bench.models[0].paramsM) * 100).toFixed(1);

  return (
    <>
      <BenchNotice notice={notice} />

      <div style={{ marginBottom: 16 }}>
        <div className="sub-title" style={{ marginBottom: 10 }}>
          <span className="chip">实验原图</span>
          网络结构 · 训练收敛 · 混淆矩阵 · 分布偏移
          <span className="tag">与下方数据同源</span>
        </div>
        <PaperFigureGroup ids={[
          'fig04-rfag-pda-network',
          'fig05-training-curves',
          'fig09-confusion-matrix',
          'fig10-shift-performance',
        ]} />
      </div>

      <div className="grid g4" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="kpi">
            <span className="label">测试集 mAP50</span>
            <span className="value green">{pct(cur.map50, 2)}</span>
            <span className="sub">基线 YOLOv8n {pct(cur.baselineMap50, 2)}（{gain == null ? '—' : `+${gain}%`}）</span>
          </div>
        </div>
        <div className="card">
          <div className="kpi">
            <span className="label">参数量</span>
            <span className="value blue">{bench.models[1].paramsM.toFixed(2)} M</span>
            <span className="sub">较基线减少 {paramGain}%</span>
          </div>
        </div>
        <div className="card">
          <div className="kpi">
            <span className="label">单帧推理耗时</span>
            <span className="value amber">{cur.inferMs.toFixed(0)} ms</span>
            <span className="sub">基线 {cur.baselineInferMs.toFixed(0)} ms · CPU</span>
          </div>
        </div>
        <div className="card">
          <div className="kpi">
            <span className="label">背景误检（偏移集）</span>
            <span className="value green">
              ↓ {(((bench.falsePositives.rows[2].baseline - bench.falsePositives.rows[2].improved)
                / bench.falsePositives.rows[2].baseline) * 100).toFixed(0)}%
            </span>
            <span className="sub mono">
              {bench.falsePositives.rows[2].baseline.toLocaleString()} → {bench.falsePositives.rows[2].improved.toLocaleString()} 次
            </span>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>
          检测模型对照
          <span className="tag">{bench.dataset.name}</span>
        </h3>
        <p className="hint">
          {bench.desc}
        </p>
        <div className="tabs small">
          {bench.results.map(r => (
            <button
              key={r.split}
              className={`tab ${split === r.split ? 'on' : ''}`}
              onClick={() => setSplit(r.split)}
            >
              {r.splitName}（{r.n_images ?? bench.dataset[`${r.split}Images`] ?? '—'} 张）
            </button>
          ))}
        </div>
        {cur.note && <p className="warn-line">{cur.note}</p>}
        <div className="grid g2" style={{ marginTop: 12 }}>
          <div>
            <div className="sub-title">各类病害指标（{cur.splitName}）</div>
            <div className="table-scroll">
              <table className="tbl">
                <thead>
                  <tr><th>病种</th><th>AP50</th><th>精确率</th><th>召回率</th><th>标注框</th></tr>
                </thead>
                <tbody>
                  {cur.perClass.map(c => (
                    <tr key={c.disease}>
                      <td>{c.name}</td>
                      <td className="mono">{pct(c.ap50, 2)}</td>
                      <td className="mono">{pct(c.precision, 2)}</td>
                      <td className="mono">{pct(c.recall, 2)}</td>
                      <td className="mono mute">{c.nGt}</td>
                    </tr>
                  ))}
                  <tr className="strong">
                    <td>mAP50</td>
                    <td className="mono">{pct(cur.map50, 2)}</td>
                    <td className="mono mute">—</td>
                    <td className="mono mute">—</td>
                    <td className="mono mute">—</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <div className="sub-title">三个划分的 mAP50 对比</div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={mapChart} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: CHART.axis }} interval={0} angle={-12} textAnchor="end" height={54} />
                <YAxis tick={{ fontSize: 11, fill: CHART.axis }} unit="%" domain={[70, 95]} />
                <RTooltip
                  contentStyle={{ background: CHART.tooltipBg, border: `1px solid ${CHART.tooltipBorder}`, fontSize: 12 }}
                  formatter={(v) => `${v}%`}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="YOLOv8n基线" fill={CHART.series[5]}>
                  {mapChart.map((_, i) => <Cell key={i} fill={CHART.series[5]} />)}
                </Bar>
                <Bar dataKey="RFAG_PDA" fill={CHART.series[0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="sub-title" style={{ marginTop: 10 }}>各类病害 AP50 / 精确率 / 召回率</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={classChart} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: CHART.axis }} />
                <YAxis tick={{ fontSize: 11, fill: CHART.axis }} unit="%" domain={[50, 100]} />
                <RTooltip
                  contentStyle={{ background: CHART.tooltipBg, border: `1px solid ${CHART.tooltipBorder}`, fontSize: 12 }}
                  formatter={(v) => `${v}%`}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="AP50" fill={CHART.series[1]} />
                <Bar dataKey="精确率" fill={CHART.series[0]} />
                <Bar dataKey="召回率" fill={CHART.series[2]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>
          背景误检对比
          <span className="tag">改进模型最实在的收益</span>
        </h3>
        <p className="hint">{bench.falsePositives.conclusion}</p>
        <div className="grid g3">
          {bench.falsePositives.rows.map(r => {
            const drop = ((r.baseline - r.improved) / r.baseline) * 100;
            return (
              <div className="kpi" key={r.split}>
                <span className="label">{r.splitName}</span>
                <span className="value green">↓ {drop.toFixed(0)}%</span>
                <span className="sub mono">
                  {r.baseline.toLocaleString()} → {r.improved.toLocaleString()} 次
                </span>
              </div>
            );
          })}
        </div>
        <p className="conclusion">
          mAP50 提升是「平均分」，背景误检下降是「实打实的作业单减少」——
          误检在平台上会变成误喷。所以这一项比 mAP50 更能说明工程价值。
        </p>
      </div>

      <div className="grid g2">
        <div className="card">
          <h3>目标尺寸分箱召回率</h3>
          <p className="hint">小目标仍是难点：&lt;8 px 的目标召回率只有 50%，且样本极少（2 个）。</p>
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={sizeChart} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: CHART.axis }} />
              <YAxis tick={{ fontSize: 11, fill: CHART.axis }} unit="%" domain={[0, 100]} />
              <RTooltip
                contentStyle={{ background: CHART.tooltipBg, border: `1px solid ${CHART.tooltipBorder}`, fontSize: 12 }}
                formatter={(v) => `${v}%`}
              />
              <Bar dataKey="召回率" fill={CHART.series[0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3>模型结构说明</h3>
          <p className="hint">
            RFAG 用 3/5/7 三个深度卷积分支与可学习权重拟合不同感受野，
            PDA 是温度缩放的概率密度注意力 —— 两者都<b>不增加</b>参数量，
            反而因为分支深度可分离而更轻。
          </p>
          <table className="tbl">
            <thead><tr><th>模型</th><th>参数量</th><th>说明</th></tr></thead>
            <tbody>
              {bench.models.map(m => (
                <tr key={m.id}>
                  <td>{m.name}</td>
                  <td className="mono">{m.paramsM.toFixed(3)} M</td>
                  <td className="mute">{m.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function PlanningBench({ bench, notice }) {
  const chart = useMemo(() => bench.planners.map(p => ({
    name: p.name.replace('（本文）', ''),
    总航程: p.length_sum,
    总作业时长: p.time_sum,
    总能耗: p.energy_Wh,
    转弯次数: p.turns,
  })), [bench]);

  const best = bench.planners.reduce((a, b) =>
    (b.makespan < a.makespan ? b : a));

  return (
    <>
      <BenchNotice notice={notice} />
      <div className="grid g4" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="kpi">
            <span className="label">试验地块</span>
            <span className="value blue">{bench.fields}</span>
            <span className="sub">{bench.terrainClasses.join(' / ')}</span>
          </div>
        </div>
        <div className="card">
          <div className="kpi">
            <span className="label">对比算法</span>
            <span className="value">{bench.planners.length}</span>
            <span className="sub">最近邻 / GA / PSO / ACO / 混合</span>
          </div>
        </div>
        <div className="card">
          <div className="kpi">
            <span className="label">最短最长单机架次</span>
            <span className="value green">{best.makespan} s</span>
            <span className="sub">{best.name}</span>
          </div>
        </div>
        <div className="card">
          <div className="kpi">
            <span className="label">最低总能耗</span>
            <span className="value green">
              {Math.min(...bench.planners.map(p => p.energy_Wh))} Wh
            </span>
            <span className="sub">
              {bench.planners.reduce((a, b) => (b.energy_Wh < a.energy_Wh ? b : a)).name}
            </span>
          </div>
        </div>
      </div>

      {/*
        按地形分类的能耗降幅 + 统计检验。
        这两块是「问到底」时的答案：
          · 14% 不是普遍结论 —— 收益主要来自平坦地块，梯田几乎无差别
          · ACO 单独与混合算法统计上不可区分 —— 收益全部来自排序阶段
        提前摆在明面上，比被追问后再解释更可信。
      */}
      {bench.energyDropByTerrain && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>
            收益高度依赖地形
            <span className="tag">平均能耗降幅（相对最近邻基线）</span>
          </h3>
          <p className="hint">
            梯田的陡坎把飞机限制在走廊之间，各规划器被挤进同一串航段，
            排序几乎没有腾挪空间。所以「省 14%」必须带上这个前提。
          </p>
          <div className="grid g3" style={{ marginTop: 10 }}>
            {bench.energyDropByTerrain.map(t => (
              <div className="kpi" key={t.terrain}>
                <span className="label">{t.terrain}</span>
                <span className={`value ${t.drop >= 0.1 ? 'green' : 'blue'}`}>
                  ↓ {(t.drop * 100).toFixed(0)}%
                </span>
                <span className="sub">{t.note}</span>
              </div>
            ))}
          </div>
          {bench.statistics && (
            <p className="conclusion">
              统计检验：能耗降幅对最近邻基线的 Wilcoxon 符号秩检验 p = {bench.statistics.wilcoxonP}
              （显著）。但 ACO 单独与混合算法的对比 p = 0.284，
              即两者统计上不可区分 —— 本问题里分配与排序并不独立，
              蚁群在建巡回时已经顺带均衡了负载，两阶段分解暂未带来可测增益。
            </p>
          )}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>五种任务分配算法对照（{bench.fields} 个地块均值）</h3>
        <p className="hint">{bench.desc}</p>
        <div className="table-scroll">
          <table className="tbl">
            <thead>
              <tr>
                <th>算法</th><th>总航程 m</th><th>总时长 s</th>
                <th>最长架次 s</th><th>总能耗 Wh</th><th>转弯次数</th><th>覆盖率</th>
              </tr>
            </thead>
            <tbody>
              {bench.planners.map(p => (
                <tr key={p.id} className={p.id === 'pso_aco' ? 'strong' : ''}>
                  <td>{p.name}</td>
                  <td className="mono">{p.length_sum}</td>
                  <td className="mono">{p.time_sum}</td>
                  <td className="mono">{p.makespan}</td>
                  <td className="mono">{p.energy_Wh}</td>
                  <td className="mono">{p.turns}</td>
                  <td className="mono">{pct(p.coverage, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="conclusion">{bench.conclusion}</p>
      </div>

      <div className="card">
        <h3>各指标对比</h3>
        <div className="grid g2">
          <div>
            <div className="sub-title">总航程（m）</div>
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={chart} margin={{ top: 8, right: 12, bottom: 4, left: -6 }}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: CHART.axis }} interval={0} angle={-12} textAnchor="end" height={48} />
                <YAxis tick={{ fontSize: 11, fill: CHART.axis }} />
                <RTooltip contentStyle={{ background: CHART.tooltipBg, border: `1px solid ${CHART.tooltipBorder}`, fontSize: 12 }} />
                <Bar dataKey="总航程" fill={CHART.series[0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div>
            <div className="sub-title">总能耗（Wh）</div>
            <ResponsiveContainer width="100%" height={190}>
              <BarChart data={chart} margin={{ top: 8, right: 12, bottom: 4, left: -6 }}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: CHART.axis }} interval={0} angle={-12} textAnchor="end" height={48} />
                <YAxis tick={{ fontSize: 11, fill: CHART.axis }} />
                <RTooltip contentStyle={{ background: CHART.tooltipBg, border: `1px solid ${CHART.tooltipBorder}`, fontSize: 12 }} />
                <Bar dataKey="总能耗" fill={CHART.series[1]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </>
  );
}

function FusionBench({ bench, notice }) {
  const timingChart = useMemo(() => bench.timing.rows.map(r => ({
    name: r.name,
    平均同步误差: +r.meanMs.toFixed(2),
  })), [bench]);
  const filterChart = useMemo(() => bench.filter.rows.map(r => ({
    name: r.name,
    位置RMSE: +r.rmse.toFixed(3),
  })), [bench]);
  const placeChart = useMemo(() => bench.placement.rows.map(r => ({
    name: r.name,
    脱靶率: +(r.offtarget * 100).toFixed(3),
  })), [bench]);

  return (
    <>
      <BenchNotice notice={notice} />
      <div className="grid g3" style={{ marginBottom: 16 }}>
        <div className="card">
          <div className="kpi">
            <span className="label">硬件脉冲同步误差</span>
            <span className="value green">{bench.timing.rows[2].meanMs.toFixed(2)} ms</span>
            <span className="sub">不同步时 {bench.timing.rows[0].meanMs.toFixed(2)} ms</span>
          </div>
        </div>
        <div className="card">
          <div className="kpi">
            <span className="label">三源融合定位误差</span>
            <span className="value green">{bench.filter.rows[2].rmse.toFixed(3)} m</span>
            <span className="sub">仅 GNSS {bench.filter.rows[0].rmse.toFixed(2)} m</span>
          </div>
        </div>
        <div className="card">
          <div className="kpi">
            <span className="label">融合定位脱靶率</span>
            <span className="value green">{(bench.placement.rows[2].offtarget * 100).toFixed(3)}%</span>
            <span className="sub">仅 GPS {(bench.placement.rows[0].offtarget * 100).toFixed(1)}%</span>
          </div>
        </div>
      </div>

      <div className="grid g2" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3>{bench.timing.name}</h3>
          <p className="hint">{bench.timing.conclusion}</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={timingChart} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: CHART.axis }} interval={0} angle={-12} textAnchor="end" height={48} />
              <YAxis tick={{ fontSize: 11, fill: CHART.axis }} unit=" ms" />
              <RTooltip contentStyle={{ background: CHART.tooltipBg, border: `1px solid ${CHART.tooltipBorder}`, fontSize: 12 }} formatter={(v) => `${v} ms`} />
              <Bar dataKey="平均同步误差" fill={CHART.series[1]} />
            </BarChart>
          </ResponsiveContainer>
          <table className="tbl">
            <thead><tr><th>同步方式</th><th>平均误差</th><th>位置偏差均值</th><th>P95</th></tr></thead>
            <tbody>
              {bench.timing.rows.map(r => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td className="mono">{r.meanMs.toFixed(2)} ms</td>
                  <td className="mono">{(r.meanM * 100).toFixed(1)} mm</td>
                  <td className="mono">{(r.p95M * 100).toFixed(1)} mm</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>{bench.filter.name}</h3>
          <p className="hint">{bench.filter.conclusion}</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={filterChart} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: CHART.axis }} interval={0} angle={-12} textAnchor="end" height={48} />
              <YAxis tick={{ fontSize: 11, fill: CHART.axis }} unit=" m" />
              <RTooltip contentStyle={{ background: CHART.tooltipBg, border: `1px solid ${CHART.tooltipBorder}`, fontSize: 12 }} formatter={(v) => `${v} m`} />
              <Bar dataKey="位置RMSE" fill={CHART.series[0]} />
            </BarChart>
          </ResponsiveContainer>
          <table className="tbl">
            <thead><tr><th>配置</th><th>位置 RMSE</th><th>相对 GNSS only</th></tr></thead>
            <tbody>
              {bench.filter.rows.map(r => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td className="mono">{r.rmse.toFixed(3)} m</td>
                  <td className="mono">{r.id === 'gnss' ? '基准' : `↓ ${(r.rmse / bench.filter.rows[0].rmse).toFixed(3)}×`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid g2">
        <div className="card">
          <h3>{bench.placement.name}</h3>
          <p className="hint">{bench.placement.note}</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={placeChart} margin={{ top: 8, right: 12, bottom: 4, left: -6 }}>
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: CHART.axis }} interval={0} angle={-12} textAnchor="end" height={48} />
              <YAxis tick={{ fontSize: 11, fill: CHART.axis }} unit="%" />
              <RTooltip contentStyle={{ background: CHART.tooltipBg, border: `1px solid ${CHART.tooltipBorder}`, fontSize: 12 }} formatter={(v) => `${v}%`} />
              <Bar dataKey="脱靶率" fill={CHART.series[3]} />
            </BarChart>
          </ResponsiveContainer>
          <table className="tbl">
            <thead><tr><th>定位方案</th><th>RMSE</th><th>脱靶率</th><th>P95 偏移</th></tr></thead>
            <tbody>
              {bench.placement.rows.map(r => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td className="mono">{r.rmse.toFixed(2)} m</td>
                  <td className="mono">{(r.offtarget * 100).toFixed(3)}%</td>
                  <td className="mono">{r.p95.toFixed(2)} m</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>{bench.thermal.name}</h3>
          <p className="hint">{bench.thermal.note}</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart
              data={bench.thermal.rows.map(r => ({ name: r.name, RMSE: +r.rmse.toFixed(3) }))}
              margin={{ top: 8, right: 12, bottom: 4, left: -12 }}
            >
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: CHART.axis }} interval={0} angle={-12} textAnchor="end" height={48} />
              <YAxis tick={{ fontSize: 11, fill: CHART.axis }} domain={[0, 0.35]} />
              <RTooltip contentStyle={{ background: CHART.tooltipBg, border: `1px solid ${CHART.tooltipBorder}`, fontSize: 12 }} />
              <Bar dataKey="RMSE" fill={CHART.series[2]}>
                {bench.thermal.rows.map((r, i) => (
                  <Cell key={i} fill={CHART.series[i === 2 ? 0 : i + 1]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="conclusion">
            冠层温度与严重度相关系数 {bench.thermal.corrThermal.toFixed(3)}：
            侵染加剧 → 蒸腾增强 → 冠层温度下降。热成像单独用反而更差
            （RMSE {bench.thermal.rows[1].rmse.toFixed(3)}），
            与 RGB 加权融合后才降到 {bench.thermal.rows[2].rmse.toFixed(3)}。
          </p>
        </div>
      </div>
    </>
  );
}

function SprayBench({ bench, notice }) {
  const driftChart = useMemo(() => {
    const out = [];
    bench.drift.vmdLevels.forEach((v, vi) => {
      bench.drift.windLevels.forEach((w, wi) => {
        out.push({ VMD: `${v} μm`, 风速: w, 靶区命中率: +(bench.drift.rows[vi][wi] * 100).toFixed(1) });
      });
    });
    return out;
  }, [bench]);

  return (
    <>
      <BenchNotice notice={notice} />
      <div className="grid g2" style={{ marginBottom: 16 }}>
        <div className="card">
          <h3>{bench.vra.name}</h3>
          <p className="hint">{bench.vra.note}</p>
          <table className="tbl">
            <thead><tr><th>方式</th><th>总用量</th><th>欠喷格</th><th>过喷格</th><th>相对误差</th><th>覆盖率</th></tr></thead>
            <tbody>
              {bench.vra.rows.map(r => (
                <tr key={r.id} className={r.id === 'vra' ? 'strong' : ''}>
                  <td>{r.name}</td>
                  <td className="mono">{r.volume.toFixed(3)}</td>
                  <td className="mono">{pct(r.under, 1)}</td>
                  <td className="mono">{pct(r.over, 1)}</td>
                  <td className="mono">{pct(r.relErr, 1)}</td>
                  <td className="mono">{pct(r.coverage, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="conclusion">
            变量施药用 <b>24.0%</b> 的药量达到恒量施药 <b>80.1%</b> 的有效覆盖，
            欠喷格比例从 24.4% 降到 0.1% —— 这是平台「只打有病的地方」的直接依据。
          </p>
        </div>

        <div className="card">
          <h3>{bench.feedback.name}</h3>
          <p className="hint">{bench.feedback.note}</p>
          <div className="sub-title">四阶段补偿的覆盖率与相对误差</div>
          <ResponsiveContainer width="100%" height={190}>
            <LineChart
              data={bench.feedback.rows.map(r => ({
                name: r.name.replace(/^[①②③④]\s*/, ''),
                覆盖率: +(r.coverage * 100).toFixed(1),
                相对误差: +(r.relErr * 100).toFixed(1),
              }))}
              margin={{ top: 8, right: 12, bottom: 4, left: -12 }}
            >
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: CHART.axis }} interval={0} angle={-10} textAnchor="end" height={44} />
              <YAxis tick={{ fontSize: 11, fill: CHART.axis }} unit="%" domain={[0, 100]} />
              <RTooltip contentStyle={{ background: CHART.tooltipBg, border: `1px solid ${CHART.tooltipBorder}`, fontSize: 12 }} formatter={(v) => `${v}%`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="覆盖率" stroke={CHART.series[0]} strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="相对误差" stroke={CHART.series[3]} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
          <table className="tbl">
            <thead><tr><th>阶段</th><th>覆盖率</th><th>相对误差</th><th>用药量</th></tr></thead>
            <tbody>
              {bench.feedback.rows.map(r => (
                <tr key={r.id} className={r.id === 'feedback' ? 'strong' : ''}>
                  <td>{r.name}</td>
                  <td className="mono">{pct(r.coverage, 1)}</td>
                  <td className="mono">{pct(r.relErr, 1)}</td>
                  <td className="mono">{r.volume.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid g2">
        <div className="card">
          <h3>{bench.drift.name}</h3>
          <p className="hint">{bench.drift.note}</p>
          <ResponsiveContainer width="100%" height={210}>
            <LineChart
              data={driftChart.filter(d => d.风速 <= 7)}
              margin={{ top: 8, right: 12, bottom: 4, left: -12 }}
            >
              <CartesianGrid stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="风速" tick={{ fontSize: 11, fill: CHART.axis }} unit=" m/s" />
              <YAxis tick={{ fontSize: 11, fill: CHART.axis }} unit="%" domain={[0, 100]} />
              <RTooltip contentStyle={{ background: CHART.tooltipBg, border: `1px solid ${CHART.tooltipBorder}`, fontSize: 12 }} formatter={(v) => `${v}%`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              {bench.drift.vmdLevels.map((v, i) => (
                <Line
                  key={v}
                  type="monotone"
                  dataKey={`VMD ${v} μm`}
                  data={driftChart.filter(d => d.VMD === `${v} μm`)}
                  stroke={CHART.series[i]}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h3>{bench.quality.name}</h3>
          <p className="hint">{bench.quality.note}</p>
          <div className="table-scroll">
            <table className="tbl">
              <thead><tr><th>精确率</th><th>召回率</th><th>用药量</th><th>欠喷</th><th>覆盖率</th><th>相对误差</th></tr></thead>
              <tbody>
                {bench.quality.rows.map(r => (
                  <tr key={`${r.precision}-${r.recall}`}>
                    <td className="mono">{r.precision.toFixed(2)}</td>
                    <td className="mono">{r.recall.toFixed(2)}</td>
                    <td className="mono">{r.volume.toFixed(3)}</td>
                    <td className="mono">{pct(r.under, 1)}</td>
                    <td className="mono">{pct(r.coverage, 1)}</td>
                    <td className="mono">{pct(r.relErr, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="conclusion">
            该表解释了平台为什么把 <b>置信度 ≥ 0.75</b> 设为确诊门限：
            召回率决定「漏没漏」（覆盖率），精确率决定「浪费多少」（用药量）。
          </p>
        </div>
      </div>
    </>
  );
}

/* =====================================================================
 * 平台实时计算 —— 答辩现场可现场调参
 * ===================================================================== */

function LiveView({ onNav }) {
  const [nDrones, setNDrones] = useState(4);
  const [windSpeed, setWindSpeed] = useState(3);
  const [windDir, setWindDir] = useState(45);
  const [algo, setAlgo] = useState('pso-aco');
  const [plan, setPlan] = useState(null);
  const [cmp, setCmp] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = useMemo(() => async () => {
    setBusy(true);
    try {
      const body = { nDrones, windSpeed, windDirDeg: windDir, algo };
      const [p, c] = await Promise.all([
        api.algoSwarmPlan(body),
        api.algoSwarmCompare(body),
      ]);
      setPlan(p); setCmp(c);
    } catch (e) {
      setPlan(null); setCmp(null);
    } finally {
      setBusy(false);
    }
  }, [nDrones, windSpeed, windDir, algo]);

  useEffect(() => { run(); }, [run]);

  const cmpChart = useMemo(() => (cmp?.rows ? cmp.rows.map(r => ({
    name: r.name,
    总航程: r.totalLengthM,
    总能耗: r.energyWh,
    最长架次: +(r.makespanMinutes * 60).toFixed(0),
  })) : []), [cmp]);

  return (
    <>
      <div className="notice-line">
        <span className="chip accent">平台实时计算</span>
        <span>由平台协同规划内核在当前病害网格与实时风场下现场算出，与「离线实验基准」相互独立。</span>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h3>规划参数</h3>
        <p className="hint">改任一参数立即重算 —— 答辩现场可直接演示「风变大 → 航线变保守」。</p>
        <div className="ctrl-row">
          <label>
            <span>无人机数</span>
            <input type="range" min="1" max="6" step="1" value={nDrones}
              onChange={e => setNDrones(Number(e.target.value))} />
            <b className="mono">{nDrones}</b>
          </label>
          <label>
            <span>风速</span>
            <input type="range" min="0" max="8" step="0.5" value={windSpeed}
              onChange={e => setWindSpeed(Number(e.target.value))} />
            <b className="mono">{windSpeed} m/s</b>
          </label>
          <label>
            <span>风向</span>
            <input type="range" min="0" max="359" step="5" value={windDir}
              onChange={e => setWindDir(Number(e.target.value))} />
            <b className="mono">{windDir}°</b>
          </label>
          <label>
            <span>算法</span>
            <select value={algo} onChange={e => setAlgo(e.target.value)}>
              <option value="pso-aco">PSO-ACO 混合</option>
              <option value="aco">蚁群 ACO</option>
              <option value="pso">粒子群 PSO</option>
              <option value="ga">遗传算法 GA</option>
              <option value="nearest">最近邻均分</option>
            </select>
          </label>
          <button className="btn" onClick={run} disabled={busy}>
            {busy ? '计算中…' : '重新计算'}
          </button>
        </div>
      </div>

      {plan?.invalidCells?.length > 0 && (
        <div className="warn-line" style={{ marginBottom: 16 }}>
          有 {plan.invalidCells.length} 个病害格越界或落在障碍上，已从本次规划中剔除。
          若这些格本应作业，请检查地块边界与障碍配置。
        </div>
      )}

      {plan?.ok && (
        <div className="grid g4" style={{ marginBottom: 16 }}>
          <div className="card">
            <div className="kpi">
              <span className="label">总航程</span>
              <span className="value blue">{plan.metrics.totalLengthM} m</span>
              <span className="sub">{plan.metrics.nDrones} 架 · {plan.metrics.turns} 次转弯</span>
            </div>
          </div>
          <div className="card">
            <div className="kpi">
              <span className="label">作业时长</span>
              <span className="value">{plan.metrics.totalMinutes} min</span>
              <span className="sub">最长单机 {plan.metrics.makespanMinutes} min</span>
            </div>
          </div>
          <div className="card">
            <div className="kpi">
              <span className="label">靶向覆盖率</span>
              <span className="value green">{pct(plan.metrics.coverage, 1)}</span>
              <span className="sub">
                {plan.metrics.coveredCells}/{plan.metrics.targetCells} 格 · 过喷 {plan.metrics.overAreaHa} ha
                （{pct(plan.metrics.overRatio, 1)}）
              </span>
            </div>
          </div>
          <div className="card">
            <div className="kpi">
              <span className="label">药耗</span>
              <span className="value amber">{plan.metrics.volumeL} L</span>
              <span className="sub">喷洒 {plan.metrics.sprayLengthM} m · 能耗 {plan.metrics.energyWh} Wh</span>
            </div>
          </div>
        </div>
      )}

      {cmp?.rows && (
        <div className="grid g2">
          <div className="card">
            <h3>五种算法现场对比</h3>
            <p className="hint">
              同一批 {cmp.cells} 个病害格、同一风场（{cmp.wind.windSpeed} m/s）下现场计算。
              基准列为 PSO-ACO。
            </p>
            <div className="table-scroll">
              <table className="tbl">
                <thead>
                  <tr><th>算法</th><th>航程 m</th><th>能耗 Wh</th><th>最长架次 min</th><th>相对增益</th></tr>
                </thead>
                <tbody>
                  {cmp.rows.map(r => (
                    <tr key={r.algo} className={r.algo === 'pso-aco' ? 'strong' : ''}>
                      <td>{r.name}</td>
                      <td className="mono">{r.totalLengthM}</td>
                      <td className="mono">{r.energyWh}</td>
                      <td className="mono">{r.makespanMinutes}</td>
                      <td className="mono">
                        {r.gainVsPsoAco
                          ? `航程 ${r.gainVsPsoAco.length > 0 ? '+' : ''}${r.gainVsPsoAco.length}%`
                          : '基准'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <h3>风场怎么起作用</h3>
            <p className="hint">
              改上面的风速/风向滑块，看两处变化：
            </p>
            <ul className="bullets">
              <li>
                <b>喷洒带朝向</b>会跟着风改 —— 雾滴被横向吹偏，
                横扫方向与风向夹角越大偏得越狠，所以择优选与风向夹角小的那个。
                逆风（315°）比顺风（225°）能耗高约一倍。
              </li>
              <li>
                <b>转场段蟹行代价</b>随风速上升 —— 侧风逼得飞机机身迎风偏，
                逆风还要加大地速顶风。风速 0 → 9 m/s，能耗约翻两倍。
              </li>
            </ul>
            <p className="conclusion">
              注意：风影响的是**能耗与喷洒带朝向**，不必然改变航程几何 ——
              最优航线结构通常不变，这是物理上正确的，
              不该为了「看起来有关联」而硬凑一条假的影响链。
            </p>
          </div>

          <div className="card">
            <h3>总航程对比</h3>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={cmpChart} margin={{ top: 8, right: 12, bottom: 4, left: -6 }}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: CHART.axis }} interval={0} angle={-12} textAnchor="end" height={48} />
                <YAxis tick={{ fontSize: 11, fill: CHART.axis }} unit=" m" />
                <RTooltip contentStyle={{ background: CHART.tooltipBg, border: `1px solid ${CHART.tooltipBorder}`, fontSize: 12 }} />
                <Bar dataKey="总航程" fill={CHART.series[0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="conclusion">
              现场对比与离线基准的结论一致：蚁群与混合算法在总航程与能耗上明显优于
              最近邻基线（最近邻只按「离得近」贪心分派，会让某一架跑很远）。
              混合算法进一步在**负载均衡**（最长单机架次）上占优 —— 这是答辩要讲的重点。
            </p>
          </div>
        </div>
      )}
    </>
  );
}
