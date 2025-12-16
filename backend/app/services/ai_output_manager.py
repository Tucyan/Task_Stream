import asyncio
import json
from typing import Dict, Any, List, Optional

# 全局动作管理器
class ActionManager:
    def __init__(self):
        self.pending_events: Dict[str, asyncio.Event] = {}
        self.results: Dict[str, bool] = {}

    async def wait_for_action(self, action_id: str, timeout: int = 600) -> bool:
        print(f"DEBUG_TRACE: wait_for_action {action_id} waiting (timeout={timeout})")
        event = asyncio.Event()
        self.pending_events[action_id] = event
        try:
            await asyncio.wait_for(event.wait(), timeout=timeout)
            res = self.results.get(action_id, False)
            print(f"DEBUG_TRACE: wait_for_action {action_id} resumed, result={res}")
            return res
        except asyncio.TimeoutError:
            print(f"DEBUG_TRACE: wait_for_action {action_id} timeout")
            return False
        finally:
            self.pending_events.pop(action_id, None)
            self.results.pop(action_id, None)

    def confirm_action(self, action_id: str):
        print(f"DEBUG_TRACE: confirm_action {action_id} called")
        if action_id in self.pending_events:
            self.results[action_id] = True
            self.pending_events[action_id].set()
            print(f"DEBUG_TRACE: confirm_action {action_id} success")
            return True
        print(f"DEBUG_TRACE: confirm_action {action_id} failed (not found)")
        return False

    def cancel_action(self, action_id: str):
        print(f"DEBUG_TRACE: cancel_action {action_id} called")
        if action_id in self.pending_events:
            self.results[action_id] = False
            self.pending_events[action_id].set()
            print(f"DEBUG_TRACE: cancel_action {action_id} success")
            return True
        print(f"DEBUG_TRACE: cancel_action {action_id} failed (not found)")
        return False

global_action_manager = ActionManager()

class OutputManager:
    def __init__(self):
        self.queue = asyncio.Queue()
        # mixed_buffer 存储按顺序产生的所有内容片段
        # 结构示例: [{"type": 0, "data": {"content": "..."}}, {"type": 1, "data": {...}}]
        self.mixed_buffer = [] 
        # current_text_buffer 用于临时累积当前的文本片段，以便合并存储
        self.current_text_buffer = []

    def _flush_text_buffer(self):
        """将当前累积的文本合并为一个 type=0 的片段放入 mixed_buffer"""
        if self.current_text_buffer:
            full_text = "".join(self.current_text_buffer)
            self.mixed_buffer.append({"type": 0, "data": {"content": full_text}})
            self.current_text_buffer = []

    async def stream_text(self, text: str):
        self.current_text_buffer.append(text)
        # 实时发送 SSE 事件
        await self.queue.put({
            "event": "partial_text",
            "data": json.dumps({"content": text, "delta": text, "finished": False})
        })

    async def send_card(self, card_data: dict, need_confirm: bool) -> bool:
        # 在发送卡片前，先 flush 之前的文本
        self._flush_text_buffer()
        
        import uuid
        if "action_id" not in card_data:
            action_id = str(uuid.uuid4())
            card_data["action_id"] = action_id
        else:
            action_id = card_data["action_id"]
            
        # 如果不需要确认，直接标记为已确认
        if not need_confirm:
            card_data["user_confirmation"] = "Y"
            
        # 将卡片放入 mixed_buffer
        self.mixed_buffer.append(card_data)
        
        print(f"DEBUG: OutputManager sending card {action_id}, need_confirm={need_confirm}")
        
        # 实时发送 SSE 事件
        await self.queue.put({
            "event": "cards", 
            "data": json.dumps({"cards": [card_data]})
        })

        if not need_confirm:
            return True

        # 使用全局管理器挂起
        print(f"DEBUG: Waiting for action {action_id}...")
        result = await global_action_manager.wait_for_action(action_id)
        print(f"DEBUG: Action {action_id} finished with result {result}")
        
        card_data["user_confirmation"] = "Y" if result else "N"
        
        return result

    async def end_stream(self, dialogue_id: int):
        # 结束前 flush 最后的文本
        self._flush_text_buffer()
        
        # 发送 text_done (虽然在 interleaved 模式下可能不再是必须的，但为了兼容性保留)
        # 这里 text_done 只发送所有的文本合并内容，或者可以省略，视前端需求而定。
        # 为了不破坏现有逻辑，我们还是计算一个纯文本版本发送，但前端可能需要改为依赖 stream 过程。
        
        # 构建完整纯文本（仅用于 text_done 事件的兼容）
        all_text = "".join([
            item["data"]["content"] 
            for item in self.mixed_buffer 
            if item["type"] == 0
        ])
        
        await self.queue.put({
            "event": "text_done",
            "data": json.dumps({"content": all_text})
        })
        
        await self.queue.put({
            "event": "end",
            "data": json.dumps({"dialogue_id": dialogue_id})
        })
        await self.queue.put(None)

    async def send_error(self, message: str):
        await self.queue.put({
            "event": "error",
            "data": json.dumps({"message": message})
        })
        await self.queue.put(None)

    def get_final_content(self) -> List[dict]:
        # 结束前确保 flush
        self._flush_text_buffer()
        # 直接返回 mixed_buffer，它已经包含了按顺序排列的文本和卡片
        return self.mixed_buffer
