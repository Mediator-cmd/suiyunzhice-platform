/**
 * 迷你路由内核 —— 让同一份路由定义跑在两种运行时上
 *
 * 为什么要自己写一套而不是直接用 Express：
 *   服务端原本用 Express 路由 45 个接口；如果云端版另写一份，
 *   两套路由会随时间漂移（改了本机忘了改云端，或反之），
 *   数字口径与接口行为就会不一致 —— 这是申报材料现场演示时最致命的问题。
 *
 * 这里实现 Express 用到的极小子集（够用即可）：
 *   - 路由注册：get / post
 *   - 路径参数：/missions/:id/status
 *   - 中间件链：中间件是 (req, res, next) 三参，处理器是 (req, res) 两参
 *   - 请求对象：req.get() / req.query / req.body / req.params
 *   - 响应对象：res.status() / res.json() / res.send() / res.set() / res.sendStatus()
 *
 * 路由匹配严格按注册顺序，与 Express 行为一致
 * （`/analytics/overview` 必须注册在 `/analytics/:dim` 之前，否则 overview 会被当成维度名）。
 */

/** 路径匹配：支持 :param 占位，段数必须相等 */
function matchPath(pattern, pathname) {
  const pp = pattern.split('/').filter(Boolean);
  const ap = pathname.split('/').filter(Boolean);
  if (pp.length !== ap.length) return null;
  const params = {};
  for (let i = 0; i < pp.length; i++) {
    if (pp[i].startsWith(':')) {
      params[pp[i].slice(1)] = decodeURIComponent(ap[i]);
    } else if (pp[i] !== ap[i]) {
      return null;
    }
  }
  return params;
}

/**
 * 执行一个处理器。
 * 返回 'next' 表示应继续执行后续处理器，'stop' 表示已终止。
 *
 * 判定依据与 Express 一致：
 *   - 三参（有 next）：调用了 next 才继续；没调用就是短路返回（如鉴权失败直接 403）
 *   - 两参：执行完即终止
 */
async function runHandler(fn, req, res) {
  if (fn.length >= 3) {
    let advanced = false;
    await fn(req, res, (err) => {
      if (err) throw err;
      advanced = true;
    });
    return advanced ? 'next' : 'stop';
  }
  await fn(req, res);
  return 'stop';
}

/** 请求对象 —— 抹平 Express req 与 Fetch Request 的差异 */
export class MiniRequest {
  constructor({ method, url, headers = {}, body = null }) {
    this.method = String(method || 'GET').toUpperCase();
    this.url = url;
    this.headers = {};
    for (const [k, v] of Object.entries(headers)) this.headers[k.toLowerCase()] = v;
    const u = new URL(url, 'http://internal');
    this.pathname = u.pathname;
    this.query = Object.fromEntries(u.searchParams.entries());
    this.body = body;
    this.params = {};
  }
  /** 取请求头（不区分大小写） */
  get(name) {
    return this.headers[String(name).toLowerCase()];
  }
}

/** 响应对象 —— 抹平 Express res 与 Fetch Response 的差异 */
export class MiniResponse {
  constructor() {
    this.statusCode = 200;
    this.headers = {};
    this.body = null;
    this.finished = false;
  }
  status(code) { this.statusCode = code; return this; }
  set(key, value) { this.headers[key] = value; return this; }
  json(obj) {
    this.headers['Content-Type'] = 'application/json; charset=utf-8';
    this.body = JSON.stringify(obj);
    this.finished = true;
    return this;
  }
  send(data) {
    if (data !== null && typeof data === 'object') return this.json(data);
    this.body = data === undefined || data === null ? '' : String(data);
    this.finished = true;
    return this;
  }
  sendStatus(code) {
    this.statusCode = code;
    // 204 No Content 不允许带响应体
    this.body = code === 204 ? '' : String(code);
    this.finished = true;
    return this;
  }
  end(data) {
    if (data !== undefined) this.body = String(data);
    this.finished = true;
    return this;
  }
}

/** 路由表 */
export class MiniRouter {
  constructor() {
    this.routes = [];
    this.middlewares = [];
  }
  use(fn) { this.middlewares.push(fn); return this; }
  get(path, ...handlers) { return this._add('GET', path, handlers); }
  post(path, ...handlers) { return this._add('POST', path, handlers); }
  put(path, ...handlers) { return this._add('PUT', path, handlers); }
  delete(path, ...handlers) { return this._add('DELETE', path, handlers); }
  _add(method, path, handlers) {
    this.routes.push({ method, path, handlers });
    return this;
  }
  /** 命中第一条匹配路由 */
  match(method, pathname) {
    for (const r of this.routes) {
      if (r.method !== method) continue;
      const params = matchPath(r.path, pathname);
      if (params) return { route: r, params };
    }
    return null;
  }
  /** 处理一次请求，返回 MiniResponse */
  async handle(req) {
    const res = new MiniResponse();
    for (const mw of this.middlewares) {
      if (await runHandler(mw, req, res) === 'stop') return res;
    }
    const m = this.match(req.method, req.pathname);
    if (!m) {
      return res.status(404).json({ error: '接口不存在', path: req.pathname });
    }
    req.params = m.params;
    for (const h of m.route.handlers) {
      if (await runHandler(h, req, res) === 'stop') return res;
    }
    return res;
  }
}

/**
 * 跨域中间件 —— 浏览器前端与设备端可能来自不同源。
 * 平台对外开放接口，允许任意来源访问；设备密钥走请求头而非 Cookie，
 * 因此这里不涉及凭据跨域问题。
 */
export function corsMiddleware(req, res, next) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type, X-Device-Id, X-Device-Kind, X-Device-Key, X-User-Id');
  res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;   // 不调用 next —— 预检请求到此为止
  }
  next();
}
