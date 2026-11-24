import React, { useEffect, useMemo, useState } from 'react';
import { api, subscribe } from '../api.js';
import { FieldMap } from '../components/FieldMap.jsx';

/**
 * 作业调度
 *
 * 「确定作业范围 → 选作业方式 → 预览航线 → 下发执行」四步闭环。
 *
 * 这一页的每一处数字都来自 shared/fleet.js 的同一个规划器：
 *   预览时算出来的航线长度、预计时长、预计药液量，
 *   与设备真正飞完之后的计量记录，逐米逐升对得上。
 * 这一点在页面上有明确标注 —— 现场点一次指令，
 * 就能看到「预览 0.57 L」和「实耗 0.57 L」是同一个数。
 *
 * 范围框选：在地图上按住拖出矩形。框选结果会作为作业范围参与规划，
 * 靶向点喷只喷范围内的已确诊网格，近距复核只跑范围内的疑点网格。
 */

/** 病害 → 中文名 */
const DISEASE_NAME = {
  rust: '小麦锈病', powdery: '白粉病', loose_smut: '散黑穗病',
  root_rot: '根腐病', fusarium: '赤霉病', leaf_blight: '叶枯病',
};

export default function Dispatch({ meta, devices: parentDevices, detections: parentDetections }) {
  const [modes, setModes] = useState(null);
  const [modeId, setModeId] = useState('spray_target');
  const [range, setRange] = useState(null);
  const [zoneId, setZoneId] = useState('');
  const [disease, setDisease] = useState('');
  const [swath, setSwath] = useState(1.0);
  const [dose, setDose] = useState(12);
  const [speedMs, setSpeedMs] = useState(6);
  const [deviceId, setDeviceId] = useState('UAV-01');
  const [plan, setPlan] = useState(null);
  const [planErr, setPlanErr] = useState(null);
  const [planning, setPlanning] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [result, setResult] = useState(null);
  const [devices, setDevices] = useState(parentDevices || []);
  const [detections, setDetections] = useState(parentDetections || []);

  /* ---------- 目录与设备 ---------- */
  useEffect(() => {
    let alive = true;
    api.fleetModes().then(m => { if (alive) setModes(m); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const stop = subscribe({
      onMessage: (type, payload) => {
        if (type === 'detection') setDetections(prev => [payload, ...prev].slice(0, 400));
        if (type === 'telemetry') {
          setDevices(prev => prev.map(d => d.deviceId === payload.deviceId
            ? { ...d, state: payload.state, pos: payload.pos, batt: payload.batt, online: true }
            : d));
        }
      },
    });
    return () => stop();
  }, []);

  const mode = useMemo(
    () => (modes?.modes || []).find(m => m.id === modeId) || null,
    [modes, modeId]);

  const zones = useMemo(() => meta?.zones || [], [meta]);

  /* ---------- 切换作业方式时套用默认参数 ---------- */
  useEffect(() => {
    if (!mode) return;
    setSwath(mode.defaultSwathM ?? 1.0);
    setDose(mode.defaultDoseLha ?? 12);
    setDeviceId(mode.device === 'robot' ? 'ROB-01' : 'UAV-01');
    setPlan(null); setPlanErr(null); setResult(null);
  }, [mode]);

  /* ---------- 参数变化就重算预览（防抖 250ms） ---------- */
  const planKey = JSON.stringify([modeId, range, zoneId, disease, swath, dose, speedMs, deviceId]);
  useEffect(() => {
    if (!mode) return;
    if (mode.needsRange && !range && mode.id !== 'spray_zone') {
      setPlan(null); setPlanErr('请先在地图上框选作业范围');
      return;
    }
    if (mode.id === 'spray_zone' && !zoneId) {
      setPlan(null); setPlanErr('请先选择管理分区');
      return;
    }
    setPlanning(true);
    const t = setTimeout(async () => {
      try {
        const r = await api.fleetPlan({
          modeId, area: range, zoneId: zoneId || null, disease: disease || null,
          swathM: swath, doseLha: dose, speedMs, deviceId,
        });
        if (r?.error) { setPlan(null); setPlanErr(r.error); }
        else { setPlan(r); setPlanErr(null); }
      } catch (e) {
        setPlan(null); setPlanErr(e.message || '规划失败');
      } finally {
        setPlanning(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [planKey, mode]);

  /* ---------- 下发执行 ---------- */
  const dispatch = async () => {
    setDispatching(true);
    setResult(null);
    try {
      const r = await api.fleetCommand({
        deviceId, type: modeId, modeId,
        area: range, zoneId: zoneId || null, disease: disease || null,
        swathM: swath, doseLha: dose, speedMs,
      });
      if (r?.error) setResult({ ok: false, text: r.error });
      else setResult({
        ok: true,
        text: `已下发「${mode.name}」给 ${deviceId}`,
        commandId: r.command?.commandId,
        missionId: r.command?.missionId,
        summary: r.plan,
      });
    } catch (e) {
      setResult({ ok: false, text: e.message || '下发失败' });
    } finally {
      setDispatching(false);
    }
  };

  const planPath = plan?.path || null;
  const planCells = plan?.targetCells || null;

  return (
    <>
      <div className="page-head">
        <h2>作业调度 · 定范围、选方式、下指令</h2>
        <p>
          在地图上框选作业范围，选择作业方式，平台即时算出航线与药耗，
          确认后下发 —— 设备会真的按这条航线飞完，计量记录与预览逐升对得上。
        </p>
      </div>

      <div className="dispatch-layout">
        {/* ---------- 左：控制面板 ---------- */}
        <div className="dispatch-panel">
          {/* 步骤 1：作业方式 */}
          <div className="card">
            <h3><span className="step-no">1</span>作业方式</h3>
            <div className="dispatch-modes">
              {(modes?.modes || []).map(m => (
                <button
                  key={m.id}
                  className={`dispatch-mode ${modeId === m.id ? 'on' : ''}`}
                  onClick={() => setModeId(m.id)}
                >
                  <div className="dispatch-mode-head">
                    <span className="dispatch-mode-name">{m.name}</span>
                    <span className={`chip ${m.device === 'uav' ? 'accent' : 'mute'}`}>
                      {m.device === 'uav' ? 'UAV-01' : 'ROB-01'}
                    </span>
                  </div>
                  <div className="dispatch-mode-desc">{m.desc}</div>
                  {m.routeDesc && <div className="dispatch-mode-route">航线：{m.routeDesc}</div>}
                </button>
              ))}
            </div>
          </div>

          {/* 步骤 2：作业范围 */}
          <div className="card">
            <h3><span className="step-no">2</span>作业范围</h3>
            {mode?.needsRange ? (
              <>
                <p className="hint">
                  在右侧地图上按住拖动，框出本次作业的范围。
                  靶向点喷只喷范围内已确诊（置信度 ≥ 75%）的网格；
                  近距复核只跑范围内置信度不足的疑点格。
                </p>
                <div className="dispatch-range-row">
                  {range ? (
                    <>
                      <span className="chip warn">
                        x {range.x.toFixed(0)} · y {range.y.toFixed(0)} ·
                        {' '}{range.w.toFixed(0)}×{range.h.toFixed(0)} m
                      </span>
                      <span className="chip mute">
                        约 {(range.w * range.h / 10000).toFixed(3)} ha
                      </span>
                      <button className="btn xs" onClick={() => setRange(null)}>清除</button>
                    </>
                  ) : (
                    <span className="dispatch-range-empty">尚未框选</span>
                  )}
                </div>
              </>
            ) : mode?.id === 'spray_zone' ? (
              <>
                <p className="hint">分区施药按管理分区（A~H）整区执行，无需框选。</p>
                <div className="dispatch-zone-row">
                  {zones.map(z => (
                    <button key={z.id}
                      className={`btn xs ${zoneId === z.id ? 'primary' : ''}`}
                      onClick={() => setZoneId(z.id)}>
                      {z.id} 区
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="hint">全田巡查覆盖整块地，无需框选作业范围。</p>
            )}

            {mode?.needsDisease && (
              <div className="dispatch-field-row">
                <label>病种</label>
                <select value={disease} onChange={e => setDisease(e.target.value)}>
                  <option value="">按检出自动判定</option>
                  {Object.entries(DISEASE_NAME).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* 步骤 3：作业参数 */}
          <div className="card">
            <h3><span className="step-no">3</span>作业参数</h3>
            {mode?.defaultSwathM != null && (
              <div className="dispatch-field-row">
                <label>喷幅 {swath.toFixed(1)} m</label>
                <input type="range" min="0.5" max="7" step="0.5"
                  value={swath} onChange={e => setSwath(Number(e.target.value))} />
              </div>
            )}
            {mode?.defaultDoseLha != null && (
              <div className="dispatch-field-row">
                <label>目标施药量 {dose} L/ha</label>
                <input type="range" min="4" max="24" step="1"
                  value={dose} onChange={e => setDose(Number(e.target.value))} />
              </div>
            )}
            {mode?.device === 'uav' && (
              <div className="dispatch-field-row">
                <label>飞行速度 {speedMs} m/s</label>
                <input type="range" min="3" max="9" step="0.5"
                  value={speedMs} onChange={e => setSpeedMs(Number(e.target.value))} />
              </div>
            )}
            <div className="dispatch-field-row">
              <label>执行设备</label>
              <select value={deviceId} onChange={e => setDeviceId(e.target.value)}>
                {devices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.deviceId} · {d.name || (d.kind === 'uav' ? '植保无人机' : '地面机器人')}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 步骤 4：预览 + 下发 */}
          <div className="card">
            <h3><span className="step-no">4</span>航线预览与下发</h3>

            {planErr && <div className="dispatch-err">{planErr}</div>}

            {planning && <div className="dispatch-pending">正在规划航线…</div>}

            {plan && !planning && (
              <>
                <div className="dispatch-metrics">
                  <Metric k="航线长度" v={`${plan.summary.lengthM} m`} />
                  <Metric k="预计时长" v={`${plan.summary.minutes} 分钟`} />
                  <Metric k="预计药液" v={plan.summary.volumeL != null ? `${plan.summary.volumeL} L` : '不施药'} />
                  <Metric k="作业网格" v={`${plan.summary.cells} 格`} />
                  {plan.summary.areaHa != null && (
                    <Metric k="覆盖面积" v={`${plan.summary.areaHa} ha`} />
                  )}
                  {plan.summary.savedRatioVsZone != null && (
                    <Metric k="分区节药率" v={`${plan.summary.savedRatioVsZone}%`} accent />
                  )}
                </div>

                {plan.ratio && (
                  <div className="dispatch-ratio">
                    <div><b>流量</b> {plan.ratio.requiredFlowLmin} L/min</div>
                    <div><b>可行速度区间</b> {plan.ratio.speedRange?.min}–{plan.ratio.speedRange?.max} m/s</div>
                    <div><b>占空比</b> {(plan.ratio.dutyCycle * 100).toFixed(0)}%</div>
                  </div>
                )}

                <button className="btn primary dispatch-go" disabled={dispatching}
                  onClick={dispatch}>
                  {dispatching ? '下发中…' : `下发「${mode.name}」给 ${deviceId}`}
                </button>
                <p className="dispatch-foot">
                  下发后设备立即起飞执行，遥测与识别随之产生；
                  药耗按本条航线实算，与上方「预计药液」同口径。
                </p>
              </>
            )}

            {result && (
              <div className={`dispatch-result ${result.ok ? 'ok' : 'err'}`}>
                {result.ok ? (
                  <>
                    <div>{result.text}</div>
                    <div className="mono">
                      指令 {result.commandId} · 作业单 {result.missionId}
                    </div>
                    <div className="dispatch-result-hint">
                      可到「装备操控台」看设备实时位置与指令回执。
                    </div>
                  </>
                ) : (
                  <div>{result.text}</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ---------- 右：地图 ---------- */}
        <div className="dispatch-map card pad0">
          <div className="dispatch-map-head">
            <h3>作业范围与航线</h3>
            <span className="dispatch-legend">
              <i className="lg-range" />作业范围
              <i className="lg-path" />规划航线
              <i className="lg-cell" />靶向网格
            </span>
          </div>
          <FieldMap
            field={meta?.field || meta}
            devices={devices}
            detections={detections}
            height={520}
            range={range}
            onRangeChange={mode?.needsRange ? setRange : null}
            plannedPath={planPath}
            plannedCells={planCells}
          />
          <div className="dispatch-map-foot">
            {mode?.needsRange
              ? '在地图上按住拖动即可框选作业范围。'
              : '本作业方式按整块地或指定分区执行，无需框选。'}
          </div>
        </div>
      </div>
    </>
  );
}

function Metric({ k, v, accent }) {
  return (
    <div className={`dispatch-metric ${accent ? 'accent' : ''}`}>
      <span className="dm-k">{k}</span>
      <span className="dm-v">{v}</span>
    </div>
  );
}
