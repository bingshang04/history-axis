/**
 * dsh-history-axis-viz — Host half.
 * Registers a static route for the standalone visualization and injects a
 * full-screen launcher (button + overlay iframe) into the Harness Web page.
 *
 * The visualization itself is a self-contained offline HTML app under ./web.
 */
import { createReadStream, promises as fsp } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WEB_ROOT = path.resolve(fileURLToPath(new URL("./web/", import.meta.url)));
const ROUTE = "/history-axis/";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

function safeFile(rel) {
  const clean = path.normalize(rel).replace(/^(\.\.(\/|\\|$))+/, "");
  const abs = path.resolve(WEB_ROOT, clean);
  if (abs !== WEB_ROOT && !abs.startsWith(WEB_ROOT + path.sep)) return null;
  return abs;
}

async function serve(req, res) {
  let url;
  try {
    url = new URL(req.url, "http://local");
  } catch {
    res.writeHead(400); res.end("Bad request"); return;
  }
  let rel = decodeURIComponent(url.pathname.slice(ROUTE.length));
  if (!rel || rel.endsWith("/")) rel += "index.html";
  const file = safeFile(rel);
  if (!file) {
    res.writeHead(403); res.end("Forbidden"); return;
  }
  try {
    const stat = await fsp.stat(file);
    if (!stat.isFile()) { res.writeHead(404); res.end("Not found"); return; }
    res.writeHead(200, {
      "Content-Type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream",
      "Content-Length": stat.size,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    });
    createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404); res.end("Not found");
  }
}

const STYLE = `
#dsh-history-axis-launch{position:fixed;right:0;top:44%;transform:translateY(-50%);z-index:2147482900;
  display:flex;align-items:center;gap:6px;writing-mode:vertical-rl;letter-spacing:3px;
  padding:13px 7px;border:1px solid rgba(201,164,92,.5);border-right:0;border-radius:7px 0 0 7px;
  background:linear-gradient(180deg,rgba(21,18,13,.96),rgba(10,13,18,.97));color:#e2c98f;
  font:12px/1.2 "Microsoft YaHei","PingFang SC",sans-serif;cursor:pointer;
  box-shadow:0 8px 30px rgba(0,0,0,.45),0 0 22px rgba(201,164,92,.10);}
#dsh-history-axis-launch:hover{color:#fff2ce;border-color:rgba(226,201,143,.85);}
#dsh-history-axis-launch .dot{width:5px;height:5px;border-radius:50%;background:#c9a45c;box-shadow:0 0 8px #c9a45c;}
#dsh-history-axis-overlay{position:fixed;inset:0;z-index:2147482950;background:#05080c;
  display:flex;flex-direction:column;}
#dsh-history-axis-overlay .bar{flex:0 0 42px;display:flex;align-items:center;gap:12px;
  padding:0 14px;border-bottom:1px solid rgba(201,164,92,.22);
  background:linear-gradient(180deg,#111721,#0a0e14);color:#ded6c6;
  font:12.5px/1 "Microsoft YaHei","PingFang SC",sans-serif;letter-spacing:1px;}
#dsh-history-axis-overlay .bar b{color:#e2c98f;font-weight:600;}
#dsh-history-axis-overlay .bar .sp{flex:1;}
#dsh-history-axis-overlay .bar button{border:1px solid rgba(201,164,92,.3);background:rgba(201,164,92,.08);
  color:#c9a45c;border-radius:3px;padding:4px 10px;font:11px/1.3 "Microsoft YaHei",sans-serif;cursor:pointer;}
#dsh-history-axis-overlay .bar button:hover{color:#f4e4bd;border-color:rgba(201,164,92,.6);}
#dsh-history-axis-overlay iframe{flex:1;width:100%;height:100%;border:0;display:block;background:#070a0f;}
`;

const SCRIPT = `(function(){
  if (window.__DSH_HISTORY_AXIS__) return;
  window.__DSH_HISTORY_AXIS__ = true;
  function init(){
    if (document.getElementById('dsh-history-axis-launch')) return;
    var btn = document.createElement('button');
    btn.id = 'dsh-history-axis-launch';
    btn.type = 'button';
    btn.title = '打开史纲·毛中特时间轴（Alt+Shift+H）';
    btn.setAttribute('aria-label', '打开史纲·毛中特时间轴');
    btn.innerHTML = '<span class="dot"></span>时轴';
    document.body.appendChild(btn);

    var overlay = null;
    function close(){
      if (!overlay) return;
      overlay.remove(); overlay = null;
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e){ if (e.key === 'Escape') close(); }
    function open(){
      if (overlay) return;
      var qs = location.search || '';
      overlay = document.createElement('div');
      overlay.id = 'dsh-history-axis-overlay';
      overlay.innerHTML = '<div class="bar"><b>史纲 · 毛中特 时间轴</b>' +
        '<span style="color:#7d7668">交互式考点复习 · 地图 / 时间轴 / 理论图谱</span>' +
        '<span class="sp"></span>' +
        '<button type="button" data-act="new">新窗口打开</button>' +
        '<button type="button" data-act="close">关闭 Esc</button></div>' +
        '<iframe src="/history-axis/' + qs + '" title="史纲·毛中特时间轴"></iframe>';
      document.body.appendChild(overlay);
      overlay.querySelector('[data-act="close"]').addEventListener('click', close);
      overlay.querySelector('[data-act="new"]').addEventListener('click', function(){
        window.open('/history-axis/' + qs, '_blank', 'noopener');
      });
      var frame = overlay.querySelector('iframe');
      frame.addEventListener('load', function(){ try { frame.contentWindow.focus(); } catch(e){} });
      document.addEventListener('keydown', onKey);
      setTimeout(function(){ try { frame.contentWindow.focus(); } catch(e){} }, 300);
    }
    btn.addEventListener('click', open);
    function hasSidebarEntry(){
      try { return !!document.querySelector('[aria-label="时间轴"], [title="时间轴"]'); } catch (e) { return false; }
    }
    if (hasSidebarEntry()) btn.style.display = 'none';
    else {
      try {
        var obs = new MutationObserver(function(){
          if (hasSidebarEntry()) { btn.style.display = 'none'; obs.disconnect(); }
        });
        obs.observe(document.body, { childList: true, subtree: true });
        setTimeout(function(){ if (hasSidebarEntry()) btn.style.display = 'none'; }, 5000);
      } catch (e) {}
    }
    window.addEventListener('keydown', function(e){
      if (e.altKey && e.shiftKey && (e.key === 'H' || e.key === 'h')) { e.preventDefault(); if (overlay) close(); else open(); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();`;

export function apply(root) {
  // Register the structured injection rows immediately: the desktop host collects
  // this table once during boot, so waiting for services here would miss it.
  root.on("webserver/index-inject", (table) => {
    if (!Array.isArray(table)) return;
    for (const row of table) {
      if (row && row.kind === "script" && typeof row.text === "string"
        && row.text.indexOf("dsh-history-axis-launch") >= 0) return;
    }
    table.push({ kind: "style", text: STYLE });
    table.push({ kind: "script", placement: "body", text: SCRIPT });
  });

  root.inject(["webServer"], (ctx) => {
    ctx.effect(() => ctx.webServer.register({
      kind: "prefix",
      path: "/history-axis",
      handler: serve
    }));

    ctx.effect(() => ctx.webServer.register({
      kind: "exact",
      path: "/history-axis",
      handler(req, res) {
        res.writeHead(302, { Location: ROUTE, "Cache-Control": "no-store" });
        res.end();
      }
    }));

    // Web (non-desktop) builds pass through tapIndex instead of the boot graph.
    ctx.effect(() => ctx.webServer.tapIndex((html) => {
      if (html.indexOf("dsh-history-axis-launch") >= 0) return html;
      return html
        .replace("</head>", "<style>" + STYLE + "</style></head>")
        .replace("</body>", "<script>" + SCRIPT + "</script></body>");
    }));
  });
}
