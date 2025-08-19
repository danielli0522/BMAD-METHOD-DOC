import React, { useState, useEffect } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Tag,
  Tooltip,
  Popconfirm,
  notification,
  Card,
  Row,
  Col,
  Statistic,
  Progress,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import ManagementLayout from '../../components/management/Layout/ManagementLayout';

const { Option } = Select;

interface DataSource {
  id: string;
  name: string;
  type: 'mysql' | 'postgresql' | 'csv' | 'excel';
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  filePath?: string;
  status: 'connected' | 'disconnected' | 'error';
  lastSyncTime?: string;
  createdAt: string;
  updatedAt: string;
}

interface DataSourceFormData {
  name: string;
  type: 'mysql' | 'postgresql' | 'csv' | 'excel';
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  filePath?: string;
}

const DataSourceManagement: React.FC = () => {
  const [dataSources, setDataSources] = useState<DataSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingDataSource, setEditingDataSource] = useState<DataSource | null>(null);
  const [form] = Form.useForm();
  const [testLoading, setTestLoading] = useState(false);

  // 模拟数据源数据
  const mockDataSources: DataSource[] = [
    {
      id: '1',
      name: '生产数据库',
      type: 'mysql',
      host: '192.168.1.100',
      port: 3306,
      database: 'production_db',
      username: 'admin',
      status: 'connected',
      lastSyncTime: '2024-01-15 10:30:00',
      createdAt: '2024-01-01 00:00:00',
      updatedAt: '2024-01-15 10:30:00',
    },
    {
      id: '2',
      name: '销售数据CSV',
      type: 'csv',
      filePath: '/data/sales.csv',
      status: 'connected',
      lastSyncTime: '2024-01-15 09:15:00',
      createdAt: '2024-01-05 00:00:00',
      updatedAt: '2024-01-15 09:15:00',
    },
    {
      id: '3',
      name: '测试数据库',
      type: 'postgresql',
      host: '192.168.1.101',
      port: 5432,
      database: 'test_db',
      username: 'test_user',
      status: 'error',
      lastSyncTime: '2024-01-14 16:45:00',
      createdAt: '2024-01-10 00:00:00',
      updatedAt: '2024-01-14 16:45:00',
    },
  ];

  useEffect(() => {
    loadDataSources();
  }, []);

  const loadDataSources = async () => {
    setLoading(true);
    try {
      // TODO: 调用API获取数据源列表
      await new Promise(resolve => setTimeout(resolve, 1000));
      setDataSources(mockDataSources);
    } catch (error) {
      notification.error({
        message: '加载失败',
        description: '无法加载数据源列表',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingDataSource(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: DataSource) => {
    setEditingDataSource(record);
    form.setFieldsValue({
      name: record.name,
      type: record.type,
      host: record.host,
      port: record.port,
      database: record.database,
      username: record.username,
      filePath: record.filePath,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      // TODO: 调用API删除数据源
      await new Promise(resolve => setTimeout(resolve, 500));
      setDataSources(prev => prev.filter(item => item.id !== id));
      notification.success({
        message: '删除成功',
        description: '数据源已成功删除',
      });
    } catch (error) {
      notification.error({
        message: '删除失败',
        description: '无法删除数据源',
      });
    }
  };

  const handleTestConnection = async (record: DataSource) => {
    setTestLoading(true);
    try {
      // TODO: 调用API测试连接
      await new Promise(resolve => setTimeout(resolve, 2000));
      notification.success({
        message: '连接成功',
        description: `${record.name} 连接测试通过`,
      });
    } catch (error) {
      notification.error({
        message: '连接失败',
        description: `${record.name} 连接测试失败`,
      });
    } finally {
      setTestLoading(false);
    }
  };

  const handleSubmit = async (values: DataSourceFormData) => {
    try {
      if (editingDataSource) {
        // TODO: 调用API更新数据源
        await new Promise(resolve => setTimeout(resolve, 500));
        setDataSources(prev =>
          prev.map(item =>
            item.id === editingDataSource.id
              ? { ...item, ...values, updatedAt: new Date().toISOString() }
              : item
          )
        );
        notification.success({
          message: '更新成功',
          description: '数据源已成功更新',
        });
      } else {
        // TODO: 调用API创建数据源
        await new Promise(resolve => setTimeout(resolve, 500));
        const newDataSource: DataSource = {
          id: Date.now().toString(),
          ...values,
          status: 'disconnected',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        setDataSources(prev => [...prev, newDataSource]);
        notification.success({
          message: '创建成功',
          description: '数据源已成功创建',
        });
      }
      setModalVisible(false);
    } catch (error) {
      notification.error({
        message: '操作失败',
        description: '无法保存数据源',
      });
    }
  };

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'connected':
        return (
          <Tag color='green' icon={<CheckCircleOutlined />}>
            已连接
          </Tag>
        );
      case 'disconnected':
        return (
          <Tag color='orange' icon={<ExclamationCircleOutlined />}>
            未连接
          </Tag>
        );
      case 'error':
        return (
          <Tag color='red' icon={<CloseCircleOutlined />}>
            连接错误
          </Tag>
        );
      default:
        return <Tag>未知</Tag>;
    }
  };

  const getTypeTag = (type: string) => {
    const typeMap = {
      mysql: { color: 'blue', label: 'MySQL' },
      postgresql: { color: 'cyan', label: 'PostgreSQL' },
      csv: { color: 'green', label: 'CSV' },
      excel: { color: 'purple', label: 'Excel' },
    };
    const config = typeMap[type as keyof typeof typeMap];
    return <Tag color={config.color}>{config.label}</Tag>;
  };

  const columns = [
    {
      title: '数据源名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: DataSource) => (
        <Space>
          <span>{text}</span>
          {getTypeTag(record.type)}
        </Space>
      ),
    },
    {
      title: '连接信息',
      key: 'connection',
      render: (record: DataSource) => {
        if (record.type === 'mysql' || record.type === 'postgresql') {
          return `${record.host}:${record.port}/${record.database}`;
        } else {
          return record.filePath;
        }
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '最后同步',
      dataIndex: 'lastSyncTime',
      key: 'lastSyncTime',
      render: (text: string) => text || '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (record: DataSource) => (
        <Space size='middle'>
          <Tooltip title='查看详情'>
            <Button type='text' icon={<EyeOutlined />} />
          </Tooltip>
          <Tooltip title='测试连接'>
            <Button
              type='text'
              icon={<ReloadOutlined />}
              loading={testLoading}
              onClick={() => handleTestConnection(record)}
            />
          </Tooltip>
          <Tooltip title='编辑'>
            <Button type='text' icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Popconfirm
            title='确定要删除这个数据源吗？'
            description='删除后无法恢复，请谨慎操作。'
            onConfirm={() => handleDelete(record.id)}
            okText='确定'
            cancelText='取消'
          >
            <Tooltip title='删除'>
              <Button type='text' danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 统计数据
  const stats = {
    total: dataSources.length,
    connected: dataSources.filter(ds => ds.status === 'connected').length,
    disconnected: dataSources.filter(ds => ds.status === 'disconnected').length,
    error: dataSources.filter(ds => ds.status === 'error').length,
  };

  return (
    <ManagementLayout>
      <div>
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic title='总数据源' value={stats.total} prefix={<DatabaseOutlined />} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title='已连接'
                value={stats.connected}
                valueStyle={{ color: '#3f8600' }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title='未连接'
                value={stats.disconnected}
                valueStyle={{ color: '#faad14' }}
                prefix={<ExclamationCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title='连接错误'
                value={stats.error}
                valueStyle={{ color: '#cf1322' }}
                prefix={<CloseCircleOutlined />}
              />
            </Card>
          </Col>
        </Row>

        <Card
          title='数据源管理'
          extra={
            <Button type='primary' icon={<PlusOutlined />} onClick={handleAdd}>
              添加数据源
            </Button>
          }
        >
          <Table
            columns={columns}
            dataSource={dataSources}
            rowKey='id'
            loading={loading}
            pagination={{
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            }}
          />
        </Card>

        <Modal
          title={editingDataSource ? '编辑数据源' : '添加数据源'}
          open={modalVisible}
          onCancel={() => setModalVisible(false)}
          footer={null}
          width={600}
        >
          <Form
            form={form}
            layout='vertical'
            onFinish={handleSubmit}
            initialValues={{ type: 'mysql' }}
          >
            <Form.Item
              name='name'
              label='数据源名称'
              rules={[{ required: true, message: '请输入数据源名称' }]}
            >
              <Input placeholder='请输入数据源名称' />
            </Form.Item>

            <Form.Item
              name='type'
              label='数据源类型'
              rules={[{ required: true, message: '请选择数据源类型' }]}
            >
              <Select placeholder='请选择数据源类型'>
                <Option value='mysql'>MySQL</Option>
                <Option value='postgresql'>PostgreSQL</Option>
                <Option value='csv'>CSV文件</Option>
                <Option value='excel'>Excel文件</Option>
              </Select>
            </Form.Item>

            <Form.Item noStyle shouldUpdate>
              {({ getFieldValue }) => {
                const type = getFieldValue('type');
                if (type === 'mysql' || type === 'postgresql') {
                  return (
                    <>
                      <Form.Item
                        name='host'
                        label='主机地址'
                        rules={[{ required: true, message: '请输入主机地址' }]}
                      >
                        <Input placeholder='请输入主机地址' />
                      </Form.Item>

                      <Form.Item
                        name='port'
                        label='端口'
                        rules={[{ required: true, message: '请输入端口' }]}
                      >
                        <Input type='number' placeholder='请输入端口' />
                      </Form.Item>

                      <Form.Item
                        name='database'
                        label='数据库名'
                        rules={[{ required: true, message: '请输入数据库名' }]}
                      >
                        <Input placeholder='请输入数据库名' />
                      </Form.Item>

                      <Form.Item
                        name='username'
                        label='用户名'
                        rules={[{ required: true, message: '请输入用户名' }]}
                      >
                        <Input placeholder='请输入用户名' />
                      </Form.Item>

                      <Form.Item
                        name='password'
                        label='密码'
                        rules={[{ required: true, message: '请输入密码' }]}
                      >
                        <Input.Password placeholder='请输入密码' />
                      </Form.Item>
                    </>
                  );
                } else {
                  return (
                    <Form.Item
                      name='filePath'
                      label='文件路径'
                      rules={[{ required: true, message: '请输入文件路径' }]}
                    >
                      <Input placeholder='请输入文件路径' />
                    </Form.Item>
                  );
                }
              }}
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setModalVisible(false)}>取消</Button>
                <Button type='primary' htmlType='submit'>
                  {editingDataSource ? '更新' : '创建'}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </ManagementLayout>
  );
};

export default DataSourceManagement;
