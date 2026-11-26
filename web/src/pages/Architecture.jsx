import React from 'react';
import SceneDiagram from '../components/SceneDiagram.jsx';
import { figureSrc } from '../research-figures.js';
import {
  IconDrone, IconRobot, IconPlant, IconSocket, IconBatch, IconBroker,
  IconCloudServer, IconEngine, IconRoute, IconChart,
  IconOperator, IconFarmer, IconExpert, IconManager,
  IconScan, IconDispatch, IconConfirm, IconSpray,
} from '../components/Icons.jsx';

/**
 * 平台流程图（HTML + 内联 SVG）
 *
 * 用 HTML 而非整块 SVG 绘制，是为了让中文文字随主题字号缩放、保持清晰，
 * 而图形部分由 SVG 手绘图标承担「一眼可辨」的任务。
 */

/* ---------- 分层节点：图标 + 名称 + 说明 ---------- */
const FLOW_STAGES = [
  {
    key: 'sense',
    color: 'var(--uav)',
    title: '感知层',
    subtitle: '空地双端采集',
    icons: [IconDrone, IconRobot, IconPlant],
    iconLabels: ['植保无人机', '地面机器人', '病害部位'],
    desc: '空中采冠层与叶面，地面采叶下、根茎与土壤，二者互补覆盖同一片麦田。',
  },
  {
    key: 'transport',
    color: 'var(--warn)',
    title: '传输层',
    subtitle: '三通道冗余',
    icons: [IconSocket, IconBatch, IconBroker],
    iconLabels: ['WebSocket 主通道', 'HTTP 批量补传', 'MQTT 扩展通道'],
    desc: '主通道 5–10 Hz 实时上行；盲区缓存按 seq 幂等补传；多机队走 MQTT 订阅模型。',
  },
  {
    key: 'cloud',
    color: 'var(--accent)',
    title: '云端层',
    subtitle: '穗云智策内核',
    icons: [IconCloudServer, IconEngine, IconRoute, IconChart],
    iconLabels: ['数据接入', '联动决策引擎', '路径规划求解器', '六维分析引擎'],
    desc: '统一契约校验后进入决策：判据裁决是否派单、生成靶向任务、解算最优航线与流量比例。',
  },
  {
    key: 'app',
    color: 'var(--robot)',
    title: '应用层',
    subtitle: '四类角色',
    icons: [IconOperator, IconFarmer, IconExpert, IconManager],
    iconLabels: ['飞手/操作员', '农户', '农技专家', '管理方'],
    desc: '飞手看态势与航线，农户拿可执行结论，专家做趋势研判，管理方看效率与成本。',
  },
];

/* ---------- 联动闭环五步 ---------- */
const LOOP_STEPS = [
  { icon: IconScan, color: 'var(--uav)', label: '空中发现', desc: '无人机巡航识别疑似病斑' },
  { icon: IconDispatch, color: 'var(--warn)', label: '云端派单', desc: '按置信度/病位判定需否复核' },
  { icon: IconRobot, color: 'var(--robot)', label: '机器人复核', desc: '驶向目标近距补拍叶下根茎' },
  { icon: IconConfirm, color: 'var(--accent)', label: '云端确认', desc: '融合空地证据确诊或排除' },
  { icon: IconSpray, color: 'var(--uav)', label: '靶向喷洒', desc: '按速度-喷洒比例执行喷洒' },
];

export default function Architecture() {
  return (
    <>
      <div className="page-head">
        <h2>系统架构 · 空地协同植保云平台</h2>
        <p>无人机空中巡检、地面机器人近距复核、云端居中裁决与下发，四类功能统一在同一份数据契约之下。</p>
      </div>

      {/* ============ 论文架构图 ============ */}
      {/*
        这张图来自队友交付的论文图包（图 1）。
        它与本页下面的平台架构是同一套东西的两种画法 ——
        论文画的是「感知 → 检测 → 规划 → 执行」的算法流水线，
        本页画的是「感知 → 传输 → 云端 → 应用」的分层结构。
        放在一起是为了说明：平台不是论文的演示壳，
        而是论文里的算法真的在跑。
      */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="sub-title">
          <span className="chip">论文 图 1</span>
          系统总体架构与数据流
          <span className="tag">四段式流水线</span>
        </div>
        <img
          src={figureSrc('fig01-system-architecture')}
          alt="感知、检测、规划、执行四段式流水线的数据流与核心公式"
          style={{
            width: '100%',
            display: 'block',
            borderRadius: 8,
            background: '#fff',
            border: '1px solid var(--line)',
          }}
        />
        <p className="hint" style={{ marginTop: 10 }}>
          多源感知（RGB / 热红外 / 飞行状态 / GNSS / 气象）汇入病害检测，
          再经多机协同任务分配与植保作业执行闭环 ——
          本平台的「算法基准」页给出的检测精度、规划收益、施药剂量，
          就是这张图上每个环节的实测结果。
        </p>
      </div>

      {/* ============ 场景总图 ============ */}
      <div className="card arch-scene">
        <h3>
          作业场景总图
          <span className="tag">示意图 · 非实拍</span>
        </h3>
        <p className="hint">虚线箭头即真实数据流向：上行采集，下行任务。</p>
        <SceneDiagram />
      </div>

      {/* ============ 平台流程图 ============ */}
      <div className="card" style={{ marginTop: 14 }}>
        <h3>
          平台流程图
          <span className="tag">数据自下而上，逐层收敛</span>
        </h3>
        <p className="hint">设备采集 → 冗余传输 → 云端内核裁决 → 面向角色的服务输出。</p>

        <div className="flow">
          {FLOW_STAGES.map((stage, i) => (
            <React.Fragment key={stage.key}>
              <div className="flow-stage" style={{ '--stage': stage.color }}>
                <div className="flow-stage-head">
                  <span className="flow-idx">{i + 1}</span>
                  <div>
                    <div className="flow-stage-title">{stage.title}</div>
                    <div className="flow-stage-sub">{stage.subtitle}</div>
                  </div>
                </div>
                <div className="flow-icons">
                  {stage.icons.map((Ico, j) => (
                    <div className="flow-icon" key={j}>
                      <span className="flow-icon-art">
                        <Ico size={46} color={stage.color} />
                      </span>
                      <span className="flow-icon-label">{stage.iconLabels[j]}</span>
                    </div>
                  ))}
                </div>
                <p className="flow-desc">{stage.desc}</p>
              </div>

              {i < FLOW_STAGES.length - 1 && (
                <div className="flow-arrow" aria-hidden="true">
                  <svg width="42" height="24" viewBox="0 0 42 24">
                    <line x1="2" y1="12" x2="30" y2="12" stroke="var(--text-mute)" strokeWidth="2.4" strokeDasharray="6 5" />
                    <path d="M28 5 L38 12 L28 19" fill="none" stroke="var(--text-mute)" strokeWidth="2.4" strokeLinejoin="round" />
                  </svg>
                  <span>上行</span>
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ============ 联动闭环五步 ============ */}
      <div className="card" style={{ marginTop: 14 }}>
        <h3>
          空地联动闭环
          <span className="tag">五步 · 每步时延可追溯</span>
        </h3>
        <p className="hint">判据写在云端：置信度低于 75%、病位在叶下/根茎/土壤、或赤霉病与根腐病 → 派单机器人复核；否则直接生成喷洒任务。</p>
        <div className="loop">
          {LOOP_STEPS.map((s, i) => (
            <React.Fragment key={s.label}>
              <div className="loop-step">
                <span className="loop-art" style={{ color: s.color }}>
                  <s.icon size={44} color={s.color} />
                </span>
                <div className="loop-no" style={{ background: s.color }}>{i + 1}</div>
                <div className="loop-label">{s.label}</div>
                <div className="loop-desc">{s.desc}</div>
              </div>
              {i < LOOP_STEPS.length - 1 && (
                <div className="loop-arrow" aria-hidden="true">›</div>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ============ 分层明细 ============ */}
      <div className="stack" style={{ gap: 14, marginTop: 14 }}>
        {FLOW_STAGES.map((stage) => (
          <div className="card" key={stage.key}>
            <h3>
              <span className="arch-badge" style={{ borderColor: stage.color, color: stage.color }}>
                {stage.title}
              </span>
              {stage.subtitle}
            </h3>
            <LayerDetail stage={stage} />
          </div>
        ))}
      </div>

      {/* ============ 契约与对比 ============ */}
      <div className="grid g2" style={{ marginTop: 14 }}>
        <div className="card">
          <h3>数据契约 <span className="tag">三端共用</span></h3>
          <p className="hint">四类消息在 shared/schema.js 中集中定义，三端引用同一份，避免字段漂移。</p>
          <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>消息</th><th>方向</th><th>关键字段</th></tr></thead>
            <tbody>
              {[
                ['遥测帧', '设备 → 云端', 'ts, seq, pos, batt, coverage'],
                ['识别结果', '设备 → 云端', 'part, disease, confidence, geo, grid'],
                ['作业任务', '云端 → 设备', 'target.cells, spray.speed/flow/swath, plan'],
                ['联动事件', '云端内部 + 广播', 'chain, latency{sense,dispatch,act,total}'],
              ].map(([m, d, f]) => (
                <tr key={m}><td><b>{m}</b></td><td className="xs dim">{d}</td><td className="mono xs mute">{f}</td></tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>

        <div className="card">
          <h3>相比重构前解决了什么</h3>
          <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>重构前</th><th>重构后</th></tr></thead>
            <tbody>
              {[
                ['四个平台各自独立，数据不互通', '统一数据契约，一份数据支撑全部功能'],
                ['航线靠地面站手动画', '自动规划求解器，三目标可调、一键下发'],
                ['飞行与喷洒参数凭经验', '速度-喷洒比例自动求解，附可行区间校验'],
                ['无实时性指标，无法量化', '端到端时延、P95、丢包率、RTT 全程可查'],
                ['统计只给图表，不给结论', '每个维度同步输出可执行农户建议'],
                ['云端仅在本地，无公网入口', '云端服务化部署，平台可在公网直接访问'],
              ].map(([a, b]) => (
                <tr key={a}>
                  <td className="xs dim" style={{ whiteSpace: 'normal' }}>{a}</td>
                  <td className="xs" style={{ whiteSpace: 'normal', color: 'var(--accent)' }}>{b}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------- 每层的具体条目（配图标） ---------- */
const DETAILS = {
  sense: [
    { icon: IconDrone, color: 'var(--uav)', k: '植保无人机 UAV', v: '可见光 + 多光谱相机；RTK 定位；YDLIDAR X3 激光雷达避障；5L 药箱、1m 窄幅喷施' },
    { icon: IconRobot, color: 'var(--robot)', k: '地面监测机器人 ROB', v: '四轮轮式底盘、越野轮胎、弹簧悬挂、分层安装板；机载计算与控制模块；前视/俯视 180° 云台；双目深度相机' },
    { icon: IconPlant, color: 'var(--accent)', k: '采集部位', v: '空中：冠层与叶面；地面：叶下、根茎部、土壤表面 —— 二者互补覆盖' },
  ],
  transport: [
    { icon: IconSocket, color: 'var(--accent-2)', k: '主通道 WebSocket', v: '5–10Hz 遥测帧上行，云端逐帧 ACK 计时，端到端时延 <150ms' },
    { icon: IconBatch, color: 'var(--accent-2)', k: '兜底通道 HTTP 批量补传', v: '盲区缓存 + seq 幂等去重，恢复后批量回传，统计丢包率' },
    { icon: IconBroker, color: 'var(--accent-2)', k: '扩展通道 MQTT', v: '多机队扩展预留，QoS 分层策略' },
  ],
  cloud: [
    { icon: IconCloudServer, color: 'var(--accent)', k: '数据接入服务', v: '统一契约校验、时延计算、链路质量指标' },
    { icon: IconEngine, color: 'var(--accent)', k: '联动决策引擎', v: '置信度/病位判据 → 派单机器人 → 融合确认 → 生成喷洒任务' },
    { icon: IconRoute, color: 'var(--accent)', k: '路径规划求解器', v: '航向×速度×喷幅联合搜索，三目标加权；速度-喷洒比例自动求解' },
    { icon: IconChart, color: 'var(--accent)', k: '多维分析引擎', v: '空间/时间/病害/平台/作业/环境六维，输出可执行结论' },
  ],
  app: [
    { icon: IconOperator, color: 'var(--robot)', k: '飞手 / 操作员', v: '实时态势、航线自动规划、任务下发与审批' },
    { icon: IconFarmer, color: 'var(--robot)', k: '农户', v: '今日作业结论、防治建议、用药与成本节约' },
    { icon: IconExpert, color: 'var(--robot)', k: '农技专家', v: '六维数据回溯、病害趋势与区域风险研判' },
    { icon: IconManager, color: 'var(--robot)', k: '管理方', v: '作业效率、成本、保险与农情数据服务' },
  ],
};

function LayerDetail({ stage }) {
  const items = DETAILS[stage.key] || [];
  return (
    <div className="grid g3">
      {items.map(it => (
        <div className="detail" key={it.k} style={{ '--c': it.color }}>
          <div className="detail-head">
            <span className="detail-art" style={{ color: it.color }}>
              <it.icon size={38} color={it.color} />
            </span>
            <span className="detail-k">{it.k}</span>
          </div>
          <div className="detail-v">{it.v}</div>
        </div>
      ))}
    </div>
  );
}
