/**
 * 导航图标库 —— 24×24 单色描边
 *
 * 与 components/Icons.jsx 是两套东西，别混：
 *   Icons.jsx     —— 48×48 手绘线稿示意图标，用于架构页 / 联动链 / 能力卡
 *                     笔画 2.2px，带大量细节，是"图"不是"图标"
 *   NavIcon.jsx   —— 24×24 极简几何图标，用于侧边栏与顶栏
 *                     笔画 1.5px、统一 16px 栅格，是"导航标记"
 *
 * 设计约束（对齐 _设计稿/样式图.html）：
 *   - 统一 1.5px 描边、圆头圆角、无填充
 *   - 24×24 视窗，默认渲染 16px
 *   - 颜色跟随 currentColor，不写死色值
 *   - 不引入任何紫 / 橙语义色
 *
 * 为什么单独建文件而不是往 Icons.jsx 里塞：
 *   Icons.jsx 是 48 视窗、2.2 笔宽，塞 24 视窗的图标进去会让
 *   那里的 strokeWidth 基准变得不一致，架构页的示意图会走样。
 */

const PATHS = {
  /* ---------- 作战指挥 ---------- */

  /** 任务调度：四宫格 */
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),

  /** 实时监控：雷达同心圆 + 扫描线 */
  radar: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 12l6-5" />
    </>
  ),

  /** 空地联动：两段链环 */
  link: (
    <>
      <path d="M10 13a5 5 0 007.5.5l2-2a5 5 0 00-7-7l-1.1 1.1" />
      <path d="M14 11a5 5 0 00-7.5-.5l-2 2a5 5 0 007 7l1.1-1.1" />
    </>
  ),

  /** 装备操控台：遥控器摇杆 */
  console: (
    <>
      <rect x="3" y="7" width="18" height="12" rx="3" />
      <path d="M8 11v3M6.5 12.5h3" />
      <circle cx="16" cy="11.5" r="1.6" />
      <circle cx="18.5" cy="15" r="1.6" />
    </>
  ),

  /* ---------- 智能决策 ---------- */

  /** 数据分析：折线 + 坐标轴 */
  chart: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),

  /** 农情与策略：麦叶 */
  leaf: (
    <>
      <path d="M4 20c0-8 5-13 16-14 0 11-5 15-11 15-2.5 0-5-1-5-1z" />
      <path d="M9 15c1.5-3 4-5 7-6" />
    </>
  ),

  /** 路径规划：起点终点 + 连线 */
  route: (
    <>
      <circle cx="6" cy="18" r="2.5" />
      <circle cx="18" cy="6" r="2.5" />
      <path d="M8.5 18H13a4 4 0 004-4V8.5" />
    </>
  ),

  /** 处方图：地图折叠 */
  map: (
    <>
      <path d="M3 6.5l6-2.5 6 2.5 6-2.5v13.5l-6 2.5-6-2.5-6 2.5z" />
      <path d="M9 4v13.5M15 6.5V20" />
    </>
  ),

  /* ---------- 平台底座 ---------- */

  /** 租户与权限：盾 */
  shield: (
    <>
      <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" />
    </>
  ),

  /** 设备接入：插头 */
  plug: (
    <>
      <path d="M9 3v6M15 3v6M6 9h12v3a6 6 0 01-6 6 6 6 0 01-6-6zM12 18v3" />
    </>
  ),

  /** 开发者门户：代码括号 */
  code: (
    <>
      <path d="M9 7l-5 5 5 5M15 7l5 5-5 5" />
    </>
  ),

  /** 计量结算：齿轮 */
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </>
  ),

  /* ---------- 交付与说明 ---------- */

  /** 三端联动：手机 */
  phone: (
    <>
      <rect x="7" y="2" width="10" height="20" rx="2.5" />
      <path d="M11 18.5h2" />
    </>
  ),

  /** 平台方案：文档 */
  doc: (
    <>
      <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </>
  ),

  /* ---------- 顶栏 / 通用 ---------- */

  /** 搜索：放大镜 */
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>
  ),

  /** 通知：铃 */
  bell: (
    <>
      <path d="M6 9a6 6 0 1112 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6z" />
      <path d="M10 19a2 2 0 004 0" />
    </>
  ),

  /** 图层：底图切换 */
  layers: (
    <>
      <path d="M12 3l9 5-9 5-9-5z" />
      <path d="M3 13l9 5 9-5" />
    </>
  ),

  /** 告警：三角 */
  alert: (
    <>
      <path d="M12 4l9 16H3z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),

  /** 时钟 */
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5.5l3.5 2" />
    </>
  ),

  /** 加号 */
  plus: <path d="M12 5v14M5 12h14" />,

  /** 勾 */
  check: <path d="M4 12.5l5 5L20 6.5" />,
};

/**
 * 导航图标
 *
 * @param {string} name  PATHS 里的键
 * @param {number} size  渲染边长，默认 16（设计稿栅格）
 */
export default function NavIcon({ name, size = 16, className, style, ...rest }) {
  const body = PATHS[name];
  if (!body) return null;
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.5"
      strokeLinecap="round" strokeLinejoin="round"
      className={className}
      style={{ display: 'block', flexShrink: 0, ...style }}
      aria-hidden="true"
      {...rest}
    >
      {body}
    </svg>
  );
}

export const NAV_ICON_NAMES = Object.keys(PATHS);
