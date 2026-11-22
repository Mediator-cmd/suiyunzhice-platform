import React, { useEffect, useState } from 'react';
import { CHART } from '../theme.js';
import { HARDWARE_PHOTOS } from '../assets.js';
import { api } from '../api.js';
import { BRAND, BRAND_FULL, OFFICIAL_URL, TEAM, VERSION } from '../platform-info.js';

/**
 * 平台方案页 —— 对外展示用
 *
 * 只讲平台「是什么、怎么工作、能带来什么」，
 * 不暴露部署脚本、服务器配置等运维细节。
 */

const CAPABILITY = [
  {
    key: 'ingest',
    title: '实时数据接入',
    tag: '数据传输',
    color: 'var(--accent)',
    points: [
      '设备端以 5–10 Hz 推送遥测帧，云端逐帧 ACK 并回传服务器时间戳，设备据此计算往返时延。',
      '弱网环境缓存帧、恢复后按序批量补传，云端据自增序号补齐空洞并统计丢包率。',
      '多机队规模下可平滑切换到 MQTT 发布/订阅模型。',
    ],
    metric: [
      ['平均端到端时延', '49 – 53 ms'],
      ['P95 时延', '75 – 78 ms'],
      ['丢包率', '0.00 %'],
    ],
  },
  {
    key: 'linkage',
    title: '空地协同决策',
    tag: '三者联动',
    color: 'var(--accent-2)',
    points: [
      '空中发现疑似病斑后，云端按「置信度 / 病位 / 病种」三条可解释判据决定是否需要近地复核。',
      '地面机器人驶向目标网格，补拍叶下、根茎部与土壤等空中天然不可见的部位。',
      '云端融合空地两侧证据完成确诊，直接生成带速度-喷洒参数的靶向喷洒任务。',
    ],
    metric: [
      ['闭环链路', '5 步'],
      ['时延分解', '感知/下发/执行'],
      ['闭环率', '实时统计'],
    ],
  },
  {
    key: 'analytics',
    title: '六维统计与农户结论',
    tag: '数据价值',
    color: 'var(--danger)',
    points: [
      '空间、时间、病害、平台、作业、环境六个维度并行统计，每个维度都定位到具体网格与任务。',
      '每一维不止给图表，同时输出「农户下一步该做什么」的可执行结论。',
      '最终收敛成一张行动清单：先喷哪里、喷什么药、什么时候喷、这次省了多少。',
    ],
    metric: [
      ['统计维度', '6 个'],
      ['覆盖网格', '5 m × 5 m'],
      ['农户结论', '逐条可执行'],
    ],
  },
  {
    key: 'planner',
    title: '自主路径规划',
    tag: '核心创新',
    color: 'var(--warn)',
    points: [
      '航向 × 速度 × 喷幅三维联合搜索 160 组可行解，按经济、快速、环保三目标加权打分，权重可实时调整。',
      '喷洒流量与飞行速度的比例由平台自动求解并锁定，给出不漏喷、不超喷的可行速度区间。',
      '与人工在地面站手画航线逐项对比，效率提升可量化、可复核。',
    ],
    metric: [
      ['搜索空间', '160 组解'],
      ['药量对比', '仅 2.3 %'],
      ['时长提升', '−64.5 %'],
    ],
  },
];

const DEVICE_PROTO = `// WebSocket 遥测（每 100~200ms 一帧）
const ws = new WebSocket('wss://<平台地址>/ws/telemetry');
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'telemetry',
    payload: {
      frameId: 'F-1', ts: Date.now(), seq: 1,
      deviceId: 'UAV-01', kind: 'uav', state: 'surveying',
      pos: { x: 12.4, y: 33.1, z: 2.0, alt: 2.0, spd: 6.0, hdg: 90 },
      batt: 91, coverage: 0.12,
      payload: { waterL: 5, flowLmin: 1.44, swathM: 1.0 },
    }
  }));
};

// 识别结果（可与遥测同帧或单独发送）
ws.send(JSON.stringify({
  type: 'detection',
  payload: {
    detId: 'D-1', ts: Date.now(), deviceId: 'UAV-01', kind: 'uav',
    part: 'stem',            // canopy|leaf|underside|stem|soil
    disease: 'root_rot',     // rust|powdery|loose_smut|root_rot|fusarium|leaf_blight
    confidence: 0.62,        // <0.75 将自动触发机器人复核
    bbox: { x: 210, y: 130, w: 62, h: 58 },
    geo: { x: 41.2, y: 63.5 },
    grid: { row: 12, col: 8 },
    model: 'SAN-GAT-RL',
  }
}));

// 弱网批量补传
await fetch('<平台地址>/api/ingest/batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ telemetry: [...], detections: [...] }),
});`;

const API_ROWS = [
  ['GET', '/api/meta', '地块、病种字典、分析维度、规划目标定义'],
  ['GET', '/api/devices', '设备列表与实时状态'],
  ['GET', '/api/devices/telemetry', '遥测历史（可按设备过滤）'],
  ['GET', '/api/link/metrics', '链路质量：时延、丢包率、RTT'],
  ['GET', '/api/detections', '识别结果'],
  ['GET', '/api/missions', '作业任务'],
  ['GET', '/api/linkage/events', '联动事件与统计'],
  ['GET', '/api/analytics/overview', '总览 KPI'],
  ['GET', '/api/analytics/{dim}', '六维分析：spatial/temporal/disease/platform/task/environment'],
  ['GET', '/api/briefing', '农户简报'],
  ['GET', '/api/weather', '气象实况 + 施药窗口判定 + 三日预报'],
  ['GET', '/api/strategies', '施药策略库 / 农事历 / 窗口判据'],
  ['GET', '/api/strategies/{disease}', '按病种取策略'],
  ['GET', '/api/plan', '自动规划结果（可带 weights=经济,快速,环保）'],
  ['POST', '/api/plan/ratio', '速度-喷洒比例求解'],
  ['POST', '/api/plan/simulate', '人工航线基线模拟'],
  ['POST', '/api/missions', '创建作业任务'],
  ['POST', '/api/missions/{id}/status', '更新任务状态'],
  ['POST', '/api/ingest/batch', '批量补传'],
  ['WS', '/ws/telemetry', '设备遥测接入'],
  ['WS', '/ws/live', '前端实时订阅'],
  /* ---- 平台底座：多租户 / 设备接入 / 计量结算 ---- */
  ['GET', '/api/tenancy/identity', '当前身份、角色与可见地块'],
  ['POST', '/api/tenancy/login', '按 userId 换取身份令牌'],
  ['GET', '/api/tenancy/tenants', '租户列表'],
  ['POST', '/api/tenancy/tenants', '创建租户（仅平台运营方）'],
  ['GET', '/api/tenancy/members', '成员与角色'],
  ['POST', '/api/tenancy/members', '邀请成员 / 分配角色'],
  ['GET', '/api/fields', '地块列表（按身份过滤可见范围）'],
  ['POST', '/api/fields', '登记地块（自动归属所属租户）'],
  ['GET', '/api/access/devices', '接入设备与健康度评分'],
  ['POST', '/api/access/devices/register', '注册设备并签发 API Key'],
  ['POST', '/api/access/devices/{id}/revoke', '吊销设备密钥'],
  ['POST', '/api/access/self-register', '第三方设备自助接入'],
  ['POST', '/api/access/heartbeat', '设备心跳'],
  ['GET', '/api/access/commands', '指令下发记录'],
  ['POST', '/api/access/commands', '向设备下发作业单'],
  ['POST', '/api/access/commands/{id}/ack', '指令回执'],
  ['GET', '/api/metering/price', '价目表与计量单位'],
  ['GET', '/api/metering/usage', '用量记录'],
  ['POST', '/api/metering/usage', '上报用量'],
  ['GET', '/api/metering/invoices', '按账期的租户账单'],
  ['GET', '/api/metering/metrics', '平台经营指标'],
  ['GET', '/api/platform/services', '平台服务能力说明'],
];

export default function Planning() {
  const [baseline, setBaseline] = useState(null);

  useEffect(() => {
    let alive = true;
    api.baseline()
      .then(b => { if (alive) setBaseline(b); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  return (
    <>
      <div className="page-head">
        <h2>平台方案 · 能力总览</h2>
        <p>按能力模块说明平台解决的问题；设备接入协议与接口清单见本页下方。</p>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h3>
          平台信息
          <span className="tag">{VERSION}</span>
        </h3>
        <div className="grid g2" style={{ gap: 10 }}>
          <div style={{ padding: '12px', background: 'var(--panel-2)', border: '1px solid var(--accent)' }}>
            <div className="small" style={{ fontWeight: 700, marginBottom: 8, color: 'var(--accent)' }}>平台名称</div>
            <div className="xs dim" style={{ lineHeight: 1.8 }}>
              <div style={{ fontWeight: 700 }}>{BRAND}</div>
              <div>{BRAND_FULL}</div>
              <div style={{ marginTop: 6 }}>建设单位：{TEAM}</div>
            </div>
          </div>
          <div style={{ padding: '12px', background: 'var(--panel-2)', border: '1px solid var(--accent-2)' }}>
            <div className="small" style={{ fontWeight: 700, marginBottom: 8, color: 'var(--accent-2)' }}>官方网站</div>
            <div className="xs dim" style={{ lineHeight: 1.8 }}>
              <a className="mono" href={OFFICIAL_URL} target="_blank" rel="noreferrer noopener"
                style={{ wordBreak: 'break-all' }}>{OFFICIAL_URL}</a>
              <div style={{ marginTop: 6 }}>公网直接访问，功能与本地演示完全一致（同一套计算内核）。</div>
            </div>
          </div>
        </div>
      </div>

      {baseline && (
        <div className="card" style={{ marginBottom: 12 }}>
          <h3>
            申报书实测基准场景
            <span className="tag">30亩示范田 · 可现场复现</span>
          </h3>
          <p className="xs dim" style={{ marginBottom: 10, lineHeight: 1.7 }}>
            实时演示跑的是内置模拟器，识别结果随时间波动；申报材料引用的数字必须能被当场复现。
            因此平台把「{baseline.field.mu}亩示范田（{baseline.field.areaHa} ha，{baseline.field.gridSizeM} m×{baseline.field.gridSizeM} m 网格，{baseline.field.zones} 个管理分区）」
            的实测基准场景固化为确定性数据 —— 下面每一个数字都由与在线演示完全相同的规划算法算出，
            材料里的数字与现场看到的数字因此必然一致。
          </p>
          <div className="grid g3" style={{ gap: 10 }}>
            {[
              ['全田覆盖', [
                ['航程', `${baseline.full.lengthM} m`],
                ['耗时', `${baseline.full.minutes} min`],
                ['药耗', `${baseline.full.volumeL} L`],
                ['耗电', `${baseline.full.batteryPct} %`],
              ], 'var(--accent)'],
              ['靶向点喷', [
                ['病灶格', `${baseline.target.targetCells} 个`],
                ['耗时', `${baseline.target.minutes} min`],
                ['药耗', `${baseline.target.volumeL} L`],
                ['覆盖率 / 溢出', `${baseline.target.coverage} / ${baseline.target.spillAreaHa} 亩`],
              ], 'var(--accent-2)'],
              ['节药与提效', [
                ['药液节约率', `${baseline.saving.savedRatio} %`],
                ['相对人工耗时', `−${baseline.vsManual.minutes} %`],
                ['相对人工航程', `−${baseline.vsManual.lengthM} %`],
                ['相对人工转弯', `−${baseline.vsManual.turningShare} %`],
              ], 'var(--danger)'],
            ].map(([title, rows, color]) => (
              <div key={title} style={{ padding: '12px', background: 'var(--panel-2)', border: `1px solid ${color}` }}>
                <div className="small" style={{ fontWeight: 700, marginBottom: 8, color }}>{title}</div>
                {rows.map(([l, v]) => (
                  <div key={l} className="row" style={{ marginBottom: 4 }}>
                    <span className="xs mute">{l}</span>
                    <span className="spacer" />
                    <span className="mono" style={{ fontSize: 15, fontWeight: 700, color }}>{v}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="grid g3" style={{ gap: 10, marginTop: 10 }}>
            {[
              ['流量÷速度', `${baseline.ratio.flowPerSpeed} L/(m·min)`],
              ['可行速度区间', `${baseline.ratio.speedRange.min} – ${baseline.ratio.speedRange.max} m/s`],
              ['寻优空间', `${baseline.search.headings}×${baseline.search.speeds}×${baseline.search.swaths} = ${baseline.search.combinations} 组`],
              ['目标权重', `经济 ${baseline.search.weights.economy} / 快速 ${baseline.search.weights.speed} / 环保 ${baseline.search.weights.eco}`],
              ['重喷率', `${(baseline.vsManual.overlapManual * 100).toFixed(1)}% → ${(baseline.vsManual.overlapAuto * 100).toFixed(1)}%`],
              ['靶向作业单', `${baseline.target.targetCells} 格 · ${baseline.target.clusters} 个病灶簇`],
              ['靶向覆盖率', `${baseline.target.coverage}（溢出 ${baseline.target.spillAreaHa} 亩）`],
            ].map(([l, v]) => (
              <div key={l} style={{ padding: '9px 10px', background: 'var(--panel-2)', border: '1px solid var(--line)' }}>
                <div className="xs mute">{l}</div>
                <div className="mono" style={{ fontSize: 14, fontWeight: 700, marginTop: 3 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid g2" style={{ marginBottom: 12 }}>
        {CAPABILITY.map(c => (
          <div className="card" key={c.key}>
            <div className="row" style={{ marginBottom: 8 }}>
              <b className="small" style={{ color: c.color, fontSize: 16 }}>{c.title}</b>
              <span className="spacer" />
              <span className="pill">{c.tag}</span>
            </div>
            <ul className="insights" style={{ marginBottom: 11 }}>
              {c.points.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
            <div className="grid g3" style={{ gap: 8 }}>
              {c.metric.map(([l, v]) => (
                <div key={l} style={{
                  padding: '8px 8px', background: 'var(--panel-2)',
                  border: `1px solid ${c.color}`,
                }}>
                  <div className="xs mute">{l}</div>
                  <div className="mono" style={{ fontSize: 17, fontWeight: 700, color: c.color }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h3>平台设计要点 <span className="tag">为什么这样设计</span></h3>
        <div className="grid g2">
          {[
            ['统一数据契约，三端不漂移',
              '遥测帧、识别结果、作业任务、联动事件四类数据由同一份契约定义，设备端、云端、前端共用。任何一端新增字段都先改契约，再改实现，从源头消除字段漂移。'],
            ['算法下沉，前后端跑同一套',
              '路径规划、六维统计、联动判据全部抽为与运行环境无关的纯计算模块。真实部署时它们运行在服务端并持久化到数据库；纯浏览时它们运行在浏览器内。两种情况下页面显示的每一个数字口径完全一致，结论可当场复核。'],
            ['实时性做成可证伪的指标',
              '不宣称「实时」，而是把端到端时延、P95、丢包率、往返时延四项指标常驻展示，并按感知、决策下发、执行到位三段归因——慢在哪一段一目了然。'],
            ['规划结果要能下发而不只是好看',
              '每个候选解都带完整的航向、速度、喷幅、流量、占空比、预计时长与药量，可直接作为作业参数下发，而不是只给一张漂亮航线图。'],
          ].map(([t, d]) => (
            <div key={t} style={{
              padding: '16px', background: 'var(--panel-2)',
              border: '1px solid var(--accent)',
            }}>
              <div className="small" style={{ fontWeight: 600, marginBottom: 4 }}>{t}</div>
              <div className="xs dim" style={{ lineHeight: 1.65 }}>{d}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 12 }}>
        <h3>
          自研硬件
          <span className="tag">团队实物</span>
          <span className="spacer" />
          <span className="xs mute">植保无人机 · 地面监测机器人 · 边缘计算载荷</span>
        </h3>
        <p className="hint">
          平台不是纯软件方案。空地两端设备均为团队自研，
          机载与地面载荷的字段口径与 shared/schema.js 的数据契约逐项对应。
        </p>
        <div className="photo-strip">
          {HARDWARE_PHOTOS.map(p => (
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

      <div className="grid g2">
        <div className="card">
          <h3>设备接入协议 <span className="tag">给飞手 / 机器人开发者</span></h3>
          <p className="hint">
            设备端只需要按下面格式连上来即可，无需了解平台内部实现。
          </p>
          <pre style={{
            background: 'var(--panel-2)', border: '1px solid var(--border)',
            padding: 16, overflow: 'auto', fontSize: 13, lineHeight: 1.7, margin: 0,
            color: 'var(--text)',
          }} className="mono">{DEVICE_PROTO}</pre>
        </div>

        <div className="card">
          <h3>接口清单 <span className="tag">{API_ROWS.length} 个</span></h3>
          <p className="hint">设备接入与前端订阅共用同一套数据契约，接口语义对设备开发者友好。</p>
          <div className="table-scroll" style={{ maxHeight: 460 }}>
            <table className="tbl">
              <thead><tr><th>方法</th><th>路径</th><th>说明</th></tr></thead>
              <tbody>
                {API_ROWS.map(([m, p, d]) => (
                  <tr key={p}>
                    <td><span className="pill xs" style={{
                      color: m === 'GET' ? CHART.blue : m === 'POST' ? CHART.amber : CHART.green,
                    }}>{m}</span></td>
                    <td className="mono xs">{p}</td>
                    <td className="xs dim">{d}</td>
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
