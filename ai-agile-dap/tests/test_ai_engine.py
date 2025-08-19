"""
AI引擎核心功能测试
"""
import pytest
import asyncio
from unittest.mock import AsyncMock, patch
from src.ai_engine.models import QueryRequest, QueryType, QueryIntent
from src.ai_engine.ai_engine import AIEngine
from src.ai_engine.nlp_processor import NLPProcessor
from src.ai_engine.sql_generator import SQLGenerator
from src.ai_engine.chart_recommender import ChartRecommender


class TestNLPProcessor:
    """测试自然语言处理器"""
    
    def setup_method(self):
        self.nlp_processor = NLPProcessor()
    
    def test_preprocess_query(self):
        """测试查询预处理"""
        query = "显示  本月   的销售趋势"
        processed = self.nlp_processor._preprocess_query(query)
        assert processed == "显示 this month 的销售趋势"
    
    def test_pattern_classify(self):
        """测试模式分类"""
        # 趋势查询
        trend_query = "显示过去3个月的销售趋势"
        result = self.nlp_processor._pattern_classify(trend_query)
        assert result == QueryType.TREND
        
        # 对比查询
        comparison_query = "对比各部门的销售业绩"
        result = self.nlp_processor._pattern_classify(comparison_query)
        assert result == QueryType.COMPARISON
        
        # 排名查询
        ranking_query = "销售额TOP10的产品"
        result = self.nlp_processor._pattern_classify(ranking_query)
        assert result == QueryType.RANKING


class TestSQLGenerator:
    """测试SQL生成器"""
    
    def setup_method(self):
        self.sql_generator = SQLGenerator()
        self.mock_schema = {
            "main_table": "sales_data",
            "columns": ["date", "product", "amount", "region"]
        }
    
    def test_check_sql_safety(self):
        """测试SQL安全检查"""
        # 安全的SELECT查询
        safe_sql = "SELECT product, SUM(amount) FROM sales_data GROUP BY product"
        safety_score = self.sql_generator._check_sql_safety(safe_sql)
        assert safety_score >= 0.8
        
        # 危险的DROP查询
        dangerous_sql = "DROP TABLE sales_data"
        safety_score = self.sql_generator._check_sql_safety(dangerous_sql)
        assert safety_score == 0.0
    
    def test_map_entities_to_columns(self):
        """测试实体到列的映射"""
        entities = ["产品", "金额"]
        columns = ["product", "amount", "date"]
        
        mapped = self.sql_generator._map_entities_to_columns(entities, columns)
        assert "product" in mapped
        assert "amount" in mapped
    
    def test_estimate_query_cost(self):
        """测试查询成本预估"""
        simple_sql = "SELECT * FROM table"
        cost = self.sql_generator._estimate_query_cost(simple_sql, self.mock_schema)
        assert cost >= 1
        
        complex_sql = "SELECT * FROM table1 JOIN table2 ON table1.id = table2.id GROUP BY column ORDER BY column"
        complex_cost = self.sql_generator._estimate_query_cost(complex_sql, self.mock_schema)
        assert complex_cost > cost


class TestChartRecommender:
    """测试图表推荐器"""
    
    def setup_method(self):
        self.chart_recommender = ChartRecommender()
    
    def test_basic_chart_recommendation(self):
        """测试基础图表推荐"""
        from src.ai_engine.models import ChartType
        
        # 趋势分析推荐折线图
        intent = QueryIntent(
            query_type=QueryType.TREND,
            entities=[],
            confidence=0.9
        )
        chart = self.chart_recommender.recommend_chart(intent)
        assert chart == ChartType.LINE
        
        # 占比分析推荐饼图
        intent = QueryIntent(
            query_type=QueryType.PROPORTION,
            entities=[],
            confidence=0.9
        )
        chart = self.chart_recommender.recommend_chart(intent)
        assert chart == ChartType.PIE
    
    def test_data_driven_recommendation(self):
        """测试基于数据的图表推荐"""
        from src.ai_engine.models import ChartType
        
        # 时间序列数据
        time_series_data = [
            {"date": "2024-01", "value": 100},
            {"date": "2024-02", "value": 120}
        ]
        
        intent = QueryIntent(
            query_type=QueryType.COMPARISON,
            entities=[],
            confidence=0.9
        )
        
        chart = self.chart_recommender._optimize_chart_by_data(
            ChartType.BAR, time_series_data, intent
        )
        assert chart == ChartType.LINE
    
    def test_has_time_series_data(self):
        """测试时间序列数据检测"""
        data_with_time = [{"date": "2024-01", "value": 100}]
        assert self.chart_recommender._has_time_series_data(data_with_time) == True
        
        data_without_time = [{"category": "A", "value": 100}]
        assert self.chart_recommender._has_time_series_data(data_without_time) == False


class TestAIEngine:
    """测试AI引擎集成功能"""
    
    def setup_method(self):
        self.ai_engine = AIEngine()
    
    @pytest.mark.asyncio
    async def test_validate_query(self):
        """测试查询验证"""
        # 有效查询
        valid_result = await self.ai_engine.validate_query("显示过去3个月的销售趋势")
        assert valid_result["valid"] == True
        
        # 过短查询
        short_result = await self.ai_engine.validate_query("数据")
        assert short_result["valid"] == False
        
        # 过长查询
        long_query = "a" * 501
        long_result = await self.ai_engine.validate_query(long_query)
        assert long_result["valid"] == False
    
    def test_generate_mock_data(self):
        """测试模拟数据生成"""
        from src.ai_engine.models import SQLQuery
        
        # 趋势分析模拟数据
        intent = QueryIntent(
            query_type=QueryType.TREND,
            entities=[],
            confidence=0.9
        )
        sql_query = SQLQuery(sql="SELECT * FROM table", safety_score=0.9)
        
        data = self.ai_engine._generate_mock_data(intent, sql_query)
        assert len(data) > 0
        assert "date" in data[0]
        assert "value" in data[0]


@pytest.mark.asyncio
class TestIntegration:
    """集成测试"""
    
    async def test_end_to_end_processing(self):
        """测试端到端查询处理"""
        with patch('src.ai_engine.nlp_processor.AsyncOpenAI') as mock_openai:
            # 模拟OpenAI响应
            mock_response = AsyncMock()
            mock_response.choices = [AsyncMock()]
            mock_response.choices[0].message.content = '''
            {
                "query_type": "trend",
                "entities": ["销售"],
                "time_range": "3个月",
                "dimensions": ["时间"],
                "metrics": ["销售额"],
                "filters": {},
                "confidence": 0.9
            }
            '''
            
            mock_client = AsyncMock()
            mock_client.chat.completions.create.return_value = mock_response
            mock_openai.return_value = mock_client
            
            # 创建AI引擎并处理查询
            ai_engine = AIEngine()
            request = QueryRequest(natural_query="显示过去3个月的销售趋势")
            
            result = await ai_engine.process_query(request)
            
            assert result.intent.query_type == QueryType.TREND
            assert result.sql_query.sql is not None
            assert result.recommended_chart is not None
            assert result.data is not None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])