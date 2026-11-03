/* DSH Client half: a sidebar panel icon + a full main panel that hosts the
   standalone visualization. The Host half serves the app at /history-axis/. */
window.__ModuleLoader__.load({
  id: "dsh-history-axis-viz",
  factory(require) {
    const React = require("react");
    const h = React.createElement;

    function Panel() {
      const ref = React.useRef(null);
      React.useLayoutEffect(() => {
        function fit() {
          const el = ref.current;
          if (!el) return;
          let node = el.parentElement;
          let h = 0;
          while (node && node !== document.body) {
            const ch = node.clientHeight;
            if (ch > 160) { h = ch; break; }
            node = node.parentElement;
          }
          if (!h) h = window.innerHeight;
          el.style.height = h + "px";
          el.style.minHeight = "0";
        }
        fit();
        const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
        if (ro) ro.observe(document.body);
        window.addEventListener("resize", fit);
        return () => {
          if (ro) ro.disconnect();
          window.removeEventListener("resize", fit);
        };
      }, []);
      return h(
        "div",
        {
          ref,
          style: {
            width: "100%",
            height: "100%",
            minHeight: 0,
            background: "#070a0f",
            display: "flex",
            overflow: "hidden"
          }
        },
        h("iframe", {
          src: "/history-axis/" + (typeof window !== "undefined" ? window.location.search : ""),
          title: "史纲 · 毛中特 时间轴",
          style: {
            flex: "1 1 auto",
            width: "100%",
            height: "100%",
            border: "0",
            display: "block",
            background: "#070a0f"
          }
        })
      );
    }

    function PanelIcon(props) {
      const size = (props && props.size) || 24;
      const active = !!(props && props.active);
      return h(
        "svg",
        {
          width: size,
          height: size,
          viewBox: "0 0 24 24",
          fill: "none",
          stroke: "currentColor",
          strokeWidth: active ? 1.9 : 1.5,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          "aria-hidden": true,
          style: { display: "block", opacity: active ? 1 : 0.82 }
        },
        h("path", { d: "M4 19h16M5 19V11M10 19V6M15 19v-8M20 19V9" }),
        h("circle", { cx: 10, cy: 6, r: 1.35, fill: "currentColor", stroke: "none" }),
        h("circle", { cx: 15, cy: 11, r: 1.35, fill: "currentColor", stroke: "none" }),
        h("path", { d: "M4.5 10.5C8 11 9 15 12 15s5-3 7.5-4.5", opacity: 0.45 })
      );
    }

    return {
      inject: ["slots"],
      apply(ctx) {
        ctx.slots.inject("main", () =>
          ctx.slots.register({ name: "main", key: "history-axis" }, Panel)
        );
        ctx.slots.inject("sidebar.panellist", () =>
          ctx.slots.register(
            {
              name: "sidebar.panellist",
              id: "history-axis",
              order: 6,
              label: () => "时间轴"
            },
            PanelIcon
          )
        );
      }
    };
  }
});
