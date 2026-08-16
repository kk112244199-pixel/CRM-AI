# 衡策销管平台 · 测试与评估

目标：系统化验证 AI 系统的**质量**和**可靠性**，而不是只测「页面能打开」。

开发完成后必须跑通本文件；答辩时用同一批用例。

## 质量（Quality）

| ID | 验证什么 | 方法 | 通过标准 |
|---|---|---|---|
| Q1 | 路由顺序 | 脚本切片 + 黄金切片橙果 | ingest 只到转化待确认；确认转化后才有跟进；四类 handoff 按序各一份 |
| Q2 | 职责隔离 | SQL / 工具日志 | orchestrator 不写 accounts/opps；followup 不写 opp.stage |
| Q3 | 结构化输出 | schema 校验 | 非法 JSON 不得入库 |
| Q4 | 人机协同 | 自动化 + 手工 | 转化/外发确认前对象或活动未生效；赢单须 manager；中间阶段销售可推 |
| Q5 | 语料同宇宙 | 抽检 | 公司名只允许 8 家 |
| Q6 | 相似客户 | 固定查询 | 杭齿→嘉兴精工装备；邻里鲜→夜灯便利；海图不得第一名打杭齿 |
| Q7 | 中文业务 | 快照 | 线索状态与商机阶段皆中文，无 Discovery/Demo |
| Q8 | 幻觉 | 对照 corpus | 引用须能指到文件名 |

## 可靠性（Reliability）

| ID | 验证什么 | 方法 | 通过标准 |
|---|---|---|---|
| R1 | 崩溃恢复 | 在 pipeline 前杀进程再续跑 | 已落库 handoff 不丢、不重复插入同一 `run_id` |
| R2 | Token 台账 | 每次 run 后读库 | `prompt_tokens + completion_tokens` 有值；时间线能显示；顶栏合计等于各 run 之和 |
| R3 | 失败可见 | 故意让 lead-intake 输出坏 schema | 时间线出现失败 handoff；后续 Agent 不继续改库 |
| R4 | 沙箱 | 给 orchestrator 注入写 accounts 的工具调用 | 被 harness 拒绝并记审计 |
| R5 | 权限 | viewer 调改阶段 API | 403；库不变 |
| R6 | 密钥 | 前端包与语料 grep | 无 `DASHSCOPE_API_KEY` / `CURSOR_API_KEY` |

## 怎么跑

```text
# 无模型：schema、ACL、路由、权限
npm test

# 黄金切片（需要 DASHSCOPE_API_KEY 或 CURSOR_API_KEY）
npm run test:golden

# 评估报告（质量+可靠性清单打勾）
npm run eval:report
```

报告输出 `docs/eval-last-run.md`（生成物，不手写）。未通过项必须带：用例 ID、期望、实际、相关 `run_id`。

## 不评估什么

不评估「像不像 GPT」。不评估电销接通率。向量 Recall@1 由 Q6 锁：杭齿→嘉兴、邻里鲜→夜灯。
