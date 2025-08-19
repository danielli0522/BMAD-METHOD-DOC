import React, { useState, useEffect } from 'react';
import { Layout, Menu, Breadcrumb, Avatar, Dropdown, Space, Badge, notification } from 'antd';
import {
  DashboardOutlined,
  DatabaseOutlined,
  UserOutlined,
  SettingOutlined,
  MonitorOutlined,
  LogoutOutlined,
  BellOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';

const { Header, Sider, Content } = Layout;

interface ManagementLayoutProps {
  children: React.ReactNode;
}

interface MenuItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  path: string;
  children?: MenuItem[];
}

const ManagementLayout: React.FC<ManagementLayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [breadcrumbItems, setBreadcrumbItems] = useState<string[]>([]);
  const navigate = useNavigate();
  const location = useLocation();

  // 管理菜单配置
  const menuItems: MenuItem[] = [
    {
      key: 'dashboard',
      icon: <DashboardOutlined />,
      label: '仪表板',
      path: '/management/dashboard',
    },
    {
      key: 'datasources',
      icon: <DatabaseOutlined />,
      label: '数据源管理',
      path: '/management/datasources',
    },
    {
      key: 'users',
      icon: <UserOutlined />,
      label: '用户管理',
      path: '/management/users',
    },
    {
      key: 'system',
      icon: <SettingOutlined />,
      label: '系统配置',
      path: '/management/system',
    },
    {
      key: 'monitoring',
      icon: <MonitorOutlined />,
      label: '监控日志',
      path: '/management/monitoring',
    },
  ];

  // 根据当前路径设置选中的菜单项
  useEffect(() => {
    const currentPath = location.pathname;
    const currentMenuItem = menuItems.find(item => item.path === currentPath);

    if (currentMenuItem) {
      setSelectedKeys([currentMenuItem.key]);
      setBreadcrumbItems([currentMenuItem.label]);
    }
  }, [location.pathname]);

  // 菜单点击处理
  const handleMenuClick = ({ key }: { key: string }) => {
    const menuItem = menuItems.find(item => item.key === key);
    if (menuItem) {
      navigate(menuItem.path);
    }
  };

  // 用户下拉菜单
  const userMenuItems = [
    {
      key: 'profile',
      label: '个人资料',
      icon: <UserOutlined />,
    },
    {
      key: 'settings',
      label: '设置',
      icon: <SettingOutlined />,
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      label: '退出登录',
      icon: <LogoutOutlined />,
      onClick: () => {
        // TODO: 实现退出登录逻辑
        notification.success({
          message: '退出成功',
          description: '您已成功退出系统',
        });
        navigate('/login');
      },
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={collapsed} theme='dark' width={250}>
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '1px solid #303030',
          }}
        >
          <h2
            style={{
              color: 'white',
              margin: 0,
              fontSize: collapsed ? 16 : 20,
              fontWeight: 'bold',
            }}
          >
            {collapsed ? 'AI-DAP' : 'AI-Agile-DAP'}
          </h2>
        </div>

        <Menu
          theme='dark'
          mode='inline'
          selectedKeys={selectedKeys}
          items={menuItems.map(item => ({
            key: item.key,
            icon: item.icon,
            label: item.label,
          }))}
          onClick={handleMenuClick}
          style={{ borderRight: 0 }}
        />
      </Sider>

      <Layout>
        <Header
          style={{
            padding: '0 24px',
            background: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <Space>
            {React.createElement(collapsed ? MenuUnfoldOutlined : MenuFoldOutlined, {
              className: 'trigger',
              onClick: () => setCollapsed(!collapsed),
              style: { fontSize: 18 },
            })}

            <Breadcrumb style={{ margin: '0 16px' }}>
              <Breadcrumb.Item>管理后台</Breadcrumb.Item>
              {breadcrumbItems.map((item, index) => (
                <Breadcrumb.Item key={index}>{item}</Breadcrumb.Item>
              ))}
            </Breadcrumb>
          </Space>

          <Space size='large'>
            <Badge count={5} size='small'>
              <BellOutlined style={{ fontSize: 18, cursor: 'pointer' }} />
            </Badge>

            <Dropdown menu={{ items: userMenuItems }} placement='bottomRight' arrow>
              <Space style={{ cursor: 'pointer' }}>
                <Avatar
                  size='small'
                  icon={<UserOutlined />}
                  style={{ backgroundColor: '#1890ff' }}
                />
                <span>管理员</span>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content
          style={{
            margin: '24px',
            padding: '24px',
            background: '#fff',
            borderRadius: 6,
            minHeight: 280,
            overflow: 'auto',
          }}
        >
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default ManagementLayout;
