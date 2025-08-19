"""
AI引擎主控制器
整合自然语言处理、SQL生成和图表推荐功能
"""
import uuid
import time
import logging
from typing import Dict, Any, List, Optional
from models import QueryRequest, QueryResult, QueryError, ChartType
from nlp_processor_v2 import NLPProcessorV2
from sql_generator import SQLGenerator
from chart_recommender import ChartRecommender

logger = logging.getLogger(__name__)


class AIEngine:
    """AI引擎主控制器"""
    
    def __init__(self):
        self.nlp_processor = NLPProcessorV2()
        self.sql_generator = SQLGenerator()
        self.chart_recommender = ChartRecommender()
        
        # 模拟数据库schema信息
        self.mock_schema = {
            "main_table": "business_data",
            "columns": [
                "date",
                "department", 
                "product_name",
                "sales_amount",
                "customer_count",
                "region",
                "created_at",
                "updated_at"
            ]
        }
    
    async def process_query(self, request: QueryRequest) -> QueryResult:
        """
        处理自然语言查询请求
        
        Args:
            request: 查询请求
            
        Returns:
            QueryResult: 查询结果
        """
        query_id = str(uuid.uuid4())
        start_time = time.time()
        
        try:
            logger.info(f"开始处理查询 {query_id}: {request.natural_query}")
            
            # 第一步：解析自然语言查询意图
            intent = await self.nlp_processor.parse_query_intent(request.natural_query)
            logger.info(f"查询意图解析完成 {query_id}: {intent.query_type.value}, 置信度: {intent.confidence}")
            
            # 第二步：生成SQL查询
            sql_query = await self.sql_generator.generate_sql(intent, self.mock_schema)
            logger.info(f"SQL生成完成 {query_id}: {sql_query.sql}")
            
            # 第三步：推荐图表类型
            recommended_chart = self.chart_recommender.recommend_chart(intent)
            logger.info(f"图表推荐完成 {query_id}: {recommended_chart.value}")
            
            # 第四步：模拟数据执行(实际项目中会连接数据库)
            mock_data = self._generate_mock_data(intent, sql_query)
            
            # 计算执行时间
            execution_time = int((time.time() - start_time) * 1000)
            
            # 构建查询结果
            result = QueryResult(
                query_id=query_id,
                intent=intent,
                sql_query=sql_query,
                recommended_chart=recommended_chart,
                data=mock_data,
                execution_time_ms=execution_time
            )
            
            logger.info(f"查询处理完成 {query_id}, 耗时: {execution_time}ms")
            return result
            
        except QueryError:
            # 重新抛出查询错误
            raise
        except Exception as e:
            logger.error(f"查询处理失败 {query_id}: {str(e)}")
            raise QueryError(
                error_type="PROCESSING_ERROR",
                error_message=str(e),
                user_friendly_message="查询处理过程中出现错误，请稍后重试。"
            )
    
    def _generate_mock_data(self, intent, sql_query) -> List[Dict[str, Any]]:
        """生成模拟数据用于测试"""
        query_type = intent.query_type
        
        if query_type.value == "trend":
            return [
                {"date": "2024-01", "value": 1200},
                {"date": "2024-02", "value": 1350},
                {"date": "2024-03", "value": 1100},
                {"date": "2024-04", "value": 1600},
                {"date": "2024-05", "value": 1800}
            ]
        
        elif query_type.value == "comparison":
            return [
                {"category": "产品A", "value": 2500},
                {"category": "产品B", "value": 1800},
                {"category": "产品C", "value": 3200},
                {"category": "产品D", "value": 1200}
            ]
        
        elif query_type.value == "ranking":
            return [
                {"rank": 1, "name": "销售部", "score": 95.5},
                {"rank": 2, "name": "市场部", "score": 88.2},
                {"rank": 3, "name": "技术部", "score": 82.1},
                {"rank": 4, "name": "运营部", "score": 78.9}
            ]
        
        elif query_type.value == "statistics":
            return [
                {
                    "total_count": 1250,
                    "avg_value": 85.6,
                    "sum_value": 107000,
                    "max_value": 150.2,
                    "min_value": 12.5
                }
            ]
        
        elif query_type.value == "proportion":
            return [
                {"category": "华北", "value": 4500, "percentage": 35.2},
                {"category": "华南", "value": 3200, "percentage": 25.1},
                {"category": "华东", "value": 2800, "percentage": 21.9},
                {"category": "西南", "value": 2300, "percentage": 17.8}
            ]
        
        else:
            return [{"message": "查询完成", "count": 1}]
    
    async def validate_query(self, natural_query: str) -> Dict[str, Any]:
        """
        验证查询是否有效
        
        Args:
            natural_query: 自然语言查询
            
        Returns:
            Dict: 验证结果
        """
        try:
            if len(natural_query.strip()) < 5:
                return {
                    "valid": False,
                    "message": "查询过短，请提供更详细的描述",
                    "suggestions": ["请尝试描述您想了解的具体数据信息"]
                }
            
            if len(natural_query) > 500:
                return {
                    "valid": False,
                    "message": "查询过长，请简化您的描述",
                    "suggestions": ["请将复杂查询拆分为多个简单查询"]
                }
            
            # 简单的关键词检查
            data_keywords = ["销售", "数据", "统计", "分析", "报表", "趋势", "对比", "排名"]
            has_data_keyword = any(keyword in natural_query for keyword in data_keywords)
            
            if not has_data_keyword:
                return {
                    "valid": False,
                    "message": "查询似乎与数据分析无关",
                    "suggestions": [
                        "请尝试询问关于销售、统计或分析相关的问题",
                        "例如：'显示过去三个月的销售趋势'"
                    ]
                }
            
            return {
                "valid": True,
                "message": "查询格式正确",
                "suggestions": []
            }
            
        except Exception as e:
            logger.error(f"查询验证失败: {str(e)}")
            return {
                "valid": False,
                "message": "查询验证过程中出现错误",
                "suggestions": ["请检查查询格式后重试"]
            }