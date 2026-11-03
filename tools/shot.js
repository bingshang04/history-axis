const { chromium } = require("playwright");
const path = require("path");

const OUT = path.resolve(__dirname, "..", "screenshots");
const BASE = "http://127.0.0.1:8765/";

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({ viewport: { width: 1876, height: 922 }, deviceScaleFactor: 1 });
  const logs = [];
  page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") logs.push(m.type() + ": " + m.text()); });
  page.on("pageerror", (e) => logs.push("PAGEERROR: " + e.message));

  await page.goto(BASE + "#tab=shigang&year=1855", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  const info = await page.evaluate(() => {
    const app = window.Axis && window.Axis.app;
    return {
      state: app ? { tab: app.state.tab, year: app.state.year, uid: app.state.uid } : null,
      history: window.Axis.data.historyItems.length,
      theory: window.Axis.data.theoryItems.length,
      pins: document.querySelectorAll(".pin").length,
      labels: document.querySelectorAll(".tl-label").length,
      dots: document.querySelectorAll(".tl-dot").length,
      bigYear: (document.querySelector("#bigYear") || {}).textContent,
      leftTitle: (document.querySelector("#leftTitle") || {}).textContent,
      rightTitle: (document.querySelector("#eventTitle") || {}).textContent,
      mapPaths: document.querySelectorAll(".province").length,
      mapViewBox: document.querySelector("#mapSvg").getAttribute("viewBox"),
      mapRect: document.querySelector("#mapSvg").getBoundingClientRect().toJSON(),
      leftScroll: (() => { const e = document.querySelector("#leftScroll"); return { h: e.scrollHeight, c: e.clientHeight }; })(),
      timelineLabelsClipped: (() => {
        const r = document.querySelector("#tlLabels").getBoundingClientRect();
        return Array.from(document.querySelectorAll(".tl-label")).filter(el => {
          const b = el.getBoundingClientRect();
          return b.left < r.left - 2 || b.right > r.right + 2;
        }).length;
      })()
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await page.screenshot({ path: path.join(OUT, "app-1855.png") });

  // 参考图同款：第二次鸦片战争
  await page.goto(BASE + "#tab=shigang&uid=h:second-opium-war");
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, "app-second-opium.png") });

  // 毛中特真实点击
  await page.locator('.tab[data-tab="mao"]').click();
  await page.waitForTimeout(500);
  const maoInfo = await page.evaluate(() => ({
    state: { tab: window.Axis.app.state.tab, year: window.Axis.app.state.year, uid: window.Axis.app.state.uid },
    nodes: document.querySelectorAll(".theory-node").length,
    edges: document.querySelectorAll("#theorySvg path[marker-end]").length,
    labels: document.querySelectorAll(".theory-node-label").length,
    leftTitle: document.querySelector("#leftTitle").textContent,
    rightTitle: document.querySelector("#eventTitle").textContent
  }));
  console.log("MAO", JSON.stringify(maoInfo));
  await page.screenshot({ path: path.join(OUT, "app-mao.png") });

  // 全部模式
  await page.locator('.tab[data-tab="all"]').click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, "app-all.png") });

  // 播放 1.2 秒
  await page.locator('.tab[data-tab="shigang"]').click();
  await page.waitForTimeout(300);
  const before = await page.evaluate(() => window.Axis.app.state.year);
  await page.locator("#playBtn").click();
  await page.waitForTimeout(1500);
  const after = await page.evaluate(() => ({ year: window.Axis.app.state.year, playing: window.Axis.player.playing, label: document.querySelector("#playLabel").textContent }));
  await page.locator("#playBtn").click();
  console.log("PLAY", JSON.stringify({ before, after }));

  // 搜索
  await page.keyboard.press("/");
  await page.waitForTimeout(250);
  await page.locator("#searchInput").fill("遵义");
  await page.waitForTimeout(250);
  const searchInfo = await page.evaluate(() => ({ open: !document.querySelector("#searchOverlay").hidden, results: document.querySelectorAll(".search-item").length, first: (document.querySelector(".search-item") || {}).textContent }));
  console.log("SEARCH", JSON.stringify(searchInfo));
  await page.screenshot({ path: path.join(OUT, "app-search.png") });
  await page.keyboard.press("Escape");

  // 1937 战役期
  await page.goto(BASE + "#tab=shigang&year=1937");
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, "app-1937.png") });

  const page440 = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  page440.on("pageerror", (e) => logs.push("1440 PAGEERROR: " + e.message));
  await page440.goto(BASE + "#tab=shigang&year=1855", { waitUntil: "networkidle" });
  await page440.waitForTimeout(900);
  await page440.screenshot({ path: path.join(OUT, "app-1440.png") });
  console.log("1440", JSON.stringify(await page440.evaluate(() => ({
    leftW: document.querySelector("#leftPanel").getBoundingClientRect().width,
    mapW: document.querySelector("#mapArea").getBoundingClientRect().width,
    overflow: document.body.scrollWidth > window.innerWidth,
    viewBox: document.querySelector("#mapSvg").getAttribute("viewBox")
  }))));

  console.log("LOGS:", JSON.stringify(logs, null, 2));
  await browser.close();
})();
