import React, { useMemo, useEffect } from 'react';
import { MapContainer, Polygon, Polyline, Marker, CircleMarker, Tooltip, Rectangle, ImageOverlay, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MAP, DISEASE_COLOR } from '../theme.js';
import { SATELLITE_BASEMAP } from '../assets.js';

/**
 * 地块地图：本地 ENU 坐标 → Leaflet 的 CRS.Simple
 *
 * 不用在线瓦片，保证离线/内网/演示环境都能渲染。
 * 但也叠了一层本地卫星实景图（ImageOverlay），
 * 这样既有真实场景参照，又不依赖外网瓦片服务。
 *
 * 地图上标出四类具体信息：
 *  1) 5 m 作业网格（作业单位）
 *  2) A~H 八个管理区（把 200 m × 100 m 划成 50 m × 50 m 的作业分区）
 *  3) 障碍区（排水沟 / 配电房，带名称）
 *  4) 比例尺（1 格 = 5 m / 10 m / 20 m，与网格尺度对齐）
 * 设备用内联 SVG 画出无人机与机器人的具体形状，而不是一个圆点。
 */

/* ---------- 设备图标：俯视具体造型 ---------- */
const UAV_GLYPH = `
<svg viewBox="0 0 40 40" width="34" height="34">
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
  <rect x="17" y="17" width="6" height="6" rx="1" fill="#0284c7"/>
</svg>`;

const ROBOT_GLYPH = `
<svg viewBox="0 0 40 40" width="32" height="32">
  <rect x="8" y="9" width="24" height="22" rx="4" fill="#ffffff"/>
  <rect x="11" y="12" width="18" height="9" rx="2" fill="#b91c1c"/>
  <circle cx="20" cy="16.5" r="2.6" fill="#ffffff"/>
  <rect x="12" y="24" width="16" height="3.4" rx="1.4" fill="#b91c1c"/>
  <g fill="#ffffff" stroke="#b91c1c" stroke-width="2">
    <rect x="3" y="12" width="6" height="9" rx="2"/>
    <rect x="31" y="12" width="6" height="9" rx="2"/>
    <rect x="3" y="23" width="6" height="9" rx="2"/>
    <rect x="31" y="23" width="6" height="9" rx="2"/>
  </g>
</svg>`;

export function FieldMap({
  field, route, devices, detections, events, missions, height = 460,
  onGridClick, selectedGrid, showBasemap = true,
}) {
  if (!field) return null;

  // 局部 ENU (0..W, 0..H) → leaflet [y, x]，翻转 Y 轴
  const bounds = [[0, 0], [field.heightM, field.widthM]];
  const toLL = (x, y) => [y, x];

  const gridPolys = useMemo(() => {
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
      // 标签放在左上角内侧，避免压住中心网格
      labelPos: toLL(z.x + 4, z.y + 4),
    }));
  }, [field]);

  const routeLine = useMemo(() => {
    if (!route?.points?.length) return null;
    return route.points.map(p => toLL(p.x, p.y));
  }, [route]);

  const obstaclePolys = useMemo(() =>
    (field.obstacles || []).map(o => ({
      ...o,
      poly: [toLL(o.x, o.y), toLL(o.x + o.w, o.y), toLL(o.x + o.w, o.y + o.h), toLL(o.x, o.y + o.h)],
      center: toLL(o.x + o.w / 2, o.y + o.h / 2),
    })), [field]);

  // 事件标记
  const eventMarks = useMemo(() => {
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

  return (
    <div className="map-wrap" style={{ height }}>
      <MapContainer
        crs={L.CRS.Simple}
        bounds={bounds}
        boundsOptions={{ padding: [8, 8] }}
        style={{ height: '100%', width: '100%', background: MAP.bg }}
        attributionControl={true}
      >
        <FitBounds bounds={bounds} />

        {/* 真实场景卫星底图：本地图片，不依赖外网瓦片 */}
        {showBasemap && (
          <ImageOverlay
            url={SATELLITE_BASEMAP}
            bounds={bounds}
            opacity={0.42}
          />
        )}

        {/* 地块底色 */}
        <Polygon
          positions={[toLL(0, 0), toLL(field.widthM, 0), toLL(field.widthM, field.heightM), toLL(0, field.heightM)]}
          pathOptions={{ color: MAP.fieldStroke, weight: 1.5, fillColor: MAP.fieldFill, fillOpacity: showBasemap ? 0.18 : 0.95 }}
        />

        {/* 管理区划分：虚线框 + 角标字母 */}
        {zones.map(z => {
          const active = activeZones.get(z.letter);
          return (
            <Rectangle
              key={z.key}
              bounds={[toLL(z.x, z.y), toLL(z.x + z.w, z.y + z.h)]}
              pathOptions={{
                color: active ? '#ca8a04' : '#7ba888',
                weight: active ? 2.4 : 1.6,
                dashArray: active ? null : '8 6',
                fill: !!active,
                fillColor: '#ca8a04',
                fillOpacity: active ? 0.16 : 0,
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
                iconSize: [78, 18],
                iconAnchor: [39, 9],
              })}
            />
          );
        })}

        {/* 5 m 作业网格线 */}
        {gridLines.map((l, i) => (
          <Polyline key={`g${i}`} positions={l}
            pathOptions={{ color: '#9fbfab', weight: 0.8, opacity: 0.75 }} />
        ))}

        {/* 障碍区 */}
        {obstaclePolys.map((o, i) => (
          <React.Fragment key={i}>
            <Polygon positions={o.poly}
              pathOptions={{ color: MAP.obstacleStroke, weight: 1.6, dashArray: '4 3', fillColor: MAP.obstacleFill, fillOpacity: 0.9 }} />
            <Marker
              position={o.center}
              interactive={false}
              icon={L.divIcon({
                className: 'obstacle-label-icon',
                html: `<div class="obstacle-label">${o.label || '障碍'}</div>`,
                iconSize: [72, 20],
                iconAnchor: [36, 10],
              })}
            />
          </React.Fragment>
        ))}

        {/* 病害网格 */}

        {/* 选中态：selKey 由外部传入的 {row,col} 推导 */}
        {gridPolys.map(g => (
          <Polygon key={g.key} positions={g.poly}
            eventHandlers={onGridClick ? { click: () => onGridClick({ row: g.key.split('_')[0] * 1, col: g.key.split('_')[1] * 1 }) } : {}}
            pathOptions={{
              color: selKey === g.key ? '#16a34a' : g.color,
              weight: selKey === g.key ? 2.5 : 1,
              fillColor: g.color,
              fillOpacity: 0.18 + g.maxConf * 0.42,
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
          <Polyline positions={routeLine} pathOptions={{ color: MAP.route, weight: 2.4, opacity: 0.95 }} />
        )}

        {/* 联动事件 */}
        {eventMarks.map(({ e, pos }) => (
          <CircleMarker key={e.eventId} center={pos} radius={6}
            pathOptions={{ color: MAP.routeManual, weight: 2, fillColor: MAP.routeManual, fillOpacity: 0.45 }}>
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
              iconSize: [36, 36],
              iconAnchor: [18, 18],
            })}>
            <Tooltip direction="top" offset={[0, -18]}>
              <b>{d.name || d.deviceId}</b><br />
              {d.kind === 'uav' ? '植保无人机' : '地面监测机器人'}<br />
              状态 {d.state} · 电量 {d.batt ?? '—'}%<br />
              坐标 ({d.pos.x?.toFixed(1)}, {d.pos.y?.toFixed(1)}) m
            </Tooltip>
          </Marker>
        ))}

        <ScaleBar />
      </MapContainer>
    </div>
  );
}

/**
 * 视图自适应：把地块边界铺满地图容器。
 * CRS.Simple 下 bounds 不会自动 fit，手动调一次。
 */
function FitBounds({ bounds }) {
  const map = useMap();
  const done = React.useRef(false);
  useEffect(() => {
    if (done.current) return;
    const t = setTimeout(() => {
      try { map.fitBounds(bounds, { padding: [8, 8] }); done.current = true; } catch { /* ignore */ }
    }, 0);
    return () => clearTimeout(t);
  }, [map, bounds]);
  return null;
}

/**
 * 比例尺。
 *
 * CRS.Simple 下 Leaflet 自带的 L.control.scale 算不出米数
 * （它按墨卡托比例换算，而我们用的是 1 单位 = 1 米的局部 ENU）。
 * 所以自己算：CRS.Simple 的投影比例是 2^zoom，即 1 米 = 2^zoom 像素，
 * 于是 1 像素 = 1 / 2^zoom 米，取整成 5/10/20/50 m 的整数倍。
 */
function ScaleBar() {
  const map = useMap();
  const [len, setLen] = React.useState(null);

  useEffect(() => {
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
  }, [map]);

  if (!len) return null;
  return (
    <div className="map-scale">
      <div className="map-scale-bar" style={{ width: len.px }} />
      <span className="map-scale-text">{len.meters} m</span>
    </div>
  );
}

export { DISEASE_COLOR };
