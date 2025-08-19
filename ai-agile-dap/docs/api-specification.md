# ai-agile-dap API接口规范

**版本**: v1.0  
**更新时间**: 2024年8月18日  
**设计团队**: AI开发团队

---

## 🎯 API设计原则

### RESTful设计规范
- 使用HTTP动词: GET/POST/PUT/PATCH/DELETE
- 资源导向的URL设计
- 统一的响应格式
- 合理的HTTP状态码
- 版本化管理

### 命名约定
- URL使用小写字母和连字符
- 参数使用驼峰命名法
- 时间格式统一使用ISO 8601
- 分页参数标准化

---

## 🔗 API网关配置

### 基础URL
```yaml
开发环境: https://dev-api.ai-agile-dap.com
测试环境: https://test-api.ai-agile-dap.com  
生产环境: https://api.ai-agile-dap.com

版本前缀: /api/v1
完整示例: https://api.ai-agile-dap.com/api/v1/queries
```

### 通用请求头
```yaml
Content-Type: application/json
Accept: application/json
Authorization: Bearer {jwt_token}
X-Request-ID: {unique_request_id}
User-Agent: ai-agile-dap-client/1.0
```

### 通用响应格式
```json
{
  "success": true,
  "code": 200,
  "message": "Success",
  "data": {},
  "timestamp": "2024-08-18T10:30:00Z",
  "requestId": "req_1234567890"
}
```

### 错误响应格式
```json
{
  "success": false,
  "code": 400,
  "message": "Bad Request",
  "error": {
    "type": "VALIDATION_ERROR",
    "details": "Missing required field: naturalQuery",
    "field": "naturalQuery"
  },
  "timestamp": "2024-08-18T10:30:00Z",
  "requestId": "req_1234567890"
}
```

---

## 🧠 AI引擎服务接口

### 1. 自然语言查询接口

#### POST /api/v1/ai/query
处理自然语言查询并返回结果

**请求体**:
```json
{
  "naturalQuery": "显示过去3个月的销售趋势",
  "dataSourceId": 123,
  "context": {
    "userId": "user_456",
    "sessionId": "session_789"
  },
  "options": {
    "enableCache": true,
    "maxExecutionTime": 30000,
    "responseFormat": "detailed"
  }
}
```

**响应体**:
```json
{
  "success": true,
  "data": {
    "queryId": "query_abc123",
    "intent": {
      "queryType": "trend",
      "entities": ["销售", "趋势"],
      "timeRange": "3个月",
      "confidence": 0.95
    },
    "sqlQuery": {
      "sql": "SELECT DATE(date) as date, SUM(sales_amount) as value FROM business_data WHERE date >= DATE_SUB(NOW(), INTERVAL 3 MONTH) GROUP BY DATE(date) ORDER BY date",
      "parameters": {},
      "estimatedCost": 5,
      "safetyScore": 0.98
    },
    "recommendedChart": "line",
    "data": [
      {"date": "2024-05-01", "value": 125000},
      {"date": "2024-06-01", "value": 138000},
      {"date": "2024-07-01", "value": 142000}
    ],
    "executionTime": 1250,
    "metadata": {
      "rowCount": 3,
      "dataTypes": {"date": "date", "value": "number"},
      "insights": ["销售趋势持续上升", "6月增长率最高"]
    }
  }
}
```

#### POST /api/v1/ai/validate
验证自然语言查询的有效性

**请求体**:
```json
{
  "naturalQuery": "显示销售数据"
}
```

**响应体**:
```json
{
  "success": true,
  "data": {
    "valid": true,
    "message": "查询格式正确",
    "suggestions": [],
    "estimatedType": "statistics",
    "confidence": 0.85
  }
}
```

#### GET /api/v1/ai/supported-queries
获取支持的查询类型和示例

**响应体**:
```json
{
  "success": true,
  "data": {
    "supportedTypes": [
      {
        "type": "trend",
        "name": "趋势分析",
        "description": "分析数据随时间的变化趋势",
        "examples": [
          "显示过去3个月的销售趋势",
          "分析今年用户增长情况"
        ]
      }
    ],
    "tips": [
      "尽量使用具体的时间范围",
      "明确指定要分析的指标"
    ]
  }
}
```

---

## 👤 用户服务接口

### 1. 用户认证

#### POST /api/v1/auth/login
用户登录

**请求体**:
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**响应体**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 123,
      "username": "john_doe",
      "email": "user@example.com",
      "fullName": "John Doe",
      "role": "user",
      "avatar": "https://cdn.example.com/avatars/123.jpg"
    },
    "tokens": {
      "accessToken": "eyJhbGciOiJIUzI1NiIs...",
      "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
      "expiresIn": 86400
    }
  }
}
```

#### POST /api/v1/auth/register
用户注册

**请求体**:
```json
{
  "username": "john_doe",
  "email": "user@example.com", 
  "password": "password123",
  "fullName": "John Doe"
}
```

#### POST /api/v1/auth/refresh
刷新访问令牌

**请求体**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

#### POST /api/v1/auth/logout
用户登出

### 2. 用户信息管理

#### GET /api/v1/users/profile
获取用户资料

**响应体**:
```json
{
  "success": true,
  "data": {
    "id": 123,
    "username": "john_doe",
    "email": "user@example.com",
    "fullName": "John Doe",
    "avatar": "https://cdn.example.com/avatars/123.jpg",
    "role": "user",
    "status": "active",
    "preferences": {
      "language": "zh-CN",
      "timezone": "Asia/Shanghai",
      "theme": "light"
    },
    "statistics": {
      "totalQueries": 156,
      "totalReports": 23,
      "lastLoginAt": "2024-08-18T09:30:00Z"
    }
  }
}
```

#### PUT /api/v1/users/profile
更新用户资料

**请求体**:
```json
{
  "fullName": "John Smith",
  "preferences": {
    "language": "en-US",
    "theme": "dark"
  }
}
```

---

## 📊 数据服务接口

### 1. 数据源管理

#### GET /api/v1/data-sources
获取数据源列表

**查询参数**:
```yaml
page: 1
limit: 20
type: csv,excel,mysql
status: active,inactive
search: 销售数据
```

**响应体**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 123,
        "name": "销售数据",
        "type": "mysql",
        "status": "active",
        "description": "主要销售业务数据",
        "schema": {
          "tables": ["sales", "products", "customers"],
          "totalRows": 150000,
          "lastSync": "2024-08-18T08:00:00Z"
        },
        "createdAt": "2024-08-01T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

#### POST /api/v1/data-sources
创建数据源

**请求体**:
```json
{
  "name": "销售数据",
  "type": "mysql",
  "description": "主要销售业务数据",
  "connectionConfig": {
    "host": "db.example.com",
    "port": 3306,
    "database": "sales_db",
    "username": "readonly_user",
    "password": "encrypted_password"
  }
}
```

#### GET /api/v1/data-sources/{id}
获取数据源详情

#### PUT /api/v1/data-sources/{id}
更新数据源

#### DELETE /api/v1/data-sources/{id}
删除数据源

### 2. 数据查询执行

#### POST /api/v1/data/execute-query
执行SQL查询

**请求体**:
```json
{
  "dataSourceId": 123,
  "sql": "SELECT * FROM sales WHERE date >= '2024-08-01'",
  "limit": 1000,
  "timeout": 30000
}
```

**响应体**:
```json
{
  "success": true,
  "data": {
    "columns": [
      {"name": "id", "type": "number"},
      {"name": "date", "type": "date"},
      {"name": "amount", "type": "number"}
    ],
    "rows": [
      [1, "2024-08-01", 1500.00],
      [2, "2024-08-01", 2300.50]
    ],
    "metadata": {
      "rowCount": 2,
      "executionTime": 245,
      "affectedRows": 0
    }
  }
}
```

---

## 📈 报表服务接口

### 1. 报表管理

#### GET /api/v1/reports
获取用户报表列表

**查询参数**:
```yaml
page: 1
limit: 20
category: sales,marketing,finance
isFavorite: true,false
search: 销售报表
```

**响应体**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 456,
        "name": "月度销售分析报表",
        "description": "每月销售业绩分析",
        "category": "sales",
        "isFavorite": true,
        "thumbnail": "https://cdn.example.com/thumbnails/456.jpg",
        "chartType": "line",
        "lastUpdated": "2024-08-18T10:00:00Z",
        "shareToken": "share_abc123"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 12,
      "totalPages": 1
    }
  }
}
```

#### POST /api/v1/reports
创建报表

**请求体**:
```json
{
  "name": "月度销售分析报表",
  "description": "每月销售业绩分析",
  "templateId": 789,
  "config": {
    "dataSourceId": 123,
    "chartType": "line",
    "filters": {
      "dateRange": "last_month",
      "department": "sales"
    },
    "layout": {
      "title": "月度销售趋势",
      "showLegend": true,
      "colorScheme": "blue"
    }
  }
}
```

### 2. 报表导出

#### POST /api/v1/reports/{id}/export
导出报表

**请求体**:
```json
{
  "format": "pdf",
  "options": {
    "orientation": "landscape",
    "includeCharts": true,
    "includeData": false,
    "watermark": "Confidential"
  }
}
```

**响应体**:
```json
{
  "success": true,
  "data": {
    "downloadUrl": "https://cdn.example.com/exports/report_456_20240818.pdf",
    "fileSize": 2048576,
    "expiresAt": "2024-08-19T10:00:00Z"
  }
}
```

---

## 📚 查询历史接口

### GET /api/v1/queries/history
获取查询历史记录

**查询参数**:
```yaml
page: 1
limit: 50
type: trend,comparison,ranking
status: success,failed
dateFrom: 2024-08-01
dateTo: 2024-08-18
```

**响应体**:
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "query_abc123",
        "naturalQuery": "显示过去3个月的销售趋势",
        "queryType": "trend",
        "chartType": "line",
        "executionTime": 1250,
        "status": "success",
        "resultCount": 92,
        "createdAt": "2024-08-18T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 156,
      "totalPages": 4
    },
    "statistics": {
      "totalQueries": 156,
      "successRate": 0.94,
      "avgExecutionTime": 1850
    }
  }
}
```

### GET /api/v1/queries/{id}
获取特定查询的详细结果

---

## 🔧 系统管理接口

### 1. 健康检查

#### GET /api/v1/health
服务健康检查

**响应体**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "1.0.0",
    "timestamp": "2024-08-18T10:30:00Z",
    "services": {
      "database": "healthy",
      "redis": "healthy",
      "aiEngine": "healthy",
      "fileStorage": "healthy"
    },
    "performance": {
      "responseTime": 45,
      "uptime": 2592000,
      "memoryUsage": 0.67
    }
  }
}
```

### 2. 系统信息

#### GET /api/v1/system/info
获取系统信息

**响应体**:
```json
{
  "success": true,
  "data": {
    "version": "1.0.0",
    "environment": "production",
    "supportedFormats": ["csv", "excel", "json", "pdf"],
    "maxFileSize": 104857600,
    "maxQueryTime": 30000,
    "features": {
      "aiEngine": true,
      "exportPdf": true,
      "realTimeData": false
    }
  }
}
```

---

## 📋 错误码定义

### HTTP状态码映射
```yaml
200: 成功
201: 创建成功  
400: 请求参数错误
401: 未授权访问
403: 权限不足
404: 资源不存在
409: 资源冲突
422: 数据验证失败
429: 请求频率限制
500: 服务器内部错误
503: 服务不可用
```

### 业务错误码
```yaml
# 认证相关 (1xxx)
1001: 用户名或密码错误
1002: 令牌已过期
1003: 令牌无效
1004: 账户已锁定

# 查询相关 (2xxx)  
2001: 查询语句无效
2002: 数据源连接失败
2003: 查询超时
2004: 查询结果过大

# 数据源相关 (3xxx)
3001: 数据源不存在
3002: 数据源连接配置错误
3003: 数据源权限不足
3004: 数据源格式不支持

# 报表相关 (4xxx)
4001: 报表模板不存在
4002: 报表配置无效
4003: 导出格式不支持
4004: 导出文件过大
```

---

## 🔄 API版本管理

### 版本策略
- **主版本**: 破坏性变更
- **次版本**: 新增功能
- **修订版本**: Bug修复

### 向后兼容
- 保持至少2个主版本的兼容性
- 废弃功能提前6个月通知
- 提供迁移指南和工具

### 版本请求头
```yaml
API-Version: 1.0
Accept-Version: ~1.0  # 接受1.0.x版本
```

---

## 📊 API限流策略

### 限流规则
```yaml
用户级别:
  - 普通用户: 100请求/分钟
  - 高级用户: 500请求/分钟  
  - 企业用户: 2000请求/分钟

接口级别:
  - 查询接口: 20请求/分钟
  - 认证接口: 10请求/分钟
  - 导出接口: 5请求/分钟
```

### 限流响应
```json
{
  "success": false,
  "code": 429,
  "message": "Rate limit exceeded",
  "error": {
    "type": "RATE_LIMIT_ERROR",
    "retryAfter": 60,
    "limit": 100,
    "remaining": 0,
    "resetTime": "2024-08-18T11:00:00Z"
  }
}
```

---

**API规范设计**: AI开发团队  
**审核状态**: 待前后端开发评审  
**下一步**: 安全和权限策略制定