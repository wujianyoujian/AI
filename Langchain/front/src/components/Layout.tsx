import { Outlet } from 'react-router-dom';
import { Layout as AntLayout, Button } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import { Sidebar } from './Sidebar';
import { useAuth } from '../contexts/AuthContext';
import { ConversationsProvider } from '../contexts/ConversationsContext';

const { Header, Content } = AntLayout;

export function Layout() {
  const { logout } = useAuth();

  return (
    <ConversationsProvider>
      <AntLayout style={{ height: '100vh' }}>
        <Sidebar />
        <AntLayout>
          <Header style={{ background: '#fff', padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', borderBottom: '1px solid #f0f0f0' }}>
            <Button icon={<LogoutOutlined />} onClick={logout}>退出登录</Button>
          </Header>
          <Content style={{ overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
            <Outlet />
          </Content>
        </AntLayout>
      </AntLayout>
    </ConversationsProvider>
  );
}
