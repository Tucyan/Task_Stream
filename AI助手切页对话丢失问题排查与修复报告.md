# AI 助手切页对话丢失问题排查与修复报告

日期：2025-12-20

## 1. 背景与现象

在 `AI 助手` 页面发送消息后，如果用户立刻切换到其它页面，再切回 `AI 助手`：

- 对话内容会丢失（表现为空白/回到旧历史）
- 在对话流式输出过程中出现“需要用户确认”的卡片时，该问题更容易复现且更严重

涉及页面：

- 前端：`src/views/AiAssistantView.jsx`
- 后端：`backend/app/services/ai_output_manager.py`、`backend/app/services/ai_service.py`

## 2. 复现步骤

1. 进入 AI 助手页，选择任意对话或新建对话
2. 发送一条消息触发 AI 流式输出
3. 在流式输出过程中切换到其它页面（例如任务/设置）
4. 再切回 AI 助手页

变体（高概率复现）：

- 流式输出过程中出现“需要用户确认”的卡片（例如创建/删除/更新任务需要确认）
- 在卡片出现后立刻切走并等待几秒再切回

## 3. 影响范围

### 3.1 用户体验影响

- 用户认为对话内容“丢了”
- 对于需要确认的动作卡片，用户无法继续确认/取消，影响流程闭环

### 3.2 数据一致性影响

- 由于后端在“需要确认”时会阻塞等待，当前轮次的 assistant 输出可能尚未落库；前端若切页卸载导致本地状态丢失，会造成“前端看不到但后端也暂时没有”的空窗期

## 4. 原因分析（定位结论）

问题由两个层面叠加导致：

### 4.1 组件卸载导致本地状态丢失

`AiAssistantView` 通过条件渲染挂载在主内容区，切换视图会卸载组件，导致 `messages/currentDialogueId/isStreaming` 等 state 全部丢失。

- `src/components/MainContent.jsx:121-123`

### 4.2 “需要确认的卡片”导致后端暂不落库

当 Agent 调用工具且需要用户确认时，后端会在发送卡片后阻塞等待确认结果：

- `backend/app/services/ai_output_manager.py:128-178`

对话历史的写入发生在 Agent 执行完成之后：

- `backend/app/services/ai_service.py:201-217`

因此在等待确认期间，后端历史仍为“旧历史”，返回给前端的 `getDialogue` 无法包含当前轮次流式输出与卡片。

### 4.3 关键覆盖问题：缓存恢复后又被后端旧历史覆盖

前端在 `selectDialogue` 中会：

1) 先从 `sessionStorage` 读取缓存并恢复到 UI
2) 再请求后端历史并直接 `setMessages(backendHistory)`

当后端仍未落库（等待确认/超时）时，第 2 步拿到的是旧历史，从而覆盖第 1 步缓存恢复的内容，最终表现为“切回来会话丢失”。

## 5. 解决方案概述

本次采用“方案 1”（不依赖 `window.__xxx` 全局计时器）：

### 5.1 前端：对话恢复 + 本地缓存兜底 + 合并策略

- 记录并恢复 `lastDialogueId`，切回 AI 页自动选中上次对话
- 使用 `sessionStorage` 缓存 `messages`，在后端未落库期间优先用缓存恢复 UI
- 请求后端历史后采用“长度与确认状态合并”策略，避免后端旧历史覆盖缓存新内容

### 5.2 前端：离开 30s 自动拒绝（无需后台计时器常驻）

- 离开 AI 页时记录待确认 `action_id` 的 `leftAt` 到 `localStorage`
- 回到 AI 页时若 `now - leftAt >= 30s`，UI 直接标记为已拒绝（`user_confirmation='N'`），并最佳努力调用一次取消接口（404/timeout 视为已结束）

### 5.3 后端兜底：确认等待超时改为 30 秒

即使前端被杀死/不再运行，后端也会在 30 秒后自动拒绝，避免工具调用永久阻塞。

## 6. 关键实现点（代码级）

### 6.1 对话恢复与缓存

- 记录/读取 lastDialogueId：`src/views/AiAssistantView.jsx:46-49`、`src/views/AiAssistantView.jsx:191-200`
- messages 缓存写入（节流 + 卸载强制 flush）：`src/views/AiAssistantView.jsx:69-69`、`src/views/AiAssistantView.jsx:205-213`、`src/views/AiAssistantView.jsx:246-265`
- selectDialogue 先恢复缓存再对齐后端：`src/views/AiAssistantView.jsx:298-359`

### 6.2 防止“后端旧历史覆盖缓存新内容”

在 `selectDialogue` 获取 `backendReconciled` 后：

- 若后端历史长度 >= 缓存长度：采用后端（说明已落库或至少不落后）
- 否则：保留缓存，并把后端已经确定的 `user_confirmation(Y/N)` 合并到缓存（避免状态回退）

实现位置：

- `src/views/AiAssistantView.jsx:346-389`

### 6.3 pending actions 记录与超时拒绝

- 从 messages 提取待确认 action：`src/views/AiAssistantView.jsx:69-84`
- 离开时写入 `leftAt`：`src/views/AiAssistantView.jsx:145-161` + cleanup：`src/views/AiAssistantView.jsx:205-213`
- 回来时对话加载后执行超时判定、更新 UI、并尝试 cancel：`src/views/AiAssistantView.jsx:106-143`

### 6.4 CardItem 状态与 404/timeout 收敛

- CardItem 跟随 `user_confirmation` 更新状态：`src/views/AiAssistantView.jsx:922-937`
- confirm/cancel 遇到 `Action not found/timeout` 视为“已取消”：`src/views/AiAssistantView.jsx:1032-1041`

### 6.5 后端确认等待 30 秒兜底

- 默认等待超时改为 30：`backend/app/services/ai_output_manager.py:20`
- send_card 等待确认显式传入 30：`backend/app/services/ai_output_manager.py:173`

## 7. 数据结构与存储键

### 7.1 localStorage

- `taskStreamAi:lastDialogueId:<userId>`：记录最后打开的对话 id
- `taskStreamAi:pendingActions:<userId>`：记录待确认 action（`{ [actionId]: { dialogueId, leftAt|null } }`）

### 7.2 sessionStorage

- `taskStreamAi:cachedMessages:<userId>:<dialogueId>`：对话消息缓存，用于后端未落库时恢复 UI

## 8. 验证与结果

- `npm run build`：通过（用于验证前端构建无语法/类型问题）
- `pytest`：当前仓库无可执行测试用例（`no tests ran`）

关键回归验证场景：

1) 流式输出过程中切走再切回：对话不丢（缓存恢复）
2) 流式输出出现需要确认卡片后切走再切回：对话不丢（缓存恢复 + 防覆盖）
3) 切走超过 30 秒再切回：卡片显示已拒绝，并保证后端工具不会继续等待/执行

## 9. 风险与后续建议

- 当前“后端旧历史 vs 缓存”使用长度对比作为主判断，适用于本场景（后端未落库时历史会落后）；若未来引入“部分落库/多端同时操作”，建议改用更明确的 `turn_id`/`message_id` 进行合并。
- 若需更强一致性，可在后端实现“开始即写入占位 turn、结束再补全”，减少对前端缓存依赖。

