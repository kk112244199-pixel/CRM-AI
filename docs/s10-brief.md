# S10 实现 brief：线索列表筛选与 CSV 导入

衡策销管平台 S10 切片：为线索列表增加服务端筛选（按阶段 / 未转化）与 CSV 导入。本文锁定语义，供后续 worker 实现 API、前端、测试与契约。硬约束见 [docs/contracts/S9.md](./contracts/S9.md) 与 [M0](./contracts/M0.md)–[M6](./contracts/M6.md)。工程规则：测试必须通过；无 emoji；橙果素质教育保持未转化；八家公司名一字不改。

## 当前状态（勿重做）

- `GET /api/leads`（`apps/api/src/router.ts`）调用 `listLeadRows(ctx.db)`，无 query 参数。
- `listLeadRows` 位于 `packages/harness/src/scheduler.ts`，已为每行附加 `oppStage`。
- `apps/web` 列表页（`apps/web/src/App.tsx`）已有客户端 tabs：全部 / 未转化 / 已转化 / 待确认，以及文本搜索；`getLeads(role)` 一次拉全量。
- 尚无 CSV 导入 endpoint 或 UI。

## Filter

### HTTP

```
GET /api/leads?status=&stage=
```

| 参数 | 取值 | 行为 |
|------|------|------|
| `status` | `LEAD_STATUSES`：`新线索`、`已转化` | 省略 = 不按 status 过滤 |
| `stage` | `OPP_STAGES`：`需求确认`、`方案报价`、`谈判`、`赢单`、`丢单` | 省略 = 不按 stage 过滤；匹配 `opportunities.stage`（经 `oppStage`）。未转化线索 `oppStage` 为 null，**不会**匹配任何 stage 过滤 |

- 两参数 **AND** 组合。例：`status=新线索&stage=方案报价` 返回 `[]`（未转化无 oppStage）。
- 未知 `status` 或 `stage` → **400** `{ ok: false, error }`（中文 error 即可）。
- 响应形状不变：`{ leads: LeadRow[] }`，含 `oppStage`。
- 无参数：与今日行为相同（全部线索）。

### Harness

实现 `listLeadRows(db, { status?, stage? })` 于 `packages/harness`；HTTP 层保持薄。若需对外暴露，从 `packages/harness/src/index.ts` export。

### Seed 锁（测试须覆盖）

| 查询 | 必须包含 |
|------|----------|
| `status=新线索` | 橙果素质教育 |
| `stage=方案报价` | 杭齿精密机电、邻里鲜超市 |
| `stage=丢单` | 江东水务物资 |

## CSV import

### HTTP

```
POST /api/leads/import
```

- Body：JSON `{ csv: string }`（UTF-8，可选 BOM）。**不要**引入 CSV npm 依赖；自行解析。
- 必填表头列：`company,industry,contactName,sourceSummary`。可选列：`searchTags`。
- 每个有效行插入一条线索：
  - `status=新线索`
  - `ownerUserId` null
  - `lastActivity` 为 `'CSV 导入'`
  - 无 account / contact / opportunity / activity
  - **不要**调用 `ingestLead` 或任何 Agent runner
- 公司名重复（与现有 `leads.company` 精确字符串匹配，含八条 seed）→ 跳过并记录 reason，**不**整批失败。
- 空 / 缺失 `company` → 该行记入 `errors`；继续处理其他行。
- ACL：`viewer` → **403**，db 不变；`sales` 与 `manager` 允许。
- 任意成功插入后调用 `rebuildLeadVec(sqlite)`，保证 S9 相似检索一致。
- 响应：

```json
{
  "ok": true,
  "imported": [{ "id": "...", "company": "..." }],
  "skipped": [{ "company": "...", "reason": "..." }],
  "errors": [{ "line": 2, "message": "..." }]
}
```

- 新 id 形如 `lead-csv-<n>` 或 `lead-csv-<slug>-<n>`；**不得**复用 seed id。
- CORS 仍为 GET、POST、OPTIONS。

## Web

- **保留**现有 tabs（全部 / 未转化 / 已转化 / 待确认）。
- 新增五个商机阶段 stage chips（复用 `.filter` 按钮样式）：
  - 选「未转化」→ 请求 `status=新线索`
  - 选某 stage → 请求 `stage=...`
  - 「全部」且无 stage → 省略对应 query 参数
  - 「待确认」可继续仅客户端过滤 `pendingIds`
- 列表工具栏增加 CSV 导入：file input；仅 `sales` / `manager`；`viewer` 隐藏控件或遇 403。调用 `POST /api/leads/import` 后刷新列表。
- 扩展 `apps/web/src/api.ts`：
  - `getLeads(role, query?)`
  - `importLeadsCsv(role, csv)`
  - 继续 `x-hengce-role`；**不要**在 `apps/web` 使用 `CURSOR_API_KEY` / `@cursor/sdk`。
- **不要**改漏斗 rail、HITL 闸门、或 `apps/web-demo`（仍无 fetch）。

## Tests 与 docs（后续 task，此处仅规格）

| 位置 | 内容 |
|------|------|
| `apps/api/src/router.test.ts` | 筛选用例、导入用例、`viewer` 403 |
| `packages/harness` tests | `listLeadRows` 筛选、import helper |
| `apps/web/src/r6.test.ts` | stage chips 与 CSV 导入 UI 文案；`api.ts` 含 `/api/leads/import` |
| 最终文档 | `docs/checklists/S10.md`、`docs/contracts/S10.md`；`docs/skill-timeline.md` S10 标 done；先前契约「下一刀」不再写「S10 未做」 |

## 禁做

- Redis、MQ、GraphRAG
- `apps/web-demo` fetch
- 漏斗 / order / gate 变更
- 英文 Discovery / Demo 阶段名
- emoji
- 把 `.orchestrate plan.json` 放进 CRM runtime
- 用 `/orchestrate` 调度 lead-intake

## 八家 seed 公司（名字不可改）

杭齿精密机电、嘉兴精工装备、澄海医疗器械、橙果素质教育、邻里鲜超市、夜灯便利、海图进出口、江东水务物资。
