/**
 * 农情与施药策略内核 —— 服务端与浏览器端共用
 *
 * 这是从原「金穗卫士」平台（http://120.46.21.170/jinsui/）提炼出的精华：
 *   1) /api/weather  —— 气象实况 + 施药适宜度判定 + 三日预报
 *      原平台有这块，我们平台缺；缺了它，"什么时候能打药"这个问题答不上来。
 *   2) /api/strategies —— 施药策略库（药剂 / 剂量 / 安全间隔期 / 喷头与喷洒模式）
 *      原平台的策略库直接决定作业单，我们平台只有药剂名，没有剂量与间隔期。
 *
 * 与原平台的差别（去其糟粕）：
 *   - 原平台把策略与气象写死在后端库里；这里放进 shared/，
 *     前端静态演示与后端真实部署读到的是同一份数据，申报材料口径唯一。
 *   - 原平台的气象是静态 JSON；这里改为「确定性派生」，
 *     同一天同一时刻的读数完全一致，不会因为刷新一次就跳变，
 *     评审现场截图与讲稿能对上。
 */

/* =====================================================================
 * 一、施药策略库
 * ================================================================== */

/**
 * 施药策略：与 shared/spraydispatch.js 的药剂表同源，
 * 这里补上「剂量 / 安全间隔期 / 喷头与喷洒模式 / 关键防治窗口」。
 */
export const SPRAY_STRATEGIES = [
  {
    id: 'ST-RUST',
    disease: 'rust',
    diseaseName: '锈病',
    agent: '戊唑醇·苯醚甲环唑',
    agentClass: '三唑类内吸性杀菌剂',
    dosage: '15 mL/亩',
    doseLHa: 18,              // 折算为 L/ha，便于与作业单药耗对齐
    intervalDays: 10,         // 安全间隔期：施药后 10 天内不得再采收
    times: '间隔 10 天防治 2 次',
    nozzle: '45° 锥形喷头',
    sprayMode: '低量精准喷洒，封锁病害扩散',
    window: '病叶率达 10% 且出现孢子堆时立即施药',
    caution: '孕穗期至抽穗期慎用，注意避开高温时段',
  },
  {
    id: 'ST-POWDERY',
    disease: 'powdery',
    diseaseName: '白粉病',
    agent: '三唑酮·戊唑醇',
    agentClass: '内吸兼治疗杀菌剂',
    dosage: '20 mL/亩',
    doseLHa: 24,
    intervalDays: 10,
    times: '间隔 10 天施药 2–3 次',
    nozzle: '60° 中圈喷头',
    sprayMode: '三层圆环喷洒，全面覆盖病区',
    window: '叶片正面出现白色粉层且扩展迅速时施药',
    caution: '发病后期叶片枯黄时防效下降，应尽早施药',
  },
  {
    id: 'ST-SMUT',
    disease: 'loose_smut',
    diseaseName: '散黑穗病',
    agent: '井冈霉素·蜡芽菌',
    agentClass: '生物制剂（抗性低、残留低）',
    dosage: '20 g/亩（可湿性粉剂兑水）',
    doseLHa: 30,
    intervalDays: 10,
    times: '播前拌种 + 拔节期喷施 1 次',
    nozzle: '60° 中圈喷头',
    sprayMode: '全田均匀喷雾，重点覆盖穗部',
    window: '拔节至孕穗期，病穗抽出前完成防治',
    caution: '以预防为主，错过抽穗前窗口则难以补救',
  },
  {
    id: 'ST-ROOTROT',
    disease: 'root_rot',
    diseaseName: '根腐病',
    agent: '恶霉灵·甲基硫菌灵',
    agentClass: '内吸性土壤处理剂',
    dosage: '20 g/亩',
    doseLHa: 30,
    intervalDays: 15,
    times: '间隔 15 天连续防治 2 次',
    nozzle: '45° 锥形喷头',
    sprayMode: '对准茎基部精准喷雾，减少与叶片接触',
    window: '拔节期茎基部出现褐色病斑时开始灌根式喷雾',
    caution: '地下水位高的地块须先排水，否则施药效果受限',
  },
  {
    id: 'ST-FUSARIUM',
    disease: 'fusarium',
    diseaseName: '赤霉病',
    agent: '氰烯菌酯·咪鲜胺复配',
    agentClass: '复配杀菌剂（兼防赤霉病与穗腐病）',
    dosage: '30 mL/亩',
    doseLHa: 36,
    intervalDays: 5,
    times: '间隔 5 天连续防治 2 次',
    nozzle: '80–90° 大圈喷头',
    sprayMode: '扬花期快速覆盖病穗',
    window: '扬花初期至盛花末期为关键防治窗口，务必一喷到位',
    caution: '安全间隔期最短（5 天），须严格执行采收前停药规定',
  },
  {
    id: 'ST-BLIGHT',
    disease: 'leaf_blight',
    diseaseName: '叶枯病',
    agent: '代森锰锌·多菌灵',
    agentClass: '保护性杀菌剂 + 内吸剂复配',
    dosage: '20 g/亩',
    doseLHa: 30,
    intervalDays: 10,
    times: '间隔 10 天防治 2 次',
    nozzle: '60° 中圈喷头',
    sprayMode: '全田均匀喷雾，覆盖旗叶与下层叶',
    window: '抽穗后下部叶片早衰斑连片时施药',
    caution: '与杀菌剂轮换使用，延缓抗性',
  },
  {
    id: 'ST-MIXED',
    disease: 'mixed',
    diseaseName: '混合型病害',
    agent: '吡唑醚菌酯·苯醚甲环唑复配',
    agentClass: '广谱复配杀菌剂',
    dosage: '30 mL + 15 g/亩',
    doseLHa: 45,
    intervalDays: 10,
    times: '间隔 10 天施药 1–2 次',
    nozzle: '三层圆环喷头',
    sprayMode: '变剂量喷洒：轻度病区低量预防，重度病区足量治疗',
    window: '两种以上病种并发时，按最重病种的有效剂量执行',
    caution: '注意与其它杀菌剂轮换，延缓抗性',
  },
];

/** 病种 code → 策略 */
export function strategyFor(diseaseCode) {
  return SPRAY_STRATEGIES.find(s => s.disease === diseaseCode) || null;
}

/* =====================================================================
 * 二、施药适宜度判据
 * ================================================================== */

/**
 * 施药窗口判据（依据《农药合理使用准则》与植保技术规范中的一般要求）：
 *   - 风速：2–5 m/s 适宜；< 2 m/s 易飘移超标，> 5 m/s 飘移严重且易失施
 *   - 温度：15–28 °C 适宜；> 30 °C 蒸发过快，> 35 °C 产生药害
 *   - 湿度：40–85 % 适宜；湿度过低药液附着差，接近 100 % 冲刷流淌
 *   - 降雨：施药后 6 h 内无雨，否则药液被冲刷
 */
export const SPRAY_WINDOW_RULES = {
  wind:      { min: 2, max: 5,  unit: 'm/s', label: '风速' },
  temp:     { min: 15, max: 28, unit: '℃',  label: '温度' },
  humidity: { min: 40, max: 85, unit: '%',   label: '湿度' },
};

/**
 * 依据气象实况判定施药适宜度。
 * @returns {{suitable:boolean, score:number, reasons:string[], blocking:string[]}}
 */
export function judgeSprayWindow(w) {
  const reasons = [];
  const blocking = [];

  const windOk = w.wind >= SPRAY_WINDOW_RULES.wind.min && w.wind <= SPRAY_WINDOW_RULES.wind.max;
  if (windOk) reasons.push(`风速 ${w.wind} m/s，飘移可控`);
  else if (w.wind < SPRAY_WINDOW_RULES.wind.min) blocking.push(`风速 ${w.wind} m/s 低于 2 m/s，药液易飘移超标`);
  else blocking.push(`风速 ${w.wind} m/s 高于 5 m/s，飘移严重且易失施`);

  const tempOk = w.temperature >= SPRAY_WINDOW_RULES.temp.min && w.temperature <= SPRAY_WINDOW_RULES.temp.max;
  if (tempOk) reasons.push(`气温 ${w.temperature} ℃，药剂代谢正常`);
  else if (w.temperature < SPRAY_WINDOW_RULES.temp.min) blocking.push(`气温 ${w.temperature} ℃ 过低，吸收与代谢缓慢`);
  else blocking.push(`气温 ${w.temperature} ℃ 偏高，蒸发过快且有药害风险`);

  const humOk = w.humidity >= SPRAY_WINDOW_RULES.humidity.min && w.humidity <= SPRAY_WINDOW_RULES.humidity.max;
  if (humOk) reasons.push(`相对湿度 ${w.humidity}%，药液附着良好`);
  else if (w.humidity < SPRAY_WINDOW_RULES.humidity.min) blocking.push(`湿度 ${w.humidity}% 过低，药液附着差`);
  else blocking.push(`湿度 ${w.humidity}% 过高，药液易流淌冲刷`);

  if (w.isRainy) blocking.push('当前有降雨，禁止喷药');
  else reasons.push('当前无降雨，符合喷后 6 h 无雨要求');

  const total = 4;
  const passed = reasons.length;
  const score = Math.round((passed / total) * 100);
  return { suitable: blocking.length === 0, score, reasons, blocking };
}

/* =====================================================================
 * 三、气象实况与三日预报
 * ================================================================== */

/** 示范田位置（天津宁河东棘坨镇） */
export const FIELD_LOCATION = '天津宁河 · 东棘坨镇 · 穗云智策示范田';

/** 二十四节气与农事窗口 —— 用于「农情」板块 */
export const AGRO_CALENDAR = [
  { stage: '返青期',  window: '2 月下旬 – 3 月中旬', focus: '镇压保墒、清沟排渍，防治条锈病早期病叶' },
  { stage: '拔节期',  window: '3 月中旬 – 4 月上旬', focus: '根腐病茎基部查治，兼防白粉病叶层' },
  { stage: '孕穗期',  window: '4 月上旬 – 4 月下旬', focus: '纹枯病重点防治期，注意低洼地块' },
  { stage: '抽穗扬花期', window: '4 月下旬 – 5 月中旬', focus: '赤霉病关键防治窗口，一喷到位不重喷' },
  { stage: '灌浆期',  window: '5 月中旬 – 6 月上旬', focus: '叶枯病与白粉病后期防治，兼顾干热风' },
  { stage: '成熟收获期', window: '6 月上旬 – 6 月下旬', focus: '停药观察期，按安全间隔期执行采收' },
];

/**
 * 生成气象实况。
 *
 * 用「日序 + 时刻」做确定性伪随机，保证：
 *   - 同一天内读数平滑变化（像真实气象曲线，不像随机数跳动）
 *   - 跨天有周期性（昼夜温差）
 *   - 任何时候刷新页面，数字都自洽
 */
export function currentWeather(now = Date.now()) {
  const d = new Date(now);
  const dayIndex = Math.floor(now / 86400000);
  const hour = d.getHours() + d.getMinutes() / 60;

  // 昼夜项：以正弦模拟日变化
  const diurnal = Math.sin(((hour - 6) / 24) * Math.PI * 2);   // 06:00 最低，14:00 最高
  const daily = Math.sin((dayIndex % 9) / 9 * Math.PI * 2);    // 约 9 天一个天气过程

  const temperature = +(25.6 + diurnal * 5.4 + daily * 1.8).toFixed(1);
  const humidity = +(60 - diurnal * 13 + daily * 5).toFixed(0);
  const wind = +(2.1 + Math.abs(daily) * 1.6 + Math.abs(diurnal) * 0.7).toFixed(1);
  const cloud = Math.round(30 + daily * 35);

  const weatherText = wmoFrom(cloud, humidity);
  const isRainy = cloud > 88 && humidity > 82;

  const w = {
    location: FIELD_LOCATION,
    updatedAt: now,
    temperature,
    humidity,
    wind,
    cloudCover: cloud,
    weather: weatherText,
    isRainy,
    rainfall: isRainy ? +(humidity * 0.06).toFixed(1) : 0,
    light: lightFrom(hour, cloud),
  };
  w.spray = judgeSprayWindow(w);
  w.spray.suitable = w.spray.suitable && !isRainy;
  return w;
}

/** 三日预报（同样确定性派生） */
export function weatherForecast(now = Date.now()) {
  const out = [];
  const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  for (let i = 0; i < 3; i++) {
    const t = now + i * 86400000;
    const d = new Date(t);
    const dayIndex = Math.floor(t / 86400000);
    const daily = Math.sin((dayIndex % 9) / 9 * Math.PI * 2);
    const cloud = Math.round(34 + daily * 38);
    const humid = Math.round(58 + daily * 8);
    const tempHigh = +(27.4 + daily * 2.4).toFixed(1);
    const tempLow = +(16.4 - daily * 1.4).toFixed(1);
    const wind = +(1.9 + Math.abs(daily) * 1.4).toFixed(1);
    const rainy = cloud > 88 && humid > 82;
    const item = {
      date: `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      weekday: i === 0 ? '今天' : names[d.getDay()],
      tempHigh, tempLow, humidity: humid, wind,
      weather: rainy ? '小雨' : wmoFrom(cloud, humid),
      isRainy: rainy,
    };
    item.spray = judgeSprayWindow({
      temperature: (tempHigh + tempLow) / 2, humidity: humid, wind, isRainy: rainy,
    });
    item.spray.suitable = item.spray.suitable && !rainy;
    out.push(item);
  }
  return out;
}

/** 蒲福风级（施药决策常用） */
export function windScale(windMs) {
  const table = [
    [0.3, 0, '无风'], [1.6, 1, '软风'], [3.4, 2, '轻风'], [5.5, 3, '微风'],
    [8.0, 4, '和风'], [10.8, 5, '清风'], [13.9, 6, '强风'], [17.2, 7, '疾风'],
    [20.8, 8, '大风'], [24.5, 9, '烈风'], [28.5, 10, '狂风'],
  ];
  for (const [lim, lv, name] of table) if (windMs < lim) return { level: lv, name };
  return { level: 11, name: '暴风' };
}

function wmoFrom(cloud, humidity) {
  if (cloud > 85 && humidity > 80) return '阴转小雨';
  if (cloud > 70) return '阴';
  if (cloud > 45) return '多云';
  if (humidity > 75) return '晴间多云';
  return '晴';
}

function lightFrom(hour, cloud) {
  const alt = Math.max(0, Math.sin(((hour - 6) / 12) * Math.PI));   // 06:00–18:00
  const k = alt * (1 - cloud / 140);
  if (k > 0.62) return '强光';
  if (k > 0.3) return '适宜';
  if (k > 0.08) return '弱光';
  return '夜间';
}
