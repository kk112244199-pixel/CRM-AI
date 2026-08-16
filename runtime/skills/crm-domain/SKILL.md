---
name: crm-domain
description: Defines Hengce CRM object fields and Chinese enums for leads, accounts, contacts, and opportunities. This skill should be used when a CRM Agent reads or writes those objects, maps lead status 新线索 or 已转化, or names opportunity stages. When to use: lead-intake completing lead fields, pipeline drafting convert objects, or any tool that must not emit Discovery or Demo. Do not use for activity type or outbound send gates.
---

# crm-domain

给衡策销管运行时 Agent 读。不是 Cursor `/` 技能。

## 必记枚举

- 线索状态：`新线索` | `已转化`
- 商机阶段：`需求确认` | `方案报价` | `谈判` | `赢单` | `丢单`
- 禁止：Discovery、Demo，以及其它英文阶段名

转化前只有线索。确认转化后才同时有客户、联系人、商机。

## 谁用

- lead-intake：只改 `leads` 字段，保持 `新线索`
- pipeline：写 `accounts` / `contacts` / `opportunities`
- orchestrator / followup：读对象，不靠本 skill 扩写权限

## 细节

字段表、八家公司名见 [references/fields.md](references/fields.md)。
