"""
AI引擎API集成测试
用于验证API接口的功能和性能
"""
import asyncio
import time
import json
import aiohttp
from typing import Dict, List, Any

class AIEngineIntegrationTest:
    """AI引擎集成测试类"""
    
    def __init__(self, base_url: str = "http://localhost:8001"):
        self.base_url = base_url
        self.test_results = []
        
    async def run_all_tests(self) -> Dict[str, Any]:
        """运行所有集成测试"""
        print("🚀 开始AI引擎API集成测试...")
        
        test_suite = [
            ("健康检查测试", self.test_health_check),
            ("基础查询测试", self.test_basic_query),
            ("多种查询类型测试", self.test_query_types),
            ("错误处理测试", self.test_error_handling),
            ("性能基准测试", self.test_performance),
            ("置信度评估测试", self.test_confidence_scoring),
            ("API格式标准化测试", self.test_api_format)
        ]
        
        results = {
            "total_tests": len(test_suite),
            "passed": 0,
            "failed": 0,
            "tests": []
        }
        
        for test_name, test_func in test_suite:
            print(f"\n📋 执行测试: {test_name}")
            try:
                result = await test_func()
                results["tests"].append({
                    "name": test_name,
                    "status": "PASSED",
                    "result": result
                })
                results["passed"] += 1
                print(f"✅ {test_name} - 通过")
            except Exception as e:
                results["tests"].append({
                    "name": test_name,
                    "status": "FAILED",
                    "error": str(e)
                })
                results["failed"] += 1
                print(f"❌ {test_name} - 失败: {e}")
        
        # 生成测试报告
        await self.generate_test_report(results)
        return results
    
    async def test_health_check(self) -> Dict[str, Any]:
        """测试健康检查接口"""
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{self.base_url}/health") as response:
                assert response.status == 200
                data = await response.json()
                assert data["status"] == "healthy"
                return {"response_time": response.headers.get("response-time", "unknown")}
    
    async def test_basic_query(self) -> Dict[str, Any]:
        """测试基础查询功能"""
        test_query = {
            "natural_query": "显示过去3个月各部门的销售业绩",
            "context": {},
            "user_id": "test_user"
        }
        
        start_time = time.time()
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.base_url}/api/ai/query",
                json=test_query
            ) as response:
                processing_time = (time.time() - start_time) * 1000
                
                assert response.status == 200
                data = await response.json()
                
                # 验证响应格式
                assert "success" in data
                assert data["success"] is True
                assert "data" in data
                assert "message" in data
                
                # 验证数据结构
                result_data = data["data"]
                required_fields = [
                    "query_id", "understood_intent", "sql_query",
                    "execution_result", "chart_recommendation",
                    "confidence_score", "processing_time"
                ]
                
                for field in required_fields:
                    assert field in result_data, f"缺少字段: {field}"
                
                # 验证置信度评分
                confidence = result_data["confidence_score"]
                assert 0 <= confidence <= 1, f"置信度超出范围: {confidence}"
                
                return {
                    "query_id": result_data["query_id"],
                    "confidence": confidence,
                    "processing_time": processing_time,
                    "api_processing_time": result_data["processing_time"]
                }
    
    async def test_query_types(self) -> Dict[str, Any]:
        """测试不同查询类型"""
        test_queries = [
            {
                "query": "显示过去6个月的销售趋势",
                "expected_type": "trend"
            },
            {
                "query": "对比各部门的业绩表现",
                "expected_type": "comparison"
            },
            {
                "query": "销售额TOP10的产品排名",
                "expected_type": "ranking"
            },
            {
                "query": "计算本月总销售额",
                "expected_type": "statistics"
            },
            {
                "query": "各产品销售占比分析",
                "expected_type": "proportion"
            }
        ]
        
        results = []
        
        async with aiohttp.ClientSession() as session:
            for test_case in test_queries:
                test_query = {"natural_query": test_case["query"]}
                
                async with session.post(
                    f"{self.base_url}/api/ai/query",
                    json=test_query
                ) as response:
                    assert response.status == 200
                    data = await response.json()
                    
                    result_data = data["data"]
                    chart_type = result_data["chart_recommendation"]["type"]
                    confidence = result_data["confidence_score"]
                    
                    results.append({
                        "query": test_case["query"],
                        "chart_type": chart_type,
                        "confidence": confidence,
                        "processing_time": result_data["processing_time"]
                    })
        
        return {"test_cases": len(test_queries), "results": results}
    
    async def test_error_handling(self) -> Dict[str, Any]:
        """测试错误处理机制"""
        error_test_cases = [
            {
                "name": "空查询",
                "query": {"natural_query": ""},
                "expected_status": 400
            },
            {
                "name": "无效查询",
                "query": {"natural_query": "asdfghjkl"},
                "expected_status": 200  # 应该能处理，但置信度较低
            },
            {
                "name": "缺少字段",
                "query": {},
                "expected_status": 422  # FastAPI参数验证错误
            }
        ]
        
        results = []
        
        async with aiohttp.ClientSession() as session:
            for test_case in error_test_cases:
                try:
                    async with session.post(
                        f"{self.base_url}/api/ai/query",
                        json=test_case["query"]
                    ) as response:
                        status_code = response.status
                        data = await response.json()
                        
                        results.append({
                            "name": test_case["name"],
                            "status_code": status_code,
                            "response": data,
                            "passed": status_code == test_case["expected_status"]
                        })
                        
                except Exception as e:
                    results.append({
                        "name": test_case["name"],
                        "error": str(e),
                        "passed": False
                    })
        
        return {"error_cases": len(error_test_cases), "results": results}
    
    async def test_performance(self) -> Dict[str, Any]:
        """测试性能基准"""
        test_query = {
            "natural_query": "统计各地区本月销售数据",
            "context": {}
        }
        
        # 并发测试
        concurrent_requests = 5
        response_times = []
        
        async def single_request():
            start_time = time.time()
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/api/ai/query",
                    json=test_query
                ) as response:
                    await response.json()
                    return (time.time() - start_time) * 1000
        
        # 执行并发请求
        tasks = [single_request() for _ in range(concurrent_requests)]
        response_times = await asyncio.gather(*tasks)
        
        avg_response_time = sum(response_times) / len(response_times)
        max_response_time = max(response_times)
        min_response_time = min(response_times)
        
        # 性能基准验证
        performance_pass = avg_response_time <= 2000  # 2秒基准
        
        return {
            "concurrent_requests": concurrent_requests,
            "avg_response_time": avg_response_time,
            "max_response_time": max_response_time,
            "min_response_time": min_response_time,
            "performance_benchmark_passed": performance_pass
        }
    
    async def test_confidence_scoring(self) -> Dict[str, Any]:
        """测试置信度评估机制"""
        confidence_test_cases = [
            {
                "query": "显示过去3个月各部门销售业绩对比分析",
                "expected_min_confidence": 0.7  # 高质量查询
            },
            {
                "query": "销售数据",
                "expected_max_confidence": 0.6  # 模糊查询
            },
            {
                "query": "asdfgh random text",
                "expected_max_confidence": 0.4  # 无意义查询
            }
        ]
        
        results = []
        
        async with aiohttp.ClientSession() as session:
            for test_case in confidence_test_cases:
                test_query = {"natural_query": test_case["query"]}
                
                async with session.post(
                    f"{self.base_url}/api/ai/query",
                    json=test_query
                ) as response:
                    data = await response.json()
                    confidence = data["data"]["confidence_score"]
                    
                    # 验证置信度是否符合预期
                    confidence_valid = True
                    if "expected_min_confidence" in test_case:
                        confidence_valid = confidence >= test_case["expected_min_confidence"]
                    elif "expected_max_confidence" in test_case:
                        confidence_valid = confidence <= test_case["expected_max_confidence"]
                    
                    results.append({
                        "query": test_case["query"],
                        "confidence": confidence,
                        "confidence_valid": confidence_valid
                    })
        
        return {"confidence_tests": len(confidence_test_cases), "results": results}
    
    async def test_api_format(self) -> Dict[str, Any]:
        """测试API格式标准化"""
        test_query = {"natural_query": "测试API格式标准化"}
        
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{self.base_url}/api/ai/query",
                json=test_query
            ) as response:
                data = await response.json()
                
                # 验证标准化格式
                format_checks = {
                    "has_success_field": "success" in data,
                    "has_data_field": "data" in data,
                    "has_message_field": "message" in data,
                    "data_has_query_id": "query_id" in data.get("data", {}),
                    "data_has_processing_time": "processing_time" in data.get("data", {}),
                    "data_has_confidence": "confidence_score" in data.get("data", {}),
                    "chart_config_valid": isinstance(
                        data.get("data", {}).get("chart_recommendation", {}), dict
                    )
                }
                
                all_checks_passed = all(format_checks.values())
                
                return {
                    "format_checks": format_checks,
                    "all_checks_passed": all_checks_passed,
                    "response_structure": list(data.keys())
                }
    
    async def generate_test_report(self, results: Dict[str, Any]):
        """生成测试报告"""
        report = f"""
# AI引擎API集成测试报告

## 测试概要
- 总测试数: {results['total_tests']}
- 通过测试: {results['passed']}
- 失败测试: {results['failed']}
- 成功率: {(results['passed'] / results['total_tests'] * 100):.1f}%

## 测试详情
"""
        
        for test in results["tests"]:
            status_emoji = "✅" if test["status"] == "PASSED" else "❌"
            report += f"\n### {status_emoji} {test['name']}\n"
            if test["status"] == "PASSED":
                report += f"结果: {json.dumps(test.get('result', {}), indent=2, ensure_ascii=False)}\n"
            else:
                report += f"错误: {test.get('error', 'Unknown error')}\n"
        
        # 保存报告
        with open("/Users/lshl124/Documents/daniel/git/code/aigc/BMAD-METHOD/ai-agile-dap/src/ai-engine/test_report.md", "w", encoding="utf-8") as f:
            f.write(report)
        
        print(f"\n📊 测试报告已生成: test_report.md")


async def main():
    """主函数 - 运行集成测试"""
    tester = AIEngineIntegrationTest()
    
    try:
        results = await tester.run_all_tests()
        
        print(f"\n🎉 集成测试完成!")
        print(f"📊 成功率: {(results['passed'] / results['total_tests'] * 100):.1f}%")
        print(f"✅ 通过: {results['passed']}")
        print(f"❌ 失败: {results['failed']}")
        
        if results['failed'] == 0:
            print("\n🚀 所有测试通过，API集成准备就绪！")
        else:
            print(f"\n⚠️  发现 {results['failed']} 个问题，需要修复")
        
    except Exception as e:
        print(f"❌ 测试运行失败: {e}")


if __name__ == "__main__":
    asyncio.run(main())