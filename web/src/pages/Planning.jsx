import React, { useState } from 'react';

const OPTIONS = [
  {
    id: 'gh-pages',
    name: 'GitHub Pages（推荐 · 最快拿到公网链接）',
    badge: '免费 · 免登录 · 永久',
    cost: '0 元',
    time: '约 10 分钟',
    live: 'https://Mediator-cmd.github.io/maitian-platform/',
    detail: [
      '前端是纯静态站，平台内核直接跑在浏览器里，因此即使后端未部署，全部 8 个页面（含路径规划与速度-喷洒比例求解）依然完整可用。',
      '已部署并验证：https://Mediator-cmd.github.io/maitian-platform/ —— 任何人可访问，无需登录、无需备案。',
      '后续部署真实后端时，只需把 API/WS 地址指向服务器，前端无需改动逻辑（VITE_API_BASE / VITE_WS_BASE）。',
    ],
    steps: [
      '推送 main 分支，.github/workflows/pages.yml 自动构建并发布',
      '仓库 Settings → Pages → Source 选择 workflow',
      '访问 https://Mediator-cmd.github.io/maitian-platform/',
    ],
    limits: ['演示态数据来自浏览器模拟器，非真实设备', '刷新页面数据重置'],
    recommended: true,
  },
  {
    id: 'vps',
    name: '云服务器 + Docker（完整形态）',
    badge: '真实数据 · 全功能',
    cost: '约 60–120 元/月（2核2G 轻量实例）',
    time: '约 2 小时',
    detail: [
      '一条 docker compose 同时起 API 服务与前端（Nginx），SQLite 数据落在宿主机卷上。',
      'Nginx 反代 /api 与 /ws/ws，WebSocket 需配置 Upgrade 头，否则实时推送会失效。',
      '用 Caddy 或 Nginx + Let\'s Encrypt 绑定域名，签发免费 HTTPS 证书。',
      '可通过 FRP / Cloudflare Tunnel 把内网开发机临时映射到公网，无需备案即可演示。',
    ],
    steps: [
      '服务器安装 Docker，拉取仓库',
      'docker compose up -d',
      'Cloudflare Tunnel 或 FRP 建立公网入口',
    ],
    limits: ['需服务器环境', '需自行备案才能用自有域名直接对外（用 Tunnel 可免备案）'],
    recommended: false,
  },
  {
    id: 'tunnel',
    name: 'Cloudflare Tunnel（临时演示 · 免备案）',
    badge: '最快公网入口',
    cost: '0 元',
    time: '约 5 分钟',
    detail: [
      '在本机运行 cloudflared，把 http://localhost:8080 映射到 trycloudflare.com 随机域名，',
      '无需公网 IP、无需备案、无需域名，对方打开链接即可访问你的平台。',
      '适合答辩现场临时演示，或作为后端长期部署前的过渡方案。',
    ],
    steps: [
      'cloudflared tunnel --url http://localhost:8080',
      '复制输出的 trycloudflare.com 链接',
      '把该地址的 /api 与 /ws 配到前端环境变量',
    ],
    limits: ['临时域名，随进程结束失效', '仅适合演示，不适合长期运行'],
    recommended: false,
  },
];

export default function Planning() {
  const [active, setActive] = useState('gh-pages');

  return (
    <>
      <div className="page-head">
        <h2>方案与部署 · 公网可访问链接</h2>
        <p>
          目标是拿到一个「所有人都能打开」的网址。本页给出三套方案，按「拿到链接的速度」与「数据真实性」两个维度取不同平衡点。
          推荐路径是：先用 GitHub Pages 拿到可提交、可演示的公网地址，再用 Docker + Tunnel 承接真实设备数据。
        </p>
      </div>

      <div className="card" style={{
        marginBottom: 12,
        borderColor: 'rgba(74,222,128,.45)',
        background: 'linear-gradient(90deg,rgba(74,222,128,.10),rgba(74,222,128,.02))',
      }}>
        <div className="row wrap" style={{ gap: 10 }}>
          <span className="pill ok">已上线</span>
          <b className="small">公网访问地址</b>
          <a className="mono blue" href="https://Mediator-cmd.github.io/maitian-platform/"
            target="_blank" rel="noreferrer"
            style={{ fontSize: 15, wordBreak: 'break-all' }}>
            https://Mediator-cmd.github.io/maitian-platform/
          </a>
          <span className="spacer" />
          <span className="xs mute">任何人可访问 · 无需登录 · 免备案 · 永久有效</span>
        </div>
        <div className="xs dim" style={{ marginTop: 7 }}>
          该地址由 GitHub Pages 承载，平台内核（路径规划、速度-喷洒比例求解、六维统计、空地联动）
          直接运行在浏览器中，因此无后端时功能依然完整；接入真实设备后改为实时接入模式。
        </div>
      </div>

      <div className="grid g3" style={{ marginBottom: 12 }}>
        {OPTIONS.map(o => (
          <div key={o.id} className="card"
            style={{ cursor: 'pointer', borderColor: active === o.id ? 'var(--accent-2)' : undefined }}>
            <div onClick={() => setActive(o.id)}>
              <div className="row" style={{ marginBottom: 6 }}>
                <b className="small">{o.name}</b>
                {o.recommended && <span className="pill ok">推荐</span>}
              </div>
              <div className="row wrap" style={{ gap: 6, marginBottom: 8 }}>
                <span className="pill">{o.badge}</span>
                <span className="pill">{o.cost}</span>
                <span className="pill">{o.time}</span>
              </div>
              <div className="xs dim">{o.detail[0]}</div>
            </div>
          </div>
        ))}
      </div>

      {OPTIONS.filter(o => o.id === active).map(o => (
        <div className="card" key={o.id}>
          <h3>{o.name}</h3>
          <div className="grid g-2-1">
            <div>
              <p className="hint">方案说明</p>
              <ul className="insights" style={{ marginBottom: 12 }}>
                {o.detail.map((d, i) => <li key={i}>{d}</li>)}
              </ul>
              <p className="hint">落地步骤</p>
              <div className="stack" style={{ gap: 6 }}>
                {o.steps.map((s, i) => (
                  <div key={i} className="row" style={{ gap: 9 }}>
                    <span style={{
                      width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                      background: 'var(--accent)', color: '#0d1218', fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
                    }}>{i + 1}</span>
                    <span className="small mono">{s}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <p className="hint">已知限制</p>
              {o.limits.map((l, i) => (
                <div key={i} className="xs amber" style={{ marginBottom: 5 }}>· {l}</div>
              ))}
              <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--panel-2)', borderRadius: 7 }}>
                <div className="xs dim">本平台当前状态</div>
                <div className="small" style={{ marginTop: 4 }}>
                  部署脚本、Docker 编排与 GitHub Pages 自动发布流水线均已在仓库中就绪，
                  执行 <code className="mono">bash deploy/deploy.sh</code> 或推送 <code className="mono">web/dist</code> 即可。
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}

      <div className="grid g2" style={{ marginTop: 12 }}>
        <div className="card">
          <h3>设备接入协议 <span className="tag">给飞手 / 机器人开发者</span></h3>
          <p className="hint">
            设备端只需要按下面格式连上来即可，无需了解平台内部实现。
          </p>
          <pre style={{
            background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6,
            padding: 12, overflow: 'auto', fontSize: 11.5, lineHeight: 1.6, margin: 0,
          }} className="mono">{`// WebSocket 遥测（每 100~200ms 一帧）
const ws = new WebSocket('wss://<你的域名>/ws/telemetry');
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
await fetch('https://<你的域名>/api/ingest/batch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ telemetry: [...], detections: [...] }),
});`}</pre>
        </div>

        <div className="card">
          <h3>API 速查</h3>
          <div className="table-scroll" style={{ maxHeight: 460 }}>
            <table className="tbl">
              <thead><tr><th>方法</th><th>路径</th><th>说明</th></tr></thead>
              <tbody>
                {[
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
                  ['GET', '/api/plan', '自动规划结果（可带 weights=经济,快速,环保）'],
                  ['POST', '/api/plan/ratio', '速度-喷洒比例求解'],
                  ['POST', '/api/plan/simulate', '人工航线基线模拟'],
                  ['POST', '/api/missions', '创建作业任务'],
                  ['POST', '/api/missions/{id}/status', '更新任务状态'],
                  ['POST', '/api/ingest/batch', '批量补传'],
                  ['WS', '/ws/telemetry', '设备遥测接入'],
                  ['WS', '/ws/live', '前端实时订阅'],
                ].map(([m, p, d]) => (
                  <tr key={p}>
                    <td><span className="pill xs" style={{
                      color: m === 'GET' ? 'var(--accent-2)' : m === 'POST' ? 'var(--warn)' : 'var(--robot)',
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
