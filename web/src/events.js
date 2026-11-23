/**
 * 联动事件去重
 *
 * 同一条联动事件在平台上会被推送两次：
 *   1. 空中识别触发派单时推送一次（closed=false，等待地面复核证据）
 *   2. 地面机器人回传近距复核证据后再推送一次（closed=true，eventId 不变）
 *
 * 两端在合并时如果直接追加，会出现：
 *   - 表格里同一行出现两次；
 *   - React 报「Encountered two children with the same key」；
 *   - 闭环率、平均时延等统计口径翻倍（同一件事被算两次）。
 *
 * 因此统一走这个函数：按 eventId 合并，保留后到的状态。
 */
export function dedupeLinkEvents(events) {
  const map = new Map();
  for (const e of events || []) {
    if (e?.eventId) map.set(e.eventId, e);
  }
  return [...map.values()];
}
