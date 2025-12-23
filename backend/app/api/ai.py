from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import SessionLocal
from app.core.config import OPENAI_MODEL
from app.schemas import schemas
from app.services import ai_config_service, ai_service, ai_output_manager
from sse_starlette.sse import EventSourceResponse
import json
import datetime
from typing import List

router = APIRouter()

def _now_ts():
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]

def _log(layer: str, message: str, **fields):
    payload = ""
    if fields:
        try:
            payload = " " + json.dumps(fields, ensure_ascii=False, default=str)
        except Exception:
            payload = " " + str(fields)
    print(f"[TS][{layer}] {_now_ts()} {message}{payload}")

async def get_db():
    async with SessionLocal() as db:
        yield db

# --- 配置 ---
@router.get("/config/{user_id}", response_model=schemas.AIConfig)
async def get_ai_config(user_id: int, db: AsyncSession = Depends(get_db)):
    config = await ai_config_service.get_ai_config(db, user_id)
    if not config:
        default_config = schemas.AIConfigCreate(
            user_id=user_id,
            api_key="",
            model=OPENAI_MODEL
        )
        config = await ai_config_service.create_ai_config(db, default_config)
    return config

@router.put("/config/{user_id}", response_model=schemas.AIConfig)
async def update_ai_config(user_id: int, config: schemas.AIConfigUpdate, db: AsyncSession = Depends(get_db)):
    updated = await ai_config_service.update_ai_config(db, user_id, config)
    if not updated:
        raise HTTPException(status_code=404, detail="Config not found")
    return updated

# --- 对话 ---
@router.get("/dialogues", response_model=List[dict])
async def get_dialogues(user_id: int, db: AsyncSession = Depends(get_db)):
    return await ai_config_service.get_dialogues(db, user_id)

@router.get("/dialogues/{dialogue_id}", response_model=schemas.AiMessage)
async def get_dialogue(dialogue_id: int, user_id: int, db: AsyncSession = Depends(get_db)):
    d = await ai_config_service.get_dialogue(db, dialogue_id, user_id)
    if not d:
        raise HTTPException(status_code=404, detail="Dialogue not found")
    return d

@router.post("/dialogues")
async def create_dialogue(request: dict, db: AsyncSession = Depends(get_db)):
    user_id = request.get("user_id")
    title = request.get("title")
    return await ai_config_service.create_dialogue(db, user_id, title)

@router.put("/dialogues/{dialogue_id}/title")
async def update_dialogue_title(dialogue_id: int, request: dict, db: AsyncSession = Depends(get_db)):
    user_id = request.get("user_id")
    title = request.get("title")
    success = await ai_config_service.update_dialogue_title(db, dialogue_id, user_id, title)
    if not success:
        raise HTTPException(status_code=404, detail="Dialogue not found")
    return {"success": True}

@router.delete("/dialogues/{dialogue_id}")
async def delete_dialogue(dialogue_id: int, user_id: int, db: AsyncSession = Depends(get_db)):
    success = await ai_config_service.delete_dialogue(db, dialogue_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Dialogue not found")
    return {"success": True}

# --- Stream ---
@router.post("/dialogues/{dialogue_id}/messages/stream")
async def stream_chat(dialogue_id: int, request: Request):
    data = await request.json()
    user_id = data.get("user_id")
    content = data.get("content")
    _log("api.ai.stream_chat", "request", dialogue_id=dialogue_id, user_id=user_id, content_len=len(content or ""))
    
    if not user_id or not content:
        _log("api.ai.stream_chat", "bad_request", dialogue_id=dialogue_id, user_id=user_id)
        raise HTTPException(status_code=400, detail="Missing user_id or content")
        
    output_manager = await ai_service.run_chat_stream(user_id, dialogue_id, content)
    
    async def event_generator():
        _log("api.ai.event_generator", "start", dialogue_id=dialogue_id, user_id=user_id)
        event_count = 0
        partial_count = 0
        try:
            _log("api.ai.event_generator", "yield.ready", dialogue_id=dialogue_id, user_id=user_id)
            yield {"event": "ready", "data": json.dumps({"pad": " " * 4096})}
            while True:
                item = await output_manager.queue.get()
                event_count += 1
                
                if item is None:
                    _log("api.ai.event_generator", "recv.none", dialogue_id=dialogue_id, user_id=user_id, event_count=event_count)
                    break
                
                ev = item.get("event")
                if ev == "partial_text":
                    partial_count += 1
                    if partial_count <= 5 or partial_count % 50 == 0:
                        _log("api.ai.event_generator", "yield.partial_text", dialogue_id=dialogue_id, user_id=user_id, seq=partial_count)
                else:
                    _log("api.ai.event_generator", "yield.event", dialogue_id=dialogue_id, user_id=user_id, event=ev, event_count=event_count)
                yield item
        except Exception as e:
            _log("api.ai.event_generator", "error", dialogue_id=dialogue_id, user_id=user_id, err=str(e))
            yield {"event": "error", "data": json.dumps({"message": str(e)})}
        finally:
            _log("api.ai.event_generator", "end", dialogue_id=dialogue_id, user_id=user_id, total_events=event_count, partial_events=partial_count)
            
    return EventSourceResponse(
        event_generator(),
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )

# --- 动作 ---
@router.post("/actions/{action_id}/confirm")
def confirm_action(action_id: str, request: dict):
    success = ai_output_manager.global_action_manager.confirm_action(action_id)
    if not success:
         raise HTTPException(status_code=404, detail="Action not found or timeout")
    return {"success": True}

@router.post("/actions/{action_id}/cancel")
def cancel_action(action_id: str, request: dict):
    success = ai_output_manager.global_action_manager.cancel_action(action_id)
    if not success:
         raise HTTPException(status_code=404, detail="Action not found or timeout")
    return {"success": True}
