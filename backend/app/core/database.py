from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.ext.declarative import declarative_base

# 数据库连接 URL (使用 sqlite+aiosqlite)
SQLALCHEMY_DATABASE_URL = "sqlite+aiosqlite:///./task_stream.db"

# 创建异步数据库引擎
engine = create_async_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
# 创建异步数据库会话工厂
SessionLocal = async_sessionmaker(autocommit=False, autoflush=False, bind=engine, class_=AsyncSession)
# 创建声明性基类，用于模型定义
Base = declarative_base()
