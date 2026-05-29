import { useEffect, useState } from 'react';
import {
  Button, Card, Form, Input, Select, Space, Tag, Typography,
  Modal, Row, Col, Empty, Popconfirm, message,
} from 'antd';
import { PlusOutlined, DeleteOutlined, MinusCircleOutlined } from '@ant-design/icons';
import type { Template } from '../types';
import { TemplateVisibility } from '../types';
import * as templatesAPI from '../api/templates';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

export function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const data = await templatesAPI.getTemplates();
      setTemplates(data);
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  };

  const handleCreate = async (values: {
    name: string;
    description: string;
    visibility: TemplateVisibility;
    content: string;
    variables?: Array<{ name: string; default: string }>;
  }) => {
    try {
      await templatesAPI.createTemplate({ ...values, variables: values.variables ?? [] });
      message.success('模板创建成功');
      setShowForm(false);
      form.resetFields();
      loadTemplates();
    } catch (err) {
      message.error('创建失败');
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await templatesAPI.deleteTemplate(id);
      message.success('已删除');
      loadTemplates();
    } catch (err) {
      message.error('删除失败');
      console.error(err);
    }
  };

  return (
    <div style={{ padding: '32px 40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={4} style={{ margin: 0 }}>模板管理</Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowForm(true)}>
          创建模板
        </Button>
      </div>

      {templates.length === 0 ? (
        <Empty description="暂无模板，点击右上角创建" />
      ) : (
        <Row gutter={[16, 16]}>
          {templates.map((template) => (
            <Col key={template.id} xs={24} sm={12} lg={8}>
              <Card
                hoverable
                actions={[
                  <Popconfirm
                    key="delete"
                    title="确定删除此模板？"
                    onConfirm={() => handleDelete(template.id)}
                    okText="删除"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                  >
                    <Button type="text" danger icon={<DeleteOutlined />}>删除</Button>
                  </Popconfirm>,
                ]}
              >
                <div style={{ marginBottom: 8 }}>
                  <Text strong style={{ fontSize: 15 }}>{template.name}</Text>
                  <Tag
                    color={template.visibility === TemplateVisibility.PUBLIC ? 'blue' : 'default'}
                    style={{ marginLeft: 8 }}
                  >
                    {template.visibility === TemplateVisibility.PUBLIC ? '公开' : '私有'}
                  </Tag>
                </div>
                <Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ marginBottom: 8 }}>
                  {template.description}
                </Paragraph>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  版本 {template.latestVersion?.version ?? 0}
                </Text>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Modal
        title="创建模板"
        open={showForm}
        onCancel={() => { setShowForm(false); form.resetFields(); }}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} style={{ marginTop: 16 }}>
          <Form.Item label="名称" name="name" rules={[{ required: true, message: '请输入模板名称' }]}>
            <Input placeholder="模板名称" />
          </Form.Item>
          <Form.Item label="描述" name="description" rules={[{ required: true, message: '请输入描述' }]}>
            <TextArea rows={2} placeholder="模板描述" />
          </Form.Item>
          <Form.Item label="可见性" name="visibility" initialValue={TemplateVisibility.PRIVATE}>
            <Select>
              <Select.Option value={TemplateVisibility.PRIVATE}>私有</Select.Option>
              <Select.Option value={TemplateVisibility.PUBLIC}>公开</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            label="内容（使用 {{变量名}} 作为占位符）"
            name="content"
            rules={[{ required: true, message: '请输入模板内容' }]}
          >
            <TextArea rows={4} placeholder="例如：请帮我写一篇关于 {{topic}} 的文章" />
          </Form.Item>

          <Form.List name="variables">
            {(fields, { add, remove }) => (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text>变量</Text>
                  <Button type="dashed" size="small" icon={<PlusOutlined />} onClick={() => add({ name: '', default: '' })}>
                    添加变量
                  </Button>
                </div>
                {fields.map(({ key, name }) => (
                  <Space key={key} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
                    <Form.Item name={[name, 'name']} rules={[{ required: true, message: '变量名' }]} style={{ marginBottom: 0 }}>
                      <Input placeholder="变量名" style={{ width: 160 }} />
                    </Form.Item>
                    <Form.Item name={[name, 'default']} style={{ marginBottom: 0 }}>
                      <Input placeholder="默认值（可选）" style={{ width: 160 }} />
                    </Form.Item>
                    <MinusCircleOutlined onClick={() => remove(name)} style={{ color: '#ff4d4f' }} />
                  </Space>
                ))}
              </>
            )}
          </Form.List>

          <Form.Item style={{ marginTop: 16, marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setShowForm(false); form.resetFields(); }}>取消</Button>
              <Button type="primary" htmlType="submit">创建</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

