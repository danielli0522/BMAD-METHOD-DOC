# 数据同步管理功能

## 概述

数据同步管理功能是AI-Agile-DAP平台的核心组件，提供完整的数据同步解决方案，支持多种同步模式、任务调度、实时监控和失败处理机制。

## 功能特性

### 🚀 核心功能

- **多种同步模式**: 全量同步、增量同步、实时同步
- **任务调度**: 基于Cron表达式的灵活调度
- **实时监控**: 实时状态监控和性能指标收集
- **失败处理**: 智能重试机制和错误恢复
- **数据一致性**: 数据校验和冲突解决

### 📊 监控和告警

- **实时仪表盘**: 同步状态和性能指标可视化
- **告警系统**: 可配置的告警阈值和通知机制
- **日志管理**: 完整的执行日志和错误追踪
- **性能分析**: 吞吐量、延迟、成功率等指标

### 🔧 管理功能

- **任务管理**: 创建、修改、删除同步任务
- **状态控制**: 启动、暂停、恢复、取消任务
- **配置管理**: 灵活的数据源和目标配置
- **权限控制**: 基于角色的访问控制

## 架构设计

### 服务组件

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  DataSyncService│    │SyncSchedulerSvc │    │RealTimeSyncSvc  │
│                 │    │                 │    │                 │
│ • 任务生命周期  │    │ • Cron调度      │    │ • 增量检测      │
│ • 执行管理      │    │ • 优先级管理    │    │ • 变更捕获      │
│ • 状态跟踪      │    │ • 队列管理      │    │ • 流式同步      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │SyncMonitorService│
                    │                 │
                    │ • 指标收集      │
                    │ • 告警检测      │
                    │ • 仪表盘数据    │
                    └─────────────────┘
```

### 数据流

```
数据源 → 增量检测 → 数据转换 → 冲突解决 → 目标存储
   ↑         ↓         ↓         ↓         ↓
   └─── 监控服务 ←── 日志记录 ←── 状态更新 ←── 执行反馈
```

## API接口

### 同步任务管理

#### 创建同步任务

```http
POST /api/sync/jobs
Content-Type: application/json

{
  "name": "销售数据同步",
  "sourceConfig": {
    "type": "mysql",
    "host": "localhost",
    "port": 3306,
    "database": "sales_db",
    "table": "orders"
  },
  "targetConfig": {
    "type": "postgresql",
    "host": "localhost",
    "port": 5432,
    "database": "analytics_db",
    "table": "sales_orders"
  },
  "syncMode": "incremental",
  "schedule": "0 */15 * * * *",
  "priority": 5,
  "retryConfig": {
    "maxRetries": 3,
    "backoffStrategy": "exponential",
    "initialDelay": 1000
  }
}
```

#### 获取任务列表

```http
GET /api/sync/jobs?status=running&limit=20&offset=0
```

#### 启动任务

```http
POST /api/sync/jobs/{jobId}/start
```

#### 暂停任务

```http
POST /api/sync/jobs/{jobId}/pause
```

### 定时任务管理

#### 创建定时任务

```http
POST /api/sync/scheduled-tasks
Content-Type: application/json

{
  "name": "每日数据清理",
  "schedule": "0 2 * * *",
  "jobType": "data_cleanup",
  "priority": 3,
  "config": {
    "retentionDays": 30,
    "tables": ["temp_data", "log_data"]
  }
}
```

#### 手动触发任务

```http
POST /api/sync/scheduled-tasks/{taskId}/trigger
```

### 实时同步管理

#### 启动实时同步

```http
POST /api/sync/realtime-syncs
Content-Type: application/json

{
  "name": "用户数据实时同步",
  "sourceConfig": {
    "type": "mysql",
    "host": "localhost",
    "database": "user_db"
  },
  "targetConfig": {
    "type": "elasticsearch",
    "host": "localhost",
    "index": "users"
  },
  "syncMode": "streaming",
  "interval": 5000
}
```

### 监控和告警

#### 获取仪表盘数据

```http
GET /api/sync/dashboard
```

#### 获取监控指标

```http
GET /api/sync/metrics?startTime=2024-01-01T00:00:00Z&endTime=2024-01-02T00:00:00Z
```

#### 获取告警列表

```http
GET /api/sync/alerts?limit=10
```

## 配置说明

### 环境变量

```bash
# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# 同步服务配置
SYNC_MAX_CONCURRENT_JOBS=5
SYNC_DEFAULT_TIMEOUT=300000
SYNC_RETRY_MAX_ATTEMPTS=3

# 监控配置
MONITOR_COLLECTION_INTERVAL=10000
MONITOR_ALERT_ERROR_RATE_THRESHOLD=5
MONITOR_ALERT_LATENCY_THRESHOLD=30000
```

### 数据源配置

#### MySQL数据源

```javascript
{
  "type": "mysql",
  "host": "localhost",
  "port": 3306,
  "database": "source_db",
  "username": "user",
  "password": "password",
  "table": "source_table",
  "incrementalField": "updated_at",
  "batchSize": 1000
}
```

#### PostgreSQL数据源

```javascript
{
  "type": "postgresql",
  "host": "localhost",
  "port": 5432,
  "database": "source_db",
  "username": "user",
  "password": "password",
  "table": "source_table",
  "incrementalField": "updated_at",
  "batchSize": 1000
}
```

#### Elasticsearch数据源

```javascript
{
  "type": "elasticsearch",
  "host": "localhost",
  "port": 9200,
  "index": "source_index",
  "query": {
    "match_all": {}
  },
  "batchSize": 100
}
```

## 使用示例

### 基本同步任务

```javascript
const { DataSyncService } = require('./src/services/sync/DataSyncService');

const syncService = new DataSyncService();
await syncService.initialize();

// 创建同步任务
const jobId = await syncService.createSyncJob({
  name: '用户数据同步',
  sourceConfig: {
    type: 'mysql',
    host: 'localhost',
    database: 'user_db',
    table: 'users',
  },
  targetConfig: {
    type: 'postgresql',
    host: 'localhost',
    database: 'analytics_db',
    table: 'user_analytics',
  },
  syncMode: 'incremental',
  schedule: '0 */30 * * * *', // 每30分钟执行
});

// 启动同步
await syncService.startSync(jobId);

// 获取状态
const status = await syncService.getSyncStatus(jobId);
console.log('同步状态:', status);
```

### 实时同步

```javascript
const { RealTimeSyncService } = require('./src/services/sync/RealTimeSyncService');

const realtimeService = new RealTimeSyncService();
await realtimeService.initialize();

// 启动实时同步
const syncId = await realtimeService.startRealtimeSync({
  name: '订单实时同步',
  sourceConfig: {
    type: 'mysql',
    host: 'localhost',
    database: 'order_db',
  },
  targetConfig: {
    type: 'elasticsearch',
    host: 'localhost',
    index: 'orders',
  },
  syncMode: 'streaming',
});

// 监听同步事件
realtimeService.on('dataChangeProcessed', (syncId, change) => {
  console.log('数据变更已处理:', change);
});
```

### 监控和告警

```javascript
const { SyncMonitorService } = require('./src/services/sync/SyncMonitorService');

const monitorService = new SyncMonitorService();
await monitorService.initialize();

// 设置告警阈值
monitorService.setAlertThresholds({
  errorRate: 5,
  latency: 30000,
  queueLength: 100,
});

// 监听告警事件
monitorService.on('alert', alert => {
  console.log('收到告警:', alert.message);
  // 发送通知邮件或短信
});

// 获取仪表盘数据
const dashboard = await monitorService.getDashboardData();
console.log('仪表盘数据:', dashboard);
```

## 部署说明

### 依赖安装

```bash
# 安装Node.js依赖
npm install

# 安装Redis
# Ubuntu/Debian
sudo apt-get install redis-server

# macOS
brew install redis

# 启动Redis服务
redis-server
```

### 服务启动

```bash
# 开发环境
npm run dev

# 生产环境
npm start
```

### Docker部署

```bash
# 构建镜像
docker build -t ai-agile-dap .

# 运行容器
docker run -d \
  --name ai-agile-dap \
  -p 3000:3000 \
  -e REDIS_HOST=redis \
  --link redis:redis \
  ai-agile-dap
```

## 测试

### 单元测试

```bash
# 运行所有测试
npm test

# 运行特定测试
npm test -- --testNamePattern="DataSyncService"

# 生成覆盖率报告
npm run test:coverage
```

### 集成测试

```bash
# 运行集成测试
npm run test:integration

# 运行端到端测试
npm run test:e2e
```

## 故障排除

### 常见问题

1. **Redis连接失败**
   - 检查Redis服务是否启动
   - 验证连接配置是否正确
   - 确认网络连接正常

2. **同步任务失败**
   - 检查数据源连接配置
   - 验证表结构和字段映射
   - 查看错误日志获取详细信息

3. **性能问题**
   - 调整批处理大小
   - 优化数据库查询
   - 增加并发任务数量

4. **内存使用过高**
   - 减少并发任务数量
   - 优化数据处理逻辑
   - 增加系统内存

### 日志查看

```bash
# 查看应用日志
tail -f logs/app.log

# 查看错误日志
tail -f logs/error.log

# 查看同步任务日志
tail -f logs/sync.log
```

## 贡献指南

1. Fork项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建Pull Request

## 许可证

MIT License

## 联系方式

- 项目主页: https://github.com/yourusername/ai-agile-dap
- 问题反馈: https://github.com/yourusername/ai-agile-dap/issues
- 邮箱: support@ai-agile-dap.com
