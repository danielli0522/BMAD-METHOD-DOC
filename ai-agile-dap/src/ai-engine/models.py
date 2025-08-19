"""
数据模型定义
"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum


class QueryType(str, Enum):
    """查询类型枚举"""
    TREND = "trend"          # 趋势分析
    COMPARISON = "comparison"  # 对比分析
    RANKING = "ranking"      # 排名分析
    STATISTICS = "statistics" # 统计分析
    PROPORTION = "proportion" # 占比分析


class ChartType(str, Enum):
    """图表类型枚举"""
    LINE = "line"           # 折线图
    BAR = "bar"            # 柱状图
    PIE = "pie"            # 饼图
    NUMBER = "number"       # 数值卡片
    TABLE = "table"        # 表格


class QueryIntent(BaseModel):
    """查询意图解析结果"""
    query_type: QueryType
    entities: List[str] = Field(default=[], description="识别的实体")
    time_range: Optional[str] = Field(None, description="时间范围")
    dimensions: List[str] = Field(default=[], description="分析维度")
    metrics: List[str] = Field(default=[], description="分析指标")
    filters: Dict[str, Any] = Field(default={}, description="筛选条件")
    confidence: float = Field(ge=0, le=1, description="置信度")


class SQLQuery(BaseModel):
    """SQL查询对象"""
    sql: str = Field(..., description="生成的SQL语句")
    parameters: Dict[str, Any] = Field(default={}, description="查询参数")
    estimated_cost: Optional[int] = Field(None, description="预估执行成本")
    safety_score: float = Field(ge=0, le=1, description="安全评分")


class QueryRequest(BaseModel):
    """查询请求"""
    natural_query: str = Field(..., min_length=1, max_length=500)
    user_id: Optional[str] = None
    session_id: Optional[str] = None
    context: Dict[str, Any] = Field(default={})


class QueryResult(BaseModel):
    """查询结果"""
    query_id: str
    intent: QueryIntent
    sql_query: SQLQuery
    recommended_chart: ChartType
    data: Optional[List[Dict[str, Any]]] = None
    execution_time_ms: Optional[int] = None
    created_at: datetime = Field(default_factory=datetime.now)


class QueryError(Exception):
    """查询错误异常类"""
    def __init__(self, error_type: str, error_message: str, user_friendly_message: str = "", suggestions: List[str] = None):
        self.error_type = error_type
        self.error_message = error_message
        self.user_friendly_message = user_friendly_message or error_message
        self.suggestions = suggestions or []
        super().__init__(error_message)