# 任务流管理系统 (Task Stream Management System)

一个现代化的任务流管理应用，结合了前端React界面和后端FastAPI服务，提供全面的任务管理、AI助手和长期任务跟踪功能。

## ✨ 功能特性

### 📋 任务管理
- **任务创建与编辑**：支持创建、编辑和删除任务
- **任务分类**：按项目、优先级和状态组织任务
- **子任务管理**：将复杂任务分解为可管理的小任务
- **实时状态更新**：任务状态变化实时反映在界面上

### 🤖 AI助手集成
- **智能任务建议**：AI助手提供任务优化建议
- **自动化工作流**：智能处理重复性任务
- **数据分析**：基于历史数据提供洞察

### 📈 长期任务跟踪
- **项目概览**：查看长期项目进度
- **里程碑管理**：设置和跟踪关键里程碑
- **时间线视图**：直观展示任务时间线

### 📊 数据可视化
- **热力图视图**：可视化任务分布和完成情况
- **进度报告**：生成详细的项目进度报告
- **统计仪表板**：实时查看任务统计数据

### 👤 用户体验
- **响应式设计**：适配各种设备屏幕
- **深色/浅色主题**：自定义界面主题
- **多语言支持**：国际化界面
- **实时同步**：多设备数据同步

## 🛠️ 技术栈

### 前端
- **React 18** - 现代化前端框架
- **Vite** - 快速构建工具
- **CSS3** - 现代样式方案
- **ESLint** - 代码质量检查

### 后端
- **FastAPI** - 高性能Python Web框架
- **SQLAlchemy** - ORM数据库操作
- **SQLite** - 轻量级数据库
- **Pydantic** - 数据验证和序列化

### 开发工具
- **Python 3.11+** - 后端运行环境
- **Node.js 18+** - 前端构建环境
- **Git** - 版本控制

## 🚀 快速开始

### 环境要求
- Node.js 18+ 
- Python 3.11+
- Git

### 克隆项目
```bash
git clone https://github.com/your-username/task-stream.git
cd task-stream
```

### 后端设置

1. **创建虚拟环境**
```bash
# 在项目根目录创建虚拟环境
python -m venv .venv

# 激活虚拟环境 (Windows)
.venv\Scripts\activate

# 激活虚拟环境 (macOS/Linux)
source .venv/bin/activate
```

2. **安装Python依赖**
```bash
cd backend
pip install -r requirements.txt
```

3. **初始化数据库**
```bash
# 运行数据库初始化脚本
python -m app.core.init_db
```

4. **启动后端服务**
```bash
cd backend/app
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

后端服务将在 http://localhost:8000 启动

### 前端设置

1. **安装依赖**
```bash
# 在项目根目录安装Node.js依赖
npm install
```

2. **启动开发服务器**
```bash
npm run dev
```

前端应用将在 http://localhost:5173 启动

## 📁 项目结构

```
task-stream/
├── src/                          # React前端源代码
│   ├── components/               # 可复用组件
│   │   ├── AuthModal.jsx        # 认证模态框
│   │   ├── HeaderBar.jsx        # 头部导航栏
│   │   ├── TaskModal.jsx        # 任务编辑模态框
│   │   ├── SubTaskManager.jsx   # 子任务管理器
│   │   └── ...                  # 其他组件
│   ├── views/                   # 页面视图
│   │   ├── HomeView.jsx         # 主页视图
│   │   ├── DetailView.jsx       # 详情视图
│   │   ├── LongTermView.jsx     # 长期任务视图
│   │   └── ...                  # 其他视图
│   ├── services/                # API服务
│   │   └── api.js               # API调用封装
│   ├── utils/                   # 工具函数
│   │   └── eventBus.js          # 事件总线
│   ├── App.jsx                  # 主应用组件
│   └── main.jsx                 # 应用入口点
├── backend/                     # FastAPI后端源代码
│   └── app/
│       ├── core/                # 核心配置
│       │   ├── database.py      # 数据库配置
│       │   └── init_db.py       # 数据库初始化
│       ├── models/              # 数据模型
│       │   └── models.py        # SQLAlchemy模型
│       ├── schemas/             # Pydantic模式
│       │   └── schemas.py       # API模式定义
│       ├── services/            # 业务逻辑
│       │   ├── auth.py          # 认证服务
│       │   └── crud.py          # CRUD操作
│       └── main.py              # FastAPI应用入口
├── public/                      # 静态资源
├── .gitignore                   # Git忽略规则
├── package.json                 # Node.js依赖配置
├── vite.config.js              # Vite构建配置
└── README.md                    # 项目文档
```

## 🔧 开发指南

### 添加新功能

1. **前端组件开发**
```bash
# 创建新组件
touch src/components/NewComponent.jsx
```

2. **后端API开发**
```bash
# 在backend/app/services/添加新的服务
touch backend/app/services/new_service.py
```

3. **数据库迁移**
```bash
# 创建数据库迁移
alembic revision --autogenerate -m "Description"
```

### 代码规范

- 使用ESLint进行前端代码检查
- 遵循PEP 8进行Python代码格式化
- 使用有意义的变量和函数名
- 添加适当的注释和文档字符串

### 测试

```bash
# 运行前端测试
npm test

# 运行后端测试
cd backend
pytest
```

## 🚀 部署

### Docker部署（推荐）
```bash
# 构建并运行Docker容器
docker-compose up -d
```

### 传统部署
1. 构建前端：`npm run build`
2. 配置反向代理（如Nginx）
3. 使用Gunicorn运行后端：`gunicorn main:app`

## 📖 API文档

启动后端服务后，访问以下地址查看API文档：
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## 🤝 贡献指南

1. Fork 本仓库
2. 创建特性分支：`git checkout -b feature/new-feature`
3. 提交更改：`git commit -am 'Add new feature'`
4. 推送分支：`git push origin feature/new-feature`
5. 提交Pull Request

## 📝 更新日志

### v1.0.0 (2024-12-10)
- ✨ 初始版本发布
- ✅ 基础任务管理功能
- ✅ 用户认证系统
- ✅ AI助手集成
- ✅ 长期任务跟踪
- ✅ 数据可视化

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 👨‍💻 作者

- **开发者** - [您的姓名] - [您的邮箱]

## 🙏 致谢

感谢以下开源项目的支持：
- [React](https://reactjs.org/)
- [FastAPI](https://fastapi.tiangolo.com/)
- [Vite](https://vitejs.dev/)
- [SQLAlchemy](https://www.sqlalchemy.org/)

## 📞 支持

如果您有任何问题或建议，请：
- 提交 [Issue](../../issues)
- 发送邮件至 [您的邮箱]
- 查看 [Wiki](../../wiki) 获取更多信息

---

⭐ 如果这个项目对您有帮助，请给它一个星标！