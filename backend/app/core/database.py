"""
模块名称：database
模块功能：数据库配置和连接管理
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 数据库连接URL：使用SQLite数据库，文件名为task_stream.db
SQLALCHEMY_DATABASE_URL = "sqlite:///./task_stream.db"

# 创建数据库引擎
# connect_args={"check_same_thread": False}：SQLite特定配置，允许在多线程中使用
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

# 创建会话工厂
# autocommit=False：不自动提交事务
# autoflush=False：不自动刷新会话
# bind=engine：绑定到创建的数据库引擎
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 创建基类
# 所有数据库模型都将继承这个基类
Base = declarative_base()
