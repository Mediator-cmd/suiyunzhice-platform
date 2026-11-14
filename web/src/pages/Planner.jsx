import React, { useEffect, useState, useMemo } from 'react';
import { api, post } from '../api.js';
import { FieldMap } from '../components/FieldMap.jsx';

/**
 * 路径规划页
 * 1) 自动规划：航向/速度/喷幅联合搜索，按经济/快速/环保加权打分
 * 2) 速度-喷洒比例求解器：流量 = 速度 × 喷幅，实时算可行速度区间
 * 3) 与人工手画航线对比：量化效率提升
 */

const DEFAULT_WEIGHTS = { economy: 0.4, speed: 0.35, eco: 0.25 };

export default function Planner({ meta }) {
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [speed, setSpeed] = useState(6);
  const [swath, setSwath] = useState(1.0);
  const [dose, setDose] = useState(12);
  const [ratio, setRatio] = useState(null);
  const [manual, setManual] = useState(null);
  const [mode, setMode] = useState('full');

  const wStr = `${weights.economy},${weights.speed},${weights.eco}`;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.plan(`weights=${wStr}&mode=${mode}&dose=${dose}`)
      .then(p => { if (alive) { setPlan(p); setLoading(false); } })
      .catch(() => setLoading(false));
    return () => { alive = false; };
  }, [wStr, mode, dose]);

  // 速度-喷洒比例重算
  useEffect(() => {
    let alive = true;
    post('/plan/ratio', { speedMs: speed, swathM: swath, targetDoseLha: dose })
      .then(r => { if (alive) setRatio(r); })
      .catch(() => {});
    return () => { alive = false; };
  }, [speed, swath, dose]);

  const best = plan?.best;
  const cmp = plan?.comparison;

  // 人工基线重算（随参数变化）
  useEffect(() => {
    let alive = true;
    post('/plan/simulate', { headingDeg: 90, speedMs: 4.5, swathM: 5.0, turnRadiusM: 4.0, mode })
      .then(m => { if (alive) setManual(m); })
      .catch(() => {});
    return () => { alive = false; };
  }, [mode]);

  const setW = (k, v) => setWeights(prev => ({ ...prev, [k]: v }));

  return (
    <>
      <div className="page-head">
        <h2>路径规划 · 自动规划替代人工手画</h2>
        <p>
          现状是植保航线的航向、速度、转弯全靠飞手在地面站手动画，既慢又不可复现。
          平台的做法是：把「怎么飞」变成一个可搜索的优化问题 —— 航向、速度、喷幅三维联合搜索，
          以航程、能耗、药耗、重喷率为目标函数，按经济 / 快速 / 环保三档权重出解，
          并同步求解飞行速度与喷洒流量的比例关系。
        </p>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h3>作业模式</h3>
        <p className="hint">
          喷幅决定喷洒效率，也决定"药打在哪里"。整机喷幅用于全田覆盖作业，1m 窄幅用于靶向点喷——
          后者正是本系统"只打有病的地方"的硬件基础。
        </p>
        <div className="grid g2">
          {[
            ['full', '全田覆盖作业', '整机喷幅 4–7m 连续往返，覆盖全部可作业面积。适用于病害初发、尚未成片的田块。', 'var(--accent-2)'],
            ['target', '靶向点喷作业', '启用 1m 窄幅喷施机构，仅对确诊病灶网格施药。适用于病害已明确、需"只打有病的地方"。', 'var(--accent)'],
          ].map(([k, name, desc, color]) => (
            <div key={k}
              onClick={() => { setMode(k); setSwath(k === 'target' ? 1.0 : 5.0); }}
              style={{
                padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
                background: 'var(--panel-2)',
                border: `1px solid ${mode === k ? color : 'var(--border)'}`,
                boxShadow: mode === k ? `0 0 0 1px ${color}` : 'none',
              }}>
              <div className="row" style={{ marginBottom: 4 }}>
                <b className="small" style={{ color }}>{name}</b>
                <span className="spacer" />
                {mode === k && <span className="pill ok">当前</span>}
              </div>
              <div className="xs dim">{desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid g-1-2" style={{ marginBottom: 12 }}>
        {/* 目标权重 */}
        <div className="card">
          <h3>优化目标权重</h3>
          <p className="hint">拖动滑块切换偏好，航线与得分实时重算。</p>
          <div className="weights">
            {[
              ['economy', '最经济', '航时+药耗+电耗', 'var(--accent)'],
              ['speed', '最快速', '航程+转弯次数', 'var(--accent-2)'],
              ['eco', '最环保', '重喷率+越界药量', 'var(--robot)'],
            ].map(([k, name, metric, color]) => (
              <div key={k}>
                <div className="weight-row">
                  <span className="name" style={{ color }}>{name}</span>
                  <input type="range" min={0} max={1} step={0.05}
                    value={weights[k]}
                    onChange={e => setW(k, Number(e.target.value))} />
                  <span className="val">{(weights[k] * 100).toFixed(0)}%</span>
                </div>
                <div className="xs mute" style={{ marginTop: -2 }}>{metric}</div>
              </div>
            ))}
          </div>
          <div className="xs mute" style={{ marginTop: 10, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            权重合计 {((weights.economy + weights.speed + weights.eco) * 100).toFixed(0)}%，
            平台按比例归一化后归入综合得分。
          </div>
        </div>

        {/* 自动规划结果 */}
        <div className="card">
          <h3>
            自动规划结果
            {best && <span className="tag">综合得分 {best.score.total}</span>}
          </h3>
          {loading || !best ? <div className="empty">搜索中…</div> : (
            <>
              <div className="grid g4" style={{ marginBottom: 11 }}>
                {[
                  ['航向', `${best.headingDeg}°`, 'var(--accent-2)'],
                  ['飞行速度', `${best.speedMs} m/s`, 'var(--accent)'],
                  ['喷幅', `${best.swathM} m`, 'var(--robot)'],
                  ['航线长度', `${best.score.detail.lengthM} m`, 'var(--warn)'],
                ].map(([l, v, c]) => (
                  <div className="kpi" key={l}>
                    <span className="label">{l}</span>
                    <span className="value" style={{ fontSize: 20, color: c }}>{v}</span>
                  </div>
                ))}
              </div>
              <div className="grid g3">
                {[
                  ['经济得分', best.score.economy, 'var(--accent)'],
                  ['快速得分', best.score.speed, 'var(--accent-2)'],
                  ['环保得分', best.score.eco, 'var(--robot)'],
                ].map(([l, v, c]) => (
                  <div key={l}>
                    <div className="row"><span className="xs dim">{l}</span><span className="spacer" /><span className="xs mono">{v}</span></div>
                    <div className="bar" style={{ marginTop: 3 }}>
                      <i style={{ width: `${v}%`, background: c }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="grid g4" style={{ marginTop: 12 }}>
                {[
                  ['预计作业时长', `${best.score.detail.totalMinutes} min`],
                  ['预计总药量', `${best.score.detail.totalVolumeL} L`],
                  ['预计耗电', `${best.score.detail.batteryPct}%`],
                  ['重喷率', `${(best.score.detail.overlapRatio * 100).toFixed(1)}%`],
                ].map(([l, v]) => (
                  <div className="kpi" key={l}>
                    <span className="label">{l}</span>
                    <span className="mono" style={{ fontSize: 15 }}>{v}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 航线可视化对比 */}
      <div className="grid g2" style={{ marginBottom: 12 }}>
        <div className="card pad0" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '13px 15px 0' }}>
            <h3>自动规划航线 <span className="pill ok">绿色</span></h3>
          </div>
          <FieldMap field={meta?.field} route={best?.route} height={300} />
        </div>
        <div className="card pad0" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '13px 15px 0' }}>
            <h3>人工手画航线（基线） <span className="pill warn">黄色</span></h3>
          </div>
          {manual ? <FieldMap field={meta?.field} route={manual.route} height={300} />
            : <div className="empty" style={{ height: 300 }}>计算中…</div>}
        </div>
      </div>

      {/* 速度-喷洒比例求解器 */}
      <div className="grid g-2-1" style={{ marginBottom: 12 }}>
        <div className="card">
          <h3>速度 — 喷洒比例求解器</h3>
          <p className="hint">
            喷头流量必须与「前进速度 × 喷幅」严格成正比：飞行加速必须同比加大流量，否则药液沉积不足（漏喷）；
            减速则需同比减小流量，否则超喷与药害。平台自动求解该比例，并给出不漏喷/不超喷的可行速度区间。
          </p>
          <div className="grid g3" style={{ marginBottom: 12 }}>
            <div>
              <label className="lbl">飞行速度 (m/s)</label>
              <input type="range" min={2} max={10} step={0.5} value={speed}
                onChange={e => setSpeed(Number(e.target.value))} />
              <div className="mono xs">{speed.toFixed(1)} m/s</div>
            </div>
            <div>
              <label className="lbl">喷幅 (m)</label>
              <input type="range" min={mode === 'target' ? 0.5 : 3} max={mode === 'target' ? 2 : 8} step={0.1} value={swath}
                onChange={e => setSwath(Number(e.target.value))} />
              <div className="mono xs">{swath.toFixed(1)} m
                {mode === 'target' && <span className="mute"> · 窄幅点喷</span>}
                {mode === 'full' && <span className="mute"> · 整机喷幅</span>}
              </div>
            </div>
            <div>
              <label className="lbl">目标施药量 (L/ha)</label>
              <input type="range" min={4} max={24} step={0.5} value={dose}
                onChange={e => setDose(Number(e.target.value))} />
              <div className="mono xs">{dose.toFixed(1)} L/ha</div>
            </div>
          </div>

          {ratio && (
            <>
              <div className="grid g4" style={{ marginBottom: 11 }}>
                <div className="kpi">
                  <span className="label">所需流量</span>
                  <span className="value green" style={{ fontSize: 21 }}>{ratio.requiredFlowLmin}<span className="xs mute"> L/min</span></span>
                  <span className="sub">喷头能力上限 {ratio.maxFlowLmin} L/min</span>
                </div>
                <div className="kpi">
                  <span className="label">喷头开度</span>
                  <span className="value" style={{ fontSize: 21 }}>{(ratio.dutyCycle * 100).toFixed(0)}<span className="xs mute"> %</span></span>
                  <span className="sub">{ratio.feasible ? '流量在能力范围内' : '超出喷头能力！'}</span>
                </div>
                <div className="kpi">
                  <span className="label">流量/速度比</span>
                  <span className="value blue" style={{ fontSize: 21 }}>{ratio.flowPerSpeed}<span className="xs mute"> L/(m·min)</span></span>
                  <span className="sub">该比值恒定，比例自动锁定</span>
                </div>
                <div className="kpi">
                  <span className="label">可行速度区间</span>
                  <span className="value amber" style={{ fontSize: 21 }}>
                    {ratio.speedRange ? `${ratio.speedRange.min}~${ratio.speedRange.max}` : '—'}<span className="xs mute"> m/s</span></span>
                  <span className="sub">保证不漏喷、不超喷</span>
                </div>
              </div>
              {!ratio.feasible && (
                <div className="conclusion" style={{ background: 'linear-gradient(90deg,rgba(248,113,113,.12),rgba(248,113,113,.02))', borderColor: 'var(--danger)' }}>
                  <b>当前参数超出喷头能力</b>：需降低速度、减小喷幅或降低目标施药量。平台会在下发任务前自动拦截这类不合法参数。
                </div>
              )}
              <div className="xs mute" style={{ marginTop: 9 }}>
                公式：喷洒流量 = 飞行速度 × 喷幅 × 目标施药量 / 10000 × 60；
                全程药液需求 {ratio.totalVolumeL} L。
              </div>
            </>
          )}
        </div>

        {/* 人工 vs 自动对比 */}
        <div className="card">
          <h3>相比人工手画的提升</h3>
          {cmp && cmp.manual && (
            <>
              <table className="tbl">
                <thead><tr><th>指标</th><th className="right">人工</th><th className="right">自动</th><th className="right">改善</th></tr></thead>
                <tbody>
                  {[
                    ['作业时长', cmp.manual.minutes, cmp.auto.minutes, cmp.gains.minutes, 'min'],
                    ['药液用量', cmp.manual.volumeL, cmp.auto.volumeL, cmp.gains.volumeL, 'L'],
                    ['航线长度', cmp.manual.lengthM, cmp.auto.lengthM, cmp.gains.lengthM, 'm'],
                    ['耗电', cmp.manual.batteryPct, cmp.auto.batteryPct, null, '%'],
                    ['转弯占比', (cmp.manual.turningShare * 100).toFixed(1), (cmp.auto.turningShare * 100).toFixed(1), cmp.gains.turningShare, '%'],
                    ['重喷率', (cmp.manual.overlap * 100).toFixed(1), (cmp.auto.overlap * 100).toFixed(1), null, '%'],
                  ].map(([label, m, a, gain]) => (
                    <tr key={label}>
                      <td>{label}</td>
                      <td className="num dim">{m}</td>
                      <td className="num green">{a}</td>
                      <td className="num">{gain != null
                        ? <span className={gain > 0 ? 'green' : 'dim'}>−{gain}%</span>
                        : <span className="mute">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="xs mute" style={{ marginTop: 9 }}>
                {cmp.manual.note}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 候选解排行 */}
      {plan?.candidates?.length > 0 && (
        <div className="card">
          <h3>搜索候选解排行 <span className="tag">航向 × 速度 × 喷幅 联合搜索</span></h3>
          <p className="hint">平台遍历全部可行组合并按当前权重排序，可直接下发排名第一的解，也可由操作员人工改写后复核。</p>
          <div className="table-scroll" style={{ maxHeight: 300 }}>
            <table className="tbl">
              <thead><tr>
                <th className="right">#</th><th className="right">航向</th><th className="right">速度</th><th className="right">喷幅</th>
                <th className="right">综合</th><th className="right">经济</th><th className="right">快速</th><th className="right">环保</th>
                <th className="right">时长</th><th className="right">药耗</th>
              </tr></thead>
              <tbody>
                {plan.candidates.slice(0, 24).map((c, i) => (
                  <tr key={i} style={i === 0 ? { background: 'rgba(74,222,128,.06)' } : {}}>
                    <td className="num">{i === 0 ? <span className="pill ok">最优</span> : i + 1}</td>
                    <td className="num">{c.headingDeg}°</td>
                    <td className="num">{c.speedMs}</td>
                    <td className="num">{c.swathM}</td>
                    <td className="num green">{c.total}</td>
                    <td className="num dim">{c.economy}</td>
                    <td className="num dim">{c.speed}</td>
                    <td className="num dim">{c.eco}</td>
                    <td className="num">{c.minutes}</td>
                    <td className="num">{c.volumeL}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
