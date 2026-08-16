# 衡策销管平台

卖销售系统的公司使用的 **CRM harness 多智能体控制台**。获客后四个 Agent 按序交卷：系统分配、建档、商机（转化/阶段）、跟进活动；客户+联系人+商机分开；转化与外发由销售确认，赢单/丢单由经理确认。

完整需求：[docs/PRD.md](docs/PRD.md) · 技术对错：[docs/tech-selection.md](docs/tech-selection.md) · 评估：[docs/eval.md](docs/eval.md) · 工程约定：[docs/engineering-standards.md](docs/engineering-standards.md) · Skill 时间线：[docs/skill-timeline.md](docs/skill-timeline.md) · 点击原型：[docs/frontend-demo.md](docs/frontend-demo.md) · 当前契约：[docs/contracts/S9.md](docs/contracts/S9.md) · 开发交接：[docs/cursor-session-handoff.md](docs/cursor-session-handoff.md)

## 技术选型（摘要）

| 采用 | 薄做 | 首版不做 |
|---|---|---|
| Vite+React、SQLite+Drizzle、Docker、顺序四 Agent、HITL/HOTL、Token 台账、逻辑沙箱、上下文组装、可回溯 handoff | nginx 反代、三角色权限、`/metrics` 预留、护栏（schema+ACL） | Redis、RabbitMQ、独立 Prometheus+Grafana、GraphRAG、独立向量库、K8s、电销、充值套餐 |

课程若**点名** Redis / RabbitMQ / Grafana，按 tech-selection 里的薄切片加，不改主链路。

## 系统流程图

```mermaid
flowchart TD
  U["获客录入"] --> W["控制台"]
  W --> API["apps/api"]
  API --> H["packages/harness"]
  H --> A1["系统分配 orchestrator 自动"]
  A1 --> A2["建档 lead-intake 自动"]
  A2 --> A3["商机 pipeline 转化建议"]
  A3 --> HITL1{"sales 确认转化?"}
  HITL1 -->|否| STOP["停止后续"]
  HITL1 -->|是| OBJ["客户+联系人+商机"]
  OBJ --> A4["跟进 followup"]
  A4 --> HITL2{"确认发出?"}
  HITL2 -->|否| NOSEND["活动不生效"]
  HITL2 -->|是| ACT["activities 生效"]
  OBJ --> ADV["销售自推中间阶段"]
  ADV --> WIN{"赢单或丢单?"}
  WIN -->|是| HITL3["manager 确认"]
```

## 业务流程图

```mermaid
flowchart LR
  L["线索 新线索"] --> C["确认转化"]
  C --> A["客户"]
  C --> P["联系人"]
  C --> O["商机 需求确认"]
  O --> S2["方案报价"]
  S2 --> S3["谈判"]
  S3 --> S4["赢单"]
  S3 --> S5["丢单"]
```

黄金切片：橙果获客 → 系统分配 → 建档 → 确认转化 → 确认发出电话活动。报价/合同不做。相似：杭齿精密机电 ↔ 嘉兴精工装备；邻里鲜超市 ↔ 夜灯便利。

## 逻辑架构图

```mermaid
flowchart TB
  subgraph dev["开发层 不进演示主路径"]
    SK[".cursor/skills"]
  end
  subgraph run["运行层 演示走这里"]
    WEB["运营台 时间线为主"]
    API["Harness HTTP"]
    AG["runtime/agents 四个角色"]
    SKL["runtime/skills"]
    CORP["data/corpus 8家文本"]
    DB[("SQLite")]
    QWEN["阿里云千问"]
  end
  WEB --> API
  API --> AG
  AG --> SKL
  API --> CORP
  API --> DB
  API --> QWEN
```

开发层 skill 不进运行时加载路径。默认真模型是千问；Cursor SDK 可选，不是主路径。

## 技术实现架构图

```mermaid
flowchart TB
  subgraph users["1 用户层"]
    ROLE["三角色 sales / manager / viewer"]
    SPA["apps/web React 时间线控制台"]
    ROLE --> SPA
  end

  subgraph ingress["2 接入层 Docker Compose"]
    NGX["nginx 宿主机 :80 唯一入口"]
    WEB["web 容器 静态构建物"]
    APIC["api 容器 内网 :3001 不映射到宿主机"]
  end

  subgraph app["3 应用与编排 同在 api 进程"]
    HTTP["apps/api HTTP 路由"]
    SCH["packages/harness 顺序 await 调度"]
    ACL["表级写白名单 ACL"]
    VAL["Agent JSON schema 校验"]
    GATE["HITL 转化 外发 赢单丢单"]
    TOK["Token 入账 与 /metrics 文本"]
    DOM["packages/domain Drizzle 表与枚举"]
    PICK["selectRunner"]
    HTTP --> SCH
    SCH --> ACL
    SCH --> VAL
    SCH --> GATE
    SCH --> TOK
    SCH --> DOM
    SCH --> PICK
  end

  subgraph agents["4 运行时四 Agent 禁止并行 禁止互聊"]
    A1["系统分配 orchestrator"]
    A2["建档 lead-intake"]
    A3["商机 pipeline"]
    A4["跟进 followup"]
    RT["runtime/agents md"]
    SKL["runtime/skills"]
    A1 --> A2 --> A3 --> A4
    RT --> SKL
  end

  subgraph models["5 模型适配"]
    QW["qwenRunner 默认真模型"]
    SCR["scriptedRunner 无密钥回放"]
    CUR["cursorRunner 可选"]
  end

  subgraph data["6 数据与语料"]
    DB[("SQLite volume hengce.db")]
    TABS["leads accounts contacts opportunities activities"]
    RUNS["agent_runs handoffs token_ledger audit_events"]
    CORP["data/corpus 8家 x 5类"]
    DB --> TABS
    DB --> RUNS
  end

  subgraph ext["7 进程外"]
    DS["阿里云百炼 compatible-mode"]
    MOD["qwen3.7-flash-2026-07-15"]
    DS --> MOD
  end

  SPA -->|"请求头 x-hengce-role"| NGX
  NGX -->|"静态页"| WEB
  NGX -->|"REST /api"| APIC
  APIC --> HTTP
  SCH --> A1
  A1 --> RT
  PICK --> QW
  PICK --> SCR
  PICK -.->|非默认| CUR
  QW -->|"Chat Completions 密钥只在 api"| DS
  SCH --> DB
  SCH --> CORP
  GATE -->|"待确认写回时间线"| SPA
```

老师看图时可以按 1→7 讲：浏览器只打 80 端口；nginx 把页面和 API 拆开；四个 CRM Agent 在 harness 里顺序交卷，不直连、不暴露端口；有密钥走千问，没有密钥仍能 scripted 回放种子；SQLite 刷新不丢；前端包里没有模型密钥。首版不做 Redis、RabbitMQ、独立 Grafana、K8s。本地开发时 Vite 把 `/api` 反代到 `127.0.0.1:3001`，不经 nginx。

## 多智能体沙箱（逻辑隔离）

```mermaid
flowchart TB
  O["系统分配"] -->|只写| HO["handoffs 与 lead.owner"]
  L["建档"] -->|只写| LEADS["leads"]
  P["商机"] -->|只写| OBJ["accounts contacts opps"]
  F["跟进"] -->|只写| ACT["activities"]
  O -.->|禁止直连| L
  L -.->|禁止直连| P
  P -.->|禁止直连| F
```

虚线表示禁止直连。越权工具调用进 `audit_events` 并拒绝。

## 人机协同

```mermaid
stateDiagram-v2
  [*] --> Auto: 分配或建档
  [*] --> Pending: 转化或外发或赢单丢单
  Pending --> Done: 有权限的人确认
  Pending --> Rejected: 拒绝
  Auto: 自动已生效
  Pending: 待确认
  Done: 已生效
  Rejected: 已拒绝
```

中间商机阶段销售直接推进。HOTL：可 abort；历史 handoff 不改写。

## 接口设计

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/leads/ingest` | 录入线索，顺序跑系统分配→建档→转化建议；确认转化后才跟进 |
| GET | `/api/leads` | 列表 |
| GET | `/api/leads/:id` | 卡片 + 时间线 |
| POST | `/api/handoffs/:id/confirm` | 确认 |
| POST | `/api/handoffs/:id/reject` | 拒绝 |
| POST | `/api/leads/:id/stage` | 推进阶段；赢单/丢单待经理确认 |
| POST | `/api/leads/:id/abort` | 按线索中止排队 |
| POST | `/api/runs/:id/abort` | 按 run 中止排队 |
| GET | `/api/handoffs/pending` | 跨线索待确认 |
| GET | `/api/similar?company=` | 相似客户（sqlite-vec） |
| GET | `/api/usage` | Token 合计 |
| GET | `/api/metrics` | Prometheus 文本预留 |
| GET | `/api/health` | 存活 |

鉴权按 `sales` / `manager` / `viewer`。路径与语义以契约为准，未另写 OpenAPI。不得把 Agent 端口暴露给前端。

## 目录（实现后）

```text
apps/web
apps/web-demo
apps/api
packages/harness
packages/domain
runtime/agents
runtime/skills
data/corpus
docs/
```

## 本地与评估

库与语料（M1）+ harness（M2）：

```text
npm install
npm test
npm run test:golden    # 无密钥则跳过
npm run eval:report    # 生成 docs/eval-last-run.md
npm run db:seed
npm --prefix apps/api start
```

本地真模型：复制 `.env.example` 为仓库根 `.env`，自己填 `DASHSCOPE_API_KEY`。不要把密钥写进前端或提交进 git。

无后端点击原型（M0.5）：

```text
npm --prefix apps/web-demo install
npm --prefix apps/web-demo test
npm --prefix apps/web-demo run dev
```

真控制台（M3）：

```text
npm --prefix apps/api start
npm --prefix apps/web install
npm --prefix apps/web test
npm --prefix apps/web run dev
```

浏览器打开 Vite 提示的端口。默认是橙果的漏斗交卷轨。确认转化 → 确认发出。杭齿：建议赢单须切经理。不要把 web-demo 接 API。

Docker（M4，唯一入口 :80）：

```text
docker compose up --build
```

打开 http://127.0.0.1/ 。无 Redis、无 MQ。无密钥默认 scripted，可回放种子；有 `DASHSCOPE_API_KEY` 自动走千问。

## 8 家客户

杭齿精密机电、嘉兴精工装备、澄海医疗器械、橙果素质教育、邻里鲜超市、夜灯便利、海图进出口、江东水务物资。详情见 PRD。
