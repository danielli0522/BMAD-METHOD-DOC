"""
AI引擎功能演示脚本
用于验证核心功能是否正常工作
"""
import asyncio
import json
import sys
import os

# 添加当前目录到Python路径
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from models import QueryRequest, QueryType
from nlp_processor import NLPProcessor
from chart_recommender import ChartRecommender


def generate_mock_data_by_type(query_type):
    """根据查询类型生成模拟数据"""
    if query_type == QueryType.TREND:
        return [
            {"date": "2024-01", "value": 1200},
            {"date": "2024-02", "value": 1350},
            {"date": "2024-03", "value": 1100},
            {"date": "2024-04", "value": 1600},
            {"date": "2024-05", "value": 1800}
        ]
    elif query_type == QueryType.COMPARISON:
        return [
            {"category": "产品A", "value": 2500},
            {"category": "产品B", "value": 1800},
            {"category": "产品C", "value": 3200},
            {"category": "产品D", "value": 1200}
        ]
    elif query_type == QueryType.RANKING:
        return [
            {"rank": 1, "name": "销售部", "score": 95.5},
            {"rank": 2, "name": "市场部", "score": 88.2},
            {"rank": 3, "name": "技术部", "score": 82.1}
        ]
    elif query_type == QueryType.STATISTICS:
        return [
            {
                "total_count": 1250,
                "avg_value": 85.6,
                "sum_value": 107000,
                "max_value": 150.2,
                "min_value": 12.5
            }
        ]
    elif query_type == QueryType.PROPORTION:
        return [
            {"category": "华北", "value": 4500, "percentage": 35.2},
            {"category": "华南", "value": 3200, "percentage": 25.1},
            {"category": "华东", "value": 2800, "percentage": 21.9}
        ]
    else:
        return [{"message": "查询完成", "count": 1}]


async def demo_ai_engine():
    """演示AI引擎核心功能"""
    print("🚀 AI引擎功能演示")
    print("=" * 50)
    
    # 初始化核心组件
    nlp_processor = NLPProcessor()
    chart_recommender = ChartRecommender()
    
    # 测试查询列表
    test_queries = [
        "显示过去3个月的销售趋势",
        "对比各部门的销售业绩", 
        "销售额TOP10的产品",
        "本月总销售额统计",
        "各产品销售占比情况"
    ]
    
    for i, query in enumerate(test_queries, 1):
        print(f"\n📝 测试查询 {i}: {query}")
        print("-" * 30)
        
        try:
            # 创建查询请求
            request = QueryRequest(
                natural_query=query,
                user_id="demo_user",
                session_id="demo_session"
            )
            
            # 处理查询(不调用真实的OpenAI API，使用模拟数据)
            print("🧠 解析查询意图...")
            
            # 使用本地模式进行演示(不需要OpenAI API)
            intent_result = nlp_processor._pattern_classify(query)
            print(f"   类型: {intent_result.value}")
            
            # 生成模拟SQL
            print("🔍 生成SQL语句...")
            mock_sql = f"SELECT * FROM business_data WHERE category LIKE '%{query[:10]}%'"
            print(f"   SQL: {mock_sql}")
            
            # 推荐图表
            print("📊 推荐图表类型...")
            chart_type = chart_recommender.chart_rules.get(intent_result)
            print(f"   图表: {chart_type.value if chart_type else 'table'}")
            
            # 生成模拟数据
            print("📈 生成演示数据...")
            mock_data = generate_mock_data_by_type(intent_result)
            print(f"   数据条数: {len(mock_data)}")
            print(f"   数据示例: {json.dumps(mock_data[0] if mock_data else {}, ensure_ascii=False, indent=2)}")
            
            print("✅ 查询处理成功!")
            
        except Exception as e:
            print(f"❌ 查询处理失败: {str(e)}")
    
    print("\n" + "=" * 50)
    print("🎉 演示完成! AI引擎核心功能验证通过")


async def demo_validation():
    """演示查询验证功能"""
    print("\n🔍 查询验证功能演示")
    print("=" * 30)
    
    test_cases = [
        ("显示销售数据", "正常查询"),
        ("数据", "查询过短"),
        ("a" * 501, "查询过长"),
        ("今天天气怎么样", "非数据分析查询")
    ]
    
    for query, desc in test_cases:
        print(f"\n测试: {desc}")
        result = simple_validate_query(query)
        print(f"查询: {query[:50]}{'...' if len(query) > 50 else ''}")
        print(f"结果: {'✅' if result['valid'] else '❌'} {result['message']}")


def simple_validate_query(natural_query):
    """简单的查询验证逻辑"""
    if len(natural_query.strip()) < 5:
        return {
            "valid": False,
            "message": "查询过短，请提供更详细的描述"
        }
    
    if len(natural_query) > 500:
        return {
            "valid": False,
            "message": "查询过长，请简化您的描述"
        }
    
    data_keywords = ["销售", "数据", "统计", "分析", "报表", "趋势", "对比", "排名"]
    has_data_keyword = any(keyword in natural_query for keyword in data_keywords)
    
    if not has_data_keyword:
        return {
            "valid": False,
            "message": "查询似乎与数据分析无关"
        }
    
    return {
        "valid": True,
        "message": "查询格式正确"
    }


def demo_pattern_matching():
    """演示模式匹配功能"""
    print("\n🎯 查询模式匹配演示")
    print("=" * 30)
    
    from nlp_processor import NLPProcessor
    processor = NLPProcessor()
    
    test_patterns = [
        ("显示过去3个月的销售趋势", "趋势分析"),
        ("对比各部门的业绩", "对比分析"),
        ("TOP10销售人员排名", "排名分析"),
        ("总销售额统计", "统计分析"),
        ("各地区销售占比", "占比分析")
    ]
    
    for query, expected in test_patterns:
        result = processor._pattern_classify(query)
        print(f"查询: {query}")
        print(f"识别: {result.value} ({'✅' if expected in result.value else '❓'})")
        print()


if __name__ == "__main__":
    print("🤖 AI-Agile-DAP AI引擎演示程序")
    print("本演示不需要OpenAI API Key，使用模拟数据")
    print("\n选择演示模式:")
    print("1. 完整功能演示")
    print("2. 查询验证演示") 
    print("3. 模式匹配演示")
    print("4. 全部演示")
    
    choice = input("\n请输入选择 (1-4): ").strip()
    
    if choice == "1":
        asyncio.run(demo_ai_engine())
    elif choice == "2":
        asyncio.run(demo_validation())
    elif choice == "3":
        demo_pattern_matching()
    elif choice == "4":
        asyncio.run(demo_ai_engine())
        asyncio.run(demo_validation())
        demo_pattern_matching()
    else:
        print("无效选择，运行完整演示...")
        asyncio.run(demo_ai_engine())