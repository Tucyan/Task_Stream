from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class User(BaseModel):
    """用户 Schema"""
    id: int
    username: str
    created_at: str
    name: Optional[str]
    passwordHash: str
    
    class Config:
        from_attributes = True

class MemoBase(BaseModel):
    """备忘录基础 Schema"""
    user_id: int
    content: Optional[str] = ""

class MemoCreate(MemoBase):
    """创建备忘录 Schema"""
    pass

class MemoUpdate(BaseModel):
    """更新备忘录 Schema"""
    content: str

class Memo(MemoBase):
    """备忘录 Schema"""
    updated_at: str
    class Config:
        from_attributes = True

class TaskBase(BaseModel):
    """任务基础 Schema"""
    user_id: int
    title: str
    description: Optional[str] = None
    status: int
    due_date: Optional[str] = None
    assigned_date: Optional[str] = None
    assigned_start_time: Optional[str] = None
    assigned_end_time: Optional[str] = None
    tags: Optional[List[str]] = []
    record_result: Optional[bool] = False
    result: Optional[str] = ""
    result_picture_url: Optional[List[str]] = []
    long_term_task_id: Optional[int] = None

class TaskCreate(TaskBase):
    """创建任务 Schema"""
    pass

class Task(TaskBase):
    """任务 Schema"""
    id: int
    created_at: str
    updated_at: str
    long_term_task: Optional["LongTermTask"] = None

    class Config:
        from_attributes = True

class LongTermTaskBase(BaseModel):
    """长期任务基础 Schema"""
    user_id: int
    title: str
    description: Optional[str] = None
    start_date: Optional[str] = None
    due_date: Optional[str] = None
    progress: float = 0.0
    sub_task_ids: Optional[Dict[str, float]] = {}  # 格式: {"task_id": weight}，例如 {"1": 0.7, "2": 0.3}

class LongTermTaskCreate(LongTermTaskBase):
    """创建长期任务 Schema"""
    pass

class LongTermTask(LongTermTaskBase):
    """长期任务 Schema"""
    id: int
    subtasks: Optional[List[Task]] = []
    created_at: str

    class Config:
        from_attributes = True

class Journal(BaseModel):
    """日记 Schema"""
    date: str
    user_id: int
    content: str

    class Config:
        from_attributes = True

class AiMessage(BaseModel):
    """AI 对话记录 Schema"""
    id: int
    user_id: int
    title: Optional[str]
    timestamp: str
    messages: List[List[Dict[str, Any]]]

    class Config:
        from_attributes = True

class SettingsBase(BaseModel):
    """设置基础 Schema"""
    user_id: int
    primary: str
    bg: str
    card: str
    text: str
    theme_mode: str = "light"

class SettingsCreate(SettingsBase):
    """创建设置 Schema"""
    pass

class SettingsUpdate(BaseModel):
    """更新设置 Schema"""
    primary: Optional[str] = None
    bg: Optional[str] = None
    card: Optional[str] = None
    text: Optional[str] = None
    theme_mode: Optional[str] = None

class Settings(SettingsBase):
    """设置 Schema"""
    id: int
    
    class Config:
        from_attributes = True

class AIConfigBase(BaseModel):
    """AI 配置基础 Schema"""
    user_id: int
    api_key: str
    model: str
    openai_base_url: Optional[str] = ""
    prompt: Optional[str] = None
    character: Optional[str] = None
    long_term_memory: Optional[str] = None
    ai_dialogue_id_list: Optional[List[int]] = []
    is_enable_prompt: int = 0
    is_auto_confirm_create_request: int = 0
    is_auto_confirm_update_request: int = 0
    is_auto_confirm_delete_request: int = 0
    is_auto_confirm_create_reminder: int = 0
    reminder_list: Optional[List[Dict[str, Any]]] = []

class AIConfigCreate(AIConfigBase):
    """创建 AI 配置 Schema"""
    pass

class AIConfigUpdate(BaseModel):
    """更新 AI 配置 Schema"""
    api_key: Optional[str] = None
    model: Optional[str] = None
    openai_base_url: Optional[str] = None
    prompt: Optional[str] = None
    character: Optional[str] = None
    long_term_memory: Optional[str] = None
    is_enable_prompt: Optional[int] = None
    is_auto_confirm_create_request: Optional[int] = None
    is_auto_confirm_update_request: Optional[int] = None
    is_auto_confirm_delete_request: Optional[int] = None
    is_auto_confirm_create_reminder: Optional[int] = None
    reminder_list: Optional[List[Dict[str, Any]]] = None

class AIConfig(AIConfigBase):
    """AI 配置 Schema"""
    id: int
    class Config:
        from_attributes = True
