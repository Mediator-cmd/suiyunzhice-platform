/**
 * 图表与地图配色 —— 浅色主题统一出口
 *
 * Recharts 与 Leaflet 的颜色无法走 CSS 变量（canvas/SVG 属性），
 * 这里集中定义一份，保证图表、地图与页面主题始终同色。
 */

export const CHART = {
  /** 坐标轴与网格线 */
  axis: '#7b8f95',
  grid: '#e3eae4',
  /** 图表内 tooltip */
  tooltipBg: '#ffffff',
  tooltipBorder: '#d5dee0',
  tooltipText: '#21353a',
  /** 数据系列 */
  series: [
    '#0f9d63', // 绿 —— 主色
    '#0284c7', // 天蓝
    '#7c3aed', // 紫
    '#d97706', // 琥珀
    '#dc2626', // 红
    '#ea580c', // 橙
    '#db2777', // 玫红
  ],
  /** 语义色 */
  green: '#0f9d63',
  blue: '#0284c7',
  amber: '#d97706',
  red: '#dc2626',
  purple: '#7c3aed',
  ink: '#304d50',
};

export const MAP = {
  /** 地块底色与边界 */
  fieldFill: '#eaf4ec',
  fieldStroke: '#7ba888',
  /** 障碍区 */
  obstacleFill: '#ede9fe',
  obstacleStroke: '#8b5cf6',
  /** 航线 */
  route: '#0f9d63',
  routeManual: '#d97706',
  /** 背景 */
  bg: '#f1f5f6',
};

/** 病害配色（浅色背景下加深，保证可读） */
export const DISEASE_COLOR = {
  rust: '#ea580c',        // 锈病 —— 橙
  powdery: '#db2777',     // 白粉病 —— 玫红
  loose_smut: '#65a30d',  // 散黑穗病 —— 橄榄绿
  root_rot: '#dc2626',    // 根腐病 —— 红
  fusarium: '#d97706',    // 赤霉病 —— 琥珀
  leaf_blight: '#64748b', // 叶枯病 —— 灰蓝
};
