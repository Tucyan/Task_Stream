from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.models import models
from app.core.database import SessionLocal
import hashlib
import datetime

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode('utf-8')).hexdigest()

from pydantic import BaseModel

class RegisterRequest(BaseModel):
    username: str
    passwordHash: str
    nickname: str = None  # 昵称字段，可选

@router.post("/register")
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    username = data.username
    passwordHash = data.passwordHash
    nickname = data.nickname or username  # 如果没有提供昵称，使用用户名作为默认昵称
    
    user = db.query(models.User).filter(models.User.username == username).first()
    if user:
        raise HTTPException(status_code=400, detail="用户名已存在")
    
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
    username: str
    passwordHash: str

@router.post("/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    username = data.username
    passwordHash = data.passwordHash
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user or user.passwordHash != passwordHash:
        raise HTTPException(status_code=401, detail="用户名或密码错误")
    return {"id": user.id, "username": user.username, "nickname": user.name}


class UpdatePasswordRequest(BaseModel):
    user_id: int
    current_password: str
    new_password: str

@router.put("/password")
def update_password(data: UpdatePasswordRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="用户不存在")
    
    current_password_hash = hash_password(data.current_password)
    if user.passwordHash != current_password_hash:
        raise HTTPException(status_code=401, detail="当前密码错误")
    
    new_password_hash = hash_password(data.new_password)
    user.passwordHash = new_password_hash
    db.commit()
    return {"message": "密码更新成功"}


class UpdateNicknameRequest(BaseModel):
    user_id: int
    new_nickname: str

@router.put("/nickname")
def update_nickname(data: UpdateNicknameRequest, db: Session = Depends(get_db)):
    print(f"[后端日志] 开始更新昵称")
    print(f"[后端日志] 请求数据: user_id={data.user_id}, new_nickname={data.new_nickname}")
    
    user = db.query(models.User).filter(models.User.id == data.user_id).first()
    if not user:
        print(f"[后端日志] 用户不存在: user_id={data.user_id}")
        raise HTTPException(status_code=404, detail="用户不存在")
    
    print(f"[后端日志] 找到用户: {user.username}, 当前昵称: {user.name}")
    
    user.name = data.new_nickname
    print(f"[后端日志] 更新用户昵称为: {data.new_nickname}")
    
    db.commit()
    print(f"[后端日志] 数据库提交成功")
    
    # 验证更新是否成功
    updated_user = db.query(models.User).filter(models.User.id == data.user_id).first()
    print(f"[后端日志] 验证更新结果: 用户昵称现在是 {updated_user.name}")
    
    return {"message": "昵称更新成功", "nickname": data.new_nickname}

