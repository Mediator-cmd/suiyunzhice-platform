/**
 * 链路质量统计 —— 服务端与浏览器端共用同一份实现
 *
 * 平台的"实时性"不是口号，而是这三个可量化的数字：
 *   端到端时延 = 云端可见时刻 − 设备采集时刻（设备帧里的 ts 字段）
 *   丢包率     = 由设备自增 seq 的空洞推算
 *   RTT        = 设备与云端往返
 *
 * 设备走 WebSocket 时由 hub 调用 record()；
 * 模拟器或 HTTP 批量补传等非 WS 来源同样调用此方法，
 * 保证「实时监控」页永远有数据，不会因为来源不同而空白。
 */

export class LinkStats {
  constructor() {
    this.deviceStats = new Map(); // deviceId -> 统计项
  }

  ensureStats(deviceId, kind) {
    if (!this.deviceStats.has(deviceId)) {
      this.deviceStats.set(deviceId, {
        deviceId, kind, sent: 0, recv: 0, lost: 0,
        latSamples: [], lastSeen: Date.now(), rttMs: null, state: 'offline',
      });
    }
    return this.deviceStats.get(deviceId);
  }

  /** 记录一路遥测 */
  record(deviceId, kind, latencyMs, seq, state = null) {
    if (!deviceId) return;
    const st = this.ensureStats(deviceId, kind);
    st.sent += 1;
    st.recv += 1;
    if (st.lastSeq != null && seq != null) {
      const gap = seq - st.lastSeq - 1;
      if (gap > 0) st.lost += gap;
    }
    if (seq != null) st.lastSeq = seq;
    st.latSamples.push(latencyMs);
    if (st.latSamples.length > 200) st.latSamples.shift();
    st.lastSeen = Date.now();
    if (state) st.state = state;
  }

  /** 记录 RTT（设备主动上报 ping/pong 测量结果） */
  recordRtt(deviceId, rttMs) {
    const st = this.deviceStats.get(deviceId);
    if (st) st.rttMs = Math.round(rttMs);
  }

  /** 链路质量指标列表 —— 平台"实时性"面板的数据源 */
  linkMetrics() {
    const out = [];
    for (const st of this.deviceStats.values()) {
      const s = [...st.latSamples].sort((a, b) => a - b);
      const avg = s.length ? s.reduce((a, b) => a + b, 0) / s.length : 0;
      const p95 = s.length ? s[Math.min(s.length - 1, Math.floor(s.length * 0.95))] : 0;
      out.push({
        deviceId: st.deviceId, kind: st.kind,
        sent: st.sent, recv: st.recv, lost: st.lost,
        lossRate: st.sent > 0 ? +(st.lost / (st.sent + st.lost)).toFixed(4) : 0,
        avgLatencyMs: Math.round(avg),
        p95LatencyMs: Math.round(p95),
        rttMs: st.rttMs,
        lastSeen: st.lastSeen,
        state: st.state,
        online: Date.now() - st.lastSeen < 5000,
      });
    }
    return out.sort((a, b) => a.deviceId.localeCompare(b.deviceId));
  }
}
