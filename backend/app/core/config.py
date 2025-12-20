import os
from pathlib import Path
from dotenv import load_dotenv

# Get the project root directory (Task_Stream folder)
project_root = Path(__file__).resolve().parents[3]
env_file_path = project_root / '.env.development'

# Load environment variables from .env.development file
load_dotenv(env_file_path)

# AI Configuration
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "qwen-plus")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "")
AI_CONTEXT_WINDOW_TURNS = int(os.getenv("AI_CONTEXT_WINDOW_TURNS", "10"))