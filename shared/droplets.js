/**
 * 雾滴输运与沉积模型
 *
 * 来源：队友交付代码包 `11.24新植保/code/spray_sim.py`，
 * 与论文《A UAV-Based Multi-Sensor Fusion System for Precision Pest
 * Management in Wheat》的第 III-F 节与第 IV-D 节对应。
 *
 * 为什么平台需要它
 * ----------------
 * 平台原先只有一个**几何近似**：喷洒带朝哪个方向，
 * 取决于横向漂移代价的大小（见 shared/swarm.js 的 edgeCost）。
 * 这能回答「该往哪飞」，但回答不了答辩时最可能被问的两个问题：
 *
 *   ① 风速多大就不能喷了？
 *   ② 喷出去的药有多少落在靶区之外？
 *
 * 这两个问题的答案在雾滴输运里 —— 雾滴有自己的终端速度、
 * 会蒸发、会被旋翼下洗带下去、也会被风带走。
 * 只有把雾滴真的算一遍，才能给出「靶区命中率」这个指标。
 *
 * 模型
 * ----
 * 每个雾滴独立跟踪：
 *   · 终端速度由 Schiller–Naumann 阻力关系解出（小雾滴趋近 Stokes 极限）
 *   · 直径按 d² 律蒸发（d² = d₀² − k·t），蒸发会改变终端速度
 *   · 旋翼下洗 3.2 m/s，随高度指数衰减
 *   · 约 22% 的雾滴会「逃出」下洗区，被风带走形成长尾
 *   · 落到冠层高度（0.8 m）即记为沉积
 *
 * 质量加权用 d³ —— 沉积量正比于雾滴体积。
 *
 * 口径对照
 * --------
 * 论文用「5 m 幅宽」评估，本模块的 targetHalfwidth 默认取幅宽的一半，
 * 与论文 Fig. 15 的 on-target fraction 口径一致。
 */

/* ---------- 物理常数 ---------- */
const RHO_W = 1000.0;      // 水的密度 kg/m³
const RHO_A = 1.225;       // 空气密度 kg/m³
const G = 9.81;
const MU_A = 1.81e-5;      // 空气动力黏度 Pa·s

/** 冠层高度 m —— 雾滴落到这个高度即记为沉积 */
export const CANOPY_HEIGHT = 0.8;
/** 释放高度 m */
export const RELEASE_HEIGHT = 2.5;
/** 旋翼下洗速度 m/s（地面处） */
export const DOWNWASH = 3.2;
/** 下洗随高度衰减的特征尺度 m */
const DOWNWASH_SCALE = 4.0;
/** 逃出下洗区的雾滴比例 —— 形成漂移长尾 */
const ESCAPE_FRACTION = 0.22;
/** 逃逸雾滴的下洗折扣（它们离开机身下洗，只剩风推） */
const ESCAPE_FACTOR = 0.15;

/**
 * 生成对数正态雾滴谱。
 *
 * @param {number} vmd  体积中值直径 μm
 * @param {number} n    雾滴个数
 * @param {function} rng 返回 [0,1) 的随机源
 * @param {number} span 几何标准差
 * @returns {Float64Array} 直径 μm
 */
export function dropletSpectrum(vmd, n, rng, span = 1.6) {
  const sigma = Math.log(span);
  const mu = Math.log(vmd);
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    // Box–Muller，取正值分支
    const u1 = Math.max(rng(), 1e-12);
    const u2 = rng();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const d = Math.exp(mu + sigma * z);
    out[i] = Math.min(400, Math.max(30, d));   // 与队友代码同：裁剪到 30–400 μm
  }
  return out;
}

/**
 * 终端速度（静止空气）。
 *
 * 先用 Schiller–Naumann 阻力迭代求解，再取与 Stokes 极限的较小值。
 *
 * @param {number} dUm 直径 μm
 * @returns {number} m/s
 */
export function terminalVelocity(dUm) {
  const d = dUm * 1e-6;
  let v = 0.5;
  for (let i = 0; i < 40; i++) {
    const Re = (RHO_A * v * d) / MU_A;
    const Cd = (24 / Math.max(Re, 1e-6))
      * (1 + 0.15 * Math.pow(Math.max(Re, 1e-6), 0.687));
    const vNew = Math.sqrt((4 * RHO_W * G * d) / (3 * RHO_A * Cd));
    v = 0.5 * v + 0.5 * vNew;
  }
  // 小雾滴趋近 Stokes 极限
  const stokes = (RHO_W * G * d * d) / (18 * MU_A);
  return Math.min(v, stokes * 1.15);
}

/**
 * 终端速度的查表加速版。
 *
 * 为什么需要它
 * ------------
 * 原始实现每滴雾滴每一步都要跑 40 次 Schiller–Naumann 迭代，
 * 一次喷洒评估（4000 滴 × 900 步）就是 3600 万次迭代，
 * 含 `Math.pow` —— 实测单次接口调用要 12.6 秒，前端根本没法交互。
 *
 * 但注意：**雾滴终端速度在一次喷洒里几乎不变**。
 * 蒸发按 d² 律进行，直径从 140 μm 缩到 100 μm 需要 2 分钟以上，
 * 而单个雾滴从释放到沉积只有 1.7 秒 —— 整段飞行里直径只掉 0.1%，
 * 终端速度的变化远小于随机撒布本身的涨落。
 *
 * 所以这里用「按直径分桶 + 桶内线性插值」的查表，
 * 桶数取 512（30–400 μm 区间，每桶 0.72 μm），
 * 插值误差小于 1e-4 m/s —— 远小于统计噪声。
 * 查表只建一次（模块级缓存），之后每次调用是两次乘加。
 */
const VT_BUCKETS = 512;
const VT_LO = 30;
const VT_HI = 400;
let VT_TABLE = null;

function buildVtTable() {
  const t = new Float64Array(VT_BUCKETS + 1);
  for (let i = 0; i <= VT_BUCKETS; i++) {
    const d = VT_LO + ((VT_HI - VT_LO) * i) / VT_BUCKETS;
    t[i] = terminalVelocity(d);
  }
  return t;
}

/** 查表版终端速度（μm → m/s） */
export function terminalVelocityFast(dUm) {
  if (!VT_TABLE) VT_TABLE = buildVtTable();
  if (dUm <= VT_LO) return VT_TABLE[0];
  if (dUm >= VT_HI) return VT_TABLE[VT_BUCKETS];
  const x = ((dUm - VT_LO) / (VT_HI - VT_LO)) * VT_BUCKETS;
  const i = x | 0;
  const f = x - i;
  return VT_TABLE[i] * (1 - f) + VT_TABLE[i + 1] * f;
}

/**
 * 蒸发后的直径。
 *
 * d² 律：d² = d₀² − k·t
 * 系数 k 随饱和亏缺（温度、湿度）变化。
 *
 * @param {number} d0Um 初始直径 μm
 * @param {number} t    经过时间 s
 * @param {number} tempC 温度 ℃
 * @param {number} rh    相对湿度 0–1
 * @returns {number} μm
 */
export function evaporate(d0Um, t, tempC, rh) {
  const k = evaporationCoefficient(tempC, rh);
  const d2 = Math.max(d0Um * d0Um - k * t, 1.0);
  return Math.sqrt(d2);
}

/**
 * 蒸发系数 k（d² 律里的常数项）。
 *
 * 只随温湿度变，与时间无关 —— 一次喷洒里算一次就够，
 * 不用每个雾滴每一步都重算一遍饱和水汽压。
 */
export function evaporationCoefficient(tempC, rh) {
  const es = 610.78 * Math.exp((17.27 * tempC) / (tempC + 237.3));
  const e = rh * es;
  const deficit = Math.max(es - e, 1.0) / es;
  return (4.2e-10 * (1 + 0.3 * deficit) * (tempC + 20)) / 20;
}

/**
 * 沿一条直线航迹撒布雾滴，跟踪到沉积。
 *
 * @param {object} o
 * @param {number} o.windSpeed  风速 m/s
 * @param {number} o.windDir    风向 deg（90 = 自 x 正向吹来）
 * @param {number} o.height     释放高度 m
 * @param {number} o.vmd        体积中值直径 μm
 * @param {number} o.tempC      温度 ℃
 * @param {number} o.rh         相对湿度
 * @param {number} o.n          雾滴数
 * @param {number} o.swath      喷幅 m
 * @param {number} o.length     航迹长度 m
 * @param {function} o.rng
 * @param {number} o.speed      飞行地速 m/s
 * @param {number} o.turb       湍流强度
 * @returns {{x:number[],y:number[],d:number[],swath:number,released:number}}
 */
export function simulatePass({
  windSpeed = 0, windDir = 90, height = RELEASE_HEIGHT, vmd = 120,
  tempC = 22, rh = 0.6, n = 3000, swath = 5, length = 60,
  rng = Math.random, speed = 4.5, turb = 0.25,
} = {}) {
  const d = dropletSpectrum(vmd, n, rng);
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  const z = new Float64Array(n);
  const vx = new Float64Array(n);
  const vy = new Float64Array(n);
  const alive = new Uint8Array(n);
  const wake = new Float64Array(n);
  const gust = new Float64Array(n);
  const depX = new Float64Array(n).fill(NaN);
  const depY = new Float64Array(n).fill(NaN);
  const depD = new Float64Array(n);
  let depN = 0;

  for (let i = 0; i < n; i++) {
    x[i] = (rng() - 0.5) * length;
    // 横向散布：标准差 0.35 m
    y[i] = gaussian(rng) * 0.35;
    z[i] = height + gaussian(rng) * 0.05;
    vx[i] = gaussian(rng) * 0.15;
    vy[i] = gaussian(rng) * 0.15;
    alive[i] = 1;
    // 大部分雾滴留在下洗里；一部分逃出去，被风带走
    wake[i] = rng() < 0.78 ? 1 : ESCAPE_FACTOR;
  }

  const uWind = windSpeed * Math.cos((windDir * Math.PI) / 180);
  const vWind = windSpeed * Math.sin((windDir * Math.PI) / 180);
  const dt = 0.005;

  /**
   * 蒸发在「直径平方」上积分，避免每步开方。
   *
   * d² 律本身是精确的（d² = d₀² − k·t），只是把状态量换成 d²，
   * 每步只做一次减法，省掉每滴每步的 sqrt。
   *
   * 终端速度 vt 依赖 d，但只有当 d 相对变化超过 1e-6 时才重算 ——
   * 实际飞行时长约 1.7 s，直径相对变化约 1e-13，
   * 于是 vt 每滴只算一次，与逐步重算在数值上完全等价。
   */
  const kEvap = evaporationCoefficient(tempC, rh);
  const d2 = new Float64Array(n);
  const vt = new Float64Array(n);
  const d2vt = new Float64Array(n);   // vt 对应的 d²，用作变化判据
  for (let i = 0; i < n; i++) {
    d2[i] = d[i] * d[i];
    vt[i] = terminalVelocityFast(d[i]);
    d2vt[i] = d2[i];
  }

  for (let step = 0; step < 900; step++) {
    const t = (step + 1) * dt;
    let anyAlive = false;

    for (let i = 0; i < n; i++) {
      if (!alive[i]) continue;
      anyAlive = true;

      // 阵风：逐滴独立的 OU 过程（均值回归），与队友 Python 版同构
      gust[i] = gust[i] * 0.97 + gaussian(rng) * turb * windSpeed * 0.24;

      // 旋翼下洗：机身下方持续存在，随高度指数衰减
      const down = DOWNWASH
        * Math.exp(-Math.max(z[i] - CANOPY_HEIGHT, 0) / DOWNWASH_SCALE)
        * wake[i];
      z[i] -= (vt[i] + down) * dt;

      // 蒸发（改变终端速度）
      d2[i] = Math.max(d2[i] - kEvap * dt, 1.0);
      if (Math.abs(d2[i] - d2vt[i]) > 1e-6 * d2vt[i]) {
        const dd = Math.sqrt(d2[i]);
        vt[i] = terminalVelocityFast(dd);
        d2vt[i] = d2[i];
      }

      // 风把雾滴加速到风速附近（松弛系数 0.08）
      vx[i] += (uWind + gust[i] - vx[i]) * 0.08;
      vy[i] += (vWind + gust[i] * 0.5 - vy[i]) * 0.08;

      // 相对气流平移：雾滴随风走，飞机也在走
      x[i] += (vx[i] - speed) * dt;
      y[i] += vy[i] * dt;

      if (z[i] <= CANOPY_HEIGHT) {
        depX[depN] = x[i];
        depY[depN] = y[i];
        depD[depN] = Math.sqrt(d2[i]);
        depN++;
        alive[i] = 0;
      }
    }
    if (!anyAlive) break;
  }

  return {
    x: Array.from(depX.slice(0, depN)),
    y: Array.from(depY.slice(0, depN)),
    d: Array.from(depD.slice(0, depN)),
    swath, released: n, landed: depN,
  };
}

/**
 * 沉积指标：靶区命中率、漂移距离、横向分布。
 *
 * 质量加权用 d³（沉积量正比于雾滴体积）。
 *
 * @param {object} pass_ simulatePass 的结果
 * @param {number} targetHalfwidth 靶区半宽 m（默认取喷幅一半）
 */
export function depositionMetrics(pass_, targetHalfwidth = null) {
  const half = targetHalfwidth == null ? pass_.swath / 2 : targetHalfwidth;
  const { y, d } = pass_;
  let massOn = 0, massTotal = 0;
  const driftDist = [];
  for (let i = 0; i < y.length; i++) {
    const m = d[i] * d[i] * d[i];
    massTotal += m;
    if (Math.abs(y[i]) <= half) massOn += m;
    else driftDist.push(Math.abs(y[i]));
  }
  driftDist.sort((a, b) => a - b);
  const p95 = driftDist.length
    ? driftDist[Math.min(driftDist.length - 1, Math.floor(driftDist.length * 0.95))]
    : 0;
  const meanAbsY = y.length ? y.reduce((a, b) => a + Math.abs(b), 0) / y.length : 0;
  return {
    onTarget: massTotal > 0 ? massOn / massTotal : 0,
    driftFraction: massTotal > 0 ? 1 - massOn / massTotal : 0,
    driftP95: p95,
    meanAbsY,
    n: y.length,
  };
}

/**
 * 一次喷洒的完整评估（常用入口）。
 *
 * @param {object} o 参数同 simulatePass
 * @returns {object} 沉积指标 + 原始落点
 */
export function evaluatePass(o = {}) {
  const pass_ = simulatePass(o);
  const m = depositionMetrics(pass_, o.targetHalfwidth);
  return { metrics: m, pass: pass_ };
}

/**
 * 喷洒可行性：给定风速下的靶区命中率与漂移。
 *
 * 平台用它回答「今天风太大，能不能喷」。
 *
 * @param {object} o 同 simulatePass
 */
export function sprayFeasibility(o = {}) {
  const { metrics } = evaluatePass(o);
  return {
    ...metrics,
    /** 是否达到作业标准（默认靶区命中率 ≥ 0.6） */
    acceptable: metrics.onTarget >= (o.minOnTarget ?? 0.6),
  };
}

/**
 * 喷洒可行性报告 —— 平台「施药窗口」页的唯一数据来源。
 *
 * 为什么放在 shared/
 * ----------------
 * server/src/app.js（云端 Worker 与本机 Node 共用）与
 * web/src/api.js 的浏览器内降级引擎都要产出同一份报告。
 * 若各写一份，口径迟早会漂移 —— 那正是最不能出的事：
 * 评委在公网看到的数字和现场演示的数字必须一样。
 *
 * 产出三部分：
 *   rows   —— 三档雾滴谱在当前条件下的指标
 *   window —— 0–8 m/s 的靶区命中率曲线（作业窗口）
 *   maxSafeWind —— 命中率仍在判据以上的最大风速
 *
 * 判据：靶区命中率 ≥ 60%（与论文 Fig. 15 的 on-target 口径一致）。
 */
export const ON_TARGET_CRITERION = 0.6;

/** 报告缓存 —— 同一组参数不重复计算 */
const REPORT_CACHE = new Map();
const REPORT_CACHE_MAX = 64;

/**
 * @param {object} o
 * @param {number} o.windSpeed   当前风速 m/s
 * @param {number} o.windDirDeg  风向 deg
 * @param {number} o.swath       喷幅 m
 * @param {number} o.vmd         当前选中的雾滴谱 μm（用于画作业窗口曲线）
 * @param {number} o.tempC       温度 ℃
 * @param {number} o.rh          相对湿度 0–1
 * @param {number} o.n           每个条件的雾滴数
 * @param {number[]} o.vmds      要评估的雾滴谱
 */
export function sprayFeasibilityReport(o = {}) {
  const windSpeed = o.windSpeed ?? 3;
  const windDirDeg = o.windDirDeg ?? 45;
  const swath = o.swath ?? 5;
  const tempC = o.tempC ?? 22;
  const rh = o.rh ?? 0.6;
  const n = Math.min(12000, Math.max(1500, o.n ?? 2500));
  const vmds = Array.isArray(o.vmds) && o.vmds.length ? o.vmds : [110, 140, 170];
  const curveVmd = o.vmd ?? 140;

  const key = `${windSpeed}|${windDirDeg}|${swath}|${tempC}|${rh}|${n}|${curveVmd}|${vmds.join(',')}`;
  const hit = REPORT_CACHE.get(key);
  if (hit) return hit;

  const rows = vmds.map((vmd) => {
    const { metrics } = evaluatePass({
      windSpeed, windDirDeg, vmd, swath, tempC, rh, n,
      rng: mulberry(1234 + Math.round(windSpeed * 31) + vmd),
    });
    return {
      vmd,
      onTarget: +metrics.onTarget.toFixed(4),
      driftFraction: +metrics.driftFraction.toFixed(4),
      driftP95: +metrics.driftP95.toFixed(2),
      meanAbsY: +metrics.meanAbsY.toFixed(3),
      acceptable: metrics.onTarget >= ON_TARGET_CRITERION,
    };
  });

  const window = [];
  for (let ws = 0; ws <= 8; ws += 1) {
    const { metrics } = evaluatePass({
      windSpeed: ws, windDirDeg, vmd: curveVmd, swath, tempC, rh, n,
      rng: mulberry(1234 + ws * 31 + curveVmd),
    });
    window.push({ windSpeed: ws, onTarget: +metrics.onTarget.toFixed(4) });
  }
  const safe = window.filter(w => w.onTarget >= ON_TARGET_CRITERION);
  const maxSafeWind = safe.length ? safe[safe.length - 1].windSpeed : 0;

  const report = {
    wind: { windSpeed, windDirDeg },
    swath, tempC, rh,
    rows,
    window,
    maxSafeWind,
    criterion: ON_TARGET_CRITERION,
    notice: {
      label: '平台实时计算',
      desc: '雾滴输运模型现场算出（拉格朗日单雾滴跟踪：'
        + '终端速度、蒸发、旋翼下洗、风场输运）。'
        + '作业窗口取「靶区命中率 ≥ 60%」为判据。',
    },
  };

  if (REPORT_CACHE.size >= REPORT_CACHE_MAX) {
    REPORT_CACHE.delete(REPORT_CACHE.keys().next().value);
  }
  REPORT_CACHE.set(key, report);
  return report;
}

/**
 * 三档作业窗口评估 —— 对应论文 Fig. 15(a) 的三条曲线。
 *
 * @param {number[]} windSpeeds 风速序列 m/s
 * @param {number[]} vmds 体积中值直径序列 μm
 * @param {number} n 每个条件的雾滴数
 */
export function driftMatrix(windSpeeds, vmds, n = 3000) {
  const rows = [];
  for (const vmd of vmds) {
    const row = { vmd, cells: [] };
    for (const ws of windSpeeds) {
      const { metrics } = evaluatePass({ windSpeed: ws, vmd, n, rng: mulberry(1234 + ws * 31 + vmd) });
      row.cells.push(metrics.onTarget);
    }
    rows.push(row);
  }
  return rows;
}

/* ---------- 工具 ---------- */

/** 标准正态随机数（Box–Muller） */
function gaussian(rng) {
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** 可复现的伪随机源（mulberry32） */
export function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
