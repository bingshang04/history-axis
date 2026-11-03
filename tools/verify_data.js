#!/usr/bin/env node
/* 数据校验：node tools/verify_data.js
   读取 data/*.js 中的 window 全局数据，检查结构、引用、坐标与覆盖度。
   退出码：0 通过（可含警告），1 有错误。 */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.resolve(__dirname, "..");
const errors = [];
const warnings = [];

function fail(msg) { errors.push(msg); }
function warn(msg) { warnings.push(msg); }

function loadGlobal(file, name) {
  const abs = path.join(ROOT, "data", file);
  if (!fs.existsSync(abs)) { fail(`缺少文件 ${file}`); return null; }
  const code = fs.readFileSync(abs, "utf8");
  const sandbox = { window: {} };
  try {
    vm.runInNewContext(code, sandbox, { filename: file, timeout: 5000 });
  } catch (e) {
    fail(`${file} 语法/运行错误：${e.message}`);
    return null;
  }
  if (!sandbox.window[name]) { fail(`${file} 未导出 window.${name}`); return null; }
  return sandbox.window[name];
}

const CHAPTERS = new Set([
  "上编·第一章", "上编·第二章", "上编·第三章",
  "中编·第四章", "中编·第五章", "中编·第六章", "中编·第七章",
  "下编·第八章", "下编·第九章", "下编·第十章"
]);
const CHAPTER_TITLES = {
  "上编·第一章": "进入近代后中华民族的磨难与抗争",
  "上编·第二章": "不同社会力量对国家出路的早期探索",
  "上编·第三章": "辛亥革命与君主专制制度的终结",
  "中编·第四章": "中国共产党成立和中国革命新局面",
  "中编·第五章": "中国革命的新道路",
  "中编·第六章": "中华民族的抗日战争",
  "中编·第七章": "为建立新中国而奋斗",
  "下编·第八章": "中华人民共和国的成立与中国社会主义建设道路的探索",
  "下编·第九章": "改革开放与中国特色社会主义的开创和发展",
  "下编·第十章": "中国特色社会主义进入新时代"
};
const LINK_TYPES = new Set(["cause", "promote", "turn", "block"]);
const INSIDE = (lon, lat) => lon >= 73 && lon <= 136 && lat >= 3 && lat <= 54;

/* ---------- geo ---------- */
const geo = loadGlobal("china-geo.js", "CHINA_GEO");
const provinceShorts = new Set();
if (geo) {
  if (!Array.isArray(geo.provinces) || geo.provinces.length !== 34) {
    fail(`CHINA_GEO.provinces 应为 34 个，实际 ${geo.provinces ? geo.provinces.length : "无"}`);
  } else {
    for (const p of geo.provinces) {
      if (!p.short || !p.path || !p.path.startsWith("M")) fail(`省份数据异常：${p.name || p.id}`);
      provinceShorts.add(p.short);
    }
  }
  if (!geo.project || typeof geo.project !== "function") fail("CHINA_GEO.project 缺失");
  else {
    const p = geo.project(116.4, 39.9);
    if (!Array.isArray(p) || !isFinite(p[0]) || p[0] < 0 || p[0] > 1000 || p[1] < 0 || p[1] > 760) {
      fail(`CHINA_GEO.project 结果越界：${JSON.stringify(p)}`);
    }
  }
  if (!geo.nineDash || !Array.isArray(geo.nineDash.segments) || geo.nineDash.segments.length !== 10) {
    warn("CHINA_GEO.nineDash.segments 不是 10 段");
  }
}

/* ---------- periods ---------- */
const periods = loadGlobal("shigang-periods.js", "SHIGANG_PERIODS");
if (periods) {
  if (!periods.forces || !periods.periods) fail("SHIGANG_PERIODS 缺少 forces/periods");
  const ps = periods.periods || [];
  if (ps.length < 12) warn(`时期数量偏少：${ps.length}`);
  let expect = periods.start;
  for (let i = 0; i < ps.length; i++) {
    const p = ps[i];
    if (p.from !== expect) fail(`时期不连续：第 ${i + 1} 个 ${p.id} 从 ${p.from} 开始，应为 ${expect}`);
    if (!(p.to > p.from)) fail(`时期区间非法：${p.id} ${p.from}-${p.to}`);
    if (!periods.forces[p.defaultForce]) fail(`时期 ${p.id} defaultForce 不存在：${p.defaultForce}`);
    for (const k of Object.keys(p.overrides || {})) {
      if (!provinceShorts.has(k)) fail(`时期 ${p.id} overrides 省份名非法：${k}`);
      if (!periods.forces[p.overrides[k]]) fail(`时期 ${p.id} overrides 势力不存在：${p.overrides[k]}`);
    }
    for (const f of p.legend || []) if (!periods.forces[f]) fail(`时期 ${p.id} legend 势力不存在：${f}`);
    for (const f of [p.defaultForce, ...Object.values(p.overrides || {})]) {
      if (f && periods.forces[f] && !(p.legend || []).includes(f)) {
        warn(`时期 ${p.id} 的势力 ${f} 未列入 legend`);
      }
    }
    expect = p.to;
  }
  if (expect !== periods.end) fail(`时期未覆盖到 ${periods.end}，最后到 ${expect}`);
}

/* ---------- shigang events ---------- */
const events = loadGlobal("shigang-events.js", "SHIGANG_EVENTS");
if (events) {
  if (!Array.isArray(events)) fail("SHIGANG_EVENTS 不是数组");
  else {
    if (events.length < 60) fail(`事件数量不足：${events.length}（目标约 72）`);
    const ids = new Set();
    let prev = -1;
    const volumeCount = { 上编: 0, 中编: 0, 下编: 0 };
    const rankCount = { 1: 0, 2: 0, 3: 0 };
    for (const e of events) {
      if (!e.id) { fail(`事件缺少 id：${e.title}`); continue; }
      if (ids.has(e.id)) fail(`事件 id 重复：${e.id}`);
      ids.add(e.id);
      if (typeof e.year !== "number") fail(`${e.id} year 非数字`);
      if (e.year < 1840 || e.year > 2025) fail(`${e.id} year 越界：${e.year}`);
      if (e.year < prev - 1e-6) fail(`${e.id} 未按 year 升序（${prev} → ${e.year}）`);
      prev = e.year;
      if (!e.title) fail(`${e.id} 缺少 title`);
      if (!e.short || [...e.short].length > 10) warn(`${e.id} short 过长：${e.short}`);
      if (![1, 2, 3].includes(e.rank)) fail(`${e.id} rank 非法：${e.rank}`);
      else rankCount[e.rank]++;
      if (!CHAPTERS.has(e.chapter)) fail(`${e.id} chapter 非法：${e.chapter}`);
      else volumeCount[e.chapter.slice(0, 2)]++;
      if (CHAPTER_TITLES[e.chapter] && e.chapterTitle !== CHAPTER_TITLES[e.chapter]) {
        warn(`${e.id} chapterTitle 与章节表不一致：${e.chapterTitle}`);
      }
      if (!Array.isArray(e.lonlat) || e.lonlat.length !== 2 || !INSIDE(e.lonlat[0], e.lonlat[1])) {
        fail(`${e.id} lonlat 非法：${JSON.stringify(e.lonlat)}`);
      }
      if (!e.card) fail(`${e.id} 缺少 card`);
      else {
        for (const k of ["background", "contradiction", "task", "points", "pitfalls", "memory"]) {
          if (e.card[k] === undefined || e.card[k] === null || e.card[k] === "") fail(`${e.id} card.${k} 为空`);
        }
        if (Array.isArray(e.card.points) && e.card.points.length < 2) warn(`${e.id} card.points 少于 2 条`);
        if (Array.isArray(e.card.pitfalls) && e.card.pitfalls.length < 1) warn(`${e.id} 缺少 pitfalls`);
      }
    }
    for (const e of events) {
      for (const l of e.links || []) {
        if (!LINK_TYPES.has(l.type)) fail(`${e.id} link.type 非法：${l.type}`);
        if (!ids.has(l.to)) fail(`${e.id} link.to 指向不存在的 id：${l.to}`);
        if (l.to === e.id) fail(`${e.id} link 指向自身`);
      }
    }
    if (volumeCount.上编 < 18 || volumeCount.中编 < 24 || volumeCount.下编 < 18) {
      warn(`分编数量偏少：${JSON.stringify(volumeCount)}`);
    }
    console.log(`史纲：${events.length} 条（上编 ${volumeCount.上编} / 中编 ${volumeCount.中编} / 下编 ${volumeCount.下编}），rank1=${rankCount[1]}`);
  }
}

/* ---------- mao ---------- */
const mao = loadGlobal("mao-data.js", "MAO_DATA");
if (mao) {
  const theories = mao.theories || [];
  if (theories.length !== 5) fail(`MAO_DATA.theories 应为 5 条，实际 ${theories.length}`);
  const tids = new Set(theories.map(t => t.id));
  const nodes = mao.nodes || [];
  if (nodes.length < 24) fail(`毛中特节点不足：${nodes.length}（目标约 30）`);
  const nids = new Set();
  for (const n of nodes) {
    if (!n.id) { fail(`毛中特节点缺少 id：${n.title}`); continue; }
    if (nids.has(n.id)) fail(`毛中特节点 id 重复：${n.id}`);
    nids.add(n.id);
    if (typeof n.year !== "number" || n.year < 1921 || n.year > 2025) fail(`${n.id} year 非法：${n.year}`);
    if (!tids.has(n.theory)) fail(`${n.id} theory 不存在：${n.theory}`);
    if (!["congress", "theory", "practice", "document"].includes(n.kind)) fail(`${n.id} kind 非法：${n.kind}`);
    if (!Array.isArray(n.lonlat) || n.lonlat.length !== 2 || !INSIDE(n.lonlat[0], n.lonlat[1])) {
      fail(`${n.id} lonlat 非法`);
    }
    if (!n.card) fail(`${n.id} 缺少 card`);
    else {
      for (const k of ["background", "core", "status", "points", "pitfalls", "memory"]) {
        if (n.card[k] === undefined || n.card[k] === null || n.card[k] === "") fail(`${n.id} card.${k} 为空`);
      }
    }
  }
  const topics = mao.topics || [];
  if (topics.length < 6) fail(`毛中特专题不足：${topics.length}（目标 8-10）`);
  for (const t of topics) {
    if (!t.id || !t.name) fail("毛中特专题缺少 id/name");
    if (!tids.has(t.theory)) fail(`专题 ${t.id} theory 不存在：${t.theory}`);
    if (!t.card) fail(`专题 ${t.id} 缺少 card`);
  }
  for (const e of mao.edges || []) {
    if (!["inherit", "develop", "establish", "turn"].includes(e.type)) fail(`毛中特关系 type 非法：${e.type}`);
    if (!nids.has(e.from) && !tids.has(e.from)) fail(`毛中特关系 from 不存在：${e.from}`);
    if (!nids.has(e.to) && !tids.has(e.to)) fail(`毛中特关系 to 不存在：${e.to}`);
  }
  // 关键事实抽查
  const byTitle = new Map(nodes.map(n => [n.title, n]));
  const factChecks = [
    ["中共七大", 1945], ["中共八大", 1956], ["十一届三中全会", 1978],
    ["十五大", 1997], ["十六大", 2002], ["十七大", 2007], ["十八大", 2012],
    ["十九大", 2017], ["二十大", 2022]
  ];
  for (const [title, year] of factChecks) {
    const n = byTitle.get(title);
    if (!n) warn(`毛中特缺少关键节点：${title}`);
    else if (n.year !== year) fail(`${title} 年份应为 ${year}，实际 ${n.year}`);
  }
  console.log(`毛中特：${nodes.length} 节点 / ${topics.length} 专题 / ${(mao.edges || []).length} 关系`);
}

console.log("\n--- 校验结果 ---");
for (const w of warnings) console.log("WARN  " + w);
for (const e of errors) console.log("ERROR " + e);
if (errors.length) {
  console.log(`\n共 ${errors.length} 个错误，${warnings.length} 个警告。`);
  process.exit(1);
}
console.log(`通过（${warnings.length} 个警告）。`);
