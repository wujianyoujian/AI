import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Layout, Button, Menu, Typography, Popconfirm } from 'antd';
import { PlusOutlined, MessageOutlined, 
  // AppstoreOutlined,
   DeleteOutlined } from '@ant-design/icons';
import { useConversations } from '../contexts/ConversationsContext';
import * as conversationsAPI from '../api/conversations';

const { Sider } = Layout;
const { Text } = Typography;

export function Sidebar() {
  const { conversations, loadConversations } = useConversations();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [confirmOpenId, setConfirmOpenId] = useState<string | null>(null);

  useEffect(() => {
    loadConversations();
  }, [id]);

  const handleNewChat = () => {
    navigate('/chat');
  };

  const handleDelete = async (convId: string) => {
    await conversationsAPI.deleteConversation(convId);
    setConfirmOpenId(null);
    await loadConversations();
    if (convId === id) navigate('/chat');
  };

  const menuItems = [
    // {
    //   key: 'templates',
    //   icon: <AppstoreOutlined />,
    //   label: <Link to="/templates">模板管理</Link>,
    // },
    { type: 'divider' as const },
    ...conversations.map((conv) => ({
      key: conv.id,
      icon: <MessageOutlined />,
      label: (
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          onMouseEnter={() => setHoveredId(conv.id)}
          onMouseLeave={() => setHoveredId(null)}
        >
          <Link to={`/chat/${conv.id}`} style={{ flex: 1, minWidth: 0 }}>
            <div style={{ lineHeight: '1.3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{conv.title}</div>
            <div style={{ fontSize: 11, color: '#aaa', lineHeight: '1.3' }}>
              {new Date(conv.createdAt).toLocaleString('zh-CN', {
                month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit', hour12: false,
              })}
            </div>
          </Link>
          {(hoveredId === conv.id || confirmOpenId === conv.id) && (
            <Popconfirm
              title="删除对话"
              description="删除后不可恢复，确定吗？"
              open={confirmOpenId === conv.id}
              onOpenChange={(open) => setConfirmOpenId(open ? conv.id : null)}
              onConfirm={() => handleDelete(conv.id)}
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                danger
                onClick={(e) => e.stopPropagation()}
                style={{ flexShrink: 0 }}
              />
            </Popconfirm>
          )}
        </div>
      ),
    })),
  ];

  return (
    <Sider width={240} style={{ background: '#fff', borderRight: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
        <Text strong style={{ fontSize: 16 }}>AI Chat</Text>
      </div>
      <div style={{ padding: '12px 16px' }}>
        <Button type="primary" icon={<PlusOutlined />} block onClick={handleNewChat}>
          新建对话
        </Button>
      </div>
      <Menu
        mode="inline"
        selectedKeys={id ? [id] : []}
        style={{ border: 'none', flex: 1, overflow: 'auto' }}
        items={menuItems}
      />
    </Sider>
  );
}
