export type AIProvider = "openai" | "anthropic";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface VoiceConfig {
  provider: "openai" | "browser";
  voice: string;
  speed: number;
}

export interface ConversationSummary {
  id: string;
  title: string;
  summary: string;
  coverImageUrl: string;
  moodTags: string[];
  createdAt: string;
  messageCount?: number;
}

export interface MessageData {
  id: string;
  role: "user" | "assistant";
  contentPrimary: string;
  contentSecondary: string;
  audioUrl: string;
  isIdeaMarked: boolean;
  createdAt: string;
}

export interface IdeaData {
  id: string;
  rawContent: string;
  enhancedContent: Record<string, unknown>;
  tags: string[];
  status: "draft" | "enhanced" | "archived";
  createdAt: string;
  conversationId?: string;
}

export type GalleryView = "masonry" | "timeline" | "grid" | "list";
