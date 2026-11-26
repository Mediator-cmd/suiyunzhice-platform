// 核对播种态的效率口径：全田口径 savedRatio 应为申报书基准场景的 97.7%
import { MemoryStore } from '../shared/memstore.js';
import { seedAgroHistory } from '../shared/agroseed.js';
import { Platform, defaultField } from '../shared/platform.js';
import { Analytics } from '../shared/analytics.js';

const store = new MemoryStore();
const field = defaultField();
const platform = new Platform({ store, field });
seedAgroHistory(store, field, platform.getPlan().best, { now: Date.now() });

const ov = new Analytics(store, field).overview();
console.log('=== 播种态 overview.efficiency ===');
console.log(JSON.stringify(ov.efficiency, null, 2));

console.log('\n=== baselineReport（申报书基准场景）===');
const br = platform.baselineReport();
console.log(JSON.stringify(br, null, 2).slice(0, 2000));
