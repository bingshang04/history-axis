const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({ viewport: { width: 1876, height: 922 } });
  const logs = [];
  page.on("pageerror", (e) => logs.push("PAGEERROR " + e.message));
  page.on("console", (m) => { if (m.type() === "error") logs.push("CONSOLE " + m.text()); });
  await page.goto("http://127.0.0.1:8765/#tab=shigang&uid=h:second-opium-war", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  const pinInfo = await page.evaluate(() => {
    const visible = Array.from(document.querySelectorAll(".pin:not(.far)")).map((el) => {
      const r = el.getBoundingClientRect();
      const core = el.querySelector(".pin-core");
      const cr = core ? core.getBoundingClientRect() : r;
      const cx = cr.left + cr.width / 2, cy = cr.top + cr.height / 2;
      const top = document.elementFromPoint(cx, cy);
      return {
        uid: el.getAttribute("data-uid"),
        x: +cx.toFixed(1), y: +cy.toFixed(1),
        hitSelf: !!(top && top.closest && top.closest(".pin") === el)
      };
    });
    let overlaps = 0;
    for (let i = 0; i < visible.length; i++) {
      for (let j = i + 1; j < visible.length; j++) {
        const d = Math.hypot(visible[i].x - visible[j].x, visible[i].y - visible[j].y);
        if (d < 7) overlaps++;
      }
    }
    return { count: visible.length, covered: visible.filter(v => !v.hitSelf).length, overlaps, pins: visible };
  });
  console.log("PINS", JSON.stringify(pinInfo, null, 2));

  const dotInfo = await page.evaluate(() => {
    const dots = Array.from(document.querySelectorAll(".tl-dot")).map((el) => {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const top = document.elementFromPoint(cx, cy);
      return { uid: el.getAttribute("data-uid"), x: +cx.toFixed(1), y: +cy.toFixed(1), hitSelf: !!(top && (top === el || top.closest(".tl-dot") === el)) };
    });
    let overlaps = 0;
    for (let i = 0; i < dots.length; i++) for (let j = i + 1; j < dots.length; j++) {
      if (Math.hypot(dots[i].x - dots[j].x, dots[i].y - dots[j].y) < 7) overlaps++;
    }
    return { count: dots.length, covered: dots.filter(v => !v.hitSelf).length, overlaps };
  });
  console.log("DOTS", JSON.stringify(dotInfo));

  // Search pause
  await page.locator("#playBtn").click();
  await page.waitForTimeout(250);
  await page.keyboard.press("/");
  await page.waitForTimeout(200);
  console.log("SEARCH_PAUSE", await page.evaluate(() => ({ playing: window.Axis.player.playing, open: !document.querySelector("#searchOverlay").hidden })));
  await page.locator("#searchInput").fill("中国式现代化");
  await page.waitForTimeout(200);
  console.log("SEARCH_TOP", await page.evaluate(() => Array.from(document.querySelectorAll(".search-item")).slice(0, 3).map(e => e.textContent)));
  await page.keyboard.press("Escape");

  // Topic back
  await page.locator('.tab[data-tab="mao"]').click();
  await page.waitForTimeout(350);
  const topicBtn = page.locator(".topic-chip").first();
  if (await topicBtn.count()) {
    await topicBtn.click();
    await page.waitForTimeout(250);
    const t1 = await page.evaluate(() => ({ eyebrow: document.querySelector("#leftEyebrow").textContent, title: document.querySelector("#leftTitle").textContent, hasBack: !!document.querySelector("[data-topic-back]") }));
    if (await page.locator("[data-topic-back]").count()) {
      await page.locator("[data-topic-back]").click();
      await page.waitForTimeout(250);
    }
    const t2 = await page.evaluate(() => ({ eyebrow: document.querySelector("#leftEyebrow").textContent, title: document.querySelector("#leftTitle").textContent }));
    console.log("TOPIC", JSON.stringify({ t1, t2 }));
  } else {
    console.log("TOPIC none");
  }

  // History back after user selection
  await page.locator('.tab[data-tab="shigang"]').click();
  await page.waitForTimeout(250);
  const before = await page.evaluate(() => ({ year: window.Axis.app.state.year, uid: window.Axis.app.state.uid, h: location.hash }));
  await page.locator('.tl-label').first().click();
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => ({ year: window.Axis.app.state.year, uid: window.Axis.app.state.uid, h: location.hash }));
  await page.goBack();
  await page.waitForTimeout(500);
  const back = await page.evaluate(() => ({ year: window.Axis.app.state.year, uid: window.Axis.app.state.uid, h: location.hash }));
  console.log("HISTORY", JSON.stringify({ before, after, back }));

  console.log("LOGS", JSON.stringify(logs));
  await browser.close();
})();
