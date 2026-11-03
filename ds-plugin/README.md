# DSH Harness 插件：史纲 · 毛中特 时间轴

将独立可视化应用接入 DeepSeek Harness Web UI。

## 提供什么

- **侧边栏入口**：`sidebar.panellist` 新增「时间轴」图标；点击后主面板（`main` key `history-axis`）以 iframe 打开 `/history-axis/`。
- **静态路由**：Host 注册 `/history-axis/`，从本包 `web/` 目录提供离线应用（`web/` 是 `tools/sync_plugin.mjs` 从项目根同步的副本）。
- **兜底浮层**：若当前 Harness 版本没有加载 Client 半边，Host 通过 `webserver/index-inject`（桌面）和 `tapIndex`（Web）注入一个右侧「时轴」悬浮入口，点击打开全屏 overlay iframe。
- iframe 会透传当前页面的 `location.search`，以适配带 token 的 Web 部署。

## 安装 / 更新

从项目根：

```bash
node tools/sync_plugin.mjs
```

然后在 DSH 中用 plugin manager 安装本目录绝对路径（或 `dsh plugin --profile desktop add link:<dir>`）。本地目录安装是链接，更新 `web/` 后刷新页面即可；修改 `client.js` / `index.js` 后需要刷新或重启 Harness 才能加载新的客户端模块。

## 说明

- `web/` 是生成副本，请勿手改；改项目源码后重新 `sync_plugin.mjs`。
- 主面板使用 iframe 承载独立应用，因此应用保留自己的深色主题，不继承 Harness 主题 token；这是为「完整独立复习工作台」做的有意取舍。
- 如果静态路由返回 401/403，请确认请求是否携带当前 DSH 页面的认证参数；iframe 已透传 `location.search`。
