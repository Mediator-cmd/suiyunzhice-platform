/**
 * 协同规划自检：跑通 swarmPlan 并输出关键指标。
 * 用法：node tools/_test_swarm.mjs
 */
import { swarmPlan } from '../shared/swarm.js';
import { defaultField } from '../shared/platform.js';

const field = defaultField();

// 造一批病灶点：模拟平台识别结果里**分散的多处病灶**
//
// 注意：这里刻意用分散点而不是一整块密集网格。
// 密集网格会聚成**一个簇**，簇不可分割 -> 分配算法没有选择余地，
// 五种算法算出来完全一样（航程/时长/能耗全同），测不出差异。
// 分散点才会形成多个簇，PSO/GA/ACO 的任务分配能力才体现得出来。
const hotspots = [];
for (const [r, c] of [
  [3, 4], [4, 6], [6, 12], [7, 13], [8, 11], [9, 15],
  [11, 5], [12, 8], [13, 20], [14, 22], [15, 17],
  [5, 25], [7, 28], [10, 30], [12, 27], [16, 24],
  [17, 10], [18, 14], [4, 34], [9, 35],
]) {
  hotspots.push({ r, c, area: 25, severity: 0.6 + ((r * 7 + c * 3) % 10) / 30 });
}

for (const algo of ['nearest', 'ga', 'pso', 'aco', 'pso-aco']) {
  const t = Date.now();
  const res = swarmPlan(field, hotspots, { algo, nDrones: 4, seed: 7 });
  if (!res.ok) { console.log(algo, 'FAIL', res.reason); continue; }
  const m = res.metrics;
  console.log(
    `${algo.padEnd(10)} 航程 ${String(m.totalLengthM).padStart(5)} m` +
    `  时长 ${String(m.totalMinutes).padStart(6)} min` +
    `  架次 ${m.makespanMinutes} min` +
    `  能耗 ${String(m.energyWh).padStart(5)} Wh` +
    `  转弯 ${String(m.turns).padStart(4)}` +
    `  覆盖 ${(m.coverage * 100).toFixed(1)}%` +
    `  过喷 ${(m.overRatio * 100).toFixed(1)}%` +
    `  净空 ${m.minClearanceM} m` +
    `  ${Date.now() - t} ms`
  );
}

// 风场敏感性
//
// 物理结论：**风主要改变能耗，不改变航程几何**。
//   · 风速 ↑ → 逆风要加大地速顶风、侧风要蟹行 → 能耗显著上升
//   · 风向变 → 顺风 / 逆风 / 侧风三种工况能耗差异明显
//   · 最优航线结构通常不变（净空保持一致）
//
// 早期版本以为「风大 → 航线更保守 → 航程更长」，
// 反复调参才发现那是把风罚加错了地方；
// 现在风罚加在两个物理上正确的位置：
//   ① 喷洒带朝向择优（横向漂移代价）
//   ② 转场段蟹行代价（有符号的沿线分量，各向异性）
console.log('\n--- 风场敏感性（能耗随风速/风向变化）---');
for (const ws of [0, 3, 6, 9]) {
  const res = swarmPlan(field, hotspots, { algo: 'pso-aco', nDrones: 4, windSpeed: ws, windDirDeg: 45, seed: 7 });
  console.log(
    `风速 ${String(ws).padStart(2)} m/s → 航程 ${res.metrics.totalLengthM} m` +
    `, 能耗 ${String(res.metrics.energyWh).padStart(4)} Wh` +
    `, 净空 ${res.metrics.minClearanceM} m`
  );
}
console.log('\n--- 风向（风速 6 m/s）---');
for (const wd of [45, 135, 225, 315]) {
  const res = swarmPlan(field, hotspots, { algo: 'pso-aco', nDrones: 4, windSpeed: 6, windDirDeg: wd, seed: 7 });
  console.log(
    `风向 ${String(wd).padStart(3)}° → 航程 ${res.metrics.totalLengthM} m` +
    `, 能耗 ${String(res.metrics.energyWh).padStart(4)} Wh`
  );
}
