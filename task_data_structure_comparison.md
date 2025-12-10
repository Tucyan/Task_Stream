# 前端与后端任务数据结构对比

本文档记录了 Task Stream 项目中前端与后端任务数据结构的对应关系，以及清理“脏数据”后的最终状态。

## 1. 数据结构对比表

| 字段类别 | 前端字段名 (App.jsx / TaskModal.jsx) | 后端字段名 (schemas.Task) | 类型 (后端) | 描述 | 备注 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **标识符** | `id` | `id` | Integer | 任务唯一 ID | |
| | `userId` (部分组件) | `user_id` | Integer | 用户 ID | |
| | `long_term_task_id` | `long_term_task_id` | Integer | 关联长期任务 ID | 之前存在传递丢失问题，现已修复 |
| **基本信息** | `title` | `title` | String | 任务标题 | |
| | `desc` (展示用) / `description` (提交用) | `description` | String | 任务描述 | 前端展示时映射为 `desc`，提交时使用 `description` |
| | `tags` | `tags` | List[String] | 标签列表 | 前端需处理数组与字符串转换 |
| **时间相关** | `date` (展示用) / `assigned_date` (提交用) | `assigned_date` | String | 执行日期 | 格式 YYYY-MM-DD |
| | `startTime` (展示用) / `assigned_start_time` (提交用) | `assigned_start_time` | String | 开始时间 | 格式 HH:mm |
| | `endTime` (展示用) / `assigned_end_time` (提交用) | `assigned_end_time` | String | 结束时间 | 格式 HH:mm |
| | `dueDate` (部分) / `due_date` | `due_date` | String | 截止日期 | |
| | - | `created_at` | String | 创建时间 | 后端自动生成 |
| | - | `updated_at` | String | 更新时间 | 后端自动更新 |
| **状态与结果** | `completed` (Boolean) | `status` (Integer) | Integer | 任务状态 | 前端 `completed` 对应后端 `status=3` |
| | `recordResult` / `record_result` | `record_result` | Boolean | 是否需记录结果 | |
| | `result` | `result` | String | 任务执行结果 | |
| | - | `result_picture_url` | List[String] | 结果图片 URL | 目前前端暂未完全对接 |
| **已移除 (脏数据)** | `priority` | - | - | 优先级 | **已从前端代码中移除**。后端无此字段。 |

## 2. 数据映射逻辑 (App.jsx)

前端从后端接收数据时，进行了如下字段映射：

```javascript
const mapped = tasks.map(t => ({
    id: t.id,
    title: t.title,
    desc: t.description,           // 映射 description -> desc
    date: t.assigned_date,         // 映射 assigned_date -> date
    startTime: t.assigned_start_time, // 映射 assigned_start_time -> startTime
    endTime: t.assigned_end_time,     // 映射 assigned_end_time -> endTime
    tags: t.tags || [],
    long_term_task_id: t.long_term_task_id || t.longTermTaskId, // 确保 ID 传递，兼容性处理
    completed: t.status === 3      // 状态转换
}));
```

## 3. 清理报告

- **`priority` 字段**：
  - 发现前端 `HomeView.jsx` 和旧的 mock 数据中存在 `priority` 字段。
  - 后端 `Task` 模型中**不存在**该字段。
  - **处理结果**：已从 `HomeView.jsx` 的逻辑中移除对 `priority` 的依赖，并确认 `TaskModal.jsx` 提交的数据中不再包含此字段。

- **`long_term_task_id` 字段**：
  - 之前存在 `undefined` 问题。
  - **处理结果**：已在 `App.jsx` 的所有数据映射逻辑中显式添加该字段，并增加了 fallback 处理 (`t.long_term_task_id || t.longTermTaskId`)，确保数据在组件间正确传递。
