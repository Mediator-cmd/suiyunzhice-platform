import { CHART } from '../theme.js';
import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip as RTooltip,
  CartesianGrid, Legend, BarChart, Bar, Cell,
} from 'recharts';

const STATE_LABEL = {
  offline: '离线', idle: '待机', takeoff: '起飞', surveying: '空中巡查',
  rechecking: '地面复核中', reloading: '返航换药', spraying: '喷洒中',
  returning: '返航', charging: '充电', maintenance: '维护',
};

export default function Realtime({ meta, devices, telemetry, linkMetrics, mode }) {
  const [selDevice, setSelDevice] = useState('all');

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
