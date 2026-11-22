import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { CHART } from '../theme.js';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from 'recharts';

/**
 * 计量结算页 —— 平台商业化的落地页
 *
 * 低空经济赛道的评委会问："平台靠什么赚钱？"
 * 这里不空谈商业模式，而是给出三件可核验的东西：
 *   1. 价目表 —— 按什么口径收多少钱，写死在前端与后端同一份 shared/metering.js
 *   2. 用量记录 —— 每一次作业的亩数、药耗、时长、识别次数都落库
 *   3. 账单与平台经营指标 —— 收入、单亩收益、节药价值
 *
 * 平台的商业逻辑：农户按亩买服务，作业队按架次接单，平台按用量抽成。
 */

const UNIT_CN = {
  muSpray: '亩（施药）', muSurvey: '亩（巡查）', mu: '亩',
  sortie: '架次', detection: '次', minute: '分钟',
};

export default function Metering() {
  const [data, setData] = useState(null);
  const [price, setPrice] = useState(null);
  const [usage, setUsage] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [m, p, u] = await Promise.all([
        api.meteringMetrics(), api.priceTable(), api.usageList(),
      ]);
      if (!alive) return;
      setData(m); setPrice(p); setUsage(u?.usage || []);
    })();
    return () => { alive = false; };
  }, []);

  const m = data?.metrics || {};
  const invoices = data?.invoices || [];
  const monthly = m.monthly || [];
  const table = price?.table || {};
  const model = price?.model;

  const kpis = [
    { label: '平台服务收入', value: `¥${(m.revenue || 0).toLocaleString('zh-CN')}`, sub: '按用量结算累计', cls: 'green' },
    { label: '服务面积', value: `${m.areaMu || 0} 亩`, sub: `施药 ${m.sprayMu || 0} · 巡查 ${m.surveyMu || 0}`, cls: 'blue' },
    { label: '单亩综合收益', value: `¥${m.revenuePerMu || 0}`, sub: '平台收入 ÷ 服务亩数', cls: '' },
    { label: '节药价值', value: `¥${(m.drugSavedValue || 0).toLocaleString('zh-CN')}`, sub: `为农户省下 ${m.savedL || 0} L 药液`, cls: 'green' },
  ];

  return (
    <>
      <div className="page-head">
        <h2>计量与结算</h2>
        <p>
          平台不卖设备，靠调度能力与节药效果收费。按亩、按架次、按识别次数三种口径并行计量，
          用量、账单与节药价值全部来自平台实际作业记录，可逐单核对。
        </p>
      </div>

      {/* KPI */}
      <div className="grid g4" style={{ marginBottom: 16 }}>
        {kpis.map(k => (
          <div className="card" key={k.label}>
            <div className="kpi">
              <span className="label">{k.label}</span>
              <span className={`value ${k.cls}`}>{k.value}</span>
              <span className="sub">{k.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 价目表 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>
          服务价目表
          <span className="tag">前后端同源</span>
          <span className="spacer" />
          <span className="xs mute">施药面积与巡查面积分开计量，同一块地不会被重复计费</span>
        </h3>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ minWidth: 150 }}>服务项</th>
                <th>计量单位</th>
                <th>单价</th>
                <th>计价口径</th>
                <th>默认计费</th>
              </tr>
            </thead>
            <tbody>
              {Object.values(table).map(p => (
                <tr key={p.key}>
                  <td className="small">{p.name}</td>
                  <td><span className="pill">{UNIT_CN[p.unit] || p.unit}</span></td>
                  <td className="mono">¥{p.price}</td>
                  <td className="xs mute">{p.desc}</td>
                  <td>
                    {p.optional
                      ? <span className="pill warn">按需订阅</span>
                      : <span className="pill ok">默认包含</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 商业模式 */}
      {model && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>谁向平台付钱 <span className="tag">{model.tagline}</span></h3>
          <div className="grid g3">
            {model.lines.map(l => (
              <div key={l.who} className="card" style={{ boxShadow: 'none' }}>
                <div className="small" style={{ color: 'var(--accent)', marginBottom: 8 }}>{l.who}</div>
                <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.7, marginBottom: 8 }}>
                  {l.what}
                </div>
                <div className="xs mute" style={{ lineHeight: 1.75 }}>{l.why}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 月度经营趋势 */}
      {monthly.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h3>
            按账期的经营趋势
            <span className="tag">{monthly.length} 个账期</span>
            <span className="spacer" />
            <span className="xs mute">收入与服务面积逐月累计，平台经营是连续的而非一次性成交</span>
          </h3>
          <div style={{ height: 280 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="period" tick={{ fill: CHART.axis, fontSize: 12 }} />
                <YAxis yAxisId="l" tick={{ fill: CHART.axis, fontSize: 12 }}
                  tickFormatter={v => `¥${v}`} />
                <YAxis yAxisId="r" orientation="right" tick={{ fill: CHART.axis, fontSize: 12 }}
                  tickFormatter={v => `${v} 亩`} />
                <Tooltip
                  contentStyle={{
                    background: CHART.tooltipBg, border: `1px solid ${CHART.tooltipBorder}`,
                    fontSize: 13,
                  }}
                  formatter={(v, name) => (name === '服务面积（亩）' ? [`${v} 亩`, name] : [`¥${v}`, name])}
                />
                <Legend wrapperStyle={{ fontSize: 13 }} />
                <Bar yAxisId="l" dataKey="revenue" name="平台收入（元）" fill={CHART.green} radius={[2, 2, 0, 0]} />
                <Bar yAxisId="r" dataKey="areaMu" name="服务面积（亩）" fill={CHART.blue} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 账单 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3>租户账单 <span className="tag">{invoices.length} 份</span></h3>
        {invoices.length === 0 && <div className="empty">尚无已完成的作业单</div>}
        {invoices.length > 0 && (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ minWidth: 140 }}>租户</th>
                  <th>账期</th>
                  <th>施药面积</th>
                  <th>巡查面积</th>
                  <th>架次</th>
                  <th>识别次数</th>
                  <th>药耗</th>
                  <th>节药</th>
                  <th>应付金额</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map(inv => (
                  <tr key={inv.invoiceId}>
                    <td className="small">{inv.tenantName}</td>
                    <td className="mono xs">{inv.period}</td>
                    <td className="mono xs">{inv.usage.sprayMu || 0} 亩</td>
                    <td className="mono xs">{inv.usage.surveyMu || 0} 亩</td>
                    <td className="mono xs">{inv.usage.sorties || 0}</td>
                    <td className="mono xs">{inv.usage.detections || 0}</td>
                    <td className="mono xs">{inv.usage.volumeL || 0} L</td>
                    <td className="mono xs green">{inv.usage.savedL || 0} L</td>
                    <td className="mono" style={{ fontWeight: 700 }}>¥{inv.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 用量明细 */}
      <div className="card">
        <h3>用量明细 <span className="tag">最近 {usage.length} 条</span></h3>
        {usage.length === 0 && <div className="empty">尚无用量记录</div>}
        {usage.length > 0 && (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ minWidth: 140 }}>时间</th><th>租户</th><th>类型</th>
                  <th>作业单</th><th>面积</th><th>药耗</th><th>时长</th>
                  <th>架次</th><th>识别</th><th>节药</th><th>金额</th>
                </tr>
              </thead>
              <tbody>
                {usage.map((u, i) => (
                  <tr key={u.missionId ? `${u.missionId}-${i}` : i}>
                    <td className="mono xs">{new Date(u.ts).toLocaleString('zh-CN', { hour12: false })}</td>
                    <td className="xs mono">{u.tenantId}</td>
                    <td><span className={`pill ${u.type === 'survey' ? 'robot' : 'uav'}`}>
                      {u.type === 'survey' ? '巡查' : u.type === 'spray' ? '施药' : u.type}
                    </span></td>
                    <td className="xs mono">{u.missionId || '—'}</td>
                    <td className="mono xs">{u.areaMu || 0} 亩</td>
                    <td className="mono xs">{u.volumeL != null ? `${u.volumeL} L` : '—'}</td>
                    <td className="mono xs">{u.minutes != null ? `${u.minutes} min` : '—'}</td>
                    <td className="mono xs">{u.sorties || 0}</td>
                    <td className="mono xs">{u.detections || 0}</td>
                    <td className="mono xs green">{u.savedL != null ? `${u.savedL} L` : '—'}</td>
                    <td className="mono" style={{ fontWeight: 700 }}>¥{u.amount || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
