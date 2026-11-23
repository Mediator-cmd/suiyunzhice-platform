/**
 * 图表与地图配色 —— 浅色主题统一出口
 *
 * Recharts 与 Leaflet 的颜色无法走 CSS 变量（canvas/SVG 属性），
 * 这里集中定义一份，保证图表、地图与页面主题始终同色。
 *
 * 配色约束（与 styles.css 一致）：
 *   - 不用紫色、橙色系语义色；
 *   - 只有蓝（平台/无人机）、青绿（农业/成功）、琥珀（预警）、红（危险）、石板灰（次要）；
 *   - 全部为不透明实色，不用 rgba 半透明（避免叠色失真）。
 */

/** 琥珀：比纯橙更深，保证白底可读 */
export const AMBER = '#b54708';
/** 红：保证白底可读 */
export const RED = '#b42318';
/** 蓝：平台主色 */
export const BLUE = '#0b6bcb';
/** 青绿：农业语义 / 成功 */
export const TEAL = '#0f766e';

export const CHART = {
  /** 坐标轴与网格线 */
  axis: '#6b7684',
  grid: '#e4e8ed',
  /** 图表内 tooltip */
  tooltipBg: '#ffffff',
  tooltipBorder: '#d7dce3',
  tooltipText: '#12161c',
  /** 数据系列（按顺序取用，避免紫色与橙色） */
  series: [
    TEAL,     // 青绿 —— 主色
    BLUE,     // 蓝
    AMBER,    // 琥珀
    RED,      // 红
    '#0e7c86', // 深青
    '#5a6472', // 石板灰
    '#3f7d4f', // 墨绿
  ],
  /** 语义色 */
  green: TEAL,
  blue: BLUE,
  amber: AMBER,
  yellow: AMBER,
  robot: '#5a6472',
  red: RED,
  purple: RED,
  ink: '#1d2430',
};

export const MAP = {
  /** 地块底色与边界 */
  fieldFill: '#eaf1e9',
  fieldStroke: '#5f7a63',
  /** 障碍区 */
  obstacleFill: '#e9ebee',
  obstacleStroke: '#2b3442',
  /** 航线 */
  route: '#0f766e',
  routeManual: AMBER,
  /** 背景 */
  bg: '#e8ecef',
};

/** 病害配色（浅色背景下加深，保证可读） */
export const DISEASE_COLOR = {
  rust: '#c0392b',         // 锈病 —— 红
  powdery: AMBER,          // 白粉病 —— 琥珀
  loose_smut: '#5f8a2f',   // 散黑穗病 —— 草绿
  root_rot: RED,           // 根腐病 —— 深红
  fusarium: BLUE,          // 赤霉病 —— 蓝
  leaf_blight: '#5a6472',  // 叶枯病 —— 石板灰
};
