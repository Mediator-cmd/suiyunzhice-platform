/** 用 DO 存储的种子数据复现 coverage 0.75 的场景 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SqliteStore } from '../cloud/src/sqlite-store.js';
class FakeDoSql {
  constructor(db) { this.db = db; }
  exec(query, ...params) {
    const head = query.trim().split(/\s+/, 1)[0].toUpperCase();
    const isQuery = head === 'SELECT' || head === 'WITH';
    if (isQuery) {
      const stmt = this.db.prepare(query);
      const rows = params.length ? stmt.all(...params) : stmt.all();
      return { toArray: () => rows, one: () => rows[0] ?? null };
    }
    if (params.length) this.db.prepare(query).run(...params);
    else this.db.exec(query);
    return { toArray: () => [], one: () => null };
  }
}
import { seedDemoPlatform } from '../shared/demo.js';
import { seedAgroHistory } from '../shared/agroseed.js';
import { defaultField } from '../shared/platform.js';
import { swarmPlan } from '../shared/swarm.js';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'diagcover-'));
const db = new DatabaseSync(path.join(dir, 't.db'));
const store = new SqliteStore(new FakeDoSql(db));
await store.migrate();
const field = defaultField();
seedDemoPlatform(store, { skipTenants: false });

const dets = store.listDetections(3000);
const confirmed = dets.filter(d => d.confidence >= 0.75);
const src = confirmed.length ? confirmed : dets;
const map = new Map();
for (const d of src) {
  const key = `${d.grid.row}_${d.grid.col}`;
  if (!map.has(key)) map.set(key, { row: d.grid.row, col: d.grid.col, n: 0, severity: 0 });
  const e = map.get(key); e.n++; e.severity = Math.max(e.severity, d.confidence);
}
const cells = [...map.values()].sort((a, b) => b.n - a.n).slice(0, 20);
console.log('检出总数', dets.length, ' 确诊', confirmed.length, ' 目标格', cells.length);
console.log('目标格:', cells.map(c => `(${c.row},${c.col})n=${c.n}`).join(' '));

const hotspots = cells.map(c => ({ r: c.row, c: c.col, area: 25, severity: c.severity }));
const res = swarmPlan(field, hotspots, { nDrones: 4, windSpeed: 3, windDirDeg: 45, algo: 'pso-aco', seed: 0 });
console.log('\nmetrics:', JSON.stringify(res.metrics));

const sprayed = new Set();
for (const t of res.tracks) for (const s of t.spraySegments) for (const p of s) sprayed.add(`${p.r}_${p.c}`);
console.log('\n--- 逐目标格 ---');
hotspots.forEach((h, i) => {
  const k = `${h.r}_${h.c}`;
  const on = res.tracks.map((t, ti) => t.nodes.includes(i + 1) ? ti : -1).filter(x => x >= 0);
  console.log(`格(${h.r},${h.c}) 任务机=${JSON.stringify(on)} 被喷=${sprayed.has(k)}`);
});
console.log('\n各机:');
res.tracks.forEach((t, i) => {
  console.log(` 架${i} 任务点=${JSON.stringify(t.nodes)}`);
  t.spraySegments.forEach(s => console.log(`    带: ${s.map(p => `${p.r},${p.c}`).join(' → ')}`));
});
