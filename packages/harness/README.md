# @hengce/harness

顺序调度四个 CRM Agent。无密钥用 `scriptedRunner`；有 `DASHSCOPE_API_KEY` 用阿里云千问（`qwen3.7-flash-2026-07-15`，百炼 OpenAI 兼容接口）。仍可用 `CURSOR_API_KEY` 走本地 `@cursor/sdk`。禁止 `cloud: { repos }`。禁止把密钥传到前端。
