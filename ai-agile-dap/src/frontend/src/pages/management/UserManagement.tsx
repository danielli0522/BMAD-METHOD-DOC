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
  Transfer,
  Drawer,
  Tabs,
  Badge,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  KeyOutlined,
  UserOutlined,
  TeamOutlined,
  LockOutlined,
  UnlockOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import ManagementLayout from '../../components/management/Layout/ManagementLayout';

const { Option } = Select;
const { TabPane } = Tabs;

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  status: 'active' | 'inactive' | 'locked';
  lastLoginTime?: string;
  createdAt: string;
  updatedAt: string;
  permissions: string[];
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
}

interface Permission {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
}

interface UserFormData {
  username: string;
  email: string;
  password?: string;
  role: string;
  status: 'active' | 'inactive';
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [permissionDrawerVisible, setPermissionDrawerVisible] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [form] = Form.useForm();

  // 模拟数据
  const mockUsers: User[] = [
    {
      id: '1',
      username: 'admin',
      email: 'admin@example.com',
      role: 'super_admin',
      status: 'active',
      lastLoginTime: '2024-01-15 10:30:00',
      createdAt: '2024-01-01 00:00:00',
      updatedAt: '2024-01-15 10:30:00',
      permissions: ['user:read', 'user:write', 'user:delete', 'system:config'],
    },
    {
      id: '2',
      username: 'analyst',
      email: 'analyst@example.com',
      role: 'analyst',
      status: 'active',
      lastLoginTime: '2024-01-15 09:15:00',
      createdAt: '2024-01-05 00:00:00',
      updatedAt: '2024-01-15 09:15:00',
      permissions: ['data:read', 'report:create'],
    },
    {
      id: '3',
      username: 'viewer',
      email: 'viewer@example.com',
      role: 'viewer',
      status: 'inactive',
      lastLoginTime: '2024-01-14 16:45:00',
      createdAt: '2024-01-10 00:00:00',
      updatedAt: '2024-01-14 16:45:00',
      permissions: ['data:read'],
    },
  ];

  const mockRoles: Role[] = [
    {
      id: 'super_admin',
      name: '超级管理员',
      description: '拥有所有权限',
      permissions: ['*'],
    },
    {
      id: 'admin',
      name: '管理员',
      description: '拥有大部分管理权限',
      permissions: ['user:read', 'user:write', 'system:config'],
    },
    {
      id: 'analyst',
      name: '数据分析师',
      description: '可以创建和分析报表',
      permissions: ['data:read', 'report:create', 'report:edit'],
    },
    {
      id: 'viewer',
      name: '查看者',
      description: '只能查看数据',
      permissions: ['data:read'],
    },
  ];

  const mockPermissions: Permission[] = [
    {
      id: 'user:read',
      name: '查看用户',
      description: '查看用户列表和详情',
      resource: 'user',
      action: 'read',
    },
    {
      id: 'user:write',
      name: '管理用户',
      description: '创建、编辑用户',
      resource: 'user',
      action: 'write',
    },
    {
      id: 'user:delete',
      name: '删除用户',
      description: '删除用户',
      resource: 'user',
      action: 'delete',
    },
    {
      id: 'data:read',
      name: '查看数据',
      description: '查看数据源和数据',
      resource: 'data',
      action: 'read',
    },
    {
      id: 'data:write',
      name: '管理数据',
      description: '创建、编辑数据源',
      resource: 'data',
      action: 'write',
    },
    {
      id: 'report:create',
      name: '创建报表',
      description: '创建新的报表',
      resource: 'report',
      action: 'create',
    },
    {
      id: 'report:edit',
      name: '编辑报表',
      description: '编辑现有报表',
      resource: 'report',
      action: 'edit',
    },
    {
      id: 'system:config',
      name: '系统配置',
      description: '管理系统配置',
      resource: 'system',
      action: 'config',
    },
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // TODO: 调用API获取数据
      await new Promise(resolve => setTimeout(resolve, 1000));
      setUsers(mockUsers);
      setRoles(mockRoles);
      setPermissions(mockPermissions);
    } catch (error) {
      notification.error({
        message: '加载失败',
        description: '无法加载用户数据',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setEditingUser(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: User) => {
    setEditingUser(record);
    form.setFieldsValue({
      username: record.username,
      email: record.email,
      role: record.role,
      status: record.status,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      // TODO: 调用API删除用户
      await new Promise(resolve => setTimeout(resolve, 500));
      setUsers(prev => prev.filter(item => item.id !== id));
      notification.success({
        message: '删除成功',
        description: '用户已成功删除',
      });
    } catch (error) {
      notification.error({
        message: '删除失败',
        description: '无法删除用户',
      });
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      // TODO: 调用API更新用户状态
      await new Promise(resolve => setTimeout(resolve, 500));
      setUsers(prev =>
        prev.map(item =>
          item.id === id ? { ...item, status: newStatus as 'active' | 'inactive' } : item
        )
      );
      notification.success({
        message: '状态更新成功',
        description: `用户状态已更新为${newStatus === 'active' ? '激活' : '停用'}`,
      });
    } catch (error) {
      notification.error({
        message: '状态更新失败',
        description: '无法更新用户状态',
      });
    }
  };

  const handleManagePermissions = (user: User) => {
    setSelectedUser(user);
    setPermissionDrawerVisible(true);
  };

  const handlePermissionChange = async (targetKeys: string[]) => {
    if (!selectedUser) return;

    try {
      // TODO: 调用API更新用户权限
      await new Promise(resolve => setTimeout(resolve, 500));
      setUsers(prev =>
        prev.map(item =>
          item.id === selectedUser.id ? { ...item, permissions: targetKeys } : item
        )
      );
      notification.success({
        message: '权限更新成功',
        description: '用户权限已成功更新',
      });
    } catch (error) {
      notification.error({
        message: '权限更新失败',
        description: '无法更新用户权限',
      });
    }
  };

  const handleSubmit = async (values: UserFormData) => {
    try {
      if (editingUser) {
        // TODO: 调用API更新用户
        await new Promise(resolve => setTimeout(resolve, 500));
        setUsers(prev =>
          prev.map(item =>
            item.id === editingUser.id
              ? { ...item, ...values, updatedAt: new Date().toISOString() }
              : item
          )
        );
        notification.success({
          message: '更新成功',
          description: '用户已成功更新',
        });
      } else {
        // TODO: 调用API创建用户
        await new Promise(resolve => setTimeout(resolve, 500));
        const newUser: User = {
          id: Date.now().toString(),
          ...values,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          permissions: [],
        };
        setUsers(prev => [...prev, newUser]);
        notification.success({
          message: '创建成功',
          description: '用户已成功创建',
        });
      }
      setModalVisible(false);
    } catch (error) {
      notification.error({
        message: '操作失败',
        description: '无法保存用户',
      });
    }
  };

  const getStatusTag = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <Tag color='green' icon={<CheckCircleOutlined />}>
            激活
          </Tag>
        );
      case 'inactive':
        return (
          <Tag color='orange' icon={<CloseCircleOutlined />}>
            停用
          </Tag>
        );
      case 'locked':
        return (
          <Tag color='red' icon={<LockOutlined />}>
            锁定
          </Tag>
        );
      default:
        return <Tag>未知</Tag>;
    }
  };

  const getRoleTag = (roleId: string) => {
    const role = roles.find(r => r.id === roleId);
    if (!role) return <Tag>未知角色</Tag>;

    const colorMap = {
      super_admin: 'red',
      admin: 'blue',
      analyst: 'green',
      viewer: 'orange',
    };

    return <Tag color={colorMap[roleId as keyof typeof colorMap]}>{role.name}</Tag>;
  };

  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      render: (text: string) => (
        <Space>
          <UserOutlined />
          <span>{text}</span>
        </Space>
      ),
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (roleId: string) => getRoleTag(roleId),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '最后登录',
      dataIndex: 'lastLoginTime',
      key: 'lastLoginTime',
      render: (text: string) => text || '-',
    },
    {
      title: '操作',
      key: 'action',
      render: (record: User) => (
        <Space size='middle'>
          <Tooltip title='查看详情'>
            <Button type='text' icon={<EyeOutlined />} />
          </Tooltip>
          <Tooltip title='管理权限'>
            <Button
              type='text'
              icon={<KeyOutlined />}
              onClick={() => handleManagePermissions(record)}
            />
          </Tooltip>
          <Tooltip title='编辑'>
            <Button type='text' icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          <Tooltip title={record.status === 'active' ? '停用' : '激活'}>
            <Button
              type='text'
              icon={record.status === 'active' ? <LockOutlined /> : <UnlockOutlined />}
              onClick={() => handleToggleStatus(record.id, record.status)}
            />
          </Tooltip>
          <Popconfirm
            title='确定要删除这个用户吗？'
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
    total: users.length,
    active: users.filter(user => user.status === 'active').length,
    inactive: users.filter(user => user.status === 'inactive').length,
    locked: users.filter(user => user.status === 'locked').length,
  };

  return (
    <ManagementLayout>
      <div>
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic title='总用户数' value={stats.total} prefix={<TeamOutlined />} />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title='激活用户'
                value={stats.active}
                valueStyle={{ color: '#3f8600' }}
                prefix={<CheckCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title='停用用户'
                value={stats.inactive}
                valueStyle={{ color: '#faad14' }}
                prefix={<CloseCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title='锁定用户'
                value={stats.locked}
                valueStyle={{ color: '#cf1322' }}
                prefix={<LockOutlined />}
              />
            </Card>
          </Col>
        </Row>

        <Card
          title='用户管理'
          extra={
            <Button type='primary' icon={<PlusOutlined />} onClick={handleAdd}>
              添加用户
            </Button>
          }
        >
          <Table
            columns={columns}
            dataSource={users}
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
          title={editingUser ? '编辑用户' : '添加用户'}
          open={modalVisible}
          onCancel={() => setModalVisible(false)}
          footer={null}
          width={600}
        >
          <Form form={form} layout='vertical' onFinish={handleSubmit}>
            <Form.Item
              name='username'
              label='用户名'
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input placeholder='请输入用户名' />
            </Form.Item>

            <Form.Item
              name='email'
              label='邮箱'
              rules={[
                { required: true, message: '请输入邮箱' },
                { type: 'email', message: '请输入有效的邮箱地址' },
              ]}
            >
              <Input placeholder='请输入邮箱' />
            </Form.Item>

            {!editingUser && (
              <Form.Item
                name='password'
                label='密码'
                rules={[{ required: true, message: '请输入密码' }]}
              >
                <Input.Password placeholder='请输入密码' />
              </Form.Item>
            )}

            <Form.Item name='role' label='角色' rules={[{ required: true, message: '请选择角色' }]}>
              <Select placeholder='请选择角色'>
                {roles.map(role => (
                  <Option key={role.id} value={role.id}>
                    {role.name} - {role.description}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name='status'
              label='状态'
              rules={[{ required: true, message: '请选择状态' }]}
            >
              <Select placeholder='请选择状态'>
                <Option value='active'>激活</Option>
                <Option value='inactive'>停用</Option>
              </Select>
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={() => setModalVisible(false)}>取消</Button>
                <Button type='primary' htmlType='submit'>
                  {editingUser ? '更新' : '创建'}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </Modal>

        <Drawer
          title={`管理权限 - ${selectedUser?.username}`}
          placement='right'
          width={600}
          open={permissionDrawerVisible}
          onClose={() => setPermissionDrawerVisible(false)}
        >
          {selectedUser && (
            <Tabs defaultActiveKey='permissions'>
              <TabPane tab='权限分配' key='permissions'>
                <Transfer
                  dataSource={permissions.map(p => ({
                    key: p.id,
                    title: p.name,
                    description: p.description,
                  }))}
                  titles={['可用权限', '已分配权限']}
                  targetKeys={selectedUser.permissions}
                  onChange={handlePermissionChange}
                  render={item => item.title}
                  showSearch
                  filterOption={(inputValue, item) =>
                    item.title.indexOf(inputValue) !== -1 ||
                    item.description.indexOf(inputValue) !== -1
                  }
                />
              </TabPane>
              <TabPane tab='角色信息' key='role'>
                <Card size='small'>
                  <p>
                    <strong>当前角色：</strong>
                    {getRoleTag(selectedUser.role)}
                  </p>
                  <p>
                    <strong>角色描述：</strong>
                    {roles.find(r => r.id === selectedUser.role)?.description}
                  </p>
                </Card>
              </TabPane>
            </Tabs>
          )}
        </Drawer>
      </div>
    </ManagementLayout>
  );
};

export default UserManagement;
