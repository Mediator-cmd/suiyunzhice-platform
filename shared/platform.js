/**
 * 平台内核 —— 服务端与浏览器端共用
 *
 * 把「地块定义 + 规划缓存 + 元数据 + 靶向网格选取」这些平台级逻辑
 * 收敛到一处，保证：
 *   1. 真实部署（Node + SQLite）与纯静态部署（浏览器内存）行为完全一致
 *   2. 申报材料里引用的每一个数字，无论演示环境怎么变，口径都唯一
 */

import {
  DISEASES, ANALYTICS_DIMENSIONS, DEVICE_STATES, PLAN_OBJECTIVES, SPRAY_RATIO_NOTE,
} from './schema.js';
import { SPRAY_STRATEGIES, SPRAY_WINDOW_RULES } from './agronomy.js';
import { Field, autoPlan, manualBaseline, compareWithManual } from './planner.js';

/** 天津宁河东棘坨镇示范田 —— 200m × 100m = 2 ha，5m × 5m 网格 */
export function defaultField() {
  return new Field({
    id: 'FLD-DJL-01',
    name: '天津宁河东棘坨镇示范田',
    widthM: 200, heightM: 100,          // 2 ha
    gridRows: 20, gridCols: 40,         // 5m × 5m 网格
    obstacles: [
      { x: 150, y: 0, w: 12, h: 30, label: '灌溉水渠' },
      { x: 40, y: 60, w: 25, h: 8, label: '地头房舍' },
    ],
  });
}

export class Platform {
  /**
   * @param {object} opts
   * @param {object} opts.store   存储实现（SQLite Store 或 MemoryStore）
   * @param {object} [opts.field]  地块，缺省用示范田
   */
  constructor({ store, field = null }) {
    this.store = store;
    this.field = field || defaultField();
    this.store.upsertField(this.field);
    this.planCache = new Map();
  }

  /**
   * 靶向网格选取：取已确认（置信度 ≥ 0.75）的病害网格中最密集的若干个。
   * 这样"靶向点喷"模式才真正只覆盖病灶，而不是随便打几个格子。
   */
  targetCellsFor(store = this.store) {
    const dets = store.listDetections(3000);
    const confirmed = dets.filter(d => d.confidence >= 0.75);
    const src = confirmed.length ? confirmed : dets;
    const map = new Map();
    for (const d of src) {
      const key = `${d.grid.row}_${d.grid.col}`;
      if (!map.has(key)) map.set(key, { row: d.grid.row, col: d.grid.col, n: 0 });
      map.get(key).n++;
    }
    return [...map.values()].sort((a, b) => b.n - a.n).slice(0, 24)
      .map(c => ({ row: c.row, col: c.col }));
  }

  /** 自动规划 + 与人工手画航线的对比 */
  getPlan(opts = {}) {
    const key = JSON.stringify(opts);
    const planOpts = { ...opts };
    if (planOpts.mode === 'target') {
      // 靶向网格随识别结果动态变化，不做缓存
      const cells = this.targetCellsFor();
      if (cells.length) planOpts.targetCells = cells;
    } else if (this.planCache.has(key)) {
      return this.planCache.get(key);
    }
    const result = autoPlan(this.field, planOpts);
    const manual = manualBaseline(this.field, planOpts);
    const out = { ...result, comparison: compareWithManual(result.best, manual) };
    if (planOpts.mode !== 'target') this.planCache.set(key, out);
    return out;
  }

  /** 平台元数据：地块、病种字典、分析维度、规划目标定义 */
  meta() {
    const f = this.field;
    return {
      name: '穗云智策 · 空地协同精准植保智能决策云平台',
      version: '1.0.0',
      field: {
        id: f.id, name: f.name,
        widthM: f.widthM, heightM: f.heightM,
        gridRows: f.gridRows, gridCols: f.gridCols,
        cellSizeM: f.cellW, areaHa: f.totalAreaHa(),
        workableAreaHa: +f.workableAreaHa().toFixed(2),
        obstacles: f.obstacles,
        // 管理分区（A~H）—— 与地图上的虚线分区、作业单里的 zoneId 完全同源
        zoneCols: f.zoneCols, zoneRows: f.zoneRows,
        zones: f.zones().map(z => ({
          id: z.id, x: z.x, y: z.y, w: z.w, h: z.h,
          areaHa: +z.areaHa.toFixed(3),
          gridRange: z.gridRange,
        })),
      },
      diseases: DISEASES,
      dimensions: ANALYTICS_DIMENSIONS,
      objectives: PLAN_OBJECTIVES,
      sprayRatio: SPRAY_RATIO_NOTE,
      states: DEVICE_STATES,
      // 施药策略库与施药窗口判据 —— 从原平台提炼，改为随元数据一起下发
      strategies: SPRAY_STRATEGIES,
      sprayWindowRules: SPRAY_WINDOW_RULES,
    };
  }
}
