import asyncio
import json
import uuid
from sqlalchemy.orm import Session
from app.services import ai_agent, ai_tools, ai_output_manager, ai_config_service
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage, SystemMessage
from app.core.database import SessionLocal

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
            tool_name = "confirm_action" # 假设存在这样的工具，或者 generic action
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
            "progress": card_data.get("progress"),
            "sub_task_ids": card_data.get("sub_task_ids")
        }
    elif card_type == 7:
        tool_name = "update_journal"
        after = card_data.get("after", {})
        tool_args = {
            "date": after.get("date"),
            "content": after.get("content")
        }
        
    # 清理 None 值参数，让上下文更干净
    tool_args = {k: v for k, v in tool_args.items() if v is not None}
    return tool_name, tool_args

async def run_chat_stream(user_id: int, dialogue_id: int, content: str):
    output_manager = ai_output_manager.OutputManager()
    
    async def run_agent():
        print(f"DEBUG_TRACE: run_agent started for dialogue {dialogue_id}")
        db = SessionLocal()
        try:
            # 1. 获取 Tools
            print("DEBUG_TRACE: Initializing tools...")
            tools = ai_tools.get_ai_tools(output_manager, user_id, db)
            
            # 2. 初始化 Agent
            print("DEBUG_TRACE: Initializing agent executor...")
            agent_executor = ai_agent.init_agent_executor(user_id, db, tools)
            
            # 3. 准备 Chat History
            print("DEBUG_TRACE: Loading chat history...")
            dialogue = ai_config_service.get_dialogue(db, dialogue_id, user_id)
            chat_history = []
            if dialogue and dialogue.messages:
                # dialogue.messages 是 List[List[dict]] (schemas.AiMessage 中的定义)
                # 或者是 List[List[ChatTurn]]
                for turn_list in dialogue.messages:
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
                                    elif item_type in [1, 2, 3, 4, 7]:
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
                                        current_text_parts.append("[Displayed a card]")
                                
                                # 处理最后剩余的文本
                                if current_text_parts:
                                    chat_history.append(AIMessage(content="\n".join(current_text_parts)))
                                    
                                # 如果整个 list 处理完，chat_history 没有任何新增（例如只有非工具卡片且没文本），加个占位
                                # 但上面的逻辑通常会产生至少一个 AIMessage
                                    
                            else:
                                chat_history.append(AIMessage(content=str(c)))

            print(f"DEBUG_TRACE: Chat history loaded ({len(chat_history)} messages).")

            # 4. 定义回调
            from langchain_core.callbacks import BaseCallbackHandler
            class StreamCallback(BaseCallbackHandler):
                async def on_llm_new_token(self, token: str, **kwargs):
                    # 只有当 token 是普通文本内容时才输出
                    # LangChain 的 on_llm_new_token 可能会包含工具调用的 JSON 片段
                    # 我们需要检查 kwargs 中的 chunk 信息来区分
                    
                    chunk = kwargs.get('chunk')
                    if chunk and hasattr(chunk, 'tool_call_chunks') and chunk.tool_call_chunks:
                        # 这是一个工具调用片段，不作为文本输出
                        print(f"DEBUG_TRACE: Tool call chunk received (length: {len(chunk.tool_call_chunks)})")
                        pass
                    elif token:
                         # print(f"DEBUG_TRACE: Streaming token: {token[:5]}...") # Verbose
                         await output_manager.stream_text(token)
            
            # 5. 发送 Start
            print("DEBUG_TRACE: Sending 'start' event")
            await output_manager.queue.put({"event": "start", "data": json.dumps({"dialogue_id": dialogue_id})})

            # 6. 运行 Agent
            # create_agent 返回的是一个 CompiledGraph，输入通常是 messages
            # 我们将 chat_history 和本次 user input 组合
            chat_history.append(HumanMessage(content=content))
            
            print("DEBUG_TRACE: Invoking agent_executor.ainvoke...")
            await agent_executor.ainvoke(
                {"messages": chat_history},
                config={"callbacks": [StreamCallback()]}
            )
            print("DEBUG_TRACE: agent_executor.ainvoke finished.")
            
            # 7. 保存历史
            final_content = output_manager.get_final_content()
            new_turn = [
                {"role": "user", "content": content},
                {"role": "assistant", "content": final_content}
            ]
            
            # 重新获取 dialogue 以防 detached
            d = ai_config_service.get_dialogue(db, dialogue_id, user_id)
            if d:
                current_msgs = d.messages
                current_msgs.append(new_turn)
                ai_config_service.update_dialogue_messages(db, dialogue_id, current_msgs)
                print("DEBUG_TRACE: Chat history saved.")
                
        except Exception as e:
            print(f"DEBUG_TRACE: Error in run_agent: {e}")
            import traceback
            traceback.print_exc()
            await output_manager.send_error(str(e))
        finally:
            print("DEBUG_TRACE: run_agent finally block (ending stream)")
            await output_manager.end_stream(dialogue_id)
            db.close()

    asyncio.create_task(run_agent())
    
    return output_manager
