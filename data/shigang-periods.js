/* 史纲时期与势力着色数据（Lead 维护，勿由内容 agent 覆盖）
   时期连续覆盖 1840–2025，to 为开区间。省份名用 short（见 DATA-SCHEMA）。 */
window.SHIGANG_PERIODS = {
  start: 1840,
  end: 2025,
  forces: {
    qing:       { name: "清朝", color: "#b08d5b" },
    taiping:    { name: "太平天国", color: "#7b4b9e" },
    british:    { name: "英国势力", color: "#4a7fb5" },
    france:     { name: "法国势力", color: "#5f8f7a" },
    russia:     { name: "俄国势力", color: "#9a625c" },
    japan:      { name: "日本势力", color: "#9e3b36" },
    germany:    { name: "德国势力", color: "#8a7a4a" },
    portugal:   { name: "葡萄牙势力", color: "#7a6a8a" },
    republic:   { name: "中华民国", color: "#64748b" },
    beiyang:    { name: "北洋政府", color: "#7c6f5b" },
    wan:        { name: "皖系", color: "#7a6a8a" },
    feng:       { name: "奉系", color: "#6b7a8a" },
    yunnan:     { name: "滇系", color: "#4f7f6a" },
    guangxi:    { name: "桂系", color: "#6a8f5f" },
    sichuan:    { name: "川系", color: "#8a7a6a" },
    shanxi:     { name: "晋系", color: "#9a8a4a" },
    npc:        { name: "国民政府", color: "#5b7a9a" },
    manchukuo:  { name: "伪满洲国", color: "#6b4a45" },
    ccp:        { name: "苏区 / 解放区", color: "#c14b35" },
    base:       { name: "抗日根据地", color: "#d0643f" },
    prc:        { name: "中华人民共和国", color: "#c47a3f" },
  },
  periods: [
    {
      id: "p1", from: 1840, to: 1851, era: "清 · 1840年代",
      boundaryNote: "清 · 1911年疆界（示意）",
      summary: "鸦片战争前后，清朝仍维持大一统版图，英国已割占香港岛。",
      defaultForce: "qing",
      overrides: { "香港": "british" },
      legend: ["qing", "british"]
    },
    {
      id: "p2", from: 1851, to: 1864, era: "清 · 咸丰年间",
      boundaryNote: "清 · 1911年疆界（示意）",
      summary: "太平天国定都天京，与清廷南北对峙；第二次鸦片战争爆发。",
      defaultForce: "qing",
      overrides: {
        "江苏": "taiping", "安徽": "taiping", "江西": "taiping",
        "浙江": "taiping", "湖北": "taiping", "香港": "british"
      },
      legend: ["qing", "taiping", "british"]
    },
    {
      id: "p3", from: 1864, to: 1885, era: "清 · 洋务运动",
      boundaryNote: "清 · 1911年疆界（示意）",
      summary: "太平天国失败，洋务派创办近代军事民用工业，边疆危机加深。",
      defaultForce: "qing",
      overrides: { "香港": "british" },
      legend: ["qing", "british"]
    },
    {
      id: "p4", from: 1885, to: 1895, era: "清 · 台湾建省",
      boundaryNote: "清 · 1911年疆界（示意）",
      summary: "中法战争后台湾建省；甲午战争爆发，北洋水师覆没。",
      defaultForce: "qing",
      overrides: { "香港": "british" },
      legend: ["qing", "british"]
    },
    {
      id: "p5", from: 1895, to: 1899, era: "清 · 瓜分危机",
      boundaryNote: "清 · 1911年疆界（示意）",
      summary: "《马关条约》割台湾；列强强租港湾、划分势力范围。台湾按一个中国原则统一着色。",
      defaultForce: "qing",
      overrides: {
        "香港": "british", "辽宁": "russia",
        "山东": "germany", "广东": "france"
      },
      legend: ["qing", "russia", "germany", "france", "british"]
    },
    {
      id: "p6", from: 1899, to: 1911, era: "清 · 清末新政",
      boundaryNote: "清 · 1911年疆界（示意）",
      summary: "义和团与《辛丑条约》后，清廷推行新政；革命运动风起云涌。",
      defaultForce: "qing",
      overrides: {
        "香港": "british", "辽宁": "russia",
        "吉林": "russia", "黑龙江": "russia", "山东": "germany",
        "福建": "japan", "云南": "france", "广西": "france"
      },
      legend: ["qing", "japan", "russia", "germany", "france", "british"]
    },
    {
      id: "p7", from: 1911, to: 1916, era: "民国 · 建立与袁世凯统治",
      boundaryNote: "中华民国 · 疆界示意",
      summary: "辛亥革命推翻清王朝，中华民国成立；袁世凯窃取革命果实。",
      defaultForce: "republic",
      overrides: { "香港": "british", "澳门": "portugal" },
      legend: ["republic", "british", "portugal"]
    },
    {
      id: "p8", from: 1916, to: 1928, era: "民国 · 军阀割据",
      boundaryNote: "中华民国 · 疆界示意",
      summary: "袁世凯死后军阀混战：直、皖、奉、滇、桂等各据一方。",
      defaultForce: "republic",
      overrides: {
        "辽宁": "feng", "吉林": "feng", "黑龙江": "feng",
        "河北": "beiyang", "河南": "beiyang", "湖北": "beiyang",
        "安徽": "wan", "山东": "wan", "浙江": "wan", "福建": "wan",
        "云南": "yunnan", "贵州": "yunnan", "广西": "guangxi",
        "广东": "republic", "四川": "sichuan", "山西": "shanxi",
        "香港": "british", "澳门": "portugal"
      },
      legend: ["republic", "beiyang", "wan", "feng", "yunnan", "guangxi", "sichuan", "shanxi", "british", "portugal"]
    },
    {
      id: "p9", from: 1928, to: 1931, era: "民国 · 南京国民政府",
      boundaryNote: "中华民国 · 疆界示意",
      summary: "南京国民政府形式统一全国；农村革命根据地开始创建。",
      defaultForce: "npc",
      overrides: { "香港": "british", "澳门": "portugal" },
      legend: ["npc", "british", "portugal"]
    },
    {
      id: "p10", from: 1931, to: 1937, era: "民国 · 民族危机加深",
      boundaryNote: "中华民国 · 疆界示意",
      summary: "九一八事变后东北沦陷；中央苏区与各根据地发展壮大。",
      defaultForce: "npc",
      overrides: {
        "辽宁": "manchukuo", "吉林": "manchukuo", "黑龙江": "manchukuo",
        "江西": "ccp", "福建": "ccp",
        "香港": "british", "澳门": "portugal"
      },
      legend: ["npc", "manchukuo", "ccp", "british", "portugal"]
    },
    {
      id: "p11", from: 1937, to: 1945, era: "民国 · 全面抗战",
      boundaryNote: "中华民国 · 疆界示意",
      summary: "日军全面侵华，华北、华东、华中大片国土沦陷；敌后根据地壮大。",
      defaultForce: "npc",
      overrides: {
        "辽宁": "manchukuo", "吉林": "manchukuo", "黑龙江": "manchukuo",
        "河北": "japan", "山东": "japan", "江苏": "japan", "浙江": "japan",
        "安徽": "japan", "江西": "japan", "湖北": "japan", "湖南": "japan",
        "福建": "japan", "广东": "japan", "河南": "japan",
        "陕西": "base", "山西": "base", "甘肃": "base", "宁夏": "base",
        "香港": "british", "澳门": "portugal"
      },
      legend: ["npc", "japan", "manchukuo", "base", "british", "portugal"]
    },
    {
      id: "p12", from: 1945, to: 1946, era: "民国 · 抗战胜利",
      boundaryNote: "中华民国 · 疆界示意",
      summary: "抗战胜利、台湾光复；重庆谈判，解放区与国统区并存。",
      defaultForce: "npc",
      overrides: {
        "陕西": "ccp", "山西": "ccp", "河北": "ccp", "山东": "ccp",
        "香港": "british", "澳门": "portugal"
      },
      legend: ["npc", "ccp", "british", "portugal"]
    },
    {
      id: "p13", from: 1946, to: 1949, era: "民国 · 解放战争",
      boundaryNote: "中华民国 · 疆界示意",
      summary: "解放战争由战略防御转入战略进攻，东北、华北相继解放。",
      defaultForce: "npc",
      overrides: {
        "黑龙江": "ccp", "吉林": "ccp", "辽宁": "ccp",
        "河北": "ccp", "山西": "ccp", "山东": "ccp", "河南": "ccp",
        "陕西": "ccp", "安徽": "ccp", "江苏": "ccp",
        "香港": "british", "澳门": "portugal"
      },
      legend: ["npc", "ccp", "british", "portugal"]
    },
    {
      id: "p14", from: 1949, to: 1978, era: "新中国 · 社会主义革命和建设",
      boundaryNote: "中华人民共和国 · 现代省界",
      summary: "中华人民共和国成立，完成社会主义改造，探索社会主义建设道路。",
      defaultForce: "prc",
      overrides: { "香港": "british", "澳门": "portugal" },
      legend: ["prc", "british", "portugal"]
    },
    {
      id: "p15", from: 1978, to: 1997, era: "新中国 · 改革开放",
      boundaryNote: "中华人民共和国 · 现代省界",
      summary: "十一届三中全会开启改革开放；经济特区与沿海开放城市先行。",
      defaultForce: "prc",
      overrides: { "香港": "british", "澳门": "portugal" },
      legend: ["prc", "british", "portugal"]
    },
    {
      id: "p16", from: 1997, to: 1999, era: "新中国 · 香港回归",
      boundaryNote: "中华人民共和国 · 现代省界",
      summary: "1997年香港回归祖国，“一国两制”付诸实践。",
      defaultForce: "prc",
      overrides: { "澳门": "portugal" },
      legend: ["prc", "portugal"]
    },
    {
      id: "p17", from: 1999, to: 2012, era: "新中国 · 世纪之交",
      boundaryNote: "中华人民共和国 · 现代省界",
      summary: "澳门回归、加入世界贸易组织，综合国力快速提升。",
      defaultForce: "prc",
      overrides: {},
      legend: ["prc"]
    },
    {
      id: "p18", from: 2012, to: 2025, era: "新时代 · 中国特色社会主义",
      boundaryNote: "中华人民共和国 · 现代省界",
      summary: "中国特色社会主义进入新时代，全面建成小康社会，推进中国式现代化。",
      defaultForce: "prc",
      overrides: {},
      legend: ["prc"]
    }
  ]
};
