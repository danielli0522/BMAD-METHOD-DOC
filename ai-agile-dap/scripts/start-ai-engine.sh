#!/bin/bash

# AI引擎启动脚本

echo "🚀 启动 AI-Agile-DAP AI引擎服务..."

# 检查Python环境
if ! command -v python &> /dev/null; then
    echo "❌ Python未安装，请先安装Python 3.9+"
    exit 1
fi

# 检查是否在虚拟环境中
if [[ "$VIRTUAL_ENV" == "" ]]; then
    echo "⚠️  建议在虚拟环境中运行"
    echo "创建虚拟环境: python -m venv venv"
    echo "激活虚拟环境: source venv/bin/activate"
fi

# 进入AI引擎目录
cd "$(dirname "$0")/../src/ai-engine" || exit 1

# 检查环境变量文件
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "📋 复制环境变量示例文件..."
        cp .env.example .env
        echo "⚠️  请编辑 .env 文件并设置您的 OpenAI API Key"
        echo "编辑命令: vim .env"
        read -p "设置完成后按回车键继续..."
    else
        echo "❌ 未找到环境变量文件"
        exit 1
    fi
fi

# 安装依赖
echo "📦 安装Python依赖..."
pip install -r requirements.txt

# 检查OpenAI API Key
source .env
if [ -z "$OPENAI_API_KEY" ] || [ "$OPENAI_API_KEY" = "your-openai-api-key-here" ]; then
    echo "❌ 请设置有效的 OPENAI_API_KEY"
    echo "编辑 .env 文件: vim .env"
    exit 1
fi

echo "✅ 环境检查完成"

# 启动服务
echo "🔥 启动AI引擎服务 (端口: 8001)..."
python -m uvicorn api:app --host 0.0.0.0 --port 8001 --reload

echo "🎯 AI引擎服务地址: http://localhost:8001"
echo "📚 API文档地址: http://localhost:8001/docs"