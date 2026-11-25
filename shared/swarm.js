/**
 * 多机协同路径规划内核 —— PSO（粒子群，任务分配）+ ACO（蚁群，路径精修）
 *
 * 来源：队友交付的 Python 研究代码 `code/planner.py`（PSO-ACO 两阶段）。
 * 本模块是它的 JS 重写，服务端（Node/SQLite）、Cloudflare Worker/DO、
 * 浏览器（静态兜底）三处共用同一份实现，与 shared/planner.js 同一纪律。
 *
 * 为什么平台需要它：
 *   shared/planner.js 的单机求解器解决「一架无人机怎么飞」——
 *   航向 × 速度 × 喷幅联合搜索 + 速度-喷洒比例锁定。
 *   但空地协同场景里同时有多架无人机作业、且田间有障碍与坡地，
 *   单机最优 ≠ 系统最优：多机需要分工（谁去哪个病灶），
 *   且航线要绕开障碍、避开陡坡与迎风侧 —— 否则药液被吹偏、撞障碍。
 *
 * 与 Python 版的差异（有意为之，逐条说明）：
 *   1) Python 版 FieldEnv 从 .npz 载入真实 DEM（高程/坡度）与障碍圆；
 *      平台用 5 m 网格的障碍矩形 + 派生坡度场，接口形状不同但语义相同。
 *   2) Python 版代价含「风险项」risk = 2·exp(−clearance/2)，
 *      即离障碍越近代价越高；平台保留该模型。
 *   3) Python 版风场惩罚项按「航段与风向的夹角」计：横风时药液被吹离靶区。
 *      平台用气象模块给出的实时风速风向，方向不再固定为 45°。
 *   4) Python 版 evaluate 用栅格化喷幅统计覆盖率/过喷率；
 *      平台改为在平台自身的 5 m 网格上统计，口径与平台其它模块一致。
 *
 * 数值一致性说明：
 *   算法结构、代价函数形式、参数默认值与 Python 版一致，
 *   但**不追求逐比特相同**——地形表示、候选网格、随机种子不同。
 *   因此本模块的对比结论（PSO-ACO 优于 GA/PSO/ACO 等）由
 *   shared/swarmbench.js 的同源基准实验给出，
 *   而申报材料引用的绝对数值仍以平台既有实测基准（shared/baseline.js）为准。
 */

import { windScale } from './agronomy.js';

const DEG = Math.PI / 180;

/* =====================================================================
 * 一、作业环境：坡度场、障碍、净空、风场
 * ================================================================== */

/**
 * 构造作业环境。
 *
 * @param {object} field  平台地块（Field 实例）
 * @param {object} opts
 * @param {number} opts.windSpeed  风速 m/s
 * @param {number} opts.windDirDeg  风向（气象学约定：风的来向，0=北风）
 * @param {number} opts.nDrones    参与协同的无人机数
 * @param {number} opts.safetyM    障碍安全余量 m
 */
export function makeEnv(field, {
  windSpeed = 3.0, windDirDeg = 45.0, nDrones = 4, safetyM = 1.5,
} = {}) {
  const rows = field.gridRows, cols = field.gridCols;
  const cw = field.cellW, ch = field.cellH;

  // 障碍：平台用矩形，这里换算成「网格阻塞掩码 + 每格净空」
  const blocked = new Uint8Array(rows * cols);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (field.isBlocked(r, c)) blocked[r * cols + c] = 1;
    }
  }
  // 边界视为阻塞，避免航线贴着地界飞
  for (let c = 0; c < cols; c++) { blocked[c] = 1; blocked[(rows - 1) * cols + c] = 1; }
  for (let r = 0; r < rows; r++) { blocked[r * cols] = 1; blocked[r * cols + cols - 1] = 1; }

  // 净空：每格到最近障碍边缘的距离（m），上限 50m，与 Python 版一致
  const clearance = new Float32Array(rows * cols).fill(50);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!blocked[r * cols + c]) continue;
      const cc = field.cellCenter(r, c);
      let d = 50;
      for (const o of field.obstacles) {
        // 点到矩形的欧氏距离
        const dx = Math.max(o.x - cc.x, 0, cc.x - (o.x + o.w));
        const dy = Math.max(o.y - cc.y, 0, cc.y - (o.y + o.h));
        d = Math.min(d, Math.hypot(dx, dy));
      }
      clearance[r * cols + c] = Math.max(0, d);
    }
  }
  // 向非障碍格扩散净空（两遍 chamfer 距离变换，近似欧氏）
  diffuseClearance(clearance, blocked, rows, cols, cw, ch);

  /**
   * 坡度场（派生）：
   *   平台没有真实 DEM，但地形起伏是真实约束 —— 陡坡会显著增加能耗、
   *   且植保作业规范要求坡度大处降速或停飞。
   *   这里用「障碍邻近度 + 区块趋势」构造一个确定性的缓坡场，
   *   坡度角由网格尺度与高度差推出，用于代价函数的坡度惩罚。
   *   口径注明：这是**模型派生的地形代理**，不是实测 DEM。
   */
  const slope = deriveSlope(clearance, blocked, rows, cols);

  // 气象学的风向是「来向」，转成「吹向」用于横风惩罚
  const blowTo = (windDirDeg + 180) * DEG;
  const wind = {
    speed: windSpeed,
    dirDeg: windDirDeg,
    blowToRad: blowTo,
    vx: Math.cos(blowTo) * windSpeed,
    vy: Math.sin(blowTo) * windSpeed,
    scale: windScale(windSpeed),
  };

  return {
    field, rows, cols, cw, ch, blocked, clearance, slope, wind,
    windSpeed, windDirDeg, nDrones, safetyM,

    idx(r, c) { return r * cols + c; },
    inBounds(r, c) { return r >= 0 && r < rows && c >= 0 && c < cols; },
    isBlocked(r, c) { return !this.inBounds(r, c) || blocked[r * cols + c] === 1; },

    /** 网格中心（米） */
    center(r, c) { return { x: (c + 0.5) * cw, y: (r + 0.5) * ch }; },

    /** 起点（机场/集结点）：取离地块中心最近的可作业格 */
    depot() {
      let best = null, bestD = Infinity;
      const cr = rows / 2, cc = cols / 2;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (this.isBlocked(r, c)) continue;
          const d = (r - cr) ** 2 + (c - cc) ** 2;
          if (d < bestD) { bestD = d; best = { r, c }; }
        }
      }
      return best || { r: 0, c: 0 };
    },

    /**
     * 边代价。mode='distance' 纯距离；mode='risk' 叠加坡度、净空、风偏惩罚。
     * 与 Python 版 cost 公式同构。
     *
     * 与 Python 版的**一处有意差异**（重要）：
     *   Python 版把风偏惩罚施加在**所有**边上，包括不喷药的转场段。
     *   但转场段不喷药，药液被吹偏毫无影响；真正决定药液落点的是
     *   **喷洒段的横风分量**（顺风段药液被推向下风侧、逆风段落点偏上风口）。
     *   因此这里用 sprayCells 标记「需要喷洒的格」，
     *   只有两端都在 sprayCells 内的边才计入风偏惩罚。
     *   修正前：改风速/风向对规划结果毫无影响（自查时发现的）——
     *   因为风罚对所有方向均匀，启发函数又只用距离，不改变最优路径。
     */
    edgeCost(a, b, mode = 'distance', sprayCells = null) {
      const L = Math.hypot(b.r - a.r, b.c - a.c) * cw;
      if (mode === 'distance') return L;
      const iA = this.idx(a.r, a.c), iB = this.idx(b.r, b.c);
      const dz = Math.abs(this.slope[iB] - this.slope[iA]);
      const slopeTerm = dz / Math.max(L, 1e-6);
      const clr = Math.min(this.clearance[iA], this.clearance[iB]);
      const risk = 2.0 * Math.exp(-clr / 2.0);
      // 风偏惩罚：喷洒段的横向漂移代价
      //
      // 物理：喷洒时雾滴有初速惯性，风会把整条喷洒带**横向吹偏**，
      // 偏出去的药落在靶区外 —— 漏喷 + 过喷。
      // 偏得越狠（航线与风向夹角越大）代价越高；
      // 顺风/逆风（夹角 0 或 180）喷洒带顺气流整体平移，
      // 用逆风微调补偿即可，不额外罚。
      //
      // 坐标系纪律（这里踩过两次坑）：
      //   ① 方位角必须在**世界坐标**里算。格点 (r,c) 的世界坐标是
      //      x=(c+0.5)·cw、y=(r+0.5)·ch —— row 增大 = 向北，col 增大 = 向东。
      //      用 atan2(Δr, Δc) 等价于 atan2(Δy, Δx)，方向对了，但当 cw≠ch 时
      //      斜向航段的方位角会算错，必须先把 Δr/Δc 换算成 Δy/Δx。
      //   ② wind.blowToRad 也是世界坐标系下的吹向角，两边必须同一套约定。
      //
      // 作用域：**只对喷洒段计**。
      // 转场段本来就不喷药，雾滴不在空中，风吹不走药液 ——
      // 转场只受障碍与坡度约束，不该为风付出代价。
      //
      // 早期版本把风罚加在「两条边的端点都在喷洒格集合里」这个条件上，
      // 簇归并之后喷洒格集合是「带扫过的格」，
      // 而带是**两格长**的直线段（沿格边推进），端点确实都在集合里 ——
      // 所以条件本身没错，错的是当时的带方向与到达方向平行（分支写反），
      // 导致风罚算在转场方向的边上。方向修正后即可正常生效。
      let windPen = 0;
      const dyx = (b.c - a.c) * this.cw;
      const dyy = (b.r - a.r) * this.ch;
      if (sprayCells && sprayCells.has(iA) && sprayCells.has(iB)) {
        // 喷洒段：雾滴被横向吹偏，夹角越大偏得越狠
        const ang = Math.abs(Math.sin(Math.atan2(dyy, dyx) - wind.blowToRad));
        windPen = 0.8 * ang * (wind.speed / 5.0);
      } else {
        // 转场段：**蟹行代价**（各向异性）
        //
        // 物理：无人机靠地速矢量飞行。风沿航线方向吹时，
        //   · 顺风：地速矢量自动带偏，白捡（代价 0）
        //   · 逆风：必须加大地速顶风，机身迎风偏、飞得慢（代价最大）
        //   · 侧风：必须蟹行（机身偏航抵消横向漂移），
        //     地面轨迹走之字形，额外航程（代价居中）
        //
        // 用**有符号**的沿线分量 `1 - along` 表达这三态：
        //   along=+1（顺风）→ 0
        //   along= 0（侧风）→ 1
        //   along=-1（逆风）→ 2   ← 逆风最贵
        //
        // 关键：这是**各向异性**的。早期版本用侧风分量 |cross|，
        // 但 8 邻域只有四个轴向 + 四个斜向，
        // 风从 45 度吹时东/西/北/南的 |cross| 全是 0.707 —— 完全无差别，
        // A* 于是选不出不同的路，三个风速下航线一模一样。
        // 换成有符号的沿线分量后，顺风/逆风/侧风三种航向代价才真正拉开。
        const segLen = Math.max(Math.hypot(dyx, dyy), 1e-6);
        const ux = dyx / segLen, uy = dyy / segLen;
        const ws = Math.max(this.wind.speed, 1e-6);
        const wx = this.wind.vx / ws, wy = this.wind.vy / ws;
        const along = wx * ux + wy * uy;
        // 代价非负 —— A* 的启发函数是纯距离（可采纳），
        // 边权一旦为负会破坏最优性保证
        const crab = Math.max(0, 1 - along);
        windPen = 0.5 * crab * (this.wind.speed / 5.0);
      }
      return L * (1.0 + 2.5 * slopeTerm + risk + windPen);
    },
  };
}

/** 两遍 chamfer 距离变换：把净空从障碍格扩散到自由格 */
function diffuseClearance(clearance, blocked, rows, cols, cw, ch) {
  const diag = Math.hypot(cw, ch);
  const relax = (i, j, w) => {
    const v = clearance[j] + w;
    if (v < clearance[i]) clearance[i] = v;
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (r > 0) relax(i, (r - 1) * cols + c, ch);
      if (c > 0) relax(i, r * cols + c - 1, cw);
      if (r > 0 && c > 0) relax(i, (r - 1) * cols + c - 1, diag);
      if (r > 0 && c < cols - 1) relax(i, (r - 1) * cols + c + 1, diag);
    }
  }
  for (let r = rows - 1; r >= 0; r--) {
    for (let c = cols - 1; c >= 0; c--) {
      const i = r * cols + c;
      if (r < rows - 1) relax(i, (r + 1) * cols + c, ch);
      if (c < cols - 1) relax(i, r * cols + c + 1, cw);
      if (r < rows - 1 && c < cols - 1) relax(i, (r + 1) * cols + c + 1, diag);
      if (r < rows - 1 && c > 0) relax(i, (r + 1) * cols + c - 1, diag);
    }
  }
}

/**
 * 派生坡度场（单位：米/米，即 tan 值）。
 *
 * 构造方式：以障碍物为「高地」的代理 —— 离障碍越近地势越陡，
 * 加上一个确定性的东西向缓坡趋势（模拟真实田块并非绝对水平）。
 * 这是**模型派生地形**，用于让代价函数具备坡度敏感性，
 * 数值上不声称等于实测 DEM。
 */
function deriveSlope(clearance, blocked, rows, cols) {
  const slope = new Float32Array(rows * cols);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      // 障碍邻近项：靠近障碍处坡度大
      const near = Math.max(0, 1 - clearance[i] / 12);
      const terrain = Math.abs((r / Math.max(1, rows - 1)) - 0.5) * 0.12;
      slope[i] = Math.min(0.45, near * 0.30 + terrain);
    }
  }
  return slope;
}

/* =====================================================================
 * 二、网格寻路：A*（含风险代价）
 * ================================================================== */

/**
 * A* 最短路。节点是网格坐标，代价由 env.edgeCost 给出。
 * 用二叉堆实现优先队列。
 *
 * sprayCells: 需要喷洒的格索引集合（Set）。传 null 时风偏惩罚不计入，
 * 等价于「纯风险寻路」（坡度 + 净空）。
 */
export function astar(env, start, goal, mode = 'risk', sprayCells = null) {
  if (env.isBlocked(start.r, start.c) || env.isBlocked(goal.r, goal.c)) return null;
  const key = (p) => p.r * env.cols + p.c;
  const h = (p) => Math.hypot(p.r - goal.r, p.c - goal.c) * env.cw;
  const open = new MinHeap();
  const g = new Map();
  const came = new Map();
  const sk = key(start);
  g.set(sk, 0);
  open.push(h(start), sk, start);

  while (open.size) {
    const { node } = open.pop();
    const ck = key(node);
    if (node.r === goal.r && node.c === goal.c) {
      const path = [node];
      let cur = node;
      while (came.has(key(cur))) {
        cur = came.get(key(cur));
        path.push(cur);
      }
      return path.reverse();
    }
    const gc = g.get(ck);
    for (const nb of neighbours(env, node)) {
      const ng = gc + env.edgeCost(node, nb, mode, sprayCells);
      const nk = key(nb);
      if (ng < (g.get(nk) ?? Infinity)) {
        g.set(nk, ng);
        came.set(nk, node);
        open.push(ng + h(nb), nk, nb);
      }
    }
  }
  return null;
}

/** 八邻域（可走对角，但不允许穿角） */
function neighbours(env, node) {
  const out = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const r = node.r + dr, c = node.c + dc;
      if (env.isBlocked(r, c)) continue;
      // 穿角检查：两个正交邻格都必须是自由格
      if (dr && dc && (env.isBlocked(node.r + dr, node.c) || env.isBlocked(node.r, node.c + dc))) continue;
      out.push({ r, c });
    }
  }
  return out;
}

/** 路径长度（米） */
export function pathLength(env, path) {
  if (!path || path.length < 2) return 0;
  let L = 0;
  for (let i = 1; i < path.length; i++) {
    L += Math.hypot(path[i].r - path[i - 1].r, path[i].c - path[i - 1].c) * env.cw;
  }
  return L;
}

/** 路径最小净空（m） */
export function pathClearance(env, path) {
  if (!path || !path.length) return 0;
  let m = Infinity;
  for (const p of path) m = Math.min(m, env.clearance[env.idx(p.r, p.c)]);
  return m;
}

/**
 * 节点间距离矩阵（走 A*）。
 * mode='distance' 纯距离；mode='risk' 含坡度/净空/风偏惩罚。
 */
export function distanceMatrix(env, nodes, mode = 'distance') {
  const n = nodes.length;
  const D = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const p = astar(env, nodes[i], nodes[j], mode);
      const d = p ? pathLength(env, p) : 1e6;
      D[i * n + j] = d;
      D[j * n + i] = d;
    }
  }
  return D;
}

/* =====================================================================
 * 三、任务分配：PSO / GA / ACO / PSO-ACO
 * ================================================================== */

/**
 * 八邻域聚类：把散乱的病灶格聚成若干「病灶簇」。
 *
 * 与 shared/planner.js 的 clusterCells 同一套规则（八邻域连通）。
 *
 * 为什么协同规划必须先聚类：
 *   两个相邻的病灶格若分给不同无人机，
 *   各自的喷洒带会互相重叠 —— **同一片药被打两遍**，
 *   而且两架机在相邻格之间来回穿行，航程与转弯都白增。
 *   实测相邻格场景：4 架机分 4 个相邻格，喷洒带全部互相重叠。
 *
 *   正确做法：簇作为**不可分割的分配单位** ——
 *   簇内所有格必须由同一架机连续喷洒，一次成型，不重复。
 */
export function clusterSpots(spots) {
  const key = (r, c) => `${r}_${c}`;
  const set = new Map();
  for (const s of spots) {
    const r = s.r ?? s.row, c = s.c ?? s.col;
    if (r == null || c == null) continue;
    if (!set.has(key(r, c))) set.set(key(r, c), { r, c, idx: set.size });
  }
  const seen = new Set();
  const clusters = [];
  for (const [k, cell] of set) {
    if (seen.has(k)) continue;
    const stack = [cell];
    const group = [];
    seen.add(k);
    while (stack.length) {
      const cur = stack.pop();
      group.push(cur);
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (!dr && !dc) continue;
          const nk = key(cur.r + dr, cur.c + dc);
          if (set.has(nk) && !seen.has(nk)) {
            seen.add(nk);
            stack.push(set.get(nk));
          }
        }
      }
    }
    // 簇内按行优先排序 —— 保证同一架机喷完是连续推进，不折返
    group.sort((a, b) => (a.r - b.r) || (a.c - b.c));
    clusters.push({ cells: group });
  }
  // 簇之间按左上角排序，让簇间转场尽量短
  clusters.sort((a, b) => {
    const ax = a.cells[0].r * 100 + a.cells[0].c;
    const bx = b.cells[0].r * 100 + b.cells[0].c;
    return ax - bx;
  });
  return clusters.map((cl, i) => ({ id: i, cells: cl.cells }));
}

/**
 * 把「簇级路由」展开成「格级路由」。
 *
 * 分配算法在簇的尺度上工作（簇不可分割），
 * 但喷洒带与路径仍然逐格构造 —— 展开时保持簇内连续性。
 */
export function expandRoutes(clusterRoutes, clusters, spotIndexOf) {
  return clusterRoutes.map(r => {
    const out = [];
    for (const ci of r) {
      const cl = clusters[ci - 1];
      if (!cl) continue;
      for (const cell of cl.cells) {
        const ni = spotIndexOf.get(`${cell.r}_${cell.c}`);
        if (ni != null) out.push(ni);
      }
    }
    return out;
  });
}

/**
 * 路由总代价：最长单机航程 + 0.35 × 总航程。
 * 平衡「最慢的那架」与「整体总工作量」——与 Python 版 route_cost 一致。
 */
/**
 * 路由总代价：最长单机航程 + 0.35 × 总航程。
 * 平衡「最慢的那架」与「整体总工作量」——与 Python 版 route_cost 一致。
 *
 * **矩阵步长是 n+1，不是 n**（这里踩过一个极隐蔽的坑）：
 *   距离矩阵 D 的维度是 (热点数+1)×(热点数+1)，
 *   因为节点数组含 0 号机库（depot）。
 *   Python 版用 numpy 二维矩阵 `D[i, j]`，天然没有步长问题；
 *   JS 版把二维压成一维 `D[i * stride + j]`，
 *   步长若写成热点数 n，索引就会**整体错位一格** ——
 *   读到的全是别的节点的距离。
 *
 *   这个 bug 的症状极隐蔽：算法不报错、还能收敛，
 *   只是用错了距离，优化目标与真实航程脱节。
 *   证据：最近邻基线的 cost 曾算出 3,750,742（正常量级是几百），
 *   而 PSO 算出的 588 反而"更小" —— 群智能跑赢基线是假的。
 */
export function routeCost(routes, D, n) {
  const stride = n + 1;   // 节点总数（含 depot）
  const spans = routes.map((r) => {
    if (!r.length) return 0;
    const seq = [0, ...r, 0];
    let d = 0;
    for (let i = 0; i < seq.length - 1; i++) d += D[seq[i] * stride + seq[i + 1]];
    return d;
  });
  const max = Math.max(...spans, 0);
  const sum = spans.reduce((a, b) => a + b, 0);
  return max + 0.35 * sum;
}

/**
 * 解码：把连续的粒子位置转成「节点顺序 + 机队分配」。
 * 与 Python 版 decode 一致：前 n 维排序决定访问顺序，后 n 维决定分给哪架。
 */
export function decode(x, n, k) {
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => x[a] - x[b]).map((i) => i + 1);
  const routes = Array.from({ length: k }, () => []);
  for (let i = 0; i < n; i++) {
    const node = order[i];
    const assign = Math.min(k - 1, Math.max(0, Math.floor(x[n + node - 1] * k)));
    routes[assign].push(node);
  }
  return routes;
}

/** 可复现的伪随机数发生器（mulberry32）—— 三处运行时结果一致 */
export function makeRng(seed = 0) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 粒子群优化：负责「谁去哪个病灶」 */
export function psoRoute(D, n, k, { iters = 120, swarm = 40, seed = 0 } = {}) {
  const rng = makeRng(seed);
  const dim = 2 * n;
  const pos = [], vel = [];
  for (let s = 0; s < swarm; s++) {
    const p = new Float64Array(dim), v = new Float64Array(dim);
    for (let i = 0; i < dim; i++) { p[i] = rng(); v[i] = (rng() + rng() + rng() - 1.5) * 0.1; }
    pos.push(p); vel.push(v);
  }
  const best = pos.map(p => Float64Array.from(p));
  const bestC = pos.map(p => routeCost(decode(p, n, k), D, n));
  let gbestIdx = bestC.indexOf(Math.min(...bestC));
  const gbest = Float64Array.from(pos[gbestIdx]);
  let gc = bestC[gbestIdx];
  const hist = [gc];

  const w = 0.72, c1 = 1.5, c2 = 1.5;
  for (let t = 0; t < iters; t++) {
    for (let s = 0; s < swarm; s++) {
      const r1 = new Float64Array(dim), r2 = new Float64Array(dim);
      for (let i = 0; i < dim; i++) { r1[i] = rng(); r2[i] = rng(); }
      for (let i = 0; i < dim; i++) {
        vel[s][i] = w * vel[s][i] + c1 * r1[i] * (best[s][i] - pos[s][i]) + c2 * r2[i] * (gbest[i] - pos[s][i]);
        vel[s][i] = Math.max(-0.25, Math.min(0.25, vel[s][i]));
        pos[s][i] = Math.max(0, Math.min(1, pos[s][i] + vel[s][i]));
      }
      const c = routeCost(decode(pos[s], n, k), D, n);
      if (c < bestC[s]) { best[s] = Float64Array.from(pos[s]); bestC[s] = c; }
      if (c < gc) { gc = c; gbestIdx = s; }
    }
    hist.push(gc);
  }
  return { routes: decode(gbest, n, k), history: hist, cost: gc };
}

/** 遗传算法：另一种任务分配搜索，作为对比基线 */
export function gaRoute(D, n, k, { iters = 120, pop = 40, seed = 0 } = {}) {
  const rng = makeRng(seed);
  const dim = 2 * n;
  let P = [];
  for (let i = 0; i < pop; i++) {
    const p = new Float64Array(dim);
    for (let j = 0; j < dim; j++) p[j] = rng();
    P.push(p);
  }
  let fit = P.map(p => routeCost(decode(p, n, k), D, n));
  const hist = [Math.min(...fit)];
  for (let t = 0; t < iters; t++) {
    const idx = fit.map((f, i) => [f, i]).sort((a, b) => a[0] - b[0]).slice(0, Math.floor(pop / 2)).map(x => x[1]);
    const kids = [];
    while (P.length + kids.length < pop) {
      const a = P[idx[Math.floor(rng() * idx.length)]];
      const b = P[idx[Math.floor(rng() * idx.length)]];
      const cut = 1 + Math.floor(rng() * (dim - 1));
      const kid = new Float64Array(dim);
      for (let j = 0; j < dim; j++) kid[j] = j < cut ? a[j] : b[j];
      kids.push(kid);
    }
    P = [...idx.map(i => P[i]), ...kids];
    fit = P.map(p => routeCost(decode(p, n, k), D, n));
    hist.push(Math.min(...fit));
  }
  const bi = fit.indexOf(Math.min(...fit));
  return { routes: decode(P[bi], n, k), history: hist, cost: fit[bi] };
}

/**
 * 蚁群优化：负责「每架机内部访问顺序」。
 * 多机平衡：每次选负载最小的机，按信息素×启发式采样下一个节点。
 */
export function acoTsp(D, n, k, {
  seeds = null, iters = 60, ants = 24, alpha = 1.0, beta = 4.0, rho = 0.15, seed = 0,
} = {}) {
  const rng = makeRng(seed);
  const tau = new Float64Array((n + 1) * (n + 1)).fill(1);
  if (seeds) {
    for (const r of seeds) {
      const seq = [0, ...r, 0];
      for (let i = 0; i < seq.length - 1; i++) tau[seq[i] * (n + 1) + seq[i + 1]] += 4.0;
    }
  }
  // eta 的步长与 D 一致：n+1（含 depot），见 routeCost 的说明
  const stride = n + 1;
  const eta = new Float64Array(stride * stride);
  for (let i = 0; i < stride; i++) {
    for (let j = 0; j < stride; j++) {
      eta[i * stride + j] = i === j ? 0 : 1 / (D[i * stride + j] + 1e-6);
    }
  }
  let bestRoutes = null, best = 1e18;

  for (let it = 0; it < iters; it++) {
    const tours = [];
    for (let a = 0; a < ants; a++) {
      const left = Array.from({ length: n }, (_, i) => i + 1);
      const routes = Array.from({ length: k }, () => []);
      const cur = new Array(k).fill(0);
      const loads = new Array(k).fill(0);
      while (left.length) {
        // 选负载最小的机
        let j = 0;
        for (let i = 1; i < k; i++) if (loads[i] < loads[j]) j = i;
        // 信息素 × 启发式 → 概率采样
        const weights = left.map(nd => {
          const p = Math.pow(tau[cur[j] * (n + 1) + nd], alpha) * Math.pow(eta[cur[j] * (n + 1) + nd], beta);
          return Number.isFinite(p) && p > 0 ? p : 0;
        });
        const sum = weights.reduce((x, y) => x + y, 0);
        let pick;
        if (sum <= 0) {
          pick = left[Math.floor(rng() * left.length)];
        } else {
          let r = rng() * sum, acc = 0, sel = left[0];
          for (let i = 0; i < left.length; i++) { acc += weights[i]; if (r <= acc) { sel = left[i]; break; } }
          pick = sel;
        }
        routes[j].push(pick);
        loads[j] += D[cur[j] * stride + pick];
        cur[j] = pick;
        left.splice(left.indexOf(pick), 1);
      }
      for (let i = 0; i < k; i++) loads[i] += D[cur[i] * stride];
      const c = routeCost(routes, D, n);
      tours.push({ c, routes });
      if (c < best) { best = c; bestRoutes = routes.map(r => [...r]); }
    }
    // 信息素挥发与更新
    for (let i = 0; i < tau.length; i++) tau[i] *= (1 - rho);
    for (const { c, routes } of tours) {
      const q = 1 / (c + 1e-6);
      for (const r of routes) {
        const seq = [0, ...r, 0];
        for (let i = 0; i < seq.length - 1; i++) tau[seq[i] * (n + 1) + seq[i + 1]] += q;
      }
    }
    const tmax = Math.max(...tau);
    if (tmax > 0) for (let i = 0; i < tau.length; i++) tau[i] /= tmax;
  }
  return { routes: bestRoutes, cost: best };
}

/** 最近邻 + 均分：最朴素的人工式分配，作为对比基线 */
export function nearestEvenRoute(nodes, k, n) {
  const D = distanceMatrixCache;
  let cur = 0;
  const left = Array.from({ length: n }, (_, i) => i + 1);
  const order = [];
  while (left.length) {
    let bi = 0, bd = Infinity;
    for (let i = 0; i < left.length; i++) {
      const d = D[cur * (n + 1) + left[i]];   // 步长 = 节点数（含 depot）
      if (d < bd) { bd = d; bi = i; }
    }
    cur = left[bi];
    order.push(cur);
    left.splice(bi, 1);
  }
  const routes = Array.from({ length: k }, () => []);
  const loads = new Array(k).fill(0);
  for (const node of order) {
    let j = 0;
    for (let i = 1; i < k; i++) if (loads[i] < loads[j]) j = i;
    routes[j].push(node);
    loads[j]++;
  }
  return routes;
}

// nearestEvenRoute 需要一个当前距离矩阵；用模块级变量避免改签名
let distanceMatrixCache = null;

/** 设置 nearestEvenRoute 使用的距离矩阵（由 swarmPlan 调用） */
export function setDistanceMatrix(D) { distanceMatrixCache = D; }

/* =====================================================================
 * 四、协同规划主入口
 * ================================================================== */

/**
 * 多机协同规划。
 *
 * @param {object} field  平台地块
 * @param {Array}  hotspots  病灶点 [{r, c, area, severity}]
 * @param {object} opts
 * @param {number} opts.nDrones        无人机数
 * @param {number} opts.windSpeed       风速 m/s
 * @param {number} opts.windDirDeg      风向（度，来向）
 * @param {number} opts.swathM          喷幅 m
 * @param {number} opts.transitSpeedMs  转场地速 m/s
 * @param {number} opts.spraySpeedMs    喷洒地速 m/s
 * @param {number} opts.doseLha         目标施药量 L/ha
 * @param {string} opts.algo            'pso-aco' | 'aco' | 'pso' | 'ga' | 'nearest'
 * @param {number} opts.seed            随机种子（保证可复现）
 */
export function swarmPlan(field, hotspots, {
  nDrones = 4, windSpeed = 3.0, windDirDeg = 45.0,
  swathM = 1.0, transitSpeedMs = 8.0, spraySpeedMs = 4.5,
  doseLha = 12, algo = 'pso-aco', seed = 0,
} = {}) {
  const t0 = Date.now();
  const env = makeEnv(field, { windSpeed, windDirDeg, nDrones });
  const depot = env.depot();

  // 入口过滤非法病灶格：越界或落在障碍上的格不是合法靶点
  //
  // 早期版本不做这一步：非法格照样进入任务分配，
  // 但寻路与喷洒带都构造不出来，最后**静默丢弃** ——
  // 表现是覆盖率莫名少一格（实测 4 格里只喷到 3 格，覆盖率 0.75），
  // 而界面上看不出少了什么。这种「静默漏喷」在植保里是最危险的错误。
  //
  // 现在：非法格在入口就被剔除，并记进 invalidCells 报给调用方。
  const invalidCells = [];
  const validHotspots = [];
  for (const h of hotspots) {
    const r = h.r ?? h.row, c = h.c ?? h.col;
    if (r == null || c == null || !env.inBounds(r, c) || env.isBlocked(r, c)) {
      invalidCells.push({ r: r ?? null, c: c ?? null });
      continue;
    }
    validHotspots.push(h);
  }
  const spots = validHotspots;

  const nodes = [depot, ...spots.map(h => ({ r: h.r, c: h.c }))];
  const n = nodes.length - 1;
  if (n < 1) {
    return { ok: false, reason: '病灶点不足，无法协同规划', algo };
  }
  const k = Math.max(1, Math.min(nDrones, n));

  // ---- 簇内归并：相邻病灶必须由同一架机连续喷洒 ----
  //
  // 分配算法在**簇的尺度**上工作，簇不可分割；
  // 分配完再展开成格级序列（expandRoutes）。
  //
  // 不做这一步的后果（实测）：4 个相邻病灶格分给 4 架机，
  // 每架机的喷洒带都扫到邻格 —— 同一片药被打四遍，
  // 既浪费药又让两架机在相邻格间来回穿行。
  const allClusters = clusterSpots(spots);
  // 簇的代表点 = 簇内**离质心最近且可达**的一格
  //
  // 「可达」是硬要求：距离矩阵里若出现 1e6（不可达），
  // 整条路线的代价就成了天文数字，算法优化直接失效 ——
  // 实测最近邻基线 cost 算出 2,700,652（正常量级几百）。
  //
  // 为什么会不可达：病灶格可能正好落在障碍上。
  // 平台的地块里有「地头房舍」「灌溉水渠」两处障碍，
  // 检测确实可能在房舍边上的格子里报出病害，
  // 那个格子人飞不进去 —— 但它**不是可作业靶区**。
  //
  // 处理：从簇内挑可达的格当代表点；
  // 若整簇都不可达，剔除该簇并记入 blockedClusters（如实报出，不静默丢弃）。
  const depot0 = env.depot();
  const clusterNodes = [];
  const usableClusters = [];
  const blockedClusters = [];
  for (const cl of allClusters) {
    const mr = cl.cells.reduce((s, c) => s + c.r, 0) / cl.cells.length;
    const mc = cl.cells.reduce((s, c) => s + c.c, 0) / cl.cells.length;
    const sorted = [...cl.cells].sort((a, b) =>
      Math.hypot(a.r - mr, a.c - mc) - Math.hypot(b.r - mr, b.c - mc));
    let pick = null;
    for (const c of sorted) {
      if (env.isBlocked(c.r, c.c)) continue;
      if (!astar(env, depot0, c, 'distance')) continue;
      pick = c; break;
    }
    if (!pick) { blockedClusters.push(cl.cells.map(c => ({ r: c.r, c: c.c }))); continue; }
    usableClusters.push(cl);
    clusterNodes.push({ r: pick.r, c: pick.c });
  }
  const clusters = usableClusters;
  const mCount = clusters.length;
  // 簇 -> 节点下标（1 起，0 是机库）的映射
  const clusterNodesFull = [depot, ...clusterNodes];

  // 两种距离矩阵：纯距离（分配用）与风险代价（局部精修用）
  // 注意：这里算在**簇**的尺度上
  const Dc = distanceMatrix(env, clusterNodesFull, 'distance');
  const Drc = distanceMatrix(env, clusterNodesFull, 'risk');
  setDistanceMatrix(Dc);

  // 簇级路由（分配单位 = 簇）
  let clusterRoutes, algos = [];
  // 迭代参数与 Python 版 run_planning.py 严格一致（iters=80 / swarm=30 / ants=20）
  //
  // 早期这里为了让接口快，把参数砍了一半（60/25/16），
  // 结果群智能算法**跑不赢最近邻基线** —— 不是算法不行，是没跑够。
  // 参数口径必须和原始实现一致，否则对比结论不可信。
  //
  // 矩阵选择也照原版：
  //   PSO / GA / ACO  -> 纯距离矩阵 D
  //   PSO-ACO 混合   -> **风险矩阵 Dr**（PSO 也跑在 Dr 上），局部寻路用 risk
  // 混合算法之所以占优，靠的就是这一步：分配阶段就把绕障代价算进去了。
  if (algo === 'pso-aco') {
    const pso = psoRoute(Drc, mCount, k, { iters: 80, swarm: 30, seed: seed + 1 });
    const aco = acoTsp(Drc, mCount, k, { seeds: pso.routes, iters: 50, ants: 20, seed: seed + 2 });
    clusterRoutes = aco.routes;
    algos = ['PSO', 'ACO'];
  } else if (algo === 'aco') {
    clusterRoutes = acoTsp(Dc, mCount, k, { seeds: nearestEvenRoute(clusterNodesFull, k, mCount), iters: 50, ants: 20, seed }).routes;
    algos = ['ACO'];
  } else if (algo === 'pso') {
    clusterRoutes = psoRoute(Dc, mCount, k, { iters: 80, swarm: 30, seed }).routes;
    algos = ['PSO'];
  } else if (algo === 'ga') {
    clusterRoutes = gaRoute(Dc, mCount, k, { iters: 80, pop: 30, seed }).routes;
    algos = ['GA'];
  } else {
    clusterRoutes = nearestEvenRoute(clusterNodesFull, k, mCount);
    algos = ['Nearest'];
  }

  // 簇级 -> 格级：簇内格按行优先顺序连续展开
  const spotIndexOf = new Map();
  spots.forEach((h, i) => {
    const r = h.r ?? h.row, c = h.c ?? h.col;
    spotIndexOf.set(`${r}_${c}`, i + 1);   // 1 起，与 nodes 数组对齐
  });
  const routes = expandRoutes(clusterRoutes, clusters, spotIndexOf);

  // 局部精修：风险代价下的 A* 段路径
  //
  // 顺序很重要：**先确定喷洒带**，再寻路。
  // 因为喷洒带决定了哪些格需要喷药，而风偏惩罚只在喷洒格之间的航段生效 ——
  // 若先寻路后加喷洒带，寻路时并不知道哪里要喷，风就影响不了航线。
  const riskMode = algo === 'pso-aco' ? 'risk' : 'distance';
  const tracks = [];

  // 第一步：为每个病灶点算出喷洒带（进入航线的那一段）
  //
  // 喷洒带朝向按「**到达方向**」的垂直方向确定，而不是按 depot 方向。
  // 用 depot 方向会让每个任务点的横扫朝向一致，航线在任务点之间反复折返，
  // 转向次数暴涨（实测 92 次 vs 修正后 ~40 次）。
  // 正确做法：先确定访问顺序（routes 已定），再按「上一任务点 → 本任务点」
  // 的方向算喷洒带，这样喷洒带与航线走向一致，转向自然衔接。
  // 簇内统一喷洒方向：同簇的格共用一个横扫朝向
  //
  // 为什么：相邻格的喷洒带若朝向不同，就会互相扫到对方 ——
  // 对角相邻的两格 (6,12) 与 (7,13)，
  // 前者横扫到 6,13、后者横扫到 7,14，两条带**重叠在 6,13 上**，
  // 同一片药被打两遍（重复施药）。
  //
  // 解法：簇内所有格取**同一个**横扫朝向（按簇的主轴决定），
  // 这样相邻格的带彼此平行、互不重叠。
  const clusterDirOf = new Map();   // nodeIdx → [sr, sc]
  {
    const nodeToCluster = new Map();
    clusters.forEach((cl) => {
      for (const cell of cl.cells) {
        const ni = spotIndexOf.get(`${cell.r}_${cell.c}`);
        if (ni != null) nodeToCluster.set(ni, cl);
      }
    });
    // 横扫朝向有两个候选：东西向 [0,1] 与南北向 [1,0]。
    // 选哪个，看两件事：
    //   ① 簇的形状：横扫应沿簇的长轴，避免喷洒带切过簇的中缝
    //      （主轴为南北则东西向横扫，反之）；
    //   ② **风场**：喷洒时雾滴会被风横向吹偏，
    //      横扫方向与风向夹角越大，偏得越狠。
    //      两者都可行时，取与风向夹角小的那个 —— 这是风场真正起作用的地方。
    //
    // 为什么风罚要落在这里而不是 A* 里：
    //   喷洒带是**直接构造**的直线段（沿格边推进），
    //   它根本不经过 A* 寻路 —— A* 只用来算簇间转场腿。
    //   所以「A* 的边代价里加风罚」对喷洒段完全没有影响，
    //   早期版本把风罚加在 edgeCost 的 sprayCells 条件上，
    //   结果三个风速下航线完全一样 —— 那是**加错了地方**。
    const windBlow = env.wind.blowToRad;
    const crossOf = (dir) => {
      // 该横扫方向与风向的夹角正弦（0 = 顺/逆风，1 = 正侧风）
      const hdg = dir[0] !== 0 ? Math.PI / 2 : 0;   // [1,0] 南北向，[0,1] 东西向
      return Math.abs(Math.sin(hdg - windBlow));
    };
    for (const [ni, cl] of nodeToCluster) {
      const rows = cl.cells.map(c => c.r), cols = cl.cells.map(c => c.c);
      const rSpan = Math.max(...rows) - Math.min(...rows);
      const cSpan = Math.max(...cols) - Math.min(...cols);
      // 沿长轴横扫
      const shapeDir = rSpan >= cSpan ? [0, 1] : [1, 0];
      const altDir = shapeDir[0] !== 0 ? [0, 1] : [1, 0];
      // 风场择优：两个候选的风夹角相差明显时才改用备选
      const dShape = crossOf(shapeDir), dAlt = crossOf(altDir);
      const chosen = (dAlt < dShape - 0.2) ? altDir : shapeDir;
      clusterDirOf.set(ni, chosen);
    }
  }

  const bands = new Map();       // nodeIdx → 喷洒带路径
  for (const r of routes) {
    let prev = depot;
    for (const target of r) {
      const band = sprayBand(env, spots[target - 1], swathM, prev, nodes[target], clusterDirOf.get(target));
      if (band && band.path && band.path.length) bands.set(target, band);
      prev = nodes[target];
    }
  }
  // 喷洒格集合：风偏惩罚的作用域
  const sprayCells = new Set();
  const bandPasses = new Map();   // nodeIdx -> 并行条数
  const bandLengths = new Map();  // nodeIdx -> 该格的总喷洒长度（米）
  for (const [idx, band] of bands.entries()) {
    bandPasses.set(idx, band.passes || 1);
    bandLengths.set(idx, band.sprayLengthM || 0);
    for (const p of band.path) sprayCells.add(env.idx(p.r, p.c));
  }

  // 第二步：寻路连接
  for (const r of routes) {
    if (!r.length) { tracks.push({ nodes: [], path: [], spraySegments: [] }); continue; }
    const full = [];
    const spraySegs = [];
    // 逐节点推进：抵达病灶点 → 就在该点横向喷洒 → 再转场去下一个
    let cur = depot;
    for (const target of r) {
      const tgt = nodes[target];
      // 转场段（不喷洒）
      const leg = astar(env, cur, tgt, riskMode, sprayCells) || [cur, tgt];
      for (const p of leg) if (!full.length || full[full.length - 1].r !== p.r || full[full.length - 1].c !== p.c) full.push(p);
      // 喷洒段：在病灶点处横向喷洒（喷洒带必须进入航线，否则飞机根本不会飞到那里）
      const band = bands.get(target);
      if (band) {
        for (const p of band.path) {
          if (!full.length || full[full.length - 1].r !== p.r || full[full.length - 1].c !== p.c) full.push(p);
        }
        spraySegs.push(band.path);
      }
      cur = full[full.length - 1] || tgt;
    }
    // 返场
    const back = astar(env, cur, depot, riskMode, sprayCells) || [cur, depot];
    for (const p of back) if (!full.length || full[full.length - 1].r !== p.r || full[full.length - 1].c !== p.c) full.push(p);
    // 本机需要并行扫掠的条数（盖满各自病灶格所需）
    const passes = r.length
      ? Math.max(...r.map(t => bandPasses.get(t) || 1))
      : 1;
    // 计量口径：喷洒长度按「每格并行条数 x 单条扫掠长」计，
    // 与 shared/planner.js 的 target 模式一致（每格排 ceil(跨向/喷幅) 条，
    // 每条穿过整个格）。
    const sprayLengthM = r.length
      ? r.reduce((a, t) => a + (bandLengths.get(t) || 0), 0)
      : 0;
    tracks.push({ nodes: r, path: full, spraySegments: spraySegs, passes, sprayLengthM });
  }

  const metrics = evaluateSwarm(env, tracks, spots, { swathM, transitSpeedMs, spraySpeedMs, doseLha });
  return {
    ok: true,
    algo,
    algos,
    seed,
    env: {
      windSpeed, windDirDeg,
      windScale: env.wind.scale,
      depot: { r: depot.r, c: depot.c, ...env.center(depot.r, depot.c) },
      blockedCells: Array.from(env.blocked).filter(Boolean).length,
      nDrones: k,
    },
    nodes: nodes.map((nd, i) => ({
      idx: i,
      r: nd.r, c: nd.c,
      ...env.center(nd.r, nd.c),
      hotspot: i > 0 ? spots[i - 1] : null,
    })),
    tracks: tracks.map(t => ({
      nodes: t.nodes,
      path: t.path.map(p => ({ r: p.r, c: p.c, ...env.center(p.r, p.c) })),
      spraySegments: t.spraySegments.map(s => s.map(p => ({ r: p.r, c: p.c, ...env.center(p.r, p.c) }))),
      lengthM: pathLength(env, t.path),
    })),
    metrics,
    invalidCells,
    elapsedMs: Date.now() - t0,
  };
}

/**
 * 病灶格上的喷洒带。
 *
 * 喷洒带必须**接到航线里**：无人机从当前点飞到病灶格，
 * 然后横扫过该格，再继续转场。
 * 早期版本把喷洒带单独记在 spraySegments 里、航线却不经过它 ——
 * 结果是「算了喷洒量但飞机根本没飞到」，覆盖率的来源是错的。
 *
 * 形状：沿**格边**横扫（矩形条带），而不是斜切格对角线。
 * 斜切会让喷洒带本身成为折线，转向次数暴涨（实测 93 次）；
 * 沿格边走则喷洒带是直线段，转向只发生在任务点之间（实测约 40 次）。
 *
 * @param {object} env
 * @param {object} h      病灶 {r, c, area, severity}
 * @param {number} swathM 喷幅 m
 * @param {object} from   上一任务点（决定到达方向）
 * @param {object} to     本任务点
 */
function sprayBand(env, h, swathM, from, to, dirHint = null) {
  if (!h) return null;
  const r = h.r ?? h.row, c = h.c ?? h.col;
  if (r == null || c == null) return null;

  // 到达方向（格差）→ 横扫方向取其垂直方向
  //
  // 约定：sr 是**行方向**的符号（±1 表示沿行推进，即南北向），
  //      sc 是**列方向**的符号（±1 表示沿列推进，即东西向）。
  // 喷洒带沿 (sr, sc) 推进。
  // 正确性要求：喷洒带必须**横穿**病灶格，也就是推进方向应与到达方向大致垂直；
  // 同时推进方向必须与格边平行（不能斜切），否则喷洒带成为折线、转弯暴涨。
  //   · 到达方向主要是南北（|dr| ≥ |dc|）→ 横扫应沿东西 → sr=0, sc=±1
  //   · 到达方向主要是东西（|dc| > |dr|）→ 横扫应沿南北 → sr=±1, sc=0
  //
  // 早期版本把这两个分支写反了（|dr|≥|dc| 时给 sr=0 却把 sr 当行方向用），
  // 结果喷洒带方向与到达方向平行 —— 等于沿原路来回扫，方向还忽左忽右。
  const dr = to.r - from.r, dc = to.c - from.c;
  let sr, sc;
  if (dirHint) {
    // 簇内统一朝向（见下方簇主轴的说明）
    [sr, sc] = dirHint;
  } else if (dr === 0 && dc === 0) { sr = 1; sc = 0; }  // 无方向信息：默认南北向横扫
  else if (Math.abs(dr) >= Math.abs(dc)) { sr = 0; sc = dc >= 0 ? 1 : -1; }
  else { sr = dr >= 0 ? 1 : -1; sc = 0; }

  // 边缘/障碍回退：首选方向越界或撞障碍时，换方向而不是放弃这个格
  //
  // 早期版本直接用首选方向构造喷洒带，越界就 `path.length < 2` 返回 null ——
  // 于是**地块边缘的病灶格被整个漏掉**（实测 4 个目标格只喷到 3 个，
  // 覆盖率 0.75）。漏喷在植保里是不可接受的：宁可绕一下也不能少打一块。
  //
  // 候选顺序：首选方向 → 首选的反向 → 垂直方向 → 垂直的反向。
  // 取第一个能构造出完整扫掠带的方向。
  const candidates = [[sr, sc], [-sr, -sc], [sc, -sr], [-sc, sr]];

  // 喷洒面积建模（与 shared/planner.js 的 target 模式严格同口径）
  //
  // 平台网格是 5m x 5m，靶向喷幅是 1m（窄幅喷施机构）。
  // 一次扫掠在格内留下 5m x 1m 的窄带，**盖不满** 25 m2 的格；
  // 要盖满一个格，需在格内并排 ceil(跨向尺寸 / 喷幅) = 5 条平行带。
  //
  // 因此几何与计量分开：
  //   · 几何：飞机每到病灶格横扫**一次**（5m 网格分辨不出 1m 子格的并排，
  //     并排的 5 条带在路径上是同一条线，故路径只画一趟）；
  //   · 计量：喷洒长度按 **并行条数 x 单条长度** 计，
  //     面积 = 长度 x 喷幅 = 格面积（与 planner.js 的 target 模式一致）。
  //
  // 早期版本的三个错法（均已修）：
  //   1) 喷洒带不接进航线 -> 算了药量飞机却没飞到；
  //   2) 喷洒带方向与到达方向平行（分支写反）-> 等于沿原路来回扫；
  //   3) 单条带按「长度 x 喷幅」计面积却当成整格 -> 覆盖率与药耗都失真。
  // 几何：一条扫掠带，从格的近端推进到远端（横穿整个格）
  let path = null;
  for (const [cr, cc] of candidates) {
    if (cr === 0 && cc === 0) continue;
    const p = [];
    for (let i = 0; i <= 1; i++) {
      const gr = r + (cr !== 0 ? i * cr : 0);
      const gc = c + (cc !== 0 ? i * cc : 0);
      if (!env.inBounds(gr, gc)) continue;
      if (env.isBlocked(gr, gc)) continue;
      const last = p[p.length - 1];
      if (!last || last.r !== gr || last.c !== gc) p.push({ r: gr, c: gc });
    }
    if (p.length >= 2) { path = p; sr = cr; sc = cc; break; }
  }
  if (!path) {
    // 四个方向都不可用 —— 说明这个格本身越界或被障碍占住，
    // 它压根不是合法病灶格（入口处已过滤，这里只是兜底不崩）。
    return null;
  }

  // 并行条数：盖满一个格所需的条数 = ceil(跨向尺寸 / 喷幅)
  // 5m 格 + 1m 窄幅 -> 5 条并排带
  const acrossM = sr !== 0 ? env.cw : env.ch;
  const passes = Math.max(1, Math.ceil(acrossM / Math.max(swathM, 0.01)));

  // 计量用的喷洒长度（米）：单条扫掠长度 x 并行条数
  // 单条扫掠长度 = 该格在推进方向上的尺寸（5m），
  // 故一格总喷洒长度 = 5m x 5 条 = 25 m，
  // 面积 = 25m x 1m 喷幅 = 25 m2 = 恰好一个格。
  // 这与 shared/planner.js 的 target 模式口径完全一致
  // （那里每格排 ceil(跨向/喷幅) 条、每条穿过整个格）。
  const sweepM = (sr !== 0 ? env.ch : env.cw);
  const sprayLengthM = sweepM * passes;

  return { path, passes, sweepM, sprayLengthM };
}

/**
 * 协同方案评估：航程、时长、能耗、覆盖率、过喷率。
 * 覆盖率/过喷率在平台自身的 5 m 网格上统计，与平台其它模块口径一致。
 */
export function evaluateSwarm(env, tracks, hotspots, {
  swathM = 1.0, transitSpeedMs = 8.0, spraySpeedMs = 4.5, doseLha = 12,
}) {
  const { rows, cols, cw, ch } = env;
  // 每条航线的并行条数（供药耗口径使用）
  const sprayPasses = new Map();
  for (const t of tracks) sprayPasses.set(t, t.passes || 1);
  // 喷洒覆盖掩码
  const sprayed = new Uint8Array(rows * cols);
  for (const t of tracks) {
    for (const seg of t.spraySegments) {
      for (const p of seg) {
        sprayed[p.r * cols + p.c] = 1;
      }
    }
  }
  // 病灶格集合
  const target = new Set();
  for (const h of hotspots) {
    const r = h.r ?? h.row, c = h.c ?? h.col;
    if (r != null && c != null) target.add(r * cols + c);
  }
  let hit = 0;
  for (const i of target) if (sprayed[i]) hit++;
  const coverage = target.size ? hit / target.size : 0;
  let sprayedCount = 0;
  for (const s of sprayed) sprayedCount += s;
  const overCount = sprayedCount - hit;

  // 时长与能耗
  let totalLen = 0, totalTime = 0, maxTime = 0, turns = 0, minClear = Infinity;
  const HOVER_POWER_W = 7000 * (30 / 30) ** 1.5;
  let totalEnergyWh = 0;
  let sprayLengthM = 0;   // 喷洒段总长（米）—— 药耗按「长度 × 喷幅」算
  let sprayHits = 0;      // 喷洒航段计数（仅诊断用）
  for (const t of tracks) {
    if (!t.path.length) continue;
    let L = 0, T = 0, prevDir = null;
    const path = t.path;
    for (let i = 1; i < path.length; i++) {
      const segLen = Math.hypot(path[i].r - path[i - 1].r, path[i].c - path[i - 1].c) * cw;
      L += segLen;
      const spray = isSpraySegment(t, path[i - 1], path[i]);
      // 计量：喷洒段按「并行条数 x 单条扫掠长」计长（见 swarmPlan 的口径说明）；
      // 路径几何只画一趟，故此处不重复累加 segLen。
      if (spray) sprayHits++;
      const spd = spray ? spraySpeedMs : transitSpeedMs;
      const dt = segLen / spd;
      T += dt;
      // 转向消耗（与 shared/planner.js 的转弯口径一致：显著航向变化加固定秒数）
      const d = { r: path[i].r - path[i - 1].r, c: path[i].c - path[i - 1].c };
      const nd = Math.hypot(d.r, d.c);
      if (prevDir && nd > 0) {
        const cos = (d.r * prevDir.r + d.c * prevDir.c) / (nd * Math.hypot(prevDir.r, prevDir.c));
        if (cos < 0.7) { turns++; T += 2.5; }
      }
      prevDir = d;
      // 能耗：旋翼功率随风（地速 vs 空速）变化
      const airspeed = Math.hypot(spd - env.wind.vx, -env.wind.vy);
      const P = HOVER_POWER_W * (1 + 1.6 * (airspeed / 12) ** 2);
      totalEnergyWh += P * dt / 3600;
    }
    sprayLengthM += t.sprayLengthM || 0;
    totalLen += L; totalTime += T;
    if (T > maxTime) maxTime = T;
    minClear = Math.min(minClear, pathClearance(env, path));
  }

  // 药耗口径：**喷洒段长度 × 喷幅**（与 shared/planner.js 的 target 模式完全一致）
  //
  // 早期版本用「被喷格数 × 格面积」算面积，这会系统性高估：
  // 5m 格用 1m 窄幅扫过时实际只喷了 25m² 里的一条窄带，
  // 但按格面积算却记了 25m² —— 药耗虚高 5 倍，与平台其它模块对不上。
  const sprayedHa = (sprayLengthM * swathM) / 10000;
  // 过喷口径：**面积制**，与 shared/planner.js 的 spillAreaHa 严格一致
  //
  // 早期版本用「格数比」算过喷（overCells / sprayedCells），有两个问题：
  //   1. 口径与平台其它模块对不上 —— planner.js 记的是面积（ha），
  //      swarm.js 记的是格数，两处数字放在同一张表里没法比；
  //   2. 格数比会**系统性高估**过喷：喷洒带横穿病灶格时会扫到相邻的
  //      非病灶格（1m 窄幅扫过 5m 格必然溢出到邻格），
  //      按格数算这一格整格都算过喷，按面积算只算溢出的那一小条。
  //
  // 现在统一为：药液实际覆盖面积 vs 靶区面积。
  //   靶区面积 = 目标格数 x 格面积
  //   覆盖面积 = 喷洒段几何长度 x 喷幅（与计量口径同源）
  //   过喷面积 = max(0, 覆盖面积 - 靶区面积)
  const cellAreaHa = (cw * ch) / 10000;
  const targetAreaHa = target.size * cellAreaHa;
  const coveredAreaHa = (sprayLengthM * swathM) / 10000;

  const volumeL = sprayedHa * doseLha;
  // 对照值：若按「被喷格整格面积」计会有多离谱（留作口径自检）
  const areaByCellHa = sprayedCount * cellAreaHa;

  return {
    nDrones: tracks.length,
    totalLengthM: Math.round(totalLen),
    totalMinutes: +(totalTime / 60).toFixed(2),
    makespanMinutes: +(maxTime / 60).toFixed(2),
    turns,
    energyWh: Math.round(totalEnergyWh),
    minClearanceM: Number.isFinite(minClear) ? +minClear.toFixed(2) : null,
    targetCells: target.size,
    coveredCells: hit,
    coverage: +coverage.toFixed(4),
    overCells: overCount,
    /** 过喷面积（ha）—— 与 planner.js 的 spillAreaHa 同口径 */
    overAreaHa: +Math.max(0, coveredAreaHa - targetAreaHa).toFixed(4),
    /** 过喷比例 = 过喷面积 / 靶区面积（不是格数比，见上方口径说明） */
    overRatio: targetAreaHa > 0
      ? +(Math.max(0, coveredAreaHa - targetAreaHa) / targetAreaHa).toFixed(4)
      : 0,
    targetAreaHa: +targetAreaHa.toFixed(4),
    coveredAreaHa: +coveredAreaHa.toFixed(4),
    sprayLengthM: Math.round(sprayLengthM),
    sprayedAreaHa: +sprayedHa.toFixed(4),
    areaByCellHa: +areaByCellHa.toFixed(4),
    volumeL: +volumeL.toFixed(3),
    // 相对「把这些格整片均匀喷洒」的节约（分区口径）
    // 均匀喷 = 被喷格数 × 格面积 × 剂量；靶向喷 = 实际喷洒带面积 × 剂量
    savedVsUniformPct: areaByCellHa > 0
      ? +(((areaByCellHa - sprayedHa) / areaByCellHa) * 100).toFixed(1) : null,
  };
}

/** 判断一段路径是否属于喷洒段 */
function isSpraySegment(track, a, b) {
  for (const seg of track.spraySegments) {
    for (let i = 1; i < seg.length; i++) {
      if ((seg[i - 1].r === a.r && seg[i - 1].c === a.c && seg[i].r === b.r && seg[i].c === b.c)
        || (seg[i].r === a.r && seg[i].c === a.c && seg[i - 1].r === b.r && seg[i - 1].c === b.c)) return true;
    }
  }
  return false;
}

/* =====================================================================
 * 五、最小二叉堆（A* 优先队列）
 * ================================================================== */

class MinHeap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(priority, key, node) {
    this.a.push({ priority, key, node });
    let i = this.a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.a[p].priority <= this.a[i].priority) break;
      [this.a[p], this.a[i]] = [this.a[i], this.a[p]];
      i = p;
    }
  }
  pop() {
    const top = this.a[0];
    const last = this.a.pop();
    if (this.a.length) {
      this.a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let s = i;
        if (l < this.a.length && this.a[l].priority < this.a[s].priority) s = l;
        if (r < this.a.length && this.a[r].priority < this.a[s].priority) s = r;
        if (s === i) break;
        [this.a[s], this.a[i]] = [this.a[i], this.a[s]];
        i = s;
      }
    }
    return top;
  }
}
