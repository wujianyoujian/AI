import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Conversation } from '../types';
import * as conversationsAPI from '../api/conversations';

export function Sidebar() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const data = await conversationsAPI.getConversations();
      setConversations(data);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  const handleNewChat = async () => {
    try {
      const conversation = await conversationsAPI.createConversation('新对话');
      setConversations([conversation, ...conversations]);
      navigate(`/chat/${conversation.id}`);
    } catch (err) {
      console.error('Failed to create conversation:', err);
    }
  };

  return (
    <nav style={{ width: '250px', borderRight: '1px solid #ccc', padding: '20px', display: 'flex', flexDirection: 'column' }}>
      <button onClick={handleNewChat} style={{ width: '100%', padding: '10px', marginBottom: '20px' }}>
        新建对话
      </button>
      <Link to="/templates" style={{ display: 'block', marginBottom: '20px' }}>
        模板管理
      </Link>
      <h3>对话列表</h3>
      <ul style={{ listStyle: 'none', padding: 0, overflowY: 'auto', flex: 1 }}>
        {conversations.map((conv) => (
          <li key={conv.id} style={{ marginBottom: '10px' }}>
            <Link to={`/chat/${conv.id}`}>{conv.title}</Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
