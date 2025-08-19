"""
自然语言处理核心模块
负责解析用户的自然语言查询并提取查询意图
"""
import re
import json
import logging
from typing import Optional, Dict, Any, List
from openai import AsyncOpenAI
from .models import QueryIntent, QueryType, QueryError
from .config import config

logger = logging.getLogger(__name__)


class NLPProcessor:
    """自然语言处理器"""
    
    def __init__(self):
        self.client = AsyncOpenAI(api_key=config.openai_api_key)
        self.query_patterns = self._load_query_patterns()
    
    def _load_query_patterns(self) -> Dict[str, List[str]]:
        """加载查询模式匹配规则"""
        return {
            "trend": [
                r"趋势|变化|增长|下降|走势",
                r"过去.*月|最近.*天|.*期间",
                r"增长率|变化率|同比|环比"
            ],
            "comparison": [
                r"对比|比较|相比|vs",
                r"哪个.*好|哪个.*高|哪个.*多",
                r"差异|区别|差别"
            ],
            "ranking": [
                r"排名|排行|TOP|前.*名|最.*的",
                r"第一|第二|最高|最低|最大|最小"
            ],
            "statistics": [
                r"总.*|平均|平均值|总和|总计",
                r"统计|汇总|概况|情况"
            ],
            "proportion": [
                r"占比|比例|百分比|份额",
                r"分布|构成|组成"
            ]
        }
    
    async def parse_query_intent(self, natural_query: str) -> QueryIntent:
        """
        解析查询意图
        
        Args:
            natural_query: 自然语言查询
            
        Returns:
            QueryIntent: 解析后的查询意图
        """
        try:
            # 预处理查询
            cleaned_query = self._preprocess_query(natural_query)
            
            # 使用模式匹配进行初步分类
            initial_type = self._pattern_classify(cleaned_query)
            
            # 使用GPT-4进行深度解析
            intent_result = await self._gpt_parse_intent(cleaned_query, initial_type)
            
            return intent_result
            
        except Exception as e:
            logger.error(f"查询意图解析失败: {str(e)}")
            raise QueryError(
                error_type="INTENT_PARSING_ERROR",
                error_message=str(e),
                user_friendly_message="无法理解您的查询，请尝试用更简单的语言描述。"
            )
    
    def _preprocess_query(self, query: str) -> str:
        """预处理查询文本"""
        # 去除多余空格
        query = re.sub(r'\s+', ' ', query.strip())
        
        # 标准化时间表达
        time_mappings = {
            "今天": "today",
            "昨天": "yesterday", 
            "本周": "this week",
            "上周": "last week",
            "本月": "this month",
            "上月": "last month",
            "今年": "this year",
            "去年": "last year"
        }
        
        for chinese, english in time_mappings.items():
            query = query.replace(chinese, english)
        
        return query
    
    def _pattern_classify(self, query: str) -> QueryType:
        """使用模式匹配进行查询分类"""
        type_scores = {}
        
        for query_type, patterns in self.query_patterns.items():
            score = 0
            for pattern in patterns:
                matches = len(re.findall(pattern, query))
                score += matches
            type_scores[query_type] = score
        
        # 返回得分最高的类型
        best_type = max(type_scores.items(), key=lambda x: x[1])
        
        if best_type[1] > 0:
            return QueryType(best_type[0])
        else:
            return QueryType.STATISTICS  # 默认为统计类型
    
    async def _gpt_parse_intent(self, query: str, initial_type: QueryType) -> QueryIntent:
        """使用GPT-4深度解析查询意图"""
        
        system_prompt = """你是一个专业的数据查询意图解析专家。用户会用自然语言描述他们想要的数据分析需求，你需要准确解析出：

1. 查询类型：trend(趋势)、comparison(对比)、ranking(排名)、statistics(统计)、proportion(占比)
2. 实体：涉及的业务对象(如产品、部门、客户等)
3. 时间范围：查询的时间范围
4. 分析维度：按什么维度分组分析
5. 分析指标：关注的数据指标
6. 筛选条件：查询的过滤条件
7. 置信度：对解析结果的确信程度(0-1)

请以JSON格式返回结果，严格按照以下schema：
{
    "query_type": "trend|comparison|ranking|statistics|proportion",
    "entities": ["entity1", "entity2"],
    "time_range": "时间范围描述",
    "dimensions": ["维度1", "维度2"],
    "metrics": ["指标1", "指标2"], 
    "filters": {"条件名": "条件值"},
    "confidence": 0.95
}"""

        user_prompt = f"""请解析以下查询："{query}"

初步判断的查询类型是：{initial_type.value}

请给出完整的意图解析结果。"""

        try:
            response = await self.client.chat.completions.create(
                model=config.openai_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=config.openai_temperature,
                max_tokens=config.openai_max_tokens
            )
            
            # 解析GPT返回的JSON
            content = response.choices[0].message.content.strip()
            
            # 提取JSON部分
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                json_str = json_match.group()
                intent_data = json.loads(json_str)
                
                return QueryIntent(**intent_data)
            else:
                raise ValueError("GPT返回格式不正确")
                
        except Exception as e:
            logger.error(f"GPT解析失败: {str(e)}")
            # 返回基础解析结果
            return QueryIntent(
                query_type=initial_type,
                entities=[],
                confidence=0.5
            )