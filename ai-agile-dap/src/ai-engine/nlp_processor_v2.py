"""
自然语言处理器 v2.0
Sprint 1 生产版本 - 集成OpenAI API和本地备用方案
"""
import re
import json
import logging
import asyncio
from typing import Optional, Dict, Any, List
from datetime import datetime
import aiohttp
from openai import AsyncOpenAI

from models import QueryIntent, QueryType, QueryError
from config import config

logger = logging.getLogger(__name__)


class NLPProcessorV2:
    """生产级自然语言处理器"""
    
    def __init__(self):
        self.openai_client = AsyncOpenAI(api_key=config.openai_api_key)
        self.api_call_count = 0
        self.api_cost_tracking = []
        self.query_patterns = self._load_query_patterns()
        self.fallback_enabled = True
        
    def _load_query_patterns(self) -> Dict[str, List[str]]:
        """加载优化的查询模式匹配规则"""
        return {
            "trend": [
                r"趋势|变化|增长|下降|走势|发展|演变|波动|起伏",
                r"过去.*?[月天年]|最近.*?[月天年]|.*?期间|历史|时间|变迁",
                r"增长率|变化率|同比|环比|涨幅|跌幅|增速|降速",
                r"连续|持续|逐年|逐月|逐日|年度|月度|日度"
            ],
            "comparison": [
                r"对比|比较|相比|vs|versus|对照|PK|比拼",
                r"哪个.*?[好高多大小优劣强弱]|谁.*?[好高多大小优劣强弱]",
                r"差异|区别|差别|不同|优劣|强弱|高低",
                r"各.*?之间|.*?和.*?|.*?与.*?|.*?跟.*?"
            ],
            "ranking": [
                r"排名|排行|TOP|前.*?名|最.*?的|第.*?名|位列",
                r"第[一二三四五六七八九十1-9]|最[高低大小多少好坏优劣强弱]",
                r"冠军|亚军|季军|榜首|末位|首位|倒数",
                r"排序|排列|名次|座次|位次"
            ],
            "statistics": [
                r"总.*?|平均|平均值|总和|总计|合计|汇总",
                r"统计|汇总|概况|情况|数据|指标|概览",
                r"数量|个数|总数|计数|求和|累计",
                r"最大值|最小值|最高|最低|极值|均值"
                r"多少|几个|数量|总数"
            ],
            "proportion": [
                r"占比|比例|百分比|份额|占据",
                r"分布|构成|组成|比重|权重",
                r"%|percent|比率"
            ]
        }
    
    async def parse_query_intent(self, natural_query: str, 
                                use_openai: bool = True) -> QueryIntent:
        """
        解析查询意图 - 生产级实现
        
        Args:
            natural_query: 自然语言查询
            use_openai: 是否使用OpenAI API
            
        Returns:
            QueryIntent: 解析后的查询意图
        """
        try:
            # 记录API调用
            start_time = datetime.now()
            
            # 预处理查询
            cleaned_query = self._preprocess_query(natural_query)
            logger.info(f"🧠 处理查询: {cleaned_query}")
            
            # 基础模式匹配
            base_type = self._pattern_classify(cleaned_query)
            base_confidence = 0.6
            
            # 如果启用OpenAI且配置正确，使用深度解析
            if use_openai and self._should_use_openai():
                try:
                    intent_result = await self._openai_parse_intent(
                        cleaned_query, base_type
                    )
                    self._track_api_usage(start_time)
                    return intent_result
                    
                except Exception as e:
                    logger.warning(f"OpenAI解析失败，使用备用方案: {e}")
                    # 降级到本地解析
                    
            # 本地备用解析方案
            return self._local_parse_intent(cleaned_query, base_type, base_confidence)
            
        except Exception as e:
            logger.error(f"查询意图解析失败: {str(e)}")
            raise QueryError(
                error_type="INTENT_PARSING_ERROR",
                error_message=str(e),
                user_friendly_message="无法理解您的查询，请尝试用更简单的语言描述。",
                suggestions=[
                    "请使用更简单直接的语言",
                    "明确指定时间范围，如'过去3个月'",
                    "明确指定分析对象，如'销售额'、'用户数'"
                ]
            )
    
    def _should_use_openai(self) -> bool:
        """判断是否应该使用OpenAI API"""
        # 检查每日调用限制
        daily_limit = 1000  # 每日限制1000次调用
        if self.api_call_count >= daily_limit:
            logger.warning("已达到每日OpenAI API调用限制")
            return False
        
        # 检查API密钥
        if not config.openai_api_key or config.openai_api_key == "test_key_placeholder":
            logger.warning("OpenAI API密钥未配置")
            return False
        
        return True
    
    async def _openai_parse_intent(self, query: str, base_type: QueryType) -> QueryIntent:
        """使用OpenAI进行深度解析"""
        system_prompt = """你是一个专业的中文数据查询意图解析专家。

用户会用自然语言描述数据分析需求，请准确解析：
1. 查询类型：trend(趋势分析)、comparison(对比分析)、ranking(排名分析)、statistics(统计分析)、proportion(占比分析)
2. 实体词：涉及的业务对象(产品、部门、客户等)
3. 时间范围：查询的时间范围
4. 分析维度：按什么维度分组
5. 分析指标：关注的数据指标
6. 筛选条件：查询的过滤条件
7. 置信度：对解析结果的确信程度(0-1)

严格按JSON格式返回：
{
  "query_type": "trend|comparison|ranking|statistics|proportion",
  "entities": ["实体1", "实体2"],
  "time_range": "时间范围",
  "dimensions": ["维度1"],
  "metrics": ["指标1"],
  "filters": {},
  "confidence": 0.95
}"""

        user_prompt = f"""请解析查询: "{query}"

初步分类: {base_type.value}

返回标准JSON格式结果。"""

        try:
            response = await self.openai_client.chat.completions.create(
                model=config.openai_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=config.openai_temperature,
                max_tokens=config.openai_max_tokens,
                timeout=10.0  # 10秒超时
            )
            
            content = response.choices[0].message.content.strip()
            
            # 提取JSON
            json_match = re.search(r'\{.*\}', content, re.DOTALL)
            if json_match:
                json_str = json_match.group()
                intent_data = json.loads(json_str)
                
                # 验证数据完整性
                if self._validate_intent_data(intent_data):
                    return QueryIntent(**intent_data)
                else:
                    raise ValueError("OpenAI返回数据不完整")
            else:
                raise ValueError("OpenAI返回格式不正确")
                
        except asyncio.TimeoutError:
            logger.error("OpenAI API调用超时")
            raise
        except Exception as e:
            logger.error(f"OpenAI API调用失败: {e}")
            raise
    
    def _local_parse_intent(self, query: str, base_type: QueryType, 
                           confidence: float) -> QueryIntent:
        """本地备用解析方案 - 增强置信度评估"""
        logger.info("🔄 使用本地解析方案")
        
        # 实体识别
        entities = self._extract_entities(query)
        
        # 时间范围识别
        time_range = self._extract_time_range(query)
        
        # 维度和指标识别
        dimensions, metrics = self._extract_dimensions_metrics(query)
        
        # 筛选条件识别
        filters = self._extract_filters(query)
        
        # 计算增强的置信度
        enhanced_confidence = self._calculate_enhanced_confidence(
            query, base_type, entities, time_range, dimensions, metrics
        )
        
        return QueryIntent(
            query_type=base_type,
            entities=entities,
            time_range=time_range,
            dimensions=dimensions,
            metrics=metrics,
            filters=filters,
            confidence=enhanced_confidence
        )
    
    def _calculate_enhanced_confidence(self, query: str, query_type: QueryType, 
                                     entities: List[str], time_range: Optional[str],
                                     dimensions: List[str], metrics: List[str]) -> float:
        """
        计算增强的置信度评分
        
        Args:
            query: 原始查询
            query_type: 查询类型
            entities: 识别的实体
            time_range: 时间范围
            dimensions: 分析维度
            metrics: 分析指标
            
        Returns:
            float: 置信度评分 (0-1)
        """
        confidence_factors = []
        
        # 1. 查询类型匹配度 (0.3权重)
        type_patterns = self.query_patterns.get(query_type.value, [])
        type_match_count = 0
        for pattern in type_patterns:
            if re.search(pattern, query, re.IGNORECASE):
                type_match_count += 1
        
        type_confidence = min(type_match_count / len(type_patterns), 1.0) if type_patterns else 0.3
        confidence_factors.append(("query_type", type_confidence, 0.3))
        
        # 2. 实体识别完整性 (0.2权重) 
        # 根据实体数量和质量评分
        entity_score = 0
        if len(entities) >= 3:
            entity_score = 1.0
        elif len(entities) >= 2:
            entity_score = 0.8
        elif len(entities) >= 1:
            entity_score = 0.6
        else:
            entity_score = 0.3
        confidence_factors.append(("entities", entity_score, 0.2))
        
        # 3. 时间范围明确度 (0.2权重)
        time_confidence = 0.9 if time_range else 0.4  # 有明确时间范围置信度更高
        confidence_factors.append(("time_range", time_confidence, 0.2))
        
        # 4. 分析维度清晰度 (0.15权重)
        dim_confidence = min(len(dimensions) / 1, 1.0) if dimensions else 0.5
        confidence_factors.append(("dimensions", dim_confidence, 0.15))
        
        # 5. 分析指标明确性 (0.15权重)
        metric_confidence = min(len(metrics) / 1, 1.0) if metrics else 0.5
        confidence_factors.append(("metrics", metric_confidence, 0.15))
        
        # 计算加权平均置信度
        weighted_confidence = sum(score * weight for _, score, weight in confidence_factors)
        
        # 额外加分项
        bonus_points = 0
        
        # 查询长度合理性加分
        query_length = len(query.strip())
        if 10 <= query_length <= 100:
            bonus_points += 0.05
        
        # 关键词密度加分
        business_keywords = [
            "销售", "业绩", "数据", "分析", "统计", "对比", "趋势",
            "营收", "利润", "成本", "客户", "产品", "部门", "地区"
        ]
        keyword_count = sum(1 for kw in business_keywords if kw in query)
        if keyword_count >= 2:
            bonus_points += 0.05
        if keyword_count >= 4:
            bonus_points += 0.05  # 关键词更多时额外加分
        
        # 最终置信度
        final_confidence = min(weighted_confidence + bonus_points, 1.0)
        
        # 记录置信度计算详情
        logger.info(f"📊 置信度计算详情:")
        for factor, score, weight in confidence_factors:
            logger.info(f"  - {factor}: {score:.2f} (权重: {weight})")
        logger.info(f"  - 加分项: {bonus_points:.2f}")
        logger.info(f"  - 最终置信度: {final_confidence:.2f}")
        
        return round(final_confidence, 2)
    
    def _preprocess_query(self, query: str) -> str:
        """查询预处理优化"""
        # 去除多余空格和标点
        query = re.sub(r'\s+', ' ', query.strip())
        query = re.sub(r'[，。！？；：""''（）【】]', '', query)
        
        # 标准化时间表达
        time_mappings = {
            "今天": "today", "昨天": "yesterday", "明天": "tomorrow",
            "本周": "this week", "上周": "last week", "下周": "next week",
            "本月": "this month", "上月": "last month", "下月": "next month",
            "今年": "this year", "去年": "last year", "明年": "next year",
            "最近": "recent", "过去": "past"
        }
        
        for chinese, english in time_mappings.items():
            query = query.replace(chinese, english)
        
        return query
    
    def _pattern_classify(self, query: str) -> QueryType:
        """优化的模式分类"""
        type_scores = {}
        
        for query_type, patterns in self.query_patterns.items():
            score = 0
            for pattern in patterns:
                matches = re.findall(pattern, query, re.IGNORECASE)
                score += len(matches)
            type_scores[query_type] = score
        
        # 获取最高分类型
        if type_scores:
            best_type = max(type_scores.items(), key=lambda x: x[1])
            if best_type[1] > 0:
                return QueryType(best_type[0])
        
        # 默认为统计分析
        return QueryType.STATISTICS
    
    def _extract_entities(self, query: str) -> List[str]:
        """实体识别"""
        entities = []
        
        # 增强的业务实体关键词库
        business_entities = {
            # 业务对象
            "部门": ["部门", "科室", "分公司", "事业部", "中心"],
            "产品": ["产品", "商品", "服务", "项目", "方案"],
            "客户": ["客户", "用户", "消费者", "买家", "顾客"],
            "员工": ["员工", "人员", "职员", "工作人员", "团队"],
            "地区": ["地区", "区域", "城市", "省份", "市场"]
        }
        
        # 业务指标关键词
        business_metrics = [
            "销售额", "营业额", "收入", "利润", "成本", "费用",
            "业绩", "绩效", "增长率", "占比", "份额", "数量",
            "单价", "客单价", "转化率", "留存率", "活跃度"
        ]
        
        # 识别业务对象
        for category, keywords in business_entities.items():
            for keyword in keywords:
                if keyword in query:
                    entities.append(keyword)
                    break  # 每个类别只添加一次
        
        # 识别业务指标
        for metric in business_metrics:
            if metric in query:
                entities.append(metric)
        
        return list(set(entities))  # 去重
    
    def _extract_time_range(self, query: str) -> Optional[str]:
        """时间范围提取"""
        time_patterns = [
            r"past \d+ month", r"last \d+ month", r"recent \d+ month",
            r"today", r"yesterday", r"this week", r"last week",
            r"this month", r"last month", r"this year", r"last year"
        ]
        
        for pattern in time_patterns:
            match = re.search(pattern, query, re.IGNORECASE)
            if match:
                return match.group()
        
        return None
    
    def _extract_dimensions_metrics(self, query: str) -> tuple:
        """维度和指标提取"""
        dimensions = []
        metrics = []
        
        # 常见维度
        dimension_words = ["部门", "地区", "产品", "渠道", "客户", "时间"]
        for dim in dimension_words:
            if dim in query:
                dimensions.append(dim)
        
        # 常见指标
        metric_words = ["销售额", "收入", "利润", "数量", "客户数", "用户数"]
        for metric in metric_words:
            if metric in query:
                metrics.append(metric)
        
        return dimensions, metrics
    
    def _extract_filters(self, query: str) -> Dict[str, Any]:
        """筛选条件提取"""
        filters = {}
        
        # 简单的条件识别
        if "大于" in query or "超过" in query:
            filters["condition"] = "greater_than"
        elif "小于" in query or "低于" in query:
            filters["condition"] = "less_than"
        elif "等于" in query:
            filters["condition"] = "equal"
        
        return filters
    
    def _validate_intent_data(self, data: Dict[str, Any]) -> bool:
        """验证意图数据完整性"""
        required_fields = ["query_type", "entities", "confidence"]
        return all(field in data for field in required_fields)
    
    def _track_api_usage(self, start_time: datetime):
        """跟踪API使用情况"""
        self.api_call_count += 1
        duration = (datetime.now() - start_time).total_seconds()
        
        self.api_cost_tracking.append({
            "timestamp": start_time.isoformat(),
            "duration": duration,
            "call_count": self.api_call_count
        })
        
        # 记录统计信息
        logger.info(f"📊 API调用统计: 第{self.api_call_count}次, 耗时{duration:.2f}秒")
    
    def get_api_statistics(self) -> Dict[str, Any]:
        """获取API使用统计"""
        return {
            "total_calls": self.api_call_count,
            "daily_limit": 1000,
            "remaining_calls": max(0, 1000 - self.api_call_count),
            "recent_calls": self.api_cost_tracking[-10:] if self.api_cost_tracking else []
        }