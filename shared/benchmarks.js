/**
 * 算法基准库 —— 把队友交付的 Python 研究实验结果固化为平台可查询的数据。
 *
 * 来源：队友交付的「代码数据打包11.24」中的 out/ 与 runs/ 目录：
 *   out/detection/*.json   YOLOv8n 基线 vs RFAG-PDA 改进模型的检测指标
 *   out/detection/calibration.json  三类病害的实测精确率/召回率
 *   out/planning/plan_*.json        5 种规划器在 18 个地块上的对比
 *   out/fusion/fusion.json          多传感器同步、滤波、热成像、定位精度
 *   out/spray/vra.csv               变量施药 vs 恒量施药
 *   out/spray/drift.csv             雾滴漂移（粒径 × 风速）
 *   out/spray/quality_sweep.csv     检测质量 → 施药质量敏感性
 *   out/feedback/feedback.csv       两趟作业 + 沉积反馈闭环
 *
 * 为什么固化而不是现场跑：
 *   这些实验依赖 numpy/scipy/torch 与训练权重（best.pt），
 *   平台是纯 JS 运行时（Node / Worker / 浏览器），跑不了 Python。
 *   但实验**结论**必须能在平台上被查、被引用、被答辩现场复现 ——
 *   所以这里把已经跑完的实验结果作为**确定性数据集**固化，
 *   平台只做展示与引用，不重新计算。
 *
 * 诚实性纪律（重要）：
 *   1. 这些是**离线研究实验**的结论，与平台的实时演示数据是两套东西，
 *      平台界面必须标明「离线实验基准」，不得混为一谈。
 *   2. 检测基准的 mAP50 是**渲染冠层数据集**上的结果（data/dataset 为合成数据），
 *      不是田间实测；表述时要写清楚。
 *   3. 平台自身的**实时**检测指标（/api/analytics/overview 的 avgConfidence
 *      等）来自模拟器，与本模块无关。
 */

/** 检测模型对照：YOLOv8n 基线 vs RFAG-PDA 改进模型 */
export const DETECTION_BENCHMARK = {
  id: 'rfag-pda-2026-11',
  title: '检测模型对照实验',
  desc: '在同一渲染冠层数据集上训练与评测，基线为 YOLOv8n，改进模型加入 RFAG 多分支感受野与 PDA 概率密度注意力。',
  dataset: {
    name: '渲染冠层数据集（合成）',
    note: '由 synth_canopy.py 程序化渲染生成，非田间实拍；含三类病害与三个生育期。',
    valImages: 320,
    testImages: 400,
    shiftImages: 300,
  },
  models: [
    {
      id: 'baseline',
      name: 'YOLOv8n（基线）',
      paramsM: 2.990825,
      note: '标准 YOLOv8n 结构，未做任何改动。',
    },
    {
      id: 'rfag_pda',
      name: 'RFAG-PDA（本文）',
      paramsM: 2.693749,
      note: '参数量反而减少 10.0%（2.99M → 2.69M）：RFAG 用深度可分离分支替代部分卷积，'
        + 'PDA 是轻量的概率密度注意力。',
    },
  ],
  /** 按划分与病种的指标 */
  results: [
    {
      split: 'val', splitName: '验证集',
      perClass: [
        { disease: 'rust', name: '锈病', ap50: 0.9103, precision: 0.7863, recall: 0.9109, nGt: 404 },
        { disease: 'aphid', name: '蚜虫', ap50: 0.8628, precision: 0.7795, recall: 0.8571, nGt: 301 },
        { disease: 'borer', name: '钻蛀', ap50: 0.8848, precision: 0.8350, recall: 0.8564, nGt: 195 },
      ],
      map50: 0.8860,
      baselineMap50: 0.8109,
      inferMs: 375.4,
      baselineInferMs: 259.7,
    },
    {
      split: 'test', splitName: '测试集',
      perClass: [
        { disease: 'rust', name: '锈病', ap50: 0.9394, precision: 0.8038, recall: 0.9393, nGt: 445 },
        { disease: 'aphid', name: '蚜虫', ap50: 0.8299, precision: 0.7822, recall: 0.8371, nGt: 399 },
        { disease: 'borer', name: '钻蛀', ap50: 0.9100, precision: 0.9045, recall: 0.8767, nGt: 227 },
      ],
      map50: 0.8931,
      baselineMap50: 0.8304,
      inferMs: 268.8,
      baselineInferMs: 155.1,
    },
    {
      split: 'shift', splitName: '分布偏移集（域适应压力测试）',
      perClass: [
        { disease: 'rust', name: '锈病', ap50: 0.8786, precision: 0.6785, recall: 0.8831, nGt: 325 },
        { disease: 'aphid', name: '蚜虫', ap50: 0.6470, precision: 0.6151, recall: 0.6500, nGt: 300 },
        { disease: 'borer', name: '钻蛀', ap50: 0.7987, precision: 0.7586, recall: 0.7630, nGt: 173 },
      ],
      map50: 0.7748,
      baselineMap50: 0.7748,
      inferMs: 250.0,
      baselineInferMs: 250.0,
      note: '偏移集上基线与改进模型同分（该实验仅对基线做了偏移评测），'
        + '改进模型的偏移评测未在本批数据中给出 —— 引用时须如实说明。',
    },
  ],
  /** 三类病害的实测精确率/召回率（test 集），用于把检测误差传递到田块级结果 */
  calibration: {
    rust: { precision: 0.8038, recall: 0.9393 },
    aphid: { precision: 0.7822, recall: 0.8371 },
    borer: { precision: 0.9045, recall: 0.8767 },
  },
  /** 尺寸分箱召回率（val 集，改进模型）—— 小目标仍是难点 */
  sizeBins: [
    { label: '< 8 px', recall: 0.500, n: 2 },
    { label: '8–14 px', recall: 0.800, n: 5 },
    { label: '14–22 px', recall: 0.857, n: 7 },
    { label: '22–32 px', recall: 0.952, n: 21 },
    { label: '≥ 32 px', recall: 0.955, n: 864 },
  ],
};

/** 规划器对照：5 种算法在 18 个地块上的均值 */
export const PLANNING_BENCHMARK = {
  id: 'swarm-planning-2026-11',
  title: '多机协同规划器对照实验',
  desc: '在 18 个仿真地块（平坦 / 梯田 / 复杂地形三类，风速风向随机）上，'
    + '对比 5 种任务分配算法在总航程、作业时长、能耗、转弯次数上的表现。',
  fields: 18,
  terrainClasses: ['平坦', '梯田', '复杂'],
  metrics: [
    { key: 'length_sum', name: '总航程', unit: 'm', better: 'low' },
    { key: 'time_sum', name: '总作业时长', unit: 's', better: 'low' },
    { key: 'makespan', name: '最长单机架次', unit: 's', better: 'low' },
    { key: 'energy_Wh', name: '总能耗', unit: 'Wh', better: 'low' },
    { key: 'turns', name: '转弯次数', unit: '次', better: 'low' },
  ],
  planners: [
    { id: 'nearest', name: '最近邻均分', length_sum: 2084, time_sum: 810, makespan: 258, energy_Wh: 1968, turns: 198, coverage: 0.957, overspray: 0.693 },
    { id: 'ga', name: '遗传算法 GA', length_sum: 2034, time_sum: 836, makespan: 292, energy_Wh: 2009, turns: 211, coverage: 0.957, overspray: 0.693 },
    { id: 'pso', name: '粒子群 PSO', length_sum: 1873, time_sum: 765, makespan: 290, energy_Wh: 1838, turns: 190, coverage: 0.957, overspray: 0.693 },
    { id: 'aco', name: '蚁群 ACO', length_sum: 1794, time_sum: 689, makespan: 219, energy_Wh: 1674, turns: 164, coverage: 0.957, overspray: 0.693 },
    { id: 'pso_aco', name: 'PSO-ACO 混合（本文）', length_sum: 1814, time_sum: 696, makespan: 215, energy_Wh: 1692, turns: 165, coverage: 0.957, overspray: 0.693 },
  ],
  conclusion: '两阶段混合（PSO 分配任务 + ACO 精修路径）在「最长单机架次」与转弯次数上最优，'
    + '总航程与 ACO 接近但总能耗略高 —— 说明混合算法的优势在于**负载均衡**而非单纯缩短航程。',
};

/** 多传感器融合实验：同步精度、滤波误差、热成像融合、定位精度 */
export const FUSION_BENCHMARK = {
  id: 'multisensor-fusion-2026-11',
  title: '多传感器融合实验',
  desc: '50 Hz 惯性回路，120 s 典型喷洒航迹，四类配置的对比。',
  /** 时间同步误差（越低越好） */
  timing: {
    name: '多机时间同步',
    metric: '同步误差（按 4.5 m/s 折算为机载位置偏差）',
    rows: [
      { id: 'none', name: '不同步（各自时钟）', meanMs: 7.24, p95M: 0.080, meanM: 0.033 },
      { id: 'software', name: '软件触发同步', meanMs: 2.66, p95M: 0.030, meanM: 0.012 },
      { id: 'hardware', name: '硬件脉冲同步', meanMs: 0.99, p95M: 0.011, meanM: 0.004 },
    ],
    conclusion: '硬件脉冲同步把平均同步误差压到 1.0 ms 以内，'
      + '对应机载位置偏差均值 4.5 mm —— 这是三端联动时延能做到秒级以下的前提。',
  },
  /** 状态估计：卡尔曼滤波位置 RMSE */
  filter: {
    name: '位置估计误差（卡尔曼滤波 RMSE）',
    unit: 'm',
    rows: [
      { id: 'gnss', name: '仅 GNSS', rmse: 5.616 },
      { id: 'gnss_imu', name: 'GNSS + IMU', rmse: 0.607 },
      { id: 'gnss_imu_lidar', name: 'GNSS + IMU + LiDAR 融合', rmse: 0.084 },
    ],
    conclusion: '三源融合把位置误差从 5.62 m 压到 0.084 m（67 倍），'
      + '是靶向施药能命中 1 m 窄幅喷施机构的定位前提。',
  },
  /** 热成像与 RGB 融合 */
  thermal: {
    name: 'RGB / 热成像 / 融合估计的病害严重度 RMSE',
    rows: [
      { id: 'rgb', name: '仅 RGB', rmse: 0.201 },
      { id: 'thermal', name: '仅热成像', rmse: 0.293 },
      { id: 'fused', name: 'RGB + 热成像加权融合', rmse: 0.185 },
    ],
    corrThermal: -0.820,
    note: '冠层温度与严重度相关系数 −0.820（蒸腾随侵染加剧而降低冠层温度），'
      + '融合估计误差比单 RGB 低 8.1%，比单热成像低 37.0%。',
  },
  /** 定位精度对脱靶率的影响 */
  placement: {
    name: '定位精度 → 脱靶率',
    swathM: 2.0,
    rows: [
      { id: 'gps', name: '仅 GPS', rmse: 1.20, offtarget: 0.4032, p95: 2.941 },
      { id: 'gnss_imu', name: 'GNSS + IMU', rmse: 0.55, offtarget: 0.0687, p95: 1.347 },
      { id: 'fused', name: 'GNSS/IMU/LiDAR 融合', rmse: 0.22, offtarget: 0.000005, p95: 0.540 },
    ],
    note: '仅 GPS 时 40.3% 的喷洒面积落在靶区之外；'
      + '三源融合后脱靶率降到 5×10⁻⁶（万分之零点五）。',
  },
};

/** 喷洒沉积实验：变量施药 vs 恒量施药 */
export const SPRAY_BENCHMARK = {
  id: 'variable-rate-2026-11',
  title: '变量施药与雾滴沉积实验',
  /** 变量施药 vs 恒量施药（18 个地块均值） */
  vra: {
    name: '变量施药 vs 恒量施药',
    rows: [
      { id: 'vra', name: '变量施药 VRA', volume: 0.063, under: 0.001, over: 0.001, relErr: 0.166, coverage: 0.801 },
      { id: 'constant', name: '恒量施药', volume: 0.263, under: 0.244, over: 0.000, relErr: 0.418, coverage: 1.000 },
    ],
    note: '变量施药把总用量压到恒量施药的 24.0%，'
      + '同时把「低于需求一半」的欠喷格比例从 24.4% 降到 0.1%；'
      + '代价是覆盖率从 100% 降到 80.1%（未覆盖的是判定为无需施药的区域）。',
  },
  /** 雾滴漂移：粒径 × 风速 → 靶区命中率 */
  drift: {
    name: '雾滴靶区命中率（粒径 VMD × 风速）',
    vmdLevels: [110, 140, 170],
    windLevels: [0, 1, 2, 3, 4, 5, 6, 7],
    rows: [
      // [vmd][wind] → on_target
      [1.000, 0.978, 0.864, 0.783, 0.724, 0.536, 0.267, 0.091],
      [1.000, 0.991, 0.899, 0.804, 0.748, 0.605, 0.369, 0.153],
      [1.000, 0.996, 0.923, 0.820, 0.759, 0.647, 0.444, 0.210],
    ],
    note: '风速 5 m/s 时，即使把雾滴中径放大到 170 μm，靶区命中率也只有 64.7%。'
      + '这是平台「风速超阈值即不建议施药」规则的数据依据。',
  },
  /** 检测质量 → 施药质量的敏感性 */
  quality: {
    name: '检测质量对施药质量的影响（25 组精确率×召回率组合）',
    combos: 25,
    rows: [
      { precision: 0.55, recall: 0.55, volume: 0.067, under: 0.000, over: 0.002, coverage: 0.747, relErr: 0.209 },
      { precision: 0.55, recall: 0.75, volume: 0.105, under: 0.000, over: 0.002, coverage: 0.804, relErr: 0.209 },
      { precision: 0.55, recall: 0.95, volume: 0.150, under: 0.000, over: 0.002, coverage: 0.866, relErr: 0.209 },
      { precision: 0.85, recall: 0.55, volume: 0.040, under: 0.000, over: 0.000, coverage: 0.701, relErr: 0.177 },
      { precision: 0.85, recall: 0.75, volume: 0.042, under: 0.000, over: 0.000, coverage: 0.727, relErr: 0.169 },
      { precision: 0.85, recall: 0.95, volume: 0.044, under: 0.000, over: 0.000, coverage: 0.741, relErr: 0.165 },
      { precision: 0.95, recall: 0.55, volume: 0.041, under: 0.000, over: 0.000, coverage: 0.696, relErr: 0.151 },
      { precision: 0.95, recall: 0.75, volume: 0.042, under: 0.000, over: 0.000, coverage: 0.722, relErr: 0.149 },
      { precision: 0.95, recall: 0.95, volume: 0.044, under: 0.000, over: 0.000, coverage: 0.737, relErr: 0.142 },
    ],
    note: '精确率是主导因素：精确率从 0.55 提到 0.95，用药量降到 1/3；'
      + '召回率主要影响覆盖率（0.747 → 0.866）。'
      + '这与平台「置信度 ≥ 0.75 才算确诊」的门限设计一致。',
  },
  /** 沉积反馈闭环：四阶段补偿 */
  feedback: {
    name: '沉积反馈闭环（四阶段补偿）',
    windMean: 3.96,
    effMean: 0.702,
    rows: [
      { id: 'none', name: '① 不补偿', coverage: 0.4295, relErr: 0.5374, volume: 0.0627 },
      { id: 'rate', name: '② 仅速率补偿', coverage: 0.6366, relErr: 0.3830, volume: 0.0899 },
      { id: 'rate_aim', name: '③ 速率补偿 + 逆风瞄准', coverage: 0.7024, relErr: 0.3338, volume: 0.0893 },
      { id: 'feedback', name: '④ 再加一趟反馈补喷', coverage: 0.9777, relErr: 0.1476, volume: 0.3739 },
    ],
    note: '④ 阶段把覆盖率从 42.9% 提到 97.8%，相对误差从 53.7% 降到 14.8%；'
      + '但药量增至 3.74 倍 —— 反馈补喷的代价是显著的。'
      + '这正是平台「先确认再喷、缺量再补」的两趟作业策略的实验依据。',
  },
};

/** 全部基准的索引（供接口按 id 取用） */
export const BENCHMARKS = {
  detection: DETECTION_BENCHMARK,
  planning: PLANNING_BENCHMARK,
  fusion: FUSION_BENCHMARK,
  spray: SPRAY_BENCHMARK,
};

/** 基准清单（前端目录页用） */
export function benchmarkCatalog() {
  return Object.entries(BENCHMARKS).map(([key, b]) => ({
    key,
    id: b.id,
    title: b.title,
    desc: b.desc,
  }));
}

/**
 * 平台自有的协同规划实时结果（shared/swarm.js 现算），
 * 与离线基准并置展示 —— 前端要能区分「实测基准」与「离线实验基准」。
 */
export function benchmarkNotice() {
  return {
    label: '离线实验基准',
    desc: '以下数据来自队友交付的研究代码在仿真数据上的离线实验，'
      + '在平台内为固化数据集（只读、可查询、可引用），'
      + '与平台实时演示数据相互独立。',
    source: '代码数据打包11.24 · out/ 与 runs/',
  };
}
