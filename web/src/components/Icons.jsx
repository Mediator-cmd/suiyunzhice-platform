import React from 'react';

/**
 * 平台示意图标库 —— 全部为内联 SVG 手绘线稿
 *
 * 为什么不用 emoji / 字体图标：
 *  - emoji 在不同系统上字形差异大，且无法控制配色，评审现场容易显得「不像示意图」；
 *  - 内联 SVG 可随字号缩放、跟随主题色，且在离线 / 内网环境下不会丢图标。
 *
 * 风格约定：24×24 或 48×48 视窗、单色描边（currentColor）、圆头圆角，
 * 与参考图的扁平线稿风格一致。
 */

/**
 * 通用画布
 *
 * 这里的 fill / stroke 三个属性是整个图标库的样式基础，不能省：
 *   fill="none"          —— SVG 默认 fill 是黑色，不置 none 的话每个
 *                            <rect> / <path> 都会被涂成实心黑块
 *   stroke="currentColor" —— 线稿颜色跟随调用方传入的 color
 *   strokeWidth="2.2"     —— 统一线宽；strokeLinecap/LineJoin 做圆头圆角
 * 子元素里显式写了 fill="currentColor" 的（如病斑小圆点）会覆盖这里的 none。
 */
export function Icon({ size = 30, viewBox = '0 0 48 48', children, style, ...rest }) {
  return (
    <svg
      width={size} height={size} viewBox={viewBox}
      fill="none" stroke="currentColor" strokeWidth="2.2"
      strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'block', flexShrink: 0, overflow: 'visible', ...style }}
      {...rest}
    >
      {children}
    </svg>
  );
}

/* ---------------- 感知层 ---------------- */

/** 植保无人机：四旋翼 + 药箱 + 云台相机 + 下方喷洒 */
export function IconDrone({ size = 30, color = 'currentColor' }) {
  return (
    <Icon size={size} style={{ color }}>
      {/* 药箱 */}
      <rect x="19" y="12.5" width="10" height="6" rx="2" />
      {/* 机身 */}
      <rect x="15" y="18" width="18" height="10" rx="3.5" />
      {/* 四条机臂 */}
      <line x1="16.5" y1="20.5" x2="10" y2="15" />
      <line x1="31.5" y1="20.5" x2="38" y2="15" />
      <line x1="16.5" y1="25.5" x2="10" y2="31" />
      <line x1="31.5" y1="25.5" x2="38" y2="31" />
      {/* 四个旋翼 */}
      <circle cx="9" cy="14" r="3.2" />
      <circle cx="39" cy="14" r="3.2" />
      <circle cx="9" cy="32" r="3.2" />
      <circle cx="39" cy="32" r="3.2" />
      <line x1="3.6" y1="14" x2="14.4" y2="14" />
      <line x1="33.6" y1="14" x2="44.4" y2="14" />
      <line x1="3.6" y1="32" x2="14.4" y2="32" />
      <line x1="33.6" y1="32" x2="44.4" y2="32" />
      {/* 云台相机 */}
      <path d="M21 28 L20 32 L28 32 L27 28" />
      <circle cx="24" cy="35" r="4" />
      <circle cx="24" cy="35" r="1.4" fill="currentColor" stroke="none" />
      {/* 喷洒 */}
      <line x1="20" y1="41" x2="18" y2="46" strokeDasharray="2 2.5" />
      <line x1="24" y1="41" x2="24" y2="47" strokeDasharray="2 2.5" />
      <line x1="28" y1="41" x2="30" y2="46" strokeDasharray="2 2.5" />
    </Icon>
  );
}

/** 地面监测机器人：四轮底盘 + 云台相机 + 天线 */
export function IconRobot({ size = 30, color = 'currentColor' }) {
  return (
    <Icon size={size} style={{ color }}>
      {/* 相机云台 */}
      <rect x="18" y="7" width="13" height="7" rx="2.5" />
      <circle cx="31.5" cy="10.5" r="2.2" />
      <line x1="24" y1="14" x2="24" y2="21" />
      {/* 天线 */}
      <line x1="33" y1="21" x2="39" y2="11" />
      <circle cx="39.5" cy="10" r="1.8" />
      {/* 底盘 */}
      <rect x="8" y="21" width="32" height="11" rx="3" />
      <line x1="18" y1="21" x2="18" y2="32" strokeDasharray="3 3" />
      <line x1="30" y1="21" x2="30" y2="32" strokeDasharray="3 3" />
      {/* 车轮 */}
      <circle cx="14" cy="36" r="5" />
      <circle cx="34" cy="36" r="5" />
      <circle cx="14" cy="36" r="1.6" />
      <circle cx="34" cy="36" r="1.6" />
      {/* 地面 */}
      <line x1="4" y1="43" x2="44" y2="43" strokeDasharray="4 3" />
    </Icon>
  );
}

/** 麦株 / 病斑部位：冠层 + 叶下 + 根茎 */
export function IconPlant({ size = 30, color = 'currentColor' }) {
  return (
    <Icon size={size} style={{ color }}>
      {/* 主茎 */}
      <line x1="24" y1="44" x2="24" y2="14" />
      {/* 穗子 */}
      <path d="M24 6 L24 14" />
      <ellipse cx="24" cy="9" rx="3.2" ry="5" />
      <path d="M20.8 12 L20.8 8" /><path d="M27.2 12 L27.2 8" />
      {/* 叶片 */}
      <path d="M24 30 C 17 30, 12 26, 11 20 C 18 20, 23 24, 24 30 Z" />
      <path d="M24 34 C 31 34, 36 30, 37 24 C 30 24, 25 28, 24 34 Z" />
      {/* 土壤 */}
      <path d="M6 44 L42 44" />
      <path d="M14 44 L14 39" /><path d="M34 44 L34 39" />
      {/* 病斑 */}
      <circle cx="18" cy="23" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="31" cy="27" r="1.6" fill="currentColor" stroke="none" />
    </Icon>
  );
}

/* ---------------- 传输层 ---------------- */

/** WebSocket 长连接：双向波纹 */
export function IconSocket({ size = 30, color = 'currentColor' }) {
  return (
    <Icon size={size} style={{ color }}>
      <circle cx="24" cy="24" r="5" />
      <path d="M30.5 17.5 A 9 9 0 0 1 30.5 30.5" />
      <path d="M36 12 A 16 16 0 0 1 36 36" />
      <path d="M17.5 17.5 A 9 9 0 0 0 17.5 30.5" />
      <path d="M12 12 A 16 16 0 0 0 12 36" />
    </Icon>
  );
}

/** HTTP 批量补传：云端桶 + 上行箭头 */
export function IconBatch({ size = 30, color = 'currentColor' }) {
  return (
    <Icon size={size} style={{ color }}>
      <path d="M12 24 a 7 7 0 0 1 1.4 -13.8 a 9 9 0 0 1 17.2 2 a 6.5 6.5 0 0 1 -0.6 12.9 z" />
      <line x1="24" y1="44" x2="24" y2="30" />
      <path d="M18.5 35.5 L24 30 L29.5 35.5" />
      <rect x="8" y="38" width="32" height="6" rx="2" />
    </Icon>
  );
}

/** MQTT 消息代理：中心节点 + 订阅端 */
export function IconBroker({ size = 30, color = 'currentColor' }) {
  return (
    <Icon size={size} style={{ color }}>
      <rect x="18" y="18" width="12" height="12" rx="3" />
      <circle cx="24" cy="24" r="2.4" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="3.4" />
      <circle cx="39" cy="12" r="3.4" />
      <circle cx="9" cy="36" r="3.4" />
      <circle cx="39" cy="36" r="3.4" />
      <line x1="12" y1="14" x2="19" y2="21" />
      <line x1="36" y1="14" x2="29" y2="21" />
      <line x1="12" y1="34" x2="19" y2="27" />
      <line x1="36" y1="34" x2="29" y2="27" />
    </Icon>
  );
}

/* ---------------- 云端层 ---------------- */

/** 云端服务：云 + 服务器机架 */
export function IconCloudServer({ size = 30, color = 'currentColor' }) {
  return (
    <Icon size={size} style={{ color }}>
      <path d="M13 32 a 8 8 0 0 1 1.6 -15.9 a 10 10 0 0 1 19 2.2 a 7.5 7.5 0 0 1 -0.7 14.2 z" />
      <rect x="16" y="19" width="16" height="9" rx="1.6" />
      <line x1="16" y1="23.5" x2="32" y2="23.5" />
      <circle cx="19" cy="21.2" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="19" cy="26" r="0.9" fill="currentColor" stroke="none" />
      <line x1="24" y1="32" x2="24" y2="38" />
      <line x1="19" y1="38" x2="29" y2="38" />
    </Icon>
  );
}

/** 联动决策引擎：齿轮 + 判据 */
export function IconEngine({ size = 30, color = 'currentColor' }) {
  return (
    <Icon size={size} style={{ color }}>
      <circle cx="24" cy="24" r="6.5" />
      <path d="M24 12 v4 M24 32 v4 M12 24 h4 M32 24 h4" />
      <path d="M15.5 15.5 l2.8 2.8 M29.7 29.7 l2.8 2.8 M32.5 15.5 l-2.8 2.8 M18.3 29.7 l-2.8 2.8" />
      <circle cx="24" cy="24" r="2.2" fill="currentColor" stroke="none" />
    </Icon>
  );
}

/** 路径规划：航点 + 轨迹 */
export function IconRoute({ size = 30, color = 'currentColor' }) {
  return (
    <Icon size={size} style={{ color }}>
      <path d="M8 40 L8 24 L20 24 L20 12 L40 12" strokeDasharray="5 3.5" />
      <circle cx="8" cy="40" r="3.2" />
      <circle cx="20" cy="24" r="3.2" />
      <circle cx="40" cy="12" r="3.2" />
      <path d="M35 12 L40 12 L40 17" />
    </Icon>
  );
}

/** 多维分析：柱状图 + 折线 */
export function IconChart({ size = 30, color = 'currentColor' }) {
  return (
    <Icon size={size} style={{ color }}>
      <line x1="8" y1="40" x2="42" y2="40" />
      <line x1="8" y1="40" x2="8" y2="8" />
      <rect x="13" y="27" width="6" height="13" rx="1.4" />
      <rect x="23" y="20" width="6" height="20" rx="1.4" />
      <rect x="33" y="12" width="6" height="28" rx="1.4" />
    </Icon>
  );
}

/* ---------------- 应用层 ---------------- */

/** 飞手 / 操作员：手柄 + 屏幕 */
export function IconOperator({ size = 30, color = 'currentColor' }) {
  return (
    <Icon size={size} style={{ color }}>
      <rect x="8" y="9" width="32" height="20" rx="2.5" />
      <path d="M14 25 L18 19 L23 23 L28 15 L35 21" />
      <line x1="20" y1="29" x2="28" y2="29" />
      <line x1="24" y1="29" x2="24" y2="35" />
      <rect x="10" y="35" width="28" height="8" rx="3" />
      <circle cx="16" cy="39" r="1.6" /><circle cx="23" cy="39" r="1.6" />
      <circle cx="32" cy="39" r="2.4" />
    </Icon>
  );
}

/** 农户：人物 + 麦穗 */
export function IconFarmer({ size = 30, color = 'currentColor' }) {
  return (
    <Icon size={size} style={{ color }}>
      <circle cx="24" cy="14" r="6.5" />
      <path d="M13 40 a 11 11 0 0 1 22 0 z" />
      <path d="M34 40 L42 30" />
      <path d="M42 30 c -3 -1 -5 1 -4 4 c 1 3 5 3 6 0 c 1 -2 0 -4 -2 -4 z" />
    </Icon>
  );
}

/** 农技专家：人物 + 放大镜 */
export function IconExpert({ size = 30, color = 'currentColor' }) {
  return (
    <Icon size={size} style={{ color }}>
      <circle cx="19" cy="13" r="6" />
      <path d="M9 38 a 10 10 0 0 1 20 0 z" />
      <circle cx="33" cy="24" r="8" />
      <line x1="38.7" y1="29.7" x2="44" y2="35" />
      <line x1="30" y1="24" x2="36" y2="24" />
      <line x1="33" y1="21" x2="33" y2="27" />
    </Icon>
  );
}

/** 管理方：看板 / 建筑 */
export function IconManager({ size = 30, color = 'currentColor' }) {
  return (
    <Icon size={size} style={{ color }}>
      <rect x="7" y="14" width="15" height="26" rx="1.6" />
      <rect x="25" y="7" width="16" height="33" rx="1.6" />
      <line x1="11" y1="20" x2="18" y2="20" /><line x1="11" y1="26" x2="18" y2="26" />
      <line x1="11" y1="32" x2="18" y2="32" />
      <line x1="29" y1="13" x2="37" y2="13" /><line x1="29" y1="19" x2="37" y2="19" />
      <line x1="29" y1="25" x2="37" y2="25" /><line x1="29" y1="31" x2="37" y2="31" />
    </Icon>
  );
}

/* ---------------- 联动链步骤 ---------------- */

/** 空中发现：无人机 + 视野框 */
export function IconScan({ size = 30, color = 'currentColor' }) {
  return (
    <Icon size={size} style={{ color }}>
      <rect x="15" y="10" width="18" height="9" rx="2.6" />
      <line x1="16.5" y1="12.5" x2="9" y2="8" /><line x1="31.5" y1="12.5" x2="39" y2="8" />
      <line x1="16.5" y1="16.5" x2="9" y2="21" /><line x1="31.5" y1="16.5" x2="39" y2="21" />
      <circle cx="8" cy="7" r="2.6" /><circle cx="40" cy="7" r="2.6" />
      <circle cx="8" cy="22" r="2.6" /><circle cx="40" cy="22" r="2.6" />
      <path d="M24 19 L24 23" />
      {/* 视野框 */}
      <path d="M14 30 L14 26 L18 26" /><path d="M34 30 L34 26 L30 26" />
      <path d="M14 40 L14 44 L18 44" /><path d="M34 40 L34 44 L30 44" />
      <circle cx="24" cy="35" r="2.4" fill="currentColor" stroke="none" />
    </Icon>
  );
}

/** 云端派单：云 + 下行箭头 */
export function IconDispatch({ size = 30, color = 'currentColor' }) {
  return (
    <Icon size={size} style={{ color }}>
      <path d="M12 22 a 7 7 0 0 1 1.4 -13.8 a 9 9 0 0 1 17.2 2 a 6.5 6.5 0 0 1 -0.6 12.9 z" />
      <line x1="24" y1="24" x2="24" y2="36" />
      <path d="M18.5 31.5 L24 37 L29.5 31.5" />
      <rect x="16" y="39" width="16" height="5" rx="2" />
    </Icon>
  );
}

/** 云端确认：云 + 勾 */
export function IconConfirm({ size = 30, color = 'currentColor' }) {
  return (
    <Icon size={size} style={{ color }}>
      <path d="M12 24 a 7 7 0 0 1 1.4 -13.8 a 9 9 0 0 1 17.2 2 a 6.5 6.5 0 0 1 -0.6 12.9 z" />
      <circle cx="24" cy="36" r="8" />
      <path d="M20 36 L23 39 L28.5 33" />
    </Icon>
  );
}

/** 靶向喷洒：喷头 + 药雾锥 */
export function IconSpray({ size = 30, color = 'currentColor' }) {
  return (
    <Icon size={size} style={{ color }}>
      <rect x="20" y="8" width="8" height="12" rx="2" />
      <path d="M24 20 L24 24" />
      <path d="M24 24 L12 40" strokeDasharray="3 3" />
      <path d="M24 24 L24 42" strokeDasharray="3 3" />
      <path d="M24 24 L36 40" strokeDasharray="3 3" />
      <line x1="10" y1="44" x2="38" y2="44" />
    </Icon>
  );
}
