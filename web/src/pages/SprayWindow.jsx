import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as RTooltip,
  CartesianGrid, BarChart, Bar, Legend, ReferenceLine,
} from 'recharts';
import { CHART } from '../theme.js';
import { api } from '../api.js';

/**
 * 施药窗口 —— 雾滴输运模型
 *
 * 这一页回答一个很具体的问题：**今天风这么大，到底还能不能喷？**
 *
 * 平台原先只有几何近似：喷洒带朝哪边，取决于横向漂移代价的大小。
 * 那能回答「该往哪飞」，但回答不了「能不能喷」——
 * 后者要看雾滴自己的命运：终端速度、蒸发、旋翼下洗、风场输运。
 *
 * 模型是拉格朗日式的：每个雾滴独立跟踪，落到冠层高度（0.8 m）才算沉积。
 * 沉积量按质量加权（d³）。判据取「靶区命中率 ≥ 60%」。
 *
 * 这一页与「农情策略」的分工：
 *   农情策略 = 凭农艺经验判断该不该喷
 *   本页     = 用物理模型算出喷出去会怎样
 */

const VMD_OPTIONS = [
  { vmd: 110, name: '110 μm 细雾滴', note: '易被风吹走' },
  { vmd: 140, name: '140 μm 中雾滴', note: '通用配比' },
  { vmd: 170, name: '170 μm 粗雾滴', note: '抗风性最好' },
];

export default function SprayWindow() {
  const [windSpeed, setWindSpeed] = useState(4);
  const [windDir, setWindDir] = useState(45);
  const [swath, setSwath] = useState(5);
  const [vmd, setVmd] = useState(140);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  /**
   * 参数变化 → 重新计算。
   *
   * 两个细节：
   *   1. 防抖 250 ms —— 拖滑块会连续触发十几个中间值，
   *      每次都要跑一遍雾滴模型，没必要。
   *   2. 序号守卫 —— 网络返回顺序不保证，慢的旧请求不能覆盖快的新请求，
   *      否则滑块快速来回拖会出现数字倒退。
   */
  const reqSeq = useRef(0);
  useEffect(() => {
    const seq = ++reqSeq.current;
    setLoading(true);
    const timer = setTimeout(() => {
      api.algoSprayFeasibility({ windSpeed, windDirDeg: windDir, swath, vmd })
        .then(r => {
          if (seq !== reqSeq.current) return;   // 已被更新的请求取代
          if (r?.error) { setErr(r.error); setData(null); }
          else { setErr(null); setData(r); }
        })
        .catch(e => {
          if (seq !== reqSeq.current) return;
          setErr(String(e.message || e));
          setData(null);
        })
        .finally(() => {
          if (seq === reqSeq.current) setLoading(false);
        });
    }, 250);
    return () => clearTimeout(timer);
  }, [windSpeed, windDir, swath, vmd]);

  const windowChart = useMemo(
    () => (data?.window || []).map(w => ({
      风速: w.windSpeed,
      靶区命中率: +(w.onTarget * 100).toFixed(1),
    })),
    [data]
  );

  const rowNow = data?.rows?.find(r => r.vmd === vmd) || data?.rows?.[0];
  const safe = data?.maxSafeWind ?? 0;
  const canSpray = rowNow ? rowNow.onTarget >= 0.6 : false;

  return (
    <div>
      <div className="page-head">
        <h2>施药窗口 · 雾滴输运模型</h2>
        <p>
          逐个雾滴跟踪它在空中的命运：终端速度、蒸发收缩、旋翼下洗、风场输运，
          落到冠层高度才算沉积。沉积量按质量加权，得出靶区命中率。
          判据取命中率 ≥ 60%。
        </p>
      </div>

      <div className="notice-line">
        <span className="chip mute">平台实时计算</span>
        <span>
          每次调整参数都现场重算 —— 不是查表，也不是预录的曲线。
        </span>
        <span className="src mono">shared/droplets.js</span>
      </div>

      {/* ---- 参数 ---- */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="grid g4">
          <div className="ctrl-row">
            <label>风速 <b>{windSpeed} m/s</b></label>
            <input type="range" min="0" max="8" step="0.5" value={windSpeed}
              onChange={e => setWindSpeed(Number(e.target.value))} />
          </div>
          <div className="ctrl-row">
            <label>风向 <b>{windDir}°</b></label>
            <input type="range" min="0" max="359" step="1" value={windDir}
              onChange={e => setWindDir(Number(e.target.value))} />
          </div>
          <div className="ctrl-row">
            <label>喷幅 <b>{swath} m</b></label>
            <input type="range" min="1" max="8" step="0.5" value={swath}
              onChange={e => setSwath(Number(e.target.value))} />
          </div>
          <div className="ctrl-row">
            <label>雾滴谱</label>
            <select value={vmd} onChange={e => setVmd(Number(e.target.value))}>
              {VMD_OPTIONS.map(o => (
                <option key={o.vmd} value={o.vmd}>{o.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {err && <div className="empty">算不出来：{err}</div>}
      {loading && !data && <div className="empty">正在跑雾滴输运…</div>}
      {loading && data && <div className="recalc mono">重新计算中…</div>}

      {data && (
        <>
          {/* ---- 结论 ---- */}
          <div className="grid g4" style={{ marginBottom: 16 }}>
            <div className="card">
              <div className="kpi">
                <span className="label">当前风速能否作业</span>
                <span className={`value ${canSpray ? 'green' : 'red'}`}>
                  {canSpray ? '可作业' : '超窗口'}
                </span>
                <span className="sub">
                  {windSpeed} m/s · 安全上限 {safe} m/s
                </span>
              </div>
            </div>
            <div className="card">
              <div className="kpi">
                <span className="label">靶区命中率（{vmd} μm）</span>
                <span className={`value ${rowNow.onTarget >= 0.6 ? 'green' : 'amber'}`}>
                  {(rowNow.onTarget * 100).toFixed(1)}%
                </span>
                <span className="sub">判据 ≥ 60%</span>
              </div>
            </div>
            <div className="card">
              <div className="kpi">
                <span className="label">漂出靶区的比例</span>
                <span className="value amber">
                  {(rowNow.driftFraction * 100).toFixed(1)}%
                </span>
                <span className="sub">落到靶区之外</span>
              </div>
            </div>
            <div className="card">
              <div className="kpi">
                <span className="label">P95 漂移距离</span>
                <span className="value">{rowNow.driftP95.toFixed(1)} m</span>
                <span className="sub">95% 的漂出雾滴在此距离内</span>
              </div>
            </div>
          </div>

          {/* ---- 作业窗口曲线 ---- */}
          <div className="card" style={{ marginBottom: 16 }}>
            <h3>
              作业窗口
              <span className="tag">{vmd} μm 雾滴谱 · 靶区命中率随风速变化</span>
            </h3>
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={windowChart} margin={{ top: 8, right: 16, bottom: 4, left: -12 }}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="风速" tick={{ fontSize: 11, fill: CHART.axis }}
                  unit=" m/s" />
                <YAxis tick={{ fontSize: 11, fill: CHART.axis }} unit="%" domain={[0, 100]} />
                <RTooltip
                  contentStyle={{ background: CHART.tooltipBg, border: `1px solid ${CHART.tooltipBorder}`, fontSize: 12 }}
                  formatter={(v) => `${v}%`}
                />
                <ReferenceLine y={60} stroke={CHART.series[3]} strokeDasharray="4 4"
                  label={{ value: '作业判据 60%', fontSize: 11, fill: CHART.axis, position: 'right' }} />
                <ReferenceLine x={safe} stroke={CHART.series[1]} strokeDasharray="4 4"
                  label={{ value: `安全上限 ${safe} m/s`, fontSize: 11, fill: CHART.axis }} />
                <Line type="monotone" dataKey="靶区命中率" stroke={CHART.series[0]}
                  strokeWidth={2.2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
            <p className="conclusion">
              {canSpray
                ? `当前 ${windSpeed} m/s 在安全窗口内（上限 ${safe} m/s），可以作业。`
                : `当前 ${windSpeed} m/s 已超出安全窗口（上限 ${safe} m/s），`
                  + `药落在靶区之外的比例达 ${((rowNow.driftFraction) * 100).toFixed(0)}% —— `
                  + '建议改期，或换用更粗的雾滴谱。'}
            </p>
          </div>

          {/* ---- 三档雾滴谱对比 ---- */}
          <div className="grid g2">
            <div className="card">
              <h3>三档雾滴谱对比</h3>
              <p className="hint">
                同样风速下，粗雾滴落得稳、漂得近；细雾滴更容易被风吹走。
                这个差别在风速超过 5 m/s 后迅速拉大。
              </p>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={data.rows.map(r => ({
                  name: `${r.vmd} μm`,
                  靶区命中率: +(r.onTarget * 100).toFixed(1),
                  漂出比例: +(r.driftFraction * 100).toFixed(1),
                }))} margin={{ top: 8, right: 12, bottom: 4, left: -12 }}>
                  <CartesianGrid stroke={CHART.grid} vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: CHART.axis }} />
                  <YAxis tick={{ fontSize: 11, fill: CHART.axis }} unit="%" domain={[0, 100]} />
                  <RTooltip
                    contentStyle={{ background: CHART.tooltipBg, border: `1px solid ${CHART.tooltipBorder}`, fontSize: 12 }}
                    formatter={(v) => `${v}%`}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="靶区命中率" fill={CHART.series[0]} />
                  <Bar dataKey="漂出比例" fill={CHART.series[2]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="card">
              <h3>各档雾滴谱的实测指标</h3>
              <div className="table-scroll">
                <table className="tbl">
                  <thead>
                    <tr>
                      <th>雾滴谱</th><th>靶区命中率</th><th>漂出比例</th>
                      <th>P95 漂移 m</th><th>横向偏移 m</th><th>可否作业</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map(r => (
                      <tr key={r.vmd} className={r.vmd === vmd ? 'strong' : ''}>
                        <td>{r.vmd} μm</td>
                        <td className="mono">{(r.onTarget * 100).toFixed(1)}%</td>
                        <td className="mono">{(r.driftFraction * 100).toFixed(1)}%</td>
                        <td className="mono">{r.driftP95.toFixed(1)}</td>
                        <td className="mono">{r.meanAbsY.toFixed(2)}</td>
                        <td>
                          {r.acceptable
                            ? <span className="chip ok">可作业</span>
                            : <span className="chip warn">超窗口</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="conclusion">
                风向 {windDir}°、喷幅 {swath} m。喷幅越窄，同样的风把药吹得越集中；
                换句话说，窄幅点喷在有风时比全田喷洒更安全。
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
