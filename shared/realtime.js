/**
 * 实时数据接入层 —— 运行时无关内核
 *
 * 与 server/src/hub.js 的区别只在于传输层：
 *   本机版用 ws 包接管 Node 的 upgrade 事件；
 *   云端版用 Durable Object 的 WebSocket Hibernation API。
 * 上层逻辑（帧解析、ACK、链路质量统计、广播）完全一致 ——
 * 统计用的 shared/linkstats.js 是同一份。
 *
 * 三种接入通道，对应老师问的"无人机采集的数据怎么跟云端平台做数据传输，保证实时性"：
 *
 *   A. WebSocket 遥测通道（主用，实时性最好）
 *      设备端以固定频率（如 5-10Hz）推送遥测帧与识别结果，
 *      云端 ACK 回传时延，设备据此计算 RTT。
 *      优点：低开销、可双向、适合高频小包。
 *
 *   B. HTTP 批量上传（备选，用于弱网/离线补传）
 *      设备端在信号盲区缓存，恢复后批量 POST，带 seq 幂等去重。
 *      云端按 seq 补齐空洞，统计丢包率。
 *
 *   C. MQTT over WebSocket（生产环境扩展）
 *      文档给出 topic 设计与 QoS 策略，便于后续接入真实网关。
 *
 * 实时性指标（平台展示）：
 *   - 端到端时延 = 云端收到时刻 - 设备采集时刻（ts 字段）
 *   - 丢包率 = 1 - recv/seq
 *   - RTT = 设备↔云端往返
 */

import { DEVICE_STATES } from './schema.js';
import { LinkStats } from './linkstats.js';

export class RealtimeHub {
  /**
   * @param {object} opts
   * @param {object} opts.store       存储接口
   * @param {function} opts.onTelemetry 遥测回调 (t, latency)
   * @param {function} opts.onDetection 检出回调 (d)
   * @param {LinkStats} opts.stats     链路统计实例（可注入，便于测试）
   */
  constructor({ store, onTelemetry, onDetection, stats }) {
    this.store = store;
    this.onTelemetry = onTelemetry || (() => {});
    this.onDetection = onDetection || (() => {});
    this.clients = new Map(); // ws -> { deviceId, kind, lastSeen }
    this.stats = stats || new LinkStats();
  }

  /**
   * 处理一帧设备消息。
   * @param {object} ws  具备 send() 的对象
   * @param {object} client 已登记的客户端信息
   * @param {object} msg   解析后的消息
   */
  handle(ws, client, msg) {
    if (!client) return;
    const type = msg.type;

    switch (type) {
      case 'telemetry': {
        const t = msg.payload;
        const recvAt = Date.now();
        this.ensureStats(t.deviceId || client.deviceId, t.kind || client.kind);
        const st = this.ensureStats(t.deviceId || client.deviceId, t.kind || client.kind);

        // 时延 = 收到时刻 - 采集时刻
        const latency = recvAt - (t.ts || recvAt);
        this.recordTelemetry(t.deviceId || client.deviceId, t.kind || client.kind, latency, t.seq, t.state);

        st.state = t.state;
        st.pos = t.pos;
        st.batt = t.batt;
        st.coverage = t.coverage;

        this.store.upsertDevice({
          deviceId: t.deviceId || client.deviceId,
          kind: t.kind || client.kind,
          name: t.name || t.deviceId || client.deviceId,
          state: t.state || DEVICE_STATES.IDLE,
          pos: t.pos, batt: t.batt, coverage: t.coverage,
          lastSeen: recvAt, online: true,
        });
        this.onTelemetry(t, latency);
        this.ack(ws, 'telemetry', t.frameId, recvAt);
        break;
      }
      case 'detection': {
        const d = msg.payload;
        this.store.insertDetection(d);
        this.onDetection(d);
        this.ack(ws, 'detection', d.detId, Date.now());
        break;
      }
      case 'mission_ack': {
        this.store.updateMissionStatus(msg.payload.missionId, msg.payload.status);
        break;
      }
      case 'ping': {
        ws.send(JSON.stringify({ type: 'pong', ts: msg.payload?.ts ?? Date.now(), serverTs: Date.now() }));
        break;
      }
      default:
        break;
    }
  }

  ack(ws, kind, id, serverTs) {
    try { ws.send(JSON.stringify({ type: 'ack', kind, id, serverTs })); }
    catch { /* ignore */ }
  }

  /**
   * 记录一路遥测的链路质量。
   * 设备走 WebSocket 时由 handle() 调用；
   * 模拟器或 HTTP 补传等非 WS 来源同样调用此方法，保证链路面板始终有数据。
   */
  recordTelemetry(deviceId, kind, latencyMs, seq, state = null) {
    this.stats.record(deviceId, kind, latencyMs, seq, state);
  }

  ensureStats(deviceId, kind) {
    return this.stats.ensureStats(deviceId, kind);
  }

  /** 链路质量指标列表 —— 平台"实时性"面板的数据源 */
  linkMetrics() {
    return this.stats.linkMetrics();
  }

  /** 广播给所有设备端订阅者 */
  broadcastRaw(msg) {
    for (const ws of this.clients.keys()) {
      try { ws.send(msg); } catch { /* ignore */ }
    }
  }

  /** 广播给所有浏览器前端 */
  broadcast(type, payload) {
    this.broadcastRaw(JSON.stringify({ type, payload, ts: Date.now() }));
  }
}

/** 记录 RTT（设备主动上报 ping/pong 测量结果） */
export function recordRtt(hub, deviceId, rttMs) {
  hub.stats.recordRtt(deviceId, rttMs);
}
