# ai-agile-dap 开发环境配置指南

**版本**: v1.0  
**更新时间**: 2024年8月18日  
**Scrum Master**: Alex

---

## 🎯 配置目标

确保所有团队成员拥有统一的开发环境，提高开发效率和代码质量。

---

## 💻 基础环境要求

### 系统要求
- **操作系统**: macOS 12+ / Windows 11 / Ubuntu 20.04+
- **内存**: 16GB+ (推荐32GB)
- **存储**: 50GB+ 可用空间
- **网络**: 稳定的互联网连接

### 必装软件版本

| 软件 | 版本 | 用途 | 安装链接 |
|------|------|------|----------|
| **Node.js** | 20.x LTS | 前后端开发 | https://nodejs.org |
| **Python** | 3.9+ | AI引擎开发 | https://python.org |
| **Docker** | 24.x+ | 容器化部署 | https://docker.com |
| **Git** | 2.40+ | 版本控制 | https://git-scm.com |
| **VS Code** | 最新版 | 主IDE | https://code.visualstudio.com |

---

## 🔧 详细安装步骤

### Step 1: Node.js 环境配置

```bash
# 安装 Node.js 20.x LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# 验证安装
node --version  # 应显示 v20.x.x
npm --version   # 应显示 10.x.x

# 配置 npm 镜像 (国内用户)
npm config set registry https://registry.npmmirror.com
```

### Step 2: Python 环境配置

```bash
# 安装 Python 3.9+
sudo apt install python3.9 python3.9-pip python3.9-venv

# 创建项目虚拟环境
cd ai-agile-dap
python3.9 -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

# 升级 pip
pip install --upgrade pip

# 验证安装
python --version  # 应显示 Python 3.9.x
pip --version
```

### Step 3: Docker 环境配置

```bash
# Ubuntu 安装 Docker
sudo apt update
sudo apt install docker.io docker-compose
sudo systemctl enable docker
sudo usermod -aG docker $USER

# 验证安装
docker --version         # 应显示 Docker version 24.x
docker-compose --version # 应显示 docker-compose version 2.x

# 拉取基础镜像
docker pull node:20-alpine
docker pull python:3.9-slim
docker pull postgres:15
docker pull redis:7-alpine
```

### Step 4: 开发工具配置

#### VS Code 插件安装
```bash
# 必装插件列表
code --install-extension esbenp.prettier-vscode
code --install-extension bradlc.vscode-tailwindcss
code --install-extension ms-python.python
code --install-extension ms-vscode.vscode-typescript-next
code --install-extension ms-vscode.vscode-json
code --install-extension redhat.vscode-yaml
code --install-extension ms-vscode.vscode-eslint
code --install-extension GitLab.gitlab-workflow
```

#### VS Code 配置文件
```json
// .vscode/settings.json
{
  "typescript.preferences.quoteStyle": "single",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "python.defaultInterpreterPath": "./venv/bin/python",
  "python.linting.enabled": true,
  "python.linting.pylintEnabled": true
}
```

---

## 🗂️ 项目结构初始化

### 克隆项目仓库
```bash
# 克隆项目 (替换为实际仓库地址)
git clone https://github.com/your-org/ai-agile-dap.git
cd ai-agile-dap

# 检出开发分支
git checkout develop
git pull origin develop
```

### 前端环境配置
```bash
cd src/frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 验证前端环境
# 浏览器访问 http://localhost:3000
```

### 后端环境配置
```bash
cd src/backend

# 安装 Node.js 依赖
npm install

# 安装 Python 依赖 (AI引擎)
cd ai-engine
pip install -r requirements.txt

# 启动后端服务
npm run dev

# 验证后端环境
# API访问 http://localhost:8000/health
```

### 数据库环境配置
```bash
# 启动数据库容器
docker-compose up -d postgres redis

# 等待服务启动
sleep 10

# 运行数据库迁移
cd src/backend
npm run db:migrate

# 插入测试数据
npm run db:seed
```

---

## 🔐 环境变量配置

### 复制环境变量模板
```bash
# 前端环境变量
cp src/frontend/.env.example src/frontend/.env.local

# 后端环境变量  
cp src/backend/.env.example src/backend/.env.development
```

### 关键环境变量配置

#### 前端 (.env.local)
```bash
REACT_APP_API_URL=http://localhost:8000
REACT_APP_ENVIRONMENT=development
REACT_APP_LOG_LEVEL=debug
```

#### 后端 (.env.development)
```bash
NODE_ENV=development
PORT=8000

# 数据库配置
DATABASE_URL=postgresql://postgres:password123@localhost:5432/ai_agile_dap
REDIS_URL=redis://localhost:6379

# AI服务配置
OPENAI_API_KEY=your-openai-api-key-here
OPENAI_MODEL=gpt-4

# JWT密钥
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=24h

# 日志配置
LOG_LEVEL=debug
LOG_FORMAT=combined
```

---

## 🧪 开发环境验证

### 自动化验证脚本
```bash
#!/bin/bash
# scripts/verify-setup.sh

echo "🔍 验证开发环境配置..."

# 检查 Node.js
echo "📦 检查 Node.js..."
node --version || { echo "❌ Node.js 未安装"; exit 1; }

# 检查 Python
echo "🐍 检查 Python..."
python --version || { echo "❌ Python 未安装"; exit 1; }

# 检查 Docker
echo "🐳 检查 Docker..."
docker --version || { echo "❌ Docker 未安装"; exit 1; }

# 检查数据库连接
echo "🗄️ 检查数据库连接..."
docker exec ai-agile-dap-postgres pg_isready -U postgres || { echo "❌ PostgreSQL 未启动"; exit 1; }

# 检查 Redis 连接
echo "📊 检查 Redis 连接..."
docker exec ai-agile-dap-redis redis-cli ping | grep PONG || { echo "❌ Redis 未启动"; exit 1; }

# 运行前端测试
echo "🎨 检查前端环境..."
cd src/frontend && npm test -- --passWithNoTests

# 运行后端测试
echo "⚙️ 检查后端环境..."
cd ../backend && npm test

echo "✅ 所有环境检查通过！"
```

### 手动验证检查清单

#### ✅ 基础环境检查
- [ ] Node.js 版本正确 (v20.x)
- [ ] Python 版本正确 (3.9+)
- [ ] Docker 服务运行正常
- [ ] Git 配置完成

#### ✅ 项目环境检查  
- [ ] 项目代码成功克隆
- [ ] 前端依赖安装成功
- [ ] 后端依赖安装成功
- [ ] 数据库连接正常

#### ✅ 开发工具检查
- [ ] VS Code 插件安装完成
- [ ] 代码格式化工作正常
- [ ] 语法检查工作正常
- [ ] 调试配置正确

#### ✅ 服务启动检查
- [ ] 前端开发服务器启动 (http://localhost:3000)
- [ ] 后端API服务启动 (http://localhost:8000)
- [ ] 数据库服务正常
- [ ] Redis缓存服务正常

---

## 🛠️ 常见问题解决

### 问题1: Node.js版本不匹配
```bash
# 使用 nvm 管理 Node.js 版本
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
nvm alias default 20
```

### 问题2: Python虚拟环境问题
```bash
# 清理并重建虚拟环境
rm -rf venv
python3.9 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

### 问题3: Docker权限问题
```bash
# Linux 用户加入 docker 组
sudo usermod -aG docker $USER
newgrp docker
# 或者重新登录系统
```

### 问题4: 数据库连接失败
```bash
# 检查数据库容器状态
docker ps | grep postgres

# 重启数据库容器
docker-compose restart postgres

# 检查数据库日志
docker logs ai-agile-dap-postgres
```

### 问题5: 端口占用
```bash
# 查找占用端口的进程
sudo lsof -i :3000  # 前端端口
sudo lsof -i :8000  # 后端端口

# 终止进程
sudo kill -9 <PID>
```

---

## 📚 开发规范和最佳实践

### Git 工作流
```bash
# 创建功能分支
git checkout -b feature/user-story-123

# 提交代码 (使用约定式提交)
git commit -m "feat: 添加用户登录功能"

# 推送分支
git push origin feature/user-story-123

# 创建 Pull Request
# 在 GitHub/GitLab 上创建 PR
```

### 代码提交规范
```bash
# 提交类型
feat:     新功能
fix:      bug修复
docs:     文档更新
style:    代码格式化
refactor: 重构
test:     添加测试
chore:    构建脚本、依赖更新

# 示例
git commit -m "feat(ai-engine): 实现自然语言查询解析"
git commit -m "fix(frontend): 修复图表渲染性能问题"
```

### 代码评审要求
- 所有代码必须经过至少2人评审
- PR必须通过CI/CD检查
- 单元测试覆盖率≥80%
- 代码质量评分≥8/10

---

## 📞 技术支持

### 联系方式
- **Scrum Master**: Alex (微信: alex_sm)
- **技术负责人**: [技术Leader] (内线: xxx)
- **运维支持**: [DevOps] (钉钉: xxx)

### 技术支持群
- **微信群**: ai-agile-dap-dev
- **Slack频道**: #ai-agile-dap-tech
- **技术文档**: 项目Wiki

### 紧急联系
如遇紧急技术问题影响开发，请：
1. 先在技术群求助
2. 联系Scrum Master
3. 升级至技术负责人

---

**🚀 环境配置完成后，您就可以开始愉快的编码了！**

**下一步**: 参加明天上午9:30的第一次每日站会 🏃‍♂️