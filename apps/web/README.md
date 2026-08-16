# @hengce/web

真控制台。交互遵守 M0.5：时间线为主，对话框为第二入口。视觉已在 M6 交付（漏斗轨）；不要再给 `apps/web-demo` 做视觉或加 `fetch`。

```text
# 终端 1
npm --prefix apps/api start

# 终端 2
npm --prefix apps/web install
npm --prefix apps/web test
npm --prefix apps/web run dev
```

Vite 把 `/api` 反代到 `http://127.0.0.1:3001`。角色存在 `localStorage` 的 `hengce-role`，请求头 `x-hengce-role`。不要把 `DASHSCOPE_API_KEY` 或 `CURSOR_API_KEY` 写进本目录。
