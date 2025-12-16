# Task Stream 新 AI 功能逻辑设计（不含首页智能欢迎）

> 本文档基于 `未完成的事项.md:76-181` 的需求与现有后端结构（`backend/app`），给出项目新的 AI 功能（不包括首页智能欢迎）的逻辑实现文字稿，包括：
> - LangChain 智能体（Agent）整体架构；
> - 后端接口路由与通信协议（REST + SSE）；
> - 工具调用与确认流程；
> - 前端状态机如何与这些接口协作；
> - 拟新增代码文件与目录结构（仅规划，不代表当前已创建）。

---

## 一、设计范围与角色

本设计仅覆盖「AI 助手」相关功能，不包含首页智能欢迎板块：

- 覆盖范围：
  - `AiAssistantView` 视图中的对话功能；
  - AI 对任务 / 长期任务 / 日志等数据的增删改查建议与执行；
  - AIConfig / AIAssistantMessage 表对应的后端逻辑。
- 不包含：
  - 首页智能欢迎词逻辑（见 `未完成的事项.md:190-213`）。

参与的新老角色（与 `未完成的事项.md:106-181` 一致）：

1. 前端渲染层：`AiAssistantView`，负责展示对话、驱动 UI 状态机、维护本地 `messages`；
2. 前后端通信层：HTTP + SSE，承载流式事件（tokens / 结构化卡片）；
3. 后端调用 LLM 模型层：基于 LangChain 构建的 Agent；
4. 后端中间层（Output Manager）：统一管理发往前端的输出流；
5. LLM 工具调用层：封装对现有任务 / 长期任务 / 日志等业务逻辑的调用，生成卡片 JSON；
6. 数据持久层：`AIAssistantMessage`、`AIConfig` 等表。

---

## 二、整体架构与调用链

一次完整的 AI 对话发起与处理流程如下：

1. 用户在 `AiAssistantView` 输入问题并点击发送；
2. 前端将本轮 user `ChatTurn` 追加到本地 `messages`，并通过 HTTP 请求触发后端流式接口；
3. 后端 AI 路由接收到请求后：
   - 从 `AIConfig` 中读取该用户的模型、api_key、prompt、性格等配置；
   - 构建 LangChain 的 Agent（含工具列表）；
   - 将当前会话历史（从 `AIAssistantMessage.messages` 读取）与用户最新提问一起传入 Agent；
4. Agent 以流式形式输出：
   - 文本 token 流（type=0）；
   - 工具调用请求（如 `create_task`、`update_task` 等）；
5. 工具调用层：
   - 将工具调用请求转为对现有业务逻辑的函数调用（直接调用 `crud` 而非通过 HTTP）；
   - 根据调用结果生成对应的卡片 JSON（type=1~7），并交给 Output Manager；
6. Output Manager：
   - 负责把文本 token 封装为 `partial_text` 事件；
   - 把卡片 JSON 封装为 `cards` 事件；
   - 按“先文本流，再卡片”的顺序通过 SSE 推送给前端；
7. 前端在状态机的驱动下：
   - 在 `StreamingText` 状态下渲染流式文本气泡；
   - 在 `WaitingForCards` 状态下渲染卡片（type=1~7），并处理确认 / 取消；
8. 本轮对话结束后：
   - 后端将新生成的 `ChatTurn[]` 追加写入对应 `AIAssistantMessage.messages`；
   - 更新该对话的 `timestamp`，并在 `AIConfig.ai_dialogue_id_list` 中维护对话顺序。

---

## 三、后端接口与路由设计（AI 专用）

AI 相关路由统一挂载在新的 `APIRouter` 下：

- 前缀：`/api/v1/ai`
- tag：`["ai"]`
- 建议定义位置：`backend/app/api/ai.py`（见后文目录结构规划）

### 3.1 会话管理路由（基于 AIAssistantMessage）

#### 3.1.1 获取用户对话列表

- 方法与路径：`GET /api/v1/ai/dialogues`
- 查询参数：
  - `user_id` `int` 当前用户 ID
- 返回：
  - 对话简要信息列表，按最近更新时间逆序：
    - `id` `int`
    - `title` `string`
    - `last_timestamp` `string`
- 用途：
  - `AiAssistantView` 左侧对话列表，用于展示历史会话标题。

#### 3.1.2 获取指定对话的完整 messages

- 方法与路径：`GET /api/v1/ai/dialogues/{dialogue_id}`
- 路径参数：
  - `dialogue_id` `int`，对应 `AIAssistantMessage.id`
- 查询参数：
  - `user_id` `int`，用于校验归属
- 返回：
  - `id` `int`
  - `user_id` `int`
  - `title` `string`
  - `timestamp` `string`
  - `messages` `ChatTurn[][]`（结构与《数据库定义文档》中的定义一致）
- 用途：
  - 前端进入某会话或切换会话时，从后端拉取完整消息历史，并按 `未完成的事项.md:85-104` 的规则静态渲染卡片。

#### 3.1.3 新建对话

- 方法与路径：`POST /api/v1/ai/dialogues`
- 请求体：
  - `user_id` `int`
  - `title` `string` 可选，不传则生成默认标题（如“新的对话”+日期）
- 行为：
  - 在 `AIAssistantMessage` 表中插入一条记录，`messages` 字段初始化为空数组 `[]`；
  - 将新对话 ID 追加到 `AIConfig.ai_dialogue_id_list` 中；
  - 返回新建对话对象（含 `id`）。

#### 3.1.4 更新对话标题

- 方法与路径：`PUT /api/v1/ai/dialogues/{dialogue_id}/title`
- 请求体：
  - `user_id` `int`
  - `title` `string`
- 行为：
  - 校验该对话是否属于该用户；
  - 更新 `AIAssistantMessage.title` 字段。

#### 3.1.5 删除对话

- 方法与路径：`DELETE /api/v1/ai/dialogues/{dialogue_id}`
- 查询参数：
  - `user_id` `int`
- 行为：
  - 删除或软删除 `AIAssistantMessage` 对应记录；
  - 从 `AIConfig.ai_dialogue_id_list` 中移除该 ID；
  - 返回 `{ success: true }`。

### 3.2 AIConfig 配置路由

#### 3.2.1 获取用户 AI 配置

- 方法与路径：`GET /api/v1/ai/config/{user_id}`
- 行为：
  - 从 `AIConfig` 表中读取该用户配置；
  - 若不存在，则返回默认配置（由写死在 Python 中的默认值 + .env 中读取的默认 api-key / model 组合而成）。
- 返回字段：
  - 与《数据库定义文档》中 `AIConfig` 表字段一致：
    - `api_key`、`model`、`prompt`、`character`、`long_term_memory`、各类自动确认开关、`reminder_list` 等。

#### 3.2.2 更新用户 AI 配置

- 方法与路径：`PUT /api/v1/ai/config/{user_id}`
- 请求体：
  - 可选字段：
    - `api_key`、`model`、`prompt`、`character`、`long_term_memory`
    - `is_enable_prompt`、`is_auto_confirm_create_request`、
      `is_auto_confirm_update_request`、`is_auto_confirm_delete_request`、
      `is_auto_confirm_create_reminder`
  - 一般不直接允许前端修改 `ai_dialogue_id_list`、`reminder_list`，由后端内部维护。
- 行为：
  - 若该用户尚无配置则创建，否则更新；
  - 返回最新配置。

### 3.3 AI 对话流式接口（SSE）

#### 3.3.1 发起一轮 AI 对话（流式）

- 方法与路径：`POST /api/v1/ai/dialogues/{dialogue_id}/messages/stream`
- 路径参数：
  - `dialogue_id` `int`
- 请求体：
  - `user_id` `int`
  - `content` `string` 用户提问文本
  - `client_message_id` `string` 可选，用于前端幂等处理
- 响应类型：
  - `text/event-stream`（SSE）
- SSE 事件类型与数据结构：

1. `start`
   - `data: { "dialogue_id": 1, "client_message_id": "xxx" }`
   - 表示本轮对话开始，前端切换到 `StreamingText` 状态并创建空的 assistant 气泡。
2. `partial_text`
   - `data: { "content": "当前增量文本", "delta": "本次新增的 token", "finished": false }`
   - 对应 `type = 0` 文本流，前端在 `StreamingText` 状态下不断追加到当前 assistant 气泡中。
3. `text_done`
   - `data: { "content": "完整文本内容" }`
   - 文本流结束，前端从 `StreamingText` 切换为 `WaitingForCards`，准备接收卡片。
4. `cards`
   - `data: { "cards": [ /* 数组，元素结构与 messages 中的卡片对象完全一致 */ ] }`
   - 数组中每个元素格式示例：
     - `{"type": 1, "data": { ... }}` 新建任务卡片；
     - `{"type": 3, "data": { "before": {...}, "after": {...} }}` diff 任务卡片；
     - `{"type": 7, "data": { "before": {...}, "after": {...} }}` 日志修改卡片（与《数据库定义文档》的定义一致）。
5. `error`
   - `data: { "message": "错误描述" }`
   - 发生异常时发送，前端切换为 `Error` 状态。
6. `end`
   - `data: { "dialogue_id": 1 }`
   - 本轮对话完全结束（文本 + 卡片均已发送），前端切换为 `Completed` 状态。

#### 3.3.2 非流式降级接口（可选）

为兼容不支持 SSE 的环境，可预留非流式接口：

- 方法与路径：`POST /api/v1/ai/dialogues/{dialogue_id}/messages`
- 请求体同上；
- 直接返回一个对象：

```json
{
  "assistant_turn": {
    "text": "完整文本内容",
    "cards": [ /* 卡片数组 */ ]
  }
}
```

前端在此模式下不使用状态机中的 `StreamingText`、`WaitingForCards`，而是一次性渲染结果。

### 3.4 用户确认 / 取消行为路由

为支持「AI 提出修改 / 删除等操作后，需要用户确认才能真正执行」的流程，需要引入“待确认动作”的概念：

#### 3.4.1 生成待确认动作

- 当工具层决定某个操作需要用户确认（根据 `AIConfig` 中的自动确认开关判断）时：
  - 不立即执行实际业务操作；
  - 在数据库中创建一条“待确认动作”记录（例如 `AIPendingAction` 表，字段包括：`id`、`user_id`、`dialogue_id`、`action_type`、`payload` 等）；
  - 在生成的卡片数据中附带 `action_id` 字段：

```json
{
  "type": 3,
  "data": {
    "before": { ... },
    "after": { ... },
    "action_id": 123
  }
}
```

#### 3.4.2 用户确认或取消接口

- 确认：
  - 方法与路径：`POST /api/v1/ai/actions/{action_id}/confirm`
  - 请求体：`{ "user_id": 1 }`
  - 行为：
    - 校验该动作属于该用户；
    - 根据 `action_type` 和 `payload` 调用对应业务逻辑（如调用 `crud.update_task` 或 `crud.delete_task`）；
    - 更新动作状态为“已执行”；
    - 可选：在对应对话中追加一条系统消息（如“已根据你的确认更新任务”）。
- 取消：
  - 方法与路径：`POST /api/v1/ai/actions/{action_id}/cancel`
  - 请求体：`{ "user_id": 1 }`
  - 行为：
    - 更新动作状态为“已取消”；
    - 可选：在对话中追加一条系统消息（如“已取消本次修改”）。

前端在渲染带有 `action_id` 的卡片时，点击“确定”或“取消”按钮即可调用上述接口。

---

### 3.1 初始化 Agent

```python
# backend/app/services/ai_agent.py

from langchain_openai import ChatOpenAI
from langchain.agents import create_agent
from app.core.config import settings # 假设从 env 读取

def init_agent(tools):
    # 使用 ChatOpenAI 初始化模型
    chat_model = ChatOpenAI(
        model="qwen-flash",  # 或从设置读取
        api_key=settings.OPENAI_API_KEY,
        base_url=settings.OPENAI_BASE_URL,
        streaming=True
    )

    # 创建 Agent
    # 注意：LangChain 1.0 具体 API 可能需要根据实际包版本微调，
    # 这里按用户要求的 create_agent 风格
    agent = create_agent(
        model=chat_model,
        tools=tools,
        system_prompt='You are a helpful assistant...' # 动态注入用户设置的 prompt
    )
    
    return agent
```

### 3.2 中间层 (OutputManager)

```python
# backend/app/services/ai_output_manager.py

import asyncio
from typing import Dict, Any

class OutputManager:
    def __init__(self):
        self.pending_actions: Dict[str, asyncio.Event] = {}
        self.action_results: Dict[str, bool] = {}
        self.queue = asyncio.Queue() # 用于存放 SSE 事件

    async def stream_text(self, text: str):
        # 推送 partial_text 事件
        await self.queue.put({"event": "partial_text", "data": {"content": text}})

    async def send_card(self, card_data: dict, need_confirm: bool) -> bool:
        import uuid
        action_id = str(uuid.uuid4())
        card_data["action_id"] = action_id # 注入 ID
        
        # 推送 cards 事件
        await self.queue.put({"event": "cards", "data": [card_data]})

        if not need_confirm:
            return True

        # 挂起等待
        event = asyncio.Event()
        self.pending_actions[action_id] = event
        
        try:
            # 等待前端调用 confirm/cancel 接口触发 event.set()
            # 可以设置超时时间
            await asyncio.wait_for(event.wait(), timeout=600) 
            return self.action_results.get(action_id, False)
        except asyncio.TimeoutError:
            return False
        finally:
            del self.pending_actions[action_id]
            self.action_results.pop(action_id, None)

    def resolve_action(self, action_id: str, confirmed: bool):
        if action_id in self.pending_actions:
            self.action_results[action_id] = confirmed
            self.pending_actions[action_id].set()
```

### 3.3 工具层实现

```python
# backend/app/services/ai_tools.py

from langchain.tools import tool
from app.services.ai_output_manager import OutputManager

# 注意：需要通过某种方式将当前的 output_manager 注入给 tool
# 或者使用 context var

@tool
def create_task_tool(title: str, time: str):
    """用于创建新任务的工具"""
    
    # 1. 构造卡片 JSON
    card_json = {
        "type": 1,
        "data": {
            "title": title,
            "time": time,
            # ...
        }
    }
    
    # 2. 获取当前的 manager (示例伪代码)
    manager = get_current_output_manager()
    
    # 3. 发送并等待确认
    # 检查用户配置
    auto_confirm = get_user_config().is_auto_confirm_create_request
    
    confirmed = await manager.send_card(card_json, need_confirm=not auto_confirm)
    
    # 4. 执行逻辑
    if confirmed:
        # 调用 CRUD
        new_task = crud.create_task(...)
        return f"任务已成功创建，ID: {new_task.id}"
    else:
        return "用户取消了任务创建请求"
```

---

## 五、Output Manager 与会话持久化

Output Manager 是后端中间层的具体实现，负责：

1. 统一出口：所有发往前端的 SSE 事件都由它发出；
2. 顺序控制：确保前端总是先收到完整的文本流，再收到卡片；
3. 状态收集：在一次对话完成后，能够还原为 `ChatTurn[]` 追加到 `AIAssistantMessage.messages`。

### 5.1 输出顺序控制

在一次请求中，Output Manager 维护内部缓冲区：

1. `current_text_buffer`：不断累积 `partial_text` 的内容；
2. `card_buffer`：在工具层返回卡片数据时将其追加到此处；
3. 当 Agent 结束本轮输出时：
   - 发送 `text_done` 事件（带完整文本内容）；
   - 发送 `cards` 事件（带完整卡片数组）；
   - 最后发送 `end` 事件。

### 5.2 会话持久化为 ChatTurn[]

一次完整的交互（用户提问 + AI 回复）在持久化时应形成一个 `ChatTurn[]`：

1. 用户侧：
   - 一条 `ChatTurn`：
     - `{ "role": "user", "content": "用户原始输入字符串" }`
2. AI 侧：
   - 若只有文本回复：
     - `{"role": "assistant", "content": "完整文本内容字符串" }`
   - 若有文本 + 卡片：
     - `{"role": "assistant", "content": [ { "type": 0, "data": { "content": "文本内容" } }, { "type": 1, "data": {...} }, ... ] }`

当本轮对话完成时：

1. 从 `current_text_buffer` 与 `card_buffer` 生成上述 `ChatTurn` 结构；
2. 读取数据库中该对话当前的 `messages`（`ChatTurn[][]`）；
3. 将 `[user_turn, assistant_turn]` 追加为外层数组中的一个元素；
4. 将整体结构重新 `JSON.stringify` 存回 `AIAssistantMessage.messages`。

---

## 六、前端通信与状态机实现要点

前端逻辑严格参照 `未完成的事项.md:85-181`，在此只补充与接口对接的关键点。

### 6.1 本地状态

1. `dialogues`: 当前用户的对话列表（来自 `GET /api/v1/ai/dialogues`）；
2. `currentDialogueId`: 当前激活的对话 ID；
3. `messages`: 当前对话的 `ChatTurn[][]`（来自 `GET /api/v1/ai/dialogues/{id}` + 本地追加）；
4. `uiState`: 会话级状态机：
   - `Idle` / `Sending` / `StreamingText` / `WaitingForCards` / `ToolRunning` / `Completed` / `Error`；
5. `streamController`: 与 SSE 连接相关的对象，用于在前端手动关闭连接。

### 6.2 与流式接口的交互

1. 用户发送问题时：
   - 将 `user` 的 `ChatTurn` 以本地形式追加到 `messages`；
   - 调用 `POST /api/v1/ai/dialogues/{dialogue_id}/messages/stream`，并建立 SSE 连接；
   - 状态从 `Idle` -> `Sending`。
2. 收到 `start` 事件：
   - 状态 `Sending` -> `StreamingText`；
   - 在 `messages` 中预先插入一个空的 assistant 气泡占位。
3. 收到 `partial_text` 事件：
   - 在 `StreamingText` 状态下，将 `delta` 或 `content` 追加到当前 assistant 气泡；
4. 收到 `text_done` 事件：
   - 状态 `StreamingText` -> `WaitingForCards`；
   - 完成文本气泡的渲染；
5. 收到 `cards` 事件：
   - 将卡片对象按顺序追加到当前轮对话对应的 assistant `content` 数组中（转换为 `type=0` 文本块与其他类型卡片的混合数组）；
   - 状态 `WaitingForCards` -> `Completed`；
6. 收到 `error` 事件：
   - 状态 -> `Error`；
   - 显示错误提示。

### 6.3 卡片的确认 / 取消行为

当卡片中包含 `action_id` 时：

1. 点击“确定”按钮：
   - 调用 `POST /api/v1/ai/actions/{action_id}/confirm`；
   - 如果需要追加新的对话内容，可以再次发起 AI 对话（例如“好的，已经帮你完成修改”）；
2. 点击“取消”按钮：
   - 调用 `POST /api/v1/ai/actions/{action_id}/cancel`；
   - 可以用本地 UI 更新（例如将删除列表卡片中该项标记为“已取消”）。

---

## 七、拟新增代码文件与目录结构（规划）

以下为在现有项目基础上拟新增的文件 / 目录结构，仅为设计规划，当前并未实际创建这些文件。

### 7.1 后端目录规划（FastAPI + LangChain）

在现有 `backend/app` 目录下新增：

```text
backend/app/
  api/
    __init__.py
    ai.py                      # AI 相关 FastAPI 路由，前缀 /api/v1/ai

  services/
    ai_agent.py                # 使用 LangChain 构建与调用 Agent 的逻辑
    ai_tools.py                # 定义所有可供 Agent 调用的工具函数
    ai_output_manager.py       # 实现 Output Manager，将 Agent 输出转换为 SSE 事件
    ai_config_service.py       # 操作 AIConfig / AIAssistantMessage / 待确认动作的服务层

  models/
    ai_models.py               # （可选）定义 AIPendingAction 等与 AI 相关的新 ORM 模型
```

说明：

- `api/ai.py`：
  - 实现本设计文档中 3.x 节所有 AI 相关路由。
- `services/ai_agent.py`：
  - 对 LangChain 的模型、提示词和 Agent 构建进行封装；
  - 提供一个入口函数，例如：`run_agent_stream(user_id, dialogue_id, user_input, output_manager)`。
- `services/ai_tools.py`：
  - 封装所有对任务 / 长期任务 / 日志等业务逻辑的调用，向 Agent 暴露为“工具”；
  - 将业务调用结果转换为卡片数据（type=1~7）。
- `services/ai_output_manager.py`：
  - 接收 LangChain 回调与工具层输出，维护文本缓冲和卡片缓冲；
  - 提供向 FastAPI SSE 响应写入事件的方法。
- `services/ai_config_service.py`：
  - 封装对 `AIConfig` 与 `AIAssistantMessage` 的读写操作；
  - 提供对 `ai_dialogue_id_list`、`reminder_list` 的维护函数；
  - 负责“待确认动作”（如 `AIPendingAction`）的创建、查询与状态更新。
- `models/ai_models.py`（可选）：
  - 若需要单独的 ORM 模型（例如 `AIPendingAction`），可在此定义，并在 `models/__init__.py` 中导出。

### 7.2 前端目录规划（React 侧 AI 逻辑）

在现有 `src` 目录下建议新增以下结构（同样仅为规划）：

```text
src/
  services/
    aiClient.js                # 封装 /api/v1/ai/* 路由请求与 SSE 建立逻辑

  hooks/
    useAiChatStream.js         # 管理 AI 会话状态机与流式事件处理

  components/ai/
    AiChatBubble.jsx           # 基础聊天气泡组件
    AiCardTaskCreate.jsx       # type=1 新建任务卡片组件
    AiCardLongTermTask.jsx     # type=2 长期任务卡片组件
    AiCardTaskDiff.jsx         # type=3 任务 diff 卡片组件
    AiCardLongTermDiff.jsx     # type=4 长期任务 diff 卡片组件
    AiCardDeleteList.jsx       # type=5 删除列表卡片组件
    AiCardReminder.jsx         # type=6 提醒卡片组件
    AiCardJournalDiff.jsx      # type=7 日志修改卡片组件
```

核心思想：

- 将“协议解析”与“UI 渲染”彻底解耦：
  - `aiClient.js` 负责处理 HTTP / SSE 协议，与后端路由交互；
  - `useAiChatStream.js` 负责将事件流转换为本地状态机变迁；
  - `components/ai/*` 只关心如何把某个 `type` 的卡片显示出来，不关心 Agent 或工具细节。

---

以上即为新的 AI 功能（不含首页智能欢迎）的整体逻辑实现文字设计、接口路由通信方案以及拟新增文件的目录结构规划。后续在具体编码阶段，可以以本设计为蓝本逐步实现各模块，并与《接口路由定义.md》及《数据库定义文档.md》保持一致。

