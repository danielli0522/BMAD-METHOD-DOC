/**
 * 后端API集成测试
 * 测试后端与AI引擎的集成功能
 */

const axios = require('axios');

const BACKEND_URL = 'http://localhost:8000';
const AI_ENGINE_URL = 'http://localhost:8001';

class BackendIntegrationTest {
  constructor() {
    this.results = [];
  }

  async runAllTests() {
    console.log('🚀 开始后端API集成测试...\n');

    const tests = [
      { name: '后端健康检查', test: this.testBackendHealth.bind(this) },
      { name: 'AI引擎健康检查', test: this.testAIEngineHealth.bind(this) },
      { name: 'AI引擎状态检查', test: this.testAIEngineStatus.bind(this) },
      { name: '基础查询集成测试', test: this.testBasicQuery.bind(this) },
      { name: '查询历史获取测试', test: this.testQueryHistory.bind(this) },
      { name: '错误处理测试', test: this.testErrorHandling.bind(this) }
    ];

    for (const { name, test } of tests) {
      try {
        console.log(`📋 执行测试: ${name}`);
        const result = await test();
        this.results.push({ name, status: 'PASSED', result });
        console.log(`✅ ${name} - 通过\n`);
      } catch (error) {
        this.results.push({ name, status: 'FAILED', error: error.message });
        console.log(`❌ ${name} - 失败: ${error.message}\n`);
      }
    }

    this.printSummary();
  }

  async testBackendHealth() {
    const response = await axios.get(`${BACKEND_URL}/health`);
    
    if (response.status !== 200) {
      throw new Error(`健康检查失败，状态码: ${response.status}`);
    }

    return {
      status: response.data.status,
      timestamp: response.data.timestamp
    };
  }

  async testAIEngineHealth() {
    try {
      const response = await axios.get(`${AI_ENGINE_URL}/health`);
      
      if (response.status !== 200) {
        throw new Error(`AI引擎健康检查失败，状态码: ${response.status}`);
      }

      return {
        status: response.data.status,
        service: response.data.service
      };
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error('AI引擎服务未启动或不可访问');
      }
      throw error;
    }
  }

  async testAIEngineStatus() {
    const response = await axios.get(`${BACKEND_URL}/api/queries/ai-engine/status`);
    
    if (response.status !== 200) {
      throw new Error(`状态检查失败，状态码: ${response.status}`);
    }

    const data = response.data.data;
    return {
      healthCheck: data.health.success,
      clientStatus: data.client
    };
  }

  async testBasicQuery() {
    const testQuery = {
      naturalQuery: '显示过去3个月各部门的销售业绩对比',
      database: 'default'
    };

    const startTime = Date.now();
    const response = await axios.post(`${BACKEND_URL}/api/queries`, testQuery);
    const responseTime = Date.now() - startTime;

    if (response.status !== 201) {
      throw new Error(`查询创建失败，状态码: ${response.status}`);
    }

    const data = response.data;
    
    if (!data.success) {
      throw new Error('查询处理失败');
    }

    const query = data.data.query;
    const aiResponse = data.data.aiEngineResponse;

    return {
      queryId: query.id,
      queryType: query.queryType,
      sqlQuery: query.sqlQuery,
      confidence: query.result.confidence,
      responseTime,
      hasAIResponse: !!aiResponse,
      hasChartConfig: !!query.chartConfig
    };
  }

  async testQueryHistory() {
    const response = await axios.get(`${BACKEND_URL}/api/queries?limit=5`);
    
    if (response.status !== 200) {
      throw new Error(`获取查询历史失败，状态码: ${response.status}`);
    }

    const data = response.data;
    
    if (!data.success) {
      throw new Error('获取查询历史失败');
    }

    return {
      totalQueries: data.data.queries.length,
      pagination: data.data.pagination
    };
  }

  async testErrorHandling() {
    // 测试空查询
    try {
      const response = await axios.post(`${BACKEND_URL}/api/queries`, {
        naturalQuery: '',
        database: 'default'
      });
      
      // 如果没有抛出错误，说明错误处理有问题
      throw new Error('空查询应该返回错误');
    } catch (error) {
      if (error.response && error.response.status === 400) {
        return {
          emptyQueryHandled: true,
          errorMessage: error.response.data.message
        };
      }
      throw error;
    }
  }

  printSummary() {
    const passed = this.results.filter(r => r.status === 'PASSED').length;
    const failed = this.results.filter(r => r.status === 'FAILED').length;
    const total = this.results.length;

    console.log('📊 测试结果总结:');
    console.log(`总测试数: ${total}`);
    console.log(`通过: ${passed}`);
    console.log(`失败: ${failed}`);
    console.log(`成功率: ${((passed / total) * 100).toFixed(1)}%\n`);

    if (failed === 0) {
      console.log('🎉 所有测试通过！后端API集成成功！');
    } else {
      console.log('⚠️ 发现问题，需要修复:');
      this.results
        .filter(r => r.status === 'FAILED')
        .forEach(r => console.log(`  - ${r.name}: ${r.error}`));
    }
  }
}

// 运行测试
async function main() {
  const tester = new BackendIntegrationTest();
  await tester.runAllTests();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = BackendIntegrationTest;