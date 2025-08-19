"""
AI引擎配置管理
"""
import os
from typing import Optional
from pydantic import BaseModel, Field
from pydantic_settings import BaseSettings


class AIEngineConfig(BaseSettings):
    """AI引擎配置类"""
    
    # 模型提供商配置
    model_provider: str = Field(default="doubao", description="模型提供商 (openai/doubao)")
    
    # OpenAI配置
    openai_api_key: str = Field(default="test_key_placeholder", description="OpenAI API密钥")
    openai_model: str = Field(default="gpt-4", description="OpenAI模型")
    openai_temperature: float = Field(default=0.1, description="模型温度")
    openai_max_tokens: int = Field(default=1000, description="最大token数")
    
    # Doubao配置
    doubao_api_key: str = Field(default="9a1205fc-5eae-4f12-8cc3-b5d558bd9a70", description="豆包模型API密钥")
    doubao_model: str = Field(default="doubao-seed-1-6-250615", description="豆包模型ID")
    doubao_region: str = Field(default="", description="火山引擎区域")
    doubao_access_key: str = Field(default="", description="火山引擎Access Key")
    doubao_secret_key: str = Field(default="", description="火山引擎Secret Key")
    doubao_retry_times: Optional[int] = Field(default=None, description="重试次数")
    doubao_temperature: float = Field(default=0.1, description="模型温度")
    doubao_max_tokens: int = Field(default=1000, description="最大token数")
    
    # 查询配置
    max_query_length: int = Field(default=500, description="最大查询长度")
    sql_timeout_seconds: int = Field(default=30, description="SQL超时时间")
    
    # 缓存配置
    enable_cache: bool = Field(default=True, description="启用缓存")
    cache_ttl_seconds: int = Field(default=3600, description="缓存TTL")
    
    # 日志配置
    log_level: str = Field(default="INFO", description="日志级别")
    
    model_config = {
        "env_file": ".env",
        "case_sensitive": False,
        "extra": "ignore"
    }


# 全局配置实例
config = AIEngineConfig()