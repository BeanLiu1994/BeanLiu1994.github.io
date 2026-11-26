# Bean Workbench

React、CodeMirror 和浏览器内的 QuickJS / esbuild WebAssembly 沙盒。项目和会话保存在浏览器里，可导入和导出文本项目 ZIP。终端运行项目内的 JavaScript、TypeScript 和测试，网页预览在隔离的 iframe 里运行。沙盒使用本地模块，支持 `help` 查看命令。

## 运行

用 Node.js 22 执行 `npm ci && npm run build`。将 `dist/`、`server.mjs`、`policy.mjs` 部署到 `/opt/bean-workbench`，将受维护的 Node 二进制放到 `bin/node`。加载 `deploy/bean-workbench.service`。将 `deploy/nginx.conf` 放在 nginx 的 HTTP 配置层，将 `deploy/nginx.locations` 加到对外的 HTTPS 虚拟主机。

在机器上通过 systemd 的 `LoadCredential` 提供私有配置 `/etc/bean-workbench/config.json`。字段包括 `origin`（工作台的公开 HTTPS 源）、`apiKey`（FreeLLMAPI 统一密钥）、`auditKey`（32 字节随机十六进制字符串）、`fiveHourLimit` 和 `weekLimit`（可选，默认 60 和 500）。服务监听 `127.0.0.1:8772`。本地启动可设置 `WORKBENCH_CONFIG`，并在配置中指定可写的 `stateDir`。

## 公开 API

- `GET /workbench/api/usage` 返回最近 5 小时和本周的全站共享用量。本周以北京时间周一零点为边界。
- `POST /workbench/api/chat` 接收 JSON，例如 `{"messages":[{"role":"user","content":"解释这个函数"}],"files":[]}`。文件可选填在数组中，每项为 `{"path":"app.js","content":"...","truncated":false}`。回复为 SSE，事件包含 `text`、`changes`、`done` 或 `error`。
- API 无需登录或密钥。浏览器请求来自工作台所在源，命令行客户端可省略 Origin。网关在请求通过格式和合规校验后计入额度，再通过本机 FreeLLMAPI 的 `auto` 路由调用模型。
- 请求审计、筛查结果和额度台账位于 systemd 的私有状态目录。审计保留约 30 天，记录请求 ID、来源摘要、筛查类别和调用状态。聊天正文、项目内容和密钥不写入该审计日志。
