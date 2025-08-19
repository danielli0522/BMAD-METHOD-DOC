# AI引擎核心模块

AI-Agile-DAP的自然语言到SQL转换核心引擎，实现智能查询解析、SQL生成和图表推荐功能。

## ✨ 核心功能

### 🧠 自然语言理解
- 支持中文自然语言查询
- 智能查询意图识别（趋势、对比、排名、统计、占比）
- 实体识别和时间范围解析
- 置信度评估机制

### 🔍 SQL生成引擎
- 基于意图的智能SQL生成
- SQL安全检查和注入防护
- 查询成本预估
- 模板化SQL构建

### 📊 图表推荐
- 基于查询类型的智能图表推荐
- 数据特征分析优化
- 支持5种主要图表类型（折线图、柱状图、饼图、数值卡片、表格）

### 🔒 安全特性
- SQL注入防护
- 危险操作检测
- 查询复杂度限制
- 安全评分机制

## 🚀 快速开始

### 环境要求
- Python 3.9+
- OpenAI API Key

### 安装依赖
```bash
pip install -r requirements.txt
```

### 环境配置
```bash
# 复制环境变量示例文件
cp .env.example .env

# 编辑环境变量文件，设置你的OpenAI API Key
vim .env
```

### 启动服务
```bash
# 方式1: 直接启动
uvicorn api:app --host 0.0.0.0 --port 8001 --reload

# 方式2: 使用启动脚本
chmod +x ../../scripts/start-ai-engine.sh
../../scripts/start-ai-engine.sh

# 方式3: Docker启动
docker build -t ai-agile-dap-ai-engine .
docker run -p 8001:8001 --env-file .env ai-agile-dap-ai-engine
```

### 访问服务
- 服务地址: http://localhost:8001
- API文档: http://localhost:8001/docs
- 健康检查: http://localhost:8001/health

## 📚 API使用示例

### 处理自然语言查询
```bash
curl -X POST "http://localhost:8001/api/v1/query" \
  -H "Content-Type: application/json" \
  -d '{
    "natural_query": "显示过去3个月的销售趋势",
    "user_id": "user123",
    "session_id": "session456"
  }'
```

### 验证查询有效性
```bash
curl -X POST "http://localhost:8001/api/v1/validate" \
  -H "Content-Type: application/json" \
  -d '{
    "natural_query": "销售数据统计"
  }'
```

### 获取支持的查询类型
```bash
curl -X GET "http://localhost:8001/api/v1/supported-queries"
```

## 🧪 运行测试

```bash
# 安装测试依赖
pip install pytest pytest-asyncio

# 运行所有测试
pytest tests/test_ai_engine.py -v

# 运行特定测试类
pytest tests/test_ai_engine.py::TestNLPProcessor -v

# 生成覆盖率报告
pytest tests/test_ai_engine.py --cov=src.ai_engine --cov-report=html
```

## 🏗️ 架构设计

```
ai-engine/
├── models.py           # 数据模型定义
├── config.py           # 配置管理
├── nlp_processor.py    # 自然语言处理
├── sql_generator.py    # SQL生成引擎
├── chart_recommender.py # 图表推荐器
├── ai_engine.py        # 主控制器
├── api.py             # FastAPI服务
└── README.md          # 文档
```

### 核心组件

1. **NLPProcessor**: 自然语言理解和意图解析
2. **SQLGenerator**: SQL语句生成和优化
3. **ChartRecommender**: 智能图表类型推荐
4. **AIEngine**: 主控制器，整合所有功能

### 数据流

```
自然语言查询 → 意图解析 → SQL生成 → 图表推荐 → 结果返回
```

## ⚙️ 配置说明

### 环境变量

| 变量名 | 描述 | 默认值 | 必需 |
|--------|------|--------|------|
| `OPENAI_API_KEY` | OpenAI API密钥 | - | ✅ |
| `OPENAI_MODEL` | 使用的模型 | gpt-4 | ❌ |
| `OPENAI_TEMPERATURE` | 生成温度 | 0.1 | ❌ |
| `MAX_QUERY_LENGTH` | 最大查询长度 | 500 | ❌ |
| `LOG_LEVEL` | 日志级别 | INFO | ❌ |

## 🎯 性能指标

### 目标指标
- **准确率**: ≥85% (查询意图识别)
- **响应时间**: ≤2秒 (端到端处理)
- **安全评分**: ≥0.9 (SQL安全检查)
- **可用性**: ≥99% (服务稳定性)

### 监控指标
- 查询处理时间
- 意图识别准确率
- SQL生成成功率
- 安全检查通过率

## 🐛 故障排除

### 常见问题

1. **OpenAI API调用失败**
   - 检查API Key是否正确设置
   - 确认账户余额充足
   - 检查网络连接

2. **SQL生成错误**
   - 检查数据库schema配置
   - 确认查询复杂度在限制范围内

3. **服务启动失败**
   - 检查Python版本(需要3.9+)
   - 确认依赖已正确安装
   - 检查端口8001是否被占用

## 🔄 开发指南

### 添加新的查询类型
1. 在`models.py`中扩展`QueryType`枚举
2. 在`nlp_processor.py`中添加模式匹配规则
3. 在`sql_generator.py`中添加SQL模板
4. 在`chart_recommender.py`中添加图表推荐规则

### 扩展图表类型
1. 在`models.py`中扩展`ChartType`枚举
2. 在`chart_recommender.py`中添加推荐逻辑

## 📈 TODO和改进计划

- [ ] 支持更多数据库类型
- [ ] 添加查询结果缓存
- [ ] 实现查询历史管理
- [ ] 支持多语言查询
- [ ] 添加更多图表类型
- [ ] 性能优化和并发处理

## 📝 更新日志

### v0.1.0 (2024-08-18)
- ✨ 初始版本发布
- ✅ 基础自然语言处理功能
- ✅ SQL生成引擎
- ✅ 图表推荐功能
- ✅ FastAPI服务接口
- ✅ 单元测试覆盖

---

**开发团队**: ai-agile-dap team  
**技术栈**: Python 3.9+ | FastAPI | OpenAI GPT-4 | pytest  
**许可证**: MIT