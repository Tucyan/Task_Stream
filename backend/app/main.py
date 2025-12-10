# 导入FastAPI核心组件：FastAPI应用实例、依赖注入、HTTP异常处理
from fastapi import FastAPI, Depends, HTTPException
# 导入SQLAlchemy的ORM会话对象，用于数据库交互
from sqlalchemy.orm import Session
# 导入类型注解：列表、可选类型
from typing import List, Optional

# 导入项目内部模块：
# models：数据库模型定义（表结构）
# schemas：Pydantic数据模型（请求/响应数据校验）
# crud：数据库CRUD操作封装（增删改查逻辑）
from app.models import models
from app.schemas import schemas
from app.services import crud
# 导入数据库配置：SessionLocal（数据库会话生成器）、engine（数据库连接引擎）
from app.core.database import SessionLocal, engine

# 创建所有数据库表（如果表不存在）
# bind=engine 指定使用的数据库连接引擎
models.Base.metadata.create_all(bind=engine)

# 初始化FastAPI应用实例，设置API标题
app = FastAPI(title="Task Stream API")

# 导入并配置CORS中间件（跨域资源共享）
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:5174", "http://127.0.0.1:5174"],  # 允许前端域名跨域请求
    allow_credentials=True,    # 允许携带Cookie等凭证
    allow_methods=["*"],       # 允许所有HTTP方法（GET/POST/PUT/DELETE等）
    allow_headers=["*"],       # 允许所有请求头
)


# 定义数据库会话依赖项：每次请求时创建新会话，请求结束后关闭
def get_db():
    # 创建数据库会话实例
    db = SessionLocal()
    try:
        # 使用yield将会话对象提供给依赖它的路由函数
        yield db
    finally:
        # 无论请求是否成功，最终都会关闭数据库会话，释放连接
        db.close()

# ------------------------------ 任务相关接口 ------------------------------
# GET请求：获取急需处理任务列表
@app.get("/urgent_tasks")
def get_urgent_tasks(user_id: int, db: Session = Depends(get_db)):
    """
    获取指定用户的所有急需处理任务（长期+短期，按截止时间升序）
    参数：user_id 用户ID
    返回：[{id, title, due_date, type}]
    """
    return crud.get_urgent_tasks(user_id, db)

# GET请求：获取指定日期范围内的任务列表
# 路径：/tasks/range
# 响应模型：List[schemas.Task] 表示返回Task模型的列表
@app.get("/tasks/range", response_model=List[schemas.Task])
def read_tasks_in_date_range(
    start_date: str,    # 查询参数：开始日期（格式通常为YYYY-MM-DD）
    end_date: str,      # 查询参数：结束日期
    user_id: int,       # 查询参数：用户ID（用于筛选指定用户的任务）
    db: Session = Depends(get_db)  # 依赖注入：获取数据库会话
):
    """
    获取指定用户在指定日期范围内的所有任务
    
    参数：
        start_date: 日期范围起始值（字符串格式，如"2025-01-01"）
        end_date: 日期范围结束值（字符串格式，如"2025-01-31"）
        user_id: 关联的用户ID
        db: 数据库会话对象（自动注入）
    
    返回：
        符合条件的Task对象列表
    """
    # 调用CRUD层方法获取数据并返回
    return crud.get_tasks_in_date_range(start_date, end_date, user_id, db)

@app.get("/tasks", response_model=List[schemas.Task])
def read_all_tasks_for_user(
    user_id: int,       # 查询参数：用户ID（用于筛选指定用户的任务）
    db: Session = Depends(get_db)  # 依赖注入：获取数据库会话
):
    """
    获取指定用户的所有任务
    
    参数：
        user_id: 关联的用户ID
        db: 数据库会话对象（自动注入）
    
    返回：
        该用户的所有Task对象列表
    """
    # 调用CRUD层方法获取数据并返回
    return crud.get_all_tasks_for_user(user_id, db)

@app.post("/tasks", response_model=schemas.Task)
def create_task(
    task: schemas.TaskCreate,
    db: Session = Depends(get_db)
):
    return crud.create_task(task, db)

@app.get("/tasks/{task_id}", response_model=schemas.Task)
def get_task_by_id(
    task_id: int,
    db: Session = Depends(get_db)
):
    """
    获取指定ID的任务
    
    参数：
        task_id: 任务ID
        db: 数据库会话对象
    
    返回：
        指定ID的Task对象
    """
    task = crud.get_task_by_id(task_id, db)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@app.delete("/tasks/{task_id}")
def delete_task(
    task_id: int,
    db: Session = Depends(get_db)
):
    success = crud.delete_task(task_id, db)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"success": True}

# GET请求：获取指定用户的所有长期任务
@app.get("/long_term_tasks", response_model=List[schemas.LongTermTask])
def read_all_long_term_tasks(
    user_id: int,
    db: Session = Depends(get_db)
):
    """
    获取指定用户的所有长期任务
    
    参数：
        user_id: 关联的用户ID
        db: 数据库会话对象
    
    返回：
        该用户的所有LongTermTask对象列表
    """
    return crud.get_all_long_term_tasks(user_id, db)

@app.post("/long_term_tasks", response_model=schemas.LongTermTask)
def create_long_term_task(
    task: schemas.LongTermTaskCreate,
    db: Session = Depends(get_db)
):
    return crud.create_long_term_task(task, db)

@app.delete("/long_term_tasks/{task_id}")
def delete_long_term_task(
    task_id: int,
    db: Session = Depends(get_db)
):
    success = crud.delete_long_term_task(task_id, db)
    if not success:
        raise HTTPException(status_code=404, detail="Long term task not found")
    return {"success": True}

# GET请求：获取指定用户的所有未完成长期任务
@app.get("/long_term_tasks/uncompleted", response_model=List[schemas.LongTermTask])
def read_all_uncompleted_long_term_tasks(
    user_id: int,
    db: Session = Depends(get_db)
):
    """
    获取指定用户的所有未完成长期任务
    
    参数：
        user_id: 关联的用户ID
        db: 数据库会话对象
    
    返回：
        该用户的未完成LongTermTask对象列表
    """
    return crud.get_all_uncompleted_long_term_tasks(user_id, db)

# PUT请求：更新指定ID的普通任务
# 路径参数：task_id 表示要更新的任务ID
@app.put("/tasks/{task_id}")
def update_task(
    task_id: int,               # 路径参数：任务ID
    task: schemas.Task,         # 请求体：更新后的任务数据（符合Task模型校验）
    db: Session = Depends(get_db)
):
    print(f"前端接收到的信息: {task}")
    """
    更新指定ID的普通任务
    
    参数：
        task_id: 要更新的任务ID
        task: 包含更新数据的Task对象（请求体）
        db: 数据库会话对象
    
    返回：
        成功：{"success": True}
        失败：抛出404异常（任务不存在）
    """
    # 添加日志以调试
    # print(f"Received update request for task {task_id}")
    # print(f"Task data: {task.dict()}")
    
    # 调用CRUD层更新方法，返回更新是否成功
    success = crud.update_task(task_id, task, db)
    # 如果更新失败（任务不存在），抛出404 HTTP异常
    if not success:
        raise HTTPException(status_code=404, detail="Task not found")
    # 更新成功，返回成功标识
    return {"success": True}

# GET请求：获取指定ID的长期任务
@app.get("/long_term_tasks/{task_id}", response_model=schemas.LongTermTask)
def read_long_term_task(
    task_id: int,
    db: Session = Depends(get_db)
):
    """
    获取指定ID的长期任务
    
    参数：
        task_id: 长期任务ID
        db: 数据库会话对象
    
    返回：
        指定ID的LongTermTask对象
    """
    task = crud.get_long_term_task_by_id(task_id, db)
    if not task:
        raise HTTPException(status_code=404, detail="Long term task not found")
    return task

# PUT请求：更新指定ID的长期任务
@app.put("/long_term_tasks/{task_id}")
def update_long_term_task(
    task_id: int,                       # 路径参数：长期任务ID
    task: schemas.LongTermTask,         # 请求体：更新后的长期任务数据
    db: Session = Depends(get_db)
):
    """
    更新指定ID的长期任务
    
    参数：
        task_id: 要更新的长期任务ID
        task: 包含更新数据的LongTermTask对象（请求体）
        db: 数据库会话对象
    
    返回：
        成功：{"success": True}
        失败：抛出404异常（长期任务不存在）
    """
    # 添加日志以查看sub_task_ids的内容
    task_dict = task.dict()
    print(f"[main.py] 更新长期任务请求，task_id: {task_id}")
    print(f"[main.py] sub_task_ids: {task_dict.get('sub_task_ids')}")
    print(f"[main.py] sub_task_ids类型: {type(task_dict.get('sub_task_ids'))}")
    try:
        print(f"[main.py] sub_task_ids字符串: {str(task_dict.get('sub_task_ids'))}")
    except Exception as e:
        print(f"[main.py] 转换sub_task_ids为字符串时出错: {e}")
    
    success = crud.update_long_term_task(task_id, task, db)
    if not success:
        raise HTTPException(status_code=404, detail="Long term task not found")
    return {"success": True}

# ------------------------------ 日记相关接口 ------------------------------
# GET请求：获取指定用户指定月份的所有有日志的日期
@app.get("/journals/dates")
def get_journal_dates(
    year: int,          # 查询参数：年份
    month: int,         # 查询参数：月份
    user_id: int,       # 查询参数：用户ID
    db: Session = Depends(get_db)
):
    """
    获取指定用户指定月份的所有有日志的日期
    
    参数：
        year: 年份
        month: 月份
        user_id: 关联的用户ID
        db: 数据库会话对象
    
    返回：
        整数列表（包含有日志的日期，如 [1, 5, 12, 20]）
    """
    return crud.get_journal_dates(year, month, user_id, db)

# GET请求：获取指定用户指定月份的日志状态列表
@app.get("/journals/status", response_model=List[bool])
def get_journal_status(
    year: int,          # 查询参数：年份
    month: int,         # 查询参数：月份
    user_id: int,       # 查询参数：用户ID
    db: Session = Depends(get_db)
):
    """
    获取指定用户指定月份的日志状态列表
    返回一个布尔列表，每个元素对应当月的一天，True表示有日志，False表示无日志
    
    参数：
        year: 年份
        month: 月份
        user_id: 关联的用户ID
        db: 数据库会话对象
    
    返回：
        布尔列表
    """
    result = crud.get_journal_status_list(year, month, user_id, db)
    return result

# GET请求：获取指定日期的用户日记
# 响应模型：Optional[schemas.Journal] 表示返回Journal对象或None（无日记）
@app.get("/journals/{date}", response_model=Optional[schemas.Journal])
def read_journal(
    date: str,          # 路径参数：日记日期（格式YYYY-MM-DD）
    user_id: int,       # 查询参数：用户ID
    db: Session = Depends(get_db)
):
    """
    获取指定用户指定日期的日记
    
    参数：
        date: 日记日期（路径参数）
        user_id: 关联的用户ID（查询参数）
        db: 数据库会话对象
    
    返回：
        存在：Journal对象
        不存在：None
    """
    return crud.get_journal_by_date(date, user_id, db)

# PUT请求：更新指定日期的日记内容（旧版接口，参数分散）
@app.put("/journals/{date}")
def update_journal(
    date: str,          # 路径参数：日记日期
    content: str,       # 查询参数：更新后的日记内容
    user_id: int,       # 查询参数：用户ID
    db: Session = Depends(get_db)
):
    """
    更新指定用户指定日期的日记内容（旧版接口）
    
    参数：
        date: 日记日期（路径参数）
        content: 新的日记内容（查询参数）
        user_id: 关联的用户ID（查询参数）
        db: 数据库会话对象
    
    返回：
        {"success": 布尔值}（更新是否成功）
    """
    success = crud.update_journal_content(date, content, user_id, db)
    return {"success": success}

# 定义日记更新的Pydantic模型（用于新版更新接口的请求体校验）
from pydantic import BaseModel
class JournalUpdate(BaseModel):
    content: str  # 日记内容
    user_id: int  # 用户ID

# PUT请求：更新指定日期的日记内容（新版接口，请求体传参）
@app.put("/journals/{date}/content")
def update_journal_content_endpoint(
    date: str,                  # 路径参数：日记日期
    update: JournalUpdate,      # 请求体：包含content和user_id的JournalUpdate对象
    db: Session = Depends(get_db)
):
    """
    更新指定用户指定日期的日记内容（新版接口）
    使用Pydantic模型接收请求体，参数更规范
    
    参数：
        date: 日记日期（路径参数）
        update: JournalUpdate对象，包含content（新内容）和user_id（用户ID）
        db: 数据库会话对象
    
    返回：
        {"success": 布尔值}（更新是否成功）
    """
    success = crud.update_journal_content(date, update.content, update.user_id, db)
    return {"success": success}


# ------------------------------ 热力图相关接口 ------------------------------
# GET请求：获取指定用户指定年月的热力图数据
# 响应模型：List[int] 表示返回整数列表（每日任务完成数/活跃度等）
@app.get("/heatmap", response_model=List[int])
def read_heatmap_data(
    year: int,          # 查询参数：年份（如2025）
    month: int,         # 查询参数：月份（如1-12）
    user_id: int,       # 查询参数：用户ID
    db: Session = Depends(get_db)
):
    """
    获取指定用户指定年月的热力图数据
    通常返回该月每天的任务完成数量/活跃度等指标
    
    参数：
        year: 年份
        month: 月份
        user_id: 关联的用户ID
        db: 数据库会话对象
    
    返回：
        整数列表（长度为该月天数，每个元素表示对应日期的数值）
    """
    return crud.get_heatmap_data(year, month, user_id, db)

# ------------------------------ 设置相关接口 ------------------------------
# GET请求：获取指定用户的设置
@app.get("/settings/{user_id}", response_model=Optional[schemas.Settings])
def read_settings(
    user_id: int,
    db: Session = Depends(get_db)
):
    """
    获取指定用户的设置
    
    参数：
        user_id: 用户ID
        db: 数据库会话对象
    
    返回：
        Settings对象或None
    """
    return crud.get_settings_by_user_id(user_id, db)

# POST请求：创建用户设置
@app.post("/settings", response_model=schemas.Settings)
def create_settings(
    settings: schemas.SettingsCreate,
    db: Session = Depends(get_db)
):
    """
    创建用户设置
    
    参数：
        settings: SettingsCreate对象
        db: 数据库会话对象
    
    返回：
        创建后的Settings对象
    """
    # 检查用户是否已存在设置
    existing_settings = crud.get_settings_by_user_id(settings.user_id, db)
    if existing_settings:
        raise HTTPException(status_code=400, detail="Settings already exist for this user")
    return crud.create_settings(settings, db)

# PUT请求：更新指定用户的设置
@app.put("/settings/{user_id}", response_model=schemas.Settings)
def update_settings(
    user_id: int,
    settings: schemas.SettingsUpdate,
    db: Session = Depends(get_db)
):
    """
    更新指定用户的设置
    
    参数：
        user_id: 用户ID
        settings: SettingsUpdate对象
        db: 数据库会话对象
    
    返回：
        更新后的Settings对象
    """
    updated_settings = crud.update_settings(user_id, settings, db)
    if not updated_settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    return updated_settings

# ------------------------------ Memo 相关接口 ------------------------------
@app.get("/memos/{user_id}", response_model=Optional[schemas.Memo])
def read_memo(
    user_id: int,
    db: Session = Depends(get_db)
):
    """
    获取指定用户的备忘录
    """
    return crud.get_memo(user_id, db)

@app.put("/memos/{user_id}", response_model=schemas.Memo)
def update_memo(
    user_id: int,
    memo: schemas.MemoUpdate,
    db: Session = Depends(get_db)
):
    """
    更新指定用户的备忘录
    """
    return crud.update_memo(user_id, memo.content, db)

# ------------------------------ 认证相关路由 ------------------------------
# 导入认证相关的路由路由器，并注册到主应用
from app.services.auth import router as auth_router
app.include_router(auth_router)  # 将认证路由（如登录/注册）添加到主应用

# ------------------------------ 应用启动入口 ------------------------------
# 如果直接运行该脚本，启动UVicorn服务器
if __name__ == "__main__":
    import uvicorn
    # 启动服务器：绑定127.0.0.1地址，8000端口，运行app实例
    uvicorn.run(app, host="127.0.0.1", port=8000)