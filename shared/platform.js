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
import { BASELINE_TARGET_CELLS, BASELINE_PARAMS, BASELINE_SCENARIO_ID } from './baseline.js';

/**
 * 河北省唐山市 30 亩示范田 —— 200m × 100m = 20000 m² = 30 亩 = 2 ha，
 * 5m × 5m 网格。
 *
 * 地点口径以申报书为准：项目已与河北省唐山市 30 亩试验田签订合作，
 * 平台展示的示范田就是这块田。此前初版平台曾写作「天津宁河东棘坨镇」，
 * 与申报书与合作协议不符，已按申报书统一。
 */
export function defaultField() {
  return new Field({
    id: 'FLD-DJL-01',
    name: '河北省唐山市 30 亩示范田',
    widthM: 200, heightM: 100,          // 2 ha
    gridRows: 20, gridCols: 40,         // 5m × 5m 网格
    /**
     * 真实地理锚点：唐山市丰润区一带（北纬 39.63°、东经 118.18°）。
     *
     * 用它把平台的局部米制坐标锚到真实地理位置，
     * 地图才能叠加真实高程（NASA terrarium）与街道底图（OSM）。
     * 精度说明：这是示范田所在区域的公开坐标中心，
     * 具体地块边界仍以平台内 5 m 网格为准。
     */
    lat: 39.6304,
    lon: 118.1802,
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

  /**
   * 自动规划 + 与人工手画航线的对比。
   *
   * opts.scenario = 'baseline' 时返回「申报书实测基准场景」：
   * 靶向网格固定为 19 格，数字与申报材料完全一致。
   * 缺省（实时）模式下靶向网格随识别结果动态变化。
   */
  getPlan(opts = {}) {
    const key = JSON.stringify(opts);
    const planOpts = { ...opts };
    const isBaseline = planOpts.scenario === 'baseline';
    if (planOpts.mode === 'target') {
      if (isBaseline) {
        planOpts.targetCells = BASELINE_TARGET_CELLS;
        planOpts.headingDeg = BASELINE_PARAMS.headingDeg;
        planOpts.speedMs = BASELINE_PARAMS.speedMs;
        planOpts.swathM = BASELINE_PARAMS.swathM;
      } else {
        // 靶向网格随识别结果动态变化，不做缓存
        const cells = this.targetCellsFor();
        if (cells.length) planOpts.targetCells = cells;
      }
    }
    if (planOpts.mode !== 'target' && this.planCache.has(key)) {
      return this.planCache.get(key);
    }
    const result = autoPlan(this.field, planOpts);
    const manual = manualBaseline(this.field, planOpts);
    const out = { ...result, comparison: compareWithManual(result.best, manual) };
    if (isBaseline) out.scenario = BASELINE_SCENARIO_ID;
    if (planOpts.mode !== 'target') this.planCache.set(key, out);
    return out;
  }

  /**
   * 申报书实测基准场景的完整一组数字（全田 + 靶向 + 对比 + 节药）。
   * 前端「实测基准」卡片与申报材料共用这一份，保证口径同源。
   */
  baselineReport() {
    const full = autoPlan(this.field, {
      mode: 'full',
      swathM: BASELINE_PARAMS.fullSwathM,
      targetDoseLha: BASELINE_PARAMS.targetDoseLha,
    });
    const target = autoPlan(this.field, {
      mode: 'target',
      targetCells: BASELINE_TARGET_CELLS,
      headingDeg: BASELINE_PARAMS.headingDeg,
      speedMs: BASELINE_PARAMS.speedMs,
      swathM: BASELINE_PARAMS.swathM,
      targetDoseLha: BASELINE_PARAMS.targetDoseLha,
    });
    const manualFull = manualBaseline(this.field, { mode: 'full', swathM: 5.0 });
    const fullCmp = compareWithManual(full.best, manualFull);

    const f = full.best;
    const t = target.best;
    const fr = t.route;
    const tr = t.ratio;
    const fScore = f.score?.detail || {};
    const tScore = t.score?.detail || {};

    const fullVolL = f.ratio?.totalVolumeL ?? 0;
    const targetVolL = tr?.totalVolumeL ?? 0;

    return {
      scenario: BASELINE_SCENARIO_ID,
      field: {
        areaHa: +this.field.totalAreaHa().toFixed(2),
        mu: +(this.field.totalAreaHa() * 15).toFixed(0),
        gridSizeM: this.field.cellW,
        zones: this.field.zones().length,
      },
      full: {
        headingDeg: f.headingDeg, speedMs: f.speedMs, swathM: f.swathM,
        lengthM: fScore.lengthM, minutes: fScore.totalMinutes,
        volumeL: fullVolL, batteryPct: fScore.batteryPct,
        overlap: fScore.overlapRatio,
      },
      target: {
        headingDeg: t.headingDeg, speedMs: t.speedMs, swathM: t.swathM,
        targetCells: fr?.nTargetCells ?? BASELINE_TARGET_CELLS.length,
        clusters: fr?.nClusters ?? 0,
        lengthM: tScore.lengthM, minutes: tScore.totalMinutes,
        volumeL: targetVolL, batteryPct: tScore.batteryPct,
        coverage: fr?.targetCoverage ?? null,
        spillAreaHa: fr?.spillAreaHa ?? null,
        areaHa: fr?.regionAreaHa ?? null,
      },
      saving: {
        fullVolumeL: +fullVolL.toFixed(1),
        targetVolumeL: +targetVolL.toFixed(2),
        savedL: +(fullVolL - targetVolL).toFixed(2),
        savedRatio: fullVolL > 0 ? +((1 - targetVolL / fullVolL) * 100).toFixed(1) : null,
      },
      ratio: {
        flowPerSpeed: tr?.flowPerSpeed ?? null,
        speedRange: tr?.speedRange ?? null,
        dutyCycle: tr?.dutyCycle ?? null,
      },
      search: {
        headings: 8, speeds: 5, swaths: 4,
        combinations: 8 * 5 * 4,
        weights: { economy: 0.4, speed: 0.35, eco: 0.25 },
      },
      vsManual: {
        minutes: fullCmp.gains.minutes,
        lengthM: fullCmp.gains.lengthM,
        turningShare: fullCmp.gains.turningShare,
        overlapAuto: fullCmp.auto.overlap,
        overlapManual: fullCmp.manual.overlap,
      },
    };
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
        // 真实地理锚点：地图据此叠加真实地形 / 卫星 / 街道底图
        lat: f.lat ?? null, lon: f.lon ?? null,
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
