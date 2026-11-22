/**
 * 平台身份与对外信息
 *
 * 这里是「穗云智策——空地协同精准植保智能决策云平台」对外的统一出口：
 * 名称、官网地址、版本与备案口径都只在这一处定义，
 * 其他页面一律从这里取，避免各处硬编码导致口径不一致。
 *
 * 变更约定：
 *   - 改官网地址只改 OFFICIAL_URL 一处；
 *   - 页脚、平台方案页、侧边栏徽标都引用同一份；
 *   - 对外展示不写部署细节（服务器、端口、脚本路径），只写能力与地址。
 */

/** 平台简称 */
export const BRAND = '穗云智策';

/** 平台全称 */
export const BRAND_FULL = '空地协同精准植保智能决策云平台';

/** 完整标题 */
export const TITLE = `${BRAND}——${BRAND_FULL}`;

/**
 * 官方网站（公网访问地址）
 *
 * 纯静态部署在 GitHub Pages，前端与后端同源部署，
 * 因此链接指向站点根路径即可打开完整平台。
 */
export const OFFICIAL_URL = 'https://mediator-cmd.github.io/suiyunzhice-platform/';

/** 官网地址的纯文本形式（去掉协议尾斜杠，便于排版） */
export const OFFICIAL_URL_TEXT = OFFICIAL_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');

/** 团队 / 申报单位口径 */
export const TEAM = '中国民航大学 航空航天应用类';

/** 申报书与平台保持一致的口径：30 亩示范田 */
export const FIELD_SHORT = '30 亩示范田 · 5 m×5 m 网格';

/** 平台版本（与申报材料口径一致） */
export const VERSION = 'v1.0';
