"""
SQL生成引擎
根据查询意图生成对应的SQL语句
"""
import re
import json
import logging
import sqlparse
from typing import Dict, List, Any, Optional
from openai import AsyncOpenAI
from models import QueryIntent, SQLQuery, QueryType, ChartType, QueryError
from config import config

logger = logging.getLogger(__name__)


class SQLGenerator:
    """SQL生成器"""
    
    def __init__(self):
        self.client = AsyncOpenAI(api_key=config.openai_api_key)
        self.sql_templates = self._load_sql_templates()
        self.dangerous_keywords = [
            'DROP', 'DELETE', 'TRUNCATE', 'ALTER', 'CREATE', 'INSERT', 
            'UPDATE', 'EXEC', 'EXECUTE', 'GRANT', 'REVOKE'
        ]
    
    def _load_sql_templates(self) -> Dict[str, str]:
        """加载SQL模板"""
        return {
            "trend": """
            SELECT {time_dimension}, {metrics}
            FROM {table}
            WHERE {time_filter}
            GROUP BY {time_dimension}
            ORDER BY {time_dimension}
            """,
            "comparison": """
            SELECT {dimensions}, {metrics}
            FROM {table}
            WHERE {filters}
            GROUP BY {dimensions}
            ORDER BY {metrics} DESC
            """,
            "ranking": """
            SELECT {dimensions}, {metrics}
            FROM {table}
            WHERE {filters}
            GROUP BY {dimensions}
            ORDER BY {metrics} DESC
            LIMIT {limit}
            """,
            "statistics": """
            SELECT 
                COUNT(*) as total_count,
                AVG({metric}) as avg_value,
                SUM({metric}) as sum_value,
                MAX({metric}) as max_value,
                MIN({metric}) as min_value
            FROM {table}
            WHERE {filters}
            """,
            "proportion": """
            SELECT 
                {dimension},
                {metric},
                ROUND({metric} * 100.0 / SUM({metric}) OVER (), 2) as percentage
            FROM {table}
            WHERE {filters}
            GROUP BY {dimension}
            ORDER BY {metric} DESC
            """
        }
    
    async def generate_sql(self, intent: QueryIntent, schema_info: Dict[str, Any]) -> SQLQuery:
        """
        根据查询意图生成SQL
        
        Args:
            intent: 查询意图
            schema_info: 数据库schema信息
            
        Returns:
            SQLQuery: 生成的SQL查询对象
        """
        try:
            # 使用模板生成基础SQL
            template_sql = self._generate_template_sql(intent, schema_info)
            
            # 使用GPT-4优化和完善SQL
            optimized_sql = await self._gpt_optimize_sql(template_sql, intent, schema_info)
            
            # SQL安全检查
            safety_score = self._check_sql_safety(optimized_sql)
            
            if safety_score < 0.8:
                raise QueryError(
                    error_type="SQL_SAFETY_ERROR",
                    error_message="生成的SQL包含潜在危险操作",
                    user_friendly_message="查询包含不安全的操作，已被阻止。"
                )
            
            # 预估执行成本
            estimated_cost = self._estimate_query_cost(optimized_sql, schema_info)
            
            return SQLQuery(
                sql=optimized_sql,
                parameters={},
                estimated_cost=estimated_cost,
                safety_score=safety_score
            )
            
        except Exception as e:
            logger.error(f"SQL生成失败: {str(e)}")
            raise QueryError(
                error_type="SQL_GENERATION_ERROR",
                error_message=str(e),
                user_friendly_message="无法为您的查询生成有效的SQL语句，请尝试重新描述。"
            )
    
    def _generate_template_sql(self, intent: QueryIntent, schema_info: Dict[str, Any]) -> str:
        """使用模板生成基础SQL"""
        query_type = intent.query_type.value
        template = self.sql_templates.get(query_type, self.sql_templates["statistics"])
        
        # 从schema信息中推断表名和字段
        main_table = schema_info.get("main_table", "data_table")
        available_columns = schema_info.get("columns", [])
        
        # 映射意图到具体字段
        dimensions = self._map_entities_to_columns(intent.dimensions, available_columns)
        metrics = self._map_entities_to_columns(intent.metrics, available_columns)
        
        # 构建WHERE条件
        filters = self._build_where_conditions(intent.filters, available_columns)
        
        # 构建时间筛选
        time_filter = self._build_time_filter(intent.time_range, available_columns)
        
        # 填充模板
        sql_params = {
            "table": main_table,
            "dimensions": ", ".join(dimensions) if dimensions else "1",
            "metrics": ", ".join(metrics) if metrics else "COUNT(*)",
            "metric": metrics[0] if metrics else "sales_amount",  # 单个指标用于statistics模板
            "dimension": dimensions[0] if dimensions else "category",  # 单个维度用于proportion模板
            "time_dimension": self._get_time_dimension(available_columns),
            "filters": filters or "1=1",
            "time_filter": time_filter or "1=1", 
            "limit": "10"  # 默认限制
        }
        
        return template.format(**sql_params).strip()
    
    async def _gpt_optimize_sql(self, base_sql: str, intent: QueryIntent, schema_info: Dict[str, Any]) -> str:
        """使用GPT-4优化SQL"""
        
        system_prompt = """你是一个专业的SQL优化专家。用户会提供一个基础的SQL查询和相关的查询意图，你需要：

1. 优化SQL语句的性能和可读性
2. 确保SQL语法正确
3. 根据查询意图调整SQL逻辑
4. 只返回优化后的SQL语句，不要包含任何解释

要求：
- 只使用SELECT语句
- 不能包含任何DDL或DML操作
- 保持SQL简洁高效
- 确保语法正确"""

        user_prompt = f"""请优化以下SQL查询：

基础SQL：
```sql
{base_sql}
```

查询意图：
- 类型：{intent.query_type.value}
- 实体：{intent.entities}
- 时间范围：{intent.time_range}
- 维度：{intent.dimensions}
- 指标：{intent.metrics}

数据库schema信息：
```json
{json.dumps(schema_info, ensure_ascii=False, indent=2)}
```

请返回优化后的SQL语句："""

        try:
            response = await self.client.chat.completions.create(
                model=config.openai_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.1,  # 使用更低的temperature确保稳定性
                max_tokens=800
            )
            
            content = response.choices[0].message.content.strip()
            
            # 提取SQL语句
            sql_match = re.search(r'```sql\n(.*?)\n```', content, re.DOTALL)
            if sql_match:
                optimized_sql = sql_match.group(1).strip()
            else:
                # 如果没有找到SQL代码块，使用整个内容
                optimized_sql = content
            
            # 验证SQL语法
            try:
                parsed = sqlparse.parse(optimized_sql)
                if not parsed:
                    raise ValueError("SQL解析失败")
            except Exception:
                logger.warning("GPT优化的SQL语法错误，回退到基础SQL")
                return base_sql
            
            return optimized_sql
            
        except Exception as e:
            logger.error(f"GPT SQL优化失败: {str(e)}")
            return base_sql
    
    def _check_sql_safety(self, sql: str) -> float:
        """检查SQL安全性"""
        sql_upper = sql.upper()
        
        # 检查危险关键词
        for keyword in self.dangerous_keywords:
            if keyword in sql_upper:
                return 0.0  # 包含危险操作
        
        # 检查是否只包含SELECT
        parsed = sqlparse.parse(sql)
        if not parsed:
            return 0.3
        
        first_statement = parsed[0]
        tokens = [token for token in first_statement.flatten() if not token.is_whitespace]
        
        if not tokens or tokens[0].ttype is not sqlparse.tokens.Keyword.DML or tokens[0].value.upper() != 'SELECT':
            return 0.2
        
        # 基础安全分数
        safety_score = 0.9
        
        # 检查潜在的注入风险
        if re.search(r"['\"];|--|/\*|\*/", sql):
            safety_score -= 0.3
        
        # 检查是否有过于复杂的查询
        if sql.count('SELECT') > 3:  # 嵌套查询过多
            safety_score -= 0.1
        
        return max(0.0, safety_score)
    
    def _estimate_query_cost(self, sql: str, schema_info: Dict[str, Any]) -> int:
        """预估查询成本"""
        base_cost = 1
        
        # 根据JOIN数量增加成本
        join_count = sql.upper().count('JOIN')
        base_cost += join_count * 2
        
        # 根据子查询数量增加成本
        subquery_count = sql.count('SELECT') - 1
        base_cost += subquery_count * 3
        
        # 根据函数复杂度增加成本
        function_patterns = ['GROUP BY', 'ORDER BY', 'DISTINCT', 'UNION']
        for pattern in function_patterns:
            if pattern in sql.upper():
                base_cost += 1
        
        return base_cost
    
    def _map_entities_to_columns(self, entities: List[str], available_columns: List[str]) -> List[str]:
        """将实体映射到数据库列"""
        mapped_columns = []
        
        for entity in entities:
            # 简单的字符串匹配
            entity_lower = entity.lower()
            for column in available_columns:
                if entity_lower in column.lower() or column.lower() in entity_lower:
                    mapped_columns.append(column)
                    break
        
        return mapped_columns
    
    def _build_where_conditions(self, filters: Dict[str, Any], available_columns: List[str]) -> str:
        """构建WHERE条件"""
        if not filters:
            return "1=1"
        
        conditions = []
        for key, value in filters.items():
            # 简单的条件构建
            if isinstance(value, str):
                conditions.append(f"{key} LIKE '%{value}%'")
            else:
                conditions.append(f"{key} = {value}")
        
        return " AND ".join(conditions)
    
    def _build_time_filter(self, time_range: Optional[str], available_columns: List[str]) -> str:
        """构建时间筛选条件"""
        if not time_range:
            return "1=1"
        
        # 寻找时间字段
        time_column = None
        for column in available_columns:
            if any(time_keyword in column.lower() for time_keyword in ['date', 'time', 'created', 'updated']):
                time_column = column
                break
        
        if not time_column:
            return "1=1"
        
        # 简单的时间范围映射
        time_filters = {
            "today": f"{time_column} >= CURRENT_DATE",
            "yesterday": f"{time_column} >= CURRENT_DATE - INTERVAL '1 day' AND {time_column} < CURRENT_DATE",
            "this week": f"{time_column} >= DATE_TRUNC('week', CURRENT_DATE)",
            "last week": f"{time_column} >= DATE_TRUNC('week', CURRENT_DATE - INTERVAL '1 week') AND {time_column} < DATE_TRUNC('week', CURRENT_DATE)",
            "this month": f"{time_column} >= DATE_TRUNC('month', CURRENT_DATE)",
            "last month": f"{time_column} >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month') AND {time_column} < DATE_TRUNC('month', CURRENT_DATE)"
        }
        
        return time_filters.get(time_range.lower(), "1=1")
    
    def _get_time_dimension(self, available_columns: List[str]) -> str:
        """获取时间维度字段"""
        for column in available_columns:
            if any(time_keyword in column.lower() for time_keyword in ['date', 'time', 'created']):
                return column
        return "created_at"  # 默认时间字段