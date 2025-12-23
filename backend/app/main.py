# 导入FastAPI核心组件：FastAPI应用实例、依赖注入、HTTP异常处理
from fastapi import FastAPI, Depends, HTTPException, Query
# 导入SQLAlchemy的异步会话对象，用于数据库交互
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
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

from contextlib import asynccontextmanager

# 定义异步初始化逻辑
@asynccontextmanager
async def lifespan(app: FastAPI):
    # 创建所有数据库表（如果表不存在）
    # 使用异步引擎的 run_sync 方法运行同步的 create_all
    async with engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)
        
        # 检查并更新 ai_configs 表结构
        try:
            result = await conn.execute(text("PRAGMA table_info(ai_configs)"))
            cols = [row[1] for row in result.fetchall()]
            if "openai_base_url" not in cols:
                await conn.execute(text("ALTER TABLE ai_configs ADD COLUMN openai_base_url TEXT"))
        except Exception:
            pass
    yield

# 初始化FastAPI应用实例，设置API标题和生命周期管理
app = FastAPI(title="Task Stream API", lifespan=lifespan)

# 导入并配置CORS中间件（跨域资源共享）
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],       # 允许所有HTTP方法（GET/POST/PUT/DELETE等）
    allow_headers=["*"],       # 允许所有请求头
)


# 定义数据库会话依赖项：每次请求时创建新会话，请求结束后关闭
async def get_db():
    # 创建异步数据库会话实例
    async with SessionLocal() as db:
        # 使用yield将会话对象提供给依赖它的路由函数
        yield db

# ------------------------------ 任务相关接口 ------------------------------
# GET请求：获取急需处理任务列表
@app.get("/api/v1/tasks/urgent")
async def get_urgent_tasks(user_id: int, db: AsyncSession = Depends(get_db)):
    """
    获取指定用户的所有急需处理任务（长期+短期，按截止时间升序）
    参数：user_id 用户ID
    返回：[{id, title, due_date, type}]
    """
    return await crud.get_urgent_tasks(user_id, db)

# GET请求：获取任务列表（支持日期范围筛选）
@app.get("/api/v1/tasks/", response_model=List[schemas.Task])
async def read_tasks(
    user_id: int,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    获取指定用户的任务列表。
    如果提供了 start_date 和 end_date，则返回该日期范围内的任务。
    否则返回该用户的所有任务。
    """
    if start_date and end_date:
        return await crud.get_tasks_in_date_range(start_date, end_date, user_id, db)
    return await crud.get_all_tasks_for_user(user_id, db)

@app.post("/api/v1/tasks/", response_model=schemas.Task)
async def create_task(
    task: schemas.TaskCreate,
    db: AsyncSession = Depends(get_db)
):
    return await crud.create_task(task, db)

@app.get("/api/v1/tasks/{task_id}", response_model=schemas.Task)
async def get_task_by_id(
    task_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    获取指定ID的任务
    """
    task = await crud.get_task_by_id(task_id, db)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@app.delete("/api/v1/tasks/{task_id}")
async def delete_task(
    task_id: int,
    db: AsyncSession = Depends(get_db)
):
    success = await crud.delete_task(task_id, db)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"success": True}

# PUT请求：更新指定ID的普通任务
@app.put("/api/v1/tasks/{task_id}")
async def update_task(
    task_id: int,               # 路径参数：任务ID
    task: schemas.Task,         # 请求体：更新后的任务数据（符合Task模型校验）
    db: AsyncSession = Depends(get_db)
):
    print(f"前端接收到的信息: {task}")
    """
    更新指定ID的普通任务
    """
    success = await crud.update_task(task_id, task, db)
    if not success:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"success": True}

# ------------------------------ 长期任务相关接口 ------------------------------
# GET请求：获取指定用户的所有长期任务
@app.get("/api/v1/long-term-tasks", response_model=List[schemas.LongTermTask])
async def read_all_long_term_tasks(
    user_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    获取指定用户的所有长期任务
    """
    return await crud.get_all_long_term_tasks(user_id, db)

@app.post("/api/v1/long-term-tasks", response_model=schemas.LongTermTask)
async def create_long_term_task(
    task: schemas.LongTermTaskCreate,
    db: AsyncSession = Depends(get_db)
):
    return await crud.create_long_term_task(task, db)

@app.delete("/api/v1/long-term-tasks/{task_id}")
async def delete_long_term_task(
    task_id: int,
    db: AsyncSession = Depends(get_db)
):
    success = await crud.delete_long_term_task(task_id, db)
    if not success:
        raise HTTPException(status_code=404, detail="Long term task not found")
    return {"success": True}

# GET请求：获取指定用户的所有未完成长期任务
@app.get("/api/v1/long-term-tasks/uncompleted", response_model=List[schemas.LongTermTask])
async def read_all_uncompleted_long_term_tasks(
    user_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    获取指定用户的所有未完成长期任务
    """
    return await crud.get_all_uncompleted_long_term_tasks(user_id, db)

# GET请求：获取指定ID的长期任务
@app.get("/api/v1/long-term-tasks/{task_id}", response_model=schemas.LongTermTask)
async def read_long_term_task(
    task_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    获取指定ID的长期任务
    """
    task = await crud.get_long_term_task_by_id(task_id, db)
    if not task:
        raise HTTPException(status_code=404, detail="Long term task not found")
    return task

# PUT请求：更新指定ID的长期任务
@app.put("/api/v1/long-term-tasks/{task_id}")
async def update_long_term_task(
    task_id: int,                       # 路径参数：长期任务ID
    task: schemas.LongTermTask,         # 请求体：更新后的长期任务数据
    db: AsyncSession = Depends(get_db)
):
    """
    更新指定ID的长期任务
    """
    # 添加日志以查看sub_task_ids的内容
    task_dict = task.dict()
    print(f"[main.py] 更新长期任务请求，task_id: {task_id}")
    print(f"[main.py] sub_task_ids: {task_dict.get('sub_task_ids')}")
    
    success = await crud.update_long_term_task(task_id, task, db)
    if not success:
        raise HTTPException(status_code=404, detail="Long term task not found")
    return {"success": True}

# ------------------------------ 日记相关接口 ------------------------------
# GET请求：获取指定用户指定月份的所有有日志的日期
@app.get("/api/v1/journals/dates")
async def get_journal_dates(
    year: int,          # 查询参数：年份
    month: int,         # 查询参数：月份
    user_id: int,       # 查询参数：用户ID
    db: AsyncSession = Depends(get_db)
):
    """
    获取指定用户指定月份的所有有日志的日期
    """
    return await crud.get_journal_dates(year, month, user_id, db)

# GET请求：获取指定用户指定月份的日志状态列表
@app.get("/api/v1/journals/status", response_model=List[bool])
async def get_journal_status(
    year: int,          # 查询参数：年份
    month: int,         # 查询参数：月份
    user_id: int,       # 查询参数：用户ID
    db: AsyncSession = Depends(get_db)
):
    """
    获取指定用户指定月份的日志状态列表
    """
    result = await crud.get_journal_status_list(year, month, user_id, db)
    return result

# GET请求：获取指定日期的用户日记
@app.get("/api/v1/journals/{date}", response_model=Optional[schemas.Journal])
async def read_journal(
    date: str,          # 路径参数：日记日期（格式YYYY-MM-DD）
    user_id: int,       # 查询参数：用户ID
    db: AsyncSession = Depends(get_db)
):
    """
    获取指定用户指定日期的日记
    """
    return await crud.get_journal_by_date(date, user_id, db)

# 定义日记更新的Pydantic模型
from pydantic import BaseModel
class JournalUpdate(BaseModel):
    content: str  # 日记内容
    user_id: int  # 用户ID

# PUT请求：更新指定日期的日记内容
@app.put("/api/v1/journals/{date}")
async def update_journal_content_endpoint(
    date: str,                  # 路径参数：日记日期
    update: JournalUpdate,      # 请求体：包含content和user_id的JournalUpdate对象
    db: AsyncSession = Depends(get_db)
):
    """
    更新指定用户指定日期的日记内容
    """
    success = await crud.update_journal_content(date, update.content, update.user_id, db)
    return {"success": success}

# ------------------------------ 热力图相关接口 ------------------------------
@app.get("/api/v1/stats/heatmap", response_model=List[int])
async def read_heatmap_data(
    year: int,          # 查询参数：年份（如2025）
    month: int,         # 查询参数：月份（如1-12）
    user_id: int,       # 查询参数：用户ID
    db: AsyncSession = Depends(get_db)
):
    """
    获取指定用户指定年月的热力图数据
    """
    return await crud.get_heatmap_data(year, month, user_id, db)

# ------------------------------ 设置相关接口 ------------------------------
@app.get("/api/v1/settings/{user_id}", response_model=Optional[schemas.Settings])
async def read_settings(
    user_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    获取指定用户的设置
    """
    return await crud.get_settings_by_user_id(user_id, db)

@app.post("/api/v1/settings", response_model=schemas.Settings)
async def create_settings(
    settings: schemas.SettingsCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    创建用户设置
    """
    # 检查用户是否已存在设置
    existing_settings = await crud.get_settings_by_user_id(settings.user_id, db)
    if existing_settings:
        raise HTTPException(status_code=400, detail="Settings already exist for this user")
    return await crud.create_settings(settings, db)

@app.put("/api/v1/settings/{user_id}", response_model=schemas.Settings)
async def update_settings(
    user_id: int,
    settings: schemas.SettingsUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    更新指定用户的设置
    """
    updated_settings = await crud.update_settings(user_id, settings, db)
    if not updated_settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    return updated_settings

# ------------------------------ Memo 相关接口 ------------------------------
@app.get("/api/v1/memos/{user_id}", response_model=Optional[schemas.Memo])
async def read_memo(
    user_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    获取指定用户的备忘录
    """
    return await crud.get_memo(user_id, db)

@app.put("/api/v1/memos/{user_id}", response_model=schemas.Memo)
async def update_memo(
    user_id: int,
    memo: schemas.MemoUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    更新指定用户的备忘录
    """
    return await crud.update_memo(user_id, memo.content, db)

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
