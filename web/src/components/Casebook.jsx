import React, { useRef, useState } from 'react';
import samples from '../casebook.json';
import { LinkageEngine } from '../../../shared/linkage.js';
import './casebook.css';

const groups = [...new Set(samples.map(sample => sample.group))];
const byId = Object.fromEntries(samples.map(sample => [sample.id, sample]));
const engine = new LinkageEngine({});
const reference = byId['healthy-01'];
const focus = { rust: '叶片 · 橙黄色斑纹', powdery: '叶片 · 白色粉层', fusarium: '麦穗 · 穗部变色', sheath_blight: '茎基部 · 叶鞘斑纹', healthy: '健康小麦对照' };
const image = (sample, full = false) => `${import.meta.env.BASE_URL}casebook/${sample.id}.${full ? 'jpg' : 'webp'}`;

function decision(sample) {
  if (sample.group === 'healthy') return ['不派单', '样本未检出明显病害'];
  if (sample.group === 'sheath_blight') return ['仅作对照', '策略库尚未配置纹枯病'];
  const result = engine.evaluateDetection({ disease: sample.group, confidence: sample.percent / 100, part: sample.group === 'fusarium' ? 'ear' : 'leaf' });
  return [result.needRecheck ? '待近地复核' : '符合直接派单条件', result.reasons.join('；')];
}

function SamplePhoto({ sample, caption }) {
  const dialog = useRef(null);
  const [showFull, setShowFull] = useState(false);
  const name = `${sample.label} ${sample.number}`;
  return <figure className="cb-photo">
    <button type="button" aria-label={`放大${name}`} onClick={() => { setShowFull(true); dialog.current.showModal(); }}>
      <img src={image(sample)} alt={name} /><span>放大</span>
    </button>
    <figcaption>{caption || name}</figcaption>
    <dialog ref={dialog} className="cb-dialog" aria-label={`${name}原图`} onClose={() => setShowFull(false)}>
      <header><strong>{name} · 原图</strong><button className="btn" autoFocus onClick={() => dialog.current.close()}>关闭</button></header>
      {showFull && <img src={image(sample, true)} alt={`${name}原图`} />}
    </dialog>
  </figure>;
}

export function SampleLibrary({ caseId, selectCase, onReplay }) {
  const sample = byId[caseId];
  const [compare, setCompare] = useState(false);
  const siblings = samples.filter(item => item.group === sample.group);
  return <section className="card cb-panel" aria-label="病害样本库">
    <header className="cb-head"><h3>病害样本库</h3><small>5 类 · 50 张演示图片</small></header>
    <div className="cb-groups" aria-label="样本分类">{groups.map(group => {
      const first = samples.find(item => item.group === group);
      return <button key={group} aria-pressed={sample.group === group} onClick={() => selectCase(first.id)}>{first.label}</button>;
    })}</div>
    <div className="cb-body"><div className="cb-photos"><SamplePhoto sample={sample} />
      {compare && sample.group !== 'healthy' && <SamplePhoto sample={reference} caption="健康麦穗对照 · 01" />}</div>
      <div className="cb-info"><strong>{focus[sample.group]}</strong>
        <div className="cb-thumbs">{siblings.map(item => <button key={item.id} aria-label={`选择${item.label} ${item.number}`} aria-pressed={item.id === caseId} onClick={() => selectCase(item.id)}>
          <img loading="lazy" src={image(item)} alt="" /><span>{item.number}</span></button>)}</div>
        <div className="cb-actions"><button className="btn primary" onClick={onReplay}>查看联动判定</button>
          {sample.group !== 'healthy' && <button className="btn" aria-pressed={compare} onClick={() => setCompare(!compare)}>{compare ? '收起对照' : '对照健康样本'}</button>}</div>
      </div></div>
  </section>;
}

const presets = [['healthy-01', '健康对照'], ['powdery-07', '低分复核'], ['fusarium-06', '病种复核']];

export function CaseReplay({ caseId, selectCase, onLibrary }) {
  const sample = byId[caseId];
  const [status, reason] = decision(sample);
  return <section className="card cb-panel" aria-label="案例回放">
    <header className="cb-head"><h3>案例回放</h3><small>演示样本 · 不计入作业统计</small></header>
    <div className="cb-groups">{presets.map(([id, title]) => <button key={id} aria-pressed={caseId === id} onClick={() => selectCase(id)}>{title}</button>)}
      <button onClick={onLibrary}>从图库选择 →</button></div>
    <div className="cb-body cb-replay"><SamplePhoto sample={sample} />
      <div className="cb-info" aria-live="polite"><small>历史识别 · ResNet18 v5.2</small>
        <strong>{sample.predicted} <span className="cb-score">{sample.percent.toFixed(1)}%</span></strong>
        <div className="cb-result"><b>{status}</b><div>{reason}</div></div>
        <details key={caseId}><summary>示意网格档案</summary><dl className="cb-record">
          <dt>证据图</dt><dd><a href={image(sample, true)} target="_blank" rel="noreferrer">{sample.label} {sample.number} · 查看原图</a></dd>
          <dt>样本位置</dt><dd>未定位</dd><dt>复核回传</dt><dd>{status === '待近地复核' ? '等待证据' : '无需回传'}</dd>
        </dl></details></div></div>
  </section>;
}
