const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage({ viewport: { width: 1876, height: 922 } });
  const logs = [];
  page.on("pageerror", (e) => logs.push("PAGEERROR " + e.message));
  page.on("console", (m) => { if (m.type() === "error") logs.push("CONSOLE " + m.text()); });
  await page.goto("http://127.0.0.1:8765/#tab=shigang&year=1851", { waitUntil: "networkidle" });
  await page.waitForTimeout(900);

  // zoom anchor test: point under cursor must not move
  const zoomTest = await page.evaluate(() => {
    const map = window.Axis.map;
    const svg = document.querySelector("#mapSvg");
    function baseToScreen(x, y) {
      const pt = svg.createSVGPoint();
      pt.x = x; pt.y = y;
      const m = svg.getScreenCTM();
      const s = pt.matrixTransform(m);
      return [s.x, s.y];
    }
    function testAt(sx, sy) {
      const p = map.screenToBase(sx, sy);
      const u = [(p[0] - map.tx) / map.z, (p[1] - map.ty) / map.z];
      const before = baseToScreen(map.z * u[0] + map.tx, map.z * u[1] + map.ty);
      map.zoomAt(p, map.z * 1.2);
      const after = baseToScreen(map.z * u[0] + map.tx, map.z * u[1] + map.ty);
      return { dx: +(after[0] - before[0]).toFixed(2), dy: +(after[1] - before[1]).toFixed(2), zoom: map.z };
    }
    map.reset();
    const a = testAt(800, 400);
    const b = testAt(1150, 300);
    const c = testAt(1000, 600);
    map.reset();
    return { a, b, c };
  });
  console.log("ZOOM", JSON.stringify(zoomTest));

  // map pin coverage: nearest-click should select each pin's own event when clicked
  const pinCoverage = await page.evaluate(() => {
    const map = window.Axis.map;
    const out = { total: 0, selectedSelf: 0, misses: [] };
    Object.keys(map.pinMap).forEach((uid) => {
      const el = map.pinMap[uid];
      if (el.style.display === "none") return;
      const r = el.getBoundingClientRect();
      if (!r.width) return;
      out.total++;
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const got = map.pickPin(cx, cy);
      if (got === uid) out.selectedSelf++;
      else out.misses.push({ want: uid, got: got });
    });
    return out;
  });
  console.log("PIN_PICK", JSON.stringify(pinCoverage));

  // timeline chooser on dense cluster
  const dotChooser = await page.evaluate(() => {
    const tl = window.Axis.timeline;
    const dots = Array.from(document.querySelectorAll(".tl-dot"));
    // find a dot with another dot within 12 px
    let target = null;
    for (const d of dots) {
      const r = d.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const near = dots.filter((o) => {
        if (o === d) return false;
        const q = o.getBoundingClientRect();
        return Math.hypot(cx - (q.left + q.width / 2), cy - (q.top + q.height / 2)) <= 12;
      });
      if (near.length) { target = { cx, cy, near: near.length }; break; }
    }
    return target;
  });
  if (dotChooser) {
    await page.mouse.click(dotChooser.cx, dotChooser.cy);
    await page.waitForTimeout(300);
    console.log("TIMELINE_CHOOSER", JSON.stringify(await page.evaluate(() => ({
      open: !!document.querySelector(".tl-chooser"),
      items: document.querySelectorAll(".tl-chooser button").length
    }))));
    if (await page.locator(".tl-chooser button").count()) {
      await page.locator(".tl-chooser button").nth(1).click();
      await page.waitForTimeout(300);
      console.log("TIMELINE_PICK", JSON.stringify(await page.evaluate(() => ({
        uid: window.Axis.app.state.uid,
        title: document.querySelector("#leftTitle").textContent,
        chooser: !!document.querySelector(".tl-chooser")
      }))));
    }
  } else {
    console.log("TIMELINE_CHOOSER none");
  }

  console.log("LOGS", JSON.stringify(logs));
  await browser.close();
})();
