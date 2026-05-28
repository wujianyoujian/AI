import { useState, useEffect } from 'react';
import type { Template } from '../types';
import * as templatesAPI from '../api/templates';

interface TemplateSelectorProps {
  onSelect: (templateId: string, variables: Record<string, string>) => void;
  onClose: () => void;
}

export function TemplateSelector({ onSelect, onClose }: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});

  useEffect(() => {
    templatesAPI.getTemplates().then(setTemplates).catch(console.error);
  }, []);

  const handleTemplateSelect = (template: Template) => {
    setSelectedTemplate(template);
    const initialVars: Record<string, string> = {};
    template.latestVersion?.variables.forEach((v) => {
      initialVars[v.name] = v.default;
    });
    setVariables(initialVars);
  };

  const handleSubmit = () => {
    if (selectedTemplate) {
      onSelect(selectedTemplate.id, variables);
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="选择模板"
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', width: '500px' }}>
        <h2>选择模板</h2>
        <select
          aria-label="模板列表"
          onChange={(e) => {
            const template = templates.find((t) => t.id === e.target.value);
            if (template) handleTemplateSelect(template);
          }}
          style={{ width: '100%', padding: '8px', marginBottom: '15px' }}
        >
          <option value="">-- 选择模板 --</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>

        {selectedTemplate?.latestVersion && (
          <div>
            <h3>变量</h3>
            {selectedTemplate.latestVersion.variables.map((v) => (
              <div key={v.name} style={{ marginBottom: '10px' }}>
                <label htmlFor={`var-${v.name}`}>{v.name}:</label>
                <input
                  id={`var-${v.name}`}
                  type="text"
                  value={variables[v.name] || ''}
                  onChange={(e) => setVariables({ ...variables, [v.name]: e.target.value })}
                  style={{ width: '100%', padding: '8px', marginTop: '5px' }}
                />
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
          <button onClick={handleSubmit} disabled={!selectedTemplate} style={{ flex: 1, padding: '10px' }}>
            确定
          </button>
          <button onClick={onClose} style={{ flex: 1, padding: '10px' }}>
            取消
          </button>
        </div>
      </div>
    </div>
  );
}
