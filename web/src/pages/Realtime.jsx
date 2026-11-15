import { CHART, MAP } from '../theme.js';
import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as RTooltip,
  CartesianGrid, Legend, BarChart, Bar, Cell,
} from 'recharts';
import { FieldMap } from '../components/FieldMap.jsx';
import { SCENE_PHOTOS, HARDWARE_PHOTOS } from '../assets.js';
import { currentWeather, windScale } from '../../../shared/agronomy.js';

const STATE_LABEL = {
  offline: '离线', idle: '待机', takeoff: '起飞', surveying: '空中巡查',
  rechecking: '地面复核中', reloading: '返航换药', spraying: '喷洒中',
  returning: '返航', charging: '充电', maintenance: '维护',
};

export default function Realtime({ meta, devices, telemetry, linkMetrics, mode, detections, events, missions }) {
  const [selDevice, setSelDevice] = useState('all');
  const w = useMemo(() => currentWeather(), []);

  const series = useMemo(() => {
    const t = (telemetry || []).filter(x => selDevice === 'all' || x.deviceId === selDevice);
    return t.slice(-90).map(x => ({
      ts: x.ts,
      time: new Date(x.ts).toLocaleTimeString('zh-CN', { hour12: false }),
      latency: x.latencyMs ?? null,
      batt: x.batt ?? null,
      x: x.pos?.x ?? null,
      y: x.pos?.y ?? null,
      spd: x.pos?.spd ?? null,
      device: x.deviceId,
    }));
  }, [telemetry, selDevice]);

  const latencyByDevice = useMemo(() => {
    const map = new Map();
    for (const m of linkMetrics || []) {
      map.set(m.deviceId, {
        deviceId: m.deviceId,
        kind: m.kind,
        avg: m.avgLatencyMs,
        p95: m.p95LatencyMs,
        loss: (m.lossRate * 100).toFixed(2),
        sent: m.sent, recv: m.recv, lost: m.lost,
        online: m.online,
      });
    }
    return [...map.values()];
  }, [linkMetrics]);

  // 传输协议说明卡片
  const channels = [
    {
      name: 'WebSocket 遥测通道（主用）',
      path: 'ws://host/ws/telemetry',
      desc: '5–10Hz 推送遥测帧，云端逐帧 ACK 并回传时间戳，计算 RTT 与端到端时延。',
      why: '长连接低开销，采集到云端可见 < 150ms。',
      tag: '生产主用',
    },
    {
      name: 'HTTP 批量补传（弱网兜底）',
      path: 'POST /api/ingest/batch',
      desc: '盲区缓存帧，恢复后按 seq 批量上报，云端补齐空洞并统计丢包率。',
      why: '保证「不丢数据」，而非靠重传保证实时。',
      tag: '弱网必备',
    },
    {
      name: 'MQTT over WebSocket（扩展）',
      path: 'mqtt://host:8083/mqtt',
      desc: '按 device/topic 分层，QoS0 传遥测、QoS1 传识别结果与任务回执。',
      why: '设备数达数十台时，发布/订阅比点对点更省带宽。',
      tag: '后续扩展',
    },
  ];

  return (
    <>
      <div className="page-head">
        <h2>实时监控 · 数据传输与链路质量</h2>
        <p>三条传输通道的分工，以及端到端时延、丢包率、往返时延三项链路健康指标。</p>
      </div>

      {/* 现场实景 + 实时作业面：原平台的有效部分，这里加强 */}
      <div className="grid g-2-1" style={{ marginBottom: 12 }}>
        <div className="card pad0" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '16px 24px 0' }}>
            <h3>
              实时作业面
              <span className="tag">卫星实景底图 · 设备实时位置</span>
              <span className="spacer" />
              <span className="xs mute">
                {meta?.field?.name} · {meta?.field?.widthM}×{meta?.field?.heightM} m
              </span>
            </h3>
          </div>
          <FieldMap
            field={meta?.field}
            devices={devices}
            detections={detections}
            events={events}
            missions={missions}
            height={404}
          />
          <div style={{ padding: '8px 24px 16px' }}>
            <div className="legend">
              <span><i style={{ background: CHART.blue }} />植保无人机</span>
              <span><i style={{ background: CHART.robot }} />地面监测机器人</span>
              <span><i style={{ background: CHART.amber }} />联动事件</span>
              <span><i style={{ background: CHART.green }} />规划航线</span>
              <span><i style={{ background: MAP.obstacleStroke }} />障碍区</span>
            </div>
          </div>
        </div>

        <div className="stack" style={{ gap: 16 }}>
          {/* 田间气象 —— 监控与作业条件放在一起，判断「此刻能不能飞」 */}
          <div className="card">
            <h3>作业气象条件 <span className="tag">{w.weather}</span></h3>
            <div className="grid g2" style={{ gap: 12, marginBottom: 12 }}>
              {[
                ['气温', `${w.temperature} ℃`, w.temperature > 28 || w.temperature < 15 ? 'amber' : 'green'],
                ['风速', `${w.wind} m/s`, w.wind > 5 || w.wind < 2 ? 'amber' : 'green'],
                ['湿度', `${w.humidity} %`, w.humidity < 40 || w.humidity > 85 ? 'amber' : 'green'],
                ['光照', w.light, 'blue'],
              ].map(([label, val, cls]) => (
                <div key={label} className="kpi">
                  <span className="label">{label}</span>
                  <span className={`value ${cls}`} style={{ fontSize: 22 }}>{val}</span>
                </div>
              ))}
            </div>
            <div className="xs dim">
              蒲福风级 {windScale(w.wind).level} 级 {windScale(w.wind).name}。
              {w.spray.suitable
                ? '当前满足施药窗口，允许下发喷洒任务。'
                : '当前不满足施药窗口，平台将拦截喷洒派工。'}
            </div>
          </div>

          {/* 现场视频位：原平台有摄像头画面，这里给「机载/地面相机位」的实景占位 */}
          <div className="card">
            <h3>现场画面 <span className="tag">机载多光谱 · 地面近距</span></h3>
            <div className="grid g2" style={{ gap: 8 }}>
              {[
                { p: SCENE_PHOTOS[3], tag: '机载可见光' },
                { p: SCENE_PHOTOS[4], tag: '地面近距' },
              ].map(({ p, tag }) => (
                <div key={tag} style={{ border: '1px solid var(--border)' }}>
                  <img src={p.src} alt={tag}
                    style={{ width: '100%', height: 104, objectFit: 'cover', display: 'block' }} />
                  <div className="xs" style={{ padding: '4px 6px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="pill uav" style={{ fontSize: 11 }}>{tag}</span>
                    <span className="xs mute nowrap" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.title}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="xs mute" style={{ marginTop: 8 }}>
              画面位对应 UAV-01 机载可见光相机与 ROB-01 地面云台相机，
              识别框与置信度随遥测帧同步回传。
            </div>
          </div>
        </div>
      </div>

      {/* 真实场景照片条：让平台一眼能看出是在真实农田里跑的 */}
      <div className="card" style={{ marginBottom: 12 }}>
        <h3>
          示范田现场实景
          <span className="tag">{SCENE_PHOTOS.length} 张</span>
          <span className="spacer" />
          <span className="xs mute">团队自有拍摄 + 原平台实景素材</span>
        </h3>
        <div className="photo-strip">
          {SCENE_PHOTOS.map(p => (
            <figure key={p.title} className="photo-cell">
              <img src={p.src} alt={p.title} loading="lazy" />
              <figcaption>
                <b>{p.title}</b>
                <span>{p.desc}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>

      {/* 链路指标 */}
      <div className="grid g4" style={{ marginBottom: 12 }}>
        {latencyByDevice.length === 0 ? (
          <div className="card" style={{ gridColumn: 'span 4' }}>
            <div className="empty">等待设备上报数据…（演示模式下由内置模拟器产生）</div>
          </div>
        ) : latencyByDevice.map(m => (
          <div className="card" key={m.deviceId}>
            <div className="row" style={{ marginBottom: 6 }}>
              <span className={`pill ${m.kind}`}>{m.kind === 'uav' ? '无人机' : '机器人'}</span>
              <span className="spacer" />
              <span className={`pill ${m.online ? 'ok' : 'danger'}`}>{m.online ? '在线' : '离线'}</span>
            </div>
            <div className="mono small dim" style={{ marginBottom: 8 }}>{m.deviceId}</div>
            <div className="grid g3" style={{ gap: 8 }}>
              <div className="kpi">
                <span className="label">平均时延</span>
                <span className="value green" style={{ fontSize: 23 }}>{m.avg}<span className="xs mute"> ms</span></span>
              </div>
              <div className="kpi">
                <span className="label">P95</span>
                <span className="value" style={{ fontSize: 23 }}>{m.p95}<span className="xs mute"> ms</span></span>
              </div>
              <div className="kpi">
                <span className="label">丢包率</span>
                <span className={`value ${Number(m.loss) < 1 ? 'green' : 'amber'}`} style={{ fontSize: 23 }}>{m.loss}<span className="xs mute"> %</span></span>
              </div>
            </div>
            <div className="xs mute" style={{ marginTop: 8 }}>
              发送 {m.sent} · 接收 {m.recv} · 丢帧 {m.lost}
            </div>
          </div>
        ))}
      </div>

      {/* 时延曲线 */}
      <div className="grid g-2-1" style={{ marginBottom: 12 }}>
        <div className="card">
          <h3>
            端到端时延曲线
            <span className="tag">采集 → 云端可见</span>
            <span className="spacer" />
            <select value={selDevice} onChange={e => setSelDevice(e.target.value)}>
              <option value="all">全部设备</option>
              {(devices || []).map(d => <option key={d.deviceId} value={d.deviceId}>{d.deviceId}</option>)}
            </select>
          </h3>
          <p className="hint">端到端时延 = 云端收帧时刻 − 设备采集时刻。</p>
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={series}>
              <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
              <XAxis dataKey="time" stroke={CHART.axis} tick={{ fontSize: 12.5 }} minTickGap={40} />
              <YAxis stroke={CHART.axis} tick={{ fontSize: 12.5 }} unit=" ms" width={66} />
              <RTooltip contentStyle={{ background: CHART.tooltipBg, border: `1px solid ${CHART.tooltipBorder}`, fontSize: 13.5 }} />
              <Legend wrapperStyle={{ fontSize: 13 }} />
              <Line type="monotone" dataKey="latency" name="端到端时延(ms)" stroke={CHART.green} dot={false} strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
          <div className="xs mute" style={{ marginTop: 8 }}>
            阈值：&lt;150ms 实时可用 · 150–500ms 可接受 · &gt;500ms 需检查链路
          </div>
        </div>

        <div className="card">
          <h3>设备状态</h3>
          {(devices || []).length === 0 ? (
            <div className="empty">无设备</div>
          ) : (devices || []).map(d => (
            <div key={d.deviceId} style={{ paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid var(--border)' }}>
              <div className="row">
                <span className={`pill ${d.kind}`}>{d.kind === 'uav' ? '无人机' : '机器人'}</span>
                <b className="small">{d.name || d.deviceId}</b>
                <span className="spacer" />
                <span className="pill">{STATE_LABEL[d.state] || d.state}</span>
              </div>
              <div className="xs mono mute" style={{ marginTop: 5 }}>
                pos ({d.pos?.x?.toFixed(1) ?? '—'}, {d.pos?.y?.toFixed(1) ?? '—'}) m
                {d.pos?.z != null && ` · alt ${d.pos.z.toFixed(1)} m`}
              </div>
              <div className="row" style={{ marginTop: 6, gap: 10 }}>
                <span className="xs dim">电量</span>
                <div className="bar" style={{ flex: 1 }}>
                  <i style={{ width: `${Math.max(0, Math.min(100, d.batt || 0))}%`, background: (d.batt || 0) < 25 ? 'var(--danger)' : 'var(--accent)' }} />
                </div>
                <span className="xs mono">{(d.batt || 0).toFixed(0)}%</span>
              </div>
              {d.coverage != null && (
                <div className="row" style={{ marginTop: 5, gap: 10 }}>
                  <span className="xs dim">覆盖</span>
                  <div className="bar blue" style={{ flex: 1 }}>
                    <i style={{ width: `${(d.coverage * 100).toFixed(0)}%` }} />
                  </div>
                  <span className="xs mono">{(d.coverage * 100).toFixed(0)}%</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 传输通道设计 */}
      <div className="card">
        <h3>数据传输通道设计 <span className="tag">实时性保证</span></h3>
        <p className="hint">主通道保实时，兜底通道保不丢，扩展通道保规模。</p>
        <div className="grid g3">
          {channels.map(c => (
            <div key={c.name} className="card" style={{ background: 'var(--panel-2)' }}>
              <div className="row" style={{ marginBottom: 6 }}>
                <b className="small">{c.name}</b>
                <span className="spacer" />
                <span className="pill ok">{c.tag}</span>
              </div>
              <div className="mono xs blue" style={{ marginBottom: 7 }}>{c.path}</div>
              <div className="xs dim" style={{ marginBottom: 7 }}>{c.desc}</div>
              <div className="xs" style={{ color: 'var(--text-mute)', borderTop: '1px solid var(--border)', paddingTop: 7 }}>
                <b style={{ color: 'var(--text-dim)' }}>为什么需要：</b>{c.why}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
