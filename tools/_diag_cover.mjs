/** 覆盖率诊断：找出漏喷格并给出原因 */
import { swarmPlan, makeEnv } from '../shared/swarm.js';
import { defaultField } from '../shared/platform.js';

const field = defaultField();
const cells = JSON.parse(process.argv[2]);
const hotspots = cells.map(c => ({ r: c.row, c: c.col, area: 25, severity: 0.6 }));

const res = swarmPlan(field, hotspots, { nDrones: 4, windSpeed: 3, windDirDeg: 45, algo: 'pso-aco', seed: 0 });
console.log('metrics:', JSON.stringify(res.metrics));

// 重建 sprayed 掩码
const env = makeEnv(field, { windSpeed: 3, windDirDeg: 45, nDrones: 4 });
const sprayed = new Set();
for (const t of res.tracks) for (const s of t.spraySegments) for (const p of s) sprayed.add(`${p.r}_${p.c}`);

console.log('\n--- 逐目标格 ---');
for (const h of hotspots) {
  const k = `${h.r}_${h.c}`;
  // 该格是否在任何机架的任务点里
  const onTrack = res.tracks.map((t, i) => t.nodes.includes(hotspots.indexOf(h) + 1) ? i : -1).filter(i => i >= 0);
  const sprayedCell = res.tracks.flatMap(t => t.spraySegments.map(s => s.map(p => `${p.r}_${p.c}`))).flat();
  const covered = sprayed.has(k);
  console.log(`格(${h.r},${h.c})  任务机=${JSON.stringify(onTrack)}  被喷=${covered}  出现在喷洒段=${sprayedCell.includes(k)}`);
}
console.log('\n各机喷洒段:');
res.tracks.forEach((t, i) => {
  console.log(`  架${i} 任务点=${JSON.stringify(t.nodes)}`);
  t.spraySegments.forEach(s => console.log(`     带: ${s.map(p => `${p.r},${p.c}`).join(' → ')}`));
});
