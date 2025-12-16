# AI 模块接口文档

本文档描述了 Task Stream 项目中 AI 相关的后端接口定义。

**Base URL**: `/api/v1/ai`

## 1. 配置管理 (Config)

管理用户的 AI 设置，包括 API Key、模型选择、Prompt 设置等。

### 获取 AI 配置
*   **接口**: `GET /config/{user_id}`
*   **描述**: 获取指定用户的 AI 配置信息。如果不存在，会自动创建一个默认配置。
*   **参数**:
    *   `user_id` (路径参数): 用户 ID (int)
*   **响应**: `AIConfig` 对象
    ```json
    {
      "user_id": 1,
      "api_key": "...",
      "model": "qwen-flash",
      "prompt": "...",
      "character": "...",
      "long_term_memory": "...",
      "ai_dialogue_id_list": [],
      "is_enable_prompt": 0,
      "is_auto_confirm_create_request": 0,
      ...
    }
    ```

### 更新 AI 配置
*   **接口**: `PUT /config/{user_id}`
*   **描述**: 更新指定用户的 AI 配置。
*   **参数**:
    *   `user_id` (路径参数): 用户 ID (int)
    *   **Body**: `AIConfigUpdate` 对象 (JSON)
        ```json
        {
          "api_key": "new_key",
          "model": "gpt-4",
          "is_enable_prompt": 1
          // ... 其他可选字段
        }
        ```
*   **响应**: 更新后的 `AIConfig` 对象

---

## 2. 对话管理 (Dialogues)

管理 AI 对话历史。

### 获取对话列表
*   **接口**: `GET /dialogues`
*   **描述**: 获取指定用户的所有对话概要。
*   **参数**:
    *   `user_id` (查询参数): 用户 ID (int)
*   **响应**: 对话列表 `List[dict]`

### 获取特定对话详情
*   **接口**: `GET /dialogues/{dialogue_id}`
*   **描述**: 获取指定对话的完整消息历史。
*   **参数**:
    *   `dialogue_id` (路径参数): 对话 ID (int)
    *   `user_id` (查询参数): 用户 ID (int)
*   **响应**: `AiMessage` 对象
    ```json
    {
      "id": 1,
      "user_id": 1,
      "title": "对话标题",
      "messages": [
        [{"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}],
        ...
      ]
    }
    ```

### 创建新对话
*   **接口**: `POST /dialogues`
*   **描述**: 创建一个新的对话会话。
*   **Body**:
    ```json
    {
      "user_id": 1,
      "title": "可选标题"
    }
    ```
*   **响应**: 创建的对话对象

### 更新对话标题
*   **接口**: `PUT /dialogues/{dialogue_id}/title`
*   **描述**: 修改对话标题。
*   **Body**:
    ```json
    {
      "user_id": 1,
      "title": "新标题"
    }
    ```
*   **响应**: `{"success": True}`

### 删除对话
*   **接口**: `DELETE /dialogues/{dialogue_id}`
*   **描述**: 删除指定对话。
*   **参数**:
    *   `user_id` (查询参数): 用户 ID
*   **响应**: `{"success": True}`

---

## 3. 流式对话 (Stream Chat)

核心聊天接口，支持 Server-Sent Events (SSE) 流式输出。

### 发送消息并获取流式响应
*   **接口**: `POST /dialogues/{dialogue_id}/messages/stream`
*   **描述**: 用户发送消息，AI 返回流式响应（包括文本和操作卡片）。
*   **Body**:
    ```json
    {
      "user_id": 1,
      "content": "帮我创建一个明天早上9点的会议任务"
    }
    ```
*   **响应**: SSE 事件流 (Content-Type: `text/event-stream`)
    *   **Event Types**:
        *   `partial_text`: 文本片段（增量更新）
        *   `cards`: 结构化操作卡片（如创建任务、更新日记等）
        *   `error`: 错误信息

---

## 4. 操作确认 (Actions)

用于处理 AI 提出的需要用户确认的操作（如删除任务、修改数据）。

### 确认操作
*   **接口**: `POST /actions/{action_id}/confirm`
*   **描述**: 用户确认执行某个操作。
*   **响应**: `{"success": True}`

### 取消操作
*   **接口**: `POST /actions/{action_id}/cancel`
*   **描述**: 用户取消某个操作。
*   **响应**: `{"success": True}`

---

## 附录：卡片类型 (Card Types)

AI 返回的 `cards` 事件中包含不同类型的交互卡片：

*   **Type 1**: 创建任务 (Create Task)
*   **Type 2**: 删除/确认 (Delete / Confirm)
*   **Type 3**: 更新任务 (Update Task) - 显示变更前后的差异
*   **Type 4**: 创建长期任务 (Create Long Term Task)
*   **Type 7**: 更新日记 (Update Journal) - 显示日记内容的修改建议
