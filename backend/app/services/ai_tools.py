from langchain_core.tools import StructuredTool
from pydantic import BaseModel, Field
from typing import Optional, List
from sqlalchemy.orm import Session
from app.services import crud, ai_config_service
from app.services.ai_output_manager import OutputManager
from app.schemas import schemas
from app.models import models
import datetime

def get_ai_tools(output_manager: OutputManager, user_id: int, db: Session):
    """
    获取AI工具列表，包含任务管理、长期任务管理、日记管理和备忘录管理工具
    
    参数:
        output_manager: 输出管理器，用于发送卡片和获取用户确认
        user_id: 用户ID，用于标识操作的用户
        db: 数据库会话，用于数据库操作
    
    返回:
        List[StructuredTool]: AI工具列表
    """
    
    def check_auto_confirm(action_type: str) -> bool:
        """
        检查用户是否开启了自动确认功能
        
        参数:
            action_type: 操作类型，可选值为 'create', 'update', 'delete'
        
        返回:
            bool: 如果开启了自动确认则返回True，否则返回False
        """
        config = ai_config_service.get_ai_config(db, user_id)
        if not config: return False
        if action_type == 'create':
            return bool(config.is_auto_confirm_create_request)
        elif action_type == 'update':
            return bool(config.is_auto_confirm_update_request)
        elif action_type == 'delete':
            return bool(config.is_auto_confirm_delete_request)
        return False

    # --- Tools Definitions ---

    # 1. Task Management
    class CreateTaskInput(BaseModel):
        title: str = Field(..., description="任务标题(必填项)")
        description: Optional[str] = Field(None, description="任务描述")
        due_date: Optional[str] = Field(None, description="截止日期 YYYY-MM-DD HH:MM(用户未提及你不需要填写)")
        assigned_start_time: Optional[str] = Field(None, description="开始时间 HH:MM")
        assigned_end_time: Optional[str] = Field(None, description="结束时间 HH:MM")
        tags: Optional[List[str]] = Field(None, description="标签列表")
        record_result: Optional[bool] = Field(False, description="是否记录结果")
        result: Optional[str] = Field("", description="任务结果")
        result_picture_url: Optional[List[str]] = Field(None, description="结果图片URL列表")
        long_term_task_id: Optional[int] = Field(None, description="关联的长期任务ID")

    async def create_task(title: str, description: str = None, due_date: str = None, 
                         assigned_start_time: str = None, assigned_end_time: str = None,
                         tags: List[str] = None, record_result: bool = False,
                         result: str = "", result_picture_url: List[str] = None,
                         long_term_task_id: int = None):
        """创建新任务"""
        print(f"DEBUG: Tool create_task called. Title: {title}")
        card_data = {
            "type": 1,
            "data": {
                "title": title,
                "description": description,
                "due_date": due_date,
                "assigned_date": datetime.datetime.now().strftime("%Y-%m-%d"),
                "assigned_start_time": assigned_start_time,
                "assigned_end_time": assigned_end_time,
                "tags": tags if tags is not None else [],
                "record_result": record_result,
                "result": result,
                "result_picture_url": result_picture_url if result_picture_url is not None else [],
                "long_term_task_id": long_term_task_id
            }
        }
        
        print("DEBUG: Sending card for create_task...")
        confirmed = await output_manager.send_card(card_data, need_confirm=not check_auto_confirm('create'))
        print(f"DEBUG: Card confirmed? {confirmed}")
        
        if confirmed:
            try:
                print("DEBUG: Executing CRUD create_task...")
                task_in = schemas.TaskCreate(
                    user_id=user_id,
                    title=title,
                    description=description,
                    status=1,
                    due_date=due_date,
                    assigned_date=datetime.datetime.now().strftime("%Y-%m-%d"),
                    assigned_start_time=assigned_start_time,
                    assigned_end_time=assigned_end_time,
                    tags=tags if tags is not None else [],
                    record_result=record_result,
                    result=result,
                    result_picture_url=result_picture_url if result_picture_url is not None else [],
                    long_term_task_id=long_term_task_id
                )
                new_task = crud.create_task(task_in, db)
                print(f"DEBUG: Task created with ID: {new_task.id}")
                return f"任务已创建，ID: {new_task.id}"
            except Exception as e:
                print(f"DEBUG: Error creating task: {e}")
                return f"创建任务失败: {str(e)}"
        return "用户取消了创建任务"

    class DeleteTaskInput(BaseModel):
        task_id: int = Field(..., description="要删除的任务ID")

    async def delete_task(task_id: int):
        """删除指定ID的任务"""
        task = crud.get_task_by_id(task_id, db)
        if not task:
            return f"任务 {task_id} 不存在"
            
        card_data = {
            "type": 2, # Using type 2 for delete confirmation (or generic confirmation)
            "data": {
                "title": f"确认删除任务: {task.title}",
                "description": f"ID: {task_id}",
                "task_id": task_id
            }
        }
        
        confirmed = await output_manager.send_card(card_data, need_confirm=not check_auto_confirm('delete'))
        
        if confirmed:
            success = crud.delete_task(task_id, db)
            if success:
                return f"任务 {task_id} 已删除"
            return f"任务 {task_id} 删除失败"
        return "用户取消了删除操作"

    class UpdateTaskInput(BaseModel):
        task_id: int = Field(..., description="任务ID")
        title: Optional[str] = Field(None, description="新标题")
        description: Optional[str] = Field(None, description="新描述")
        status: Optional[int] = Field(None, description="新状态 (1:待办, 3:完成)")
        due_date: Optional[str] = Field(None, description="新截止日期 YYYY-MM-DD HH:MM")
        assigned_start_time: Optional[str] = Field(None, description="新开始时间 HH:MM")
        assigned_end_time: Optional[str] = Field(None, description="新结束时间 HH:MM")
        tags: Optional[List[str]] = Field(None, description="新标签列表")
        record_result: Optional[bool] = Field(None, description="是否记录结果")
        result: Optional[str] = Field(None, description="任务结果")
        result_picture_url: Optional[List[str]] = Field(None, description="结果图片URL列表")
        long_term_task_id: Optional[int] = Field(None, description="关联的长期任务ID")

    async def update_task(task_id: int, title: str = None, description: str = None, status: int = None, 
                         due_date: str = None, assigned_start_time: str = None, assigned_end_time: str = None,
                         tags: List[str] = None, record_result: bool = None, result: str = None,
                         result_picture_url: List[str] = None, long_term_task_id: int = None):
        """更新任务信息"""
        task = crud.get_task_by_id(task_id, db)
        if not task:
            return f"任务 {task_id} 不存在"
        
        # Construct update object preserving existing values if not provided
        updated_data = task.dict()
        if title is not None: updated_data['title'] = title
        if description is not None: updated_data['description'] = description
        if status is not None: updated_data['status'] = status
        if due_date is not None: updated_data['due_date'] = due_date
        if assigned_start_time is not None: updated_data['assigned_start_time'] = assigned_start_time
        if assigned_end_time is not None: updated_data['assigned_end_time'] = assigned_end_time
        if tags is not None: updated_data['tags'] = tags
        if record_result is not None: updated_data['record_result'] = record_result
        if result is not None: updated_data['result'] = result
        if result_picture_url is not None: updated_data['result_picture_url'] = result_picture_url
        if long_term_task_id is not None: updated_data['long_term_task_id'] = long_term_task_id
        
        # Create schema object for update
        try:
            task_update = schemas.Task(**updated_data)
        except Exception as e:
            return f"更新数据无效: {str(e)}"

        card_data = {
            "type": 3, # Update confirmation
            "data": {
                "original": task.dict(),
                "updated": updated_data
            }
        }
        
        confirmed = await output_manager.send_card(card_data, need_confirm=not check_auto_confirm('update'))
        
        if confirmed:
            success = crud.update_task(task_id, task_update, db)
            if success:
                return f"任务 {task_id} 已更新"
            return f"任务 {task_id} 更新失败"
        return "用户取消了更新操作"

    class GetTasksInput(BaseModel):
        start_date: str = Field(..., description="开始日期 YYYY-MM-DD")
        end_date: str = Field(..., description="结束日期 YYYY-MM-DD")

    async def get_tasks(start_date: str, end_date: str):
        """获取指定日期范围内的任务列表"""
        tasks = crud.get_tasks_in_date_range(start_date, end_date, user_id, db)
        if not tasks:
            return "该时间段内没有任务"
        return str([{"id": t.id, "title": t.title, "due_date": t.due_date, "status": t.status} for t in tasks])

    class GetUrgentTasksInput(BaseModel):
        pass

    async def get_urgent_tasks():
        """获取急需处理的任务（有截止日期且未完成）"""
        tasks = crud.get_urgent_tasks(user_id, db)
        if not tasks:
            return "没有急需处理的任务"
        return str(tasks)

    # 2. Long Term Task Management
    class CreateLongTermTaskInput(BaseModel):
        title: str = Field(..., description="长期任务标题")
        description: Optional[str] = Field(None, description="描述")
        start_date: Optional[str] = Field(None, description="开始日期 YYYY-MM-DD")
        due_date: Optional[str] = Field(None, description="截止日期 YYYY-MM-DD")
        progress: Optional[float] = Field(0.0, description="进度 (0.0-1.0)")
        sub_task_ids: Optional[dict] = Field(None, description="子任务ID及权重, 例如 {'1': 0.5, '2': 0.5}")

    async def create_long_term_task(title: str, description: str = None, start_date: str = None, 
                                  due_date: str = None, progress: float = 0.0, sub_task_ids: dict = None):
        """创建长期任务"""
        card_data = {
            "type": 4, # Long term task creation
            "data": {
                "title": title,
                "description": description,
                "start_date": start_date,
                "due_date": due_date,
                "progress": progress,
                "sub_task_ids": sub_task_ids
            }
        }
        
        confirmed = await output_manager.send_card(card_data, need_confirm=not check_auto_confirm('create'))
        
        if confirmed:
            try:
                lt_task = schemas.LongTermTaskCreate(
                    user_id=user_id,
                    title=title,
                    description=description,
                    start_date=start_date,
                    due_date=due_date,
                    progress=progress,
                    sub_task_ids=sub_task_ids
                )
                new_lt = crud.create_long_term_task(lt_task, db)
                return f"长期任务已创建，ID: {new_lt.id}"
            except Exception as e:
                return f"创建长期任务失败: {str(e)}"
        return "用户取消了操作"

    class DeleteLongTermTaskInput(BaseModel):
        task_id: int = Field(..., description="长期任务ID")

    async def delete_long_term_task(task_id: int):
        """删除长期任务"""
        lt = crud.get_long_term_task_by_id(task_id, db)
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
        
        confirmed = await output_manager.send_card(card_data, need_confirm=not check_auto_confirm('delete'))
        
        if confirmed:
            success = crud.delete_long_term_task(task_id, db)
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
        progress: Optional[float] = Field(None, description="新进度 (0.0-1.0)")
        sub_task_ids: Optional[dict] = Field(None, description="新子任务ID及权重, 例如 {'1': 0.5}")

    async def update_long_term_task(task_id: int, title: str = None, description: str = None, 
                                  start_date: str = None, due_date: str = None, 
                                  progress: float = None, sub_task_ids: dict = None):
        """更新长期任务"""
        lt = crud.get_long_term_task_by_id(task_id, db)
        if not lt:
            return f"长期任务 {task_id} 不存在"
        
        updated_data = lt.dict()
        if title is not None: updated_data['title'] = title
        if description is not None: updated_data['description'] = description
        if start_date is not None: updated_data['start_date'] = start_date
        if due_date is not None: updated_data['due_date'] = due_date
        if progress is not None: updated_data['progress'] = progress
        if sub_task_ids is not None: updated_data['sub_task_ids'] = sub_task_ids
        
        try:
            lt_update = schemas.LongTermTask(**updated_data)
        except Exception as e:
            return f"更新数据无效: {str(e)}"
            
        card_data = {
            "type": 3, 
            "data": {
                "original": lt.dict(),
                "updated": updated_data
            }
        }
        
        confirmed = await output_manager.send_card(card_data, need_confirm=not check_auto_confirm('update'))
        
        if confirmed:
            # 同步更新子任务的关联状态
            if sub_task_ids is not None:
                try:
                    print(f"DEBUG: Syncing subtasks for long_term_task {task_id}")
                    # 1. 获取当前已关联的子任务
                    current_subtasks = db.query(models.Task).filter(models.Task.long_term_task_id == task_id).all()
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
                    
                    print(f"DEBUG: Adding subtasks: {to_add}, Removing subtasks: {to_remove}")
                    
                    # 4. 关联新任务
                    for tid in to_add:
                        task = crud.get_task_by_id(tid, db)
                        if task:
                            # 创建更新后的任务对象
                            # 注意：Pydantic v2使用 model_copy, v1使用 copy
                            updated_task_data = task.dict()
                            updated_task_data['long_term_task_id'] = task_id
                            task_update = schemas.Task(**updated_task_data)
                            crud.update_task(tid, task_update, db)
                            
                    # 5. 解除旧任务关联
                    for tid in to_remove:
                        task = crud.get_task_by_id(tid, db)
                        if task:
                            updated_task_data = task.dict()
                            updated_task_data['long_term_task_id'] = None
                            task_update = schemas.Task(**updated_task_data)
                            crud.update_task(tid, task_update, db)
                            
                except Exception as e:
                    print(f"ERROR syncing subtasks: {e}")
                    # 继续执行长期任务本身的更新，不因同步失败而完全中断
            
            success = crud.update_long_term_task(task_id, lt_update, db)
            if success:
                return f"长期任务 {task_id} 已更新"
            return "更新失败"
        return "用户取消了操作"

    class GetLongTermTasksInput(BaseModel):
        uncompleted_only: bool = Field(False, description="是否只获取未完成的任务")

    async def get_long_term_tasks(uncompleted_only: bool = False):
        """获取长期任务列表"""
        if uncompleted_only:
            tasks = crud.get_all_uncompleted_long_term_tasks(user_id, db)
        else:
            tasks = crud.get_all_long_term_tasks(user_id, db)
        
        if not tasks:
            return "没有找到长期任务"
        
        return str([{"id": t.id, "title": t.title, "progress": t.progress, "due_date": t.due_date} for t in tasks])

    # 3. Journal Management
    class UpdateJournalInput(BaseModel):
        date: str = Field(..., description="日期 YYYY-MM-DD")
        content: str = Field(..., description="新的日记内容")

    async def update_journal(date: str, content: str):
        """更新指定日期的日记内容"""
        old_journal = crud.get_journal_by_date(date, user_id, db)
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
        
        confirmed = await output_manager.send_card(card_data, need_confirm=not check_auto_confirm('update'))
        
        if confirmed:
            crud.update_journal_content(date, content, user_id, db)
            return "日记已更新"
        return "用户取消了日记更新"

    class GetJournalInput(BaseModel):
        date: str = Field(..., description="日期 YYYY-MM-DD")

    async def get_journal(date: str):
        """获取指定日期的日记"""
        journal = crud.get_journal_by_date(date, user_id, db)
        if journal:
            return f"日期: {journal.date}\n内容: {journal.content}"
        return "该日期没有日记"

    class GetJournalsInDateRangeInput(BaseModel):
        start_date: str = Field(..., description="开始日期 YYYY-MM-DD")
        end_date: str = Field(..., description="结束日期 YYYY-MM-DD")

    async def get_journals_in_date_range(start_date: str, end_date: str):
        """获取指定日期范围内的所有日记"""
        journals = crud.get_journals_in_date_range(start_date, end_date, user_id, db)
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
        memo = crud.get_memo(user_id, db)
        if memo:
            return f"备忘录内容: {memo.content}"
        return "备忘录为空"

    return [
        StructuredTool.from_function(coroutine=create_task, name="create_task", description="创建新任务", args_schema=CreateTaskInput),
        StructuredTool.from_function(coroutine=delete_task, name="delete_task", description="删除任务", args_schema=DeleteTaskInput),
        StructuredTool.from_function(coroutine=update_task, name="update_task", description="更新任务信息", args_schema=UpdateTaskInput),
        StructuredTool.from_function(coroutine=get_tasks, name="get_tasks", description="获取任务列表", args_schema=GetTasksInput),
        StructuredTool.from_function(coroutine=get_urgent_tasks, name="get_urgent_tasks", description="获取急需处理的任务", args_schema=GetUrgentTasksInput),
        
        StructuredTool.from_function(coroutine=create_long_term_task, name="create_long_term_task", description="创建长期任务", args_schema=CreateLongTermTaskInput),
        StructuredTool.from_function(coroutine=delete_long_term_task, name="delete_long_term_task", description="删除长期任务", args_schema=DeleteLongTermTaskInput),
        StructuredTool.from_function(coroutine=update_long_term_task, name="update_long_term_task", description="更新长期任务", args_schema=UpdateLongTermTaskInput),
        StructuredTool.from_function(coroutine=get_long_term_tasks, name="get_long_term_tasks", description="获取长期任务列表", args_schema=GetLongTermTasksInput),
        
        StructuredTool.from_function(coroutine=update_journal, name="update_journal", description="更新日记", args_schema=UpdateJournalInput),
        StructuredTool.from_function(coroutine=get_journal, name="get_journal", description="获取指定日期的日记", args_schema=GetJournalInput),
        StructuredTool.from_function(coroutine=get_journals_in_date_range, name="get_journals_in_date_range", description="获取指定日期范围内的日记", args_schema=GetJournalsInDateRangeInput),
        
        StructuredTool.from_function(coroutine=get_memo, name="get_memo", description="获取备忘录内容", args_schema=GetMemoInput),
        
    ]
