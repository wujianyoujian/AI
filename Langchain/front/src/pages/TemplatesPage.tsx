import { useEffect, useState } from 'react';
import type { Template } from '../types';
import { TemplateVisibility } from '../types';
import * as templatesAPI from '../api/templates';

export function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    visibility: TemplateVisibility;
    content: string;
    variables: Array<{ name: string; default: string }>;
  }>({
    name: '',
    description: '',
    visibility: TemplateVisibility.PRIVATE,
    content: '',
    variables: [],
  });

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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await templatesAPI.createTemplate(formData);
      setShowForm(false);
      setFormData({ name: '', description: '', visibility: TemplateVisibility.PRIVATE, content: '', variables: [] });
      loadTemplates();
    } catch (err) {
      console.error('Failed to create template:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此模板？')) return;
    try {
      await templatesAPI.deleteTemplate(id);
      loadTemplates();
    } catch (err) {
      console.error('Failed to delete template:', err);
    }
  };

  const addVariable = () => {
    setFormData({ ...formData, variables: [...formData.variables, { name: '', default: '' }] });
  };

  const updateVariable = (index: number, field: 'name' | 'default', value: string) => {
    const newVariables = [...formData.variables];
    newVariables[index] = { ...newVariables[index], [field]: value };
    setFormData({ ...formData, variables: newVariables });
  };

  const removeVariable = (index: number) => {
    setFormData({ ...formData, variables: formData.variables.filter((_, i) => i !== index) });
  };

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1>模板管理</h1>
        <button onClick={() => setShowForm(!showForm)} style={{ padding: '10px 20px' }}>
          {showForm ? '取消' : '创建模板'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={{ marginBottom: '30px', padding: '20px', border: '1px solid #ccc' }}>
          <div style={{ marginBottom: '15px' }}>
            <label htmlFor="template-name">名称:</label>
            <input
              id="template-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label htmlFor="template-desc">描述:</label>
            <textarea
              id="template-desc"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              style={{ width: '100%', padding: '8px', marginTop: '5px', minHeight: '60px' }}
            />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label htmlFor="template-visibility">可见性:</label>
            <select
              id="template-visibility"
              value={formData.visibility}
              onChange={(e) => setFormData({ ...formData, visibility: e.target.value as TemplateVisibility })}
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            >
              <option value={TemplateVisibility.PRIVATE}>私有</option>
              <option value={TemplateVisibility.PUBLIC}>公开</option>
            </select>
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label htmlFor="template-content">内容 (使用 {'{{变量名}}'} 作为占位符):</label>
            <textarea
              id="template-content"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              required
              style={{ width: '100%', padding: '8px', marginTop: '5px', minHeight: '100px' }}
            />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <span>变量:</span>
            <button type="button" onClick={addVariable} style={{ marginLeft: '10px', padding: '5px 10px' }}>
              添加变量
            </button>
            {formData.variables.map((v, i) => (
              <div key={i} style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <input
                  type="text"
                  placeholder="变量名"
                  value={v.name}
                  onChange={(e) => updateVariable(i, 'name', e.target.value)}
                  aria-label={`变量 ${i + 1} 名称`}
                  style={{ flex: 1, padding: '8px' }}
                />
                <input
                  type="text"
                  placeholder="默认值"
                  value={v.default}
                  onChange={(e) => updateVariable(i, 'default', e.target.value)}
                  aria-label={`变量 ${i + 1} 默认值`}
                  style={{ flex: 1, padding: '8px' }}
                />
                <button type="button" onClick={() => removeVariable(i)} style={{ padding: '8px' }}>
                  删除
                </button>
              </div>
            ))}
          </div>
          <button type="submit" style={{ padding: '10px 20px' }}>
            创建
          </button>
        </form>
      )}

      <div>
        {templates.map((template) => (
          <div key={template.id} style={{ padding: '15px', marginBottom: '15px', border: '1px solid #ccc' }}>
            <h3>{template.name}</h3>
            <p>{template.description}</p>
            <p>
              <small>
                可见性: {template.visibility === TemplateVisibility.PUBLIC ? '公开' : '私有'} | 版本:{' '}
                {template.latestVersion?.version ?? 0}
              </small>
            </p>
            <button onClick={() => handleDelete(template.id)} style={{ padding: '5px 10px' }}>
              删除
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
