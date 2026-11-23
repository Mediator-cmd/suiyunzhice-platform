/**
 * 真实地形底图 —— NASA terrarium 高程瓦片 → 客户端晕渲（hillshade）
 *
 * 为什么要自己渲染，而不是直接用别人的地形瓦片服务：
 *   - 实测国内可达的瓦片源里，OpenTopoMap / Carto / Stadia 全部不可达；
 *   - Esri 的 World_Topo_Map / World_Imagery 在本环境返回的是空白占位图
 *     （实测 2521 字节、灰度标准差 5.4，纯色）；
 *   - NASA 的 terrarium 高程瓦片（S3 公读，带 CORS）稳定可达，
 *     内容是真实 DEM 高程，是「实际地形」的唯一可靠来源。
 *
 * terrarium 编码（Mapzen/Tilezen 规范）：
 *   elevation = (R * 256 + G + B / 256) - 32768   // 单位：米
 *
 * 渲染流程（每块 256×256 瓦片）：
 *   1. 解码高程矩阵 E
 *   2. 计算坡度梯度 gy / gx，构造晕渲光照 L
 *   3. 按高程做色带映射（低地绿 → 丘陵黄褐 → 高地灰白）
 *   4. 输出纯色 RGB 瓦片，交给 Leaflet 的 L.GridLayer 画
 *
 * 瓦片超采样（关键）
 *   terrarium 的高程数据最高只到 z15（实测 z16 起 404）。
 *   但平台的地块只有 200 m × 100 m，需要 z17 左右才看得清，
 *   于是 z16+ 的瓦片不能直接取，必须回退到 z15 父瓦片：
 *     - 算出当前瓦片在 z15 坐标系里覆盖的像素区域
 *     - 取对应的 1~4 块 z15 瓦片，从高程矩阵里裁出该区域
 *     - 把裁出的高程放大到 256×256 后再做晕渲
 *   这样地形在任意缩放级别都能显示，且是同一份真实 DEM 数据。
 *
 * 离线兜底：瓦片加载失败时，Leaflet 画布底色为浅灰，
 * 同时 FieldMap 仍叠有本地卫星实景图（SATELLITE_BASEMAP），
 * 因此断网 / 内网演示时地图依然有内容，不会空屏。
 */

import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useMap } from 'react-leaflet';

const TERRARIUM_URL =
  'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

/** terrarium 实测有数据的最高缩放级别 */
const DATA_MAX_ZOOM = 15;
/** 数据可用的最低缩放级别 */
const DATA_MIN_ZOOM = 4;

/**
 * 色带：把高程映射成地形配色。
 *
 * 刻意压低饱和度（灰绿 → 灰褐 → 灰白），
 * 与平台整体的克制风格一致，不抢作业网格与设备的视觉层。
 */
const RAMP = [
  [-20, [104, 118, 100]],
  [   0, [126, 138, 112]],
  [  20, [148, 156, 124]],
  [  40, [170, 170, 136]],
  [  60, [188, 180, 148]],
  [  90, [200, 190, 174]],
  [ 140, [212, 206, 198]],
  [ 300, [236, 234, 230]],
  [1000, [252, 251, 250]],
];

function rampColor(h) {
  if (h <= RAMP[0][0]) return RAMP[0][1];
  for (let i = 1; i < RAMP.length; i++) {
    if (h <= RAMP[i][0]) {
      const [h0, c0] = RAMP[i - 1];
      const [h1, c1] = RAMP[i];
      const t = (h - h0) / (h1 - h0 || 1);
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * t),
        Math.round(c0[1] + (c1[1] - c0[1]) * t),
        Math.round(c0[2] + (c1[2] - c0[2]) * t),
      ];
    }
  }
  return RAMP[RAMP.length - 1][1];
}

/** 解码 terrarium 瓦片为高程矩阵（Float32Array，256×256） */
function decodeElevation(img) {
  const N = 256;
  const cv = document.createElement('canvas');
  cv.width = N; cv.height = N;
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, N, N);
  const d = ctx.getImageData(0, 0, N, N).data;
  const out = new Float32Array(N * N);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    out[p] = d[i] * 256 + d[i + 1] + d[i + 2] / 256 - 32768;
  }
  return out;
}

/**
 * 由高程数据生成晕渲 + 等高线的着色瓦片（返回 canvas）
 *
 * 关键点 1：坡度必须在「原生 DEM 像素」上算，再按双线性插值到输出瓦片。
 *   若在放大后的网格上算梯度，等于把插值出来的平滑面再放大一次，
 *   微小噪声会被推成陡崖，整幅图糊成噪点雾。
 *
 * 关键点 2：竖直夸张必须随局部起伏自适应。
 *   平台锚定的华北平原，200 m 地块内高差仅 1~2 m，
 *   固定夸张系数要么糊成雾、要么什么都看不出来。
 *   这里按窗口内的坡度分布反推夸张系数，
 *   让「画面上能看出坡向」与「坡度不夸大」同时成立。
 *
 * 关键点 3：等高线直接由同一份 DEM 的高程分级判定得到，
 *   因此线上的位置就是真实高程位置，不是装饰。
 *
 * @param {object} src  { E, offX, offY, span, mPerPx }
 *        E     —— 原生高程矩阵（256×256）
 *        offX/offY —— 输出瓦片左上角在原生矩阵中的浮点坐标
 *        span  —— 一个输出瓦片边长对应的原生像素数
 *        mPerPx —— 原生一个像素对应的地面距离（米）
 */
function renderShaded({ E, offX, offY, span, mPerPx }) {
  const N = 256;
  const cv = document.createElement('canvas');
  cv.width = N; cv.height = N;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(N, N);
  const px = img.data;

  // 光照：西北方向，方位角 315°，高度角 45°
  const az = (315 * Math.PI) / 180;
  const alt = (45 * Math.PI) / 180;
  const lx = Math.cos(alt) * Math.sin(az);
  const ly = Math.cos(alt) * Math.cos(az);
  const lz = Math.sin(alt);

  /** 在原生高程矩阵上做双线性采样（浮点坐标，单位＝原生像素） */
  const sample = (fx, fy) => {
    const x0 = Math.floor(fx), y0 = Math.floor(fy);
    const tx = fx - x0, ty = fy - y0;
    const cx0 = Math.max(0, Math.min(255, x0));
    const cx1 = Math.max(0, Math.min(255, x0 + 1));
    const cy0 = Math.max(0, Math.min(255, y0));
    const cy1 = Math.max(0, Math.min(255, y0 + 1));
    const v00 = E[cy0 * 256 + cx0], v01 = E[cy0 * 256 + cx1];
    const v10 = E[cy1 * 256 + cx0], v11 = E[cy1 * 256 + cx1];
    const top = v00 + (v01 - v00) * tx;
    const bot = v10 + (v11 - v10) * tx;
    return top + (bot - top) * ty;
  };

  // ---- 窗口内的真实高程范围与坡度分布（用于自适应夸张 + 等高线分级） ----
  let lo = Infinity, hi = -Infinity;
  const slopes = [];
  const stepX = Math.max(1, span / 64);
  const stepY = Math.max(1, span / 64);
  for (let sy = 0; sy <= span; sy += stepY) {
    for (let sx = 0; sx <= span; sx += stepX) {
      const h = sample(offX + sx, offY + sy);
      if (h < lo) lo = h;
      if (h > hi) hi = h;
    }
  }
  for (let sy = 0; sy <= span; sy += stepY) {
    for (let sx = 0; sx <= span; sx += stepX) {
      const dzdx = (sample(offX + sx + 1, offY + sy) - sample(offX + sx - 1, offY + sy)) / (2 * mPerPx);
      const dzdy = (sample(offX + sx, offY + sy + 1) - sample(offX + sx, offY + sy - 1)) / (2 * mPerPx);
      slopes.push(Math.hypot(dzdx, dzdy));
    }
  }
  slopes.sort((a, b) => a - b);
  const p90 = slopes.length ? slopes[Math.floor(slopes.length * 0.9)] : 0;

  // 自适应夸张：把窗口内 90 分位的真实坡度映射到约 22° 的视觉坡度。
  // p90 极小（近乎完全平坦）时给一个上限，避免噪声被放大成假山。
  const VIS_SLOPE = Math.tan((22 * Math.PI) / 180);
  const exag = p90 > 1e-6
    ? Math.max(1, Math.min(400, VIS_SLOPE / p90))
    : 60;

  // ---- 等高线分级：在 [lo, hi] 内取一个「整数好看」的间隔 ----
  const relief = Math.max(0, hi - lo);
  const NICE = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100];
  let contourStep = NICE[NICE.length - 1];
  for (const s of NICE) {
    if (relief / s >= 6 && relief / s <= 24) { contourStep = s; break; }
    if (relief / s < 6) { contourStep = s; break; }
  }
  if (relief < 0.05) contourStep = Infinity; // 完全平坦，不画等高线

  const sub = span / N; // 输出一个像素对应的原生像素数

  for (let py = 0; py < N; py++) {
    const fy = offY + py * sub;
    for (let pxi = 0; pxi < N; pxi++) {
      const fx = offX + pxi * sub;

      // 中心差分求坡度（米/米）
      const dzdx = (sample(fx + 1, fy) - sample(fx - 1, fy)) / (2 * mPerPx);
      // 瓦片 y 轴向南，dz/d(北) = -dz/d(南)
      const dzdy = -(sample(fx, fy + 1) - sample(fx, fy - 1)) / (2 * mPerPx);

      const gx = dzdx * exag;
      const gy = dzdy * exag;
      let nx = -gx, ny = -gy, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      let shade = nx * lx + ny * ly + nz * lz;
      if (shade < 0) shade = 0;
      // 环境光 0.62，避免背光面死黑
      const lum = 0.62 + 0.55 * shade;

      const h = sample(fx, fy);
      const [r, g, b] = rampColor(h);

      // 等高线判定：与右邻、下邻比较，高程分级发生变化即画线
      let onContour = false;
      if (contourStep !== Infinity) {
        const hx = sample(fx + sub, fy);
        const hy = sample(fx, fy + sub);
        const k = Math.floor((h - lo) / contourStep);
        if (k !== Math.floor((hx - lo) / contourStep) || k !== Math.floor((hy - lo) / contourStep)) {
          onContour = true;
        }
      }

      const p = (py * N + pxi) * 4;
      if (onContour) {
        // 等高线：同色系压暗，不引入新的色相
        px[p] = Math.max(0, r * lum * 0.62);
        px[p + 1] = Math.max(0, g * lum * 0.62);
        px[p + 2] = Math.max(0, b * lum * 0.62);
      } else {
        px[p] = Math.min(255, r * lum);
        px[p + 1] = Math.min(255, g * lum);
        px[p + 2] = Math.min(255, b * lum);
      }
      px[p + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

/** 瓦片缓存：key = "z/x/y"，避免重复下载与重复渲染 */
const tileCache = new Map();

function loadTileImage(url) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => resolve(im);
    im.onerror = () => reject(new Error('tile load failed'));
    im.src = url;
  });
}

/**
 * 取指定 z 层级的高程数据（自动回退到 DATA_MAX_ZOOM 并裁剪放大）。
 *
 * 几何关系（以 z=19 请求、z=15 数据为例）：
 *   - z=19 的瓦片 x=434257 落在 z=15 的父瓦片 x = floor(434257/16) = 27141 内
 *   - 该父瓦片是 256×256 的 z15 像素；z19 的一个瓦片只覆盖其中 16×16 像素
 *     （因为 z19 的分辨率是 z15 的 16 倍）
 *
 * 返回的不是放大后的矩阵，而是「原生矩阵 + 采样几何」：
 *   { E, offX, offY, span, mPerPx }
 * 晕渲时在原生像素上求坡度再插值，避免放大后噪声被推成陡崖。
 */
async function elevationFor(coords) {
  const { x, y, z } = coords;
  const dataZ = Math.min(z, DATA_MAX_ZOOM);
  const scale = 2 ** (z - dataZ);           // 当前瓦片在 dataZ 下跨了几个父瓦片
  const span = 256 / scale;                  // 一个输出瓦片边长对应的原生像素数

  // 父瓦片索引与在其内部的像素偏移（dataZ 像素坐标）
  const baseX = Math.floor(x / scale);
  const baseY = Math.floor(y / scale);
  const offX = (x - baseX * scale) * span;
  const offY = (y - baseY * scale) * span;

  const key = `${dataZ}/${baseX}/${baseY}`;
  let E = tileCache.get(key);
  if (!E) {
    const img = await loadTileImage(
      TERRARIUM_URL.replace('{z}', dataZ).replace('{x}', baseX).replace('{y}', baseY),
    );
    E = decodeElevation(img);
    tileCache.set(key, E);
  }

  // 原生一个像素对应的地面距离（米）。
  // 墨卡托在纬度 φ 处：分辨率 = 156543.03 × cos(φ) / 2^z 米/像素
  const latRad = tileLat(coords);
  const mPerPx = (156543.03392 * Math.cos(latRad)) / 2 ** dataZ;

  return { E, offX, offY, span, mPerPx };
}

/** 由瓦片坐标反算该瓦片中心纬度（用于估算地面分辨率） */
function tileLat(coords) {
  const n = 2 ** coords.z;
  const latRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * coords.y + 1) / n)));
  return latRad;
}

/**
 * 地形瓦片层（Leaflet GridLayer）
 */
const TerrainLayerClass = L.GridLayer.extend({
  options: {
    opacity: 1,
    tileSize: 256,
    minZoom: DATA_MIN_ZOOM,
    maxZoom: 22,
    attribution: '高程：NASA terrarium（SRTM/NED）· 渲染：客户端晕渲',
  },

  createTile(coords, done) {
    const tile = document.createElement('canvas');
    tile.width = 256; tile.height = 256;

    if (coords.z < DATA_MIN_ZOOM) {
      const ctx = tile.getContext('2d');
      ctx.fillStyle = '#e8ecef';
      ctx.fillRect(0, 0, 256, 256);
      setTimeout(() => done(null, tile), 0);
      return tile;
    }

    const key = `shaded/${coords.z}/${coords.x}/${coords.y}`;
    const cached = tileCache.get(key);
    if (cached) {
      const ctx = tile.getContext('2d');
      ctx.drawImage(cached, 0, 0);
      setTimeout(() => done(null, tile), 0);
      return tile;
    }

    elevationFor(coords)
      .then((src) => {
        const shaded = renderShaded(src);
        tileCache.set(key, shaded);
        const ctx = tile.getContext('2d');
        ctx.drawImage(shaded, 0, 0);
        done(null, tile);
      })
      .catch(() => {
        // 单块瓦片失败：留浅灰，不中断整层
        const ctx = tile.getContext('2d');
        ctx.fillStyle = '#e8ecef';
        ctx.fillRect(0, 0, 256, 256);
        done(null, tile);
      });

    return tile;
  },
});

/**
 * 地形底图组件
 *
 * react-leaflet v4 没有导出 GridLayer，所以不能用 JSX 直接写 <TerrainLayer/>，
 * 这里用 useMap() 拿到地图实例后命令式挂载，卸载时移除。
 */
export function TerrainLayer({ opacity = 1, zIndex = 1 }) {
  const map = useMap();
  const ref = useRef(null);
  useEffect(() => {
    const layer = new TerrainLayerClass({ opacity, zIndex });
    layer.addTo(map);
    ref.current = layer;
    return () => { map.removeLayer(layer); ref.current = null; };
  }, [map]);
  useEffect(() => {
    if (ref.current) { ref.current.setOpacity(opacity); ref.current.setZIndex(zIndex); }
  }, [opacity, zIndex]);
  return null;
}

/**
 * 街道底图（真实地理参照）
 *
 * 实测可达：tile.openstreetmap.jp / tile.openstreetmap.de。
 * 两者互为备份，失败自动切换。
 */
const OSM_HOSTS = [
  'https://tile.openstreetmap.jp/{z}/{x}/{y}.png',
  'https://tile.openstreetmap.de/{z}/{x}/{y}.png',
];

/** 双镜像街道底图：一个瓦片失败自动换源 */
export function StreetLayer({ opacity = 1, zIndex = 1 }) {
  const map = useMap();
  const ref = useRef(null);
  useEffect(() => {
    const layer = L.tileLayer(OSM_HOSTS[0], {
      opacity, zIndex, maxZoom: 19, crossOrigin: true,
      attribution: '© OpenStreetMap 贡献者',
    });
    // 主源失败时切到备用源
    const onTileError = () => {
      if (layer._suiyunSrc === 'fallback') return;
      layer._suiyunSrc = 'fallback';
      layer.setUrl(OSM_HOSTS[1]);
    };
    layer.on('tileerror', onTileError);
    layer.addTo(map);
    ref.current = layer;
    return () => { map.removeLayer(layer); ref.current = null; };
  }, [map]);
  useEffect(() => {
    if (ref.current) { ref.current.setOpacity(opacity); ref.current.setZIndex(zIndex); }
  }, [opacity, zIndex]);
  return null;
}

/**
 * 卫星影像底图（Esri World_Imagery）
 *
 * 注意：Esri 的 World_Topo_Map / World_Imagery 在部分网络环境下会返回
 * 空白占位图，因此这里把卫星作为「可选底图」而非默认项。
 */
export function SatelliteLayer({ opacity = 1, zIndex = 1 }) {
  const map = useMap();
  const ref = useRef(null);
  useEffect(() => {
    const layer = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { opacity, zIndex, maxZoom: 19, attribution: '影像：Esri World Imagery' },
    );
    layer.addTo(map);
    ref.current = layer;
    return () => { map.removeLayer(layer); ref.current = null; };
  }, [map]);
  useEffect(() => {
    if (ref.current) { ref.current.setOpacity(opacity); ref.current.setZIndex(zIndex); }
  }, [opacity, zIndex]);
  return null;
}
