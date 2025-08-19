"""
智能图表推荐引擎
根据查询类型和数据特征推荐合适的图表类型
"""
import logging
from typing import Dict, Any, List
from models import QueryIntent, ChartType, QueryType

logger = logging.getLogger(__name__)


class ChartRecommender:
    """图表推荐器"""
    
    def __init__(self):
        self.chart_rules = self._load_chart_rules()
    
    def _load_chart_rules(self) -> Dict[QueryType, ChartType]:
        """加载图表推荐规则"""
        return {
            QueryType.TREND: ChartType.LINE,          # 趋势分析 -> 折线图
            QueryType.COMPARISON: ChartType.BAR,      # 对比分析 -> 柱状图
            QueryType.RANKING: ChartType.BAR,         # 排名分析 -> 柱状图
            QueryType.STATISTICS: ChartType.NUMBER,   # 统计分析 -> 数值卡片
            QueryType.PROPORTION: ChartType.PIE       # 占比分析 -> 饼图
        }
    
    def recommend_chart(self, intent: QueryIntent, data_preview: List[Dict[str, Any]] = None) -> ChartType:
        """
        推荐合适的图表类型
        
        Args:
            intent: 查询意图
            data_preview: 数据预览(可选)
            
        Returns:
            ChartType: 推荐的图表类型
        """
        try:
            # 基于查询类型的基础推荐
            base_recommendation = self.chart_rules.get(intent.query_type, ChartType.TABLE)
            
            # 如果有数据预览，进行进一步优化
            if data_preview:
                return self._optimize_chart_by_data(base_recommendation, data_preview, intent)
            
            return base_recommendation
            
        except Exception as e:
            logger.error(f"图表推荐失败: {str(e)}")
            return ChartType.TABLE  # 默认返回表格
    
    def _optimize_chart_by_data(self, base_chart: ChartType, data_preview: List[Dict[str, Any]], 
                               intent: QueryIntent) -> ChartType:
        """根据数据特征优化图表推荐"""
        if not data_preview:
            return base_chart
        
        data_sample = data_preview[0] if data_preview else {}
        column_count = len(data_sample.keys())
        row_count = len(data_preview)
        
        # 分析数据特征
        has_time_series = self._has_time_series_data(data_preview)
        has_categories = self._has_categorical_data(data_preview)
        has_numeric_values = self._has_numeric_data(data_preview)
        
        # 根据数据特征调整推荐
        if has_time_series and has_numeric_values:
            return ChartType.LINE  # 时间序列数据优先折线图
        
        elif has_categories and has_numeric_values:
            if row_count <= 5:  # 少量分类适合饼图
                return ChartType.PIE
            elif row_count <= 20:  # 中等分类适合柱状图
                return ChartType.BAR
            else:  # 大量分类适合表格
                return ChartType.TABLE
        
        elif column_count == 1:  # 单列数据适合数值卡片
            return ChartType.NUMBER
        
        elif row_count > 50:  # 大量数据适合表格
            return ChartType.TABLE
        
        return base_chart
    
    def _has_time_series_data(self, data_preview: List[Dict[str, Any]]) -> bool:
        """检查是否包含时间序列数据"""
        if not data_preview:
            return False
        
        sample = data_preview[0]
        time_keywords = ['date', 'time', 'created', 'updated', 'timestamp']
        
        for key in sample.keys():
            key_lower = key.lower()
            if any(keyword in key_lower for keyword in time_keywords):
                return True
        
        return False
    
    def _has_categorical_data(self, data_preview: List[Dict[str, Any]]) -> bool:
        """检查是否包含分类数据"""
        if not data_preview:
            return False
        
        sample = data_preview[0]
        
        for key, value in sample.items():
            if isinstance(value, str) and not self._is_numeric_string(value):
                return True
        
        return False
    
    def _has_numeric_data(self, data_preview: List[Dict[str, Any]]) -> bool:
        """检查是否包含数值数据"""
        if not data_preview:
            return False
        
        sample = data_preview[0]
        
        for value in sample.values():
            if isinstance(value, (int, float)) or self._is_numeric_string(value):
                return True
        
        return False
    
    def _is_numeric_string(self, value: str) -> bool:
        """检查字符串是否为数值"""
        try:
            float(value)
            return True
        except (ValueError, TypeError):
            return False