import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Form, Input, Button, Card, Typography, Alert } from 'antd';
import { useAuth } from '../contexts/AuthContext';

const { Title, Text } = Typography;

export function RegisterPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (values: { email: string; password: string }) => {
    setError('');
    setLoading(true);
    try {
      await register(values.email, values.password);
      navigate('/chat');
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
      <Card style={{ width: 400 }}>
        <Title level={3} style={{ textAlign: 'center', marginBottom: 24 }}>注册</Title>
        {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}
        <Form layout="vertical" onFinish={handleSubmit} autoComplete="off">
          <Form.Item label="邮箱" name="email" rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}>
            <Input placeholder="your@email.com" size="large" />
          </Form.Item>
          <Form.Item label="密码" name="password" rules={[{ required: true, min: 6, message: '密码至少6位' }]}>
            <Input.Password placeholder="••••••••" size="large" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 8 }}>
            <Button type="primary" htmlType="submit" block size="large" loading={loading}>
              注册
            </Button>
          </Form.Item>
        </Form>
        <Text type="secondary" style={{ display: 'block', textAlign: 'center' }}>
          已有账号? <Link to="/login">登录</Link>
        </Text>
      </Card>
    </div>
  );
}
