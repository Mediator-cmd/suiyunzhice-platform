import React from 'react';
import { CHART } from '../theme.js';

/**
 * 空地协同作业场景示意图
 *
 * 这是「让人一眼就知道是什么演示图」的主图：一张完整的地块作业现场剖面图，
 * 天空 → 云端 → 麦田 → 地面机器人，一眼能读出「无人机在空中巡检、机器人在地面复核、
 * 云端在中间裁决并下发任务」。
 *
 * 全部为内联 SVG，随容器等比缩放，不依赖任何外部图片，离线可用。
 */

const INK = '#304d50';      // 参考图主墨色
const MINT = '#e7f8f3';     // 参考图薄荷底
const FIELD = '#f1f5f6';    // 参考图冷灰底
const GREEN = '#16a34a';
const BLUE = '#0284c7';
const PURPLE = '#7c3aed';
const AMBER = '#d97706';

export default function SceneDiagram({ height = 420 }) {
  return (
    <svg
      viewBox="0 0 960 470"
      style={{ width: '100%', height: 'auto', display: 'block' }}
      role="img"
      aria-label="空地协同精准植保作业场景示意图"
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f4faf9" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
        <linearGradient id="cloudFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor={MINT} />
        </linearGradient>
        <pattern id="rows" width="34" height="26" patternUnits="userSpaceOnUse">
          <path d="M4 26 L14 4" stroke="#cfe3d5" strokeWidth="2" />
          <path d="M16 26 L26 4" stroke="#cfe3d5" strokeWidth="2" />
        </pattern>
      </defs>

      {/* ---------- 天空 ---------- */}
      <rect x="0" y="0" width="960" height="250" fill="url(#sky)" />
      {/* ---------- 地面 ---------- */}
      <rect x="0" y="250" width="960" height="220" fill={FIELD} />
      <path d="M0 250 L960 250" stroke={INK} strokeWidth="2.5" />
      {/* 地平线阴影 */}
      <path d="M0 258 L960 258" stroke="#dde5e6" strokeWidth="2" />

      {/* ---------- 麦田（右侧地块）---------- */}
      <g>
        <rect x="470" y="262" width="470" height="150" fill="#eaf4ec" />
        <rect x="470" y="262" width="470" height="150" fill="url(#rows)" />
        <rect x="470" y="262" width="470" height="150" fill="none" stroke="#7ba888" strokeWidth="2" />
        {/* 病害病灶标记 */}
        <circle cx="620" cy="330" r="9" fill="#dc2626" fillOpacity=".22" stroke="#dc2626" strokeWidth="1.6" />
        <circle cx="700" cy="360" r="9" fill="#dc2626" fillOpacity=".22" stroke="#dc2626" strokeWidth="1.6" />
        <circle cx="820" cy="320" r="9" fill="#dc2626" fillOpacity=".22" stroke="#dc2626" strokeWidth="1.6" />
        <text x="620" y="336" fontSize="14" textAnchor="middle" fill="#dc2626" fontWeight="700">!</text>
        <text x="700" y="366" fontSize="14" textAnchor="middle" fill="#dc2626" fontWeight="700">!</text>
        <text x="820" y="326" fontSize="14" textAnchor="middle" fill="#dc2626" fontWeight="700">!</text>
        <text x="705" y="436" fontSize="17" textAnchor="middle" fill={INK} fontWeight="600">麦田 · 5 m 网格划区</text>
        <text x="705" y="457" fontSize="14" textAnchor="middle" fill="#6b7d84">红色圆斑 = 识别出的疑似病斑</text>
      </g>

      {/* ---------- 左侧道路 / 机器人活动区 ---------- */}
      <path d="M40 412 L460 412" stroke="#c8d3d4" strokeWidth="3" strokeDasharray="14 10" />
      <text x="160" y="440" fontSize="17" textAnchor="middle" fill={INK} fontWeight="600">地面机器人作业面</text>

      {/* ---------- 云端 ---------- */}
      <g>
        <path
          d="M372 96 a 44 44 0 0 1 9 -86 a 56 56 0 0 1 106 14 a 40 40 0 0 1 -4 80 z"
          fill="url(#cloudFill)" stroke={INK} strokeWidth="3"
        />
        {/* 云内服务器机架 */}
        <rect x="404" y="52" width="58" height="40" rx="5" fill="#ffffff" stroke={INK} strokeWidth="2.4" />
        <line x1="404" y1="66" x2="462" y2="66" stroke={INK} strokeWidth="2" />
        <circle cx="412" cy="59" r="2.6" fill={GREEN} />
        <circle cx="412" cy="79" r="2.6" fill={BLUE} />
        {/* 云内文字 */}
        <text x="500" y="72" fontSize="19" fontWeight="700" fill={INK}>穗云智策 · 云端决策</text>
        <text x="500" y="96" fontSize="15" fill="#6b7d84">识别判定 · 联动派单 · 路径规划 · 六维统计</text>
      </g>

      {/* ---------- 无人机（空中巡检 + 喷洒）---------- */}
      <g transform="translate(120,26)">
        {/* 机臂 */}
        <line x1="42" y1="34" x2="16" y2="18" stroke={INK} strokeWidth="3" />
        <line x1="98" y1="34" x2="124" y2="18" stroke={INK} strokeWidth="3" />
        <line x1="42" y1="62" x2="16" y2="78" stroke={INK} strokeWidth="3" />
        <line x1="98" y1="62" x2="124" y2="78" stroke={INK} strokeWidth="3" />
        {/* 旋翼 */}
        <circle cx="14" cy="17" r="9" fill="none" stroke={INK} strokeWidth="2.6" />
        <circle cx="126" cy="17" r="9" fill="none" stroke={INK} strokeWidth="2.6" />
        <circle cx="14" cy="79" r="9" fill="none" stroke={INK} strokeWidth="2.6" />
        <circle cx="126" cy="79" r="9" fill="none" stroke={INK} strokeWidth="2.6" />
        {/* 机身 */}
        <rect x="34" y="28" width="72" height="40" rx="12" fill="#ffffff" stroke={INK} strokeWidth="3" />
        <rect x="54" y="14" width="32" height="16" rx="5" fill={MINT} stroke={INK} strokeWidth="2.6" />
        <text x="70" y="26" fontSize="11" textAnchor="middle" fill={INK} fontWeight="700">药箱</text>
        {/* 云台相机 */}
        <path d="M62 68 L60 78 L80 78 L78 68" fill="none" stroke={INK} strokeWidth="2.6" />
        <circle cx="70" cy="86" r="9" fill="#ffffff" stroke={INK} strokeWidth="2.8" />
        <circle cx="70" cy="86" r="3" fill={BLUE} />
        {/* 喷洒 */}
        <line x1="56" y1="96" x2="46" y2="140" stroke={BLUE} strokeWidth="2" strokeDasharray="4 5" />
        <line x1="70" y1="96" x2="70" y2="146" stroke={BLUE} strokeWidth="2" strokeDasharray="4 5" />
        <line x1="84" y1="96" x2="94" y2="140" stroke={BLUE} strokeWidth="2" strokeDasharray="4 5" />
      </g>
      <text x="190" y="200" fontSize="16" textAnchor="middle" fill={BLUE} fontWeight="700">植保无人机 UAV</text>
      <text x="190" y="221" fontSize="14" textAnchor="middle" fill="#6b7d84">空中巡检 · 冠层/叶面识别 · 靶向喷洒</text>

      {/* ---------- 地面机器人 ---------- */}
      <g transform="translate(300,300)">
        {/* 相机云台 */}
        <rect x="38" y="0" width="46" height="22" rx="7" fill="#ffffff" stroke={INK} strokeWidth="3" />
        <circle cx="76" cy="11" r="6" fill="none" stroke={INK} strokeWidth="2.6" />
        <line x1="61" y1="22" x2="61" y2="40" stroke={INK} strokeWidth="3" />
        {/* 天线 */}
        <line x1="96" y1="40" x2="112" y2="14" stroke={INK} strokeWidth="2.4" />
        <circle cx="113" cy="12" r="4.5" fill={PURPLE} />
        {/* 底盘 */}
        <rect x="8" y="40" width="106" height="36" rx="9" fill="#ffffff" stroke={INK} strokeWidth="3" />
        <line x1="40" y1="40" x2="40" y2="76" stroke="#b9c6c8" strokeWidth="2" strokeDasharray="4 4" />
        <line x1="82" y1="40" x2="82" y2="76" stroke="#b9c6c8" strokeWidth="2" strokeDasharray="4 4" />
        {/* 轮子 */}
        <circle cx="30" cy="88" r="15" fill="#ffffff" stroke={INK} strokeWidth="3" />
        <circle cx="30" cy="88" r="4.5" fill={INK} />
        <circle cx="92" cy="88" r="15" fill="#ffffff" stroke={INK} strokeWidth="3" />
        <circle cx="92" cy="88" r="4.5" fill={INK} />
      </g>
      <text x="360" y="418" fontSize="16" textAnchor="middle" fill={PURPLE} fontWeight="700">地面监测机器人 ROB</text>
      <text x="360" y="439" fontSize="14" textAnchor="middle" fill="#6b7d84">近距复核 · 叶下/根茎/土壤</text>

      {/* ---------- 数据链路箭头 ---------- */}
      {/* 无人机 → 云端 */}
      <path d="M268 78 L338 78" stroke={BLUE} strokeWidth="3" strokeDasharray="9 6" fill="none" />
      <path d="M332 71 L344 78 L332 85" fill="none" stroke={BLUE} strokeWidth="3" strokeLinejoin="round" />
      <text x="303" y="62" fontSize="13" textAnchor="middle" fill={BLUE} fontWeight="700" stroke="#ffffff" strokeWidth="3.5" paintOrder="stroke">遥测 5–10 Hz</text>

      {/* 云端 → 无人机（任务下发）*/}
      <path d="M356 128 L268 138" stroke={AMBER} strokeWidth="3" strokeDasharray="9 6" fill="none" />
      <path d="M276 132 L262 140 L276 146" fill="none" stroke={AMBER} strokeWidth="3" strokeLinejoin="round" />
      <text x="312" y="116" fontSize="13" textAnchor="middle" fill={AMBER} fontWeight="700" stroke="#ffffff" strokeWidth="3.5" paintOrder="stroke">喷洒任务</text>

      {/* 云端 → 机器人（派单） */}
      <path d="M430 130 C 430 210, 380 240, 372 296" stroke={AMBER} strokeWidth="3" strokeDasharray="9 6" fill="none" />
      <path d="M378 288 L371 302 L385 300" fill="none" stroke={AMBER} strokeWidth="3" strokeLinejoin="round" />
      <text x="452" y="212" fontSize="13" fill={AMBER} fontWeight="700" stroke="#ffffff" strokeWidth="3.5" paintOrder="stroke">派单复核</text>

      {/* 机器人 → 云端（复核结果） */}
      <path d="M470 320 C 520 300, 520 210, 470 150" stroke={PURPLE} strokeWidth="3" strokeDasharray="9 6" fill="none" />
      <path d="M478 158 L468 143 L484 146" fill="none" stroke={PURPLE} strokeWidth="3" strokeLinejoin="round" />
      <text x="530" y="248" fontSize="13" fill={PURPLE} fontWeight="700" stroke="#ffffff" strokeWidth="3.5" paintOrder="stroke">复核证据</text>

      {/* ---------- 底部时延条 ---------- */}
      <g transform="translate(24,308)">
        <rect x="0" y="0" width="268" height="70" rx="10" fill="#ffffff" stroke="#d5dee0" strokeWidth="2" />
        <text x="14" y="21" fontSize="13" fill="#6b7d84">闭环端到端时延</text>
        <text x="14" y="53" fontSize="23" fontWeight="700" fill={GREEN}>1.8 s</text>
        <text x="112" y="36" fontSize="12.5" fill="#6b7d84">感知 120 / 下发 90</text>
        <text x="112" y="56" fontSize="12.5" fill="#6b7d84">到位 1600 ms</text>
      </g>
    </svg>
  );
}
