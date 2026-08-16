# 衡策销管平台 · 最近一次 eval

<!-- 由 npm run eval:report 根据 vitest JSON 生成，不要手写改结论。 -->

生成时间：2026-08-16T18:05:28.464Z

表内各项均来自本次 vitest JSON。

## 本次 vitest

| 项 | 值 |
|---|---|
| 总用例 | 72 |
| 通过 | 72 |
| 失败 | 0 |
| 跳过/pending | 0 |
| vitest success | true |
| 已设置真模型密钥 | 是 |

Q/R 汇总：通过 15，未通过/缺失 0，跳过 0。

## 质量与可靠性

| ID | 验证 | 结果 | 依据（测试全名） |
|---|---|---|---|
| Q1 | 路由顺序（脚本切片） | 通过 | M2 顺序切片（无密钥） 橙果 ingest：分配、建档自动，转化待确认，无三对象，不拉跟进；M2 顺序切片（无密钥） 确认转化后才有三对象与跟进待发出；确认发出后电话生效 |
| Q1-golden | 路由顺序（真模型黄金切片） | 通过 | 黄金切片 真模型 橙果跑到转化待确认（真模型） |
| Q2 | 职责隔离 | 通过 | ACL 约定（M2 执行） 系统分配不得写客户三表；跟进不得写商机阶段表；ACL / 坏 JSON / 中止 orchestrator 写 accounts 被拒绝并记审计，不继续建档；ACL / 坏 JSON / 中止 建档不得写 stage，后续不跑商机；ACL / 坏 JSON / 中止 跟进不得改 opp.stage |
| Q3 | 结构化输出 | 通过 | Q3 JSON 抽出 JSON 对象；Q3 JSON 无 JSON 抛错；ACL / 坏 JSON / 中止 非法 JSON 失败可见，后续不改库 |
| Q4 | 人机协同 | 通过 | M3 HTTP 阶段与 R5 杭齿建议赢单须 manager 确认；M2 顺序切片（无密钥） 确认转化后才有三对象与跟进待发出；确认发出后电话生效；闸门与失败 拒绝转化不建客户也不跟进；闸门与失败 viewer 不能 ingest；销售不能确认赢单；闸门与失败 销售可自推谈判 |
| Q5 | 语料同宇宙 | 通过 | 语料同宇宙 Q5 八个目录各五类文件，能 grep 到八个公司全名，无 emoji |
| Q6 | 相似客户 | 通过 | searchSimilar Q6 杭齿精密机电第一名是嘉兴精工装备；searchSimilar Q6 海图进出口第一名不得是杭齿精密机电；searchSimilar Q6 邻里鲜超市第一名是夜灯便利 |
| Q7 | 中文业务 | 通过 | schema 与种子 八家名字一字不改；schema 与种子 其余七家各有客户+联系人+商机，阶段中文；schema 与种子 阶段按 PRD 落库 |
| Q8 | 幻觉（对照语料文件名） | 通过 | Q8 引用须能指到语料文件名 8 家 × 五类文件都在磁盘上；Q8 引用须能指到语料文件名 种子 documents.filename 能对上 corpus；Q8 引用须能指到语料文件名 真引用通过，幻觉文件名失败 |
| R1 | 崩溃恢复 | 通过 | R1 崩溃后续跑 pipeline 前杀掉后，已落库 handoff 不丢，run_id 不重复，从建档之后续跑 |
| R2 | Token 台账 | 通过 | M2 HTTP 顺序切片 POST /api/leads/ingest 顺序交卷到转化待确认，不并行跟进；M2 顺序切片（无密钥） Token 合计等于 agent_runs 之和且等于 token_ledger 之和 |
| R3 | 失败可见 | 通过 | ACL / 坏 JSON / 中止 建档不得写 stage，后续不跑商机；ACL / 坏 JSON / 中止 非法 JSON 失败可见，后续不改库 |
| R4 | 沙箱 | 通过 | ACL / 坏 JSON / 中止 orchestrator 写 accounts 被拒绝并记审计，不继续建档 |
| R5 | 权限 | 通过 | M3 HTTP 阶段与 R5 viewer 推进阶段 403，库不变 |
| R6 | 密钥 | 通过 | R6 前端包无密钥 apps/web 源码不含 DASHSCOPE_API_KEY、CURSOR_API_KEY、@cursor/sdk、Agent 端口；语料同宇宙 Q5 八个目录各五类文件，能 grep 到八个公司全名，无 emoji；SDK 形状与密钥隔离 web-demo 源码不含 SDK 与密钥 |

## 未通过项

未通过项必须带：用例 ID、期望、实际、相关 run_id。

无。


## 跳过

无。

## 不评估什么

不评估「像不像 GPT」。不评估电销接通率。向量 Recall@1 由 Q6 覆盖。
