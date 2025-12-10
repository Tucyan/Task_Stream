# 问题解决报告：long_term_task_id 前端传递丢失问题

## 1. 问题描述
在 `DetailView.jsx` 组件中点击编辑任务按钮时，传递给后端或日志输出的 `task` 对象中，`long_term_task_id` 字段显示为 `undefined`。导致前端无法正确关联或更新长期任务的 ID 信息。

## 2. 排查过程

### 2.1 前端数据流追踪
通过自下而上的方式追踪数据来源：
1.  **DetailView.jsx**: 确认点击事件中 `task` 对象缺失该字段。
2.  **MainContent.jsx**: 确认 `DetailView` 接收的 `filteredDetailTasks` 属性来自父组件。
3.  **App.jsx**:
    *   `filteredDetailTasks` 是基于 `detailedTasks` 状态通过 `useMemo` 计算得出的。
    *   检查 `detailedTasks` 的生成逻辑，发现它是由 API 请求 (`getTasksInDateRange` 和 `getAllTasksForUser`) 返回的数据映射而来的。

### 2.2 数据映射逻辑检查
在 `App.jsx` 中，后端返回的原始 JSON 数据会被映射为前端使用的对象结构。
检查发现原始的映射逻辑可能存在遗漏或不稳定的情况：
```javascript
// 旧代码可能存在的隐患
const mapped = tasks.map(t => ({
    // ...其他字段
    long_term_task_id: t.long_term_task_id, // 如果后端字段名有细微差别或未返回，则为 undefined
    // ...
}));
```

### 2.3 后端数据结构确认
检查了后端 `schemas.py` 和 `models.py`，确认后端确实定义并返回了 `long_term_task_id` 字段。

## 3. 根本原因
`App.jsx` 中的数据映射逻辑不够健壮。虽然添加了字段映射，但为了防止后端字段命名风格（如驼峰命名 `longTermTaskId` vs 下划线命名 `long_term_task_id`）带来的不一致，或者映射逻辑未在所有数据获取路径（按日期筛选 vs 获取全部）中同步更新，导致数据丢失。

## 4. 解决方案

### 4.1 增强 App.jsx 数据映射
在 `App.jsx` 中，针对所有涉及任务列表获取的地方（`refreshTasks` 函数中的两个分支，以及 `useEffect` 中的两个分支，共 4 处），统一并增强了字段映射逻辑。

**修改后的代码：**
```javascript
const mapped = tasks.map(t => ({
    // ...
    tags: t.tags || [],
    // 增加容错机制，同时尝试读取下划线和驼峰命名格式
    long_term_task_id: t.long_term_task_id || t.longTermTaskId, 
    completed: t.status === 3
}));
```

### 4.2 添加调试日志
在关键数据处理节点添加了 `console.log`，打印 `raw API response`（原始 API 响应），以便在未来出现类似问题时，能第一时间确认是后端没发数据，还是前端没接住。

## 5. 验证结果
经过修复，前端在接收到后端数据后，能够稳定地提取 `long_term_task_id`。在 `DetailView.jsx` 的点击事件日志中，该字段已能正确显示具体的 ID 值，不再是 `undefined`。
