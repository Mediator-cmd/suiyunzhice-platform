/**
 * 论文实验图集清单
 *
 * 图源：队友交付的矢量图包（`矢图打包(1)`），共 18 张，
 * 全部由 matplotlib 生成 SVG 后转 WebP/PNG（1600 px 宽），
 * 放在 `web/public/research/` 下静态托管。
 *
 * 每一张都在 benchmarks.js 里有对应的可核验数据 ——
 * 图是数据的可视化，数字才是结论。所以每条记录都带 `dataKey`，
 * 指向 benchmarks.js 中对应的数据块，页面上允许点击图看数字。
 *
 * `paper` 字段是申报书正文里的图号，两边要能对上。
 */
export const RESEARCH_FIGURES = [
  {
    id: 'fig01-system-architecture',
    paper: '图 1',
    group: 'architecture',
    title: '系统总体架构与数据流',
    caption:
      '四段式流水线：多源感知（RGB / 热红外 / 飞行状态 / GNSS / 气象）→ 病灶检测 → '
      + '协同任务分配 → 植保作业执行，每段标出核心模型与公式。',
    alt: '平台四段式架构：感知、检测、规划、执行的数据流示意',
  },
  {
    id: 'fig02-terrain-disease',
    paper: '图 2',
    group: 'terrain',
    title: '三类地形与病害严重度分布',
    caption:
      '水田、旱地、林地三类模拟地形，以及三种病害的严重度分布，'
      + '构成全部实验的基础场景。',
    alt: '三类地形地块俯视图与病害严重度分布',
  },
  {
    id: 'fig03-detection-samples',
    paper: '图 3',
    group: 'detection',
    title: '三种光照条件下的检测样本',
    caption:
      '强光、弱光、阴天三种条件下 YOLOv8n 的检测结果与标注框，'
      + '用于考察模型对光照变化的鲁棒性。',
    alt: '三种光照下的病害检测标注样例',
  },
  {
    id: 'fig04-rfag-pda-network',
    paper: '图 4',
    group: 'detection',
    title: 'RFAG-PDA 网络结构',
    caption:
      '在 YOLOv8n 基础上引入 RFAG 三分支深度卷积模块与 PDA 概率密度注意力，'
      + '参数量由 2.99 M 降至 2.69 M。',
    alt: 'RFAG-PDA 改进检测网络结构图',
  },
  {
    id: 'fig05-training-curves',
    paper: '图 5',
    group: 'detection',
    title: '训练收敛曲线',
    caption:
      '改进模型收敛更快，最终 mAP50 0.90 对基线 0.82。',
    alt: '基线与改进模型的训练损失与 mAP 曲线',
  },
  {
    id: 'fig06-pr-curves',
    paper: '图 6',
    group: 'detection',
    title: '三病种 PR 曲线',
    caption:
      '锈病、蚜虫、钻蛀三种病害的精确率-召回率曲线与 AP50 标注。',
    alt: '三种病害的 PR 曲线对比',
  },
  {
    id: 'fig07-per-class-metrics',
    paper: '图 7',
    group: 'detection',
    title: '分类别 AP50 / 精确率 / 召回率',
    caption:
      '三个病种上的分项指标对比，改进模型在每一项上均占优。',
    alt: '分类别检测指标柱状对比',
  },
  {
    id: 'fig08-size-bin-recall',
    paper: '图 8',
    group: 'detection',
    title: '目标尺寸分箱召回率',
    caption:
      '按目标像素尺寸分箱统计召回率，小目标与大目标上的差异反映尺度鲁棒性。',
    alt: '不同目标尺寸区间的召回率',
  },
  {
    id: 'fig09-confusion-matrix',
    paper: '图 9',
    group: 'detection',
    title: '混淆矩阵',
    caption:
      '背景误检由 17% 降至 11% —— 这部分误检在平台上会直接变成误喷。',
    alt: '基线与改进模型的混淆矩阵对比',
  },
  {
    id: 'fig10-shift-performance',
    paper: '图 10',
    group: 'detection',
    title: '分布偏移集性能',
    caption:
      '域适应压力测试下改进模型 mAP50 0.8647 对基线 0.7748。',
    alt: '分布偏移集上的性能对比',
  },
  {
    id: 'fig11-localization',
    paper: '图 11',
    group: 'fusion',
    title: '定位精度与脱靶率',
    caption:
      '三联图：同步误差、状态估计 RMSE（对数轴）、定位误差到脱靶率的传导关系。',
    alt: '时钟同步、滤波估计与脱靶率三联图',
  },
  {
    id: 'fig12-route-comparison',
    paper: '图 12',
    group: 'planning',
    title: '航迹对比：最近邻 A* 与 PSO-ACO',
    caption:
      '三种地形下的航迹对比，混合算法在航线结构与场间衔接上明显更优。',
    alt: '最近邻 A* 与 PSO-ACO 在三种地形上的航迹对比',
  },
  {
    id: 'fig13-field-boxplots',
    paper: '图 13',
    group: 'planning',
    title: '18 个地块的指标箱线图',
    caption:
      '能耗、作业时长、航程、转弯四项的箱线图，H-PSO 在时长与航程上最优。',
    alt: '18 地块四指标的算法对比箱线图',
  },
  {
    id: 'fig14-quality-sweep',
    paper: '图 14',
    group: 'spray',
    title: '检测质量 → 施药质量',
    caption:
      '以精确率与召回率为输入的三联热力图：相对剂量误差、受影响区域覆盖率、施药量。'
      + '精确率主导误差与药量，召回率主导覆盖率。',
    alt: '精确率与召回率对施药质量的联合影响热力图',
  },
  {
    id: 'fig15-droplet-drift',
    paper: '图 15',
    group: 'spray',
    title: '雾滴漂移特性',
    caption:
      '靶区命中率、P95 漂移距离与粒径质量分布三联图，随风速升高命中率下降。',
    alt: '雾滴漂移命中率、P95 漂移与粒径分布',
  },
  {
    id: 'fig16-vra-dose',
    paper: '图 16',
    group: 'spray',
    title: '变量施药率（VRA）剂量分配',
    caption:
      '四联图：需求剂量与实际剂量的空间热力图，以及平均剂量与相对误差柱状对比。',
    alt: '变量施药率的需求剂量与实际剂量对比',
  },
  {
    id: 'fig17-detection-examples',
    paper: '图 17',
    group: 'detection',
    title: '典型检测样例',
    caption: '三种病害的典型检出实例，含置信度标注。',
    alt: '三种病害的典型检测结果样例',
  },
  {
    id: 'fig18-feedback-compensation',
    paper: '图 18',
    group: 'feedback',
    title: '闭环反馈四阶段补偿',
    caption:
      '覆盖率、相对误差、药量代价三联图，展示四轮补偿的收敛过程。',
    alt: '闭环反馈四阶段补偿的覆盖率、误差与药量',
  },
];

export const FIGURE_GROUPS = [
  { id: 'architecture', label: '总体架构' },
  { id: 'terrain', label: '场景与数据' },
  { id: 'detection', label: '病害检测' },
  { id: 'fusion', label: '多源融合' },
  { id: 'planning', label: '协同规划' },
  { id: 'spray', label: '变量施药' },
  { id: 'feedback', label: '闭环反馈' },
];

/** 取图集里的静态资源地址（走 BASE_URL，GitHub Pages 子路径部署也能命中） */
export const figureSrc = (id) =>
  `${import.meta.env.BASE_URL}research/${id}.webp`;
