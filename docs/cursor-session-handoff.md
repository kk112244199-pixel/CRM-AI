# Cursor 会话交接摘要（CRM Harness 多智能体平台）

> 新开对话时 `@docs/cursor-session-handoff.md` 即可续上。详细何时打哪个 `/` 以 [skill-timeline.md](./skill-timeline.md) 为准。

## 工作路径

- 项目根目录：`D:\peixun\ai面试项目（CRM）2`
- 不要用：`c:\测试\`

## 产品（已锁定）

产品名：**衡策销管平台**。卖方卖销售系统。8 家是客户。

流程：获客 → 系统分配（自动）→ 建档（自动）→ 销售确认转化（客户+联系人+商机）→ 跟进待确认发出 → 中间阶段销售自推 → 赢单/丢单经理批。报价/合同不做。

四个运行时 Agent 必须在时间线上分开：系统分配 / 建档 / 商机 / 跟进。`orchestrator` 不是销售同事。

文档入口：

- [PRD.md](./PRD.md)
- [tech-selection.md](./tech-selection.md)
- [eval.md](./eval.md)
- [engineering-standards.md](./engineering-standards.md)
- [skill-timeline.md](./skill-timeline.md)
- [frontend-demo.md](./frontend-demo.md)
- [contracts/S9.md](./contracts/S9.md)（当前硬上下文；并遵守此前契约）
- 根目录 [README.md](../README.md)

## 已完成 / 下一刀

| 步 | 状态 |
|---|---|
| S0、S1、M0、M0.5 | 已完成 |
| **M1 库 + 8 家语料** | **已完成** |
| S4 `runtime/agents` md | 已完成 |
| S5 `runtime/skills` md | 已完成 |
| **M2 / S6 `/sdk`** | **已完成** |
| **M3 / S7 真控制台** | **已完成** |
| **M4 Docker** | **已完成** |
| **M5 eval** | **已完成** |
| **M6 = S8 `/frontend-design`** | **已完成**（漏斗轨，只改 `apps/web`） |
| **S9 向量** | **已完成** |
| S10 | 未做（可选；需 git 远程） |

原型：`npm --prefix apps/web-demo run dev`。不要给 demo 接 API。真控制台：`npm --prefix apps/api start` 与 `npm --prefix apps/web run dev`。根目录复制 `.env.example` 为 `.env`，自己填 `DASHSCOPE_API_KEY` 后走千问。

## 开发层 Skills（`.cursor/skills/`）

| Skill | 本项目何时用 |
|---|---|
| `create-plan` | 已用于 S0、S9 |
| `orchestrate` | **仅 S10** 改本仓库代码，不是销售调度器 |
| `cursor-sdk` | 说明书；真跑 Agent 在 S6 打 `/sdk` |
| `agent-development` | S4 写 `runtime/agents` |
| `skill-development` | S5 写 `runtime/skills` |
| `frontend-design` | **仅 S8** 改 `apps/web`（已用） |

内置不用装：`/sdk`、`/create-subagent`、`/create-skill`。不要装 `harness-engineering-skills`。

## Skills 放置

- 项目：`.cursor/skills/<name>/SKILL.md`
- 全局：`~/.cursor/skills/`
- 禁止：`~/.cursor/skills-cursor/`

## 下一步（把这段贴进新对话）

```text
@docs/contracts/S9.md @docs/skill-timeline.md
S9 已交付。若有 git 远程与 CURSOR_API_KEY，才做 S10：
/orchestrate 给衡策销管平台加线索列表筛选（按阶段/未转化）与 CSV 导入，含测试与契约文件
不要改漏斗，不要给 web-demo 加 fetch。
```
