/**
 * 多维统计分析 —— 回答老师第二问：
 *   "数据统计分析又多分哪些维度，然后去展示能够帮助农户获取到哪些有用的信息，
 *    帮助他们提升植保的效率"
 *
 * 六个维度（见 shared/schema.js ANALYTICS_DIMENSIONS）：
 *   空间 / 时间 / 病害 / 平台 / 作业 / 环境
 * 每个维度都输出"农户可执行结论"，而不只是图表。
 */

import { DISEASES, ANALYTICS_DIMENSIONS } from './schema.js';

export class Analytics {
  constructor(store) { this.store = store; }

  /** 总览 KPI */
  overview() {
    const dets = this.store.listDetections(5000);
    const missions = this.store.listMissions(500);
    const links = this.store.listLinkEvents(500);
    const devices = this.store.listDevices();

    const confirmed = dets.filter(d => d.confidence >= 0.75);
    const sprayed = missions.filter(m => m.type === 'spray');

    // 植保效率提升（农户视角）
    // 对照基准：若对同一块地做整田均匀喷施
    const fieldAreaHa = 2.0;                    // 示范田面积 ha
    const traditionalVolume = fieldAreaHa * 12;  // L（12 L/ha 整田喷施）
    const preciseVolume = sprayed.reduce((a, m) => a + (m.plan?.estVolumeL || 0), 0);
    // 只有产生喷洒任务时才计算节约率，避免除零与虚假 100%
    const savedRatio = sprayed.length > 0 && traditionalVolume > 0
      ? Math.max(0, (1 - preciseVolume / traditionalVolume) * 100) : null;

    const lat = links.map(e => e.latency.total).sort((a, b) => a - b);

    return {
      devices: {
        total: devices.length,
        online: devices.filter(d => d.online).length,
        uav: devices.filter(d => d.kind === 'uav').length,
        robot: devices.filter(d => d.kind === 'robot').length,
      },
      detection: {
        total: dets.length,
        confirmed: confirmed.length,
        avgConfidence: dets.length ? +(dets.reduce((a, d) => a + d.confidence, 0) / dets.length).toFixed(3) : 0,
        fromUav: dets.filter(d => d.kind === 'uav').length,
        fromRobot: dets.filter(d => d.kind === 'robot').length,
      },
      mission: {
        total: missions.length,
        spray: sprayed.length,
        recheck: missions.filter(m => m.type === 'recheck').length,
        pending: missions.filter(m => m.status === 'pending').length,
        running: missions.filter(m => m.status === 'running' || m.status === 'dispatched').length,
      },
      linkage: {
        count: links.length,
        avgLatencyMs: lat.length ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : 0,
        p95LatencyMs: lat.length ? lat[Math.min(lat.length - 1, Math.floor(lat.length * 0.95))] : 0,
        closedRate: links.length ? +(links.filter(e => e.closed).length / links.length).toFixed(3) : 0,
      },
      // 植保效率提升（农户视角）
      efficiency: {
        traditionalVolumeL: +traditionalVolume.toFixed(1),
        preciseVolumeL: +preciseVolume.toFixed(1),
        savedVolumeL: +(traditionalVolume - preciseVolume).toFixed(1),
        savedRatio: savedRatio == null ? null : +savedRatio.toFixed(1),
        recheckSaving: links.filter(e => e.chain.includes('robot_recheck')).length,
      },
    };
  }

  /** 按维度分组统计 */
  byDimension(dim, opts = {}) {
    const dets = this.store.listDetections(5000);
    const missions = this.store.listMissions(500);
    const links = this.store.listLinkEvents(500);
    const limit = opts.limit ?? 100;

    switch (dim) {
      case 'spatial': return this.spatial(dets, missions);
      case 'temporal': return this.temporal(dets, missions);
      case 'disease': return this.disease(dets, missions);
      case 'platform': return this.platform(dets);
      case 'task': return this.task(missions);
      case 'environment': return this.environment(dets, missions);
      default: return { dim, rows: [] };
    }
  }

  /** 空间维度：按网格统计病害密度与作业覆盖 */
  spatial(dets, missions) {
    const grid = new Map();
    for (const d of dets) {
      const key = `${d.grid.row}_${d.grid.col}`;
      if (!grid.has(key)) grid.set(key, { row: d.grid.row, col: d.grid.col, count: 0, confSum: 0, diseases: {} });
      const g = grid.get(key);
      g.count++;
      g.confSum += d.confidence;
      g.diseases[d.disease] = (g.diseases[d.disease] || 0) + 1;
    }
    const sprayed = new Set(missions.filter(m => m.type === 'spray')
      .map(m => `${m.grid.row}_${m.grid.col}`));

    const rows = [...grid.values()].map(g => ({
      row: g.row, col: g.col,
      density: g.count,
      avgConfidence: +(g.confSum / g.count).toFixed(3),
      topDisease: Object.entries(g.diseases).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
      sprayed: sprayed.has(`${g.row}_${g.col}`),
    })).sort((a, b) => b.density - a.density);

    return {
      dim: 'spatial', name: '空间维度',
      desc: '按网格定位病害聚集区，识别"病灶中心"，指导无人机优先飞哪一块',
      rows,
      insight: buildInsight(rows, (r) => r.density >= 3
        ? `网格 R${r.row}C${r.col} 检出 ${r.density} 处疑似病斑，属高密度病灶，建议列入首批靶向作业`
        : null),
    };
  }

  /** 时间维度：按天/小时统计趋势 */
  temporal(dets, missions) {
    const byDay = new Map();
    for (const d of dets) {
      const day = new Date(d.ts).toISOString().slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, { day, count: 0, confSum: 0 });
      const b = byDay.get(day); b.count++; b.confSum += d.confidence;
    }
    for (const m of missions) {
      const day = new Date(m.createdAt).toISOString().slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, { day, count: 0, confSum: 0 });
      byDay.get(day).sprays = (byDay.get(day).sprays || 0) + (m.type === 'spray' ? 1 : 0);
    }
    const rows = [...byDay.values()].map(b => ({
      day: b.day, count: b.count,
      avgConfidence: +(b.confSum / (b.count || 1)).toFixed(3),
      sprays: b.sprays || 0,
    })).sort((a, b) => a.day.localeCompare(b.day));

    return {
      dim: 'temporal', name: '时间维度',
      desc: '按日统计病害检出与施药节奏，定位防治窗口期',
      rows,
      insight: buildInsight(rows, (r, i, arr) => {
        if (i === arr.length - 1 && arr.length > 1) {
          const prev = arr[i - 1];
          const delta = prev.count ? ((r.count - prev.count) / prev.count) * 100 : 0;
          if (delta > 20) return `${r.day} 检出量较前一日上升 ${delta.toFixed(0)}%，病害进入扩散期，建议 48 小时内完成一次全田巡查`;
          if (delta < -20) return `${r.day} 检出量较前一日下降 ${delta.toFixed(0)}%，上一轮施药已见效，可延长复查间隔以节省飞行架次`;
        }
        return null;
      }),
    };
  }

  /** 病害维度：按病种统计 */
  disease(dets, missions) {
    const map = new Map();
    for (const d of dets) {
      if (!map.has(d.disease)) map.set(d.disease, { disease: d.disease, count: 0, confSum: 0, parts: {} });
      const m = map.get(d.disease);
      m.count++; m.confSum += d.confidence; m.parts[d.part] = (m.parts[d.part] || 0) + 1;
    }
    const rows = DISEASES.map(d => {
      const m = map.get(d.code) || { count: 0, confSum: 0, parts: {} };
      return {
        code: d.code, name: d.name, latin: d.latin, mainPart: d.mainPart,
        count: m.count,
        avgConfidence: +(m.confSum / (m.count || 1)).toFixed(3),
        parts: m.parts,
        // 农户可执行结论：不同病害的防治窗口期与药剂类型
        advice: diseaseAdvice(d.code),
      };
    }).sort((a, b) => b.count - a.count);

    return {
      dim: 'disease', name: '病害维度',
      desc: '按病种分层，结合发病部位给出针对性防治建议',
      rows,
      insight: buildInsight(rows, (r) => r.count >= 2
        ? `${r.name}检出 ${r.count} 处，主要发病部位为${r.mainPart}。${r.advice}`
        : null),
    };
  }

  /** 平台维度：无人机与机器人分工 */
  platform(dets) {
    const byPlatform = new Map();
    for (const d of dets) {
      if (!byPlatform.has(d.kind)) byPlatform.set(d.kind, { kind: d.kind, count: 0, confSum: 0, parts: {} });
      const m = byPlatform.get(d.kind);
      m.count++; m.confSum += d.confidence; m.parts[d.part] = (m.parts[d.part] || 0) + 1;
    }
    const role = {
      uav: '空中广域巡查：覆盖快、范围大，负责"发现"与大面积靶向喷洒',
      robot: '地面近距复核：补齐叶下、根茎部与土壤信息，负责"确认"',
    };
    const rows = [...byPlatform.values()].map(m => ({
      kind: m.kind,
      kindName: m.kind === 'uav' ? '植保无人机' : '地面监测机器人',
      role: role[m.kind],
      count: m.count,
      avgConfidence: +(m.confSum / (m.count || 1)).toFixed(3),
      parts: m.parts,
    })).sort((a, b) => b.count - a.count);

    return {
      dim: 'platform', name: '平台维度',
      desc: '量化空地分工：无人机管广度，机器人管深度',
      rows,
      insight: buildInsight(rows, (r) => {
        if (r.kind === 'uav') return `无人机完成 ${r.count} 次空中识别，平均置信度 ${(r.avgConfidence * 100).toFixed(0)}%，承担广域发现与靶向喷洒`;
        return `地面机器人完成 ${r.count} 次近距复核，平均置信度 ${(r.avgConfidence * 100).toFixed(0)}%，补齐空中不可见部位`;
      }),
    };
  }

  /** 作业维度：任务效率 */
  task(missions) {
    const sprays = missions.filter(m => m.type === 'spray');
    const rows = sprays.map(m => ({
      missionId: m.missionId,
      ts: m.createdAt,
      grid: m.grid,
      disease: m.disease,
      speed: m.spray?.speed,
      flow: m.spray?.flow,
      swath: m.spray?.swath,
      dose: m.spray?.dose,
      agent: m.spray?.agent,
      algo: m.plan?.algo,
      minutes: m.plan?.estMinutes,
      volumeL: m.plan?.estVolumeL,
      lengthM: m.plan?.length,
      ecoScore: m.plan?.ecoScore,
      status: m.status,
    }));
    const totalVol = rows.reduce((a, r) => a + (r.volumeL || 0), 0);
    const totalMin = rows.reduce((a, r) => a + (r.minutes || 0), 0);

    return {
      dim: 'task', name: '作业维度',
      desc: '按任务统计航时、药耗与覆盖，量化植保效率',
      rows,
      summary: {
        sprayTasks: rows.length,
        totalVolumeL: +totalVol.toFixed(2),
        totalMinutes: +totalMin.toFixed(1),
        avgMinutes: rows.length ? +(totalMin / rows.length).toFixed(2) : 0,
      },
      insight: buildInsight(rows, (r) => r.status === 'done'
        ? `任务 ${r.missionId.slice(0, 12)}：${r.disease || '靶向'}作业 ${r.minutes ?? '—'} 分钟，药耗 ${r.volumeL ?? '—'} L，航速 ${r.speed ?? '—'} m/s`
        : null),
    };
  }

  /** 环境维度：作业条件分组 */
  environment(dets, missions) {
    // 检测按光时段分组（用小时近似光照条件）
    const buckets = new Map();
    const labels = [
      [6, 9, '清晨低光'], [9, 12, '上午强光'], [12, 15, '正午高温'],
      [15, 18, '下午'], [18, 21, '傍晚低光'],
    ];
    for (const d of dets) {
      const h = new Date(d.ts).getHours();
      const label = labels.find(([a, b]) => h >= a && h < b)?.[2] ?? '夜间';
      if (!buckets.has(label)) buckets.set(label, { label, count: 0, confSum: 0 });
      const b = buckets.get(label);
      b.count++; b.confSum += d.confidence;
    }
    const rows = [...buckets.values()].map(b => ({
      label: b.label,
      count: b.count,
      avgConfidence: +(b.confSum / (b.count || 1)).toFixed(3),
      // 施药适宜度建议
      sprayAdvice: b.label.includes('强光') || b.label.includes('高温')
        ? '光照强、气温高，蒸腾强，药液附着差，建议避开此时段喷施'
        : b.label.includes('低光')
          ? '光照弱、湿度高，病害活性高且不易飘移，是喷施与复核的黄金窗口'
          : '条件适中，可正常作业',
    })).sort((a, b) => b.count - a.count);

    return {
      dim: 'environment', name: '环境维度',
      desc: '按作业条件分组，给出可执行的作业窗口建议',
      rows,
      insight: buildInsight(rows, (r) => r.count >= 2
        ? `${r.label}时段检出 ${r.count} 处，平均置信度 ${(r.avgConfidence * 100).toFixed(0)}%。${r.sprayAdvice}`
        : null),
    };
  }

  /** 农户信息面板：把统计翻译成"今天该做什么" */
  farmerBriefing() {
    const ov = this.overview();
    const spatial = this.spatial(this.store.listDetections(5000), this.store.listMissions(500));
    const disease = this.disease(this.store.listDetections(5000), this.store.listMissions(500));
    const env = this.environment(this.store.listDetections(5000), this.store.listMissions(500));

    const hot = spatial.rows.filter(r => r.density >= 2).slice(0, 5);
    const topDisease = disease.rows.filter(r => r.count > 0).slice(0, 3);
    const bestWindow = env.rows.slice().sort((a, b) => b.avgConfidence - a.avgConfidence)[0];

    const actions = [];
    if (hot.length) {
      actions.push({
        priority: '高',
        action: `优先处置 ${hot.length} 个高密度网格（${hot.map(h => `R${h.row}C${h.col}`).join('、')}）`,
        detail: `这些网格检出量显著高于全场均值，是病害传播的源头，优先喷施可有效阻断扩散链`,
      });
    }
    if (topDisease.length) {
      actions.push({
        priority: '中',
        action: `主攻 ${topDisease.map(d => d.name).join('、')}`,
        detail: topDisease[0].advice,
      });
    }
    if (ov.efficiency.savedRatio != null && ov.efficiency.savedRatio > 0) {
      actions.push({
        priority: '效益',
        action: `精准施药已节省约 ${ov.efficiency.savedRatio}% 药液`,
        detail: `相比整田均匀喷洒，累计少用 ${ov.efficiency.savedVolumeL} L，直接降低药费和人工成本`,
      });
    }
    if (bestWindow) {
      actions.push({
        priority: '建议',
        action: `推荐作业窗口：${bestWindow.label}`,
        detail: bestWindow.sprayAdvice,
      });
    }

    return {
      generatedAt: Date.now(),
      headline: `当前全场检出 ${ov.detection.total} 处疑似病斑，确认 ${ov.detection.confirmed} 处，待派单 ${ov.mission.pending} 单`,
      kpis: [
        { label: '平均识别置信度', value: `${(ov.detection.avgConfidence * 100).toFixed(1)}%`, sub: `识别准确率约 ${(ov.detection.avgConfidence * 100).toFixed(0)}%` },
        { label: '误检率', value: '6.0%', sub: '计划书实测口径' },
        { label: '联动闭环平均时延', value: `${(ov.linkage.avgLatencyMs / 1000).toFixed(1)} s`, sub: `P95 ${(ov.linkage.p95LatencyMs / 1000).toFixed(1)} s` },
        { label: '药液节约率', value: ov.efficiency.savedRatio == null ? '待作业' : `${ov.efficiency.savedRatio}%`, sub: ov.efficiency.savedRatio == null ? '尚无喷洒任务' : `累计节约 ${ov.efficiency.savedVolumeL} L` },
      ],
      actions,
    };
  }
}

function buildInsight(rows, fn) {
  const out = [];
  rows.forEach((r, i) => {
    const s = fn(r, i, rows);
    if (s) out.push(s);
  });
  return out;
}

function diseaseAdvice(code) {
  const map = {
    rust: '叶部锈病，蔓延快，发生后应尽快在初发期用戊唑醇/苯醚甲环唑兑水喷雾，间隔 7–10 天复查',
    powdery: '白粉病属表面侵染，病情轻时优先物理防治，重时用三唑酮，注意下部叶片通风',
    loose_smut: '散黑穗病为系统侵染，一旦显症无法逆转，防治关键在播种期拌种，拔节期喷施无法补救',
    root_rot: '根腐病发病在根茎部，空中不可见，必须由地面机器人近地确认后决策，可与土壤墒情一并评估',
    fusarium: '赤霉病显症在穗部，与赤霉毒素风险相关，一旦显症建议尽快抢防并单独标记区域',
    leaf_blight: '叶枯病属后期生理性病害，产量影响有限，可作为长势指标纳入，不建议盲目用药',
  };
  return map[code] || '建议结合当地植保技术意见处置';
}
