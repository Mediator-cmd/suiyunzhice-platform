/**
 * 检测器驱动的工作点模型
 *
 * 来源：队友交付代码包 `11.24新植保/code/detection_map.py`
 * （与 `code/data` 下各病种的精确率 / 召回率校准配套）。
 *
 * 为什么平台需要这个：
 *
 * 平台原先的检测是「离病灶越近、检出概率越高」的随机模型 ——
 * 看着像那么回事，但**不反映检测模型的真实工作点**，
 * 于是两个关键指标是假的：
 *
 *   ① 闭环完成率 —— 病灶不会漏检，机器人每次都有活干，
 *      平台看到的是「检测器完美」下的派单量；
 *   ② 过喷率 —— 没有误检，也就没有「派了单却发现不是病害」的返工，
 *      平台看不到真实作业里最贵的那一类浪费。
 *
 * 队友的模型用两个机制补上了这一点：
 *
 *   · **斑块级漏检**：整片病灶里的目标全部漏掉时，这片就没了。
 *     概率 p_miss = (1 − recall·0.85)^n_targets —— 目标越多越容易全漏。
 *     这是小病斑成片消失的主因，也是「先确认再喷」策略存在的理由。
 *
 *   · **背景误检散布**：误报不是均匀撒的，越健康的地方越容易误报
 *     （权重 w = 1 − 0.7·severity）。这部分误报会变成真实的误喷。
 *
 * 两套病种口径的映射
 * --------------------
 * 队友的实验是三类：rust / aphid / borer，平台是七类作物病害。
 * 锈病两边同名，有实测工作点直接可用；
 * 其余病种按「病害形态族」外推：
 *
 *   · 叶部高对比（锈病、白粉病）→ 检出容易
 *   · 叶部低对比潜纹（叶枯病）→ 接近蚜虫那一档
 *   · 穗部潜藏（散黑穗病、赤霉病）→ 最难
 *   · 根茎部（根腐病）→ 空中几乎看不见，必然要地面复核
 *
 * 外推值**不是实测**，所以在 `provenance` 字段里逐病种标出来了 ——
 * 答辩时不能把外推说成实测。
 */

/* ------------------------------------------------------------------ *
 * 检测工作点
 * ------------------------------------------------------------------ */

/**
 * 每病种的 (precision, recall)。
 *
 * `measured: true` 表示该值有实验 JSON 支撑；
 * `measured: false` 表示按形态族外推（见文件头说明）。
 */
export const DETECTION_WORKING_POINTS = {
  // —— 实测（队友实验 out/detection/calibration.json）——
  rust:   { precision: 0.8038, recall: 0.9393, measured: true },

  // —— 外推：形态族对应 ——
  powdery:    { precision: 0.7822, recall: 0.8371, measured: false, family: '叶部低对比潜纹' },
  leaf_blight:{ precision: 0.7822, recall: 0.8371, measured: false, family: '叶部低对比潜纹' },
  aphid_like: { precision: 0.7822, recall: 0.8371, measured: false, family: '叶部低对比潜纹' },

  loose_smut: { precision: 0.6906, recall: 0.7661, measured: false, family: '穗部潜藏' },
  fusarium:   { precision: 0.6906, recall: 0.7661, measured: false, family: '穗部潜藏' },

  root_rot:   { precision: 0.6016, recall: 0.7021, measured: false, family: '根茎部（空中不可见）' },
};

/** 平台病种 → 工作点键 */
const DISEASE_TO_WP = {
  rust: 'rust',
  powdery: 'powdery',
  leaf_blight: 'leaf_blight',
  loose_smut: 'loose_smut',
  fusarium: 'fusarium',
  root_rot: 'root_rot',
};

/** 取某病种的工作点，未知病种退回最保守的一档 */
export function workingPoint(disease) {
  const key = DISEASE_TO_WP[disease] || 'root_rot';
  return DETECTION_WORKING_POINTS[key];
}

/* ------------------------------------------------------------------ *
 * 检测器校准数据的出处说明（供页面展示，避免把外推说成实测）
 * ------------------------------------------------------------------ */

export const WORKING_POINT_PROVENANCE = {
  rust: '实测（队友实验 out/detection/calibration.json）',
  powdery: '外推 · 叶部低对比潜纹族（按蚜虫工作点）',
  leaf_blight: '外推 · 叶部低对比潜纹族（按蚜虫工作点）',
  loose_smut: '外推 · 穗部潜藏族',
  fusarium: '外推 · 穗部潜藏族',
  root_rot: '外推 · 根茎部（空中不可见，必然复核）',
};

/* ------------------------------------------------------------------ *
 * 斑块级漏检
 * ------------------------------------------------------------------ */

/**
 * 一片病灶被整体漏掉（所有目标全漏）的概率。
 *
 * p_miss = (1 − recall·0.85)^n_targets
 *
 * `nTargets` 是这片病灶里的目标数。
 * 参数 0.85 是队友代码里的经验系数 —— 目标之间并非完全独立，
 * 漏一个会带动周围一起漏（同一张图上挨得近的目标共享特征），
 * 所以实际漏检比独立假设更“成团”。
 *
 * ⚠ 实测标定结果 —— 这个机制在多数情况下**几乎不触发**：
 *
 * 队友实验的真实斑块目标数分布（三个病种 × 18 地块，共 283 个斑块）：
 *   P5 = 84，P25 = 832，中位 = 1396，P95 = 4233
 *
 * 代入上式（以最难检的蚜虫 recall = 0.71 为例）：
 *   n = 84   → p_miss ≈ 3.6e-8
 *   n = 234  → p_miss ≈ 1.4e-18
 *   n = 1396 → p_miss ≈ 0
 *
 * 也就是说：**目标越多，整片全漏越不可能**。
 * 这与直觉相反，但符合机理 —— 目标多时漏掉一个还有几十个，
 * 要让整片消失，概率被 (1−rec·0.85)^n 压到实际为零。
 *
 * 真正会整片漏掉的是**稀疏的小病斑**：
 * 早期发病、病斑零星分布时，一两片小斑块可能整片检不出来。
 * 平台据此保留该机制，但**不夸大它的作用** ——
 * 平台里少给几片小病灶，就会偶发整片漏检。
 */
export function patchMissProbability(recall, nTargets) {
  if (!nTargets || nTargets <= 0) return 0;
  const p = Math.max(0, Math.min(0.995, recall));
  const v = Math.pow(1 - p * 0.85, nTargets);
  // 下溢保护：目标数上千时 Math.pow 会下溢到精确 0，
  // 而「概率恰好为 0」在业务上会被读成「绝不可能发生」。
  // 真实含义是「小于任何可观测的量级」，所以给一个极小下界。
  return v > 0 ? v : 1e-300;
}

/**
 * 斑块级漏检后的实际召回率（相对于理论召回）。
 *
 * 整片漏掉时，该片的所有目标都不算检出，
 * 所以有效召回 = 理论召回 × (1 − p_miss)。
 */
export function effectiveRecall(recall, nTargets) {
  return recall * (1 - patchMissProbability(recall, nTargets));
}

/* ------------------------------------------------------------------ *
 * 误检散布
 * ------------------------------------------------------------------ */

/**
 * 误检率的换算：precision=0.80 时，误报数约为真检出数的 0.25 倍。
 *
 * fp_rate = (1 − precision) / precision
 */
export function falsePositiveRatio(precision) {
  const p = Math.max(0.05, Math.min(0.995, precision));
  return (1 - p) / p;
}

/**
 * 误报的落点权重：越健康的地方越容易误报。
 *
 * 权重 w = 1 − 0.7·severity
 * severity ∈ [0,1]，所以健康格权重 1.0，严重格权重 0.3。
 */
export function falsePositiveWeight(severity) {
  return Math.max(0.05, 1 - 0.7 * Math.max(0, Math.min(1, severity)));
}

/* ------------------------------------------------------------------ *
 * 单次检出的判定
 * ------------------------------------------------------------------ */

/**
 * 一次检出是否成立。
 *
 * 与队友 `detection_map.simulate_detection` 的逻辑对齐：
 * 检出概率 p_det 随严重度上升 —— 稀疏的早期症状比密集的成熟病灶更难发现。
 *
 *   p_det = recall · (0.15 + 0.85 / (1 + exp(−6·(sev − 0.22))))
 *
 * 当 sev=0 时 p_det ≈ recall·0.15（几乎发现不了）；
 * 当 sev=1 时 p_det ≈ recall（应该能发现）。
 *
 * 返回 true 表示这次检出成立。
 *
 * @param {number} recall    病种召回率
 * @param {number} severity  该格严重度 [0,1]
 * @param {function} rng    返回 [0,1) 的随机源
 */
export function detectOccurs(recall, severity, rng) {
  const sev = Math.max(0, Math.min(1, severity));
  const sigmoid = 1 / (1 + Math.exp(-6 * (sev - 0.22)));
  const pDet = recall * (0.15 + 0.85 * sigmoid);
  return rng() < pDet;
}

/**
 * 该格是否为「确诊」—— 置信度高于派单阈值。
 *
 * 平台按 0.75 派单（见 shared/simulator.js 与 linkage.js），
 * 这个阈值决定了一次检出是直接派单还是先送地面复核。
 */
export const CONFIDENCE_DISPATCH = 0.75;

/**
 * 由检测工作点生成一个符合该工作点的置信度。
 *
 * 做法：以 precision 为「高置信度的比例」，在其上取值，
 * 其余落在低置信度区间（会触发地面复核）。
 *
 * @param {number} precision 病种精确率
 * @param {function} rng
 */
export function sampleConfidence(precision, rng) {
  const p = Math.max(0.05, Math.min(0.995, precision));
  if (rng() < p) {
    // 高置信度：0.75 ~ 0.99
    return +(CONFIDENCE_DISPATCH + (0.99 - CONFIDENCE_DISPATCH) * rng()).toFixed(3);
  }
  // 低置信度：0.30 ~ 0.74，会触发地面复核
  return +(0.30 + (CONFIDENCE_DISPATCH - 0.30 - 0.01) * rng()).toFixed(3);
}
