import { useState, useEffect } from 'react';
import { Layout, Input, Button, Card, message, Spin, Menu, Avatar, Dropdown, Table, Modal, Form, Tabs, List, Typography } from 'antd';
import { SearchOutlined, UserOutlined, HistoryOutlined, DownloadOutlined, LoginOutlined, LogoutOutlined, SettingOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import axios from 'axios';
import './App.css';

const { Header, Content, Sider } = Layout;
const { TextArea } = Input;
const { TabPane } = Tabs;
const { Title, Text } = Typography;

interface QueryResult {
  id?: number;
  query: string;
  sql: string;
  data: any[];
  chartType: string;
  chartConfig: any;
  timestamp?: string;
  confidence?: number;
  processingTime?: number;
}

interface User {
  id: number;
  username: string;
  email: string;
  avatar?: string;
}

interface QueryHistory {
  id: number;
  naturalQuery: string;
  queryType: string;
  status: string;
  confidence: number;
  processingTime: number;
  createdAt: string;
}

interface BackendQueryResponse {
  success: boolean;
  message: string;
  data: {
    query: {
      id: number;
      naturalQuery: string;
      queryType: string;
      sqlQuery: string;
      result: {
        status: string;
        data: any[];
        rows: number;
        executionTime: string;
        confidence: number;
      };
      chartConfig: any;
      status: string;
      processingTime: number;
    };
    aiEngineResponse: {
      success: boolean;
      data: {
        query_id: string;
        understood_intent: string;
        sql_query: string;
        execution_result: any[];
        chart_recommendation: {
          type: string;
          config: any;
          reasoning: string;
        };
        confidence_score: number;
        processing_time: number;
      };
      message: string;
    };
  };
}

function App() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loginVisible, setLoginVisible] = useState(false);
  const [activeTab, setActiveTab] = useState('query');
  const [queryHistory, setQueryHistory] = useState<QueryHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loginForm] = Form.useForm();

  // 加载用户信息和查询历史
  useEffect(() => {
    loadUserInfo();
    if (user) {
      loadQueryHistory();
    }
  }, [user]);

  const loadUserInfo = async () => {
    // 从localStorage或token验证获取用户信息
    const token = localStorage.getItem('auth_token');
    if (token) {
      try {
        const response = await axios.get('/api/auth/profile', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (response.data.success) {
          setUser(response.data.data);
        }
      } catch (error) {
        localStorage.removeItem('auth_token');
      }
    }
  };

  const loadQueryHistory = async () => {
    if (!user) return;
    
    setHistoryLoading(true);
    try {
      const token = localStorage.getItem('auth_token');
      const response = await axios.get('/api/queries/history', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setQueryHistory(response.data.data);
      }
    } catch (error) {
      message.error('加载查询历史失败');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleLogin = async (values) => {
    try {
      const response = await axios.post('/api/auth/login', values);
      if (response.data.success) {
        const { user, token } = response.data.data;
        setUser(user);
        localStorage.setItem('auth_token', token);
        setLoginVisible(false);
        message.success('登录成功');
        loginForm.resetFields();
      } else {
        message.error(response.data.message || '登录失败');
      }
    } catch (error) {
      message.error('登录失败，请检查网络连接');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('auth_token');
    setActiveTab('query');
    message.success('已退出登录');
  };

  const handleQuery = async () => {
    if (!query.trim()) {
      message.warning('请输入查询内容');
      return;
    }

    setLoading(true);
    try {
      // 调用真实的后端API
      console.log('发送查询请求:', query.trim());
      
      const response = await axios.post<BackendQueryResponse>('/api/queries', {
        naturalQuery: query.trim(),
        database: 'default'
      });
      
      console.log('收到后端响应:', response.data);
      
      if (!response.data.success) {
        throw new Error(response.data.message || '查询处理失败');
      }
      
      const backendData = response.data.data;
      const queryData = backendData.query;
      const aiData = backendData.aiEngineResponse;
      
      // 转换为前端需要的格式
      const frontendResult: QueryResult = {
        query: queryData.naturalQuery,
        sql: queryData.sqlQuery || 'SQL生成中...',
        data: queryData.result.data || [],
        chartType: queryData.chartConfig?.type || 'table',
        chartConfig: queryData.chartConfig?.config || aiData?.data?.chart_recommendation?.config || {}
      };
      
      setResult(frontendResult);
      message.success(`查询成功 (置信度: ${(queryData.result.confidence * 100).toFixed(1)}%)`);
      
      // 刷新查询历史
      if (user) {
        loadQueryHistory();
      }
      
    } catch (error: any) {
      console.error('查询失败:', error);
      
      // 处理不同类型的错误
      if (error.response?.status === 400) {
        message.error(error.response.data?.message || '查询格式不正确');
      } else if (error.response?.status === 500) {
        message.error('服务器内部错误，请稍后重试');
      } else if (error.code === 'ECONNREFUSED') {
        message.warning('后端服务未启动，使用模拟数据演示');
        // 使用模拟数据作为后备方案
        const mockResult: QueryResult = {
          query: query,
          sql: "SELECT department, SUM(sales) as total_sales FROM business_data WHERE date >= '2024-01-01' GROUP BY department",
          data: [
            { department: '销售部', total_sales: 150000 },
            { department: '市场部', total_sales: 120000 },
            { department: '技术部', total_sales: 80000 },
            { department: '运营部', total_sales: 95000 }
          ],
          chartType: 'bar',
          chartConfig: {
            title: { text: '各部门销售业绩' },
            xAxis: { type: 'category', data: ['销售部', '市场部', '技术部', '运营部'] },
            yAxis: { type: 'value' },
            series: [{
              name: '销售额',
              type: 'bar',
              data: [150000, 120000, 80000, 95000]
            }]
          }
        };
        setResult(mockResult);
      } else {
        message.error('查询失败，请检查网络连接');
      }
      
    } finally {
      setLoading(false);
    }
  };

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人信息'
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '设置'
    },
    {
      type: 'divider'
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout
    }
  ];

  const historyColumns = [
    {
      title: '查询内容',
      dataIndex: 'naturalQuery',
      key: 'naturalQuery',
      ellipsis: true,
      width: '40%'
    },
    {
      title: '类型',
      dataIndex: 'queryType',
      key: 'queryType',
      width: '15%'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: '10%',
      render: (status) => (
        <span style={{ color: status === 'success' ? '#52c41a' : '#ff4d4f' }}>
          {status === 'success' ? '成功' : '失败'}
        </span>
      )
    },
    {
      title: '置信度',
      dataIndex: 'confidence',
      key: 'confidence',
      width: '10%',
      render: (confidence) => `${(confidence * 100).toFixed(1)}%`
    },
    {
      title: '耗时(ms)',
      dataIndex: 'processingTime',
      key: 'processingTime',
      width: '10%'
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: '15%',
      render: (time) => new Date(time).toLocaleString()
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ 
        background: '#1890ff', 
        color: 'white', 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px'
      }}>
        <div style={{
          fontSize: '24px',
          fontWeight: 'bold'
        }}>
          AI-Agile-DAP 数据洞察平台
        </div>
        
        <div>
          {user ? (
            <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Avatar src={user.avatar} icon={<UserOutlined />} />
                <span style={{ color: 'white' }}>{user.username}</span>
              </div>
            </Dropdown>
          ) : (
            <Button 
              type="primary" 
              ghost 
              icon={<LoginOutlined />}
              onClick={() => setLoginVisible(true)}
            >
              登录
            </Button>
          )}
        </div>
      </Header>
      
      <Content style={{ padding: '24px', background: '#f0f2f5' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          
          {/* 标签页导航 */}
          <Tabs activeKey={activeTab} onChange={setActiveTab} style={{ marginBottom: '24px' }}>
            <TabPane 
              tab={<span><SearchOutlined />智能查询</span>} 
              key="query"
            >
              {/* 查询输入区域 */}
          <Card title="自然语言查询" style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <TextArea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="请用自然语言描述您的数据查询需求，例如：显示过去3个月各部门的销售业绩"
                autoSize={{ minRows: 2, maxRows: 4 }}
                style={{ flex: 1 }}
              />
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={handleQuery}
                loading={loading}
                size="large"
                style={{ height: 'auto' }}
              >
                查询
              </Button>
            </div>
          </Card>

          {/* 加载状态 */}
          {loading && (
            <Card style={{ textAlign: 'center', marginBottom: '24px' }}>
              <Spin size="large" />
              <div style={{ marginTop: '16px' }}>
                AI正在理解您的查询并生成结果...
              </div>
            </Card>
          )}

          {/* 查询结果区域 */}
          {result && (
            <>
              {/* SQL查询展示 */}
              <Card title="生成的SQL查询" style={{ marginBottom: '24px' }}>
                <pre style={{ 
                  background: '#f6f8fa', 
                  padding: '12px', 
                  borderRadius: '4px',
                  overflow: 'auto'
                }}>
                  {result.sql}
                </pre>
              </Card>

              {/* 数据结果展示 */}
              <Card title="查询结果" style={{ marginBottom: '24px' }}>
                <div style={{ overflow: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#fafafa' }}>
                        {result.data.length > 0 && Object.keys(result.data[0]).map(key => (
                          <th key={key} style={{ 
                            padding: '12px', 
                            border: '1px solid #d9d9d9',
                            textAlign: 'left'
                          }}>
                            {key}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.data.map((row, index) => (
                        <tr key={index}>
                          {Object.values(row).map((value, colIndex) => (
                            <td key={colIndex} style={{ 
                              padding: '12px', 
                              border: '1px solid #d9d9d9'
                            }}>
                              {String(value)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* 图表展示 */}
              {result.chartConfig && (
                <Card title="数据可视化">
                  <ReactECharts 
                    option={result.chartConfig} 
                    style={{ height: '400px' }}
                  />
                </Card>
              )}
            </>
          )}

              {/* 使用说明 */}
              {!result && !loading && (
                <Card title="使用说明" style={{ marginTop: '24px' }}>
                  <div>
                    <h4>支持的查询类型示例：</h4>
                    <ul>
                      <li>🔍 <strong>趋势分析</strong>: "显示过去3个月的销售趋势"</li>
                      <li>📊 <strong>对比分析</strong>: "各部门销售业绩对比"</li>
                      <li>🏆 <strong>排名查询</strong>: "销售额TOP10产品"</li>
                      <li>📈 <strong>统计查询</strong>: "平均客单价计算"</li>
                      <li>🎯 <strong>筛选查询</strong>: "北京地区客户数量"</li>
                    </ul>
                    <p style={{ marginTop: '16px', color: '#666' }}>
                      💡 提示：请用自然语言描述您的查询需求，AI会自动理解并生成相应的SQL查询和数据可视化
                    </p>
                  </div>
                </Card>
              )}
            </TabPane>
            
            <TabPane 
              tab={<span><HistoryOutlined />查询历史</span>} 
              key="history" 
              disabled={!user}
            >
              <Card title="查询历史">
                <Table
                  columns={historyColumns}
                  dataSource={queryHistory}
                  loading={historyLoading}
                  rowKey="id"
                  pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total) => `共 ${total} 条记录`
                  }}
                />
              </Card>
            </TabPane>
            
            <TabPane 
              tab={<span><DownloadOutlined />报告导出</span>} 
              key="export" 
              disabled={!user}
            >
              <Card title="报告导出">
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <Title level={4}>报告导出功能</Title>
                  <Text type="secondary">该功能正在开发中，敬请期待...</Text>
                </div>
              </Card>
            </TabPane>
          </Tabs>
        </div>
      </Content>
      
      {/* 登录模态框 */}
      <Modal
        title="用户登录"
        open={loginVisible}
        onCancel={() => setLoginVisible(false)}
        footer={null}
        width={400}
      >
        <Form
          form={loginForm}
          onFinish={handleLogin}
          layout="vertical"
          size="large"
        >
          <Form.Item
            label="用户名"
            name="username"
            rules={[
              { required: true, message: '请输入用户名' },
              { min: 3, message: '用户名至少3个字符' }
            ]}
          >
            <Input prefix={<UserOutlined />} placeholder="请输入用户名" />
          </Form.Item>
          
          <Form.Item
            label="密码"
            name="password"
            rules={[
              { required: true, message: '请输入密码' },
              { min: 6, message: '密码至少6个字符' }
            ]}
          >
            <Input.Password prefix={<UserOutlined />} placeholder="请输入密码" />
          </Form.Item>
          
          <Form.Item style={{ marginBottom: 0 }}>
            <Button type="primary" htmlType="submit" block>
              登录
            </Button>
          </Form.Item>
          
          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <Text type="secondary">演示账号: demo / 123456</Text>
          </div>
        </Form>
      </Modal>
    </Layout>
  );
}

export default App;
