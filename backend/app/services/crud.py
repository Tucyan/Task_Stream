import json
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from app.models import models
from app.schemas import schemas
from sqlalchemy import func
import calendar
from datetime import datetime

def create_task(task: schemas.TaskCreate, db: Session) -> schemas.Task:
    db_task = models.Task(
        user_id=task.user_id,
        title=task.title,
        description=task.description,
        status=task.status,
        due_date=task.due_date,
        created_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        updated_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        assigned_date=task.assigned_date,
        assigned_start_time=task.assigned_start_time,
        assigned_end_time=task.assigned_end_time,
        tags=json.dumps(task.tags),
        record_result=1 if task.record_result else 0,
        result=task.result,
        result_picture_url=json.dumps(task.result_picture_url),
        long_term_task_id=task.long_term_task_id
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    
    # 如果任务关联了长期任务，自动计算并更新长期任务的进度
    if db_task.long_term_task_id:
        update_long_term_task_progress(db_task.long_term_task_id, db)
    
    return map_task_to_schema(db_task)

def delete_task(task_id: int, db: Session) -> bool:
    db_task = db.query(models.Task).filter(models.Task.id == task_id).first()
    if not db_task:
        return False
    
    # 记录任务关联的长期任务ID，用于后续更新进度
    long_term_task_id = db_task.long_term_task_id
    
    db.delete(db_task)
    db.commit()
    
    # 如果任务关联了长期任务，自动计算并更新长期任务的进度
    if long_term_task_id:
        update_long_term_task_progress(long_term_task_id, db)
    
    return True

def create_long_term_task(task: schemas.LongTermTaskCreate, db: Session) -> schemas.LongTermTask:
    db_lt = models.LongTermTask(
        user_id=task.user_id,
        title=task.title,
        description=task.description,
        start_date=task.start_date,
        due_date=task.due_date,
        progress=task.progress,
        created_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        sub_task_ids=json.dumps(task.sub_task_ids) if task.sub_task_ids else "{}"
    )
    db.add(db_lt)
    db.commit()
    db.refresh(db_lt)
    return map_long_term_task_to_schema(db, db_lt)

def delete_long_term_task(task_id: int, db: Session) -> bool:
    db_lt = db.query(models.LongTermTask).filter(models.LongTermTask.id == task_id).first()
    if not db_lt:
        return False
    db.delete(db_lt)
    db.commit()
    return True

def map_task_to_schema(t: models.Task) -> schemas.Task:
    # 处理关联的长期任务
    long_term_task = None
    if hasattr(t, 'long_term_task') and t.long_term_task:
        # 创建一个简化的长期任务对象
        long_term_task = schemas.LongTermTask(
            id=t.long_term_task.id,
            user_id=t.long_term_task.user_id,
            title=t.long_term_task.title,
            description=t.long_term_task.description,
            start_date=t.long_term_task.start_date,
            due_date=t.long_term_task.due_date,
            progress=t.long_term_task.progress,
            created_at=t.long_term_task.created_at,
            sub_task_ids={}
        )
    
    return schemas.Task(
        id=t.id,
        user_id=t.user_id,
        title=t.title,
        description=t.description,
        status=t.status,
        due_date=t.due_date,
        created_at=t.created_at,
        updated_at=t.updated_at,
        assigned_date=t.assigned_date,
        assigned_start_time=t.assigned_start_time,
        assigned_end_time=t.assigned_end_time,
        tags=json.loads(t.tags) if t.tags else [],
        record_result=bool(t.record_result),
        result=t.result,
        result_picture_url=json.loads(t.result_picture_url) if t.result_picture_url else [],
        long_term_task_id=t.long_term_task_id,
        long_term_task=long_term_task
    )

def map_long_term_task_to_schema(db: Session, lt: models.LongTermTask) -> schemas.LongTermTask:
    # 处理新的数据格式: {"task_id": weight}
    # 添加错误处理，防止sub_task_ids为None或无效JSON
    try:
        sub_task_ids = json.loads(lt.sub_task_ids) if lt.sub_task_ids else {}
    except (json.JSONDecodeError, TypeError) as e:
        print(f"Error parsing sub_task_ids: {e}, lt.sub_task_ids: {lt.sub_task_ids}")
        sub_task_ids = {}
    
    # 确保是简单的键值对格式 {"task_id": weight}
    if not isinstance(sub_task_ids, dict):
        sub_task_ids = {}
    
    subtasks = []
    if sub_task_ids:
        task_ids = list(sub_task_ids.keys())
        tasks = db.query(models.Task).filter(models.Task.id.in_(task_ids)).all()
        subtasks = [map_task_to_schema(t) for t in tasks]
        
    return schemas.LongTermTask(
        id=lt.id,
        user_id=lt.user_id,
        title=lt.title,
        description=lt.description,
        start_date=lt.start_date,
        due_date=lt.due_date,
        progress=lt.progress,
        subtasks=subtasks,
        created_at=lt.created_at,
        sub_task_ids=sub_task_ids
    )

def get_task_by_id(task_id: int, db: Session) -> Optional[schemas.Task]:
    task = db.query(models.Task).options(
        joinedload(models.Task.long_term_task)
    ).filter(models.Task.id == task_id).first()
    if not task:
        return None
    return map_task_to_schema(task)

def get_tasks_in_date_range(start_date: str, end_date: str, user_id: int, db: Session) -> List[schemas.Task]:
    tasks = db.query(models.Task).options(
        joinedload(models.Task.long_term_task)
    ).filter(
        models.Task.user_id == user_id,
        models.Task.assigned_date >= start_date,
        models.Task.assigned_date <= end_date
    ).all()
    return [map_task_to_schema(t) for t in tasks]

def get_all_tasks_for_user(user_id: int, db: Session) -> List[schemas.Task]:
    tasks = db.query(models.Task).options(
        joinedload(models.Task.long_term_task)
    ).filter(models.Task.user_id == user_id).all()
    return [map_task_to_schema(t) for t in tasks]

def get_all_long_term_tasks(user_id: int, db: Session) -> List[schemas.LongTermTask]:
    lts = db.query(models.LongTermTask).filter(models.LongTermTask.user_id == user_id).all()
    return [map_long_term_task_to_schema(db, lt) for lt in lts]

def get_all_uncompleted_long_term_tasks(user_id: int, db: Session) -> List[schemas.LongTermTask]:
    lts = db.query(models.LongTermTask).filter(
        models.LongTermTask.user_id == user_id,
        models.LongTermTask.progress < 1.0
    ).order_by(models.LongTermTask.due_date).all()
    return [map_long_term_task_to_schema(db, lt) for lt in lts]

def update_task(task_id: int, updated_task: schemas.Task, db: Session) -> bool:
    print(f"CRUD: Updating task {task_id}")
    print(f"CRUD: Updated task data: {updated_task.dict()}")
    
    db_task = db.query(models.Task).options(
        joinedload(models.Task.long_term_task)
    ).filter(models.Task.id == task_id).first()
    if not db_task:
        print(f"CRUD: Task {task_id} not found")
        return False
    
    print(f"CRUD: Original task data: id={db_task.id}, title={db_task.title}, status={db_task.status}")
    
    # 记录原始状态和长期任务ID，用于后续计算进度
    original_status = db_task.status
    original_long_term_task_id = db_task.long_term_task_id
    
    db_task.title = updated_task.title
    db_task.description = updated_task.description
    db_task.status = updated_task.status
    db_task.due_date = updated_task.due_date
    db_task.updated_at = updated_task.updated_at
    db_task.assigned_date = updated_task.assigned_date
    db_task.assigned_start_time = updated_task.assigned_start_time
    db_task.assigned_end_time = updated_task.assigned_end_time
    db_task.tags = json.dumps(updated_task.tags)
    db_task.record_result = 1 if updated_task.record_result else 0
    db_task.result = updated_task.result
    db_task.result_picture_url = json.dumps(updated_task.result_picture_url)
    print(f"[[[[[Before update: long_term_task_id={db_task.long_term_task_id}")
    db_task.long_term_task_id = updated_task.long_term_task_id
    print(f"[[[[[After update: long_term_task_id={db_task.long_term_task_id}")
    print(f"[[[[[task_id: {task_id} title: {db_task.title}]")

    print(f"CRUD: Committing changes to database")
    db.commit()
    db.refresh(db_task)
    print(f"CRUD: Task updated successfully")
    
    # # 如果任务关联了长期任务，自动计算并更新长期任务的进度
    if db_task.long_term_task_id:
        update_long_term_task_progress(db_task.long_term_task_id, db)
    
    # # 如果任务原本关联了长期任务但现在取消了关联，也需要重新计算原长期任务的进度
    if original_long_term_task_id and original_long_term_task_id != db_task.long_term_task_id:
        update_long_term_task_progress(original_long_term_task_id, db)
    
    return True

def update_long_term_task(task_id: int, updated_task: schemas.LongTermTask, db: Session) -> bool:
    db_lt = db.query(models.LongTermTask).filter(models.LongTermTask.id == task_id).first()
    if not db_lt:
        return False
    
    # 添加日志以查看sub_task_ids的内容
    print(f"[crud.py] 更新长期任务，task_id: {task_id}")
    print(f"[crud.py] 更新前的sub_task_ids: {db_lt.sub_task_ids}")
    print(f"[crud.py] 更新前的sub_task_ids类型: {type(db_lt.sub_task_ids)}")
    
    # 获取更新后的sub_task_ids
    updated_sub_task_ids = None
    if hasattr(updated_task, 'sub_task_ids') and updated_task.sub_task_ids is not None:
        updated_sub_task_ids = updated_task.sub_task_ids
        print(f"[crud.py] 更新后的sub_task_ids: {updated_sub_task_ids}")
        print(f"[crud.py] 更新后的sub_task_ids类型: {type(updated_sub_task_ids)}")
        try:
            print(f"[crud.py] 更新后的sub_task_ids字符串: {str(updated_sub_task_ids)}")
        except Exception as e:
            print(f"[crud.py] 转换更新后的sub_task_ids为字符串时出错: {e}")
        
    db_lt.title = updated_task.title
    db_lt.description = updated_task.description
    db_lt.start_date = updated_task.start_date
    db_lt.due_date = updated_task.due_date
    db_lt.progress = updated_task.progress
    
    if updated_task.sub_task_ids is not None:
        # 新格式: {"task_id": weight}，直接保存
        final_sub_task_ids = json.dumps(updated_task.sub_task_ids)
        db_lt.sub_task_ids = final_sub_task_ids
        print(f"[crud.py] 最终保存的sub_task_ids: {final_sub_task_ids}")
    
    db.commit()
    
    # 更新子任务后，重新计算进度
    if updated_task.sub_task_ids is not None:
        update_long_term_task_progress(task_id, db)
    
    return True

def get_journal_by_date(date: str, user_id: int, db: Session) -> Optional[schemas.Journal]:
    journal = db.query(models.Journal).filter(models.Journal.date == date, models.Journal.user_id == user_id).first()
    if journal:
        return schemas.Journal(date=journal.date, user_id=journal.user_id, content=journal.content)
    return None

def update_journal_content(date: str, new_content: str, user_id: int, db: Session) -> bool:
    journal = db.query(models.Journal).filter(models.Journal.date == date, models.Journal.user_id == user_id).first()
    if journal:
        journal.content = new_content
    else:
        journal = models.Journal(date=date, user_id=user_id, content=new_content)
        db.add(journal)
    db.commit()
    return True

def get_heatmap_data(year: int, month: int, user_id: int, db: Session) -> List[int]:
    # 构造本月的起始日期
    start_date = f"{year}-{month:02d}-01"
    # 构造本月的结束日期（下个月的第一天）
    if month == 12:
        end_date = f"{year+1}-01-01"
    else:
        end_date = f"{year}-{month+1:02d}-01"
    
    # 查询本月属于该用户且状态为3的所有任务
    tasks = db.query(models.Task).filter(
        models.Task.user_id == user_id,
        models.Task.status == 3,
        models.Task.assigned_date >= start_date,
        models.Task.assigned_date < end_date
    ).all()
    
    # 获取本月天数，初始化每天任务完成数列表
    days_in_month = calendar.monthrange(year, month)[1]
    heatmap = [0] * days_in_month
    
    # 遍历任务，统计每一天的任务完成数
    for t in tasks:
        if t.assigned_date:
            try:
                day = int(t.assigned_date.split('-')[2])
                if 1 <= day <= days_in_month:
                    heatmap[day-1] += 1
            except:
                pass
    
    # 获取本月单日最大任务完成数
    max_count = max(heatmap) if heatmap else 0
    # 计算热力等级区间步长，最小为1
    step = max(1, max_count // 6) if max_count > 0 else 1
    # 构造长度为7的工具list，用于热力等级分区
    tool_list = [i * step for i in range(6)] + [max_count]
    
    # 根据工具list，把每天任务数映射到热力等级（0~6）
    def get_level(count):
        for idx, val in enumerate(tool_list):
            if count <= val:
                return idx
        return 6
    
    # 生成最终热力等级列表
    result = [get_level(x) for x in heatmap]
    return result

def get_journal_dates(year: int, month: int, user_id: int, db: Session) -> List[int]:
    # 构造本月的起始日期
    start_date = f"{year}-{month:02d}-01"
    # 构造本月的结束日期（下个月的第一天）
    if month == 12:
        end_date = f"{year+1}-01-01"
    else:
        end_date = f"{year}-{month+1:02d}-01"
    
    # 查询本月属于该用户的所有日志
    journals = db.query(models.Journal).filter(
        models.Journal.user_id == user_id,
        models.Journal.date >= start_date,
        models.Journal.date < end_date
    ).all()
    
    # 提取所有有日志的日期（日）
    journal_days = []
    for journal in journals:
        try:
            day = int(journal.date.split('-')[2])
            journal_days.append(day)
        except:
            pass
            
    return sorted(list(set(journal_days)))

def get_journal_status_list(year: int, month: int, user_id: int, db: Session) -> List[bool]:
    """
    获取指定用户指定月份的日志状态列表
    返回一个布尔列表，每个元素对应当月的一天，True表示有日志，False表示无日志
    """
    # 获取本月天数
    days_in_month = calendar.monthrange(year, month)[1]
    
    # 初始化状态列表，默认为False
    status_list = [False] * days_in_month
    
    # 构造本月的起始日期
    start_date = f"{year}-{month:02d}-01"
    # 构造本月的结束日期（下个月的第一天）
    if month == 12:
        end_date = f"{year+1}-01-01"
    else:
        end_date = f"{year}-{month+1:02d}-01"
    
    # 查询本月属于该用户的所有日志
    journals = db.query(models.Journal).filter(
        models.Journal.user_id == user_id,
        models.Journal.date >= start_date,
        models.Journal.date < end_date
    ).all()
    
    # 更新状态列表
    for journal in journals:
        try:
            day = int(journal.date.split('-')[2])
            if 1 <= day <= days_in_month:
                status_list[day-1] = True
        except:
            pass
            
    return status_list

def update_long_term_task_progress(long_term_task_id: int, db: Session) -> bool:
    """
    根据关联的子任务状态自动计算并更新长期任务的进度
    考虑每个子任务的权重/比例
    """
    print(f"CRUD: Updating progress for long-term task {long_term_task_id}")
    
    # 获取长期任务
    long_term_task = db.query(models.LongTermTask).filter(models.LongTermTask.id == long_term_task_id).first()
    if not long_term_task:
        print(f"CRUD: Long-term task {long_term_task_id} not found")
        return False
    
    # 获取所有关联的子任务
    subtasks = db.query(models.Task).filter(models.Task.long_term_task_id == long_term_task_id).all()
    
    if not subtasks:
        print(f"CRUD: No subtasks found for long-term task {long_term_task_id}")
        # 如果没有子任务，进度设为0
        long_term_task.progress = 0.0
        long_term_task.sub_task_ids = "{}"
    else:
        # 获取现有的子任务ID和权重信息
        existing_sub_task_ids = {}
        if long_term_task.sub_task_ids:
            try:
                existing_sub_task_ids = json.loads(long_term_task.sub_task_ids)
                # 确保是简单的键值对格式 {"task_id": weight}
                if not isinstance(existing_sub_task_ids, dict):
                    existing_sub_task_ids = {}
            except (json.JSONDecodeError, TypeError):
                existing_sub_task_ids = {}
        
        # 计算加权进度
        total_weight = 0.0
        completed_weight = 0.0
        
        # 更新sub_task_ids字典，记录每个子任务的权重
        sub_task_ids = {}
        for task in subtasks:
            task_id_str = str(task.id)
            # 获取子任务的权重，默认为1.0
            task_weight = float(existing_sub_task_ids.get(task_id_str, 1.0))
            
            # 根据任务状态计算完成的权重
            if task.status == 3:  # 已完成
                task_progress = 1.0
                completed_weight += task_weight
            elif task.status == 2:  # 进行中
                task_progress = 0.5
                completed_weight += task_weight * 0.5
            else:  # 未开始
                task_progress = 0.0
            
            total_weight += task_weight
            # 保存子任务的权重信息
            sub_task_ids[task_id_str] = task_weight
        
        # 计算加权进度
        # 根据权重总和决定计算方式
        if total_weight <= 1.0:
            # 如果子任务权重总和小于等于1.0，子任务完成后直接计入子任务权重到progress中
            progress = completed_weight
        else:
            # 如果子任务权重总和大于1.0，progress为(已完成子任务的权重总和)/(全部的子任务权重总和)
            progress = completed_weight / total_weight if total_weight > 0 else 0.0
        
        # 更新长期任务的进度和子任务ID字典
        long_term_task.progress = progress
        long_term_task.sub_task_ids = json.dumps(sub_task_ids)
        
        print(f"CRUD: Updated weighted progress for long-term task {long_term_task_id}: {progress} (total weight: {total_weight}, completed weight: {completed_weight}, calculation method: {'direct' if total_weight <= 1.0 else 'ratio'})")
    
    db.commit()
    print(f"CRUD: Long-term task progress updated successfully")
    return True

def get_urgent_tasks(user_id: int, db: Session) -> List[dict]:
    # 获取所有有截止时间且未完成的短期任务（status != 3）
    short_tasks = db.query(models.Task).filter(
        models.Task.user_id == user_id,
        models.Task.due_date.isnot(None),
        models.Task.due_date != "",
        models.Task.status != 3
    ).all()
    # 获取所有有截止时间且未完成的长期任务（progress < 1.0）
    long_tasks = db.query(models.LongTermTask).filter(
        models.LongTermTask.user_id == user_id,
        models.LongTermTask.due_date.isnot(None),
        models.LongTermTask.due_date != "",
        models.LongTermTask.progress < 1.0
    ).all()

    urgent_list = []
    for t in short_tasks:
        urgent_list.append({
            "id": t.id,
            "title": t.title,
            "due_date": t.due_date,
            "type": "short"
        })
    for lt in long_tasks:
        urgent_list.append({
            "id": lt.id,
            "title": lt.title,
            "due_date": lt.due_date,
            "type": "long"
        })

    urgent_list.sort(key=lambda x: x["due_date"])
    return urgent_list

def get_long_term_task_by_id(task_id: int, db: Session) -> Optional[schemas.LongTermTask]:
    """
    根据ID获取长期任务
    
    参数：
        task_id: 长期任务ID
        db: 数据库会话
        
    返回：
        LongTermTask对象或None
    """
    long_term_task = db.query(models.LongTermTask).filter(models.LongTermTask.id == task_id).first()
    if not long_term_task:
        return None
        
    return map_long_term_task_to_schema(db, long_term_task)

def get_settings_by_user_id(user_id: int, db: Session) -> Optional[schemas.Settings]:
    return db.query(models.Settings).filter(models.Settings.user_id == user_id).first()

def create_settings(settings: schemas.SettingsCreate, db: Session) -> schemas.Settings:
    db_settings = models.Settings(
        user_id=settings.user_id,
        primary=settings.primary,
        bg=settings.bg,
        card=settings.card,
        text=settings.text,
        theme_mode=settings.theme_mode
    )
    db.add(db_settings)
    db.commit()
    db.refresh(db_settings)
    return db_settings

def get_memo(user_id: int, db: Session) -> Optional[schemas.Memo]:
    return db.query(models.Memo).filter(models.Memo.user_id == user_id).first()

def update_memo(user_id: int, content: str, db: Session) -> schemas.Memo:
    memo = db.query(models.Memo).filter(models.Memo.user_id == user_id).first()
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    if memo:
        memo.content = content
        memo.updated_at = timestamp
    else:
        memo = models.Memo(
            user_id=user_id,
            content=content,
            updated_at=timestamp
        )
        db.add(memo)
    
    db.commit()
    db.refresh(memo)
    return memo

def update_settings(user_id: int, settings: schemas.SettingsUpdate, db: Session) -> Optional[schemas.Settings]:
    db_settings = db.query(models.Settings).filter(models.Settings.user_id == user_id).first()
    if not db_settings:
        return None
    
    update_data = settings.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_settings, key, value)
    
    db.commit()
    db.refresh(db_settings)
    return db_settings