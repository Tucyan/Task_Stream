import asyncio
import json
import uuid
import os
import datetime
import time
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import AI_CONTEXT_WINDOW_TURNS
from app.services import ai_agent, ai_tools, ai_output_manager, ai_config_service
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage, SystemMessage
from app.core.database import SessionLocal

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

def _get_context_window_turns() -> int:
    return max(AI_CONTEXT_WINDOW_TURNS, 0)

def map_card_to_tool(card_type, card_data):
    """根据卡片类型和数据，推断工具名称和参数"""
    tool_name = "unknown_tool"
    tool_args = {}
    
    if card_type == 1:
        tool_name = "create_task"
        tool_args = {
            "title": card_data.get("title"),
            "description": card_data.get("description"),
            "due_date": card_data.get("due_date"),
            "tags": card_data.get("tags"),
            "record_result": card_data.get("record_result"),
            "long_term_task_id": card_data.get("long_term_task_id")
        }
    elif card_type == 2:
        title = card_data.get("title", "")
        if "删除任务" in title:
            tool_name = "delete_task"
            tool_args = {"task_id": card_data.get("task_id")}
        elif "删除长期任务" in title:
            tool_name = "delete_long_term_task"
            tool_args = {"task_id": card_data.get("task_id")}
        else:
            tool_name = "confirm_action" # 假设存在这样的工具，或者通用操作
            tool_args = {"action_id": card_data.get("action_id")}
    elif card_type == 3:
        tool_name = "update_task"
        updated = card_data.get("updated", {})
        tool_args = {
            "task_id": updated.get("id"),
            "title": updated.get("title"),
            "description": updated.get("description"),
            "status": updated.get("status"),
            "due_date": updated.get("due_date")
        }
    elif card_type == 4:
        tool_name = "create_long_term_task"
        tool_args = {
            "title": card_data.get("title"),
            "description": card_data.get("description"),
            "start_date": card_data.get("start_date"),
            "due_date": card_data.get("due_date"),
            "sub_task_ids": card_data.get("sub_task_ids")
        }
    elif card_type == 7:
        tool_name = "update_journal"
        after = card_data.get("after", {})
        tool_args = {
            "date": after.get("date"),
            "content": after.get("content")
        }
    elif card_type == 8:
        tool_name = "add_reminder"
        tool_args = {
            "type": card_data.get("type"),
            "time": card_data.get("time"),
            "content": card_data.get("content"),
            "task_id": card_data.get("task_id")
        }
    elif card_type == 9:
        tool_name = "update_reminder_list"
        tool_args = {
            "reminder_list": card_data.get("reminder_list")
        }
    
    # 清理 None 值参数，让上下文更干净
    tool_args = {k: v for k, v in tool_args.items() if v is not None}
    return tool_name, tool_args

async def run_chat_stream(user_id: int, dialogue_id: int, content: str):
    """运行聊天流式输出"""
    output_manager = ai_output_manager.OutputManager()
    output_manager._trace_user_id = user_id
    output_manager._trace_dialogue_id = dialogue_id
    output_manager._trace_stream_started_at = time.perf_counter()
    
    async def run_agent():
        started_at = time.perf_counter()
        _log("ai_service.run_agent", "started", dialogue_id=dialogue_id, user_id=user_id, content_len=len(content or ""))
        
        async with SessionLocal() as db:
            try:
                # 1. 获取工具列表
                _log("ai_service.run_agent", "tools.init.start", dialogue_id=dialogue_id)
                tools = await ai_tools.get_ai_tools(output_manager, user_id, db)
                _log("ai_service.run_agent", "tools.init.end", dialogue_id=dialogue_id, tool_count=len(tools))
                
                # 2. 初始化智能体
                _log("ai_service.run_agent", "agent.init.start", dialogue_id=dialogue_id)
                agent_executor = await ai_agent.init_agent_executor(user_id, db, tools)
                _log("ai_service.run_agent", "agent.init.end", dialogue_id=dialogue_id)
                
                # 3. 准备聊天历史
                _log("ai_service.run_agent", "history.load.start", dialogue_id=dialogue_id)
                dialogue = await ai_config_service.get_dialogue(db, dialogue_id, user_id)
                chat_history = []
                if dialogue and dialogue.messages:
                    # dialogue.messages 是 List[List[dict]] (schemas.AiMessage 中的定义)
                    # 或者是 List[List[ChatTurn]]
                    turn_lists = dialogue.messages
                    max_turns = _get_context_window_turns()
                    if max_turns and len(turn_lists) > max_turns:
                        turn_lists = turn_lists[-max_turns:]

                    for turn_list in turn_lists:
                        for msg in turn_list:
                            # msg 是 dict
                            role = msg.get('role')
                            
                            if role == 'user':
                                chat_history.append(HumanMessage(content=msg.get('content')))
                            elif role == 'assistant':
                                c = msg.get('content')
                                if isinstance(c, list):
                                    # 将混合内容转换为标准的 tool_calls 上下文
                                    current_text_parts = []
                                    
                                    for item in c:
                                        item_type = item.get('type')
                                        item_data = item.get('data', {})
                                        
                                        if item_type == 0:
                                            # 文本消息
                                            text = item_data.get('content', '')
                                            if text: current_text_parts.append(text)
                                        elif item_type in [1, 2, 3, 4, 7, 8, 9]:
                                            # 卡片 -> 视为一次成功的工具调用
                                            tool_name, tool_args = map_card_to_tool(item_type, item_data)
                                            call_id = f"call_{uuid.uuid4().hex[:8]}"
                                            
                                            # 1. 构造 AIMessage (包含 tool_calls)
                                            # 将目前积累的文本作为 content
                                            text_content = "\n".join(current_text_parts)
                                            current_text_parts = [] # 清空缓冲
                                            
                                            ai_msg = AIMessage(
                                                content=text_content,
                                                tool_calls=[{
                                                    "id": call_id,
                                                    "name": tool_name,
                                                    "args": tool_args
                                                }]
                                            )
                                            chat_history.append(ai_msg)
                                            
                                            # 2. 构造 ToolMessage (工具执行结果)
                                            # 简单描述执行成功
                                            tool_result = f"Action {tool_name} completed successfully."
                                            tool_msg = ToolMessage(
                                                tool_call_id=call_id,
                                                content=tool_result
                                            )
                                            chat_history.append(tool_msg)
                                        else:
                                            # 其他类型卡片，暂存为文本描述
                                            current_text_parts.append("[显示了一张卡片]")
                                    
                                    # 处理最后剩余的文本
                                    if current_text_parts:
                                        chat_history.append(AIMessage(content="\n".join(current_text_parts)))
                                        
                                    # 如果整个 list 处理完，chat_history 没有任何新增（例如只有非工具卡片且没文本），加个占位
                                    # 但上面的逻辑通常会产生至少一个 AIMessage
                                        
                                else:
                                    chat_history.append(AIMessage(content=str(c)))

                _log("ai_service.run_agent", "history.load.end", dialogue_id=dialogue_id, message_count=len(chat_history))

                # 4. 定义回调
                from langchain_core.callbacks import BaseCallbackHandler
                class StreamCallback(BaseCallbackHandler):
                    async def on_llm_new_token(self, token: str, **kwargs):
                        # 只有当 token 是普通文本内容时才输出
                        # LangChain 的 on_llm_new_token 可能会包含工具调用的 JSON 片段
                        # 我们需要检查 kwargs 中的 chunk 信息来区分
                        
                        chunk = kwargs.get('chunk')
                        if chunk and hasattr(chunk, 'tool_call_chunks') and chunk.tool_call_chunks:
                            _log("ai_service.stream_callback", "llm.tool_call_chunk", dialogue_id=dialogue_id, user_id=user_id, chunk_count=len(chunk.tool_call_chunks))
                        elif token:
                             await output_manager.stream_text(token)
                
                # 5. 发送开始事件
                _log("ai_service.run_agent", "sse.enqueue.start", dialogue_id=dialogue_id)
                await output_manager.queue.put({"event": "start", "data": json.dumps({"dialogue_id": dialogue_id})})
                _log("ai_service.run_agent", "sse.enqueue.start.done", dialogue_id=dialogue_id)

                # 6. 运行智能体
                _log("ai_service.run_agent", "agent.invoke.prepare", dialogue_id=dialogue_id)
                # create_agent 返回的是一个 CompiledGraph，输入通常是 messages
                # 我们将 chat_history 和本次用户输入组合
                chat_history.append(HumanMessage(content=content))
                
                _log("ai_service.run_agent", "agent.invoke.start", dialogue_id=dialogue_id)
                start_time = asyncio.get_event_loop().time()
                await agent_executor.ainvoke(
                    {"messages": chat_history},
                    config={"callbacks": [StreamCallback()]}
                )
                end_time = asyncio.get_event_loop().time()
                cost_ms = int((time.perf_counter() - started_at) * 1000)
                _log("ai_service.run_agent", "agent.invoke.end", dialogue_id=dialogue_id, llm_cost_s=round(end_time - start_time, 3), total_cost_ms=cost_ms)
                
                # 7. 保存历史记录
                final_content = output_manager.get_final_content()
                new_turn = [
                    {"role": "user", "content": content},
                    {"role": "assistant", "content": final_content}
                ]
                
                # 重新获取 dialogue 以防 detached
                d = await ai_config_service.get_dialogue(db, dialogue_id, user_id)
                if d:
                    current_msgs = d.messages
                    current_msgs.append(new_turn)
                    await ai_config_service.update_dialogue_messages(db, dialogue_id, current_msgs)
                    _log("ai_service.run_agent", "history.save.ok", dialogue_id=dialogue_id)
                    
            except Exception as e:
                _log("ai_service.run_agent", "error", dialogue_id=dialogue_id, err=str(e))
                import traceback
                traceback.print_exc()
                await output_manager.send_error(str(e))
            finally:
                _log("ai_service.run_agent", "stream.end.begin", dialogue_id=dialogue_id)
                await output_manager.end_stream(dialogue_id)
                _log("ai_service.run_agent", "stream.end.done", dialogue_id=dialogue_id)
        
    asyncio.create_task(run_agent())
    
    return output_manager
