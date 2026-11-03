#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Build data/china-geo.js from DataV China province GeoJSON.

Pipeline: WGS84 lon/lat -> cylindrical / conic projection -> fit the *mainland*
(province geometry with lat >= MAIN_LAT) to the 1000x760 canvas
-> Douglas-Peucker simplify (adaptive for small islands/provinces)
-> JS paths + label anchors with collision avoidance.

Usage:
  python tools/build_geo.py [--projection miller|mercator|albers|equirect]
                            [--input path/to/100000_full.json] [--tolerance 0.34]
The input file is downloaded from DataV when --input is omitted (cached).
"""
import argparse
import json
import math
import os

DATA_URL = "https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "china-geo.js")
CACHE = os.path.join(ROOT, "tools", ".cache", "100000_full.json")

VIEW_W, VIEW_H = 1000.0, 760.0
PAD_X, PAD_Y = 18.0, 16.0

# Albers parameters (only used when --projection albers)
LON0, LAT1, LAT2 = 105.0, 25.0, 47.0

# Main map = mainland + Taiwan + Hainan main island.  Every South China Sea
# island group sits below 18N (the northernmost 西沙 rock is 17.06N, a 0.6px²
# speck that would otherwise define the southern edge of the main viewBox and
# leave two lone dots sitting on the frame).  Hainan island's south tip is
# 18.14N, so 18.0 cleanly separates "main map" from "inset".
MAIN_LAT = 18.0

# label metric used for collision avoidance, in viewBox units.
# Calibrated against Chromium rendering of 11px CJK glyphs: a 2-glyph label
# measures ~24.4 user units wide, a 3-glyph one ~33.9.
LABEL_W_UNIT = 11.4      # per CJK glyph
LABEL_PAD = 5.0          # required clearance between label boxes
LABEL_H = 15.5

SHORT_NAMES = {
    "北京市": "北京", "天津市": "天津", "河北省": "河北", "山西省": "山西",
    "内蒙古自治区": "内蒙古", "辽宁省": "辽宁", "吉林省": "吉林", "黑龙江省": "黑龙江",
    "上海市": "上海", "江苏省": "江苏", "浙江省": "浙江", "安徽省": "安徽",
    "福建省": "福建", "江西省": "江西", "山东省": "山东", "河南省": "河南",
    "湖北省": "湖北", "湖南省": "湖南", "广东省": "广东", "广西壮族自治区": "广西",
    "海南省": "海南", "重庆市": "重庆", "四川省": "四川", "贵州省": "贵州",
    "云南省": "云南", "西藏自治区": "西藏", "陕西省": "陕西", "甘肃省": "甘肃",
    "青海省": "青海", "宁夏回族自治区": "宁夏", "新疆维吾尔自治区": "新疆",
    "台湾省": "台湾", "香港特别行政区": "香港", "澳门特别行政区": "澳门",
}

# Preferred label direction for the tiny provinces: these cannot hold their own
# label, so the label is pushed outward (over the neighbouring province or sea)
# until it clears everything else at 0.8x display scale.
LABEL_HINTS = {
    "北京": [(7.0, -11.0), (11.0, -13.0), (-12.0, -10.0)],
    "天津": [(13.0, 9.0), (15.0, 13.0), (10.0, -13.0)],
    "上海": [(17.0, 3.0), (19.0, 9.0), (15.0, -9.0)],
    "香港": [(17.0, 3.0), (19.0, 9.0), (15.0, -8.0)],
    "澳门": [(-11.0, 18.0), (-8.0, 22.0), (-15.0, 14.0)],
    "台湾": [(0.0, 0.0), (8.0, 0.0)],
    "海南": [(0.0, 3.0), (0.0, 8.0)],
}

MIN_RING_AREA = 0.30     # viewBox px^2, drops sub-pixel island specks


def make_projector(kind):
    """Return f(lon, lat) -> (x, y) in projected units (radians based)."""
    if kind == "albers":
        phi1 = math.radians(LAT1)
        phi2 = math.radians(LAT2)
        n = (math.sin(phi1) + math.sin(phi2)) / 2.0
        c = math.cos(phi1) ** 2 + 2.0 * n * math.sin(phi1)
        rho0 = math.sqrt(max(c - 2.0 * n * math.sin(phi1), 0.0)) / n

        def f(lon, lat):
            phi = math.radians(lat)
            lam = math.radians(lon - LON0)
            rho = math.sqrt(max(c - 2.0 * n * math.sin(phi), 0.0)) / n
            return rho * math.sin(n * lam), rho0 - rho * math.cos(n * lam)
        return f

    if kind == "mercator":
        def f(lon, lat):
            phi = math.radians(max(-85.0, min(85.0, lat)))
            return (math.radians(lon - LON0),
                    math.log(math.tan(math.pi / 4.0 + phi / 2.0)))
        return f

    if kind == "miller":
        # Miller cylindrical: a mild compromise between Mercator and
        # equirectangular, keeps China's familiar world-map proportions.
        def f(lon, lat):
            phi = math.radians(max(-85.0, min(85.0, lat)))
            return (math.radians(lon - LON0),
                    1.25 * math.log(math.tan(math.pi / 4.0 + 0.4 * phi)))
        return f

    if kind == "equirect":
        def f(lon, lat):
            return math.radians(lon - LON0), math.radians(lat)
        return f

    raise SystemExit("unknown projection: %s" % kind)


def ring_area(ring):
    a = 0.0
    for i in range(len(ring) - 1):
        x1, y1 = ring[i]
        x2, y2 = ring[i + 1]
        a += x1 * y2 - x2 * y1
    return abs(a) / 2.0


def dedupe_ring(points):
    out = []
    for p in points:
        if not out or abs(p[0] - out[-1][0]) > 1e-9 or abs(p[1] - out[-1][1]) > 1e-9:
            out.append(p)
    if len(out) > 1 and out[0] == out[-1]:
        out.pop()
    return out


def bbox_of(points):
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    return min(xs), min(ys), max(xs), max(ys)


def dp_simplify(points, tol):
    """Douglas-Peucker on an open polyline; caller closes the ring."""
    if len(points) <= 3 or tol <= 0.0:
        return points

    def seg_dist(p, a, b):
        ax, ay = a
        bx, by = b
        px, py = p
        dx, dy = bx - ax, by - ay
        if dx == 0 and dy == 0:
            return math.hypot(px - ax, py - ay)
        t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
        t = max(0.0, min(1.0, t))
        return math.hypot(px - (ax + t * dx), py - (ay + t * dy))

    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        a, b = stack.pop()
        if b <= a + 1:
            continue
        maxd, idx = -1.0, -1
        for i in range(a + 1, b):
            d = seg_dist(points[i], points[a], points[b])
            if d > maxd:
                maxd, idx = d, i
        if maxd > tol and idx > 0:
            keep[idx] = True
            stack.append((a, idx))
            stack.append((idx, b))
    out = [points[i] for i in range(len(points)) if keep[i]]
    return out if len(out) >= 3 else points


def ring_tolerance(ring, tol):
    """Small islands / Macau / Hong Kong keep much more detail than the
    mainland, otherwise they collapse into meaningless triangles."""
    x0, y0, x1, y1 = bbox_of(ring)
    diag = math.hypot(x1 - x0, y1 - y0)
    if diag < 10.0:
        return tol * 0.18
    if diag < 26.0:
        return tol * 0.45
    return tol


def iter_polygons(geom):
    """Yield polygons (list of rings, [0] is outer)."""
    if geom["type"] == "Polygon":
        yield geom["coordinates"]
    elif geom["type"] == "MultiPolygon":
        for poly in geom["coordinates"]:
            yield poly


def load_geojson(path):
    if path and os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    if os.path.exists(CACHE):
        with open(CACHE, "r", encoding="utf-8") as f:
            return json.load(f)
    import urllib.request
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    print("downloading", DATA_URL)
    with urllib.request.urlopen(DATA_URL, timeout=60) as resp:
        raw = resp.read()
    with open(CACHE, "wb") as f:
        f.write(raw)
    return json.loads(raw.decode("utf-8"))


def point_in_ring(x, y, ring):
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i]
        xj, yj = ring[j]
        if (yi > y) != (yj > y) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
            inside = not inside
        j = i
    return inside


def point_in_polys(x, y, polys):
    for poly in polys:
        if point_in_ring(x, y, poly[0]):
            hit = True
            for hole in poly[1:]:
                if point_in_ring(x, y, hole):
                    hit = False
                    break
            if hit:
                return True
    return False


def interior_point(polys):
    """Approximate pole of inaccessibility: grid search inside the province,
    maximise distance to the outer ring; fall back to ring centroid."""
    best = None
    for poly in polys:
        ring = poly[0]
        x0, y0, x1, y1 = bbox_of(ring)
        if x1 - x0 < 1e-6 or y1 - y0 < 1e-6:
            continue
        steps = 14
        for i in range(steps + 1):
            for j in range(steps + 1):
                x = x0 + (x1 - x0) * i / steps
                y = y0 + (y1 - y0) * j / steps
                if not point_in_ring(x, y, ring):
                    continue
                # distance to ring
                d = min(math.hypot(x - px, y - py) for px, py in ring[::max(1, len(ring) // 90)])
                if best is None or d > best[0]:
                    best = (d, x, y)
    if best:
        return best[1], best[2]
    allpts = [p for poly in polys for p in poly[0]]
    xs = [p[0] for p in allpts]
    ys = [p[1] for p in allpts]
    return sum(xs) / len(xs), sum(ys) / len(ys)


def rects_overlap(a, b, pad=0.0):
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    return not (ax + aw + pad <= bx or bx + bw + pad <= ax or
                ay + ah + pad <= by or by + bh + pad <= ay)


def place_labels(provinces, canvas):
    """Greedy label placement: most constrained (smallest) provinces first.

    Tiny provinces (北京/天津/上海/香港/澳门) cannot hold their own label, so
    they get explicit outward hints which are honoured before any search.
    """
    W = [LABEL_W_UNIT * len(p["short"]) + 2.4 for p in provinces]
    placed = []          # (rect, short)
    assign = {}

    def fits(rect):
        x, y, w, h = rect
        if (x < canvas[0] + 2 or y < canvas[1] + 2 or
                x + w > canvas[2] - 2 or y + h > canvas[3] - 2):
            return False
        return not any(rects_overlap(rect, r, LABEL_PAD) for r, _ in placed)

    order = sorted(range(len(provinces)), key=lambda i: provinces[i]["area"])
    for i in order:
        p = provinces[i]
        w = W[i]
        h = LABEL_H
        anchor = p["labelAnchor"]
        chosen = None

        # 1) explicit hints for the small / crowded provinces
        for dx, dy in LABEL_HINTS.get(p["short"], []):
            if fits((anchor[0] + dx - w / 2.0, anchor[1] + dy - h / 2.0, w, h)):
                chosen = (dx, dy)
                break

        # 2) spiral search around the anchor, preferring points inside the
        #    province itself (only meaningful for provinces with room)
        if chosen is None:
            best = None
            prefer_inside = p["area"] > 800.0
            for radius in (0.0, 5.0, 9.0, 13.0, 17.0, 21.0, 25.0):
                for ang in range(0, 360, 45):
                    rad = math.radians(ang)
                    dx = radius * math.cos(rad)
                    dy = radius * math.sin(rad) - 1.0
                    rect = (anchor[0] + dx - w / 2.0, anchor[1] + dy - h / 2.0, w, h)
                    if not fits(rect):
                        continue
                    score = math.hypot(dx, dy)
                    if prefer_inside and point_in_polys(anchor[0] + dx, anchor[1] + dy,
                                                        p["polys"]):
                        score -= 6.0
                    if best is None or score < best[0]:
                        best = (score, dx, dy)
            if best is None:
                hints = LABEL_HINTS.get(p["short"], [])
                chosen = hints[0] if hints else (0.0, -1.0)
            else:
                chosen = (best[1], best[2])

        dx, dy = chosen
        cx = round(anchor[0] + dx, 1)
        cy = round(anchor[1] + dy, 1)
        assign[p["short"]] = (cx, cy)
        placed.append(((cx - w / 2.0, cy - h / 2.0, w, h), p["short"]))
    return assign


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", default=None)
    ap.add_argument("--tolerance", type=float, default=0.34)
    ap.add_argument("--projection", default="miller",
                    choices=["miller", "mercator", "albers", "equirect"])
    ap.add_argument("--out", default=OUT)
    args = ap.parse_args()

    proj = make_projector(args.projection)
    geo = load_geojson(args.input)
    feats = geo["features"]
    prov_feats = [f for f in feats if f["properties"].get("adchar") != "JD"]
    jd_feats = [f for f in feats if f["properties"].get("adchar") == "JD"]

    # ---- project every ring, keep lon/lat alongside for the mainland split
    raw = []          # list of dicts: props, polys(projected rings), lons/lats
    main_pts = []     # projected points with lat >= MAIN_LAT (fit target)
    for f in prov_feats:
        polys = []
        lons, lats = [], []
        for rings in iter_polygons(f["geometry"]):
            prs = []
            for ring in rings:
                if len(ring) < 4:
                    continue
                pr = [proj(lon, lat) for lon, lat in ring]
                prs.append(pr)
                for lon, lat in ring:
                    lons.append(lon)
                    lats.append(lat)
                    if lat >= MAIN_LAT:
                        main_pts.append(proj(lon, lat))
            if prs:
                polys.append(prs)
        raw.append({"props": f["properties"], "polys": polys,
                    "lons": lons, "lats": lats})

    if not main_pts:
        raise SystemExit("no mainland geometry found")

    mxs = [p[0] for p in main_pts]
    mys = [p[1] for p in main_pts]
    minx, maxx = min(mxs), max(mxs)
    miny, maxy = min(mys), max(mys)
    avail_w = VIEW_W - 2 * PAD_X
    avail_h = VIEW_H - 2 * PAD_Y
    scale = min(avail_w / (maxx - minx), avail_h / (maxy - miny))
    off_x = PAD_X + (avail_w - (maxx - minx) * scale) / 2.0
    off_y = PAD_Y + (avail_h - (maxy - miny) * scale) / 2.0

    def to_view(x, y):
        return ((x - minx) * scale + off_x, (maxy - y) * scale + off_y)

    def path_from(polys, tol):
        parts = []
        for poly in polys:
            for idx, ring in enumerate(poly):
                view_ring = dedupe_ring([to_view(x, y) for x, y in ring])
                if len(view_ring) < 3:
                    continue
                area = ring_area(view_ring + [view_ring[0]])
                if area < MIN_RING_AREA:
                    continue
                simp = dp_simplify(view_ring, ring_tolerance(view_ring, tol))
                if len(simp) < 3 or ring_area(simp + [simp[0]]) <= 0.0:
                    continue
                parts.append("M" + " ".join("%.1f,%.1f" % p for p in simp) + "Z")
        return "".join(parts)

    provinces = []
    for item in raw:
        props = item["props"]
        name = props.get("name", "")
        short = SHORT_NAMES.get(name, name)
        d = path_from(item["polys"], args.tolerance)
        if not d:
            continue
        # viewBox-space polygons (all rings) for label containment tests
        polys_v = [[[to_view(x, y) for x, y in r] for r in poly] for poly in item["polys"]]
        # area over outer rings only
        area = sum(ring_area(poly[0] + [poly[0][0]]) for poly in polys_v)
        # anchor: DataV centroid when it falls inside, else pole of inaccessibility
        cen = props.get("centroid") or props.get("center")
        anchor = None
        if cen:
            cx, cy = to_view(*proj(cen[0], cen[1]))
            if point_in_polys(cx, cy, polys_v):
                anchor = (cx, cy)
        if anchor is None:
            anchor = interior_point(polys_v)
        provinces.append({
            "id": str(props.get("adcode", "")),
            "name": name,
            "short": short,
            "path": d,
            "center": [round(anchor[0], 1), round(anchor[1], 1)],
            "labelAnchor": anchor,
            "polys": polys_v,
            "area": area,
        })

    order = [
        "北京", "天津", "河北", "山西", "内蒙古", "辽宁", "吉林", "黑龙江",
        "上海", "江苏", "浙江", "安徽", "福建", "江西", "山东", "河南",
        "湖北", "湖南", "广东", "广西", "海南", "重庆", "四川", "贵州",
        "云南", "西藏", "陕西", "甘肃", "青海", "宁夏", "新疆", "台湾",
        "香港", "澳门",
    ]
    provinces.sort(key=lambda p: order.index(p["short"]) if p["short"] in order else 99)

    # ---- bounds ---------------------------------------------------------
    main_view = []      # viewBox coords of province points with lat >= MAIN_LAT
    scs_view = []       # viewBox coords of everything below MAIN_LAT
    for item in raw:
        for lon, lat in zip(item["lons"], item["lats"]):
            x, y = to_view(*proj(lon, lat))
            (main_view if lat >= MAIN_LAT else scs_view).append((x, y))

    def box(points):
        xs = [p[0] for p in points]
        ys = [p[1] for p in points]
        return [round(min(xs), 1), round(min(ys), 1), round(max(xs), 1), round(max(ys), 1)]

    mainland = box(main_view) if main_view else [0.0, 0.0, VIEW_W, VIEW_H]

    # ten-dash line: each GeoJSON polygon is one thin dash; reduce it to its
    # long axis so it renders as a crisp stroke (and keep it 10 segments).
    dash_segments = []
    for f in jd_feats:
        for poly in iter_polygons(f["geometry"]):
            pts = [to_view(*proj(lon, lat)) for lon, lat in poly[0]]
            best = (0.0, pts[0], pts[0])
            for i in range(len(pts)):
                for j in range(i + 1, len(pts)):
                    d = math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1])
                    if d > best[0]:
                        best = (d, pts[i], pts[j])
            dash_segments.append([round(best[1][0], 1), round(best[1][1], 1),
                                  round(best[2][0], 1), round(best[2][1], 1)])

    scs_pts = [(s[0], s[1]) for s in dash_segments] + [(s[2], s[3]) for s in dash_segments]
    scs = box(scs_pts) if scs_pts else [0.0, 0.0, 0.0, 0.0]
    scs_islands = box(scs_view) if scs_view else scs

    labels = place_labels(provinces, mainland)

    js = []
    js.append("/* Auto-generated by tools/build_geo.py — DO NOT EDIT. */")
    js.append("/* projection: %s, tolerance: %s, mainland lat >= %.1f */"
              % (args.projection, args.tolerance, MAIN_LAT))
    js.append("window.CHINA_GEO = (function () {")
    js.append("  var W = %d, H = %d;" % (VIEW_W, VIEW_H))
    js.append("  var KIND = \"%s\";" % args.projection)
    js.append("  var M = { lon0: %.6f, lat1: %.6f, lat2: %.6f, minx: %.10f, maxy: %.10f, scale: %.10f, ox: %.10f, oy: %.10f };"
              % (LON0, LAT1, LAT2, minx, maxy, scale, off_x, off_y))
    js.append("  function project(lon, lat) {")
    js.append("    var D = Math.PI / 180;")
    js.append("    var phi = lat * D, x, y;")
    js.append("    if (KIND === \"albers\") {")
    js.append("      var p1 = M.lat1 * D, p2 = M.lat2 * D, lam = (lon - M.lon0) * D;")
    js.append("      var n = (Math.sin(p1) + Math.sin(p2)) / 2;")
    js.append("      var c = Math.cos(p1) * Math.cos(p1) + 2 * n * Math.sin(p1);")
    js.append("      var rho = Math.sqrt(Math.max(c - 2 * n * Math.sin(phi), 0)) / n;")
    js.append("      var rho0 = Math.sqrt(Math.max(c - 2 * n * Math.sin(p1), 0)) / n;")
    js.append("      x = rho * Math.sin(n * (lon - M.lon0) * D);")
    js.append("      y = rho0 - rho * Math.cos(n * (lon - M.lon0) * D);")
    js.append("    } else if (KIND === \"mercator\") {")
    js.append("      x = (lon - M.lon0) * D;")
    js.append("      y = Math.log(Math.tan(Math.PI / 4 + phi / 2));")
    js.append("    } else if (KIND === \"miller\") {")
    js.append("      x = (lon - M.lon0) * D;")
    js.append("      y = 1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * phi));")
    js.append("    } else {")
    js.append("      x = (lon - M.lon0) * D;")
    js.append("      y = phi;")
    js.append("    }")
    js.append("    return [ (x - M.minx) * M.scale + M.ox, (M.maxy - y) * M.scale + M.oy ];")
    js.append("  }")
    js.append("  var bounds = {")
    js.append("    mainland: [%s, %s, %s, %s]," % (mainland[0], mainland[1], mainland[2], mainland[3]))
    js.append("    scs: [%s, %s, %s, %s]," % (scs[0], scs[1], scs[2], scs[3]))
    js.append("    scsIslands: [%s, %s, %s, %s]" % (scs_islands[0], scs_islands[1],
                                                  scs_islands[2], scs_islands[3]))
    js.append("  };")
    js.append("  var provinces = [")
    for p in provinces:
        lx, ly = labels[p["short"]]
        js.append(
            '    { id: "%s", name: "%s", short: "%s", area: %s, center: [%s, %s], label: [%s, %s], path: "%s" },'
            % (p["id"], p["name"], p["short"], round(p["area"], 1),
               p["center"][0], p["center"][1], lx, ly, p["path"])
        )
    js.append("  ];")
    js.append("  var nineDash = { segments: %s };" % json.dumps(dash_segments))
    js.append("  return { width: W, height: H, bounds: bounds, provinces: provinces,"
              " nineDash: nineDash, project: project };")
    js.append("})();")

    out = "\n".join(js) + "\n"
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8", newline="\n") as f:
        f.write(out)

    total_pts = sum(p["path"].count(",") for p in provinces)
    print("wrote %s (%.1f KB, %d provinces, ~%d points, nine-dash segments=%d)"
          % (args.out, len(out.encode("utf-8")) / 1024.0, len(provinces),
             total_pts, len(dash_segments)))
    print("mainland bbox %s (%.2f x %.2f, ratio %.2f)" % (
        mainland, mainland[2] - mainland[0], mainland[3] - mainland[1],
        (mainland[2] - mainland[0]) / (mainland[3] - mainland[1])))
    print("scs bbox %s" % (scs,))


if __name__ == "__main__":
    main()
