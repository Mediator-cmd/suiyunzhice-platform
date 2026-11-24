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
 * 主地址是 Cloudflare Worker —— 前后端同源部署，
 * 打开就是带真后端的完整平台（REST 接口 + WebSocket 实时通道）。
 * GitHub Pages 版是同一套前端的静态托管副本，
 * 前端会把 API 请求转发到主地址，功能完全一致，作为备用入口。
 */
export const OFFICIAL_URL = 'https://suiyunzhice-platform.3403775603.workers.dev';

/**
 * 备用入口（静态托管副本）。
 *
 * 用途：主地址不可达时（例如某些网络环境对 workers.dev 的解析有问题），
 * 可以从这里进，页面仍会连到主地址取数。
 */
export const BACKUP_URL = 'https://mediator-cmd.github.io/suiyunzhice-platform/';

/** 官网地址的纯文本形式（去掉协议尾斜杠，便于排版） */
export const OFFICIAL_URL_TEXT = OFFICIAL_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');

/** 团队 / 申报单位口径 */
export const TEAM = '中国民航大学 航空航天应用类';

/** 申报书与平台保持一致的口径：30 亩示范田 */
export const FIELD_SHORT = '30 亩示范田 · 5 m×5 m 网格';

/** 平台版本（与申报材料口径一致） */
export const VERSION = 'v1.0';
