import { fetchAPI } from './client';
import type { Template, TemplateVersion } from '../types';
import { TemplateVisibility } from '../types';

export async function getTemplates(): Promise<Template[]> {
  const response = await fetchAPI('/templates');
  return response.json();
}

export async function createTemplate(data: {
  name: string;
  description: string;
  visibility: TemplateVisibility;
  content: string;
  variables: Array<{ name: string; default: string }>;
}): Promise<Template> {
  const response = await fetchAPI('/templates', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function getTemplate(id: string): Promise<Template> {
  const response = await fetchAPI(`/templates/${id}`);
  return response.json();
}

export async function updateTemplate(
  id: string,
  data: { name?: string; description?: string; visibility?: TemplateVisibility },
): Promise<Template> {
  const response = await fetchAPI(`/templates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function deleteTemplate(id: string): Promise<void> {
  await fetchAPI(`/templates/${id}`, { method: 'DELETE' });
}

export async function getVersions(templateId: string): Promise<TemplateVersion[]> {
  const response = await fetchAPI(`/templates/${templateId}/versions`);
  return response.json();
}
