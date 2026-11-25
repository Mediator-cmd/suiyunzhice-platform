import { Platform } from '../shared/platform.js';
import { MemoryStore } from '../shared/memstore.js';
import { Analytics } from '../shared/analytics.js';

const store = new MemoryStore();
const platform = new Platform({ store });
const analytics = new Analytics({ store });
const out = { meta: platform.meta(), baseline: platform.baselineReport() };
console.log(JSON.stringify(out, null, 1));
