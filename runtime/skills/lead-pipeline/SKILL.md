---
name: lead-pipeline
description: Defines Hengce convert and stage-gate rules for the pipeline agent. This skill should be used when proposing 确认转化, advancing 需求确认/方案报价/谈判, or proposing 赢单/丢单. When to use: after 建档 has taken effect, or when a converted opportunity changes stage. Do not use for assigning owners, completing lead cards only, or drafting activities.
---

# lead-pipeline

给商机 Agent（pipeline）读。不是 Cursor `/` 技能。

## 转化

1. 只提出客户 + 联系人 + 商机草稿，`hitl_kind=confirm-convert`。
2. **sales 确认后** 才插入三张对象，商机阶段=`需求确认`，线索=`已转化`。
3. **拒绝转化**：不建三张对象，不进入跟进。

## 阶段闸门

- 需求确认 / 方案报价 / 谈判：销售自推，无需经理。
- 赢单 / 丢单：只出待确认，`hitl_kind=confirm-win-loss`，**仅 manager** 确认后改库。sales 点确认无效。

## 禁止

- 写 `activities`
- 确认前落三张对象
- 英文阶段名

逐步规则见 [references/gates.md](references/gates.md)。
