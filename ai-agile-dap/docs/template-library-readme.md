# 报表模板库功能文档

## 概述

报表模板库是AI-Agile-DAP系统的核心功能之一，为用户提供丰富的预置报表模板和自定义功能。该功能支持模板搜索、预览、自定义、分享和统计分析，帮助用户快速创建专业级报表。

## 功能特性

### 1. 预置模板库

- **10+预置模板**：覆盖销售、财务、分析、运营等常见业务场景
- **分类管理**：按业务领域分类，便于快速查找
- **标签系统**：支持多标签分类和筛选
- **模板元数据**：包含描述、缩略图、配置信息等

### 2. 智能搜索和发现

- **全文搜索**：支持模板名称、描述、标签的模糊搜索
- **高级筛选**：按分类、标签、创建时间等条件筛选
- **智能推荐**：基于用户历史和使用统计的个性化推荐
- **搜索建议**：实时搜索建议和自动补全

### 3. 模板预览系统

- **实时预览**：支持模板的实时数据预览
- **数据绑定**：支持真实数据源和模拟数据
- **缓存机制**：智能缓存提升预览性能
- **响应式预览**：适配不同设备和屏幕尺寸

### 4. 模板自定义功能

- **可视化编辑**：拖拽式组件配置
- **样式定制**：支持颜色、字体、布局等样式调整
- **版本管理**：模板版本控制和历史记录
- **配置继承**：基于预置模板的自定义继承

### 5. 协作和分享

- **团队共享**：支持团队内部模板共享
- **权限控制**：细粒度的访问和编辑权限
- **协作编辑**：多人协作编辑模板
- **模板市场**：企业级模板市场

### 6. 统计分析

- **使用统计**：模板使用次数、查看次数、分享次数
- **性能监控**：预览加载时间、缓存命中率
- **用户行为**：用户偏好分析、热门模板排行
- **趋势分析**：模板使用趋势和效果分析

## 技术架构

### 核心服务

#### 1. TemplateLibraryService

```javascript
// 核心模板库服务
class TemplateLibraryService {
  // 模板管理
  async getTemplates(filter)
  async getTemplate(templateId)
  async saveTemplate(template)
  async deleteTemplate(templateId)

  // 模板操作
  async customizeTemplate(templateId, customizations)
  async previewTemplate(templateId, dataSource)

  // 分类和标签
  async getCategories()
  async getTags()

  // 统计和推荐
  async getTemplateStats(templateId)
  async getRecommendedTemplates(userId, context, limit)
}
```

#### 2. TemplateSearchService

```javascript
// 搜索和推荐服务
class TemplateSearchService {
  // 搜索功能
  async fullTextSearch(query, options)
  async getSearchSuggestions(query, limit)

  // 推荐功能
  async getRecommendedTemplates(userId, context, limit)
  async getUserTemplateHistory(userId)

  // 统计分析
  async recordTemplateUse(userId, templateId, action)
  async getTemplateStats(templateId)
}
```

#### 3. TemplatePreviewService

```javascript
// 预览服务
class TemplatePreviewService {
  // 预览功能
  async previewTemplate(templateId, dataSource, options)
  async generatePreviewData(template, dataSource, dataParams)

  // 缓存管理
  async getCachedPreview(cacheKey)
  async cachePreview(cacheKey, previewData)
  async clearPreviewCache(templateId)

  // 性能监控
  async getPreviewStats(templateId)
  async recordPreviewStats(templateId, loadTime)
}
```

### 数据模型

#### 模板数据结构

```javascript
{
  id: "template-id",
  name: "模板名称",
  description: "模板描述",
  category: "sales|finance|analytics|operations|custom",
  tags: ["dashboard", "sales", "kpi"],
  thumbnail: "/templates/thumbnail.png",
  config: {
    layout: "grid|report|dashboard",
    components: [
      {
        type: "chart|metric|table|summary",
        title: "组件标题",
        chartType: "line|bar|pie|funnel", // 图表类型
        dataField: "data_source_field", // 数据字段
        format: "currency|number|percentage|decimal", // 格式化
        unit: "元|个|%" // 单位
      }
    ]
  },
  isPreset: true|false,
  originalTemplateId: "original-template-id", // 自定义模板的原始模板ID
  customizations: {}, // 自定义配置
  createdAt: "2024-01-01T00:00:00.000Z",
  updatedAt: "2024-01-01T00:00:00.000Z"
}
```

#### 统计数据结构

```javascript
{
  usage: {
    views: 100,
    uses: 50,
    shares: 10,
    lastUsed: "2024-01-01T00:00:00.000Z"
  },
  preview: {
    previews: 200,
    lastPreview: "2024-01-01T00:00:00.000Z",
    averageLoadTime: 150 // 毫秒
  }
}
```

## API接口

### 模板管理接口

#### 获取模板列表

```http
GET /api/templates?category=sales&tags[]=dashboard&search=销售&sortBy=name&limit=20&offset=0
```

#### 搜索模板

```http
GET /api/templates/search?q=销售仪表板&category=sales&tags[]=kpi&sortBy=relevance&limit=20&offset=0
```

#### 获取模板详情

```http
GET /api/templates/{templateId}
```

#### 预览模板

```http
GET /api/templates/{templateId}/preview?dataSource=sales_db&useCache=true&forceRefresh=false
```

#### 自定义模板

```http
POST /api/templates/{templateId}/customize
Content-Type: application/json

{
  "name": "自定义销售仪表板",
  "description": "自定义描述",
  "config": {
    "layout": "grid",
    "components": [...]
  },
  "tags": ["custom", "sales"]
}
```

#### 创建新模板

```http
POST /api/templates
Content-Type: application/json

{
  "name": "新模板",
  "description": "模板描述",
  "category": "custom",
  "config": {
    "layout": "grid",
    "components": [...]
  },
  "tags": ["custom"]
}
```

#### 更新模板

```http
PUT /api/templates/{templateId}
Content-Type: application/json

{
  "name": "更新后的模板名称",
  "description": "更新后的描述",
  "config": {...}
}
```

#### 删除模板

```http
DELETE /api/templates/{templateId}
```

### 分类和标签接口

#### 获取分类列表

```http
GET /api/templates/categories
```

#### 获取标签列表

```http
GET /api/templates/tags
```

### 搜索和推荐接口

#### 获取搜索建议

```http
GET /api/templates/suggestions?q=销售&limit=5
```

#### 获取推荐模板

```http
GET /api/templates/recommendations?limit=10&category=sales&tags[]=dashboard
```

### 统计接口

#### 获取模板统计

```http
GET /api/templates/{templateId}/stats
```

#### 记录模板使用

```http
POST /api/templates/{templateId}/use
Content-Type: application/json

{
  "action": "use" // view|use|share
}
```

### 缓存管理接口

#### 清除预览缓存

```http
DELETE /api/templates/{templateId}/cache
```

## 配置说明

### 环境变量

```bash
# Redis配置
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# 模板库配置
TEMPLATE_CACHE_EXPIRY=300000 # 5分钟
TEMPLATE_PREVIEW_CACHE_SIZE=1000
```

### 预置模板配置

```javascript
// 销售仪表板模板
{
  id: 'sales-dashboard',
  name: '销售仪表板',
  category: 'sales',
  tags: ['dashboard', 'sales', 'kpi'],
  description: '销售业绩综合仪表板，包含销售额、客户、产品等关键指标',
  config: {
    layout: 'grid',
    components: [
      { type: 'chart', chartType: 'line', title: '销售趋势' },
      { type: 'metric', title: '总销售额', value: 'sales_total' },
      { type: 'chart', chartType: 'pie', title: '产品分布' },
      { type: 'table', title: '销售明细' }
    ]
  }
}
```

## 使用示例

### 1. 获取模板列表

```javascript
// 获取所有销售类模板
const response = await fetch('/api/templates?category=sales');
const { data } = await response.json();
console.log('销售模板:', data.templates);
```

### 2. 搜索模板

```javascript
// 搜索包含"仪表板"的模板
const response = await fetch('/api/templates/search?q=仪表板');
const { data } = await response.json();
console.log('搜索结果:', data.results);
```

### 3. 预览模板

```javascript
// 预览销售仪表板模板
const response = await fetch('/api/templates/sales-dashboard/preview');
const { data } = await response.json();
console.log('预览数据:', data);
```

### 4. 自定义模板

```javascript
// 基于销售仪表板创建自定义模板
const response = await fetch('/api/templates/sales-dashboard/customize', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: '我的销售仪表板',
    description: '个性化销售仪表板',
    config: {
      layout: 'grid',
      components: [
        { type: 'chart', chartType: 'bar', title: '月度销售' },
        { type: 'metric', title: '目标完成率', value: 'target_completion' },
      ],
    },
  }),
});
const { data } = await response.json();
console.log('自定义模板:', data);
```

### 5. 获取推荐模板

```javascript
// 获取推荐模板
const response = await fetch('/api/templates/recommendations?limit=5');
const { data } = await response.json();
console.log('推荐模板:', data);
```

## 性能优化

### 1. 缓存策略

- **内存缓存**：模板元数据和配置信息
- **Redis缓存**：预览数据和用户历史
- **CDN缓存**：静态资源（缩略图、样式文件）

### 2. 数据库优化

- **索引优化**：模板ID、分类、标签索引
- **分页查询**：大数据量分页加载
- **连接池**：数据库连接池管理

### 3. 搜索优化

- **全文索引**：模板名称、描述全文搜索
- **相关性排序**：基于用户行为的智能排序
- **搜索建议**：实时搜索建议缓存

### 4. 预览优化

- **异步加载**：组件异步加载和渲染
- **数据缓存**：预览数据智能缓存
- **压缩传输**：响应数据压缩

## 监控和告警

### 1. 性能监控

- **响应时间**：API接口响应时间监控
- **缓存命中率**：缓存效果监控
- **错误率**：接口错误率监控

### 2. 业务监控

- **模板使用量**：模板使用统计
- **搜索热度**：搜索关键词热度
- **用户行为**：用户操作行为分析

### 3. 系统监控

- **资源使用**：CPU、内存、磁盘使用率
- **连接数**：数据库、Redis连接数
- **队列长度**：任务队列长度监控

## 安全考虑

### 1. 访问控制

- **权限验证**：用户权限验证
- **资源隔离**：用户数据隔离
- **操作审计**：敏感操作审计日志

### 2. 数据安全

- **输入验证**：参数输入验证
- **SQL注入防护**：数据库查询安全
- **XSS防护**：跨站脚本攻击防护

### 3. 接口安全

- **限流控制**：API接口限流
- **认证授权**：JWT Token认证
- **HTTPS传输**：数据传输加密

## 部署指南

### 1. 环境准备

```bash
# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑.env文件配置数据库和Redis连接

# 启动Redis服务
redis-server
```

### 2. 数据库初始化

```bash
# 运行数据库迁移
npm run migrate

# 初始化预置模板
npm run init-templates
```

### 3. 服务启动

```bash
# 开发环境
npm run dev

# 生产环境
npm start
```

### 4. 健康检查

```bash
# 检查服务状态
curl http://localhost:3000/health

# 检查模板库状态
curl http://localhost:3000/api/templates
```

## 故障排除

### 1. 常见问题

#### 模板加载失败

```bash
# 检查Redis连接
redis-cli ping

# 检查模板数据
redis-cli hgetall custom_templates
```

#### 预览加载慢

```bash
# 检查缓存状态
redis-cli keys "preview:*"

# 清理过期缓存
curl -X DELETE http://localhost:3000/api/templates/cache
```

#### 搜索无结果

```bash
# 检查搜索索引
redis-cli keys "search:*"

# 重建搜索索引
npm run rebuild-search-index
```

### 2. 日志分析

```bash
# 查看应用日志
tail -f logs/app.log

# 查看错误日志
tail -f logs/error.log

# 查看访问日志
tail -f logs/access.log
```

### 3. 性能调优

```bash
# 监控Redis性能
redis-cli info memory

# 监控数据库性能
mysql -u root -p -e "SHOW PROCESSLIST;"

# 监控应用性能
curl http://localhost:3000/metrics
```

## 更新日志

### v1.0.0 (2024-01-01)

- 初始版本发布
- 支持预置模板库
- 实现模板搜索和预览
- 支持模板自定义功能
- 添加统计分析功能

### v1.1.0 (2024-01-15)

- 优化搜索算法
- 增强推荐功能
- 改进缓存机制
- 添加性能监控

### v1.2.0 (2024-02-01)

- 支持模板分享
- 添加协作功能
- 增强权限控制
- 优化用户体验

## 贡献指南

### 1. 开发环境设置

```bash
# 克隆项目
git clone <repository-url>
cd ai-agile-dap

# 安装依赖
npm install

# 启动开发服务
npm run dev
```

### 2. 代码规范

- 使用ESLint进行代码检查
- 遵循项目代码风格指南
- 编写单元测试和集成测试
- 提交前运行测试套件

### 3. 提交规范

```bash
# 提交代码
git add .
git commit -m "feat: 添加新模板类型支持"

# 推送代码
git push origin feature/new-template-type
```

### 4. 测试要求

- 单元测试覆盖率 > 80%
- 集成测试覆盖主要功能
- 性能测试验证性能指标
- 安全测试检查安全漏洞

## 联系方式

- **项目主页**：https://github.com/ai-agile-dap
- **问题反馈**：https://github.com/ai-agile-dap/issues
- **文档地址**：https://ai-agile-dap.readthedocs.io
- **技术支持**：support@ai-agile-dap.com

---

_本文档最后更新时间：2024年1月1日_
