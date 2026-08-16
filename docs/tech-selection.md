# 衡策销管平台 · 技术选型（客观结论）

原则：只解决本项目真实问题。面试关键词不自动等于架构。厂商宣传里的「知识图谱 / 强化学习 / 60 个 Agent」不进首版。

产品名：**衡策销管平台**。运行时四个 Agent 在**同一条线索上依次交 handoff**。Token 只做跑完可见消耗。

## 总表

| 项 | 结论 | 首版怎么做 | 为什么 |
|---|---|---|---|
| Vite + React | 做 | `apps/web` | 运营台，已拍板 |
| SQLite + Drizzle | 做 | `data/hengce.db` | 轻量真库，便于演示 |
| Docker | 做 | `docker compose up` | 一键起前端、API、反代 |
| nginx | 薄做 | compose 里反代 `/` 与 `/api` | 有部署边界即可，不上 CDN |
| 权限隔离 | 薄做 | 三角色 + Agent 表级 ACL | 见下 |
| 多 Agent 沙箱 | 做（逻辑隔离） | 工具白名单 + 可写表白名单 + 禁止互聊 | 不做虚拟机/Firecracker |
| 状态持久化 | 做 | SQLite：leads / activities / agent_runs / handoffs / token_ledger | 刷新不丢 |
| 工具编排 | 做 | `packages/harness` 按序调度 | 这就是平台本身 |
| 人机协同 HITL/HOTL | 做 | 转化/外发/赢单丢单须人确认；中间阶段销售自推；时间线可打断 | 环内审批 + 环上中止 |
| 安全护栏 | 薄做 | 输出校验、表级禁写、失败 handoff | 不做企业 DLP |
| 记忆与可回溯 | 做 | 本条线索上下文 + 全量 handoff/run 可查 | 不做独立记忆中台 |
| 上下文工程 | 做（内嵌） | 该 Agent 的 runtime md + 对应 skills + 当前线索快照 | 不把 8 家全文塞进窗口 |
| RAG | 做（薄） | sqlite-vec `vec_leads`，档案向量 KNN | 不上独立向量库 / GraphRAG |
| GraphRAG | 不做 | — | 8 个节点不够图，增加解释成本 |
| 独立向量库 | 不做 | 以后可用 SQLite 向量扩展 | 不上 Pinecone/Milvus |
| Redis | 首版不做 | — | 单机 SQLite，没有缓存失效问题 |
| RabbitMQ | 首版不做 | — | 四类交卷是同步顺序，不是异步洪峰 |
| Prometheus + Grafana | 首版不做独立栈 | 应用内 Token/Run 指标 + `/metrics` 文本 | 单机演示够用 |
| 测试评估 | 做 | 见 `docs/eval.md` | 系统化验证质量和可靠性 |

若课程**书面点名** Redis / RabbitMQ / Prometheus+Grafana，再加「薄切片」，不改主架构：

- Redis：线索时间线缓存 60 秒（可删不影响正确性）
- RabbitMQ：仅用于「跟进提醒延迟投递」演示队列
- Prom/Grafana：compose profile `observability` 刮 `/metrics`

未点名则不加，避免假微服务。

## 分项说明

### Redis

缓存解决的是读多写多、多实例共享。本系统一台 API、一份 SQLite、演示流量可忽略。加 Redis 会多一个要讲清的故障点（缓存与库不一致），首版收益为负。

### RabbitMQ

四类交卷的语义是：上一份 handoff 验收后，下一角色才开工。这是编排器里的顺序调用，不是生产者-消费者削峰。用 MQ 会把「顺序」拆成「最终一致」，演示更难看清谁先谁后。

### nginx + Docker

要。`web`（静态或 Vite 构建物）和 `api` 分开端口时，用 nginx 做唯一入口，属于正常部署，不是堆中间件。

### 权限隔离

两层，都要：

1. **人**：`sales` 录入、确认转化/外发、自推中间阶段、中止；`manager` 另可确认赢单/丢单；`viewer` 只读。演示用本地角色头即可，不上 OAuth/SSO。
2. **Agent**：每个 Agent 一张可写表白名单。orchestrator 只写 handoff 与 `lead.owner`，禁止写客户三表。这是沙箱的核心，比 RBAC 框架更重要。

### 多 Agent 沙箱

Cursor SDK 本地运行时不是虚拟机。本项目承诺的隔离是：

- 进程：API 在容器内；Agent 只通过 harness 暴露的工具访问库
- 数据：表级写白名单
- 通信：禁止兄弟 Agent 直连，只经 `handoffs`
- 密钥：`DASHSCOPE_API_KEY`（及可选 `CURSOR_API_KEY`）只在 API 容器环境变量，不进前端、不进语料

不承诺：seccomp、独立内核、每 Agent 一个容器（那会把演示变成运维课）。

### RAG / GraphRAG / 向量库

非结构化语料（邮件、通话转写、企微摘录、手册、案例）是 **8 家 × 五类 = 四十篇**，给 Q8 引用对照。相似客户走 sqlite-vec（`vec_leads` L2），不上独立向量库。GraphRAG 需要稳定实体关系图，8 家客户用图谱是表演。

### 上下文工程

要做，但是嵌在 harness 里：每次注入该 Agent 的 `runtime/agents` md、对应 `runtime/skills`，以及当前线索快照。禁止把 8 家全文塞进窗口。相似客户走 `searchSimilar`，不把检索篇章整篇塞进模型。这就是上下文工程，不必再引入一套框架名。

### 状态持久化

SQLite 即状态。Agent 崩溃后从 `agent_runs.status` 和已落库 handoff 恢复，不靠进程内存。

### 工具编排

harness 按固定顺序调四个 Agent（你指定的主线）。不是通用工作流引擎，首版顺序写死：orchestrator → lead-intake → pipeline → followup。以后才考虑可配置 DAG。

### 人机协同（HITL / HOTL）

- **HITL（环内）**：转化、对外发出、赢单/丢单须人确认。分配与建档自动生效。需求确认 / 方案报价 / 谈判由销售自推，不必经理点头。
- **HOTL（环上）**：主管看时间线，可中止后续 Agent，已落库记录不偷偷改历史（用新 handoff 修正）。

低风险（系统分配、建档）自动过；高风险等人。

### 安全护栏

- 结构化输出 JSON schema 校验失败 → 失败 handoff，不写业务表
- 表级禁写（系统分配不得写客户三表；跟进不得改商机阶段）
- 首版不做 Token 月额度；只做合计可核对
- 语料与密钥分离

### 记忆与可回溯

记忆 = 库里的线索、活动、handoff，不是向量里的「印象」。可回溯 = 任意 handoff 能看到：谁、何时、输入摘要、输出、token、是否被人工改过。这是评估和答辩的主证据。

### Prometheus + Grafana

应用内已有 Token 合计与 run 状态。独立监控栈适合多实例长期跑。单机答辩用控制台指标即可。`GET /api/metrics` 预留 Prometheus 文本格式，方便以后刮取，但 compose 默认不启 Grafana。

## 明确不做（首版）

AI 外呼、真实企微/飞书、充值套餐与发票、知识图谱中台、强化学习、60 个行业 Agent、Kubernetes、独立向量云、GraphRAG。
