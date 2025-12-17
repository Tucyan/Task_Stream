"""
模块名称：models
模块功能：定义数据库模型，映射数据库表结构
"""

from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Float, Text, PrimaryKeyConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base
import datetime


class User(Base):
    """
    用户模型
    对应数据库表：users
    """
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)  # 用户ID，主键
    username = Column(String, unique=True, nullable=False)  # 用户名，唯一且必填
    created_at = Column(String, nullable=False)  # 创建时间，必填
    name = Column(String, nullable=True)  # 用户昵称，可选
    passwordHash = Column(String, nullable=False)  # 密码哈希值，必填


class Task(Base):
    """
    任务模型
    对应数据库表：tasks
    描述：短期任务表，存储用户的日常任务
    """
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)  # 任务ID，主键
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # 用户ID，外键，必填
    title = Column(String, nullable=False)  # 任务标题，必填
    description = Column(Text, nullable=True)  # 任务描述，可选
    status = Column(Integer, nullable=False)  # 任务状态，必填
    due_date = Column(String, nullable=True)  # 截止日期，可选
    created_at = Column(String, nullable=False)  # 创建时间，必填
    updated_at = Column(String, nullable=False)  # 更新时间，必填
    assigned_date = Column(String, nullable=True)  # 分配日期，可选
    assigned_start_time = Column(String, nullable=True)  # 分配开始时间，可选
    assigned_end_time = Column(String, nullable=True)  # 分配结束时间，可选
    tags = Column(Text, nullable=True)  # 标签，可选
    record_result = Column(Integer, default=0)  # 记录结果，默认0
    result = Column(Text, nullable=True)  # 结果内容，可选
    result_picture_url = Column(Text, nullable=True)  # 结果图片URL，可选
    long_term_task_id = Column(Integer, ForeignKey("long_term_tasks.id"), nullable=True)  # 关联的长期任务ID，外键，可选
    
    # 定义与长期任务的关系
    long_term_task = relationship("LongTermTask", back_populates="tasks")


class LongTermTask(Base):
    """
    长期任务模型
    对应数据库表：long_term_tasks
    描述：长期任务表，存储用户的长期目标和项目
    """
    __tablename__ = "long_term_tasks"
    id = Column(Integer, primary_key=True, index=True)  # 长期任务ID，主键
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # 用户ID，外键，必填
    title = Column(String, nullable=False)  # 长期任务标题，必填
    description = Column(Text, nullable=True)  # 长期任务描述，可选
    start_date = Column(String, nullable=True)  # 开始日期，可选
    due_date = Column(String, nullable=True)  # 截止日期，可选
    progress = Column(Float, nullable=False, default=0.0)  # 进度，必填，默认0.0
    created_at = Column(String, nullable=False)  # 创建时间，必填
    sub_task_ids = Column(Text, nullable=True)  # 子任务ID列表，JSON格式: {"task_id": weight}，例如 {"1": 0.7, "2": 0.3}
    
    # 定义与任务的关系
    tasks = relationship("Task", back_populates="long_term_task")


class Journal(Base):
    """
    日记模型
    对应数据库表：journals
    描述：用户日记表，按日期存储用户的日记内容
    """
    __tablename__ = "journals"
    date = Column(String, nullable=False)  # 日记日期，必填
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # 用户ID，外键，必填
    content = Column(Text, nullable=False)  # 日记内容，必填
    __table_args__ = (
        PrimaryKeyConstraint('date', 'user_id'),  # 复合主键：日期+用户ID
    )


class AIAssistantMessage(Base):
    """
    AI助手消息模型
    对应数据库表：ai_assistant_messages
    描述：存储AI助手的对话历史和消息
    """
    __tablename__ = "ai_assistant_messages"
    id = Column(Integer, primary_key=True, index=True)  # 消息ID，主键
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # 用户ID，外键，必填
    title = Column(String, nullable=True)  # 对话标题，可选
    timestamp = Column(String, nullable=False)  # 时间戳，必填
    messages = Column(Text, nullable=False)  # 消息内容，JSON格式，必填


class AIConfig(Base):
    """
    AI配置模型
    对应数据库表：ai_configs
    描述：存储用户的AI配置信息
    """
    __tablename__ = "ai_configs"
    id = Column(Integer, primary_key=True, index=True)  # 配置ID，主键
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # 用户ID，外键，必填
    api_key = Column(Text, nullable=False)  # API密钥，必填
    model = Column(Text, nullable=False)  # AI模型名称，必填
    prompt = Column(Text, nullable=True)  # 提示词，可选
    character = Column(Text, nullable=True)  # 角色设定，可选
    long_term_memory = Column(Text, nullable=True)  # 长期记忆，可选
    ai_dialogue_id_list = Column(Text, nullable=True)  # AI对话ID列表，可选
    is_enable_prompt = Column(Integer, nullable=False, default=0)  # 是否启用提示词，必填，默认0
    is_auto_confirm_create_request = Column(Integer, nullable=False, default=0)  # 是否自动确认创建请求，必填，默认0
    is_auto_confirm_update_request = Column(Integer, nullable=False, default=0)  # 是否自动确认更新请求，必填，默认0
    is_auto_confirm_delete_request = Column(Integer, nullable=False, default=0)  # 是否自动确认删除请求，必填，默认0
    is_auto_confirm_create_reminder = Column(Integer, nullable=False, default=0)  # 是否自动确认创建提醒，必填，默认0
    reminder_list = Column(Text, nullable=True)  # 提醒列表，可选


class Settings(Base):
    """
    设置模型
    对应数据库表：settings
    描述：存储用户的应用设置
    """
    __tablename__ = "settings"
    id = Column(Integer, primary_key=True, index=True)  # 设置ID，主键
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # 用户ID，外键，必填
    primary = Column(String, nullable=False)  # 主题主色调，必填
    bg = Column(String, nullable=False)  # 背景色，必填
    card = Column(String, nullable=False)  # 卡片颜色，必填
    text = Column(String, nullable=False)  # 文本颜色，必填
    theme_mode = Column(String, default="light")  # 主题模式，默认light


class Memo(Base):
    """
    备忘录模型
    对应数据库表：memos
    描述：存储用户的备忘录内容
    """
    __tablename__ = "memos"
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)  # 用户ID，外键，主键
    content = Column(Text, nullable=True)  # 备忘录内容，可选
    updated_at = Column(String, nullable=False)  # 更新时间，必填
