# 穗云智策 · 空地协同精准植保智能决策云平台

面向小麦病害防控的空地协同精准施药系统的云端平台重构版本。

**公网访问地址**：https://mediator-cmd.github.io/suiyunzhice-platform/

**一句话**：植保无人机负责空中广域巡查，地面监测机器人负责近距复核，云端平台完成实时数据接入、三者联动决策、六维统计分析与自动路径规划，最终向农户交付"今天该做什么"的可执行结论。

---

## 一、平台回答的四个问题

| 老师的要求 | 平台对应能力 | 所在页面 |
|---|---|---|
| 无人机的数据怎么跟云端传输？实时性怎么保证？ | WebSocket 主通道（5–10Hz + 逐帧 ACK 计时）+ HTTP 批量补传（弱网兜底）+ MQTT 扩展预留；端到端时延、P95、丢包率、RTT 全程可查 | 实时监控 |
| 数据统计分析分哪些维度？对农户有什么用？ | 空间 / 时间 / 病害 / 平台 / 作业 / 环境 六维；**每一维同时输出可执行的农户结论**，不只是图表 | 数据分析、农户服务 |
| 小车和无人机的数据怎么互相整理统计？三者怎么实时联动？ | 空中发现 → 云端判据 → 派单机器人 → 近距复核 → 云端确认 → 靶向喷洒 的闭环；每段时延逐段可查 | 空地联动 |
| 大面积喷洒怎么飞？速度与喷洒比例怎么调？轨迹怎么最经济/最快/最环保？ | 航向 × 速度 × 喷幅三维联合搜索，三目标加权打分；速度-喷洒比例自动求解并给出可行区间；与人工手画航线量化对比 | 路径规划 |

---

## 二、技术栈

- **前端**：React 18 + Vite 6 + Recharts + Leaflet（`web/`）
- **服务端**：Node 22 + Express + ws + `node:sqlite`（零原生依赖）（`server/`）
- **共享内核**：`shared/` —— 数据契约与全部业务算法，**前后端跑同一份代码**

```
挑战杯/_大创平台/
├── shared/                  ← 前后端共用的内核
│   ├── schema.js            统一数据契约（遥测帧/识别结果/任务/联动事件）
│   ├── planner.js           路径规划求解器（航向/速度/喷幅搜索 + 速度-喷洒比例）
│   ├── analytics.js         六维统计 + 农户简报
│   ├── linkage.js           空地联动决策引擎
│   ├── simulator.js         数据模拟器（无设备时演示）
│   ├── linkstats.js         链路质量统计（时延/P95/丢包率）
│   ├── spraydispatch.js     靶向施药派工（确诊病灶 → 分区作业单 + 节药率）
│   ├── platform.js          平台内核：地块定义、规划缓存、元数据
│   └── memstore.js          内存存储（纯静态部署用，接口与 SQLite 版一致）
├── server/src/
│   ├── index.js             HTTP + WS 入口、REST API
│   ├── hub.js               实时数据接入（WebSocket 通道）
│   └── store.js             SQLite 持久化
├── web/src/
│   ├── api.js               API 客户端 + 实时订阅 + 浏览器端降级引擎
│   ├── components/FieldMap.jsx
│   └── pages/               9 个功能页面
├── deploy/                  Dockerfile / compose / nginx / deploy.sh / 自检脚本
└── .github/workflows/pages.yml   GitHub Pages 自动发布
```

**为什么要这样分层**：平台的所有结论（药液用量、节约率、闭环时延、规划得分）
都来自 `shared/` 里的算法。真实部署时它们跑在 Node 服务端并落到 SQLite；
纯静态部署时同样的代码跑在浏览器里、用内存存储。
**两种环境下页面显示的数字口径完全一致**，申报材料里引用的数值不会因为演示环境改变而对不上。

---

## 三、本地运行

```bash
npm install
node server/src/index.js        # → http://localhost:8080
```

前端开发模式（热更新，:5173，自动代理 API 与 WS 到 :8080）：

```bash
cd web && npx vite
```

其他命令：

```bash
bash deploy/deploy.sh build     # 构建静态产物
bash deploy/deploy.sh docker    # Docker 一键起完整服务
bash deploy/deploy.sh tunnel    # Cloudflare Tunnel 临时公网入口
bash deploy/deploy.sh pages     # 构建并推送到 GitHub Pages
```

---

## 四、公网部署方案

### 方案 A：GitHub Pages（推荐，最快拿到可提交链接）

前端是纯静态站，且 **`shared/` 内核在浏览器里直接运行** —— 即使后端未部署，
全部 8 个页面（含路径规划、速度-喷洒比例求解）依然完整可用，只是数据来自内置模拟器
而非真实设备。页面右上角会显示「演示模式」。

1. `bash deploy/deploy.sh pages`（或手动把 `web/dist` 推到 `gh-pages` 分支）
2. 仓库 `Settings → Pages → Source` 选 `gh-pages` 分支
3. 访问 `https://<用户名>.github.io/<仓库名>/`

工作流 `.github/workflows/pages.yml` 已配置，推送 `main` 即自动发布。

**自检**（模拟"只有静态站、没有后端"的真实 Pages 环境）：

```bash
node deploy/_static_server.mjs      # 起一个纯静态服务器，不做任何 /api 代理
node deploy/_shot_static.mjs        # 逐页截图 + 控制台错误检查
```


### 方案 B：Docker + 云服务器（完整形态，真实设备数据）

```bash
bash deploy/deploy.sh docker
```

`deploy/nginx.conf` 已配好 `/api` 与 `/ws` 反向代理。**注意 `/ws/` 必须带 `Upgrade`/`Connection` 头**，否则 WebSocket 握手返回 400、实时推送失效。

### 方案 C：Cloudflare Tunnel（临时演示，免备案）

```bash
bash deploy/deploy.sh tunnel
```

输出 `https://<random>.trycloudflare.com` 即可公开访问，适合答辩现场临时演示。

---

## 五、设备接入

设备端只需按协议连上来，不需了解平台内部实现。完整示例见平台「平台方案」页。

**WebSocket 遥测**（`ws://host/ws/telemetry`）：

```json
{
  "type": "telemetry",
  "payload": {
    "frameId": "F-1", "ts": 1730000000000, "seq": 1,
    "deviceId": "UAV-01", "kind": "uav", "state": "surveying",
    "pos": { "x": 12.4, "y": 33.1, "z": 2.0, "alt": 2.0, "spd": 6.0, "hdg": 90 },
    "batt": 91, "coverage": 0.12,
    "payload": { "waterL": 5, "flowLmin": 1.44, "swathM": 1.0 }
  }
}
```

**识别结果**（同连接发送，`confidence < 0.75` 会自动触发机器人复核派单）：

```json
{
  "type": "detection",
  "payload": {
    "detId": "D-1", "ts": 1730000000000, "deviceId": "UAV-01", "kind": "uav",
    "part": "stem", "disease": "root_rot", "confidence": 0.62,
    "bbox": { "x": 210, "y": 130, "w": 62, "h": 58 },
    "geo": { "x": 41.2, "y": 63.5 }, "grid": { "row": 12, "col": 8 },
    "model": "SAN-GAT-RL"
  }
}
```

**弱网批量补传**：`POST /api/ingest/batch`，携带 `seq` 供云端统计丢包。

---

## 六、核心 API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/meta` | 地块、病种字典、分析维度、规划目标定义 |
| GET | `/api/devices` | 设备列表与实时状态 |
| GET | `/api/devices/telemetry` | 遥测历史 |
| GET | `/api/link/metrics` | 链路质量：时延 / P95 / 丢包率 / RTT |
| GET | `/api/detections` | 识别结果 |
| GET | `/api/missions` | 作业任务 |
| GET | `/api/linkage/events` | 联动事件与统计 |
| GET | `/api/analytics/overview` | 总览 KPI |
| GET | `/api/analytics/{dim}` | 六维分析 |
| GET | `/api/briefing` | 农户简报 |
| GET | `/api/plan` | 自动规划结果（`?mode=full\|target&weights=经济,快速,环保`） |
| POST | `/api/plan/ratio` | 速度-喷洒比例求解 |
| POST | `/api/plan/simulate` | 人工航线基线模拟 |
| POST | `/api/missions` | 创建作业任务 |
| POST | `/api/missions/{id}/status` | 更新任务状态 |
| POST | `/api/ingest/batch` | 批量补传 |
| WS | `/ws/telemetry` | 设备遥测接入 |
| WS | `/ws/live` | 前端实时订阅 |

---

## 七、规划模型说明

### 作业模式

| 模式 | 喷幅 | 适用 | 2 ha 示范田实测 |
|---|---|---|---|
| `full` 全田覆盖 | 4–7 m 整机喷幅 | 病害初发、尚未成片 | 15 条航线 / 3110 m / 6.56 min / 1 架次 / 25.2 L / 耗电 29.2% |
| `target` 靶向点喷 | 1 m 窄幅 | 病害已明确、只打有病的地方 | 19 个病灶格 / 95 条喷带 / 3.72 min / **0.57 L** / 靶向覆盖率 1.0、溢出 0 |

靶向模式药量仅为全田模式的 **2.3%**，这就是"精准施药"最直观的量化结果。

> 靶向模式的格数、簇数、时长随病灶的空间分布而变（簇按八邻域连通划分，
> 病灶越集中簇越少、转场越短、耗时越短）。上表是申报材料采用的那组
> 19 格分布下的结果，页面「路径规划 → 靶向点喷作业」可实时复现。

### 速度-喷洒比例

喷头流量必须与「前进速度 × 喷幅」严格成正比：

```
每米药液量 = 喷幅 × 目标施药量(L/ha) / 10000     ← 与速度无关
喷洒流量(L/min) = 每米药液量 × 飞行速度(m/s) × 60
```

由于每米药液量与速度无关，**流量 ÷ 速度 = 常数**（`flowPerSpeed`），变速时按此比例同步调整喷阀 PWM 占空比即可。平台同时给出可行速度区间：低于下限会断续喷雾，高于上限会漏喷。

### 三目标打分

- **经济**：总作业时长（含换药架次）+ 药耗 + 总能耗
- **快速**：航线总长 + 转弯航程 × 3
- **环保**：重喷率 + 转弯占比 + 靶向模式的非目标区溢出面积

权重可调（默认 0.4 / 0.35 / 0.25），在候选集内归一化后加权。搜索空间为航向 8 × 速度 5 × 喷幅 4 = 160 组可行解。

### 能耗与架次

- 巡航 0.0092 %/m，转弯段（减速+悬停）0.085 %/s
- 5 L 药箱：药液耗尽即需返航换药，架次 = ⌈药量 / 5 L⌉，每次换药约 6 min
- 参数标定参考申报书竞品表：极目 EA-30X 续航 22.7 min / 大疆 T25 续航 40 min

---

## 八、已知边界

- 能耗模型为简化标定模型，未经实测台架验证；申报书中的续航数据来自竞品对比表。
- 靶向网格由识别结果的置信度阈值（0.75）筛出，误检会带入非目标网格。
- `savedRatio`（药液节约率）只在存在喷洒任务时计算，否则显示"待作业"而非编造数字。
  口径为「整田均匀喷施（全田面积 × 12 L/ha）」对比「靶向点喷实际药耗」，
  页面同时标出对照基准，避免只看百分比。
- 联动时延中「执行到位」段为物理行程估计值，非实测。
- 演示模式下的数据来自内置模拟器，形状与真实设备一致但非真实采集；
  纯静态部署时数据只存在于浏览器内存中，刷新页面即重置。
