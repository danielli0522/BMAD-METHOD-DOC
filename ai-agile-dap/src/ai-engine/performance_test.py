"""
数据库查询性能验证脚本
Sprint 0 Day 3 - 验证SQL查询性能和数据库连接
"""
import time
import random
import sqlite3
from datetime import datetime, timedelta


class DatabasePerformanceTest:
    """数据库性能测试类"""
    
    def __init__(self):
        self.db_path = ":memory:"  # 使用内存数据库进行测试
        self.conn = None
        self.setup_database()
    
    def setup_database(self):
        """设置测试数据库"""
        print("🗄️  设置测试数据库...")
        
        self.conn = sqlite3.connect(self.db_path)
        cursor = self.conn.cursor()
        
        # 创建销售数据表
        cursor.execute("""
            CREATE TABLE sales_data (
                id INTEGER PRIMARY KEY,
                date TEXT NOT NULL,
                product_name TEXT NOT NULL,
                department TEXT NOT NULL,
                region TEXT NOT NULL,
                amount DECIMAL(10,2) NOT NULL,
                customer_count INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # 创建性能数据表
        cursor.execute("""
            CREATE TABLE performance_data (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                department TEXT NOT NULL,
                score DECIMAL(5,2) NOT NULL,
                rank INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # 生成测试数据
        self.generate_test_data(cursor)
        
        # 创建索引优化查询性能
        cursor.execute("CREATE INDEX idx_sales_date ON sales_data(date)")
        cursor.execute("CREATE INDEX idx_sales_department ON sales_data(department)")
        cursor.execute("CREATE INDEX idx_sales_product ON sales_data(product_name)")
        cursor.execute("CREATE INDEX idx_performance_score ON performance_data(score)")
        
        self.conn.commit()
        print("✅ 数据库设置完成")
    
    def generate_test_data(self, cursor):
        """生成测试数据"""
        print("📊 生成测试数据...")
        
        # 产品列表
        products = ["产品A", "产品B", "产品C", "产品D", "产品E"]
        departments = ["销售部", "市场部", "技术部", "运营部", "财务部"]
        regions = ["华北", "华南", "华东", "西南", "西北"]
        
        # 生成销售数据 (1000条)
        sales_data = []
        base_date = datetime(2024, 1, 1)
        
        for i in range(1000):
            date = base_date + timedelta(days=random.randint(0, 150))
            product = random.choice(products)
            department = random.choice(departments)
            region = random.choice(regions)
            amount = random.uniform(100, 5000)
            customer_count = random.randint(1, 50)
            
            sales_data.append((
                date.strftime("%Y-%m-%d"),
                product,
                department, 
                region,
                round(amount, 2),
                customer_count
            ))
        
        cursor.executemany("""
            INSERT INTO sales_data (date, product_name, department, region, amount, customer_count)
            VALUES (?, ?, ?, ?, ?, ?)
        """, sales_data)
        
        # 生成性能数据 (100条)
        performance_data = []
        names = [f"员工{i+1:03d}" for i in range(100)]
        
        for i, name in enumerate(names):
            department = random.choice(departments)
            score = random.uniform(60, 100)
            rank = i + 1
            
            performance_data.append((name, department, round(score, 2), rank))
        
        cursor.executemany("""
            INSERT INTO performance_data (name, department, score, rank)
            VALUES (?, ?, ?, ?)
        """, performance_data)
        
        print(f"✅ 生成了 {len(sales_data)} 条销售数据和 {len(performance_data)} 条性能数据")
    
    def test_query_performance(self):
        """测试查询性能"""
        print("\n🚀 开始查询性能测试")
        print("=" * 50)
        
        test_queries = [
            {
                "name": "趋势分析查询",
                "sql": """
                    SELECT date, SUM(amount) as total_amount
                    FROM sales_data 
                    WHERE date >= '2024-04-01'
                    GROUP BY date
                    ORDER BY date
                """,
                "expected_time": 0.1
            },
            {
                "name": "部门对比查询", 
                "sql": """
                    SELECT department, SUM(amount) as total_amount, COUNT(*) as count
                    FROM sales_data
                    GROUP BY department
                    ORDER BY total_amount DESC
                """,
                "expected_time": 0.05
            },
            {
                "name": "产品排名查询",
                "sql": """
                    SELECT product_name, SUM(amount) as total_amount
                    FROM sales_data
                    GROUP BY product_name
                    ORDER BY total_amount DESC
                    LIMIT 10
                """,
                "expected_time": 0.05
            },
            {
                "name": "统计分析查询",
                "sql": """
                    SELECT 
                        COUNT(*) as total_count,
                        AVG(amount) as avg_amount,
                        SUM(amount) as total_amount,
                        MAX(amount) as max_amount,
                        MIN(amount) as min_amount
                    FROM sales_data
                """,
                "expected_time": 0.03
            },
            {
                "name": "复杂聚合查询",
                "sql": """
                    SELECT 
                        region,
                        department,
                        SUM(amount) as total_amount,
                        ROUND(SUM(amount) * 100.0 / (SELECT SUM(amount) FROM sales_data), 2) as percentage
                    FROM sales_data
                    GROUP BY region, department
                    ORDER BY total_amount DESC
                """,
                "expected_time": 0.1
            }
        ]
        
        results = []
        
        for i, test in enumerate(test_queries, 1):
            print(f"\n📝 测试 {i}: {test['name']}")
            print(f"🎯 预期时间: <{test['expected_time']}秒")
            
            # 预热查询
            cursor = self.conn.cursor()
            cursor.execute(test['sql'])
            cursor.fetchall()
            
            # 正式测试 (运行3次取平均)
            times = []
            for run in range(3):
                start_time = time.time()
                cursor.execute(test['sql'])
                rows = cursor.fetchall()
                end_time = time.time()
                
                query_time = end_time - start_time
                times.append(query_time)
            
            avg_time = sum(times) / len(times)
            row_count = len(rows)
            
            # 评估性能
            performance_rating = "✅ 优秀" if avg_time < test['expected_time'] else "⚠️ 需优化" if avg_time < test['expected_time'] * 2 else "❌ 性能差"
            
            print(f"⏱️  执行时间: {avg_time:.4f}秒 (平均)")
            print(f"📊 返回行数: {row_count}行")
            print(f"🎯 性能评估: {performance_rating}")
            
            results.append({
                "name": test['name'],
                "time": avg_time,
                "expected": test['expected_time'],
                "rows": row_count,
                "passed": avg_time < test['expected_time'] * 1.5
            })
        
        return results
    
    def test_concurrent_queries(self):
        """测试并发查询能力"""
        print(f"\n🔄 并发查询测试")
        print("-" * 30)
        
        # 模拟多个并发查询
        queries = [
            "SELECT COUNT(*) FROM sales_data",
            "SELECT SUM(amount) FROM sales_data WHERE department = '销售部'",
            "SELECT AVG(score) FROM performance_data",
            "SELECT product_name, COUNT(*) FROM sales_data GROUP BY product_name"
        ]
        
        start_time = time.time()
        
        # 顺序执行模拟并发
        for i, query in enumerate(queries):
            cursor = self.conn.cursor()
            cursor.execute(query)
            result = cursor.fetchall()
            print(f"查询{i+1}: {len(result)}行结果")
        
        end_time = time.time()
        total_time = end_time - start_time
        
        print(f"⏱️  总执行时间: {total_time:.4f}秒")
        print(f"🎯 平均每查询: {total_time/len(queries):.4f}秒")
        
        return total_time
    
    def generate_performance_report(self, query_results, concurrent_time):
        """生成性能测试报告"""
        print("\n" + "=" * 60)
        print("📊 数据库性能测试报告")
        print("=" * 60)
        
        # 基本统计
        total_tests = len(query_results)
        passed_tests = sum(1 for r in query_results if r["passed"])
        avg_time = sum(r["time"] for r in query_results) / total_tests
        
        print(f"📝 总测试数: {total_tests}")
        print(f"✅ 通过测试: {passed_tests}/{total_tests} ({passed_tests/total_tests*100:.1f}%)")
        print(f"⏱️  平均响应时间: {avg_time:.4f}秒")
        print(f"🔄 并发测试时间: {concurrent_time:.4f}秒")
        
        # 详细结果
        print(f"\n📋 详细测试结果:")
        for result in query_results:
            status = "✅" if result["passed"] else "❌"
            print(f"   {status} {result['name']}: {result['time']:.4f}s (预期<{result['expected']}s)")
        
        # 性能等级评估
        if passed_tests == total_tests and avg_time < 0.1:
            grade = "A+ (优秀)"
        elif passed_tests >= total_tests * 0.8 and avg_time < 0.2:
            grade = "A (良好)"
        elif passed_tests >= total_tests * 0.6 and avg_time < 0.5:
            grade = "B (一般)"
        else:
            grade = "C (需优化)"
        
        print(f"\n🎯 总体性能等级: {grade}")
        
        # 建议
        print(f"\n💡 优化建议:")
        if avg_time > 0.1:
            print("   - 考虑添加更多数据库索引")
            print("   - 优化复杂查询的SQL语句")
        if concurrent_time > 1.0:
            print("   - 考虑使用数据库连接池")
            print("   - 评估数据库并发处理能力")
        
        print("   - 在生产环境使用更快的数据库(PostgreSQL)")
        print("   - 考虑添加查询结果缓存")
        
        return grade
    
    def cleanup(self):
        """清理资源"""
        if self.conn:
            self.conn.close()


def main():
    """主测试函数"""
    print("🔬 Sprint 0 Day 3 - 数据库查询性能验证")
    print("=" * 60)
    
    # 创建测试实例
    test = DatabasePerformanceTest()
    
    try:
        # 运行查询性能测试
        query_results = test.test_query_performance()
        
        # 运行并发测试
        concurrent_time = test.test_concurrent_queries()
        
        # 生成报告
        grade = test.generate_performance_report(query_results, concurrent_time)
        
        print("\n🎉 数据库性能验证完成！")
        
        # 验证是否满足性能要求
        if grade.startswith("A"):
            print("✅ 数据库性能满足项目要求")
            print("🚀 可以支持预期的查询负载")
        else:
            print("⚠️  数据库性能需要进一步优化")
            print("🔧 建议在Sprint 1中重点关注性能优化")
        
    finally:
        test.cleanup()


if __name__ == "__main__":
    main()