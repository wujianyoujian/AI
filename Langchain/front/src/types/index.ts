export const UserRole = {
  ADMIN: 'admin',
  USER: 'user',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const MessageRole = {
  USER: 'user',
  ASSISTANT: 'assistant',
} as const;
export type MessageRole = (typeof MessageRole)[keyof typeof MessageRole];

export const TemplateVisibility = {
  PRIVATE: 'private',
  PUBLIC: 'public',
} as const;
export type TemplateVisibility = (typeof TemplateVisibility)[keyof typeof TemplateVisibility];

export interface User {
  id: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  createdAt: string;
}

export interface TemplateVersion {
  id: string;
  templateId: string;
  version: number;
  content: string;
  variables: Array<{ name: string; default: string }>;
  createdAt: string;
}

export interface Template {
  id: string;
  userId: string;
  name: string;
  description: string;
  visibility: TemplateVisibility;
  createdAt: string;
  updatedAt: string;
  latestVersion?: TemplateVersion;
}
