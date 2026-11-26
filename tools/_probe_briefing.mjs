// 核对农户简报（briefing）里的误检率 KPI 是否来自离线基准而非硬编码
import { MemoryStore } from '../shared/memstore.js';
import { seedAgroHistory } from '../shared/agroseed.js';
import { Platform, defaultField } from '../shared/platform.js';
import { Analytics } from '../shared/analytics.js';

const store = new MemoryStore();
const field = defaultField();
const platform = new Platform({ store, field });
seedAgroHistory(store, field, platform.getPlan().best, { now: Date.now() });

const b = new Analytics(store, field).farmerBriefing();
console.log('headline:', b.headline);
console.log('\nkpis:');
for (const k of b.kpis) console.log(`  ${k.label}: ${k.value}  (${k.sub})`);
