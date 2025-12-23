import os
import sys
from pathlib import Path
from dotenv import load_dotenv

def find_env_file():
    """
    智能查找.env文件，支持多种路径结构
    """
    # 可能的.env文件路径
    possible_paths = [
        # 开发环境路径
        Path(__file__).resolve().parents[3] / '.env.development',
        Path(__file__).resolve().parents[2] / '.env.development',
        Path(__file__).resolve().parents[1] / '.env.development',
        Path.cwd() / '.env.development',
        # 生产环境路径
        Path(__file__).resolve().parents[3] / '.env.production',
        Path(__file__).resolve().parents[2] / '.env.production',
        Path(__file__).resolve().parents[1] / '.env.production',
        Path.cwd() / '.env.production',
        # 通用路径
        Path(__file__).resolve().parents[3] / '.env',
        Path(__file__).resolve().parents[2] / '.env',
        Path(__file__).resolve().parents[1] / '.env',
        Path.cwd() / '.env',
    ]
    
    # 查找第一个存在的文件
    for path in possible_paths:
        if path.exists():
            print(f"Loading environment from: {path}")
            return path
    
    print("Warning: No .env file found, using system environment variables")
    return None

def debug_env_loading():
    """
    详细的环境变量加载调试信息
    """
    print("=== Environment Loading Debug Info ===")
    print(f"Current working directory: {Path.cwd()}")
    print(f"Script directory: {Path(__file__).resolve().parent}")
    print(f"Python path: {sys.path}")
    
    # 检查系统环境变量
    sys_openai_key = os.getenv("OPENAI_API_KEY")
    sys_openai_model = os.getenv("OPENAI_MODEL")
    print(f"System OPENAI_API_KEY present: {bool(sys_openai_key)}")
    print(f"System OPENAI_MODEL: {sys_openai_model}")
    
    # 查找.env文件
    env_file = find_env_file()
    
    if env_file:
        print(f"Found .env file: {env_file}")
        # 加载前检查文件内容（不暴露敏感信息）
        try:
            with open(env_file, 'r') as f:
                lines = f.readlines()
                key_count = sum(1 for line in lines if line.strip() and not line.startswith('#') and '=' in line)
                print(f"Found {key_count} configuration keys in .env file")
        except Exception as e:
            print(f"Error reading .env file: {e}")
    else:
        print("No .env file found")
    
    return env_file

# 加载环境变量
env_file = debug_env_loading()
if env_file:
    load_dotenv(env_file)

# AI配置，包含更好的错误处理
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "qwen-plus")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1")

# 安全的数字转换
try:
    AI_CONTEXT_WINDOW_TURNS = int(os.getenv("AI_CONTEXT_WINDOW_TURNS", "10"))
except (ValueError, TypeError):
    AI_CONTEXT_WINDOW_TURNS = 10

# 最终调试信息
print(f"=== Final Configuration ===")
print(f"Model: {OPENAI_MODEL}")
print(f"API_KEY present: {bool(OPENAI_API_KEY)}")
print(f"Base_URL: {OPENAI_BASE_URL}")
print(f"Context Window Turns: {AI_CONTEXT_WINDOW_TURNS}")