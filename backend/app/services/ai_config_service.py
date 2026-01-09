import json
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update
from app.models import models
from app.schemas import schemas
from typing import List, Optional
import datetime

async def get_ai_config(db: AsyncSession, user_id: int):
    """获取用户的 AI 配置"""
    result = await db.execute(select(models.AIConfig).filter(models.AIConfig.user_id == user_id))
    config = result.scalars().first()
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

async def create_ai_config(db: AsyncSession, config: schemas.AIConfigCreate):
    """创建用户的 AI 配置"""
    db_config = models.AIConfig(
        user_id=config.user_id,
        api_key=config.api_key,
        model=config.model,
        openai_base_url=config.openai_base_url,
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
    await db.commit()
    await db.refresh(db_config)
    return await get_ai_config(db, config.user_id)

async def update_ai_config(db: AsyncSession, user_id: int, update_data: schemas.AIConfigUpdate):
    """更新用户的 AI 配置"""
    result = await db.execute(select(models.AIConfig).filter(models.AIConfig.user_id == user_id))
    db_config = result.scalars().first()
    if not db_config:
        return None
    
    update_dict = update_data.dict(exclude_unset=True)
    for key, value in update_dict.items():
        if key == "ai_dialogue_id_list":
            setattr(db_config, key, json.dumps(value or []))
            continue
        if key == "reminder_list":
            setattr(db_config, key, json.dumps(value or []))
            continue
        setattr(db_config, key, value)
        
    await db.commit()
    await db.refresh(db_config)
    return await get_ai_config(db, user_id)

# 会话相关
async def get_dialogues(db: AsyncSession, user_id: int):
    """获取用户的所有对话列表"""
    result = await db.execute(select(models.AIConfig).filter(models.AIConfig.user_id == user_id))
    config = result.scalars().first()
    if not config or not config.ai_dialogue_id_list:
        return []
    
    try:
        id_list = json.loads(config.ai_dialogue_id_list)
    except:
        return []
        
    if not id_list:
        return []

    # 这里的 in_ 只能获取存在的，且顺序不一定
    result = await db.execute(select(models.AIAssistantMessage).filter(models.AIAssistantMessage.id.in_(id_list)))
    dialogues = result.scalars().all()
    dialogue_map = {d.id: d for d in dialogues}
    result_list = []
    # 按照 id_list 的逆序返回，或者顺序返回？
    # 通常对话列表是最近的在上面。id_list append 是加在后面。
    # 假设 id_list 是 [old, ..., new]。逆序遍历。
    for dia_id in reversed(id_list):
        if dia_id in dialogue_map:
            d = dialogue_map[dia_id]
            result_list.append({
                "id": d.id,
                "title": d.title,
                "last_timestamp": d.timestamp
            })
    return result_list

async def get_dialogue(db: AsyncSession, dialogue_id: int, user_id: int):
    """获取指定 ID 的对话详情"""
    result = await db.execute(select(models.AIAssistantMessage).filter(
        models.AIAssistantMessage.id == dialogue_id,
        models.AIAssistantMessage.user_id == user_id
    ))
    d = result.scalars().first()
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

async def create_dialogue(db: AsyncSession, user_id: int, title: str = None):
    """创建新对话"""
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
    await db.commit()
    await db.refresh(new_dialogue)
    new_id = new_dialogue.id
    
    # 更新 AIConfig
    result = await db.execute(select(models.AIConfig).filter(models.AIConfig.user_id == user_id))
    config = result.scalars().first()
    if config:
        try:
            id_list = json.loads(config.ai_dialogue_id_list) if config.ai_dialogue_id_list else []
        except:
            id_list = []
        id_list.append(new_id)
        config.ai_dialogue_id_list = json.dumps(id_list)
        await db.commit()
    else:
        # 如果没有配置，应该先创建配置？或者忽略。
        # 最好是先创建默认配置。但这里为了鲁棒性，先不处理。
        pass
        
    return await get_dialogue(db, new_id, user_id)

async def delete_dialogue(db: AsyncSession, dialogue_id: int, user_id: int):
    """删除指定对话"""
    result = await db.execute(select(models.AIAssistantMessage).filter(
        models.AIAssistantMessage.id == dialogue_id,
        models.AIAssistantMessage.user_id == user_id
    ))
    d = result.scalars().first()
    if d:
        await db.delete(d)
        result = await db.execute(select(models.AIConfig).filter(models.AIConfig.user_id == user_id))
        config = result.scalars().first()
        if config and config.ai_dialogue_id_list:
            try:
                id_list = json.loads(config.ai_dialogue_id_list)
                if dialogue_id in id_list:
                    id_list.remove(dialogue_id)
                    config.ai_dialogue_id_list = json.dumps(id_list)
            except:
                pass
        await db.commit()
        return True
    return False

async def update_dialogue_title(db: AsyncSession, dialogue_id: int, user_id: int, title: str):
    """更新对话标题"""
    result = await db.execute(select(models.AIAssistantMessage).filter(
        models.AIAssistantMessage.id == dialogue_id,
        models.AIAssistantMessage.user_id == user_id
    ))
    d = result.scalars().first()
    if d:
        d.title = title
        await db.commit()
        return True
    return False

async def update_dialogue_messages(db: AsyncSession, dialogue_id: int, messages: List[dict]):
    """更新对话消息内容"""
    result = await db.execute(select(models.AIAssistantMessage).filter(models.AIAssistantMessage.id == dialogue_id))
    d = result.scalars().first()
    if d:
        d.messages = json.dumps(messages)
        d.timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        await db.commit()
