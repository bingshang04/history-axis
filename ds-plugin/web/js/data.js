/* ============================================================
   data.js — 数据归一化与查询
   ============================================================ */
(function () {
  "use strict";
  var Axis = window.Axis = window.Axis || {};
  var U = Axis.util;

  var data = {
    geo: null,
    periods: null,
    periodsList: [],
    forces: {},
    periodsById: {},
    events: [],
    mao: null,
    theories: [],
    theoryMap: {},
    topics: [],
    topicMap: {},
    maoNodes: [],
    historyItems: [],
    theoryItems: [],
    allItems: [],
    itemByUid: {},
    initialized: false
  };

  function normalizeHistory(e) {
    return {
      uid: "h:" + e.id,
      kind: "history",
      id: e.id,
      year: Number(e.year),
      date: e.date || "",
      title: e.title || "",
      short: e.short || e.title || "",
      rank: e.rank || 2,
      chapter: e.chapter || "",
      chapterTitle: e.chapterTitle || "",
      place: e.place || "",
      lonlat: e.lonlat || null,
      summary: e.summary || "",
      force: e.force || "",
      tags: e.tags || [],
      card: e.card || null,
      links: e.links || [],
      theory: null,
      source: "shigang",
      raw: e
    };
  }

  function normalizeTheory(n) {
    return {
      uid: "m:" + n.id,
      kind: "theory",
      id: n.id,
      year: Number(n.year),
      date: n.date || "",
      title: n.title || "",
      short: n.short || n.title || "",
      rank: n.rank || 2,
      chapter: n.chapter || "",
      chapterTitle: "",
      place: n.place || "",
      lonlat: n.lonlat || null,
      summary: n.summary || "",
      force: n.theory || "mao",
      tags: n.tags || [],
      card: n.card || null,
      links: [],
      theory: n.theory || "mao",
      kindLabel: n.kind || "congress",
      source: "mao",
      raw: n
    };
  }

  data.init = function () {
    data.geo = window.CHINA_GEO || null;
    data.periods = window.SHIGANG_PERIODS || null;
    if (data.periods) {
      data.periodsList = (data.periods.periods || []).slice().sort(function (a, b) { return a.from - b.from; });
      data.forces = data.periods.forces || {};
      data.periodsList.forEach(function (p) { data.periodsById[p.id] = p; });
    }
    data.events = Array.isArray(window.SHIGANG_EVENTS) ? window.SHIGANG_EVENTS.slice().sort(function (a, b) { return a.year - b.year; }) : [];
    data.mao = window.MAO_DATA || { theories: [], nodes: [], topics: [], edges: [] };
    data.theories = (data.mao.theories || []).slice();
    data.theories.forEach(function (t) { data.theoryMap[t.id] = t; });
    data.topics = (data.mao.topics || []).slice();
    data.topics.forEach(function (t) { data.topicMap[t.id] = t; });
    data.maoNodes = (data.mao.nodes || []).slice().sort(function (a, b) { return a.year - b.year; });

    data.historyItems = data.events.map(normalizeHistory);
    data.theoryItems = data.maoNodes.map(normalizeTheory);
    // 「全部」时间轴/地图去重：毛中特节点若与史纲事件同题同年，只保留史纲节点，避免双份标签
    data.theoryItems.forEach(function (it) {
      it.dupOfHistory = data.historyItems.some(function (h) {
        return h.title === it.title || (Math.abs(h.year - it.year) < 0.01 && h.short === it.short);
      });
    });
    data.allItems = data.historyItems.concat(data.theoryItems.filter(function (it) { return !it.dupOfHistory; })).sort(function (a, b) {
      if (a.year !== b.year) return a.year - b.year;
      return a.kind === "history" ? -1 : 1;
    });
    data.historyItems.forEach(function (it) { data.itemByUid[it.uid] = it; });
    data.theoryItems.forEach(function (it) { data.itemByUid[it.uid] = it; });
    data.initialized = true;
  };

  data.tabRange = function (tab) {
    var ev = data.events;
    var start = ev.length ? ev[0].year : 1840;
    var end = ev.length ? ev[ev.length - 1].year : 2025;
    if (tab === "mao") {
      return [1921, 2025];
    }
    if (tab === "all") return [start, Math.max(end, 2025)];
    return [Math.min(1840, start), Math.max(end, 2025)];
  };

  data.itemsFor = function (tab) {
    if (tab === "mao") return data.theoryItems;
    if (tab === "all") return data.allItems;
    return data.historyItems;
  };

  data.periodAt = function (year) {
    var list = data.periodsList;
    if (!list.length) return null;
    if (year <= list[0].from) return list[0];
    var chosen = list[0];
    for (var i = 0; i < list.length; i++) {
      if (list[i].from <= year + 1e-6) chosen = list[i];
      else break;
    }
    return chosen;
  };

  data.forceOf = function (period, short) {
    if (!period) return null;
    if (period.overrides && period.overrides[short]) return period.overrides[short];
    return period.defaultForce;
  };

  data.forceColor = function (key) {
    var f = data.forces[key];
    return f ? f.color : "#4a4a4a";
  };

  data.forceName = function (key) {
    var f = data.forces[key];
    return f ? f.name : key;
  };

  data.getTheory = function (id) { return data.theoryMap[id] || null; };
  data.getTopic = function (id) { return data.topicMap[id] || null; };

  data.topicsForTheory = function (theoryId) {
    return data.topics.filter(function (t) { return t.theory === theoryId; });
  };

  data.item = function (uid) { return data.itemByUid[uid] || null; };

  data.findById = function (kind, id) {
    return kind === "theory" ? (data.itemByUid["m:" + id] || null) : (data.itemByUid["h:" + id] || null);
  };

  data.latestItem = function (tab, year) {
    var items = data.itemsFor(tab);
    if (!items.length) return null;
    var chosen = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i].year <= year + 1e-6) chosen = items[i];
      else break;
    }
    return chosen || items[0];
  };

  data.indexInTab = function (tab, uid) {
    var items = data.itemsFor(tab);
    for (var i = 0; i < items.length; i++) if (items[i].uid === uid) return i;
    return -1;
  };

  data.volumes = function (tab) {
    if (tab === "mao") {
      return [
        { from: 1921, to: 1949, label: "新民主主义革命时期" },
        { from: 1949, to: 1978, label: "社会主义革命和建设" },
        { from: 1978, to: 2012, label: "改革开放与现代化建设" },
        { from: 2012, to: 2025, label: "中国特色社会主义新时代" }
      ];
    }
    return [
      { from: 1840, to: 1919, label: "上编 · 旧民主主义革命" },
      { from: 1919, to: 1949, label: "中编 · 新民主主义革命" },
      { from: 1949, to: 2025, label: "下编 · 社会主义革命、建设与改革开放" }
    ];
  };

  data.volumeAt = function (year) {
    var vols = data.volumes("shigang");
    for (var i = 0; i < vols.length; i++) if (year >= vols[i].from && year < vols[i].to) return vols[i];
    return vols[vols.length - 1];
  };

  data.searchIndex = function () {
    var out = [];
    data.historyItems.forEach(function (it) {
      out.push({
        uid: it.uid, year: it.year, title: it.title,
        chapter: it.chapter, kindLabel: "史纲", rank: it.rank,
        keywords: [it.title, it.short, it.chapter, it.place, it.summary, (it.tags || []).join(" ")].join(" ")
      });
    });
    data.theoryItems.forEach(function (it) {
      out.push({
        uid: it.uid, year: it.year, title: it.title,
        chapter: it.chapter, kindLabel: "毛中特", rank: it.rank,
        keywords: [it.title, it.short, it.chapter, it.place, it.summary, (it.tags || []).join(" ")].join(" ")
      });
    });
    data.topics.forEach(function (t) {
      out.push({
        uid: "t:" + t.id, year: null, title: t.name,
        chapter: t.chapter || "", kindLabel: "专题", rank: 0,
        keywords: [t.name, t.chapter, t.summary, (t.card && t.card.points || []).join(" ")].join(" ")
      });
    });
    return out;
  };

  data.topicByUid = function (uid) {
    if (!uid || uid.indexOf("t:") !== 0) return null;
    return data.topicMap[uid.slice(2)] || null;
  };

  data.REL_NAMES = { cause: "因果 / 背景", promote: "促进 / 推动", turn: "转折", block: "阻碍 / 被迫" };

  /** 选中历史事件的全部关联（出边 + 入边），供地图/时间轴虚线使用。 */
  data.relationsFor = function (uid) {
    var item = data.item(uid);
    if (!item || item.kind !== "history") return [];
    var out = [];
    (item.links || []).forEach(function (l) {
      var t = data.item("h:" + l.to);
      if (t) out.push({ target: t, type: l.type, label: l.label || data.REL_NAMES[l.type] || "", dir: "out" });
    });
    data.historyItems.forEach(function (h) {
      if (h.uid === item.uid) return;
      (h.links || []).forEach(function (l) {
        if (l.to === item.id) {
          var t = data.item("h:" + h.id);
          if (t) out.push({ target: t, type: l.type, label: l.label || data.REL_NAMES[l.type] || "", dir: "in" });
        }
      });
    });
    return out;
  };

  Axis.data = data;
})();
