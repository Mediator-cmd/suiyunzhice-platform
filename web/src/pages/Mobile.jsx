import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import {
  FIELD_MODES, POINT_STATES, buildFieldChecklist, buildPointUpload,
  FieldOutbox, FIELD_UI_SPEC, THREE_TERMS, THREE_TERM_FLOW, FIELD_CHECKLIST,
} from '../../../shared/mobile.js';

/**
 * 掌上端页 —— 移动端田间作业模式的真实呈现
 *
 * 界面按「手机竖屏 + 户外强光」设计：大按钮、深底浅字、
 * 关键操作在屏幕下半区。这不是把 PC 页面缩小，而是另一种交互形态。
 *
 * 左：PC 调度台与掌上端的联动关系
 * 右：可实际操作的掌上端界面（接单 → 执行点位 → 拍照回传 → 异常上报）
 */

const STATE_CLS = {
  [POINT_STATES.pending]: '',
  [POINT_STATES.navigating]: 'warn',
  [POINT_STATES.arrived]: 'warn',
  [POINT_STATES.captured]: 'ok',
  [POINT_STATES.confirmed]: 'ok',
  [POINT_STATES.skipped]: 'danger',
};

export default function Mobile({ meta, missions, detections, mode }) {
  const [phoneMode, setPhoneMode] = useState('dispatch');
  const [active, setActive] = useState(0);
  const [online, setOnline] = useState(true);
  const [outbox] = useState(() => new FieldOutbox());
  const [toast, setToast] = useState(null);
  const [accepted, setAccepted] = useState(false);
  const [log, setLog] = useState([]);
  const [farmer, setFarmer] = useState(null);
  const fileRef = useRef(null);

  // 公众号推送内容：与平台已确认数据同源
  useEffect(() => {
    let alive = true;
    const load = () => api.farmerMessages()
      .then(f => { if (alive) setFarmer(f); })
      .catch(() => {});
    load();
    const t = setInterval(load, 8000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  // 取最近一条待执行的复核作业单作为掌上端的作业来源
  const mission = useMemo(() => {
    const list = (missions || []).filter(m => m.type === 'recheck');
    return list[0] || (missions || [])[0] || null;
  }, [missions]);

  const checklist = useMemo(
    () => buildFieldChecklist(mission, meta?.field ? fieldAdapter(meta.field) : null),
    [mission, meta]
  );

  // 作业单到位数：掌上端不主动轮询，靠 App 的实时通道推送
  const pointCount = checklist.points.length;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const pushLog = (msg) => setLog(prev => [{ ts: Date.now(), msg }, ...prev].slice(0, 8));

  /** 拍照回传：模拟一次取证 → 识别 → 回传 */
  const doCapture = async (point) => {
    // 更新点位状态
    checklist.points[point.index - 1].state = POINT_STATES.arrived;
    setActive(point.index - 1);
    await new Promise(r => setTimeout(r, 700));

    const upload = buildPointUpload(point, {
      deviceId: 'ROB-01',
      part: 'underside',
      disease: mission?.disease || null,
      confidence: 0.87,
      missionId: mission?.missionId,
      imageUrl: 'local://capture/' + point.row + '_' + point.col,
    });

    if (!online) {
      outbox.enqueue(upload);
      pushLog(`点位 ${point.index}：离线，已缓存 ${outbox.pendingCount} 帧`);
      setToast({ kind: 'warn', text: `已离线缓存，共 ${outbox.pendingCount} 帧待补传` });
      checklist.points[point.index - 1].state = POINT_STATES.captured;
      setActive(point.index - 1);
      return;
    }

    // 在线：直接回传云端（走平台批量补传接口）
    try {
      await api.ingestBatch({ detections: [upload] });
      pushLog(`点位 ${point.index}：照片与识别结果已回传云端`);
      setToast({ kind: 'ok', text: `点位 ${point.index} 回传成功` });
    } catch {
      outbox.enqueue(upload);
      pushLog(`点位 ${point.index}：回传失败，已入队待补传`);
      setToast({ kind: 'warn', text: '回传失败，已缓存待补传' });
    }
    checklist.points[point.index - 1].state = POINT_STATES.confirmed;
    setActive(point.index - 1);
  };

  /** 弱网恢复：补传队列 */
  const doFlush = async () => {
    const res = await outbox.flush(async (item) => {
      await api.ingestBatch({ detections: [item] });
    });
    pushLog(res.sent ? `补传 ${res.sent} 帧成功` : '补传失败，仍无网络');
    setToast({ kind: res.sent ? 'ok' : 'warn', text: `补传 ${res.sent} 帧，剩余 ${res.remain}` });
    setActive(0);
  };

  const doAnomaly = (kind) => {
    pushLog(`异常上报：${kind}`);
    setToast({ kind: 'warn', text: `已上报：${kind}` });
  };

  const doneCount = checklist.points.filter(p => p.state === POINT_STATES.confirmed).length;

  return (
    <>
      <div className="page-head">
        <h2>三端联动 · 掌上端</h2>
        <p>
          PC 调度台下发作业单，掌上端在田间执行并回传证据，公众号向农户推送结论。
          三端跑的是同一套判据、同一份作业单 —— 口径不会分叉。
        </p>
      </div>

      {/* 三端职责 */}
      <div className="grid g3" style={{ marginBottom: 16 }}>
        {THREE_TERMS.map(t => (
          <div className="card" key={t.key} style={{ borderLeft: `3px solid ${t.color}` }}>
            <div className="row" style={{ gap: 8, marginBottom: 6 }}>
              <span className="small" style={{ color: t.color }}>{t.name}</span>
            </div>
            <div className="xs mute" style={{ marginBottom: 8 }}>使用者 · {t.role}</div>
            <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: 1.7, marginBottom: 8 }}>
              {t.duty}
            </div>
            <div className="xs mute" style={{ lineHeight: 1.8, marginBottom: 6 }}>
              <b>承载数据：</b>{t.carries}
            </div>
            <div className="xs mute" style={{ lineHeight: 1.8 }}>
              <b>联动方式：</b>{t.links}
            </div>
          </div>
        ))}
      </div>

      {/* 联动时序 + 掌上端 */}
      <div className="grid g-1-2" style={{ marginBottom: 16, alignItems: 'start' }}>
        {/* 时序 */}
        <div className="card">
          <h3>三端联动时序 <span className="tag">逐段可查</span></h3>
          {THREE_TERM_FLOW.map((f, i) => (
            <div key={i} className="row-line" style={{ alignItems: 'flex-start', gap: 10 }}>
              <span className={`pill ${f.step === 'PC' ? 'ok' : f.step === '掌上端' ? 'warn' : ''}`}
                style={{ minWidth: 62, textAlign: 'center' }}>
                {f.step}
              </span>
              <div style={{ flex: 1 }}>
                <div className="xs" style={{ lineHeight: 1.7 }}>{f.action}</div>
              </div>
              <span className="mono xs mute">+{f.ms} ms</span>
            </div>
          ))}
          <div className="hint" style={{ marginTop: 12 }}>
            全链时延由平台逐段记录，答辩现场可当场调出任意一次的分解。
          </div>
        </div>

        {/* 掌上端 */}
        <div className="card">
          <h3>
            掌上端 · 田间作业模式
            <span className="tag">可实际操作</span>
            <span className="spacer" />
            <span className="xs mute">
              最小触点 {FIELD_UI_SPEC.minTouchTargetPx}px · 最小字号 {FIELD_UI_SPEC.minFontPx}px · 深底浅字
            </span>
          </h3>

          {!mission && (
            <div className="card" style={{ boxShadow: 'none', borderLeft: '3px solid var(--warn)' }}>
              <div className="small" style={{ color: 'var(--warn)', marginBottom: 8 }}>
                暂无可领作业单
              </div>
              <div className="xs mute" style={{ lineHeight: 1.85 }}>
                平台收到低置信度识别结果后会自动派发近地复核任务，作业单经实时通道推到本机。
                等待期间可先查看右栏的作业流程，或切换到「总览」查看平台实时状态。
              </div>
            </div>
          )}

          {mission && (
            <>
              {/* 模式切换 */}
              <div className="row" style={{ gap: 8, marginBottom: 12 }}>
                {Object.values(FIELD_MODES).map(m => (
                  <button
                    key={m.key}
                    className={`btn ${phoneMode === m.key ? 'primary' : ''}`}
                    onClick={() => setPhoneMode(m.key)}
                  >{m.name}</button>
                ))}
                <span className="spacer" />
                <button className="btn" onClick={() => setOnline(!online)}>
                  {online ? '模拟断网' : '恢复网络'}
                </button>
                {outbox.pendingCount > 0 && (
                  <button className="btn primary" onClick={doFlush}>
                    补传 {outbox.pendingCount} 帧
                  </button>
                )}
              </div>

              {/* 作业单信息 */}
              <div style={{
                background: 'var(--panel-2)', border: '1px solid var(--border)',
                padding: 14, marginBottom: 14,
              }}>
                <div className="row" style={{ gap: 8, marginBottom: 8 }}>
                  <span className="pill ok">复核作业</span>
                  <span className="mono xs mute">{mission.missionId}</span>
                  <span className="spacer" />
                  <span className="xs mono">
                    点位 {checklist.meta?.pointCount || 0} · 步行约 {checklist.meta?.estDistanceM || 0} m
                    · 预计 {checklist.meta?.estMinutes || 0} min
                  </span>
                </div>
                <div className="xs mute" style={{ lineHeight: 1.8 }}>
                  {mission.type === 'recheck' ? (
                    <>
                      复核部位：叶下 / 茎基 / 土壤 · 疑似病害 {mission.disease || '待确认'}
                      {' · '}每个点位需拍照取证并回传识别结果
                    </>
                  ) : (
                    <>
                      喷洒参数：速度 {mission.spray?.speed ?? '—'} m/s · 喷幅 {mission.spray?.swath ?? '—'} m
                      {' · '}剂量 {mission.spray?.dose ?? '—'} L/ha
                      {mission.spray?.agent ? ` · ${mission.spray.agent}` : ''}
                    </>
                  )}
                </div>
              </div>

              {/* 接单 */}
              {phoneMode === 'dispatch' && (
                <div style={{ padding: '8px 0' }}>
                  <div className="empty" style={{ padding: '20px 0' }}>
                    {accepted
                      ? '已接单。切换到「执行」模式开始作业。'
                      : '云端已派发本作业单。确认接单后开始按点位执行。'}
                  </div>
                  {!accepted && (
                    <button className="btn primary" style={{ width: '100%', fontSize: 17, padding: 14 }}
                      onClick={() => { setAccepted(true); pushLog('已接单'); setToast({ kind: 'ok', text: '接单成功' }); }}>
                      确认接单
                    </button>
                  )}
                </div>
              )}

              {/* 执行点位 */}
              {phoneMode === 'execute' && (
                <>
                  <div className="tbl-wrap" style={{ maxHeight: 300, overflow: 'auto', marginBottom: 12 }}>
                    <table className="tbl">
                      <thead>
                        <tr>
                          <th style={{ width: 40 }}>#</th><th>网格</th><th>分区</th>
                          <th>坐标</th><th>状态</th><th />
                        </tr>
                      </thead>
                      <tbody>
                        {checklist.points.map(p => (
                          <tr key={p.index}
                            style={p.index - 1 === active ? { background: 'var(--accent-soft)' } : undefined}>
                            <td className="mono xs">{p.index}</td>
                            <td className="mono xs">{p.row} 行 {p.col} 列</td>
                            <td className="mono xs">{p.zone || '—'}</td>
                            <td className="mono xs">{p.x}, {p.y}</td>
                            <td><span className={`pill ${STATE_CLS[p.state] || ''}`}>{p.state}</span></td>
                            <td>
                              {p.state !== POINT_STATES.confirmed && (
                                <button className="btn xs" onClick={() => doCapture(p)}>到位拍照</button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="pill ok">已完成 {doneCount}/{checklist.points.length}</span>
                    <span className="spacer" />
                    <input ref={fileRef} type="file" accept="image/*" capture="environment"
                      style={{ display: 'none' }} />
                    <button className="btn" style={{ fontSize: 15, padding: '10px 16px' }}
                      onClick={() => fileRef.current?.click()}>
                      调用相机
                    </button>
                  </div>
                </>
              )}

              {/* 异常上报 */}
              {phoneMode === 'report' && (
                <div className="stack" style={{ gap: 10 }}>
                  {['漏喷', '设备故障', '疑似漏诊'].map(k => (
                    <button key={k} className="btn" style={{ fontSize: 17, padding: 14, width: '100%' }}
                      onClick={() => doAnomaly(k)}>
                      上报异常：{k}
                    </button>
                  ))}
                  <div className="hint">
                    异常记录与作业单绑定，平台侧可按作业单回溯全部现场记录。
                  </div>
                </div>
              )}

              {/* 回传日志 */}
              {log.length > 0 && (
                <div style={{
                  marginTop: 14, background: 'var(--panel-2)', border: '1px solid var(--border)',
                  padding: 12, fontFamily: 'var(--mono)', fontSize: 12, lineHeight: 1.85,
                }}>
                  {log.map((l, i) => (
                    <div key={i}>
                      <span className="mute">{new Date(l.ts).toLocaleTimeString('zh-CN', { hour12: false })}</span>
                      {'  '}<span style={{ color: 'var(--accent)' }}>{l.msg}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* 田间可用性检查清单 */}
      <div className="card">
        <h3>
          田间可用性检查清单
          <span className="tag">界面逐条满足</span>
        </h3>
        <div className="grid g2">
          {FIELD_CHECKLIST.map(c => (
            <div key={c} className="row" style={{ gap: 8, padding: '6px 0' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>✓</span>
              <span className="xs" style={{ lineHeight: 1.7 }}>{c}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 公众号推送 */}
      <div className="card" style={{ marginTop: 16 }}>
        <h3>
          公众号 / 小程序推送
          <span className="tag">平台事实 + 大模型表达</span>
          <span className="spacer" />
          <span className="xs mute">{farmer?.service?.guard || '平台负责事实，大模型负责表达'}</span>
        </h3>
        {!farmer && <div className="empty">正在生成推送内容…</div>}
        {farmer && (
          <>
            <div className="grid g2" style={{ marginBottom: 14 }}>
              {(farmer.messages || []).map((m, i) => (
                <div key={i} style={{
                  border: '1px solid var(--border)', background: 'var(--panel-2)',
                  padding: 14, borderRadius: 2,
                }}>
                  <div className="row" style={{ gap: 8, marginBottom: 8 }}>
                    <span className="pill ok">{farmer.types?.[m.type]?.name || m.type}</span>
                    {m.actionRequired && <span className="pill warn">需处理</span>}
                    <span className="spacer" />
                    <span className="xs mute">{m.source}</span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{m.title}</div>
                  <div className="xs" style={{ lineHeight: 1.85, marginBottom: 10 }}>{m.body}</div>
                  {m.facts?.length > 0 && (
                    <div className="tbl-wrap">
                      <table className="tbl" style={{ minWidth: 0 }}>
                        <tbody>
                          {m.facts.map((f, j) => (
                            <tr key={j}>
                              <td className="xs mute" style={{ width: 96, border: 'none', padding: '3px 8px 3px 0' }}>{f.k}</td>
                              <td className="xs mono" style={{ border: 'none', padding: '3px 0' }}>{f.v}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  {m.cta && (
                    <div className="xs" style={{ color: 'var(--accent-2)', marginTop: 8 }}>
                      → {m.cta}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="hint">
              {(farmer.service?.points || []).map((p, i) => (
                <div key={i} className="row" style={{ gap: 8, padding: '3px 0' }}>
                  <span style={{ color: 'var(--accent)' }}>·</span>
                  <span className="xs" style={{ lineHeight: 1.7 }}>{p}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: toast.kind === 'ok' ? 'var(--accent)' : 'var(--warn)',
          color: '#ffffff', padding: '12px 22px', fontSize: 15.5, fontWeight: 700,
          borderRadius: 'var(--r)',
          zIndex: 999, boxShadow: '0 4px 12px rgba(18, 22, 28, .18)',
        }}>
          {toast.text}
        </div>
      )}
    </>
  );
}

/** 把 meta.field（普通对象）适配成 Field 那样带方法的形状 */
function fieldAdapter(f) {
  const cellW = (f.widthM || 200) / (f.gridCols || 40);
  const cellH = (f.heightM || 100) / (f.gridRows || 20);
  return {
    gridRows: f.gridRows || 20,
    gridCols: f.gridCols || 40,
    cellW, cellH,
    zoneOfGrid(row, col) {
      const zoneCols = f.zoneCols || 4, zoneRows = f.zoneRows || 2;
      const c = Math.floor((col / (f.gridCols || 40)) * zoneCols);
      const r = Math.floor((row / (f.gridRows || 20)) * zoneRows);
      return String.fromCharCode(65 + (r * zoneCols + c));
    },
  };
}
