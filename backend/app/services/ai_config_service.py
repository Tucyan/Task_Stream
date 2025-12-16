import json
from sqlalchemy.orm import Session
from app.models import models
from app.schemas import schemas
from typing import List, Optional
import datetime

def get_ai_config(db: Session, user_id: int):
    config = db.query(models.AIConfig).filter(models.AIConfig.user_id == user_id).first()
    if config:
        config_dict = config.__dict__.copy()
        if config.ai_dialogue_id_list:
            try:
                config_dict['ai_dialogue_id_list'] = json.loads(config.ai_dialogue_id_list)
            except:
                config_dict['ai_dialogue_id_list'] = []
        else:
            config_dict['ai_dialogue_id_list'] = []
            
        if config.reminder_list:
            try:
                config_dict['reminder_list'] = json.loads(config.reminder_list)
            except:
                config_dict['reminder_list'] = []
        else:
            config_dict['reminder_list'] = []
            
        return schemas.AIConfig(**config_dict)
    return None

def create_ai_config(db: Session, config: schemas.AIConfigCreate):
    db_config = models.AIConfig(
        user_id=config.user_id,
        api_key=config.api_key,
        model=config.model,
        prompt=config.prompt,
        character=config.character,
        long_term_memory=config.long_term_memory,
        ai_dialogue_id_list=json.dumps(config.ai_dialogue_id_list),
        is_enable_prompt=config.is_enable_prompt,
        is_auto_confirm_create_request=config.is_auto_confirm_create_request,
        is_auto_confirm_update_request=config.is_auto_confirm_update_request,
        is_auto_confirm_delete_request=config.is_auto_confirm_delete_request,
        is_auto_confirm_create_reminder=config.is_auto_confirm_create_reminder,
        reminder_list=json.dumps(config.reminder_list)
    )
    db.add(db_config)
    db.commit()
    db.refresh(db_config)
    return get_ai_config(db, config.user_id)

def update_ai_config(db: Session, user_id: int, update_data: schemas.AIConfigUpdate):
    db_config = db.query(models.AIConfig).filter(models.AIConfig.user_id == user_id).first()
    if not db_config:
        return None
    
    update_dict = update_data.dict(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(db_config, key, value)
        
    db.commit()
    db.refresh(db_config)
    return get_ai_config(db, user_id)

# 会话相关
def get_dialogues(db: Session, user_id: int):
    config = db.query(models.AIConfig).filter(models.AIConfig.user_id == user_id).first()
    if not config or not config.ai_dialogue_id_list:
        return []
    
    try:
        id_list = json.loads(config.ai_dialogue_id_list)
    except:
        return []
        
    if not id_list:
        return []

    # 这里的 in_ 只能获取存在的，且顺序不一定
    dialogues = db.query(models.AIAssistantMessage).filter(models.AIAssistantMessage.id.in_(id_list)).all()
    dialogue_map = {d.id: d for d in dialogues}
    result = []
    # 按照 id_list 的逆序返回，或者顺序返回？
    # 通常对话列表是最近的在上面。id_list append 是加在后面。
    # 假设 id_list 是 [old, ..., new]。逆序遍历。
    for dia_id in reversed(id_list):
        if dia_id in dialogue_map:
            d = dialogue_map[dia_id]
            result.append({
                "id": d.id,
                "title": d.title,
                "last_timestamp": d.timestamp
            })
    return result

def get_dialogue(db: Session, dialogue_id: int, user_id: int):
    d = db.query(models.AIAssistantMessage).filter(
        models.AIAssistantMessage.id == dialogue_id,
        models.AIAssistantMessage.user_id == user_id
    ).first()
    if d:
        try:
            messages = json.loads(d.messages)
        except:
            messages = []
        return schemas.AiMessage(
            id=d.id,
            user_id=d.user_id,
            title=d.title,
            timestamp=d.timestamp,
            messages=messages
        )
    return None

def create_dialogue(db: Session, user_id: int, title: str = None):
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    if not title:
        title = f"新对话 {now}"
        
    new_dialogue = models.AIAssistantMessage(
        user_id=user_id,
        title=title,
        timestamp=now,
        messages=json.dumps([])
    )
    db.add(new_dialogue)
    db.commit()
    db.refresh(new_dialogue)
    
    # 更新 AIConfig
    config = db.query(models.AIConfig).filter(models.AIConfig.user_id == user_id).first()
    if config:
        try:
            id_list = json.loads(config.ai_dialogue_id_list) if config.ai_dialogue_id_list else []
        except:
            id_list = []
        id_list.append(new_dialogue.id)
        config.ai_dialogue_id_list = json.dumps(id_list)
        db.commit()
    else:
        # 如果没有配置，应该先创建配置？或者忽略。
        # 最好是先创建默认配置。但这里为了鲁棒性，先不处理。
        pass
        
    return get_dialogue(db, new_dialogue.id, user_id)

def delete_dialogue(db: Session, dialogue_id: int, user_id: int):
    d = db.query(models.AIAssistantMessage).filter(
        models.AIAssistantMessage.id == dialogue_id,
        models.AIAssistantMessage.user_id == user_id
    ).first()
    if d:
        db.delete(d)
        config = db.query(models.AIConfig).filter(models.AIConfig.user_id == user_id).first()
        if config and config.ai_dialogue_id_list:
            try:
                id_list = json.loads(config.ai_dialogue_id_list)
                if dialogue_id in id_list:
                    id_list.remove(dialogue_id)
                    config.ai_dialogue_id_list = json.dumps(id_list)
            except:
                pass
        db.commit()
        return True
    return False

def update_dialogue_title(db: Session, dialogue_id: int, user_id: int, title: str):
    d = db.query(models.AIAssistantMessage).filter(
        models.AIAssistantMessage.id == dialogue_id,
        models.AIAssistantMessage.user_id == user_id
    ).first()
    if d:
        d.title = title
        db.commit()
        return True
    return False

def update_dialogue_messages(db: Session, dialogue_id: int, messages: List[dict]):
    d = db.query(models.AIAssistantMessage).filter(models.AIAssistantMessage.id == dialogue_id).first()
    if d:
        d.messages = json.dumps(messages)
        d.timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        db.commit()
