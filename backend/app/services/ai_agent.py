# 导入必要的库和模块
import os
import datetime
from pathlib import Path
from langchain_openai import ChatOpenAI
from langchain.agents import create_agent
from app.services import ai_config_service
from sqlalchemy.orm import Session
from dotenv import load_dotenv

# 计算.env.production文件路径（Task_Stream根目录）
# 当前文件: backend/app/services/ai_agent.py
# .env.production: Task_Stream/.env.production
env_path = Path(__file__).resolve().parents[3] / ".env.production"
load_dotenv(env_path)

def init_agent_executor(user_id: int, db: Session, tools):
    """
    初始化AI代理执行器
    
    参数:
        user_id: 用户ID，用于获取用户的AI配置
        db: 数据库会话，用于查询用户配置
        tools: AI代理可以使用的工具列表
    
    返回:
        agent: 初始化完成的AI代理执行器
    """
    config = ai_config_service.get_ai_config(db, user_id)
    
    # 获取API密钥，优先使用用户配置，其次使用环境变量
    api_key = config.api_key if (config and config.api_key) else os.getenv("OPENAI_API_KEY")
    # 获取API基础URL，默认使用阿里云DashScope兼容模式
    base_url = os.getenv("OPENAI_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1")
    # 获取模型名称，优先使用用户配置，其次使用默认模型
    model_name = config.model if (config and config.model) else "qwen-max"
    
    print(f"DEBUG: initializing agent. Model: {model_name}, BaseURL: {base_url}")
    print(f"DEBUG: API Key loaded: {'Yes' if api_key else 'No'} ({api_key[:5]}... if present)")

    # Fallback key if not set
    if not api_key:
        api_key = "sk-placeholder" 

    llm = ChatOpenAI(
        model=model_name,
        api_key=api_key,
        base_url=base_url,
        streaming=True
    )
    
    character = config.character if (config and config.character) else "默认"
    
    # Character Presets
    CHARACTER_PROMPTS = {
        "默认": "你是一个乐于助人的助手。",
        "温柔": "你是一个温柔体贴的助手，说话语气温和，总是给予用户鼓励和支持，像一位知心朋友。",
        "正式": "你是一个专业、严谨的助手，回答问题简洁明了，逻辑清晰，不使用口语化的表达，保持职业素养。",
        "幽默": "你是一个风趣幽默的助手，喜欢在回答中穿插一些无伤大雅的玩笑或梗，让对话氛围轻松愉快。",
        "严厉": "你是一个严格的监督者，说话直截了当，一针见血，不会纵容用户的懒惰或借口，总是督促用户高效完成任务。"
    }
    
    character_prompt = CHARACTER_PROMPTS.get(character, CHARACTER_PROMPTS["默认"])
    
    custom_prompt = config.prompt if (config and config.is_enable_prompt and config.prompt) else ""
    current_time = datetime.datetime.now().strftime("%Y-%m-%d-%H-%M-%S")
    
    system_prompt = f"""
    {character_prompt}

    你需要根据用户的需求选择是否调用工具以及调用什么工具。
    
    用户需要的现在的时间是 {current_time}
    
    {custom_prompt}
    """
    
    agent = create_agent(
        model=llm,
        tools=tools,
        system_prompt=system_prompt
    )
    
    return agent
