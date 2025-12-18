# 导入FastAPI核心组件：FastAPI应用实例、依赖注入、HTTP异常处理
from fastapi import FastAPI, Depends, HTTPException, Query
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
from app.services.auth import router as auth_router

# 创建所有数据库表（如果表不存在）
# bind=engine 指定使用的数据库连接引擎
models.Base.metadata.create_all(bind=engine)

# 初始化FastAPI应用实例，设置API标题
app = FastAPI(title="Task Stream API")

# 导入并配置CORS中间件（跨域资源共享）
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost",
        "https://localhost",
        "capacitor://localhost",
        "ionic://localhost",
        # 生产环境公网IP地址
        "http://39.105.153.48",
        "http://39.105.153.48:8000",
        # 允许来自任何Android应用的请求（生产环境）
        "capacitor://*",
        "http://*",
        "https://*",
    ],
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
@app.get("/api/v1/tasks/urgent")
def get_urgent_tasks(user_id: int, db: Session = Depends(get_db)):
    """
    获取指定用户的所有急需处理任务（长期+短期，按截止时间升序）
    参数：user_id 用户ID
    返回：[{id, title, due_date, type}]
    """
    return crud.get_urgent_tasks(user_id, db)

# GET请求：获取任务列表（支持日期范围筛选）
@app.get("/api/v1/tasks/", response_model=List[schemas.Task])
def read_tasks(
    user_id: int,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    获取指定用户的任务列表。
    如果提供了 start_date 和 end_date，则返回该日期范围内的任务。
    否则返回该用户的所有任务。
    """
    if start_date and end_date:
        return crud.get_tasks_in_date_range(start_date, end_date, user_id, db)
    return crud.get_all_tasks_for_user(user_id, db)

@app.post("/api/v1/tasks/", response_model=schemas.Task)
def create_task(
    task: schemas.TaskCreate,
    db: Session = Depends(get_db)
):
    return crud.create_task(task, db)

@app.get("/api/v1/tasks/{task_id}", response_model=schemas.Task)
def get_task_by_id(
    task_id: int,
    db: Session = Depends(get_db)
):
    """
    获取指定ID的任务
    """
    task = crud.get_task_by_id(task_id, db)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@app.delete("/api/v1/tasks/{task_id}")
def delete_task(
    task_id: int,
    db: Session = Depends(get_db)
):
    success = crud.delete_task(task_id, db)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"success": True}

# PUT请求：更新指定ID的普通任务
@app.put("/api/v1/tasks/{task_id}")
def update_task(
    task_id: int,               # 路径参数：任务ID
    task: schemas.Task,         # 请求体：更新后的任务数据（符合Task模型校验）
    db: Session = Depends(get_db)
):
    print(f"前端接收到的信息: {task}")
    """
    更新指定ID的普通任务
    """
    success = crud.update_task(task_id, task, db)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"success": True}

# ------------------------------ 长期任务相关接口 ------------------------------
# GET请求：获取指定用户的所有长期任务
@app.get("/api/v1/long-term-tasks", response_model=List[schemas.LongTermTask])
def read_all_long_term_tasks(
    user_id: int,
    db: Session = Depends(get_db)
):
    """
    获取指定用户的所有长期任务
    """
    return crud.get_all_long_term_tasks(user_id, db)

@app.post("/api/v1/long-term-tasks", response_model=schemas.LongTermTask)
def create_long_term_task(
    task: schemas.LongTermTaskCreate,
    db: Session = Depends(get_db)
):
    return crud.create_long_term_task(task, db)

@app.delete("/api/v1/long-term-tasks/{task_id}")
def delete_long_term_task(
    task_id: int,
    db: Session = Depends(get_db)
):
    success = crud.delete_long_term_task(task_id, db)
    if not success:
        raise HTTPException(status_code=404, detail="Long term task not found")
    return {"success": True}

# GET请求：获取指定用户的所有未完成长期任务
@app.get("/api/v1/long-term-tasks/uncompleted", response_model=List[schemas.LongTermTask])
def read_all_uncompleted_long_term_tasks(
    user_id: int,
    db: Session = Depends(get_db)
):
    """
    获取指定用户的所有未完成长期任务
    """
    return crud.get_all_uncompleted_long_term_tasks(user_id, db)

# GET请求：获取指定ID的长期任务
@app.get("/api/v1/long-term-tasks/{task_id}", response_model=schemas.LongTermTask)
def read_long_term_task(
    task_id: int,
    db: Session = Depends(get_db)
):
    """
    获取指定ID的长期任务
    """
    task = crud.get_long_term_task_by_id(task_id, db)
    if not task:
        raise HTTPException(status_code=404, detail="Long term task not found")
    return task

# PUT请求：更新指定ID的长期任务
@app.put("/api/v1/long-term-tasks/{task_id}")
def update_long_term_task(
    task_id: int,                       # 路径参数：长期任务ID
    task: schemas.LongTermTask,         # 请求体：更新后的长期任务数据
    db: Session = Depends(get_db)
):
    """
    更新指定ID的长期任务
    """
    # 添加日志以查看sub_task_ids的内容
    task_dict = task.dict()
    print(f"[main.py] 更新长期任务请求，task_id: {task_id}")
    print(f"[main.py] sub_task_ids: {task_dict.get('sub_task_ids')}")
    
    success = crud.update_long_term_task(task_id, task, db)
    if not success:
        raise HTTPException(status_code=404, detail="Long term task not found")
    return {"success": True}

# ------------------------------ 日记相关接口 ------------------------------
# GET请求：获取指定用户指定月份的所有有日志的日期
@app.get("/api/v1/journals/dates")
def get_journal_dates(
    year: int,          # 查询参数：年份
    month: int,         # 查询参数：月份
    user_id: int,       # 查询参数：用户ID
    db: Session = Depends(get_db)
):
    """
    获取指定用户指定月份的所有有日志的日期
    """
    return crud.get_journal_dates(year, month, user_id, db)

# GET请求：获取指定用户指定月份的日志状态列表
@app.get("/api/v1/journals/status", response_model=List[bool])
def get_journal_status(
    year: int,          # 查询参数：年份
    month: int,         # 查询参数：月份
    user_id: int,       # 查询参数：用户ID
    db: Session = Depends(get_db)
):
    """
    获取指定用户指定月份的日志状态列表
    """
    result = crud.get_journal_status_list(year, month, user_id, db)
    return result

# GET请求：获取指定日期的用户日记
@app.get("/api/v1/journals/{date}", response_model=Optional[schemas.Journal])
def read_journal(
    date: str,          # 路径参数：日记日期（格式YYYY-MM-DD）
    user_id: int,       # 查询参数：用户ID
    db: Session = Depends(get_db)
):
    """
    获取指定用户指定日期的日记
    """
    return crud.get_journal_by_date(date, user_id, db)

# 定义日记更新的Pydantic模型
from pydantic import BaseModel
class JournalUpdate(BaseModel):
    content: str  # 日记内容
    user_id: int  # 用户ID

# PUT请求：更新指定日期的日记内容
@app.put("/api/v1/journals/{date}")
def update_journal_content_endpoint(
    date: str,                  # 路径参数：日记日期
    update: JournalUpdate,      # 请求体：包含content和user_id的JournalUpdate对象
    db: Session = Depends(get_db)
):
    """
    更新指定用户指定日期的日记内容
    """
    success = crud.update_journal_content(date, update.content, update.user_id, db)
    return {"success": success}

# ------------------------------ 热力图相关接口 ------------------------------
@app.get("/api/v1/stats/heatmap", response_model=List[int])
def read_heatmap_data(
    year: int,          # 查询参数：年份（如2025）
    month: int,         # 查询参数：月份（如1-12）
    user_id: int,       # 查询参数：用户ID
    db: Session = Depends(get_db)
):
    """
    获取指定用户指定年月的热力图数据
    """
    return crud.get_heatmap_data(year, month, user_id, db)

# ------------------------------ 设置相关接口 ------------------------------
@app.get("/api/v1/settings/{user_id}", response_model=Optional[schemas.Settings])
def read_settings(
    user_id: int,
    db: Session = Depends(get_db)
):
    """
    获取指定用户的设置
    """
    return crud.get_settings_by_user_id(user_id, db)

@app.post("/api/v1/settings", response_model=schemas.Settings)
def create_settings(
    settings: schemas.SettingsCreate,
    db: Session = Depends(get_db)
):
    """
    创建用户设置
    """
    # 检查用户是否已存在设置
    existing_settings = crud.get_settings_by_user_id(settings.user_id, db)
    if existing_settings:
        raise HTTPException(status_code=400, detail="Settings already exist for this user")
    return crud.create_settings(settings, db)

@app.put("/api/v1/settings/{user_id}", response_model=schemas.Settings)
def update_settings(
    user_id: int,
    settings: schemas.SettingsUpdate,
    db: Session = Depends(get_db)
):
    """
    更新指定用户的设置
    """
    updated_settings = crud.update_settings(user_id, settings, db)
    if not updated_settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    return updated_settings

# ------------------------------ Memo 相关接口 ------------------------------
@app.get("/api/v1/memos/{user_id}", response_model=Optional[schemas.Memo])
def read_memo(
    user_id: int,
    db: Session = Depends(get_db)
):
    """
    获取指定用户的备忘录
    """
    return crud.get_memo(user_id, db)

@app.put("/api/v1/memos/{user_id}", response_model=schemas.Memo)
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
# 注册认证路由，前缀 /api/v1/auth
app.include_router(auth_router, prefix="/api/v1/auth", tags=["auth"])

from app.api import ai
app.include_router(ai.router, prefix="/api/v1/ai", tags=["ai"])

# ------------------------------ 应用启动入口 ------------------------------
# 如果直接运行该脚本，启动UVicorn服务器
if __name__ == "__main__":
    import uvicorn
    # 启动服务器：绑定127.0.0.1地址，8000端口，运行app实例
    uvicorn.run(app, host="127.0.0.1", port=8000)
