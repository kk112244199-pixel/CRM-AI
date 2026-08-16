# runtime/skills

衡策销管 **运行时** 业务 skill（给 CRM Agent 读，不是 Cursor `/` 唤起）。

| 目录 | 给谁读 |
|---|---|
| `crm-domain/` | 对象字段与中文枚举 |
| `lead-pipeline/` | 转化与阶段闸门 |
| `followup-activity/` | 活动类型与外发确认 |

细节在各目录 `references/`。不要写进 `.cursor/skills`。
