import React, { useMemo } from 'react';
import { DISEASE_COLOR } from '../components/FieldMap.jsx';
import { DISEASE_PHOTOS } from '../assets.js';
import {
  SPRAY_STRATEGIES, AGRO_CALENDAR, SPRAY_WINDOW_RULES,
  currentWeather, weatherForecast, windScale,
} from '../../../shared/agronomy.js';

/**
 * 农情与施药策略
 *
 * 这一板块是从原「金穗卫士」平台取来的精华：
 *   1) 气象实况 + 施药适宜度判定 + 三日预报（原 /api/weather）
 *   2) 施药策略库：药剂 / 剂量 / 安全间隔期 / 喷头 / 关键窗口（原 /api/strategies）
 *   3) 病种实拍图对照（原 /uploads/demo/*.jpg）
 *
 * 去掉的糟粕：
 *   - 原平台把气象与策略写死在后端、且策略无法按实测病区动态选用；
 *     这里改为「病害字典 → 策略」自动匹配，并给出当前最适施药窗口。
 *   - 原平台的气象是静态快照；这里改为确定性派生 + 适宜度量化评分。
 *
 * 数据全部来自 shared/agronomy.js —— 与后端真实部署同源，
 * 纯静态演示时也在浏览器里算出同一套结果。
 */

export default function Agro({ detections, missions, meta }) {
  const w = useMemo(() => currentWeather(), []);
  const forecast = useMemo(() => weatherForecast(), []);
  const ws = windScale(w.wind);

  // 各病种在本田块的检出次数 —— 决定策略库里的「当前优先病种」
  const counts = useMemo(() => {
    const m = new Map();
    for (const d of detections || []) m.set(d.disease, (m.get(d.disease) || 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [detections]);

  const topDisease = counts[0]?.[0] || null;
  const recommended = topDisease
    ? SPRAY_STRATEGIES.find(s => s.disease === topDisease)
    : null;

  const diseaseNames = Object.fromEntries(
    (meta?.diseases || []).map(d => [d.code, d.name]));

  return (
    <>
      <div className="page-head">
        <h2>农情与施药策略</h2>
        <p>
          回答「现在能不能打药、该打什么药、打多少、多久能打第二次」四个问题。
          气象与策略是原平台的有效部分，这里保留并改为可量化、可按实测病区动态选用。
        </p>
      </div>

      {/* 气象实况 + 施药窗口 */}
      <div className="grid g-2-1" style={{ marginBottom: 12 }}>
        <div className="card">
          <h3>
            田间气象
            {w.simulated ? <span className="tag">模拟数据</span> : <span className="tag">实测</span>}
            <span className="tag">{w.location}</span>
            <span className="spacer" />
            <span className="xs mute">更新于 {new Date(w.updatedAt).toLocaleTimeString('zh-CN', { hour12: false })}</span>
          </h3>
          {w.simulated ? (
            <div className="xs mute" style={{ marginBottom: 12 }}>
              本页气象为平台内置的确定性模拟读数（按日序与时刻派生），用于演示施药窗口的判定逻辑；
              接入实测气象站数据后此处将自动切换为实况。
            </div>
          ) : null}

          <div className="grid g4" style={{ marginBottom: 16 }}>
            {[
              ['气温', w.temperature, '℃', w.temperature > 28 ? 'amber' : w.temperature < 15 ? 'amber' : 'green'],
              ['相对湿度', w.humidity, '%', w.humidity < 40 || w.humidity > 85 ? 'amber' : 'green'],
              ['风速', w.wind, 'm/s', w.wind < 2 || w.wind > 5 ? 'amber' : 'green'],
              ['光照', w.light, '', 'blue'],
            ].map(([label, val, unit, cls]) => (
              <div className="kpi" key={label}>
                <span className="label">{label}</span>
                <span className={`value ${cls}`} style={{ fontSize: 27 }}>
                  {val}<span className="xs mute"> {unit}</span>
                </span>
              </div>
            ))}
          </div>

          <div className="grid g2" style={{ gap: 16 }}>
            <div>
              <div className="xs" style={{ marginBottom: 8 }}>
                <b>天空状况</b>　{w.weather}　·　云量 {w.cloudCover}%　·　{ws.level} 级 {ws.name}
              </div>
              <div className="xs" style={{ marginBottom: 8 }}>
                <b>降水</b>　{w.isRainy ? `当前降雨 ${w.rainfall} mm/h` : '当前无降雨'}
              </div>
              <div className="xs">
                <b>光合与蒸腾</b>　光照{w.light}，{w.light === '适宜' ? '有利于无人机多光谱相机取样' : '建议调整作业时段'}
              </div>
            </div>
            <div>
              <div className="xs" style={{ marginBottom: 8 }}>
                <b>施药窗口判据</b>（风速 {SPRAY_WINDOW_RULES.wind.min}–{SPRAY_WINDOW_RULES.wind.max} m/s · 气温 {SPRAY_WINDOW_RULES.temp.min}–{SPRAY_WINDOW_RULES.temp.max} ℃ · 湿度 {SPRAY_WINDOW_RULES.humidity.min}–{SPRAY_WINDOW_RULES.humidity.max} % · 无雨）
              </div>
              <div className="stack" style={{ gap: 4 }}>
                {w.spray.reasons.map(r => (
                  <div key={r} className="xs"><span className="green">✓</span> {r}</div>
                ))}
                {w.spray.blocking.map(r => (
                  <div key={r} className="xs"><span className="red">✕</span> {r}</div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3>施药窗口判定</h3>
          <div style={{
            border: `2px solid ${w.spray.suitable ? 'var(--accent)' : 'var(--danger)'}`,
            background: w.spray.suitable ? 'var(--accent-soft)' : 'var(--danger-soft)',
            padding: '16px', marginBottom: 16,
          }}>
            <div className="xs" style={{ marginBottom: 8 }}>当前作业条件</div>
            <div className="row" style={{ gap: 12 }}>
              <span className={`value ${w.spray.suitable ? 'green' : 'red'}`} style={{ fontSize: 30 }}>
                {w.spray.suitable ? '适宜施药' : '暂不宜施药'}
              </span>
            </div>
            <div className="xs" style={{ marginTop: 8 }}>
              综合评分 <b>{w.spray.score}</b> / 100
              （4 项判据中 {w.spray.reasons.length} 项满足）
            </div>
          </div>

          <div className="xs" style={{ marginBottom: 8 }}><b>三日预报</b>{forecast[0]?.simulated ? <span className="xs mute">（模拟）</span> : null}</div>
          <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr><th>日期</th><th>天气</th><th className="right">温度</th><th className="right">风速</th><th>施药</th></tr>
            </thead>
            <tbody>
              {forecast.map(f => (
                <tr key={f.date}>
                  <td className="nowrap">{f.weekday}<span className="xs mute"> {f.date}</span></td>
                  <td className="xs">{f.weather}</td>
                  <td className="num nowrap">{f.tempLow}~{f.tempHigh}℃</td>
                  <td className="num">{f.wind}</td>
                  <td>
                    <span className={`pill ${f.spray.suitable ? 'ok' : 'danger'}`}>
                      {f.spray.suitable ? '适宜' : '不宜'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {/* 施药策略库 */}
      <div className="card" style={{ marginBottom: 12 }}>
        <h3>
          施药策略库
          <span className="tag">{SPRAY_STRATEGIES.length} 条</span>
          <span className="spacer" />
          <span className="xs mute">药剂 · 剂量 · 安全间隔期 · 喷头 · 关键防治窗口</span>
        </h3>
        <p className="hint">
          平台依据识别结果自动匹配策略：病种 → 药剂与剂量 → 喷头与喷洒模式 → 安全间隔期 → 作业单。
          安全间隔期直接约束作业排期，避免「打完就收」造成残留超标。
        </p>

        {recommended && (
          <div className="conclusion" style={{ marginBottom: 16 }}>
            <b>当前优先处置：</b>
            {diseaseNames[topDisease] || recommended.diseaseName}
            （本轮已检出 {counts[0][1]} 处）　→
            推荐药剂 <b>{recommended.agent}</b>，剂量 <b>{recommended.dosage}</b>，
            安全间隔期 <b>{recommended.intervalDays} 天</b>，
            关键窗口「{recommended.window}」
            {w.spray.suitable
              ? '；当前气象条件适宜施药。'
              : '；但当前气象条件不满足施药窗口，建议推迟。'}
          </div>
        )}

        <div className="table-scroll" style={{ maxHeight: 520 }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>病种</th><th>药剂</th><th className="right">剂量</th>
                <th className="right">安全间隔期</th><th>喷头 / 喷洒模式</th>
                <th>关键防治窗口</th><th>注意事项</th>
              </tr>
            </thead>
            <tbody>
              {SPRAY_STRATEGIES.map(s => {
                const hit = counts.find(c => c[0] === s.disease);
                return (
                  <tr key={s.id}>
                    <td className="nowrap">
                      {s.disease !== 'mixed' && (
                        <span style={{
                          display: 'inline-block', width: 10, height: 10,
                          background: DISEASE_COLOR[s.disease] || '#64748b',
                          marginRight: 6,
                        }} />
                      )}
                      <b>{s.diseaseName}</b>
                      {hit && <span className="pill warn" style={{ marginLeft: 6 }}>检出 {hit[1]}</span>}
                    </td>
                    <td style={{ whiteSpace: 'normal' }}>
                      <b>{s.agent}</b>
                      <div className="xs mute">{s.agentClass}</div>
                    </td>
                    <td className="num nowrap">{s.dosage}</td>
                    <td className="num nowrap">
                      <b>{s.intervalDays}</b> 天
                      <div className="xs mute">{s.times}</div>
                    </td>
                    <td style={{ whiteSpace: 'normal' }} className="xs">
                      <b>{s.nozzle}</b>
                      <div className="mute">{s.sprayMode}</div>
                    </td>
                    <td style={{ whiteSpace: 'normal' }} className="xs">{s.window}</td>
                    <td style={{ whiteSpace: 'normal' }} className="xs mute">{s.caution}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 病种实拍图 + 农事历 */}
      <div className="grid g-2-1">
        <div className="card">
          <h3>病种实拍对照 <span className="tag">6 病种全覆盖</span></h3>
          <p className="hint">
            田间核验与农户培训用的标准图。识别模型输出的病种可与图库直接比对，
            降低「同一症状不同叫法」造成的沟通成本。
          </p>
          <div className="grid g3" style={{ gap: 16 }}>
            {(meta?.diseases || []).map(d => {
              const ph = DISEASE_PHOTOS[d.code];
              if (!ph) return null;
              return (
                <div key={d.code} style={{ border: '1px solid var(--border)' }}>
                  <img
                    src={ph.main}
                    alt={d.name}
                    style={{ width: '100%', height: 148, objectFit: 'cover', display: 'block' }}
                  />
                  {ph.alt ? (
                    <div style={{ display: 'flex', gap: 6, padding: '6px 6px 0' }}>
                      <img
                        src={ph.alt}
                        alt={`${d.name} 图库对照`}
                        title="同一病种的图库标准照，用于与团队实拍比对"
                        style={{
                          width: 64, height: 48, objectFit: 'cover',
                          display: 'block', borderRadius: 3, border: '1px solid var(--border)',
                        }}
                      />
                      <span className="xs mute" style={{ alignSelf: 'center' }}>
                        图库标准照对照
                      </span>
                    </div>
                  ) : null}
                  <div style={{ padding: '8px' }}>
                    <div className="row" style={{ gap: 6 }}>
                      <span style={{
                        width: 10, height: 10, display: 'inline-block',
                        background: DISEASE_COLOR[d.code],
                      }} />
                      <b className="small">{d.name}</b>
                      <span className="spacer" />
                      <span className="xs mute">{ph.part}</span>
                    </div>
                    <div className="xs mute" style={{ marginTop: 4, lineHeight: 1.5 }}>{ph.caption}</div>
                    <div className="xs mute" style={{ marginTop: 2, fontSize: 11 }}>{ph.credit}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h3>生育期与农事窗口</h3>
          <p className="hint">把病害防治挂到生育期上，避免错过关键窗口。</p>
          <div className="stack" style={{ gap: 8 }}>
            {AGRO_CALENDAR.map((c, i) => (
              <div key={c.stage} className="ev-row">
                <div className="row" style={{ gap: 8 }}>
                  <span className="pill green">{c.stage}</span>
                  <span className="spacer" />
                  <span className="xs mute">{c.window}</span>
                </div>
                <div className="xs dim" style={{ marginTop: 6 }}>{c.focus}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
