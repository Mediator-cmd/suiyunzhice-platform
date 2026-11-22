import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

/**
 * 设备接入页 —— 平台「开放能力」的对外说明
 *
 * 回答评委必然要问的第二句：
 *   "你这个平台只能接自己的无人机吗？别人的设备怎么进来？"
 *
 * 页面给出完整答案：注册 → 签发密钥 → 凭密钥上送 → 健康度评分 → 指令闭环 → 可吊销。
 * 注册与吊销是真实可点的（走后端接口），不是静态图。
 */

const STATE_CLS = {
  '已激活': 'ok',
  '待审核': 'warn',
  '已停用': 'warn',
  '已吊销': 'danger',
};

const LEVEL_CLS = {
  excellent: 'ok', good: 'ok', fair: 'warn', poor: 'danger',
};

const CMD_CLS = {
  '已下发': 'warn', '设备已接收': 'ok', '执行中': 'ok',
  '已完成': 'ok', '执行失败': 'danger', '回执超时': 'danger',
};

const FLOW = [
  { step: '① 注册', desc: '第三方设备提交 deviceId / 名称 / 类型，平台审核并签发 API Key（仅显示一次）' },
  { step: '② 接入', desc: '设备带上 X-Device-Key 上送遥测与识别结果，云端逐帧 ACK 回传时间戳' },
  { step: '③ 计量', desc: '作业按亩 / 架次 / 识别次数计量，用量与节药量同步落库' },
  { step: '④ 调度', desc: '云端向设备下发作业单，设备回执推进指令状态机，全程可追溯' },
  { step: '⑤ 审计', desc: '平台给每个接入方打接入健康分，密钥可随时吊销，权限即时失效' },
];

export default function Access() {
  const [data, setData] = useState(null);
  const [cmds, setCmds] = useState([]);
  const [form, setForm] = useState({ deviceId: '', name: '', kind: 'uav', model: '' });
  const [issued, setIssued] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [d, c] = await Promise.all([api.accessDevices(), api.commands()]);
    setData(d);
    setCmds(c?.commands || []);
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      const [d, c] = await Promise.all([api.accessDevices(), api.commands()]);
      if (!alive) return;
      setData(d); setCmds(c?.commands || []);
    })();
    return () => { alive = false; };
  }, []);

  const doRegister = async (e) => {
    e.preventDefault();
    setErr(null); setIssued(null);
    if (!form.deviceId || !form.name) {
      setErr('设备 ID 与名称必填');
      return;
    }
    setBusy(true);
    try {
      const res = await api.registerAccessDevice?.(form);
      if (res?.ok) {
        setIssued(res);
        setForm({ deviceId: '', name: '', kind: 'uav', model: '' });
        await load();
      } else if (res?.error) {
        setErr(res.error);
      } else {
        // 没有后端时走本地引擎
        const { getLocalEngine } = await import('../api.js');
        const r = getLocalEngine().registerAccessDevice(form);
        if (r.ok) { setIssued(r); setForm({ deviceId: '', name: '', kind: 'uav', model: '' }); await load(); }
        else setErr(r.error);
      }
    } catch (ex) {
      setErr(ex.message || '注册失败');
    } finally {
      setBusy(false);
    }
  };

  const doRevoke = async (deviceId, restore) => {
    try {
      const res = await api.revokeDevice?.(deviceId, restore);
      if (!res) {
        const { getLocalEngine } = await import('../api.js');
        getLocalEngine().revokeDevice(deviceId, restore);
      }
      await load();
    } catch { /* ignore */ }
  };

  const devices = data?.devices || [];
  const levels = data?.levels || {};
  const states = data?.states || {};

  return (
    <>
      <div className="page-head">
        <h2>设备接入</h2>
        <p>
          平台不绑定任何一家硬件厂商。任何符合遥测帧契约的植保无人机与地面机器人，
          凭密钥即可接入，直接进入平台调度与结算链路。
        </p>
      </div>

      {/* 接入流程 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>接入五步 <span className="tag">每一步都有平台侧记录</span></h3>
        <div className="grid g5">
          {FLOW.map(f => (
            <div key={f.step} className="card" style={{ boxShadow: 'none', padding: 14 }}>
              <div className="small" style={{ color: 'var(--accent)', marginBottom: 6 }}>{f.step}</div>
              <div className="xs mute" style={{ lineHeight: 1.75 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 接入流程图 + 协议 */}
      <div className="grid g-2-1" style={{ marginBottom: 16, alignItems: 'stretch' }}>
        <div className="card">
          <h3>接入协议 <span className="tag">给飞手 / 机器人开发者</span></h3>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr><th style={{ minWidth: 110 }}>通道</th><th style={{ minWidth: 200 }}>路径</th><th>用途</th></tr>
              </thead>
              <tbody>
                <tr><td className="mono">WS 主通道</td><td className="mono">/ws/telemetry</td><td>5–10 Hz 遥测与识别结果同帧上送，逐帧 ACK</td></tr>
                <tr><td className="mono">HTTP 补传</td><td className="mono">/api/ingest/batch</td><td>弱网盲区缓存帧恢复后按 seq 幂等补传</td></tr>
                <tr><td className="mono">心跳</td><td className="mono">/api/access/heartbeat</td><td>维持在线状态，超时自动判离线</td></tr>
                <tr><td className="mono">指令</td><td className="mono">/api/access/commands</td><td>云端下发作业单，设备回执闭环</td></tr>
                <tr><td className="mono">MQTT 扩展</td><td className="mono">mqtt://host:8083</td><td>多机队规模下的发布/订阅模型</td></tr>
              </tbody>
            </table>
          </div>
          <div className="hint" style={{ marginTop: 12 }}>
            所有通道共用 <span className="mono">shared/schema.js</span> 的同一份数据契约 ——
            设备端与云端对「一个遥测帧长什么样」的理解不会分叉。
          </div>
        </div>

        <div className="card">
          <h3>接入鉴权</h3>
          <div className="hint">遥测上送必须携带设备密钥，云端逐帧校验：</div>
          <pre style={{
            background: 'var(--panel-2)', padding: 14, fontSize: 12.5,
            lineHeight: 1.8, overflow: 'auto', border: '1px solid var(--border)',
            fontFamily: 'var(--mono)',
          }}>{`POST /api/ingest/batch
X-Device-Id: UAV-EXT-01
X-Device-Key: sk_UAV-EXT-01_xxxxxxxx
Content-Type: application/json

{ "telemetry": [...], "detections": [...] }

→ 401 设备密钥校验失败
→ 401 设备密钥已吊销`}</pre>
          <div className="hint" style={{ marginTop: 12 }}>
            密钥只在签发时返回一次，服务端只保存盐值 —— 拿到密钥的第三方才知道数据往哪传。
          </div>
        </div>
      </div>

      {/* 设备列表 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>
          已接入设备
          <span className="tag">{devices.length} 台</span>
          <span className="spacer" />
          <span className="xs mute">接入健康分由平台按丢包率、时延与指令闭环率自动评估</span>
        </h3>
        {devices.length === 0 && <div className="empty">尚无设备登记 —— 可在下方自助注册</div>}
        {devices.length > 0 && (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ minWidth: 130 }}>设备</th>
                  <th>类型</th>
                  <th>型号</th>
                  <th>接入状态</th>
                  <th>在线</th>
                  <th>丢包率</th>
                  <th>P95 时延</th>
                  <th>指令闭环</th>
                  <th>健康分</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {devices.map(d => {
                  const h = d.health || {};
                  return (
                    <tr key={d.deviceId}>
                      <td>
                        <div className="small">{d.name}</div>
                        <div className="xs mute mono">{d.deviceId}</div>
                      </td>
                      <td><span className={`pill ${d.kind === 'uav' ? 'uav' : 'robot'}`}>
                        {d.kind === 'uav' ? '无人机' : '地面机器人'}
                      </span></td>
                      <td className="xs mono">{d.model || '—'}</td>
                      <td><span className={`pill ${STATE_CLS[d.accessState] || ''}`}>{d.accessState}</span></td>
                      <td>{h.online
                        ? <span className="pill ok">在线</span>
                        : <span className="pill">离线</span>}</td>
                      <td className="mono xs">{((h.lossRate || 0) * 100).toFixed(2)} %</td>
                      <td className="mono xs">{h.p95LatencyMs != null ? `${h.p95LatencyMs} ms` : '—'}</td>
                      <td className="mono xs">{h.commandsDone || 0} / {h.commandsTotal || 0}</td>
                      <td>
                        <span className={`pill ${LEVEL_CLS[h.level] || ''}`}>
                          {h.score ?? '—'} · {levels[h.level]?.name || '—'}
                        </span>
                      </td>
                      <td>
                        {d.accessState === '已吊销' ? (
                          <button className="btn xs" onClick={() => doRevoke(d.deviceId, true)}>恢复</button>
                        ) : (
                          <button className="btn xs" onClick={() => doRevoke(d.deviceId, false)}>吊销</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 注册表单 */}
      <div className="grid g2">
        <div className="card">
          <h3>自助接入注册 <span className="tag">第三方设备入口</span></h3>
          <form onSubmit={doRegister} className="stack" style={{ gap: 10 }}>
            <div className="row wrap">
              <input className="inp" placeholder="设备 ID，如 UAV-EXT-01"
                value={form.deviceId}
                onChange={e => setForm({ ...form, deviceId: e.target.value })} />
              <input className="inp" placeholder="设备名称"
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="row wrap">
              <select className="inp" value={form.kind}
                onChange={e => setForm({ ...form, kind: e.target.value })}>
                <option value="uav">植保无人机</option>
                <option value="robot">地面监测机器人</option>
              </select>
              <input className="inp" placeholder="型号（可选）"
                value={form.model}
                onChange={e => setForm({ ...form, model: e.target.value })} />
              <button className="btn primary" type="submit" disabled={busy}>
                {busy ? '注册中…' : '注册并签发密钥'}
              </button>
            </div>
            {err && <div className="small" style={{ color: 'var(--danger)' }}>{err}</div>}
          </form>
          <div className="hint" style={{ marginTop: 14 }}>
            注册后设备凭 API Key 接入；平台可随时吊销该密钥，吊销后设备立刻失去接入权限。
          </div>
        </div>

        <div className="card">
          <h3>签发结果 <span className="tag">密钥仅显示一次</span></h3>
          {!issued && <div className="empty">完成一次注册后，密钥显示在这里</div>}
          {issued && (
            <>
              <div className="row-line">
                <div>
                  <div className="small">{issued.device?.name}</div>
                  <div className="xs mute mono">{issued.device?.deviceId}</div>
                </div>
                <span className="pill ok">{issued.device?.accessState}</span>
              </div>
              <div className="hint" style={{ marginTop: 10 }}>API Key</div>
              <pre style={{
                background: 'var(--panel-2)', padding: 12, fontSize: 12.5,
                border: '1px solid var(--border)', fontFamily: 'var(--mono)',
                overflow: 'auto', color: 'var(--accent)',
              }}>{issued.apiKey}</pre>
              <div className="xs mute">{issued.notice}</div>
            </>
          )}
        </div>
      </div>

      {/* 指令 */}
      {cmds.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>指令下发记录 <span className="tag">{cmds.length} 条</span></h3>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ minWidth: 170 }}>指令 ID</th><th>设备</th><th>类型</th>
                  <th>作业单</th><th>状态</th><th>下发→接收</th><th>总耗时</th>
                </tr>
              </thead>
              <tbody>
                {cmds.map(c => (
                  <tr key={c.commandId}>
                    <td className="mono xs">{c.commandId}</td>
                    <td className="xs mono">{c.deviceId}</td>
                    <td className="xs">{c.type}</td>
                    <td className="xs mono">{c.missionId || '—'}</td>
                    <td><span className={`pill ${CMD_CLS[c.state] || ''}`}>{c.state}</span></td>
                    <td className="mono xs">
                      {c.ackedAt && c.issuedAt ? `${c.ackedAt - c.issuedAt} ms` : '—'}
                    </td>
                    <td className="mono xs">
                      {c.doneAt && c.issuedAt ? `${c.doneAt - c.issuedAt} ms` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
