import React, { useMemo } from 'react';
import { MapContainer, ImageOverlay, Polygon, Polyline, Marker, CircleMarker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import { MAP, DISEASE_COLOR } from '../theme.js';

/**
 * 地块地图：本地 ENU 坐标 → Leaflet 的 CRS.Simple
 * 不用在线瓦片，保证离线/内网/演示环境都能渲染。
 */

export function FieldMap({
  field, route, devices, detections, events, height = 460, onGridClick, selectedGrid,
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

  const routeLine = useMemo(() => {
    if (!route?.points?.length) return null;
    return route.points.map(p => toLL(p.x, p.y));
  }, [route]);

  const obstaclePolys = useMemo(() =>
    (field.obstacles || []).map(o => [
      toLL(o.x, o.y), toLL(o.x + o.w, o.y), toLL(o.x + o.w, o.y + o.h), toLL(o.x, o.y + o.h),
    ]), [field]);

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

  return (
    <div className="map-wrap" style={{ height }}>
      <MapContainer
        crs={L.CRS.Simple}
        bounds={bounds}
        boundsOptions={{ padding: [8, 8] }}
        style={{ height: '100%', width: '100%', background: MAP.bg }}
        attributionControl={true}
      >
        {/* 地块底色 */}
        <Polygon
          positions={[toLL(0, 0), toLL(field.widthM, 0), toLL(field.widthM, field.heightM), toLL(0, field.heightM)]}
          pathOptions={{ color: MAP.fieldStroke, weight: 1.5, fillColor: MAP.fieldFill, fillOpacity: 0.95 }}
        />

        {/* 障碍区 */}
        {obstaclePolys.map((poly, i) => (
          <Polygon key={i} positions={poly}
            pathOptions={{ color: MAP.obstacleStroke, weight: 1.5, dashArray: '4 3', fillColor: MAP.obstacleFill, fillOpacity: 0.75 }} />
        ))}

        {/* 病害网格 */}
        {gridPolys.map(g => (
          <Polygon key={g.key} positions={g.poly}
            eventHandlers={onGridClick ? { click: () => onGridClick({ row: g.key.split('_')[0] * 1, col: g.key.split('_')[1] * 1 }) } : {}}
            pathOptions={{
              color: g.key === selectedGrid ? '#16a34a' : g.color,
              weight: g.key === selectedGrid ? 2.5 : 1,
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

        {/* 设备 */}
        {deviceMarks.map(({ d, pos }) => (
          <Marker key={d.deviceId} position={pos}
            icon={L.divIcon({
              className: 'dev-marker',
              html: `<div style="
                width:16px;height:16px;border-radius:50%;
                background:${d.kind === 'uav' ? '#0284c7' : '#b91c1c'};
                border:2px solid #ffffff; box-shadow:0 1px 4px rgba(28,43,34,.35);
              "></div>`,
              iconSize: [16, 16], iconAnchor: [8, 8],
            })}>
            <Tooltip direction="top" offset={[0, -10]}>
              <b>{d.name || d.deviceId}</b><br />
              状态 {d.state} · 电量 {d.batt ?? '—'}%<br />
              坐标 ({d.pos.x?.toFixed(1)}, {d.pos.y?.toFixed(1)}) m
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

export { DISEASE_COLOR };
