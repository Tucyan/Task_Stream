# AI输出管理模块
# 负责管理AI输出流、卡片发送和用户确认处理
import asyncio
import json
import datetime
import time
from typing import Dict, Any, List, Optional

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

# 全局动作管理器
class ActionManager:
    def __init__(self):
        """
        初始化动作管理器
        
        属性:
            pending_events: 存储待处理动作的事件字典
            results: 存储动作结果的字典
        """
        self.pending_events: Dict[str, asyncio.Event] = {}
        self.results: Dict[str, bool] = {}

    async def wait_for_action(self, action_id: str, timeout: int = 30) -> bool:
        """
        等待指定动作的结果
        
        参数:
            action_id: 动作ID
            timeout: 超时时间，默认为30秒
        
        返回:
            bool: 动作结果，True表示确认，False表示取消或超时
        """
        _log("ai_output_manager.action", "wait.begin", action_id=action_id, timeout_s=timeout)
        event = asyncio.Event()
        self.pending_events[action_id] = event
        try:
            await asyncio.wait_for(event.wait(), timeout=timeout)
            res = self.results.get(action_id, False)
            _log("ai_output_manager.action", "wait.end", action_id=action_id, result=res)
            return res
        except asyncio.TimeoutError:
            _log("ai_output_manager.action", "wait.timeout", action_id=action_id)
            return False
        finally:
            self.pending_events.pop(action_id, None)
            self.results.pop(action_id, None)

    def confirm_action(self, action_id: str):
        """
        确认指定动作
        
        参数:
            action_id: 动作ID
        
        返回:
            bool: 确认是否成功
        """
        _log("ai_output_manager.action", "confirm.called", action_id=action_id)
        if action_id in self.pending_events:
            self.results[action_id] = True
            self.pending_events[action_id].set()
            _log("ai_output_manager.action", "confirm.ok", action_id=action_id)
            return True
        _log("ai_output_manager.action", "confirm.miss", action_id=action_id)
        return False

    def cancel_action(self, action_id: str):
        """
        取消指定动作
        
        参数:
            action_id: 动作ID
        
        返回:
            bool: 取消是否成功
        """
        _log("ai_output_manager.action", "cancel.called", action_id=action_id)
        if action_id in self.pending_events:
            self.results[action_id] = False
            self.pending_events[action_id].set()
            _log("ai_output_manager.action", "cancel.ok", action_id=action_id)
            return True
        _log("ai_output_manager.action", "cancel.miss", action_id=action_id)
        return False

global_action_manager = ActionManager()

class OutputManager:
    """
    输出管理器类
    负责管理AI输出流，包括文本流式输出、卡片发送和用户确认处理
    """
    def __init__(self):
        """
        初始化输出管理器
        
        属性:
            queue: 用于发送SSE事件的队列
            mixed_buffer: 存储按顺序产生的所有内容片段
            current_text_buffer: 用于临时累积当前的文本片段，以便合并存储
        """
        self.queue = asyncio.Queue()
        # mixed_buffer 存储按顺序产生的所有内容片段
        # 结构示例: [{"type": 0, "data": {"content": "..."}}, {"type": 1, "data": {...}}]
        self.mixed_buffer = [] 
        # current_text_buffer 用于临时累积当前的文本片段，以便合并存储
        self.current_text_buffer = []
        self._trace_partial_count = 0
        self._trace_card_count = 0
        self._trace_last_partial_log_at = 0.0
    
    def _now_ts(self):
        return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    
    def _log(self, layer: str, message: str, **fields):
        base = {
            "user_id": getattr(self, "_trace_user_id", None),
            "dialogue_id": getattr(self, "_trace_dialogue_id", None),
        }
        base.update(fields)
        payload = ""
        try:
            payload = json.dumps(base, ensure_ascii=False, default=str)
        except Exception:
            payload = str(base)
        print(f"[TS][{layer}] {self._now_ts()} {message} {payload}")

    def _flush_text_buffer(self):
        """将当前累积的文本合并为一个 type=0 的片段放入 mixed_buffer"""
        if self.current_text_buffer:
            full_text = "".join(self.current_text_buffer)
            self.mixed_buffer.append({"type": 0, "data": {"content": full_text}})
            self.current_text_buffer = []

    async def stream_text(self, text: str):
        """
        流式输出文本
        
        参数:
            text: 要输出的文本片段
        """
        self._trace_partial_count += 1
        now = time.perf_counter()
        should_log = self._trace_partial_count <= 5 or (self._trace_partial_count % 50 == 0) or (now - self._trace_last_partial_log_at >= 1.5)
        if should_log:
            self._trace_last_partial_log_at = now
            sample = text
            if isinstance(sample, str) and len(sample) > 80:
                sample = sample[:80] + "..."
            self._log("ai_output_manager.stream_text", "enqueue.partial_text", seq=self._trace_partial_count, len=len(text or ""), sample=sample)
        self.current_text_buffer.append(text)
        # 实时发送 SSE 事件
        try:
            await self.queue.put({
                "event": "partial_text",
                "data": json.dumps({"content": text, "delta": text, "finished": False})
            })
        except Exception as e:
            self._log("ai_output_manager.stream_text", "enqueue.partial_text.error", err=str(e))
            raise

    async def send_card(self, card_data: dict, need_confirm: bool) -> bool:
        """
        发送卡片并可选地等待用户确认
        
        参数:
            card_data: 卡片数据
            need_confirm: 是否需要用户确认
        
        返回:
            bool: 用户确认结果，True表示确认，False表示取消
        """
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
        
        self._trace_card_count += 1
        self._log(
            "ai_output_manager.send_card",
            "enqueue.cards",
            seq=self._trace_card_count,
            action_id=action_id,
            need_confirm=need_confirm,
            card_type=card_data.get("type"),
            data_keys=list((card_data.get("data") or {}).keys()) if isinstance(card_data.get("data"), dict) else None,
        )
        
        # 实时发送 SSE 事件
        try:
            await self.queue.put({
                "event": "cards", 
                "data": json.dumps({"cards": [card_data]})
            })
        except Exception as e:
            self._log("ai_output_manager.send_card", "enqueue.cards.error", action_id=action_id, err=str(e))
            raise
        
        # 强制交出控制权，确保 SSE 消费者有机会立即发送卡片
        # 特别是在自动确认开启时，后续可能会立即执行阻塞的 CRUD 操作
        await asyncio.sleep(0)

        if not need_confirm:
            return True

        # 使用全局管理器挂起，等待用户确认
        self._log("ai_output_manager.send_card", "wait_for_action.begin", action_id=action_id)
        result = await global_action_manager.wait_for_action(action_id, timeout=30)
        self._log("ai_output_manager.send_card", "wait_for_action.end", action_id=action_id, result=result)
        
        card_data["user_confirmation"] = "Y" if result else "N"
        
        return result

    async def end_stream(self, dialogue_id: int):
        """
        结束输出流
        
        参数:
            dialogue_id: 对话ID
        """
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
        
        self._log("ai_output_manager.end_stream", "enqueue.text_done", dialogue_id=dialogue_id, text_len=len(all_text or ""))
        await self.queue.put({
            "event": "text_done",
            "data": json.dumps({"content": all_text})
        })
        
        # 发送结束事件
        self._log("ai_output_manager.end_stream", "enqueue.end", dialogue_id=dialogue_id)
        await self.queue.put({
            "event": "end",
            "data": json.dumps({"dialogue_id": dialogue_id})
        })
        # 发送结束标记
        self._log("ai_output_manager.end_stream", "enqueue.none", dialogue_id=dialogue_id)
        await self.queue.put(None)

    async def send_error(self, message: str):
        """
        发送错误信息
        
        参数:
            message: 错误信息
        """
        self._log("ai_output_manager.send_error", "enqueue.error", message=message)
        await self.queue.put({
            "event": "error",
            "data": json.dumps({"message": message})
        })
        # 发送结束标记
        self._log("ai_output_manager.send_error", "enqueue.none")
        await self.queue.put(None)

    def get_final_content(self) -> List[dict]:
        """
        获取最终的输出内容
        
        返回:
            List[dict]: 按顺序排列的所有内容片段
        """
        # 结束前确保 flush
        self._flush_text_buffer()
        # 直接返回 mixed_buffer，它已经包含了按顺序排列的文本和卡片
        return self.mixed_buffer
