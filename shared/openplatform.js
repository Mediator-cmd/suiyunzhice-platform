/**
 * 开放平台 —— 开发者门户内核
 *
 * 回答评委必然要问的第三句：
 *   "我如果想用你的平台接自己的设备，具体怎么做？要写多少代码？"
 *
 * 这份内核提供三样东西，全部可以直接在页面上看到：
 *   1. 接入指南：五步接入流程 + 每步的完整 HTTP 请求示例
 *   2. 代码示例：设备端上送与云端下发的可直接复制片段
 *   3. 接入模拟器：不接真实设备，在浏览器里把一帧遥测"发"给平台，
 *      现场看平台如何接收、计量、派单
 *
 * 与平台其余部分一致：这份逻辑放 shared/，前后端共用。
 */

/** 接入步骤（与页面、文档、申报材料同源） */
export const ONBOARDING_STEPS = [
  {
    key: 'register',
    title: '注册设备',
    desc: '第三方设备提交身份信息，平台签发长期 API Key',
    detail: 'API Key 仅在注册时返回一次，服务端只保存盐值。设备须妥善保存，遗失需吊销重发。',
    endpoint: 'POST /api/access/devices/register',
    request: {
      deviceId: 'UAV-YOUR-001',
      name: '贵司植保无人机',
      kind: 'uav',
      model: '型号',
      tenantId: 't-coop',
    },
    response: { ok: true, apiKey: 'sk_UAV-YOUR-001_xxxxxxxx', notice: 'API Key 仅显示一次' },
  },
  {
    key: 'heartbeat',
    title: '维持心跳',
    desc: '设备每 15 秒上报一次心跳，云端据此判定在线与离线',
    detail: '超过 15 秒未收到心跳，平台自动将设备置为离线并停止向其下发新任务。',
    endpoint: 'POST /api/access/heartbeat',
    request: { deviceId: 'UAV-YOUR-001' },
    headers: { 'X-Device-Key': 'sk_UAV-YOUR-001_xxxxxxxx' },
    response: { ok: true, ts: 1760000000000, accessState: '已激活' },
  },
  {
    key: 'telemetry',
    title: '上送遥测',
    desc: '按 5–10 Hz 推送遥测帧，云端逐帧 ACK 回传服务器时间戳',
    detail: '设备端 ts 必须是「采集时刻」而非「发送时刻」，端到端时延由此计算。seq 自增且不可回退，丢包率由此推算。',
    endpoint: 'POST /api/ingest/batch',
    headers: { 'X-Device-Id': 'UAV-YOUR-001', 'X-Device-Key': 'sk_UAV-YOUR-001_xxxxxxxx' },
    request: {
      telemetry: [{
        frameId: 'F-10001', ts: 1760000000000, seq: 10001,
        deviceId: 'UAV-YOUR-001', kind: 'uav', state: 'surveying',
        pos: { x: 45.0, y: 50.5, z: 2.0, alt: 2.0, spd: 8, hdg: 0 },
        batt: 92, coverage: { done: 0.42 },
      }],
    },
    response: { ok: true, telemetry: 1, detections: 0 },
  },
  {
    key: 'command',
    title: '接收作业单',
    desc: '云端通过 WebSocket 推送指令，设备回执推进状态机',
    detail: '指令状态：已下发 → 设备已接收 → 执行中 → 已完成 / 执行失败。每段时延平台侧可查。',
    endpoint: 'WS /ws/telemetry（下行）',
    request: {
      type: 'command',
      payload: {
        commandId: 'C-1760000000-123',
        type: 'spray_mission',
        missionId: 'M-1760000000-456',
        spray: { speed: 8, swath: 1.0, flow: 0.53, dose: 12, agent: '戊唑醇·苯醚甲环唑' },
      },
    },
    response: { type: 'command_ack', payload: { commandId: 'C-1760000000-123', status: '设备已接收' } },
  },
  {
    key: 'settle',
    title: '计量结算',
    desc: '作业完成后上报用量，平台按亩 / 架次 / 识别次数出账',
    detail: '用量与作业单用 missionId 关联，平台按作业单去重计费，重复上报不会重复收费。',
    endpoint: 'POST /api/metering/usage',
    request: {
      missionId: 'M-1760000000-456',
      type: 'spray', areaMu: 30, volumeL: 0.57, minutes: 3.61,
      sorties: 1, detections: 19, savedL: 24.6,
    },
    response: { ok: true, priced: { total: 360, currency: 'CNY' } },
  },
];

/**
 * 代码示例 —— 给设备开发者的可复制片段
 */
export const CODE_SAMPLES = [
  {
    key: 'node',
    lang: 'Node.js（设备端遥测上送）',
    code: `// 设备端：按 5Hz 上送遥测，带自增 seq 与采集时刻 ts
const BACKEND = 'https://your-platform.example.com';

let seq = 0;
setInterval(async () => {
  seq += 1;
  const frame = {
    frameId: \`F-\${seq}\`,
    ts: Date.now(),          // 采集时刻，不是发送时刻
    seq,                     // 自增序号，用于丢包率统计
    deviceId: 'UAV-YOUR-001',
    kind: 'uav',
    state: 'surveying',
    pos: { x: 45.0, y: 50.5, z: 2.0, spd: 8, hdg: 0 },
    batt: 92,
  };
  await fetch(\`\${BACKEND}/api/ingest/batch\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Device-Id': 'UAV-YOUR-001',
      'X-Device-Key': process.env.DEVICE_KEY,   // 注册时签发
    },
    body: JSON.stringify({ telemetry: [frame] }),
  });
}, 200);`,
  },
  {
    key: 'python',
    lang: 'Python（识别结果上送 + 用量上报）',
    code: `import os, time, requests

BACKEND = "https://your-platform.example.com"
HEADERS = {
    "Content-Type": "application/json",
    "X-Device-Id": "UAV-YOUR-001",
    "X-Device-Key": os.environ["DEVICE_KEY"],
}

# 上送识别结果（可与遥测同帧，也可批量补传）
requests.post(f"{BACKEND}/api/ingest/batch", headers=HEADERS, json={
    "detections": [{
        "detId": f"D-{int(time.time()*1000)}",
        "ts": int(time.time() * 1000),
        "deviceId": "UAV-YOUR-001",
        "kind": "uav",
        "part": "canopy",
        "disease": "rust",
        "confidence": 0.93,
        "bbox": {"x": 812, "y": 344, "w": 96, "h": 72},
        "geo": {"x": 45.0, "y": 50.5},
        "grid": {"row": 10, "col": 12},
        "model": "your-model-v1",
    }]
})

# 作业完成后上报用量，进入平台计量结算
requests.post(f"{BACKEND}/api/metering/usage", headers=HEADERS, json={
    "missionId": "M-1760000000-456",
    "type": "spray", "areaMu": 30, "volumeL": 0.57,
    "minutes": 3.61, "sorties": 1, "detections": 19, "savedL": 24.6,
})`,
  },
  {
    key: 'ws',
    lang: 'WebSocket（接收云端下发的作业单）',
    code: `// 设备端：连上云端，接收作业单并回执
const ws = new WebSocket('wss://your-platform.example.com/ws/telemetry', {
  headers: {
    'X-Device-Id': 'UAV-YOUR-001',
    'X-Device-Key': process.env.DEVICE_KEY,
    'X-Device-Kind': 'uav',
  },
});

ws.on('message', (raw) => {
  const msg = JSON.parse(raw);
  if (msg.type === 'command') {
    const c = msg.payload;
    // 收到作业单 → 开始执行 → 回执
    executeMission(c).then(() => {
      ws.send(JSON.stringify({
        type: 'mission_ack',
        payload: { missionId: c.missionId, status: 'done' },
      }));
    });
  }
});`,
  },
];

/**
 * 接入模拟器 —— 不接真实设备，在浏览器里演练一次完整接入
 *
 * 返回一个状态机：调用 step() 推进，观察平台如何响应。
 */
export class OnboardingSimulator {
  constructor() {
    this.reset();
  }

  reset() {
    this.stage = 0;
    this.apiKey = null;
    this.deviceId = 'UAV-YOUR-001';
    this.log = [];
    this.frames = 0;
    this.latencyMs = 0;
    this.received = 0;
    this.ack = null;
    this.mission = null;
    this.billed = null;
  }

  /** 推进一步，返回该步的说明与结果 */
  step() {
    const s = ONBOARDING_STEPS[this.stage];
    if (!s) return null;

    switch (s.key) {
      case 'register':
        this.apiKey = `sk_${this.deviceId}_demo7f3a2b`;
        this.push('注册成功，平台签发 API Key（仅此一次可见）');
        break;
      case 'heartbeat':
        this.push('心跳已受理，设备状态置为在线');
        break;
      case 'telemetry': {
        this.frames += 1;
        // 演示用的稳定时延：40–80 ms
        this.latencyMs = 40 + Math.floor(Math.random() * 40);
        this.received += 1;
        this.push(`收到第 ${this.frames} 帧，端到端时延 ${this.latencyMs} ms`);
        break;
      }
      case 'command': {
        this.mission = {
          missionId: `M-${Date.now()}-demo`,
          type: 'spray_mission',
          target: { grid: { row: 10, col: 12 }, cells: 19 },
          spray: { speed: 8, swath: 1.0, flow: 0.53, dose: 12, agent: '戊唑醇·苯醚甲环唑' },
        };
        this.ack = '设备已接收';
        this.push('云端下发靶向施药作业单，设备已回执');
        break;
      }
      case 'settle': {
        const usage = { areaMu: 30, volumeL: 0.57, minutes: 3.61, sorties: 1, detections: 19, savedL: 24.6 };
        const spray = usage.areaMu * 12;
        const survey = usage.areaMu * 3;
        this.billed = { ...usage, spray, survey, total: +(spray + survey).toFixed(2) };
        this.push(`用量已入账，账单 ¥${this.billed.total}`);
        break;
      }
      default:
        break;
    }
    this.stage += 1;
    return { step: s, index: this.stage - 1, done: this.stage >= ONBOARDING_STEPS.length };
  }

  push(msg) {
    this.log.push({ ts: Date.now(), msg });
  }

  get finished() { return this.stage >= ONBOARDING_STEPS.length; }
}

/** 开放平台的对外卖点（页面与申报材料共用） */
export const OPEN_PLATFORM_VALUE = [
  {
    key: 'contract',
    title: '一份数据契约',
    desc: '遥测帧、识别结果、作业单三类报文格式全部公开，设备端与云端对同一份 schema 编码，不存在理解分叉。',
  },
  {
    key: 'simulator',
    title: '零门槛试跑',
    desc: '开发者不接真机也能在页面上跑完整接入流程，看到每一步的平台响应与最终账单。',
  },
  {
    key: 'no-lockin',
    title: '不绑定硬件',
    desc: '接口与硬件无关。换一家植保无人机、换一种底盘，平台侧零改动。',
  },
  {
    key: 'traceable',
    title: '全程可追溯',
    desc: '从设备注册、密钥签发、遥测时延、指令回执到计量出账，每一步都有平台侧记录可查。',
  },
];
