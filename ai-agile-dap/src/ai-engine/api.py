"""
AI引擎 FastAPI 服务
提供RESTful API接口
"""
import logging
import traceback
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from models import QueryRequest, QueryResult, QueryError
from ai_engine import AIEngine

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 创建FastAPI应用
app = FastAPI(
    title="AI-Agile-DAP AI引擎",
    description="自然语言到SQL转换的AI引擎服务",
    version="0.1.0"
)

# 添加CORS支持
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 生产环境中应该指定具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 初始化AI引擎
ai_engine = AIEngine()

def _generate_chart_config(data, chart_type):
    """
    根据数据和图表类型生成ECharts配置
    
    Args:
        data: 查询结果数据
        chart_type: 图表类型
        
    Returns:
        dict: ECharts配置对象
    """
    if not data or len(data) == 0:
        return {}
    
    # 获取第一行数据的键值作为字段名
    fields = list(data[0].keys()) if data else []
    
    if chart_type.value == "bar":
        # 柱状图配置
        categories = [str(row[fields[0]]) for row in data] if len(fields) > 0 else []
        values = [row[fields[1]] for row in data] if len(fields) > 1 else []
        
        return {
            "title": {"text": "数据分析结果"},
            "tooltip": {"trigger": "axis"},
            "xAxis": {
                "type": "category",
                "data": categories
            },
            "yAxis": {"type": "value"},
            "series": [{
                "name": fields[1] if len(fields) > 1 else "数值",
                "type": "bar",
                "data": values
            }]
        }
    
    elif chart_type.value == "line":
        # 折线图配置
        categories = [str(row[fields[0]]) for row in data] if len(fields) > 0 else []
        values = [row[fields[1]] for row in data] if len(fields) > 1 else []
        
        return {
            "title": {"text": "趋势分析"},
            "tooltip": {"trigger": "axis"},
            "xAxis": {
                "type": "category",
                "data": categories
            },
            "yAxis": {"type": "value"},
            "series": [{
                "name": fields[1] if len(fields) > 1 else "数值",
                "type": "line",
                "data": values
            }]
        }
    
    elif chart_type.value == "pie":
        # 饼图配置
        pie_data = []
        for row in data:
            if len(fields) >= 2:
                pie_data.append({
                    "name": str(row[fields[0]]),
                    "value": row[fields[1]]
                })
        
        return {
            "title": {"text": "占比分析"},
            "tooltip": {"trigger": "item"},
            "series": [{
                "name": "占比",
                "type": "pie",
                "radius": "50%",
                "data": pie_data
            }]
        }
    
    else:
        # 默认表格配置
        return {
            "title": {"text": "数据结果"},
            "tooltip": {"trigger": "item"},
            "series": [{
                "type": "table",
                "data": data
            }]
        }

# 全局异常处理
@app.exception_handler(Exception)
async def general_exception_handler(request, exc: Exception):
    """处理通用异常"""
    logger.error(f"未处理的异常: {traceback.format_exc()}")
    return JSONResponse(
        status_code=500,
        content={
            "error": True,
            "error_type": "INTERNAL_ERROR", 
            "message": "服务器内部错误",
            "user_message": "系统暂时不可用，请稍后重试",
            "suggestions": []
        }
    )

@app.get("/")
async def root():
    """根路径"""
    return {
        "service": "AI-Agile-DAP AI引擎",
        "version": "0.1.0",
        "status": "running"
    }

@app.get("/health")
async def health_check():
    """健康检查接口"""
    return {
        "status": "healthy",
        "service": "ai-engine",
        "timestamp": "2024-08-18T10:30:00Z"
    }

@app.post("/api/ai/query")
async def process_natural_query(request: QueryRequest):
    """
    处理自然语言查询请求 - 统一API格式
    
    Args:
        request: 查询请求对象
        
    Returns:
        标准化的JSON响应
    """
    import time
    start_time = time.time()
    
    try:
        logger.info(f"接收到查询请求: {request.natural_query}")
        
        # 调用AI引擎处理查询
        result = await ai_engine.process_query(request)
        
        # 计算处理时间
        processing_time = int((time.time() - start_time) * 1000)
        
        # 返回标准化格式
        response = {
            "success": True,
            "data": {
                "query_id": result.query_id,
                "understood_intent": f"{result.intent.query_type.value}查询",
                "sql_query": result.sql_query.sql,
                "execution_result": result.data or [],
                "chart_recommendation": {
                    "type": result.recommended_chart.value,
                    "config": _generate_chart_config(result.data, result.recommended_chart),
                    "reasoning": f"基于{result.intent.query_type.value}查询类型推荐{result.recommended_chart.value}图表"
                },
                "confidence_score": result.intent.confidence,
                "processing_time": processing_time
            },
            "message": "查询成功"
        }
        
        logger.info(f"查询处理成功: {result.query_id}, 耗时: {processing_time}ms")
        return response
        
    except QueryError as e:
        # 处理业务逻辑错误
        processing_time = int((time.time() - start_time) * 1000)
        return JSONResponse(
            status_code=400,
            content={
                "success": False,
                "error": {
                    "code": e.error_type,
                    "message": e.error_message,
                    "details": e.user_friendly_message,
                    "suggestions": e.suggestions
                },
                "request_id": f"req_{int(time.time())}"
            }
        )
    except Exception as e:
        # 处理系统错误
        processing_time = int((time.time() - start_time) * 1000)
        logger.error(f"查询处理失败: {str(e)}")
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": {
                    "code": "AI_PROCESSING_ERROR",
                    "message": "AI引擎处理失败",
                    "details": "系统内部错误，请稍后重试",
                    "suggestions": ["请检查查询格式", "稍后再试", "联系技术支持"]
                },
                "request_id": f"req_{int(time.time())}"
            }
        )

@app.post("/api/v1/validate")
async def validate_query(request: dict):
    """
    验证查询有效性
    
    Args:
        request: 包含natural_query字段的请求
        
    Returns:
        Dict: 验证结果
    """
    try:
        natural_query = request.get("natural_query", "")
        
        if not natural_query:
            raise HTTPException(status_code=400, detail="缺少natural_query字段")
        
        validation_result = await ai_engine.validate_query(natural_query)
        
        return validation_result
        
    except Exception as e:
        logger.error(f"查询验证失败: {str(e)}")
        raise HTTPException(status_code=500, detail="查询验证失败")

@app.get("/api/v1/supported-queries")
async def get_supported_queries():
    """
    获取支持的查询类型和示例
    
    Returns:
        Dict: 支持的查询类型
    """
    return {
        "supported_types": [
            {
                "type": "trend",
                "name": "趋势分析",
                "description": "分析数据随时间的变化趋势",
                "examples": [
                    "显示过去3个月的销售趋势",
                    "分析今年用户增长情况",
                    "查看本季度收入变化"
                ]
            },
            {
                "type": "comparison", 
                "name": "对比分析",
                "description": "比较不同维度或类别的数据",
                "examples": [
                    "对比各部门的销售业绩",
                    "比较不同产品的市场表现",
                    "各地区销售额对比"
                ]
            },
            {
                "type": "ranking",
                "name": "排名分析", 
                "description": "按指标对数据进行排序和排名",
                "examples": [
                    "销售额TOP10的产品",
                    "业绩最好的销售人员排名",
                    "客户满意度排行榜"
                ]
            },
            {
                "type": "statistics",
                "name": "统计分析",
                "description": "计算数据的统计指标",
                "examples": [
                    "本月总销售额统计",
                    "平均客单价是多少", 
                    "用户留存率统计"
                ]
            },
            {
                "type": "proportion",
                "name": "占比分析",
                "description": "分析各部分占整体的比例",
                "examples": [
                    "各产品销售占比",
                    "不同渠道的客户分布",
                    "各地区收入占比情况"
                ]
            }
        ],
        "tips": [
            "尽量使用具体的时间范围，如'过去3个月'而不是'最近'",
            "明确指定要分析的指标，如'销售额'、'用户数'等",
            "可以结合多个维度进行分析，如'按地区统计各产品销售情况'"
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)