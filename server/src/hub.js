/**
 * 实时数据接入层 —— Node 传输层
 *
 * 业务内核（帧解析、ACK、链路质量统计）在 shared/realtime.js，
 * 本文件只负责 Node 侧的传输：把 ws 的连接/消息事件接到内核上。
 *
 * 这样本机版与云端版（Durable Object）跑的是同一套帧处理逻辑，
 * 不会出现「本机收帧行为与云端不同」的偏差。
 */

import { WebSocketServer } from 'ws';
import { RealtimeHub as RealtimeCore } from '../../shared/realtime.js';

export class RealtimeHub extends RealtimeCore {
  attach(server, path = '/ws/telemetry') {
    // 注意：同一 HTTP server 上挂多个带 path 的 WebSocketServer 会互相抢 upgrade 事件，
    // 先挂的那个会直接 400 掉后挂的。因此统一用 noServer 模式，由调用方按路径分发。
    const wss = new WebSocketServer({ noServer: true });
    wss.on('connection', (ws, req) => {
      const deviceId = req.headers['x-device-id'] || `dev-${Date.now()}`;
      const kind = req.headers['x-device-kind'] || 'uav';
      const client = { deviceId, kind, lastSeen: Date.now() };
      this.clients.set(ws, client);
      this.ensureStats(deviceId, kind);
      log(`[hub] device connected: ${deviceId} (${kind})`);

      ws.on('message', (raw) => {
        let msg;
        try { msg = JSON.parse(raw.toString()); } catch { return; }
        this.handle(ws, client, msg);
      });
      ws.on('close', () => {
        this.store.setDeviceOffline(client.deviceId);
        this.clients.delete(ws);
        log(`[hub] device disconnected: ${deviceId}`);
      });
      ws.on('error', () => { this.clients.delete(ws); });
    });
    this.wss = wss;
    return wss;
  }
}

function log(...a) {
  if (process.env.LOG !== '0') console.log(...a);
}
