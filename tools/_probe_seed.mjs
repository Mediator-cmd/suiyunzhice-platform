// 播种出的历史农情（7 天）本身产出多少条识别 / 多少次联动事件 / 置信度如何
// 这是申报书「演示数据」口径的真实来源，与运行中的实时累计区分开。
import { MemoryStore } from '../shared/memstore.js';
import { seedAgroHistory } from '../shared/agroseed.js';
import { Platform, defaultField } from '../shared/platform.js';
import { Analytics } from '../shared/analytics.js';

const store = new MemoryStore();
const field = defaultField();
const platform = new Platform({ store, field });

const r = seedAgroHistory(store, field, platform.getPlan().best, { now: Date.now() });
console.log('=== 播种产出 ===');
console.log('detections:', r.detections, ' missions:', r.missions, ' linkEvents:', r.linkEvents);

const dets = store.listDetections(5000);
const links = store.listLinkEvents(5000);
const avg = dets.length ? dets.reduce((a, d) => a + d.confidence, 0) / dets.length : 0;
const confirmed = dets.filter(d => d.confidence >= 0.75);
const lat = links.map(e => e.totalMs ?? e.latency?.total).filter(v => typeof v === 'number').sort((a, b) => a - b);
const closed = links.filter(e => e.closed).length;

console.log('\n=== 播种后的统计 ===');
console.log('识别总数:', dets.length);
console.log('确诊(>=0.75):', confirmed.length);
console.log('平均置信度:', avg.toFixed(3), '=>', (avg * 100).toFixed(1) + '%');
console.log('空中:', dets.filter(d => d.kind === 'uav').length, ' 地面:', dets.filter(d => d.kind === 'robot').length);
console.log('联动事件:', links.length);
console.log('闭环完成:', closed, '/', links.length, '=', links.length ? (closed / links.length * 100).toFixed(1) + '%' : 'n/a');
if (lat.length) {
  console.log('平均时延:', (lat.reduce((a, b) => a + b, 0) / lat.length / 1000).toFixed(1), 's');
  console.log('P95时延:', (lat[Math.min(lat.length - 1, Math.floor(lat.length * 0.95))] / 1000).toFixed(1), 's');
}
const ov = new Analytics(store).overview();
console.log('\n=== analytics.overview（播种后，未跑模拟器）===');
console.log('detection:', JSON.stringify(ov.detection));
console.log('linkage  :', JSON.stringify(ov.linkage));
