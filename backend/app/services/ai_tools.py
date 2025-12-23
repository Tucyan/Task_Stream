from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update
from app.services import crud, ai_config_service
from app.services.ai_output_manager import OutputManager
from app.schemas import schemas
from app.models import models
import datetime
import json
import time

async def get_ai_tools(output_manager: OutputManager, user_id: int, db: AsyncSession):
    """
    获取AI工具列表，包含任务管理、长期任务管理、日记管理和备忘录管理工具
    
    参数:
        output_manager: 输出管理器，用于发送卡片和获取用户确认
        user_id: 用户ID，用于标识操作的用户
        db: 数据库会话，用于数据库操作
    
    返回:
        List[StructuredTool]: AI工具列表
    """
    
    async def check_auto_confirm(action_type: str) -> bool:
        """
        检查用户是否开启了自动确认功能
        
        参数:
            action_type: 操作类型，可选值为 'create', 'update', 'delete'
        
        返回:
            bool: 如果开启了自动确认则返回True，否则返回False
        """
        config = await ai_config_service.get_ai_config(db, user_id)
        if not config: return False
        if action_type == 'create':
            return bool(config.is_auto_confirm_create_request)
        elif action_type == 'update':
            return bool(config.is_auto_confirm_update_request)
        elif action_type == 'delete':
            return bool(config.is_auto_confirm_delete_request)
        return False
    
    async def check_auto_confirm_reminder() -> bool:
        config = await ai_config_service.get_ai_config(db, user_id)
        if not config:
            return False
        return bool(config.is_auto_confirm_create_reminder)
    
    def _now_ts():
        return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    
    def _log(layer: str, message: str, **fields):
        payload = ""
        if fields:
            try:
                payload = " " + json.dumps(fields, ensure_ascii=False, default=str)
            except Exception:
                payload = " " + str(fields)
        print(f"[TS][{layer}] {_now_ts()} {message}{payload}")
    
    def _wrap_tool(tool_name: str, fn):
        async def wrapped(**kwargs):
            start = time.perf_counter()
            _log("ai_tools.tool", "call.start", tool=tool_name, user_id=user_id, dialogue_id=getattr(output_manager, "_trace_dialogue_id", None), args=kwargs)
            try:
                result = await fn(**kwargs)
                return result
            finally:
                cost_ms = int((time.perf_counter() - start) * 1000)
                _log("ai_tools.tool", "call.end", tool=tool_name, cost_ms=cost_ms)
        return wrapped

    # --- 工具定义 ---

    # 1. 任务管理
    class CreateTaskInput(BaseModel):
        title: str = Field(..., description="任务标题(必填项)")
        description: Optional[str] = Field(None, description="任务描述")
        due_date: Optional[str] = Field(None, description="截止日期 YYYY-MM-DD HH:MM(用户未提及你不需要填写)")
        assigned_date: Optional[str] = Field(None, description="分配日期 YYYY-MM-DD")
        
        assigned_start_time: Optional[str] = Field(None, description="开始时间 HH:MM")
        assigned_end_time: Optional[str] = Field(None, description="结束时间 HH:MM")
        tags: Optional[List[str]] = Field(None, description="标签列表")
        record_result: Optional[bool] = Field(False, description="是否记录结果")
        result: Optional[str] = Field("", description="任务结果")
        result_picture_url: Optional[List[str]] = Field(None, description="结果图片URL列表")
        long_term_task_id: Optional[int] = Field(None, description="关联的长期任务ID")

    async def create_task(title: str, description: str = None, due_date: str = None, 
                         assigned_date: str = None,
                         assigned_start_time: str = None, assigned_end_time: str = None,
                         tags: List[str] = None, record_result: bool = False,
                         result: str = "", result_picture_url: List[str] = None,
                         long_term_task_id: int = None):
        """创建新任务"""
        effective_assigned_date = assigned_date or datetime.datetime.now().strftime("%Y-%m-%d")
        
        auto_confirm = await check_auto_confirm('create')
        _log("ai_tools.create_task", "auto_confirm", auto_confirm=auto_confirm)
        
        card_data = {
            "type": 1,
            "data": {
                "title": title,
                "description": description,
                "due_date": due_date,
                "assigned_date": effective_assigned_date,
                "assigned_start_time": assigned_start_time,
                "assigned_end_time": assigned_end_time,
                "tags": tags if tags is not None else [],
                "record_result": record_result,
                "result": result,
                "result_picture_url": result_picture_url if result_picture_url is not None else [],
                "long_term_task_id": long_term_task_id
            }
        }
        
        _log("ai_tools.create_task", "card.send", need_confirm=not auto_confirm)
        confirmed = await output_manager.send_card(card_data, need_confirm=not auto_confirm)
        _log("ai_tools.create_task", "card.confirmed", confirmed=confirmed)
        
        if confirmed:
            try:
                crud_started = time.perf_counter()
                _log("ai_tools.create_task", "crud.create_task.start")
                task_in = schemas.TaskCreate(
                    user_id=user_id,
                    title=title,
                    description=description,
                    status=1,
                    due_date=due_date,
                    assigned_date=effective_assigned_date,
                    assigned_start_time=assigned_start_time,
                    assigned_end_time=assigned_end_time,
                    tags=tags if tags is not None else [],
                    record_result=record_result,
                    result=result,
                    result_picture_url=result_picture_url if result_picture_url is not None else [],
                    long_term_task_id=long_term_task_id
                )
                new_task = await crud.create_task(task_in, db)
                _log("ai_tools.create_task", "crud.create_task.end", cost_ms=int((time.perf_counter() - crud_started) * 1000), task_id=new_task.id)
                return f"任务已创建，ID: {new_task.id}"
            except Exception as e:
                _log("ai_tools.create_task", "crud.create_task.error", err=str(e))
                return f"创建任务失败: {str(e)}"
        _log("ai_tools.create_task", "cancelled")
        return "用户取消了创建任务"

    class DeleteTaskInput(BaseModel):
        task_id: int = Field(..., description="要删除的任务ID")

    async def delete_task(task_id: int):
        """删除指定ID的任务"""
        task = await crud.get_task_by_id(task_id, db)
        if not task:
            _log("ai_tools.delete_task", "task.not_found", task_id=task_id)
            return f"任务 {task_id} 不存在"
            
        auto_confirm = await check_auto_confirm('delete')
        _log("ai_tools.delete_task", "auto_confirm", auto_confirm=auto_confirm)
        
        card_data = {
            "type": 2, # 使用类型 2 进行删除确认（或通用确认）
            "data": {
                "title": f"确认删除任务: {task.title}",
                "description": f"ID: {task_id}",
                "task_id": task_id
            }
        }
        
        _log("ai_tools.delete_task", "card.send", need_confirm=not auto_confirm, task_id=task_id)
        confirmed = await output_manager.send_card(card_data, need_confirm=not auto_confirm)
        _log("ai_tools.delete_task", "card.confirmed", confirmed=confirmed, task_id=task_id)
        
        if confirmed:
            crud_started = time.perf_counter()
            success = await crud.delete_task(task_id, db)
            if success:
                _log("ai_tools.delete_task", "crud.delete_task.ok", cost_ms=int((time.perf_counter() - crud_started) * 1000), task_id=task_id)
                return f"任务 {task_id} 已删除"
            _log("ai_tools.delete_task", "crud.delete_task.failed", cost_ms=int((time.perf_counter() - crud_started) * 1000), task_id=task_id)
            return f"任务 {task_id} 删除失败"
        _log("ai_tools.delete_task", "cancelled", task_id=task_id)
        return "用户取消了删除操作"

    class UpdateTaskInput(BaseModel):
        task_id: int = Field(..., description="任务ID")
        title: Optional[str] = Field(None, description="新标题")
        description: Optional[str] = Field(None, description="新描述")
        status: Optional[int] = Field(None, description="新状态 (1:待办, 3:完成)")
        due_date: Optional[str] = Field(None, description="新截止日期 YYYY-MM-DD HH:MM")
        assigned_date: Optional[str] = Field(None, description="新分配日期 YYYY-MM-DD")
        assigned_start_time: Optional[str] = Field(None, description="新开始时间 HH:MM")
        assigned_end_time: Optional[str] = Field(None, description="新结束时间 HH:MM")
        tags: Optional[List[str]] = Field(None, description="新标签列表")
        record_result: Optional[bool] = Field(None, description="是否记录结果")
        result: Optional[str] = Field(None, description="任务结果")
        result_picture_url: Optional[List[str]] = Field(None, description="结果图片URL列表")
        long_term_task_id: Optional[int] = Field(None, description="关联的长期任务ID")

    async def update_task(task_id: int, title: str = None, description: str = None, status: int = None, 
                         due_date: str = None, assigned_date: str = None, assigned_start_time: str = None, assigned_end_time: str = None,
                         tags: List[str] = None, record_result: bool = None, result: str = None,
                         result_picture_url: List[str] = None, long_term_task_id: int = None):
        """更新任务信息"""
        task = await crud.get_task_by_id(task_id, db)
        if not task:
            return f"任务 {task_id} 不存在"
        
        # 构造更新对象，如果未提供则保留现有值
        updated_data = task.dict()
        if title is not None: updated_data['title'] = title
        if description is not None: updated_data['description'] = description
        if status is not None: updated_data['status'] = status
        if due_date is not None: updated_data['due_date'] = due_date
        if assigned_date is not None: updated_data['assigned_date'] = assigned_date
        if assigned_start_time is not None: updated_data['assigned_start_time'] = assigned_start_time
        if assigned_end_time is not None: updated_data['assigned_end_time'] = assigned_end_time
        if tags is not None: updated_data['tags'] = tags
        if record_result is not None: updated_data['record_result'] = record_result
        if result is not None: updated_data['result'] = result
        if result_picture_url is not None: updated_data['result_picture_url'] = result_picture_url
        if long_term_task_id is not None: updated_data['long_term_task_id'] = long_term_task_id
        
        # 为更新创建 schema 对象
        try:
            task_update = schemas.Task(**updated_data)
        except Exception as e:
            return f"更新数据无效: {str(e)}"

        card_data = {
            "type": 3, # 更新确认
            "data": {
                "original": task.dict(),
                "updated": updated_data
            }
        }
        
        confirmed = await output_manager.send_card(card_data, need_confirm=not await check_auto_confirm('update'))
        
        if confirmed:
            success = await crud.update_task(task_id, task_update, db)
            if success:
                return f"任务 {task_id} 已更新"
            return f"任务 {task_id} 更新失败"
        return "用户取消了更新操作"

    class GetTasksInput(BaseModel):
        start_date: str = Field(..., description="开始日期 YYYY-MM-DD")
        end_date: str = Field(..., description="结束日期 YYYY-MM-DD")

    async def get_tasks(start_date: str, end_date: str):
        """获取指定日期范围内的任务列表"""
        tasks = await crud.get_tasks_in_date_range(start_date, end_date, user_id, db)
        if not tasks:
            return "该时间段内没有任务"
        return str([{"id": t.id, "title": t.title, "due_date": t.due_date, "status": t.status} for t in tasks])

    class GetUrgentTasksInput(BaseModel):
        pass

    async def get_urgent_tasks():
        """获取急需处理的任务（有截止日期且未完成）"""
        tasks = await crud.get_urgent_tasks(user_id, db)
        if not tasks:
            return "没有急需处理的任务"
        return str(tasks)

    # 2. Long Term Task Management
    class CreateLongTermTaskInput(BaseModel):
        title: str = Field(..., description="长期任务标题")
        description: Optional[str] = Field(None, description="描述")
        start_date: Optional[str] = Field(None, description="开始日期 YYYY-MM-DD")
        due_date: Optional[str] = Field(None, description="截止日期 YYYY-MM-DD")
        sub_task_ids: Optional[dict] = Field(None, description="子任务ID及权重, 例如 {'1': 0.5, '2': 0.5}")

    async def create_long_term_task(title: str, description: str = None, start_date: str = None, 
                                  due_date: str = None, sub_task_ids: dict = None):
        """创建长期任务"""
        card_data = {
            "type": 4, # Long term task creation
            "data": {
                "title": title,
                "description": description,
                "start_date": start_date,
                "due_date": due_date,
                "sub_task_ids": sub_task_ids
            }
        }
        
        confirmed = await output_manager.send_card(card_data, need_confirm=not await check_auto_confirm('create'))
        
        if confirmed:
            try:
                lt_task = schemas.LongTermTaskCreate(
                    user_id=user_id,
                    title=title,
                    description=description,
                    start_date=start_date,
                    due_date=due_date,
                    sub_task_ids=sub_task_ids
                )
                new_lt = await crud.create_long_term_task(lt_task, db)
                return f"长期任务已创建，ID: {new_lt.id}"
            except Exception as e:
                return f"创建长期任务失败: {str(e)}"
        return "用户取消了操作"

    class DeleteLongTermTaskInput(BaseModel):
        task_id: int = Field(..., description="长期任务ID")

    async def delete_long_term_task(task_id: int):
        """删除长期任务"""
        lt = await crud.get_long_term_task_by_id(task_id, db)
        if not lt:
            return f"长期任务 {task_id} 不存在"

        card_data = {
            "type": 2,
            "data": {
                "title": f"确认删除长期任务: {lt.title}",
                "description": f"ID: {task_id}",
                "task_id": task_id
            }
        }
        
        confirmed = await output_manager.send_card(card_data, need_confirm=not await check_auto_confirm('delete'))
        
        if confirmed:
            success = await crud.delete_long_term_task(task_id, db)
            if success:
                return f"长期任务 {task_id} 已删除"
            return "删除失败"
        return "用户取消了操作"

    class UpdateLongTermTaskInput(BaseModel):
        task_id: int = Field(..., description="长期任务ID")
        title: Optional[str] = Field(None, description="新标题")
        description: Optional[str] = Field(None, description="新描述")
        start_date: Optional[str] = Field(None, description="新开始日期 YYYY-MM-DD")
        due_date: Optional[str] = Field(None, description="新截止日期 YYYY-MM-DD")
        sub_task_ids: Optional[dict] = Field(None, description="新子任务ID及权重, 例如 {'1': 0.5}")

    async def update_long_term_task(task_id: int, title: str = None, description: str = None, 
                                  start_date: str = None, due_date: str = None, 
                                   sub_task_ids: dict = None):
        """更新长期任务"""
        lt = await crud.get_long_term_task_by_id(task_id, db)
        if not lt:
            return f"长期任务 {task_id} 不存在"
        
        updated_data = lt.dict()
        if title is not None: updated_data['title'] = title
        if description is not None: updated_data['description'] = description
        if start_date is not None: updated_data['start_date'] = start_date
        if due_date is not None: updated_data['due_date'] = due_date
        if sub_task_ids is not None: updated_data['sub_task_ids'] = sub_task_ids
        
        try:
            lt_update = schemas.LongTermTask(**updated_data)
        except Exception as e:
            return f"更新数据无效: {str(e)}"
            
        card_data = {
            "type": 3, # 更新确认
            "data": {
                "original": lt.dict(),
                "updated": updated_data
            }
        }
        
        confirmed = await output_manager.send_card(card_data, need_confirm=not await check_auto_confirm('update'))
        
        if confirmed:
            # 同步更新子任务的关联状态
            if sub_task_ids is not None:
                try:
                    _log("ai_tools.update_long_term_task", "subtasks.sync.start", task_id=task_id)
                    # 1. 获取当前已关联的子任务
                    result = await db.execute(select(models.Task).filter(models.Task.long_term_task_id == task_id))
                    current_subtasks = result.scalars().all()
                    current_ids = {t.id for t in current_subtasks}
                    
                    # 2. 获取新的子任务ID集合
                    new_ids = set()
                    for k in sub_task_ids.keys():
                        try:
                            new_ids.add(int(k))
                        except (ValueError, TypeError):
                            continue
                            
                    # 3. 计算需要添加和移除的任务
                    to_add = new_ids - current_ids
                    to_remove = current_ids - new_ids
                    
                    _log("ai_tools.update_long_term_task", "subtasks.sync.diff", task_id=task_id, to_add=sorted(list(to_add)), to_remove=sorted(list(to_remove)))
                    
                    # 4. 关联新任务
                    for tid in to_add:
                        task = await crud.get_task_by_id(tid, db)
                        if task:
                            # 创建更新后的任务对象
                            # 注意：Pydantic v2使用 model_copy, v1使用 copy
                            updated_task_data = task.dict()
                            updated_task_data['long_term_task_id'] = task_id
                            task_update = schemas.Task(**updated_task_data)
                            await crud.update_task(tid, task_update, db)
                            
                    # 5. 解除旧任务关联
                    for tid in to_remove:
                        task = await crud.get_task_by_id(tid, db)
                        if task:
                            updated_task_data = task.dict()
                            updated_task_data['long_term_task_id'] = None
                            task_update = schemas.Task(**updated_task_data)
                            await crud.update_task(tid, task_update, db)
                            
                except Exception as e:
                    _log("ai_tools.update_long_term_task", "subtasks.sync.error", task_id=task_id, err=str(e))
                    # 继续执行长期任务本身的更新，不因同步失败而完全中断
            
            success = await crud.update_long_term_task(task_id, lt_update, db)
            if success:
                return f"长期任务 {task_id} 已更新"
            return "更新失败"
        return "用户取消了操作"

    class GetLongTermTasksInput(BaseModel):
        uncompleted_only: bool = Field(False, description="是否只获取未完成的任务")

    async def get_long_term_tasks(uncompleted_only: bool = False):
        """获取长期任务列表"""
        if uncompleted_only:
            tasks = await crud.get_all_uncompleted_long_term_tasks(user_id, db)
        else:
            tasks = await crud.get_all_long_term_tasks(user_id, db)
        
        if not tasks:
            return "没有找到长期任务"
        
        return str([{"id": t.id, "title": t.title, "progress": t.progress, "due_date": t.due_date} for t in tasks])

    # 3. Journal Management
    class UpdateJournalInput(BaseModel):
        date: str = Field(..., description="日期 YYYY-MM-DD")
        content: str = Field(..., description="新的日记内容")

    async def update_journal(date: str, content: str):
        """更新指定日期的日记内容"""
        old_journal = await crud.get_journal_by_date(date, user_id, db)
        before_content = old_journal.content if old_journal else ""
        
        card_data = {
            "type": 7,
            "data": {
                "before": {
                    "date": date,
                    "user_id": user_id,
                    "content": before_content
                },
                "after": {
                    "date": date,
                    "user_id": user_id,
                    "content": content
                }
            }
        }
        
        confirmed = await output_manager.send_card(card_data, need_confirm=not await check_auto_confirm('update'))
        
        if confirmed:
            await crud.update_journal_content(date, content, user_id, db)
            return "日记已更新"
        return "用户取消了日记更新"

    class GetJournalInput(BaseModel):
        date: str = Field(..., description="日期 YYYY-MM-DD")

    async def get_journal(date: str):
        """获取指定日期的日记"""
        journal = await crud.get_journal_by_date(date, user_id, db)
        if journal:
            return f"日期: {journal.date}\n内容: {journal.content}"
        return "该日期没有日记"

    class GetJournalsInDateRangeInput(BaseModel):
        start_date: str = Field(..., description="开始日期 YYYY-MM-DD")
        end_date: str = Field(..., description="结束日期 YYYY-MM-DD")

    async def get_journals_in_date_range(start_date: str, end_date: str):
        """获取指定日期范围内的所有日记"""
        journals = await crud.get_journals_in_date_range(start_date, end_date, user_id, db)
        if not journals:
            return "该时间段内没有日记"
        
        result_str = ""
        for j in journals:
            result_str += f"日期: {j.date}\n内容: {j.content}\n---\n"
        return result_str

    # 4. Memo Management (Read-only)
    class GetMemoInput(BaseModel):
        pass

    async def get_memo():
        """获取备忘录内容"""
        memo = await crud.get_memo(user_id, db)
        if memo:
            return f"备忘录内容: {memo.content}"
        return "备忘录为空"
    
    class AddReminderInput(BaseModel):
        type: str = Field(..., description="提醒类型: Message/Task/LongTermTask")
        time: str = Field(..., description="提醒时间 YYYY-MM-DD HH:MM")
        content: str = Field(..., description="提醒内容")
        task_id: Optional[int] = Field(None, description="任务ID(type为Task/LongTermTask时必填)")

    async def add_reminder(type: str, time: str, content: str, task_id: int = None):
        reminder = {"type": type, "time": time, "content": content}
        if task_id is not None:
            reminder["task_id"] = task_id

        card_data = {"type": 8, "data": reminder}
        confirmed = await output_manager.send_card(card_data, need_confirm=not await check_auto_confirm_reminder())
        if not confirmed:
            return "用户取消了提醒创建"
        try:
            new_list = await crud.add_reminder(user_id, reminder, db)
            return f"提醒已添加，共 {len(new_list)} 条"
        except Exception as e:
            return f"添加提醒失败: {str(e)}"

    class GetReminderListInput(BaseModel):
        pass

    async def get_reminder_list():
        import json
        reminders = await crud.get_reminder_list(user_id, db)
        return json.dumps(reminders, ensure_ascii=False)

    class UpdateReminderListInput(BaseModel):
        reminder_list: List[Dict[str, Any]] = Field(..., description="完整提醒列表(会自动校验并按time升序)")

    async def update_reminder_list(reminder_list: List[Dict[str, Any]]):
        card_data = {"type": 9, "data": {"reminder_list": reminder_list}}
        confirmed = await output_manager.send_card(card_data, need_confirm=not await check_auto_confirm('update'))
        if not confirmed:
            return "用户取消了提醒列表更新"
        try:
            new_list = await crud.update_reminder_list(user_id, reminder_list, db)
            return f"提醒列表已更新，共 {len(new_list)} 条"
        except Exception as e:
            return f"更新提醒列表失败: {str(e)}"

    tools: List[StructuredTool] = [
        StructuredTool.from_function(coroutine=_wrap_tool("create_task", create_task), name="create_task", description="创建新任务", args_schema=CreateTaskInput),
        StructuredTool.from_function(coroutine=_wrap_tool("delete_task", delete_task), name="delete_task", description="删除任务", args_schema=DeleteTaskInput),
        StructuredTool.from_function(coroutine=_wrap_tool("update_task", update_task), name="update_task", description="更新任务信息", args_schema=UpdateTaskInput),
        StructuredTool.from_function(coroutine=_wrap_tool("get_tasks", get_tasks), name="get_tasks", description="获取任务列表", args_schema=GetTasksInput),
        StructuredTool.from_function(coroutine=_wrap_tool("get_urgent_tasks", get_urgent_tasks), name="get_urgent_tasks", description="获取急需处理的任务", args_schema=GetUrgentTasksInput),
        
        StructuredTool.from_function(coroutine=_wrap_tool("create_long_term_task", create_long_term_task), name="create_long_term_task", description="创建长期任务", args_schema=CreateLongTermTaskInput),
        StructuredTool.from_function(coroutine=_wrap_tool("delete_long_term_task", delete_long_term_task), name="delete_long_term_task", description="删除长期任务", args_schema=DeleteLongTermTaskInput),
        StructuredTool.from_function(coroutine=_wrap_tool("update_long_term_task", update_long_term_task), name="update_long_term_task", description="更新长期任务", args_schema=UpdateLongTermTaskInput),
        StructuredTool.from_function(coroutine=_wrap_tool("get_long_term_tasks", get_long_term_tasks), name="get_long_term_tasks", description="获取长期任务列表", args_schema=GetLongTermTasksInput),
        
        StructuredTool.from_function(coroutine=_wrap_tool("update_journal", update_journal), name="update_journal", description="更新日记", args_schema=UpdateJournalInput),
        StructuredTool.from_function(coroutine=_wrap_tool("get_journal", get_journal), name="get_journal", description="获取指定日期的日记", args_schema=GetJournalInput),
        StructuredTool.from_function(coroutine=_wrap_tool("get_journals_in_date_range", get_journals_in_date_range), name="get_journals_in_date_range", description="获取指定日期范围内的日记", args_schema=GetJournalsInDateRangeInput),
        
        StructuredTool.from_function(coroutine=_wrap_tool("get_memo", get_memo), name="get_memo", description="获取备忘录内容", args_schema=GetMemoInput),
        
        StructuredTool.from_function(coroutine=_wrap_tool("add_reminder", add_reminder), name="add_reminder", description="新增一条提醒", args_schema=AddReminderInput),
        StructuredTool.from_function(coroutine=_wrap_tool("get_reminder_list", get_reminder_list), name="get_reminder_list", description="获取提醒列表(按time升序)", args_schema=GetReminderListInput),
        StructuredTool.from_function(coroutine=_wrap_tool("update_reminder_list", update_reminder_list), name="update_reminder_list", description="更新提醒列表(强校验+自动排序)", args_schema=UpdateReminderListInput),
    ]
    return tools
