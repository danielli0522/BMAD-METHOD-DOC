"""
AI引擎主服务入口
Sprint 1 Day 1 - 生产级API服务启动
"""
import logging
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from api import app as ai_api_app
from config import config

# 配置日志
logging.basicConfig(
    level=getattr(logging, config.log_level.upper()),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# 创建主应用
app = FastAPI(
    title="AI-Agile-DAP AI引擎",
    description="自然语言到SQL转换的AI引擎服务",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# 添加中间件
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境需要配置具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 添加监控
instrumentator = Instrumentator()
instrumentator.instrument(app).expose(app)

# 挂载AI API路由
app.mount("/api/v1", ai_api_app)

# 健康检查端点
@app.get("/health")
async def health_check():
    """健康检查接口"""
    return {
        "status": "healthy",
        "service": "ai-engine",
        "version": "1.0.0"
    }

# 根路径
@app.get("/")
async def root():
    """根路径信息"""
    return {
        "service": "AI-Agile-DAP AI引擎",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }

if __name__ == "__main__":
    logger.info("🚀 启动AI引擎服务...")
    logger.info(f"📊 监控指标: /metrics")
    logger.info(f"📚 API文档: /docs")
    logger.info(f"❤️ 健康检查: /health")
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=config.log_level.lower() == "debug",
        log_level=config.log_level.lower()
    )