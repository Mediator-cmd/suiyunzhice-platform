/**
 * 图表与地图配色 —— 浅色主题统一出口
 *
 * Recharts 与 Leaflet 的颜色无法走 CSS 变量（canvas/SVG 属性），
 * 这里集中定义一份，保证图表、地图与页面主题始终同色。
 *
 * 配色约束：仅使用绿 / 蓝 / 黄 / 红及其深浅变体，不使用紫色与橙色。
 */

/** 黄色：比琥珀更深，保证白底可读 */
export const YELLOW = '#ca8a04';
/** 红色：比纯红更深，保证白底可读 */
export const RED = '#b91c1c';

export const CHART = {
  /** 坐标轴与网格线 */
  axis: '#7b8f95',
  grid: '#e3eae4',
  /** 图表内 tooltip */
  tooltipBg: '#ffffff',
  tooltipBorder: '#d5dee0',
  tooltipText: '#000000',
  /** 数据系列（按顺序取用，避免紫色与橙色） */
  series: [
    '#0f9d63', // 绿 —— 主色
    '#0284c7', // 天蓝
    YELLOW,    // 黄
    RED,       // 红
    '#0891b2', // 青
    '#65a30d', // 橄榄绿
    '#475569', // 石板灰
  ],
  /** 语义色 */
  green: '#0f9d63',
  blue: '#0284c7',
  amber: YELLOW,
  yellow: YELLOW,
  robot: '#dc2626',
  red: RED,
  purple: RED,
  ink: '#304d50',
};

export const MAP = {
  /** 地块底色与边界 */
  fieldFill: '#eaf4ec',
  fieldStroke: '#7ba888',
  /** 障碍区 */
  obstacleFill: '#eef2f5',
  obstacleStroke: '#64748b',
  /** 航线 */
  route: '#0f9d63',
  routeManual: YELLOW,
  /** 背景 */
  bg: '#f1f5f6',
};

/** 病害配色（浅色背景下加深，保证可读） */
export const DISEASE_COLOR = {
  rust: '#dc2626',        // 锈病 —— 红
  powdery: YELLOW,        // 白粉病 —— 黄
  loose_smut: '#65a30d',  // 散黑穗病 —— 橄榄绿
  root_rot: '#b91c1c',    // 根腐病 —— 深红
  fusarium: '#0284c7',    // 赤霉病 —— 蓝
  leaf_blight: '#64748b', // 叶枯病 —— 石板灰
};
