/** 用 4 个格复现 coverage 0.75 */
import { swarmPlan, makeEnv } from '../shared/swarm.js';
import { defaultField } from '../shared/platform.js';
const field = defaultField();

// 云端实时模拟器产出的典型格（含 1 个在障碍/边缘附近）
const cases = [
  [{r:6,c:12},{r:7,c:13},{r:8,c:11},{r:9,c:14}],
  [{r:6,c:12},{r:6,c:13},{r:6,c:14},{r:6,c:15}],
  [{r:3,c:5},{r:10,c:20},{r:20,c:30},{r:6,c:12}],
];
for (const hs of cases) {
  const res = swarmPlan(field, hs.map(h=>({...h,area:25,severity:0.6})), { nDrones:4, windSpeed:3, windDirDeg:45, algo:'pso-aco', seed:0 });
  console.log('格:', hs.map(h=>`(${h.r},${h.c})`).join(' '), '→', res.ok?JSON.stringify(res.metrics):res.reason);
  if (res.ok) {
    const sprayed = new Set();
    for (const t of res.tracks) for (const s of t.spraySegments) for (const p of s) sprayed.add(`${p.r}_${p.c}`);
    hs.forEach((h,i)=>{
      const on = res.tracks.map((t,ti)=>t.nodes.includes(i+1)?ti:-1).filter(x=>x>=0);
      const ok = sprayed.has(`${h.r}_${h.c}`);
      console.log(`   格(${h.r},${h.c}) 机=${JSON.stringify(on)} 喷=${ok}`);
    });
    res.tracks.forEach((t,i)=>console.log(`   架${i} 任务=${JSON.stringify(t.nodes)} 带=${t.spraySegments.map(s=>s.map(p=>`${p.r},${p.c}`).join('→')).join(' | ')}`));
  }
  console.log();
}
