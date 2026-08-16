---
name: followup-activity
description: Defines Hengce follow-up activity types and outbound confirmation. This skill should be used when drafting activities after convert, choosing 电话/企微/邮件/拜访, or setting effective=0 until 确认发出. When to use: followup agent after 转化已生效. Do not use to change opportunity stage or to convert leads.
---

# followup-activity

给跟进 Agent（followup）读。不是 Cursor `/` 技能。

## 类型

活动 `type` 只能是：`电话` | `企微` | `邮件` | `拜访`。必须带 type，禁止第五种。

## 外发闸门

- 草稿 `effective=0`，`hitl_kind=confirm-send`。
- **sales 确认发出后** 才 `effective=1`。确认前不算正式活动。
- 黄金切片用 `电话`。

## 禁止

- 改 `opportunities.stage`
- 写 accounts / contacts
- 在未转化线索上创建活动

字段说明见 [references/activity-types.md](references/activity-types.md)。
