from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class User(BaseModel):
    id: int
    username: str
    created_at: str
    name: Optional[str]
    passwordHash: str
    
    class Config:
        from_attributes = True

class MemoBase(BaseModel):
    user_id: int
    content: Optional[str] = ""

class MemoCreate(MemoBase):
    pass

class MemoUpdate(BaseModel):
    content: str

class Memo(MemoBase):
    updated_at: str
    class Config:
        from_attributes = True

class TaskBase(BaseModel):
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
    pass

class Task(TaskBase):
    id: int
    created_at: str
    updated_at: str
    long_term_task: Optional["LongTermTask"] = None

    class Config:
        from_attributes = True

class LongTermTaskBase(BaseModel):
    user_id: int
    title: str
    description: Optional[str] = None
    start_date: Optional[str] = None
    due_date: Optional[str] = None
    progress: float = 0.0
    sub_task_ids: Optional[Dict[str, float]] = {}  # 格式: {"task_id": weight}，例如 {"1": 0.7, "2": 0.3}

class LongTermTaskCreate(LongTermTaskBase):
    pass

class LongTermTask(LongTermTaskBase):
    id: int
    subtasks: Optional[List[Task]] = []
    created_at: str

    class Config:
        from_attributes = True

class Journal(BaseModel):
    date: str
    user_id: int
    content: str

    class Config:
        from_attributes = True

class AiMessage(BaseModel):
    id: int
    user_id: int
    title: Optional[str]
    timestamp: str
    messages: List[List[Dict[str, Any]]]

    class Config:
        from_attributes = True

class SettingsBase(BaseModel):
    user_id: int
    primary: str
    bg: str
    card: str
    text: str
    theme_mode: str = "light"

class SettingsCreate(SettingsBase):
    pass

class SettingsUpdate(BaseModel):
    primary: Optional[str] = None
    bg: Optional[str] = None
    card: Optional[str] = None
    text: Optional[str] = None
    theme_mode: Optional[str] = None

class Settings(SettingsBase):
    id: int
    
    class Config:
        from_attributes = True

class AIConfigBase(BaseModel):
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
    pass

class AIConfigUpdate(BaseModel):
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

class AIConfig(AIConfigBase):
    id: int
    class Config:
        from_attributes = True
