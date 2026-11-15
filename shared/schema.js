/**
 * 穗云智策 · 空地协同云平台 —— 统一数据契约
 * 无人机 / 地面机器人 / 云端 三端共用同一套字段定义。
 * 任何一端新增字段，必须先改这里，再改实现。
 */

/** 作物与病害字典 */
export const DISEASES = [
  { code: 'rust',        name: '锈病',     latin: 'Puccinia spp.',  mainPart: '叶片', severityHint: '叶部橙褐色孢子堆', window: '初发期即抢防，7–10 天复查' },
  { code: 'powdery',     name: '白粉病',   latin: 'Blumeria graminis', mainPart: '叶片', severityHint: '白色粉层', window: '轻症物理防治，重症三唑酮' },
  { code: 'loose_smut',  name: '散黑穗病', latin: 'Sphacelotheca reiliana', mainPart: '穗部', severityHint: '黑色穗粒', window: '播种期拌种，拔节期无法补救' },
  { code: 'root_rot',    name: '根腐病',   latin: 'Rhizoctonia solani', mainPart: '根茎部', severityHint: '茎基褐变', window: '近地确认后结合墒情评估' },
  { code: 'fusarium',    name: '赤霉病',   latin: 'Fusarium graminearum', mainPart: '穗部', severityHint: '穗部霉层', window: '显症即抢防，单独标记区域' },
  { code: 'leaf_blight', name: '叶枯病',   latin: 'Septoria tritici', mainPart: '叶片', severityHint: '叶片早衰斑', window: '作为长势指标，慎用农药' },
];

/** 设备类型 */
export const DEVICE_KINDS = {
  UAV: 'uav',        // 植保无人机
  ROBOT: 'robot',    // 地面监测机器人
  CLOUD: 'cloud',    // 云端决策
};

/** 设备状态机 */
export const DEVICE_STATES = {
  OFFLINE: 'offline',
  IDLE: 'idle',
  TAKEOFF: 'takeoff',
  SURVEYING: 'surveying',   // 空中巡查
  RECHECKING: 'rechecking', // 地面机器人复核作业中
  RELOADING: 'reloading',   // 返航换药 / 补液
  SPRAYING: 'spraying',     // 靶向喷洒
  RETURNING: 'returning',   // 返航
  CHARGING: 'charging',
  MAINTENANCE: 'maintenance',
};

/** 坐标系：本地 ENU（东-北-地，米） */
export const COORD_SYS = {
  id: 'LOCAL_ENU',
  unit: 'm',
  origin: '地块边界西南角',
  note: '所有平面坐标均为地块局部 ENU 坐标，单位米，+X 东、+Y 北、+Z 上',
};

/**
 * 遥测帧：设备 → 云端
 * 这是"数据传输实时性"的核心契约。字段是"谁在什么时候、在哪、看到了什么"。
 */
export const TELEMETRY = {
  frameId: 'string  帧唯一 ID',
  ts: 'number  设备端 Unix 毫秒时间戳（采集时刻，非发送时刻）',
  seq: 'number  设备端自增序号，用于丢包率统计',
  deviceId: 'string  设备 ID',
  kind: 'uav|robot',
  state: 'string  见 DEVICE_STATES',
  pos: {
    x: 'number  ENU 米',
    y: 'number  ENU 米',
    z: 'number  ENU 米（相对起飞面）',
    alt: 'number  RTK/气压计离地高度 米',
    spd: 'number  地速 m/s',
    hdg: 'number  航向角 度 0-360',
  },
  batt: 'number  电量百分比 0-100',
  payload: 'object  载荷状态',
  coverage: 'object  覆盖进度',
  extra: 'object  设备私有字段',
};

/** 图像/识别结果：设备 → 云端（可与遥测同帧，也可单独批量） */
export const DETECTION = {
  detId: 'string',
  ts: 'number  采集时刻 Unix ms',
  deviceId: 'string',
  kind: 'uav|robot',
  /** 采集部位：空中看冠层/叶面，地面看叶下/根茎/土壤 */
  part: 'canopy|leaf|underside|stem|soil',
  disease: 'string  DISEASES.code',
  confidence: 'number  0-1',
  bbox: { x: 'number', y: 'number', w: 'number', h: 'number' }, // 像素，原图坐标系
  /** 地理/局部坐标定位：识别框在田块中的位置 */
  geo: { x: 'number', y: 'number' },
  grid: { row: 'number', col: 'number' },  // 网格编号，田块被划成 row×col
  model: 'string  模型版本，如 SAN-GAT-RL / YOLOv8',
  imageUrl: 'string?  可选，原图或裁剪图地址',
};

/** 作业任务：云端 → 设备 */
export const MISSION = {
  missionId: 'string',
  createdAt: 'number',
  type: 'survey|spray|recheck',
  target: {
    grid: { row: 'number', col: 'number' },
    cells: 'number[]  网格索引列表',
    bbox: { minX: 'number', minY: 'number', maxX: 'number', maxY: 'number' },
  },
  disease: 'string?',
  /** 喷洒参数：速度与喷洒速率的关键比例 */
  spray: {
    speed: 'number  飞行速度 m/s',
    swath: 'number  喷幅 m',
    flow: 'number  流量 L/min',
    /** 关键比例：喷洒速率 ÷ 飞行速度 = 单位面积药液量 L/m² */
    ratePerSpeed: 'number  flow/(speed*swath*60) L/m²',
    dose: 'number  L/ha',
    agent: 'string  药剂名',
  },
  /** 规划结果 */
  plan: {
    algo: 'string  ISCA-A* / S-CA / Manual',
    length: 'number  航线总长 m',
    estMinutes: 'number  预计作业时长 min',
    estEnergy: 'number  预计耗电 %',
    estDose: 'number  预计总药液量 L',
    ecoScore: 'number  环保评分 0-100（越低越环保）',
  },
  status: 'pending|approved|dispatched|running|done|rejected',
};

/** 联动事件：三者联动的可观测记录（平台的核心卖点之一） */
export const LINK_EVENT = {
  eventId: 'string',
  ts: 'number',
  /** 触发源 */
  trigger: {
    deviceId: 'string',
    kind: 'uav|robot|cloud',
    reason: 'string  如 "疑似病斑置信度低，需近地复核"',
  },
  /** 联动链：从触发到闭环的每一步 */
  chain: 'string[]  如 ["uav_detect","cloud_dispatch","robot_recheck","cloud_confirm","uav_spray"]',
  /** 目标网格 */
  grid: { row: 'number', col: 'number' },
  /** 时延分解（毫秒）——用于向老师证明"实时" */
  latency: {
    sense: 'number  感知→决策',
    dispatch: 'number  决策→下发',
    act: 'number  下发→执行到位',
    total: 'number  端到端',
  },
  closed: 'boolean',
};

/** 分析维度枚举：数据统计分析分哪些维度 */
export const ANALYTICS_DIMENSIONS = [
  { key: 'spatial',   name: '空间维度', desc: '按网格/地块/分区统计病害密度与作业覆盖' },
  { key: 'temporal',  name: '时间维度', desc: '按日/周/生育期统计发生趋势与防治窗口' },
  { key: 'disease',   name: '病害维度', desc: '按病种、部位、置信度分层统计' },
  { key: 'platform',  name: '平台维度', desc: '按无人机/机器人分工统计采集量与命中率' },
  { key: 'task',      name: '作业维度', desc: '按任务统计航时、药液、覆盖、防效' },
  { key: 'environment', name: '环境维度', desc: '按温湿度、光照、风速分组的作业条件与效果' },
];

/** 路径规划目标函数：老师提出的"最经济、最快速、最环保" */
export const PLAN_OBJECTIVES = {
  economy:   { name: '最经济', metric: '单位面积药耗/电耗/航时成本', weight: '默认 0.4' },
  speed:     { name: '最快速', metric: '航程最短 + 转弯次数最少', weight: '默认 0.35' },
  eco:       { name: '最环保', metric: '非目标区重喷率 + 药剂越界量', weight: '默认 0.25' },
};

/** 速度-喷洒比例关系说明 */
export const SPRAY_RATIO_NOTE = {
  formula: '喷洒速度 = 飞行速度 × 喷幅',
  unit: 'L/min = m/s × m',
  key: '喷洒流量与飞行速度严格成正比。飞行加速则必须同比加大流量，否则会出现药液沉积不足（漏喷）；减速则需同比减小流量，否则会超喷与药害。',
  target: '平台自动求解该比例，并允许用户在"经济/快速/环保"三种模式间切换。',
};

/** 一条统一的数据链路指标（实时性证明） */
export const LINK_METRIC = {
  deviceId: 'string',
  kind: 'uav|robot',
  sent: 'number  设备发出帧数',
  recv: 'number  云端收到帧数',
  lost: 'number  丢帧数',
  avgLatencyMs: 'number  平均端到端时延（采集→云端可见）',
  p95LatencyMs: 'number',
  lastSeen: 'number',
  rttMs: 'number  设备↔云端往返',
};
