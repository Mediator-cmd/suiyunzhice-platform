import React from 'react';

const LAYERS = [
  {
    name: '感知层 · 空地双端',
    color: 'var(--uav)',
    items: [
      ['植保无人机 UAV', '可见光 + 多光谱相机；RTK 定位；YDLIDAR X3 激光雷达避障；5L 药箱、1m 窄幅喷施'],
      ['地面监测机器人 ROB', '四轮轮式底盘、越野轮胎、弹簧悬挂、分层安装板；机载计算与控制模块；前视/俯视 180° 云台；双目深度相机'],
      ['采集部位', '空中：冠层与叶面；地面：叶下、根茎部、土壤表面 —— 二者互补覆盖'],
    ],
  },
  {
    name: '传输层 · 三通道',
    color: 'var(--accent-2)',
    items: [
      ['主通道 WebSocket', '5–10Hz 遥测帧上行，云端逐帧 ACK 计时，端到端时延 <150ms'],
      ['兜底通道 HTTP 批量补传', '盲区缓存 + seq 幂等去重，恢复后批量回传，统计丢包率'],
      ['扩展通道 MQTT', '多机队扩展预留，QoS 分层策略'],
    ],
  },
  {
    name: '云端层 · 平台服务',
    color: 'var(--accent)',
    items: [
      ['数据接入服务', '统一契约校验、时延计算、链路质量指标'],
      ['联动决策引擎', '置信度/病位判据 → 派单机器人 → 融合确认 → 生成喷洒任务'],
      ['路径规划求解器', '航向×速度×喷幅联合搜索，三目标加权；速度-喷洒比例自动求解'],
      ['多维分析引擎', '空间/时间/病害/平台/作业/环境六维，输出可执行结论'],
    ],
  },
  {
    name: '应用层 · 面向不同角色',
    color: 'var(--robot)',
    items: [
      ['飞手 / 操作员', '实时态势、航线自动规划、任务下发与审批'],
      ['农户', '今日作业结论、防治建议、用药与成本节约'],
      ['农技专家', '六维数据回溯、病害趋势与区域风险研判'],
      ['管理方', '作业效率、成本、保险与农情数据服务'],
    ],
  },
];

export default function Architecture() {
  return (
    <>
      <div className="page-head">
        <h2>系统架构</h2>
        <p>
          平台重构后的整体分层。核心变化在于把原来分散在各软件著作权中的功能（视觉识别管理平台、
          病虫害爆发预警平台、小麦状态评估软件、感知行为与决策系统）统一到一个数据契约之下，
          形成可扩展的云端服务，而不是四个互不相通的工具。
        </p>
      </div>

      <div className="stack" style={{ gap: 12 }}>
        {LAYERS.map((layer, i) => (
          <div className="card" key={layer.name}>
            <h3>
              <span style={{
                display: 'inline-flex', width: 21, height: 21, borderRadius: 5,
                background: 'var(--bg)', border: `1px solid ${layer.color}`, color: layer.color,
                alignItems: 'center', justifyContent: 'center', fontSize: 11, marginRight: 3,
              }}>{i + 1}</span>
              {layer.name}
            </h3>
            <div className="grid g3">
              {layer.items.map(([k, v]) => (
                <div key={k} style={{ padding: '10px 12px', background: 'var(--panel-2)', borderRadius: 7, borderLeft: `2px solid ${layer.color}` }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{k}</div>
                  <div className="xs dim">{v}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="grid g2" style={{ marginTop: 12 }}>
        <div className="card">
          <h3>数据契约 <span className="tag">三端共用</span></h3>
          <p className="hint">
            平台稳定性的前提是「字段定义只有一处」。遥测帧、识别结果、作业任务、联动事件四类消息
            在 shared/schema.js 中集中定义，设备端、云端、前端引用同一份，避免字段漂移。
          </p>
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

        <div className="card">
          <h3>相比重构前解决了什么</h3>
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
    </>
  );
}
