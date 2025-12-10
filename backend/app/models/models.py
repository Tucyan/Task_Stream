from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Float, Text, PrimaryKeyConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base
import datetime

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, nullable=False)
    created_at = Column(String, nullable=False)
    name = Column(String, nullable=True)
    passwordHash = Column(String, nullable=False)

class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Integer, nullable=False)
    due_date = Column(String, nullable=True)
    created_at = Column(String, nullable=False)
    updated_at = Column(String, nullable=False)
    assigned_date = Column(String, nullable=True)
    assigned_start_time = Column(String, nullable=True)
    assigned_end_time = Column(String, nullable=True)
    tags = Column(Text, nullable=True)
    record_result = Column(Integer, default=0)
    result = Column(Text, nullable=True)
    result_picture_url = Column(Text, nullable=True)
    long_term_task_id = Column(Integer, ForeignKey("long_term_tasks.id"), nullable=True)
    
    # 定义与长期任务的关系
    long_term_task = relationship("LongTermTask", back_populates="tasks")

class LongTermTask(Base):
    __tablename__ = "long_term_tasks"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    start_date = Column(String, nullable=True)
    due_date = Column(String, nullable=True)
    progress = Column(Float, nullable=False, default=0.0)
    created_at = Column(String, nullable=False)
    sub_task_ids = Column(Text, nullable=True)  # JSON格式: {"task_id": weight}，例如 {"1": 0.7, "2": 0.3}
    
    # 定义与任务的关系
    tasks = relationship("Task", back_populates="long_term_task")

class Journal(Base):
    __tablename__ = "journals"
    date = Column(String, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    __table_args__ = (
        PrimaryKeyConstraint('date', 'user_id'),
    )

class AIAssistantMessage(Base):
    __tablename__ = "ai_assistant_messages"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String, nullable=True)
    timestamp = Column(String, nullable=False)
    messages = Column(Text, nullable=False)

class Settings(Base):
    __tablename__ = "settings"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    primary = Column(String, nullable=False)
    bg = Column(String, nullable=False)
    card = Column(String, nullable=False)
    text = Column(String, nullable=False)
    theme_mode = Column(String, default="light")

class Memo(Base):
    __tablename__ = "memos"
    user_id = Column(Integer, ForeignKey("users.id"), primary_key=True)
    content = Column(Text, nullable=True)
    updated_at = Column(String, nullable=False)
