from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.core.config import OPENAI_MODEL
from app.schemas import schemas
from app.services import ai_config_service, ai_service, ai_output_manager
from sse_starlette.sse import EventSourceResponse
import json
from typing import List

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- Config ---
@router.get("/config/{user_id}", response_model=schemas.AIConfig)
def get_ai_config(user_id: int, db: Session = Depends(get_db)):
    config = ai_config_service.get_ai_config(db, user_id)
    if not config:
        default_config = schemas.AIConfigCreate(
            user_id=user_id,
            api_key="",
            model=OPENAI_MODEL
        )
        config = ai_config_service.create_ai_config(db, default_config)
    return config

@router.put("/config/{user_id}", response_model=schemas.AIConfig)
def update_ai_config(user_id: int, config: schemas.AIConfigUpdate, db: Session = Depends(get_db)):
    updated = ai_config_service.update_ai_config(db, user_id, config)
    if not updated:
        raise HTTPException(status_code=404, detail="Config not found")
    return updated

# --- Dialogues ---
@router.get("/dialogues", response_model=List[dict])
def get_dialogues(user_id: int, db: Session = Depends(get_db)):
    return ai_config_service.get_dialogues(db, user_id)

@router.get("/dialogues/{dialogue_id}", response_model=schemas.AiMessage)
def get_dialogue(dialogue_id: int, user_id: int, db: Session = Depends(get_db)):
    d = ai_config_service.get_dialogue(db, dialogue_id, user_id)
    if not d:
        raise HTTPException(status_code=404, detail="Dialogue not found")
    return d

@router.post("/dialogues")
def create_dialogue(request: dict, db: Session = Depends(get_db)):
    user_id = request.get("user_id")
    title = request.get("title")
    return ai_config_service.create_dialogue(db, user_id, title)

@router.put("/dialogues/{dialogue_id}/title")
def update_dialogue_title(dialogue_id: int, request: dict, db: Session = Depends(get_db)):
    user_id = request.get("user_id")
    title = request.get("title")
    success = ai_config_service.update_dialogue_title(db, dialogue_id, user_id, title)
    if not success:
        raise HTTPException(status_code=404, detail="Dialogue not found")
    return {"success": True}

@router.delete("/dialogues/{dialogue_id}")
def delete_dialogue(dialogue_id: int, user_id: int, db: Session = Depends(get_db)):
    success = ai_config_service.delete_dialogue(db, dialogue_id, user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Dialogue not found")
    return {"success": True}

# --- Stream ---
@router.post("/dialogues/{dialogue_id}/messages/stream")
async def stream_chat(dialogue_id: int, request: Request):
    print(f"DEBUG_TRACE: stream_chat request received for dialogue {dialogue_id}")
    data = await request.json()
    user_id = data.get("user_id")
    content = data.get("content")
    print(f"DEBUG_TRACE: User ID: {user_id}, Content: {content[:50]}...")
    
    if not user_id or not content:
        print("DEBUG_TRACE: Missing user_id or content")
        raise HTTPException(status_code=400, detail="Missing user_id or content")
        
    output_manager = await ai_service.run_chat_stream(user_id, dialogue_id, content)
    
    async def event_generator():
        print("DEBUG_TRACE: Starting event_generator loop")
        try:
            while True:
                item = await output_manager.queue.get()
                if item is None:
                    print("DEBUG_TRACE: Received None from queue, breaking loop")
                    break
                # print(f"DEBUG_TRACE: Yielding event: {item.get('event')}") # Optional: reduce noise
                yield item
        except Exception as e:
            print(f"DEBUG_TRACE: Error in event_generator: {e}")
            yield {"event": "error", "data": json.dumps({"message": str(e)})}
        finally:
            print("DEBUG_TRACE: event_generator finished")
            
    return EventSourceResponse(event_generator())

# --- Actions ---
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
