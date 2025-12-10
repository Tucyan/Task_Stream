# 初始化数据库脚本（可选，根据实际需要迁移）
from core.database import engine
from models.models import Base

Base.metadata.create_all(bind=engine)
