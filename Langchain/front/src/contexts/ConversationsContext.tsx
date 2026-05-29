import { createContext, useContext, useState, useRef, useCallback, type ReactNode } from 'react';
import type { Conversation } from '../types';
import * as conversationsAPI from '../api/conversations';

interface ConversationsContextType {
  conversations: Conversation[];
  loadConversations: () => Promise<void>;
}

const ConversationsContext = createContext<ConversationsContextType | undefined>(undefined);

function conversationsChanged(prev: Conversation[], next: Conversation[]): boolean {
  if (prev.length !== next.length) return true;
  return next.some((c, i) => c.id !== prev[i].id || c.title !== prev[i].title);
}

export function ConversationsProvider({ children }: { children: ReactNode }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const cacheRef = useRef<Conversation[]>([]);

  const loadConversations = useCallback(async () => {
    try {
      const data = await conversationsAPI.getConversations();
      if (conversationsChanged(cacheRef.current, data)) {
        cacheRef.current = data;
        setConversations(data);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  }, []);

  return (
    <ConversationsContext.Provider value={{ conversations, loadConversations }}>
      {children}
    </ConversationsContext.Provider>
  );
}

export function useConversations() {
  const ctx = useContext(ConversationsContext);
  if (!ctx) throw new Error('useConversations must be used within ConversationsProvider');
  return ctx;
}
