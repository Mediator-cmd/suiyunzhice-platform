/** 风偏代价诊断：验证 edgeCost 的风项是否真的在起作用 */
import { makeEnv, astar, pathLength } from '../shared/swarm.js';
import { defaultField } from '../shared/platform.js';

const field = defaultField();

for (const ws of [0.5, 3, 6]) {
  const env = makeEnv(field, { windSpeed: ws, windDirDeg: 45, nDrones: 4 });
  const a = { r: 5, c: 5 }, b = { r: 12, c: 30 };
  const pRisk = astar(env, a, b, 'risk');
  const pDist = astar(env, a, b, 'distance');
  const cost = (mode) => {
    let L = 0;
    for (let i = 1; i < pRisk.length; i++) {
      L += env.edgeCost(pRisk[i - 1], pRisk[i], mode);
    }
    return L;
  };
  console.log(
    `风速 ${ws} m/s  风向 ${env.wind.dirDeg}°  吹向 ${(env.wind.blowToRad * 180 / Math.PI).toFixed(0)}°` +
    `  risk路径长 ${pathLength(env, pRisk).toFixed(0)} m` +
    `  risk代价 ${cost('risk').toFixed(0)}` +
    `  dist路径长 ${pathLength(env, pDist).toFixed(0)} m` +
    `  两者同路径 ${JSON.stringify(pRisk) === JSON.stringify(pDist)}`
  );
}

// 单条边的风项分解
const env = makeEnv(field, { windSpeed: 6, windDirDeg: 45, nDrones: 4 });
console.log('\n--- 各方向单边代价（起点 (5,5)）---');
for (const [dr, dc, name] of [[0, 1, '东'], [0, -1, '西'], [1, 0, '北'], [-1, 0, '南'], [1, 1, '东北']]) {
  const a = { r: 5, c: 5 }, b = { r: 5 + dr, c: 5 + dc };
  const dyx = (b.c - a.c) * env.cw, dyy = (b.r - a.r) * env.ch;
  const ang = Math.abs(Math.sin(Math.atan2(dyy, dyx) - env.wind.blowToRad));
  const windPen = 0.8 * ang * (env.wind.speed / 5);
  console.log(
    `${name.padEnd(3)} 距离 ${Math.hypot(dyx, dyy).toFixed(1)} m` +
    `  风向夹角sin=${ang.toFixed(3)}  风罚 ${windPen.toFixed(3)}` +
    `  风险边代价 ${env.edgeCost(a, b, 'risk').toFixed(2)}` +
    `  纯距离 ${env.edgeCost(a, b, 'distance').toFixed(2)}`
  );
}
