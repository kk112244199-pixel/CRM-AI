# 转化与阶段闸门

Harness 执行写入；Agent 只输出建议。与 `packages/domain/src/acl.ts` 一致。

## 确认转化前

库中不应有该线索的 account、contact、opportunity。handoff 为待确认。

## 确认转化后

三条一起落地。stage 初始只能是 `需求确认`。随后才允许 followup 起草活动。

## 中间阶段

目标若为 `需求确认`、`方案报价`、`谈判`：直接改 `opportunities.stage`，handoff 已生效。不要每次都找经理。

## 赢单 / 丢单

生成待确认，`proposed_stage` 为 `赢单` 或 `丢单`。角色不是 manager 时确认必须被拒绝，库不变。

## 中止

只清后续排队，已落库 handoff 不改写。
