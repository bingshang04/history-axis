/* ============================================================
   dynamics.js — 地图动态层：行军路线 + 革命根据地
   坐标均为 [经度, 纬度]，由 map.js 用 Miller 投影绘制。
   时间范围用于按年份显隐；不是精确军事地图，仅作复习示意。
   ============================================================ */
/* 小数年：year + (month-1)/12，避免 1948.10 / 1948.11 被 JS 当成 1948.1 的问题。 */
function axisYear(year, month) { return year + (month - 1) / 12; }

window.AXIS_DYNAMICS = {
  routes: [
    {
      id: "north-expedition",
      name: "北伐进军",
      from: axisYear(1926, 5),
      to: axisYear(1928, 6),
      color: "#c07c54",
      note: "广州 → 长沙 → 武汉 → 南昌 → 南京 → 上海",
      points: [
        [113.26, 23.13], [113.60, 24.80], [112.94, 28.23],
        [114.30, 30.60], [115.89, 28.68], [118.80, 32.06], [121.47, 31.23]
      ]
    },
    {
      id: "long-march",
      name: "红军长征",
      from: axisYear(1934, 8),
      to: axisYear(1936, 10),
      color: "#d0643f",
      note: "瑞金 → 湘江 → 遵义 → 赤水 → 金沙江 → 大渡河 → 草地 → 吴起镇",
      points: [
        [116.03, 25.89], [110.70, 25.60], [106.93, 27.73],
        [105.80, 28.40], [104.40, 27.80], [102.20, 29.30],
        [102.20, 29.90], [103.60, 32.60], [103.60, 34.10],
        [108.20, 36.90]
      ]
    },
    {
      id: "liaoshen",
      name: "辽沈战役",
      from: axisYear(1948, 9),
      to: axisYear(1948, 11),
      color: "#b05846",
      note: "锦州 → 沈阳 → 营口",
      points: [[121.13, 41.10], [123.43, 41.80], [122.24, 40.67]]
    },
    {
      id: "huaihai",
      name: "淮海战役",
      from: axisYear(1948, 11),
      to: axisYear(1949, 1),
      color: "#b05846",
      note: "徐州 → 碾庄 → 陈官庄 → 蚌埠",
      points: [[117.18, 34.26], [117.90, 34.40], [116.80, 33.60], [117.36, 32.92]]
    },
    {
      id: "pingjin",
      name: "平津战役",
      from: axisYear(1948, 11),
      to: axisYear(1949, 1),
      color: "#b05846",
      note: "张家口 → 北平 → 天津 → 塘沽",
      points: [[114.88, 40.82], [116.40, 39.90], [117.20, 39.10], [117.65, 39.00]]
    },
    {
      id: "yangtze-crossing",
      name: "渡江战役",
      from: axisYear(1949, 4),
      to: axisYear(1949, 6),
      color: "#c9a45c",
      note: "南京 → 上海 → 杭州",
      points: [[118.80, 32.06], [121.47, 31.23], [120.15, 30.27]]
    }
  ],

  bases: [
    {
      id: "jinggangshan",
      name: "井冈山",
      from: axisYear(1927, 10),
      to: axisYear(1930, 2),
      lonlat: [114.17, 26.58],
      r: 13,
      note: "第一个农村革命根据地"
    },
    {
      id: "central-soviet",
      name: "中央苏区",
      from: axisYear(1931, 11),
      to: axisYear(1934, 10),
      lonlat: [115.90, 25.90],
      r: 30,
      note: "中华苏维埃共和国临时中央政府所在地"
    },
    {
      id: "exi-wan",
      name: "鄂豫皖",
      from: axisYear(1930, 6),
      to: axisYear(1934, 10),
      lonlat: [115.60, 31.30],
      r: 24,
      note: "红四方面军主要根据地"
    },
    {
      id: "xiang-e-xi",
      name: "湘鄂西",
      from: axisYear(1930, 4),
      to: axisYear(1934, 10),
      lonlat: [112.30, 29.70],
      r: 21,
      note: "洪湖、湘鄂边根据地"
    },
    {
      id: "shan-gan",
      name: "陕甘宁",
      from: axisYear(1935, 10),
      to: axisYear(1947, 3),
      lonlat: [108.90, 36.60],
      r: 29,
      note: "长征落脚点，抗战总后方"
    },
    {
      id: "jin-cha-ji",
      name: "晋察冀",
      from: axisYear(1937, 11),
      to: axisYear(1945, 9),
      lonlat: [114.40, 39.00],
      r: 26,
      note: "敌后第一个抗日根据地"
    },
    {
      id: "jin-ji-lu-yu",
      name: "晋冀鲁豫",
      from: axisYear(1937, 11),
      to: axisYear(1945, 9),
      lonlat: [113.50, 36.70],
      r: 30,
      note: "华北敌后重要根据地"
    },
    {
      id: "jin-sui",
      name: "晋绥",
      from: axisYear(1937, 9),
      to: axisYear(1945, 9),
      lonlat: [111.50, 38.60],
      r: 22,
      note: "陕甘宁与华北联系的战略通道"
    },
    {
      id: "shandong",
      name: "山东",
      from: axisYear(1938, 1),
      to: axisYear(1945, 9),
      lonlat: [118.00, 36.10],
      r: 28,
      note: "山东抗日根据地"
    },
    {
      id: "huazhong",
      name: "华中",
      from: axisYear(1938, 1),
      to: axisYear(1945, 9),
      lonlat: [119.20, 32.60],
      r: 30,
      note: "新四军华中抗日根据地"
    }
  ]
};
