# Skill 使用时间线（2026-08-17 现行）

以仓库实际文件为准。本文件是**开发层怎么喊 Agent、何时打 `/` 命令**的单一入口。产品对错以 PRD 和契约为准，不要只凭本文件改业务规则。

硬上下文（下一步开工必须先读）：

- [contracts/M0.md](./contracts/M0.md) — 产品、8 家名字、对象、Agent 写权限、闸门、技术禁区
- [contracts/M0.5.md](./contracts/M0.5.md) — 交互：哪些自动、哪些待确认、黄金切片点法
- [PRD.md](./PRD.md) — 完整需求
- [frontend-demo.md](./frontend-demo.md) — 已交付的点击原型怎么点
- [engineering-standards.md](./engineering-standards.md) — 测不过不算完、无 emoji、中文注释禁区
- [eval.md](./eval.md) — Q1–Q8、R1–R6，后面每步要对上号
- [contracts/S9.md](./contracts/S9.md) — **当前硬上下文**：sqlite-vec 相似检索
- [cursor-session-handoff.md](./cursor-session-handoff.md) — 新开对话时 `@` 这份即可续上

**当前结论：S9 向量已齐（sqlite-vec `vec_leads`）。可选下一刀是 S10（`/orchestrate` 筛选/CSV，需 git 远程）。不要给 web-demo 加 fetch。不要改漏斗。**

---

## 0. 新开对话时怎么用本文件

1. `@docs/cursor-session-handoff.md` 和 `@docs/skill-timeline.md`。
2. 读上一份契约：现在是 S9；并继续遵守 M0 / M0.5 / M1 / M2 / M3 / M4 / M5 / M6。
3. 只复制**当前步**那一节的灰色代码块到输入框。不要一次把 S4–S10 全贴进去。
4. 本步结束必须留下 `docs/checklists/M{n}.md` 或 `docs/checklists/S{n}.md`，以及对应契约。没有契约，下一步不准开工。
5. 测不过 = 本步未完成。不要口头说「差不多了」。

每一步都要遵守（不必每次复述，Agent 必须当硬约束）：

```text
产品：衡策销管平台。主 UI 是时间线，不是对话框。
流程：获客 → 系统分配（自动）→ 建档（自动）→ 销售确认转化（客户+联系人+商机）
      → 跟进活动待确认发出 → 中间阶段销售自推 → 赢单/丢单才经理批。
报价/合同不做。orchestrator 界面名必须是「系统分配」，禁止打扮成销售同事。
8 家名字一字不改：杭齿精密机电、嘉兴精工装备、澄海医疗器械、橙果素质教育、
邻里鲜超市、夜灯便利、海图进出口、江东水务物资。
橙果=未转化线索（黄金切片）。其余七家=已转化商机。
阶段只用：需求确认、方案报价、谈判、赢单、丢单。禁止 Discovery/Demo。
活动 type：电话、企微、邮件、拜访。
角色：sales / manager / viewer。
无 emoji。关键逻辑中文注释。假数据，无真实 PII。
禁止：Redis、RabbitMQ、独立 Prometheus+Grafana、独立向量库、GraphRAG、K8s、电销、Token 充值、CPQ。
开发层 skill 在 .cursor/skills/；运行时业务 skill 在 runtime/skills/。两条线不要混。
```

---

## 1. 先分清两条线

| 线 | 目录 | 谁读 | 现在有没有 |
|---|---|---|---|
| 开发层 | `.cursor/skills/` | 你在 Cursor 里造这个平台时的 Agent | 有：create-plan、orchestrate、cursor-sdk、agent-development、skill-development、frontend-design |
| 运行层 | `runtime/agents/`、`runtime/skills/` | 衡策销管里的四个 CRM Agent | **已有** S4 agents + S5 skills；M2 真跑 |

两套「调度」也不是一件事：

| 名字 | 实际是什么 | 何时用 |
|---|---|---|
| `/orchestrate` | 云端工人改**本仓库代码**（扇出、plan.json、handoff 回主会话） | **仅 S10** |
| `packages/harness` | 按序拉起四个 CRM Agent：系统分配 → 建档 → 商机；跟进只在确认转化之后 | **S6 / M2** 才写，用 `/sdk` |

把 `/orchestrate` 当成销售调度器 = 做错了。把四个 CRM Agent 写成四个销售员 = 做错了。

每完成一个 M：写清单 + 契约。下一步先读上一份契约。与 PRD 冲突则停下来问，不得默默改契约。

---

## 2. 完成度（以仓库为准）

| 编号 | 做什么 | 用哪个 Skill | 状态 | 证据 / 缺口 |
|---|---|---|---|---|
| S0 | 首版架构计划 | `/create-plan` | 已完成 | 已收成 PRD，不要重做 |
| S1 | 范本：纷享销客（Agent 写回 CRM）、EC 四角色分工、Attio（时间线+人确认） | 无 | 已完成 | 国内阶段与企微/电话；不抄 Slack/Discovery |
| M0 | PRD、选型、eval、工程约定 | 无 | 已完成 | `docs/`；清单是历史，对象模型以现行 M0 契约为准 |
| M0.5 | 无后端点击原型（已按企业骨架修订） | 无；禁止 `/frontend-design` | 已完成 | `apps/web-demo`；`npm --prefix apps/web-demo test` 9 过 |
| **M1 = S2+S3** | **8 家语料 + SQLite/Drizzle + 目录骨架** | **无** | **已完成** | `data/corpus`；`data/hengce.db`；当时单测 15 过，现全量见 `npm test` |
| S4 | `runtime/agents` 四个 md | `/create-subagent` | 已完成 | 四份 tools 不同；未写入 `.cursor/agents` |
| S5 | `runtime/skills` stub | `/create-skill` | 已完成 | 三份在 runtime/skills；未写入 `.cursor/skills` |
| S6 / M2 | harness + 本地 `@cursor/sdk` | `/sdk` | **已完成** | 无密钥 ACL/顺序/Token 测试；黄金切片无密钥跳过 |
| S7 / M3 | 新建 `apps/web` 接真 API | 无；禁止 `/frontend-design` | **已完成** | 橙果转化+外发；杭齿赢单须 manager；R5/R6 |
| M4 | Docker + nginx | 无 | **已完成** | `docker compose config` 通过；当时本机引擎未 `up`，未假装通过；demo 不上镜像 |
| M5 | eval 黄金切片与报告 | 无 | **已完成** | [eval-last-run.md](./eval-last-run.md)；无密钥 golden 跳过 |
| S8 / M6 | 真控制台视觉 | `/frontend-design` | **已完成** | 漏斗轨；只改 `apps/web` |
| S9 | `searchSimilar` 换成 SQLite 向量 | `/create-plan` | **已完成** | sqlite-vec `vec_leads`；不上 GraphRAG、不上独立向量库 |
| S10 | 筛选 / CSV 导入等并行改代码 | `/orchestrate` | 未做 | M3 能跑、有 git 远程、有 `CURSOR_API_KEY` |

---

## 3. 开发层 Skill 总表：何时打、打什么、禁止

在 Cursor **对话输入框**打出。项目内实现：`.cursor/skills/<name>/SKILL.md`。内置不用装：`/sdk`、`/create-subagent`、`/create-skill`。不要装 `harness-engineering-skills`。

| 命令 | 必须显式打出？ | 本项目用法 | 禁止 |
|---|---|---|---|
| `/create-plan` | 建议显式打出这几个字 | 已用于 S0；**S9 再开一刀**；只有大改对象模型（加人、改顺序、加回 Redis）时才再开 | 拿它写业务代码；M1 不要再写一份空架构 |
| `/orchestrate` | **必须**打出这几个字，否则不加载 | **仅 S10** | 调度销售 Agent；M1/M2 不要扇出云端工人 |
| `/sdk` 或说到 `@cursor/sdk` | `/sdk` 更稳 | **仅 S6/M2** 本地 `Agent.create` + `send` + `wait` + `dispose` | `cloud: { repos }` 开 PR；密钥进前端 |
| `/create-subagent` | 可显式，或说按 agent-development | **S4** 写 `runtime/agents` 四个文件 | 四份 tools 相同；orchestrator 写成销冠 |
| `/create-skill` | 可显式，或说按 skill-development | **S5** 只写 `runtime/skills` | 写进 `.cursor/skills`；一篇八千字把 PRD 粘进去 |
| `/frontend-design` | 建议显式 | **仅 S8/M6** 改 `apps/web` | 改 `web-demo` 扮好看；S7 未通就美化 |

`agent-development`、`skill-development`、`cursor-sdk` 是说明书，通常**不用**单独 `/` 唤起；在 S4/S5/S6 的复制词里点名即可。

---

## 4. 决策树：你想做 X，该打什么

| 你现在想做的 | 打什么 | 不该打 |
|---|---|---|
| 点按钮看流程对不对 | 什么都不用打。已有 `npm --prefix apps/web-demo run dev` | `/frontend-design`、先写 API |
| 建表、种子、8 家假文本 | 直接贴 M1 复制词 | `/create-plan`、`/orchestrate` |
| 四个 CRM Agent 的 md 人设 | `/create-subagent` + S4 复制词 | 写进 `.cursor/agents` 当 Cursor 同事 |
| CRM Agent 读的业务说明书 | `/create-skill` + S5 复制词 | 写进 `.cursor/skills` |
| 真的拉起模型跑转化/外发 | `/sdk` + S6 复制词 | `/orchestrate` |
| 真控制台给你点 | 贴 S7 复制词，新建 `apps/web` | 给 `web-demo` 加 `fetch` |
| 页面好看 | S7 能演示之后 `/frontend-design` | 先美化 demo |
| 相似客户从 SQL 换成向量 | `/create-plan`（S9） | 先上 Pinecone / GraphRAG |
| 给控制台加筛选、CSV 导入（改代码、可并行） | `/orchestrate`（S10） | 用它调度 lead-intake |

---

## 5. 产品骨架（各步都不得退回「每步都点确认」）

```text
获客（sales 录入一句）
  → 系统分配 orchestrator：handoff 自动已生效，指定所有人；禁写客户/商机/活动
  → 建档 lead-intake：handoff 自动已生效，写线索字段；仍未转化
  → 商机 pipeline：交出转化建议（客户+联系人+商机草稿）
  → sales 确认转化 → 三张对象落地，商机阶段=需求确认
  → 跟进 followup：交出带 type 的活动草稿
  → sales 确认发出 → activity 生效
销售可自行推进：需求确认 → 方案报价 → 谈判（无需经理）
赢单或丢单必须 manager 确认；sales 点确认无效
拒绝转化：不建三张对象，不跟进
中止：只清排队，历史 handoff 保留
```

闸门：

| 动作 | 谁 | 未确认时库里应如何 |
|---|---|---|
| 系统分配、建档 | 自动 | 已生效 |
| 转化 | sales | 无 accounts/contacts/opportunities |
| 外发活动 | sales | 无已生效 activity |
| 推进需求确认/方案报价/谈判 | sales 自推 | 直接改 `opportunities.stage` |
| 赢单/丢单 | **仅 manager** | 待确认；sales 确认不改库 |

Agent 写权限（Q2 / R4）：

| id | 界面名 | 可写 | 禁止 |
|---|---|---|---|
| orchestrator | 系统分配 | `agent_runs`、`handoffs`、`leads.owner` | accounts / contacts / opps / activities |
| lead-intake | 建档 | `leads` 字段（不含转化落地） | `opportunities.stage`、activities |
| pipeline | 商机 | accounts、contacts、opportunities | activities |
| followup | 跟进 | `activities`（必须带 `type`） | 商机阶段 |

兄弟 Agent 不互聊。时间线必须四类交卷都看得见。

8 家种子（M1 必须按此落库，名字一字不改）：

| 公司 | 行业 | 检索设定 | 种子 |
|---|---|---|---|
| 杭齿精密机电 | 离散制造 / 零部件 | 很像嘉兴精工 | 已转化 · 方案报价 |
| 嘉兴精工装备 | 离散制造 / 设备 | 很像杭齿精密 | 已转化 · 需求确认 |
| 澄海医疗器械 | 医疗流通 | 中性 | 已转化 · 谈判 |
| 橙果素质教育 | 区域教培连锁 | 不像制造 | **未转化线索** |
| 邻里鲜超市 | 生鲜连锁 | 很像夜灯便利 | 已转化 · 方案报价 |
| 夜灯便利 | 便利店连锁 | 很像邻里鲜 | 已转化 · 需求确认 |
| 海图进出口 | 外贸 | 刻意不像 | 已转化 · 谈判 |
| 江东水务物资 | 市政国企采购 | 刻意不像 | 已转化 · 丢单 |

相似写死（M0.5 已如此；M1 SQL `searchSimilar` 也要对上）：杭齿精密机电 → 嘉兴精工装备。海图不得第一名打杭齿。邻里鲜 → 夜灯便利。

---

## 6. 逐步：复制哪段话、产出什么、怎样算完

### S0（已完成）首版架构

当时：`/create-plan` 写 CRM harness 首版架构。已锁进 PRD。

不要重做，除非你要改 Agent 顺序、改 8 家名字、或加回 Redis/MQ（须先问人）。

---

### S1（已完成）范本对照

无 skill。参照三家，各取一块：

- 纷享：Agent 写回 CRM 对象，不是只聊天
- EC：角色分工，不是一个人包办
- Attio：时间线为主、人确认关键动作

国内用语：企微、电话、拜访；阶段中文。不抄 Slack，不抄 Discovery/Demo。

---

### M0（已完成）文档与契约

无 skill。交付了 PRD、tech-selection、eval、engineering-standards、README 图。

清单 [checklists/M0.md](./checklists/M0.md) 是历史记录；**对象模型以现行 [contracts/M0.md](./contracts/M0.md) 为准**（企业骨架修订后：转化才拆三对象，赢单才经理批）。

---

### M0.5（已完成，且已修订）点击原型

无 skill。禁止 `/frontend-design`、`/sdk`、`/orchestrate`。禁止在 `apps/web-demo` 加 `fetch`、WebSocket、`@cursor/sdk`。

交付：`apps/web-demo/`（Vite 6 + React 19 + vitest）。状态机：`apps/web-demo/src/mock/machine.ts`。

启动与测试：

```text
npm --prefix apps/web-demo install
npm --prefix apps/web-demo test
npm --prefix apps/web-demo run dev
```

浏览器打开终端给出的本地端口（常见 `http://localhost:5173/`）。**刷新后再点**（修订后的闸门在内存状态机里）。

黄金切片点法：

1. 列表进 **橙果素质教育**（应显示未转化，不要直接当商机）
2. 点「提交获客并分配」
3. 等系统分配、建档两条自动已生效（约 0.8s，无需确认新建）；此时仍无客户三对象
4. 再等约 0.8s，时间线出现商机转化建议（待确认）→ 点「确认转化」→ 左侧出现客户 + 联系人 + 商机=需求确认
5. 再等跟进草稿 → 点「确认发出」→ 电话活动生效；时间线四类交卷都在
6. 另开 **杭齿精密机电** → 「建议赢单」→ 销售确认不应改成赢单 → 切 **manager** 才过

其它锁点：拒绝转化不建三对象；销售可「推进到谈判」无需经理；中止只清排队；Token 顶栏合计 = 各条之和；相似写死杭齿→嘉兴精工装备（邻里鲜→夜灯在 M1 SQL 锁住）。

清单：[checklists/M0.5.md](./checklists/M0.5.md)。契约：[contracts/M0.5.md](./contracts/M0.5.md)。

本步已结束。不要继续给 demo 堆功能、不要接 API。真 UI 已是 `apps/web`（M3），视觉已在 M6 交付。

---

### M1 = S2 + S3（已完成）库、种子、语料

**不用任何 skill。** 不要 `/create-plan`。不要 `/orchestrate`。不要 `/sdk`。不要改 `apps/web-demo`。

先读：`docs/contracts/M0.md`、`docs/contracts/M0.5.md`、`docs/PRD.md` §4–7、`docs/engineering-standards.md`。

复制整段：

```text
按 docs/contracts/M0.md 和 docs/contracts/M0.5.md 做 M1（S2+S3）。
不要 /create-plan，不要 /orchestrate，不要 /sdk，不要 /frontend-design。

建这些目录（空 stub 也要有 README 或 index 占位，避免下一步找不到）：
  apps/api
  packages/harness
  packages/domain
  runtime/agents
  runtime/skills
  data/corpus

不要改 apps/web-demo 去接后端；真 UI 留 M3 的 apps/web。
不要新建一套第二套公司名。

SQLite + Drizzle，库文件约定 data/hengce.db（或 packages/domain 文档写明路径）。
表至少：
  users, leads, accounts, contacts, opportunities, activities,
  agent_runs, handoffs, token_ledger, audit_events
documents 表可先做元数据占位（S9 用），不要上向量列。
不做报价单表、合同表、充值账户。

users 种子三角色：sales / manager / viewer（假账号即可）。
8 家名字一字不改。橙果素质教育=未转化线索（无 account/contact/opp）。
其余七家=已转化：必须同时有 account + 至少一个 contact + 一条 opportunity，
阶段按 PRD：杭齿方案报价、嘉兴需求确认、澄海谈判、邻里鲜方案报价、
夜灯需求确认、海图谈判、江东水务物资丢单。
活动若有种子，type 只能是：电话、企微、邮件、拜访。

语料只要文本，无音频、无 emoji、无真实手机号/身份证。
data/corpus/<slug>/ 每家至少五类文件：email、call-transcript、wecom、handbook、win-or-loss-case。
正文里的公司名必须是那八个字面之一。
相似对要能在文本里看出来：杭齿↔嘉兴精工装备（制造件/设备）；邻里鲜↔夜灯便利（零售门店）。
刻意不像：海图进出口（外贸单证）、江东水务物资（市政招标）。

searchSimilar 本步用 SQL/关键词即可，测试锁住：杭齿第一名嘉兴精工装备；邻里鲜第一名夜灯便利；海图第一名不得是杭齿。

先写 schema 与种子测试，写入磁盘后立刻跑。测不过不算完成。
关键禁写/闸门处中文注释。
写 docs/checklists/M1.md（含命令与通过项）和 docs/contracts/M1.md
（表字段、枚举、种子约定、ACL 将在 M2 执行的接口形状、禁做项）。
本步不要实现 Agent.create，不要接 Cursor API。
```

本步磁盘上应出现的大致形状：

```text
apps/api/                 HTTP 可先只 health/占位，或仅包结构 + 测库的脚本
packages/domain/          Drizzle schema + 类型（线索状态、商机阶段、活动 type 枚举）
packages/harness/         可先空模块或 searchSimilar 的 SQL 实现，不要 SDK 调用
runtime/agents/           可空，或留 README 说明 S4 再写
runtime/skills/           可空，或留 README 说明 S5 再写
data/corpus/              8 个子目录，每家多份 .md/.txt
data/hengce.db            由迁移/种子生成，不要手改二进制当文档
docs/checklists/M1.md
docs/contracts/M1.md
```

完成标准（缺一条都不算完）：

- 测试通过（至少：schema 能建、8 家种子对、橙果无商机、七家有三对象、阶段中文、searchSimilar 两对）
- `data/corpus` 能 grep 到八个公司全名
- 有 M1 清单和契约
- `apps/web-demo` 没有新增 `fetch` / API 客户端

本步开始解锁 eval：**Q5**（语料同宇宙）、**Q7**（中文阶段）的数据前提。Q1/Q2/Q4 的真调度仍要等 M2。

S4/S5 可以在 **同一个对话后半**只写 md 定义，但不要在 M1 写 SDK 调用、不要起真 Agent。

---

### S4（已完成）运行时 Agent 定义

前置：M1 目录 `runtime/agents/` 已存在。可与 M1 同会话，但复制词要另贴一次。

先打：

```text
/create-subagent
```

然后贴（或合并成一条消息）：

```text
按 agent-development 写 runtime/agents 四个文件，不要写到 .cursor 下给 Cursor 当同事。

orchestrator.md
  name: orchestrator
  界面名：系统分配
  When to invoke：新线索刚录入、需要指定所有人时
  可写：handoffs、agent_runs、leads.owner
  禁止：accounts、contacts、opportunities、activities；禁止打扮成销售或销冠

lead-intake.md
  name: lead-intake
  界面名：建档
  When to invoke：系统分配已生效、需要补全线索字段时
  可写：leads 字段（公司名、行业、来源摘要等）
  禁止：转化落地、写商机阶段、写 activities
  HITL：无，自动生效

pipeline.md
  name: pipeline
  界面名：商机
  When to invoke：建档已生效、需要转化建议或推进阶段时
  可写：accounts、contacts、opportunities
  禁止：activities
  HITL：转化须 sales；赢单/丢单须 manager；需求确认/方案报价/谈判销售自推

followup.md
  name: followup
  界面名：跟进
  When to invoke：转化已生效、需要起草跟进活动时
  可写：activities，且必须带 type（电话/企微/邮件/拜访）
  禁止：改 opportunities.stage
  HITL：外发待 sales 确认

frontmatter 必须有：name、description（含 When to invoke）、tools 白名单。
四份 tools 必须各不相同，体现写权限差异。
正文用中文写禁区。不要写成四个销售员。
```

产出：`runtime/agents/orchestrator.md`、`lead-intake.md`、`pipeline.md`、`followup.md`。

未完成：缺 When to invoke、四份 tools 相同、orchestrator 自称销冠、写到了 `.cursor/agents`。

---

### S5（已完成）运行时业务 skill

前置：`runtime/skills/` 存在。不要跟 S4 抢目录。

先打：

```text
/create-skill
```

然后贴：

```text
按 skill-development 只写在 runtime/skills，不要写进 .cursor/skills。
这些 skill 是给衡策销管的 CRM Agent 读的，不是给你在 Cursor 里 / 唤起的。

建议三份（可拆 references，SKILL.md 保持精简）：
  crm-domain：线索/客户/联系人/商机字段；中文状态 新线索|已转化；
              阶段 需求确认|方案报价|谈判|赢单|丢单；禁止 Discovery/Demo。
  lead-pipeline：转化条件（确认后才落三张对象）；中间阶段销售自推；
                 赢单/丢单经理闸门；拒绝转化不建对象。
  followup-activity：活动四类型；外发确认前不生效；跟进不得改商机阶段。

description 用第三人称写触发语（When to use）。
不要把 PRD 或 create-plan 全文拷进 runtime。
无 emoji。
```

未完成：文件出现在 `.cursor/skills/crm-domain`、单文件超长无 references、枚举写成英文阶段。

---

### S6 = M2（已完成）harness 真跑 Agent

前置：读届时的 `docs/contracts/M1.md`。需要本机可运行的 `@cursor/sdk` 与（黄金切片）`CURSOR_API_KEY`。无密钥时：ACL/schema/顺序测试仍须过；黄金切片在清单里标明跳过，不得假装通过。

复制：

```text
/sdk
先读 docs/contracts/M1.md 和 docs/contracts/M0.5.md。
用 @cursor/sdk 在 packages/harness 按 M0.5 顺序拉起四个 CRM Agent。
每个 Agent：Agent.create + send + wait；显式 local: { cwd }；finally dispose。
不要 cloud: { repos }。不要把密钥传到 apps/web 或 web-demo。

调度语义：同一条线索上顺序交卷，禁止兄弟直连。
ACL：系统分配不得写商机三表；建档不得写 stage；跟进不得改 opp.stage；
越权进 audit_events 并拒绝（R4）。
非法 JSON 不得入库（Q3）。失败 handoff 可见，后续不再改库（R3）。

Token：每次 run 写 prompt_tokens、completion_tokens、估算金额到 agent_runs / token_ledger；
顶栏合计必须等于各 run 之和（R2）。无充值表。

HITL：分配/建档自动；转化与外发等人；赢单/丢单仅 manager。
无 UI 也要能跑黄金切片（橙果）到「等确认」状态。

关键路径中文注释。补能在无密钥下跑的单测：顺序、ACL、schema、Token 加法。
有密钥再补 test:golden。
写 docs/checklists/M2.md 和 docs/contracts/M2.md（含 HTTP 若本步已露出：
  POST /api/leads/ingest 只跑到转化待确认，确认后再跟进；语义不可改成四个 Agent 同时开工）。
禁止把 /orchestrate 的 plan.json 嵌进 CRM 运行时。
```

完成：无 UI 能走橙果到待确认转化/外发；ACL 测试拒绝越权；有 M2 契约。解锁 **Q1 Q2 Q3 Q4（部分）R2 R3 R4**。

---

### S7 = M3（已完成）真控制台

**不用** `/frontend-design`。**不要**改造 `web-demo` 接 API。

前置：`docs/contracts/M2.md`。

复制：

```text
新建 apps/web（Vite + React），不要把 apps/web-demo 接 API。
web-demo 可留作对照，禁止在 demo 目录加 fetch。

交互必须遵守 docs/contracts/M0.5.md：
  时间线为主，对话框为第二入口；
  展示名：系统分配 / 建档 / 商机 / 跟进；
  转化、外发、赢单丢单才是待确认；中间阶段销售可推；
  拒绝转化不建三对象；中止只清排队；
  Token 顶栏合计 = 各 run 之和；无充值；无 emoji。
五屏：线索列表、详情（时间线主）、待确认队列、用量、次要录入。

接 PRD 接口语义：
  POST /api/leads/ingest
  GET  /api/leads
  GET  /api/leads/:id
  POST /api/handoffs/:id/confirm
  POST /api/runs/:id/abort
  GET  /api/usage
  GET  /api/health
鉴权演示 header / 本地 session，三角色。Agent 端口不暴露给浏览器。viewer 改阶段须 403（R5）。

先能点再谈好看。写 docs/checklists/M3.md 和 docs/contracts/M3.md。
```

完成：橙果走通转化+外发；杭齿赢单须切 manager；R5/R6（前端包无 `CURSOR_API_KEY`）。
实现时相对复制词还补了：`POST /api/leads/:id/stage`、`POST /api/leads/:id/abort`、`GET /api/handoffs/pending`、`GET /api/similar`。

---

### M4（已完成）Docker

无独立 skill。前置：M3 能本地点。

```text
docker compose：nginx 反代 / 与 /api，api Node，web 静态，volume 挂 hengce.db。
单机，无 Redis、无 MQ、无独立 Grafana。
apps/web-demo 可不上生产镜像。
写 docs/checklists/M4.md 和 docs/contracts/M4.md。
本机须能 `docker compose config`；`up` 未跑通不得假装通过。
有密钥则 compose up 后黄金切片仍能讲完；无密钥至少能回放种子。
```

---

### M5（已完成）评估

无独立 skill。按 [eval.md](./eval.md) 跑 Q1–Q8、R1–R6。

```text
npm test
npm run test:golden    # 无密钥则跳过并在报告标明
npm run eval:report    # 生成 docs/eval-last-run.md，不要手写假装通过
```

未通过项必须带：用例 ID、期望、实际、相关 `run_id`。不评估「像不像 GPT」、电销接通率、S9 之前的向量 Recall。

清单与契约：`docs/checklists/M5.md`、`docs/contracts/M5.md`。最近一次报告：[eval-last-run.md](./eval-last-run.md)。

---

### S8 = M6（已完成）好看

前置：S7 能演示（橙果转化+外发、杭齿赢单闸门）。

```text
/frontend-design
只改 apps/web。主画面是企业漏斗时间线：系统分配、建档、转化、跟进，国内销售用语。
不要改调度顺序、不要改闸门、不要动 apps/web-demo。
不要通用紫渐变 / 通用 dashboard 模板。无 emoji。
```

清单与契约：`docs/checklists/M6.md`、`docs/contracts/M6.md`。

---

### S9（已完成）SQLite 向量

前置已满足。8 家未换。`searchSimilar` 走 sqlite-vec `vec_leads`。清单与契约：`docs/checklists/S9.md`、`docs/contracts/S9.md`。

---

### S10（未做）并行改仓库代码

前置：M3 能演示、仓库有 git 远程、环境有 `CURSOR_API_KEY`。这是**改本仓库**，不是跑销售 Agent。

```text
/orchestrate 给衡策销管平台加线索列表筛选（按阶段/未转化）与 CSV 导入，含测试与契约文件
```

禁止：用它调度 lead-intake；在 M1/M2 提前扇出；没有远程就开云端工人。

---

## 7. 推荐开工切法（一次一个 M）

1. 已完成：S0、S1、M0、M0.5、M1、S4、S5、M2、M3、M4、M5、M6、**S9**
2. **可选：S10 `/orchestrate`**（需 git 远程与 `CURSOR_API_KEY`）

不要在 M1 对话里提前写 M2 的 `Agent.create`。不要在 M3 之前 `/frontend-design`。M6 视觉已交付，不要再改漏斗或给 demo 做视觉。

---

## 8. 用错对照

| 你想做的 | 不该 | 该 |
|---|---|---|
| 点按钮看方向 | `/frontend-design`、先写 API | 已有 web-demo，不要再扩 |
| 造 8 家库和语料 | `/create-plan` 再写架构、`/orchestrate` 扇出 | 直接按 M0/M0.5 契约做 M1 |
| 四个 CRM Agent 真跑 | `/orchestrate` | S6 `/sdk` + `packages/harness` |
| 给 CRM Agent 写人设 | 写进 `.cursor` 当 Cursor 子代理 | S4 `runtime/agents` |
| 给 CRM Agent 写业务手册 | 写进 `.cursor/skills` | S5 `runtime/skills` |
| 页面好看 | 先美化 demo | 已在 M6 只改 `apps/web` |
| 找相似客户 | 先上 Pinecone / GraphRAG | sqlite-vec `vec_leads`（S9） |
| 把调度当销售同事 | 时间线写「销冠 orchestrator」 | 展示名「系统分配」 |
| 每步都让人点确认 | 退回旧 HITL | 只转化 / 外发 / 赢单丢单等人 |

---

## 9. 本步之后开新对话可用的最短消息

```text
@docs/contracts/S9.md @docs/skill-timeline.md
S9 已交付。无 git 远程则不要做 S10。
不要改漏斗，不要给 web-demo 加 fetch。
```
