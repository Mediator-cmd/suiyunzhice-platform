/**
 * 雾滴模型移植验收
 *
 * 用法：node tools/_test_droplets.mjs
 *
 * 验收标准：JS 移植必须复现队友 Python 版 spray_sim.py 的输出。
 * 基准值由 `python code/_bench_droplets.py` 产生（seed=7，n=6000）。
 *
 * 逐项比对：
 *   · 漂移曲线（三档 VMD × 风速 0–7）
 *   · 终端速度
 *   · 蒸发后的直径
 *   · 单点工况的靶区命中率与 P95 漂移
 *
 * 容差说明：JS 与 NumPy 的随机数序列不同，
 * 所以不要求逐位相同，要求**趋势与量级一致**（容差 0.05）。
 * 终端速度与蒸发是确定性计算，要求严格一致（容差 1e-3）。
 */
import {
  terminalVelocity, evaporate, evaluatePass, mulberry, driftMatrix,
} from '../shared/droplets.js';

// Python 基准（由 code/_bench_droplets.py 产出，seed=7，n=6000）
const PY = {
  drift: {
    110: [1.0, 0.9786, 0.8649, 0.7838, 0.7241, 0.5101, 0.2489, 0.097],
    140: [1.0, 0.9912, 0.9028, 0.8207, 0.7487, 0.5934, 0.3522, 0.1522],
    170: [1.0, 0.9955, 0.9305, 0.8354, 0.761, 0.6436, 0.4196, 0.1909],
  },
  terminalVelocity: { 110: 0.2904, 140: 0.4245, 170: 0.5642 },
  evaporate: { 110: 110.0, 140: 140.0, 170: 170.0 },
  pass4: { onTarget: 0.7487, driftP95: 12.806, meanAbsY: 3.3738 },
  pass6: { onTarget: 0.3522, driftP95: 16.494 },
};

const problems = [];
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// ---- ① 终端速度（确定性，严格比对）----
console.log('终端速度：');
for (const [d, py] of Object.entries(PY.terminalVelocity)) {
  const js = terminalVelocity(Number(d));
  const ok = near(js, py, 1e-3);
  console.log(`  ${d} μm  JS ${js.toFixed(4)}  Python ${py.toFixed(4)}  ${ok ? '✓' : '✗'}`);
  if (!ok) problems.push(`终端速度 ${d}μm 不一致：JS ${js} vs Python ${py}`);
}

// ---- ② 蒸发（确定性，严格比对）----
console.log('\n蒸发后直径（t=1s, 22℃, RH=0.6）：');
for (const [d, py] of Object.entries(PY.evaporate)) {
  const js = evaporate(Number(d), 1.0, 22, 0.6);
  const ok = near(js, py, 1e-2);
  console.log(`  ${d} μm  JS ${js.toFixed(3)}  Python ${py.toFixed(3)}  ${ok ? '✓' : '✗'}`);
  if (!ok) problems.push(`蒸发 ${d}μm 不一致：JS ${js} vs Python ${py}`);
}

// ---- ③ 漂移曲线（随机，容差 0.05）----
console.log('\n靶区命中率曲线（风速 0–7 m/s，幅宽 5 m）：');
for (const vmd of [110, 140, 170]) {
  const js = [];
  for (let ws = 0; ws <= 7; ws++) {
    const { metrics } = evaluatePass({
      windSpeed: ws, vmd, n: 6000, rng: mulberry(7),
    });
    js.push(metrics.onTarget);
  }
  const py = PY.drift[vmd];
  let maxDiff = 0;
  const row = js.map((v, i) => {
    const diff = Math.abs(v - py[i]);
    maxDiff = Math.max(maxDiff, diff);
    return `${v.toFixed(3)}/${py[i].toFixed(3)}`;
  });
  const ok = maxDiff <= 0.05;
  console.log(`  VMD ${vmd}: ${row.join(' ')}  最大差 ${maxDiff.toFixed(4)}  ${ok ? '✓' : '✗'}`);
  if (!ok) problems.push(`VMD ${vmd} 漂移曲线偏差 ${maxDiff.toFixed(4)} 超过容差 0.05`);
}

// ---- ④ 单点工况 ----
console.log('\n单点工况（VMD 140）：');
for (const [label, ws, py] of [
  ['风速 4 m/s', 4, PY.pass4],
  ['风速 6 m/s', 6, PY.pass6],
]) {
  const { metrics } = evaluatePass({ windSpeed: ws, vmd: 140, n: 6000, rng: mulberry(7) });
  const okT = near(metrics.onTarget, py.onTarget, 0.05);
  const okP = near(metrics.driftP95, py.driftP95, 1.5);
  console.log(
    `  ${label}  靶区命中率 JS ${metrics.onTarget.toFixed(4)} / Py ${py.onTarget.toFixed(4)} ${okT ? '✓' : '✗'}`
    + `   P95 漂移 JS ${metrics.driftP95.toFixed(2)} / Py ${py.driftP95.toFixed(2)} ${okP ? '✓' : '✗'}`
  );
  if (!okT) problems.push(`${label} 靶区命中率偏差过大`);
  if (!okP) problems.push(`${label} P95 漂移偏差过大`);
}

// ---- ⑤ 物理合理性：命中率必须随风速单调下降 ----
const rows = driftMatrix([0, 2, 4, 6], [140], 4000);
const mono = rows[0].cells.every((v, i) => i === 0 || v <= rows[0].cells[i - 1] + 1e-6);
console.log(`\n靶区命中率随风速单调不增：${mono ? '✓' : '✗'}`);
if (!mono) problems.push('靶区命中率未随风速单调下降');

console.log(problems.length ? `\n✗ ${problems.length} 项不符：\n  - ${problems.join('\n  - ')}` : '\n✓ 雾滴模型移植复现了 Python 版输出');
process.exit(problems.length ? 1 : 0);
