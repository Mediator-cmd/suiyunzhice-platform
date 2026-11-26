/**
 * 机器人复核吞吐诊断
 *
 * 现象：检出在累积，但机器人一单复核都没完成，队列持续堆积。
 * 这个脚本跟踪机器人的位置与目标，找出它卡在哪一步。
 */
import { Simulator } from '../shared/simulator.js';
import { defaultField } from '../shared/platform.js';

const robotDets = [];
const sim = new Simulator({
  field: defaultField(),
  dt: 15,
  detectChance: 0.16,
  onDetection: (d) => { if (d.kind === 'robot') robotDets.push(d); },
});

for (let i = 0; i < 40; i++) {
  sim.tick();
  if (i % 4 === 0) {
    const r = sim.robot;
    const t = r.target;
    const dist = t ? Math.hypot(t.geo.x - r.x, t.geo.y - r.y) : 0;
    console.log(
      `拍 ${String(i).padStart(2)}  state ${String(r.state).padEnd(12)}`
      + ` pos ${r.x.toFixed(0).padStart(4)},${r.y.toFixed(0).padStart(4)}`
      + `  target ${t ? `(${t.geo.x},${t.geo.y})` : '-'.padEnd(12)}`
      + `  dist ${dist.toFixed(1).padStart(6)}`
    );
  }
}

console.log(`\n机器人完成复核 ${robotDets.length} 单，队列剩 ${sim.pendingRechecks.length}`);
