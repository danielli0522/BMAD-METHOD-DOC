# ai-agile-dap

**AI驱动的零门槛企业数据洞察平台**

让每个业务人员都能在10分钟内生成专业级数据报表，无需掌握SQL或复杂的数据分析技能。

## 🎯 产品愿景

让数据洞察像聊天一样简单，让每个业务人员都成为数据分析师。

## 📊 核心价值

- **10分钟法则** - 从想法到专业报表，不超过10分钟
- **零技术门槛** - 像和AI助手对话一样自然
- **企业级专业** - 咨询公司级别的图表质量
- **智能化洞察** - 不仅生成图表，更提供业务建议

## 🏗️ 项目结构

```
ai-agile-dap/
├── docs/                           # 项目文档
│   ├── prd.md                      # 产品需求文档
│   ├── ai-agile-dap-用户调研报告.md  # 用户调研报告
│   ├── ai-agile-dap-客户清单.md      # 目标客户清单
│   ├── ai-agile-dap-邀请话术模板.md   # 访谈话术模板
│   └── architecture.md            # 技术架构文档 (待创建)
├── src/                           # 源代码
│   ├── frontend/                  # 前端代码 (待开发)
│   ├── backend/                   # 后端代码 (待开发)  
│   ├── ai-engine/                 # AI引擎 ✅ 已完成
│   └── shared/                    # 共享模块
├── tests/                         # 测试代码
│   ├── unit/                      # 单元测试
│   ├── integration/               # 集成测试
│   └── e2e/                       # 端到端测试
├── config/                        # 配置文件
│   ├── development.json           # 开发环境配置
│   ├── production.json            # 生产环境配置
│   └── docker-compose.yml         # Docker配置
├── scripts/                       # 构建脚本
├── .github/                       # GitHub工作流
└── README.md                      # 项目说明
```

## 🚀 快速开始

### 环境要求
- Node.js >= 18
- Python >= 3.9
- PostgreSQL >= 12
- Redis >= 6

### 安装依赖
```bash
# 克隆项目
git clone [repository-url]
cd ai-agile-dap

# 安装前端依赖
cd src/frontend
npm install

# 安装后端依赖
cd ../backend
pip install -r requirements.txt
```

### 启动开发服务
```bash
# 启动数据库服务
docker-compose up -d postgres redis

# 启动后端服务
cd src/backend
python manage.py runserver

# 启动前端服务
cd src/frontend  
npm run dev
```

## 📋 开发计划

### Phase 1: MVP (0-3个月)
- [x] 用户调研完成
- [x] 产品需求文档完成
- [x] 技术架构设计
- [x] 自然语言查询引擎 ✨
- [x] 智能图表生成 ✨
- [x] Sprint 0 框架建立
- [ ] 前后端基础集成
- [ ] 基础报表模板

### Phase 2: 增长期 (3-6个月)
- [ ] 数据库连接支持
- [ ] 行业模板库
- [ ] 团队协作功能
- [ ] 企业级权限管理

### Phase 3: 规模化 (6-12个月)
- [ ] AI洞察推荐
- [ ] 实时数据流
- [ ] 移动端支持
- [ ] API接口开放

## 👥 团队角色

- **产品经理**: 产品规划和需求管理
- **架构师**: 技术架构设计
- **AI工程师**: 自然语言处理引擎
- **前端工程师**: 用户界面开发
- **后端工程师**: 服务端开发
- **测试工程师**: 质量保障

## 📖 文档索引

### 产品文档
- [产品需求文档 (PRD)](docs/prd.md)
- [用户调研报告](docs/ai-agile-dap-用户调研报告.md)
- [技术架构文档](docs/architecture.md) (待创建)

### 研究资料
- [目标客户清单](docs/ai-agile-dap-客户清单.md)
- [访谈话术模板](docs/ai-agile-dap-邀请话术模板.md)

### 开发文档
- [API文档](docs/api.md) (待创建)
- [部署指南](docs/deployment.md) (待创建)
- [开发规范](docs/development-guide.md) (待创建)

## 🎯 核心功能

### 1. 自然语言查询
用户可以用自然语言提问，系统智能理解并生成相应的数据查询。

示例查询：
- "显示过去3个月的销售趋势"
- "哪个渠道的转化率最高？"
- "本季度各部门费用支出对比"

### 2. 智能图表生成
基于查询结果和数据特征，自动选择最佳图表类型并生成专业图表。

### 3. 专业报表模板
提供预设的报表模板，用户可快速生成格式化的业务报告。

### 4. 多格式导出
支持PDF、Excel等格式导出，便于分享和存档。

## 🔧 技术栈

### 前端
- React 18 + TypeScript
- Ant Design / Material-UI
- D3.js / Chart.js (图表)
- Vite (构建工具)

### 后端
- Node.js + Express / Python + FastAPI
- PostgreSQL (主数据库)
- Redis (缓存)
- JWT (认证)

### AI引擎
- OpenAI API / 本地大语言模型
- 自然语言处理
- SQL生成算法

### 部署
- Docker + Kubernetes
- AWS / 阿里云
- CI/CD (GitHub Actions)

## 📊 成功指标

### 技术指标
- 查询准确率 ≥ 90%
- 响应时间 ≤ 3秒
- 系统可用性 ≥ 99.5%

### 业务指标
- 30天留存率 ≥ 60%
- 周均使用频次 ≥ 3次
- NPS分数 ≥ 50

## 🤝 贡献指南

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目基于 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📞 联系我们

- 项目负责人: [您的姓名]
- 邮箱: [your.email@example.com]
- 项目地址: [GitHub Repository URL]

---

**最后更新**: 2024年8月18日  
**版本**: v1.0.0  
**状态**: 开发中 🚧