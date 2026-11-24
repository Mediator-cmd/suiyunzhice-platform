import React, { useMemo, useEffect, useState, useRef } from 'react';
import { MapContainer, Polygon, Polyline, Marker, CircleMarker, Tooltip, Rectangle, ImageOverlay, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { MAP, DISEASE_COLOR } from '../theme.js';
import { SATELLITE_BASEMAP } from '../assets.js';
import { TerrainLayer, StreetLayer, SatelliteLayer } from './TerrainLayer.jsx';

/**
 * 地块地图 —— 真实地理模式（默认）
 *
 * 坐标系统
 *   平台内部一律用「局部 ENU 米制坐标」（x 向东 0..widthM，y 向南 0..heightM），
 *   这是规划器、作业单、网格编号唯一认的坐标系，不能改。
 *
 *   地图上把 ENU 锚定到地块的真实经纬度：
 *     lat / lon  = 地块西北角附近的真实锚点（shared/platform.js 里给定）
 *     北向角    = 0（地块长边正东西向，与正北平行）
 *   这样局部米制坐标与真实地理之间是一一对应的仿射变换，
 *   真实高程 / 卫星 / 街道底图才能与作业网格严丝合缝地叠上。
 *
 * 三种底图（右上角切换）
 *   地形 —— NASA terrarium 真实 DEM 高程，客户端晕渲，凸起显示真实起伏
 *   街道 —— OpenStreetMap 真实街道与地物
 *   卫星 —— Esri World Imagery 真实影像
 *
 * 离线兜底
 *   瓦片全挂时，本地卫星实景图（SATELLITE_BASEMAP）仍会铺在画布上，
 *   作业网格 / 设备 / 航线照常显示，演示不会空屏。
 */

/* ---------- 设备图标：俯视具体造型 ---------- */
const UAV_GLYPH = `
<svg viewBox="0 0 40 40" width="38" height="38">
  <g fill="none" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round">
    <path d="M13 13 L27 27 M27 13 L13 27"/>
  </g>
  <g fill="#ffffff">
    <ellipse cx="9" cy="9" rx="7" ry="3.2"/>
    <ellipse cx="31" cy="9" rx="7" ry="3.2"/>
    <ellipse cx="9" cy="31" rx="7" ry="3.2"/>
    <ellipse cx="31" cy="31" rx="7" ry="3.2"/>
  </g>
  <g fill="none" stroke="#ffffff" stroke-width="2.4">
    <path d="M9 9 L16 16 M31 9 L24 16 M9 31 L16 24 M31 31 L24 24"/>
  </g>
  <rect x="14" y="14" width="12" height="12" rx="2" fill="#ffffff"/>
  <rect x="17" y="17" width="6" height="6" rx="1" fill="#0b6bcb"/>
</svg>`;

const ROBOT_GLYPH = `
<svg viewBox="0 0 40 40" width="36" height="36">
  <rect x="8" y="9" width="24" height="22" rx="4" fill="#ffffff"/>
  <rect x="11" y="12" width="18" height="9" rx="2" fill="#5a6472"/>
  <circle cx="20" cy="16.5" r="2.6" fill="#ffffff"/>
  <rect x="12" y="24" width="16" height="3.4" rx="1.4" fill="#5a6472"/>
  <g fill="#ffffff" stroke="#5a6472" stroke-width="2">
    <rect x="3" y="12" width="6" height="9" rx="2"/>
    <rect x="31" y="12" width="6" height="9" rx="2"/>
    <rect x="3" y="23" width="6" height="9" rx="2"/>
    <rect x="31" y="23" width="6" height="9" rx="2"/>
  </g>
</svg>`;

const BASEMAPS = [
  { id: 'terrain', label: '地形', hint: 'NASA terrarium 真实高程，客户端晕渲' },
  { id: 'street', label: '街道', hint: 'OpenStreetMap 真实街道与地物' },
  { id: 'satellite', label: '卫星', hint: 'Esri World Imagery 真实影像' },
];

export function FieldMap({
  field, route, devices, detections, events, missions, height = 460,
  onGridClick, selectedGrid, showBasemap = true,
  /* ---- 作业范围框选（作业调度页用） ---- */
  range = null,                 // { x, y, w, h } —— 已确认的作业范围（局部米制）
  onRangeChange = null,         // (rect|null) => void —— 拖动/新建时回调
  plannedPath = null,           // [{x,y}] —— 规划航线预览
  plannedCells = null,          // [{row,col}] —— 靶向网格高亮
}) {
  const [base, setBase] = useState('terrain');

  /* ---------- 坐标变换 ---------- */
  // 有真实锚点 → 用经纬度（EPSG:3857 投影由 Leaflet 处理）
  // 无锚点     → 退回 CRS.Simple 纯米制
  const geo = Number.isFinite(field?.lat) && Number.isFinite(field?.lon);

  // 每米对应的经纬度增量（唐山市纬度带上的近似值）
  const M_PER_DEG_LAT = 111320;
  const M_PER_DEG_LON = 111320 * Math.cos(((field?.lat ?? 0) * Math.PI) / 180);

  /** ENU (x东, y南) → Leaflet [lat, lon] */
  const toLL = geo
    ? (x, y) => [
        field.lat - (y / M_PER_DEG_LAT),
        field.lon + (x / M_PER_DEG_LON),
      ]
    : (x, y) => [y, x];

  const bounds = geo
    ? [toLL(0, 0), toLL(field.widthM, field.heightM)]
    : [[0, 0], [field?.heightM ?? 0, field?.widthM ?? 0]];

  const gridPolys = useMemo(() => {
    if (!field) return [];
    const map = new Map();
    for (const d of detections || []) {
      const key = `${d.grid.row}_${d.grid.col}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(d);
    }
    const out = [];
    const cw = field.widthM / field.gridCols;
    const ch = field.heightM / field.gridRows;
    for (const [key, list] of map) {
      const [row, col] = key.split('_').map(Number);
      const x = col * cw, y = row * ch;
      const poly = [
        toLL(x, y), toLL(x + cw, y), toLL(x + cw, y + ch), toLL(x, y + ch),
      ];
      const maxConf = Math.max(...list.map(d => d.confidence));
      const color = DISEASE_COLOR[list[0].disease] || '#dc2626';
      out.push({ key, poly, color, maxConf, count: list.length, disease: list[0].disease });
    }
    return out;
  }, [detections, field]);

  // 选中网格（对象形式 {row,col}）对应的 key
  const selKey = selectedGrid ? `${selectedGrid.row}_${selectedGrid.col}` : null;

  /* ---------- 5 m 作业网格线 ---------- */
  const gridLines = useMemo(() => {
    if (!field) return [];
    const lines = [];
    const cw = field.widthM / field.gridCols;
    const ch = field.heightM / field.gridRows;
    for (let c = 1; c < field.gridCols; c++) {
      const x = c * cw;
      lines.push([toLL(x, 0), toLL(x, field.heightM)]);
    }
    for (let r = 1; r < field.gridRows; r++) {
      const y = r * ch;
      lines.push([toLL(0, y), toLL(field.widthM, y)]);
    }
    return lines;
  }, [field]);

  /* ---------- 管理区：直接取平台下发的分区定义（A~H），与作业单 zoneId 同源 ---------- */
  const zones = useMemo(() => {
    if (!field) return [];
    // 平台 meta 已下发 zones（来自共享 shared/planner.js 的 Field.zones()）
    const src = field.zones?.length
      ? field.zones
      : (() => {
        // 兜底：后端未升级时本地按 4×2 推算
        const zc = 4, zr = 2;
        const zw = field.widthM / zc, zh = field.heightM / zr;
        const out = [];
        for (let r = 0; r < zr; r++) {
          for (let c = 0; c < zc; c++) {
            const i = r * zc + c;
            out.push({
              id: String.fromCharCode(65 + i),
              x: c * zw, y: r * zh, w: zw, h: zh,
            });
          }
        }
        return out;
      })();

    return src.map((z, i) => ({
      key: z.id || String(i),
      letter: z.id || String.fromCharCode(65 + i),
      x: z.x, y: z.y, w: z.w, h: z.h,
      // 标签锚在分区左上角内侧（不是角点本身）：
      // 角点 + 居中锚点会让标签一半溢出地块边界，
      // 左上角的 A/B/C 会被挤出画布，相邻分区标签还会互相压字。
      labelPos: toLL(z.x + 2, z.y + 2),
    }));
  }, [field]);

  const routeLine = useMemo(() => {
    if (!route?.points?.length) return null;
    return route.points.map(p => toLL(p.x, p.y));
  }, [route]);

  const obstaclePolys = useMemo(() =>
    !field ? [] : (field.obstacles || []).map(o => {
      // 窄障碍：短边小于 20 m 时，78 px 宽的标签骑在中心会溢出多边形，
      // 改为把标签锚到障碍右侧、整体避开多边形。
      const narrow = Math.min(o.w, o.h) < 20;
      return {
        ...o, narrow,
        poly: [toLL(o.x, o.y), toLL(o.x + o.w, o.y), toLL(o.x + o.w, o.y + o.h), toLL(o.x, o.y + o.h)],
        center: toLL(o.x + o.w / 2, o.y + o.h / 2),
        // 窄障碍的标签锚点：右移 3 m、垂直居中，标签从障碍右缘开始向右展开
        labelAnchor: toLL(o.x + o.w + 3, o.y + o.h / 2),
      };
    }), [field]);

  // 事件标记
  const eventMarks = useMemo(() => {
    if (!field) return [];
    const f = field;
    const cw = f.widthM / f.gridCols, ch = f.heightM / f.gridRows;
    return (events || []).slice(0, 40).map(e => ({
      e,
      pos: toLL((e.grid.col + 0.5) * cw, (e.grid.row + 0.5) * ch),
    }));
  }, [events, field]);

  const deviceMarks = (devices || []).filter(d => d.pos && Number.isFinite(d.pos.x)).map(d => ({
    d,
    pos: toLL(d.pos.x, d.pos.y),
  }));

  /* ---------- 正在作业的管理分区（靶向施药任务） ---------- */
  const activeZones = useMemo(() => {
    const set = new Map();
    for (const m of missions || []) {
      if (m.type !== 'spray') continue;
      const zid = m.zoneId || m.target?.zone;
      if (zid) set.set(zid, m);
    }
    return set;
  }, [missions]);

  // 注意：所有 Hook 必须写在提前 return 之前，
  // 否则首帧（field 未就绪）与后续帧的 Hook 数量不一致，
  // React 会抛 #310「rendered more hooks than during the previous render」并整页崩掉。
  if (!field) return null;

  return (
    <div className="map-wrap" style={{ height }}>
      <MapContainer
        crs={geo ? L.CRS.EPSG3857 : L.CRS.Simple}
        bounds={bounds}
        boundsOptions={{ padding: [8, 8] }}
        style={{ height: '100%', width: '100%', background: MAP.bg }}
        attributionControl={true}
        zoomControl={true}
        minZoom={geo ? 12 : undefined}
        maxZoom={geo ? 20 : undefined}
      >
        <FitBounds bounds={bounds} geo={geo} field={field} />

        {/* ---- 真实底图：地形 / 街道 / 卫星 ---- */}
        {showBasemap && geo && base === 'terrain' && (
          <TerrainLayer opacity={1} zIndex={1} />
        )}
        {showBasemap && geo && base === 'street' && (
          <StreetLayer opacity={1} zIndex={1} />
        )}
        {showBasemap && geo && base === 'satellite' && (
          <SatelliteLayer opacity={1} zIndex={1} />
        )}

        {/* 离线兜底：本地卫星实景图铺在最底层 */}
        {showBasemap && !geo && (
          <ImageOverlay url={SATELLITE_BASEMAP} bounds={bounds} opacity={0.42} />
        )}

        {/* 地块底色：真实地理模式下几乎透明，让地形透出来 */}
        <Polygon
          positions={[toLL(0, 0), toLL(field.widthM, 0), toLL(field.widthM, field.heightM), toLL(0, field.heightM)]}
          pathOptions={{
            color: geo ? '#1d2430' : MAP.fieldStroke,
            weight: geo ? 2 : 1.5,
            dashArray: geo ? null : undefined,
            fillColor: MAP.fieldFill,
            fillOpacity: geo ? 0.05 : 0.95,
          }}
        />

        {/* 管理区划分：虚线框 + 角标字母 */}
        {zones.map(z => {
          const active = activeZones.get(z.letter);
          return (
            <Rectangle
              key={z.key}
              bounds={[toLL(z.x, z.y), toLL(z.x + z.w, z.y + z.h)]}
              pathOptions={{
                color: active ? '#b54708' : '#4b5563',
                weight: active ? 2.4 : 1.4,
                dashArray: active ? null : '8 6',
                fill: !!active,
                fillColor: '#b54708',
                fillOpacity: active ? 0.14 : 0,
              }}
            />
          );
        })}
        {zones.map(z => {
          const active = activeZones.get(z.letter);
          return (
            <Marker
              key={`lbl_${z.key}`}
              position={z.labelPos}
              interactive={false}
              icon={L.divIcon({
                className: 'zone-label-icon',
                html: `<div class="zone-label${active ? ' active' : ''}">${z.letter}区${active ? ' · 作业中' : ''}</div>`,
                iconSize: [86, 20],
                // 锚点取左上角（0,0），标签从锚点向右下展开，
                // 保证整块标签都落在分区内部、不会溢出地块。
                iconAnchor: [2, 2],
              })}
            />
          );
        })}

        {/* 5 m 作业网格线 */}
        {gridLines.map((l, i) => (
          <Polyline key={`g${i}`} positions={l}
            pathOptions={{ color: '#0b6bcb', weight: 0.8, opacity: 0.35 }} />
        ))}

        {/* 障碍区 */}
        {obstaclePolys.map((o, i) => (
          <React.Fragment key={i}>
            <Polygon positions={o.poly}
              pathOptions={{
                color: '#2b3442', weight: 1.6,
                fillColor: '#e9ebee', fillOpacity: 0.85,
              }} />
            <Marker
              position={o.narrow ? o.labelAnchor : o.center}
              interactive={false}
              icon={L.divIcon({
                className: 'obstacle-label-icon',
                html: `<div class="obstacle-label${o.narrow ? ' narrow' : ''}">${o.label || '障碍'}</div>`,
                iconSize: [78, 22],
                // 宽障碍：标签居中骑在障碍上。
                // 窄障碍（水渠只有 12 m 宽 ≈ 53 px）：78 px 标签无论怎么放都会压住
                // 多边形或骑跨边界，反而看不出标签指的是哪个障碍。
                // 这类改为锚在障碍右上角、整体右移，让标签清楚地"站在"障碍旁边。
                iconAnchor: o.narrow ? [0, 0] : [39, 11],
              })}
            />
          </React.Fragment>
        ))}

        {/* 病害网格 */}
        {gridPolys.map(g => (
          <Polygon key={g.key} positions={g.poly}
            eventHandlers={onGridClick ? { click: () => onGridClick({ row: g.key.split('_')[0] * 1, col: g.key.split('_')[1] * 1 }) } : {}}
            pathOptions={{
              color: selKey === g.key ? '#0f766e' : g.color,
              weight: selKey === g.key ? 2.5 : 1.2,
              fillColor: g.color,
              fillOpacity: 0.35,
            }}>
            <Tooltip sticky>
              <b>网格 R{g.key.split('_')[0]} C{g.key.split('_')[1]}</b><br />
              检出 {g.count} 处 · 置信度 {(g.maxConf * 100).toFixed(0)}%<br />
              {g.disease}
            </Tooltip>
          </Polygon>
        ))}

        {/* 规划航线 */}
        {routeLine && (
          <Polyline positions={routeLine} pathOptions={{ color: MAP.route, weight: 2.6, opacity: 1 }} />
        )}

        {/* ---- 作业范围框选（作业调度页） ---- */}
        {range && (
          <Rectangle
            bounds={[toLL(range.x, range.y), toLL(range.x + range.w, range.y + range.h)]}
            pathOptions={{
              color: '#b54708', weight: 2.4, dashArray: '6 5',
              fill: true, fillColor: '#b54708', fillOpacity: 0.10,
            }}
          />
        )}

        {/* ---- 靶向网格高亮（作业调度页） ---- */}
        {plannedCells?.length > 0 && (() => {
          const cw = field.widthM / field.gridCols;
          const ch = field.heightM / field.gridRows;
          return plannedCells.map(c => (
            <Rectangle
              key={`pc_${c.row}_${c.col}`}
              bounds={[toLL(c.col * cw, c.row * ch), toLL((c.col + 1) * cw, (c.row + 1) * ch)]}
              pathOptions={{
                color: '#b42318', weight: 1, fill: true,
                fillColor: '#b42318', fillOpacity: 0.22,
              }}
            />
          ));
        })()}

        {/* ---- 规划航线预览（作业调度页） ---- */}
        {plannedPath?.length > 1 && (
          <>
            <Polyline
              positions={plannedPath.map(p => toLL(p.x, p.y))}
              pathOptions={{ color: '#0f766e', weight: 2.2, opacity: 0.95, dashArray: '1 0' }}
            />
            {/* 起点 */}
            <CircleMarker
              center={toLL(plannedPath[0].x, plannedPath[0].y)}
              radius={5}
              pathOptions={{ color: '#0f766e', weight: 2, fillColor: '#ffffff', fillOpacity: 1 }}
            >
              <Tooltip>航线起点</Tooltip>
            </CircleMarker>
          </>
        )}

        {/* ---- 范围框选交互层 ---- */}
        {onRangeChange && (
          <RangeDrawer field={field} range={range} onRangeChange={onRangeChange} geo={geo} />
        )}

        {/* 联动事件 */}
        {eventMarks.map(({ e, pos }) => (
          <CircleMarker key={e.eventId} center={pos} radius={7}
            pathOptions={{ color: '#b54708', weight: 2, fillColor: '#b54708', fillOpacity: 0.5 }}>
            <Tooltip>
              <b>联动闭环</b><br />
              {(e.chain || []).join(' → ')}<br />
              总时延 {((e.latency?.total || 0) / 1000).toFixed(1)} s
            </Tooltip>
          </CircleMarker>
        ))}

        {/* 设备：无人机 / 机器人 的具体造型 */}
        {deviceMarks.map(({ d, pos }) => (
          <Marker key={d.deviceId} position={pos}
            icon={L.divIcon({
              className: 'dev-marker',
              html: `<div class="dev-glyph ${d.kind === 'uav' ? 'uav' : 'robot'}">${
                d.kind === 'uav' ? UAV_GLYPH : ROBOT_GLYPH
              }</div>`,
              iconSize: [40, 40],
              iconAnchor: [20, 20],
            })}>
            <Tooltip direction="top" offset={[0, -18]}>
              <b>{d.name || d.deviceId}</b><br />
              {d.kind === 'uav' ? '植保无人机' : '地面监测机器人'}<br />
              状态 {d.state} · 电量 {d.batt ?? '—'}%<br />
              坐标 ({d.pos.x?.toFixed(1)}, {d.pos.y?.toFixed(1)}) m
            </Tooltip>
          </Marker>
        ))}

        <ScaleBar geo={geo} field={field} />
      </MapContainer>

      {/* 底图切换：真实地理模式下才显示 */}
      {showBasemap && geo && (
        <div className="basemap-switch" role="group" aria-label="底图切换">
          {BASEMAPS.map(b => (
            <button
              key={b.id}
              className={base === b.id ? 'on' : ''}
              title={b.hint}
              onClick={() => setBase(b.id)}
            >{b.label}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 作业范围框选交互层。
 *
 * 用法：在地图上按住拖出一个矩形 → 回调 onRangeChange(rect)。
 * 坐标一律换算回平台的局部 ENU 米制（x 东、y 南），
 * 与规划器、作业单、网格编号同一坐标系，不能直接用经纬度。
 */
function RangeDrawer({ field, range, onRangeChange, geo }) {
  const map = useMap();
  const startRef = useRef(null);
  // 拖拽矩形同时存 ref：mouseup 拿到的必须是**最新**的值，
  // 而 React 的 state 更新是异步的 —— 只用 state 的话，
  // 快速拖一下时 mouseup 读到的还是上一帧的旧矩形，框选会失效。
  const dragRef = useRef(null);
  const [drag, setDrag] = useState(null);

  // 局部 ENU → Leaflet
  const M_PER_DEG_LAT = 111320;
  const M_PER_DEG_LON = 111320 * Math.cos(((field?.lat ?? 0) * Math.PI) / 180);
  const toLL = geo
    ? (x, y) => [field.lat - (y / M_PER_DEG_LAT), field.lon + (x / M_PER_DEG_LON)]
    : (x, y) => [y, x];
  // Leaflet → 局部 ENU
  const toEnu = geo
    ? (lat, lon) => ({
        x: (lon - field.lon) * M_PER_DEG_LON,
        y: (field.lat - lat) * M_PER_DEG_LAT,
      })
    : (lat, lon) => ({ x: lon, y: lat });

  // handler 只订阅一次，所以它读到的一切都要走 ref —— 否则闭包里
  // 固化的是首次渲染时的 field / geo / onRangeChange。
  const toEnuRef = useRef(toEnu);
  toEnuRef.current = toEnu;
  const fieldRef = useRef(field);
  fieldRef.current = field;
  const onRangeChangeRef = useRef(onRangeChange);
  onRangeChangeRef.current = onRangeChange;

  // 事件订阅必须只做一次。
  //
  // useMapEvents 内部在每次渲染时都会重新订阅（它把 handler 放进
  // useEffect 的依赖里）。而拖拽过程中 setDrag 会触发重渲染，
  // 于是订阅被反复拆除重建 —— 拖到一半的 mousemove 就丢了，
  // 框选出来只有几米大。
  //
  // 解决办法：用 ref 固定 handler 引用，依赖数组为空，
  // 整个拖拽期间始终是同一份订阅。
  const handlersRef = useRef(null);
  if (!handlersRef.current) {
    handlersRef.current = {
      mousedown(e) {
        if (e.originalEvent.button !== 0) return;
        const p = toEnuRef.current(e.latlng.lat, e.latlng.lng);
        startRef.current = { x: p.x, y: p.y };
        const d = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
        dragRef.current = d;
        setDrag(d);
      },
      mousemove(e) {
        if (!startRef.current) return;
        const p = toEnuRef.current(e.latlng.lat, e.latlng.lng);
        const d = { ...dragRef.current, x1: p.x, y1: p.y };
        dragRef.current = d;
        setDrag(d);
      },
      mouseup() {
        const d = dragRef.current;
        startRef.current = null;
        dragRef.current = null;
        setDrag(null);
        if (!d) return;
        const x = Math.min(d.x0, d.x1), y = Math.min(d.y0, d.y1);
        const w = Math.abs(d.x1 - d.x0), h = Math.abs(d.y1 - d.y0);
        // 太小的框视为误触，保持原状
        if (w < 4 || h < 4) return;
        onRangeChangeRef.current({
          x: clamp(x, 0, fieldRef.current.widthM - w),
          y: clamp(y, 0, fieldRef.current.heightM - h),
          w, h,
        });
      },
    };
  }

  useMapEvents(handlersRef.current);

  /**
   * 框选模式下关掉地图平移。
   *
   * 原因：Leaflet 默认开启 dragging —— 按下鼠标后拖动会平移地图，
   * 于是「鼠标屏幕坐标 → 地理坐标」的映射在拖拽过程中不断变化，
   * mousemove 读到的 latlng 不再对应光标位置，框选框会缩成一小块。
   *
   * 关掉之后，拖动只用于框选；想平移地图用滚轮缩放或按「清除」后再拖。
   */
  useEffect(() => {
    const d = map.dragging;
    if (!d) return undefined;
    const wasEnabled = d.enabled();
    if (wasEnabled) d.disable();
    return () => { if (wasEnabled) d.enable(); };
  }, [map]);

  // 拖动中的临时框
  const preview = drag ? {
    x: Math.min(drag.x0, drag.x1), y: Math.min(drag.y0, drag.y1),
    w: Math.abs(drag.x1 - drag.x0), h: Math.abs(drag.y1 - drag.y0),
  } : null;

  return preview ? (
    <Rectangle
      bounds={[toLL(preview.x, preview.y), toLL(preview.x + preview.w, preview.y + preview.h)]}
      pathOptions={{ color: '#b54708', weight: 2, dashArray: '4 4', fill: true, fillColor: '#b54708', fillOpacity: 0.14 }}
    />
  ) : null;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * 视图自适应：把地块边界铺满地图容器。
 * CRS.Simple 下 bounds 不会自动 fit，手动调一次。
 *
 * 关键点：不能在挂载时 fit 一次就完事。
 *   - Leaflet 容器尺寸要等布局完成才知道，挂载瞬间算出的 zoom 常常是错的；
 *   - 同一张地图在总览页（容器 916×502）与实时监控页（916×402）尺寸不同，
 *     组件复用时容器尺寸会变。
 *   之前的写法只 fit 一次，导致实时监控页的地块只占容器一半宽。
 *
 * 现在改为：监听 resize 事件重新 fit，并在容器尺寸变化后补一次 fit。
 */
function FitBounds({ bounds, geo, field }) {
  const map = useMap();
  const done = React.useRef(false);

  const fit = React.useCallback(() => {
    try {
      if (geo) {
        // 真实地理：地块只有 200 m × 100 m，需要较高缩放才能看清网格。
        // fitBounds 会算出恰好铺满的缩放级别（约 z17），直接用它即可。
        map.fitBounds(bounds, { padding: [24, 24] });
      } else {
        map.fitBounds(bounds, { padding: [8, 8] });
      }
    } catch { /* ignore */ }
  }, [map, bounds, geo]);

  useEffect(() => {
    if (done.current) return;
    const t = setTimeout(() => {
      fit();
      done.current = true;
    }, 0);
    return () => clearTimeout(t);
  }, [fit, field]);

  // 容器尺寸变化后重新 fit（切页、窗口缩放、面板展开都会触发）
  useEffect(() => {
    const onResize = () => { if (done.current) fit(); };
    map.on('resize', onResize);
    // ResizeObserver 兜底：某些布局变化不触发 Leaflet 的 resize 事件
    let ro = null;
    if (typeof ResizeObserver !== 'undefined' && map.getContainer()) {
      ro = new ResizeObserver(() => { if (done.current) fit(); });
      ro.observe(map.getContainer());
    }
    return () => {
      map.off('resize', onResize);
      if (ro) ro.disconnect();
    };
  }, [map, fit]);

  return null;
}

/**
 * 比例尺。
 *
 * CRS.Simple 下 Leaflet 自带的 L.control.scale 算不出米数
 * （它按墨卡托比例换算，而我们用的是 1 单位 = 1 米的局部 ENU）。
 * 所以自己算：CRS.Simple 的投影比例是 2^zoom，即 1 米 = 2^zoom 像素，
 * 于是 1 像素 = 1 / 2^zoom 米，取整成 5/10/20/50 m 的整数倍。
 *
 * 真实地理模式下改用 Leaflet 的原生比例尺（按 EPSG:3857 换算，更准）。
 */
function ScaleBar({ geo, field }) {
  const map = useMap();
  const [len, setLen] = React.useState(null);

  useEffect(() => {
    if (geo) {
      const c = L.control.scale({ position: 'bottomleft', imperial: false, maxWidth: 120 });
      c.addTo(map);
      return () => map.removeControl(c);
    }
    const update = () => {
      const z = map.getZoom();
      const mPerPx = 1 / Math.pow(2, z);
      // 目标：比例尺约 90 px 宽
      const target = mPerPx * 90;
      const nice = [5, 10, 20, 50, 100, 200];
      const pick = nice.find(n => n >= target) || nice[nice.length - 1];
      setLen({ meters: pick, px: Math.round(pick / mPerPx) });
    };
    update();
    map.on('zoomend', update);
    map.on('resize', update);
    return () => { map.off('zoomend', update); map.off('resize', update); };
  }, [map, geo]);

  if (geo || !len) return null;
  return (
    <div className="map-scale">
      <div class="map-scale-bar" style={{ width: len.px }} />
      <span class="map-scale-text">{len.meters} m</span>
    </div>
  );
}

export { DISEASE_COLOR };
