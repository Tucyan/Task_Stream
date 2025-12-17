"""
模块名称：auth
模块功能：用户认证相关路由和逻辑处理
包括注册、登录、密码更新、昵称更新等功能
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.models import models
from app.core.database import SessionLocal
import hashlib
import datetime

# 创建路由实例
router = APIRouter()


def get_db():
    """
    获取数据库会话
    
    返回值：
        Session: 数据库会话对象
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def hash_password(password: str) -> str:
    """
    对密码进行哈希处理
    
    参数：
        password (str): 原始密码
    
    返回值：
        str: 哈希后的密码
    """
    return hashlib.sha256(password.encode('utf-8')).hexdigest()


from pydantic import BaseModel


class RegisterRequest(BaseModel):
    """
    注册请求模型
    
    属性：
        username (str): 用户名
        passwordHash (str): 密码哈希值
        nickname (str, optional): 昵称，可选
    """
    username: str
    passwordHash: str
    nickname: str = None  # 昵称字段，可选


@router.post("/register")
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    """
    用户注册接口
    
    参数：
        data (RegisterRequest): 注册请求数据
        db (Session): 数据库会话
    
    返回值：
        dict: 注册成功后的用户信息
    
    异常：
        HTTPException: 用户名已存在时抛出400错误
    """
    username = data.username
    passwordHash = data.passwordHash
    nickname = data.nickname or username  # 如果没有提供昵称，使用用户名作为默认昵称
    
    # 检查用户名是否已存在
    user = db.query(models.User).filter(models.User.username == username).first()
    if user:
        raise HTTPException(status_code=400, detail="用户名已存在")
    
    # 创建新用户
    new_user = models.User(
        username=username,
        passwordHash=passwordHash,
        created_at=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        name=nickname  # 使用昵称作为显示名称
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    return {"id": new_user.id, "username": new_user.username, "nickname": nickname}


from pydantic import BaseModel


class LoginRequest(BaseModel):
    """
    登录请求模型
    
    属性：
        username (str): 用户名
        passwordHash (str): 密码哈希值
    """
    username: str
    passwordHash: str


@router.post("/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    """
    用户登录接口
    
    参数：
        data (LoginRequest): 登录请求数据
        db (Session): 数据库会话
    
    返回值：
        dict: 登录成功后的用户信息
    
    异常：
        HTTPException: 用户名或密码错误时抛出401错误
    """
    username = data.username
    passwordHash = data.passwordHash
    
    # 查找用户并验证密码
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user or user.passwordHash != passwordHash:
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    
    return {"id": user.id, "username": user.username, "nickname": user.name}


class UpdatePasswordRequest(BaseModel):
    """
    更新密码请求模型
    
    属性：
        user_id (int): 用户ID
        current_password (str): 当前密码
        new_password (str): 新密码
    """
    user_id: int
    current_password: str
    new_password: str


@router.put("/password")
def update_password(data: UpdatePasswordRequest, db: Session = Depends(get_db)):
    """
    更新密码接口
    
    参数：
        data (UpdatePasswordRequest): 更新密码请求数据
        db (Session): 数据库会话
    
    返回值：
        dict: 更新成功消息
    
    异常：
        HTTPException: 用户不存在时抛出404错误
        HTTPException: 当前密码错误时抛出401错误
    """
    # 查找用户
    user = db.query(models.User).filter(models.User.id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    # 验证当前密码
    current_password_hash = hash_password(data.current_password)
    if user.passwordHash != current_password_hash:
        raise HTTPException(status_code=401, detail="当前密码错误")
    
    # 更新密码
    new_password_hash = hash_password(data.new_password)
    user.passwordHash = new_password_hash
    db.commit()
    
    return {"message": "密码更新成功"}


class UpdateNicknameRequest(BaseModel):
    """
    更新昵称请求模型
    
    属性：
        user_id (int): 用户ID
        new_nickname (str): 新昵称
    """
    user_id: int
    new_nickname: str


@router.put("/nickname")
def update_nickname(data: UpdateNicknameRequest, db: Session = Depends(get_db)):
    """
    更新昵称接口
    
    参数：
        data (UpdateNicknameRequest): 更新昵称请求数据
        db (Session): 数据库会话
    
    返回值：
        dict: 更新成功消息和新昵称
    
    异常：
        HTTPException: 用户不存在时抛出404错误
    """
    print(f"[后端日志] 开始更新昵称")
    print(f"[后端日志] 请求数据: user_id={data.user_id}, new_nickname={data.new_nickname}")
    
    # 查找用户
    user = db.query(models.User).filter(models.User.id == data.user_id).first()
    if not user:
        print(f"[后端日志] 用户不存在: user_id={data.user_id}")
        raise HTTPException(status_code=404, detail="用户不存在")
    
    print(f"[后端日志] 找到用户: {user.username}, 当前昵称: {user.name}")
    
    # 更新昵称
    user.name = data.new_nickname
    print(f"[后端日志] 更新用户昵称为: {data.new_nickname}")
    
    db.commit()
    print(f"[后端日志] 数据库提交成功")
    
    # 验证更新是否成功
    updated_user = db.query(models.User).filter(models.User.id == data.user_id).first()
    print(f"[后端日志] 验证更新结果: 用户昵称现在是 {updated_user.name}")
    
    return {"message": "昵称更新成功", "nickname": data.new_nickname}

