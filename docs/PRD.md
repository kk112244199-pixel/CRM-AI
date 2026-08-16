# 衡策销管平台 · PRD（首版）

状态：已锁定，作为实现依据。变更须改本文件并同步 `README.md`、`docs/tech-selection.md`。

技术对错见 [tech-selection.md](./tech-selection.md)。验收见 [eval.md](./eval.md)。工程约定见 [engineering-standards.md](./engineering-standards.md)。点击原型见 [frontend-demo.md](./frontend-demo.md)。Skill 何时用见 [skill-timeline.md](./skill-timeline.md)。开发期交接见 [cursor-session-handoff.md](./cursor-session-handoff.md)。

实现顺序与契约：M0–M6、**S9 已完成**。当前硬上下文：[contracts/S9.md](./contracts/S9.md)（并继续遵守此前契约）。何时打 `/` 见 [skill-timeline.md](./skill-timeline.md)。可选下一刀 **S10 `/orchestrate`**（需 git 远程）。

## 1. 一句话

衡策销管平台是卖「销售系统」的公司用的 **CRM harness 多智能体控制台**：获客后四个 Agent 按序交 handoff（系统分配 / 建档 / 商机转化与阶段 / 跟进活动），拆出客户+联系人+商机；分配与建档自动，转化与外发由销售确认，赢单/丢单由经理确认。Token 落库。

## 2. 背景与目标

| 目标 | 可观察结果 |
|---|---|
| 证明多智能体不是一个对话框套皮 | 关掉聊天，时间线仍能区分系统分配、建档、商机、跟进 |
| 符合国内销售习惯 | 线索与商机分开；中文阶段；活动类型含电话/企微/邮件/拜访 |
| 可演示、可答辩 | `docker compose up` + 黄金切片 + eval 清单 |
| Token 可见 | 每步消耗与顶栏合计可核对 |

非目标：完整 SaaS CRM、电销外呼、真实企微、CPQ/合同全套、向客户按 Token 收款、GraphRAG、Redis/RabbitMQ 集群。

## 3. 用户与权限

| 角色 | 能做什么 |
|---|---|
| sales | 录入获客、确认转化、确认外发、推进非赢单阶段、中止后续 |
| manager | 含 sales + 确认赢单/丢单 |
| viewer | 只读 |

演示可切换角色。不上 SSO。

## 4. 卖方与 8 家客户

平台归属：**衡策销管平台**（卖方卖销售系统）。8 家是客户，表与 `data/corpus` 只用这些名字。

| 公司 | 行业 | 检索设定 | 种子对象 |
|---|---|---|---|
| 杭齿精密机电 | 离散制造 / 零部件 | 很像嘉兴精工 | 已转化 · 商机方案报价 |
| 嘉兴精工装备 | 离散制造 / 设备 | 很像杭齿精密 | 已转化 · 商机需求确认 |
| 澄海医疗器械 | 医疗流通 | 中性 | 已转化 · 商机谈判 |
| 橙果素质教育 | 区域教培连锁 | 不像制造 | **未转化线索**（黄金切片） |
| 邻里鲜超市 | 生鲜连锁 | 很像夜灯便利 | 已转化 · 商机方案报价 |
| 夜灯便利 | 便利店连锁 | 很像邻里鲜 | 已转化 · 商机需求确认 |
| 海图进出口 | 外贸 | 刻意不像 | 已转化 · 商机谈判 |
| 江东水务物资 | 市政国企采购 | 刻意不像 | 已转化 · 商机丢单 |

语料类型（皆为文本，无音频）：邮件、电话转写、企微摘录、产品手册片段、赢单或丢单案例。至少两对很像、两家刻意不像。

## 5. 核心场景（黄金切片）

默认 UI 是时间线，对话框为第二入口。orchestrator 在界面上叫 **系统分配**，不是第四个销售。

```text
获客：sales 录入一句
  → 系统分配（orchestrator）handoff 自动已生效，指定所有人；禁写客户/商机
  → 建档（lead-intake）handoff 自动已生效，写入线索字段；仍未转化
  → 商机（pipeline）交出转化建议：客户+联系人+商机草稿
  → sales 确认转化 → 三张对象落地，商机阶段=需求确认
  → 跟进（followup）交出带类型的活动草稿（电话/企微/邮件/拜访）
  → sales 确认发出 → activity 生效
销售可自行推进需求确认/方案报价/谈判。
赢单或丢单必须 manager 确认。
报价/合同首版不做，只在赢单闸门文案中声明。
拒绝或中止：后续不再追加。
```

线索状态：`新线索` `已转化`。  
商机阶段：`需求确认` `方案报价` `谈判` `赢单` `丢单`。禁止 Discovery/Demo。

## 6. 运行时 Agent

| Agent | 界面名 | 可写 | 禁止 | HITL |
|---|---|---|---|---|
| orchestrator | 系统分配 | agent_runs, handoffs, lead.owner | accounts/contacts/opps/activities | 无（自动） |
| lead-intake | 建档 | leads 字段（不含转化） | opportunities.stage, activities | 无（自动） |
| pipeline | 商机 | accounts, contacts, opportunities | activities | 转化：sales 确认；赢单/丢单：manager 确认；中间阶段销售自推 |
| followup | 跟进 | activities（含 type） | 商机阶段 | 对外发出：sales 确认 |

兄弟 Agent 不互聊。时间线必须四类交卷都看得见，否则不算多智能体。

## 7. 数据（首版表）

- `users`：演示角色
- `leads`：获客与是否已转化
- `accounts`：客户
- `contacts`：联系人
- `opportunities`：商机与阶段
- `activities`：跟进（type：电话/企微/邮件/拜访）
- `agent_runs` / `handoffs` / `token_ledger` / `audit_events`
- `documents`：语料元数据，S9 用

不做充值账户、不做报价单/合同表。

## 8. Token

每次 run 结束写入消耗；时间线条目旁展示；顶栏合计 = 各 run 之和（eval R2）。首版**没有**月额度和超限告警。无套餐、无发票、无支付。

## 9. 信息架构（控制台）

1. 线索列表（8 家，区分未转化/商机阶段）
2. 详情：线索卡 + 客户/联系人/商机（转化后）+ **handoff 时间线（主）** + Token
3. 待确认队列（转化、外发、赢单/丢单）
4. 用量页
5. （次）获客录入，结果写回同一时间线

视觉在 **M6 / S8** 已用 `/frontend-design` 做漏斗轨（只改 `apps/web`）。M0.5 仍是能点的线框原型。

## 10. 仓库结构（实现时按此建）

```text
apps/web/              Vite + React
apps/web-demo/         M0.5 无后端点击原型（禁止 fetch）
apps/api/              harness HTTP
packages/harness/      调度、ACL、schema、SDK 调用
packages/domain/       类型与 Drizzle schema
runtime/agents/        Agent 定义 md
runtime/skills/        业务 SKILL.md stub
data/corpus/           8 家假文本
docs/                  本目录
```

开发层 `.cursor/skills` 不进入运行时加载路径。

## 11. 接口（首版，实现可微调路径，语义不可偷换）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/leads/ingest` | 录入自然语言线索；顺序跑系统分配→建档→转化建议 |
| GET | `/api/leads` | 列表 |
| GET | `/api/leads/:id` | 卡片 + 时间线 |
| POST | `/api/handoffs/:id/confirm` | HITL 确认 |
| POST | `/api/handoffs/:id/reject` | HITL 拒绝 |
| POST | `/api/leads/:id/stage` | 推进阶段 |
| POST | `/api/leads/:id/abort` | 按线索中止 |
| POST | `/api/runs/:id/abort` | HOTL 按 run 中止 |
| GET | `/api/handoffs/pending` | 待确认队列 |
| GET | `/api/similar?company=` | 相似客户（sqlite-vec Recall@1） |
| GET | `/api/usage` | Token 合计 |
| GET | `/api/metrics` | 预留 Prometheus 文本 |
| GET | `/api/health` | 存活 |

鉴权：演示 header / 本地 session，分三角色。Agent 不直接暴露给浏览器。

## 12. 非功能

- 黄金切片在本地有密钥时 10 分钟内可讲完
- 无密钥时仍能看 8 家种子数据与历史 handoff 回放
- 密钥不上前端
- `docker compose up` 起 nginx + api + web

## 13. 里程碑

| 编号 | 内容 |
|---|---|
| M0 | 本文档 + README 图（已完成） |
| M0.5 | 前端点击原型 `apps/web-demo`（已按企业骨架修订），见 [frontend-demo.md](./frontend-demo.md) |
| M1 | 目录、SQLite、8 家种子 + 语料（已完成） |
| M2 | harness 顺序调度 + ACL + Token 入账（已完成） |
| M3 | 控制台 `apps/web` 接真 API（已完成） |
| M4 | Docker/nginx（已完成） |
| M5 | eval 黄金切片与报告（已完成；无密钥黄金切片跳过） |
| M6 | `/frontend-design` 美化（已完成；漏斗轨只改 `apps/web`） |
| S9 | `searchSimilar` 从 SQL 换 sqlite-vec（已完成） |
| S10 | 筛选 / CSV（可选，需 git 远程） |

## 14. 验收

`docs/eval.md` 中 Q1–Q8、R1–R6 以 [eval-last-run.md](./eval-last-run.md) 为准。无真模型密钥（`DASHSCOPE_API_KEY` 或 `CURSOR_API_KEY`）时黄金切片必须标跳过，不得记成通过。README 中的图须与实现一致。
