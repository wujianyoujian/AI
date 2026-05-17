"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { ConversationSummary } from "@/lib/types";

const GRADIENTS = [
  ["#0f0c29", "#302b63"],
  ["#0f2027", "#2c5364"],
  ["#1a1a2e", "#0f3460"],
  ["#200122", "#6f0000"],
  ["#0d0d0d", "#1a1a2e"],
];

function cardGradient(id: string) {
  const g = GRADIENTS[id.charCodeAt(0) % GRADIENTS.length];
  return `linear-gradient(135deg, ${g[0]}, ${g[1]})`;
}

export default function HistoryPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((d) => { setConversations(d); setLoading(false); });
  }, []);

  async function deleteConv(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    setConversations((prev) => prev.filter((c) => c.id !== id));
  }

  async function newChat() {
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const conv = await res.json();
    router.push(`/chat/${conv.id}`);
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* top bar */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
        <button
          onClick={() => router.push("/")}
          className="flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          返回
        </button>
        <span className="text-sm text-white/60 tracking-widest uppercase">历史对话</span>
        <button
          onClick={newChat}
          className="flex items-center gap-1.5 text-sm text-violet-400 hover:text-violet-300 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新对话
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 rounded-2xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-white/20">
            <p className="text-lg mb-1">还没有对话记录</p>
            <p className="text-sm">回到首页开始第一次对话</p>
          </div>
        ) : (
          <div className="space-y-3">
            {conversations.map((c) => (
              <div
                key={c.id}
                onClick={() => router.push(`/chat/${c.id}`)}
                className="group relative flex items-center gap-4 p-4 rounded-2xl border border-white/5 hover:border-white/10 cursor-pointer transition-all hover:bg-white/3"
              >
                {/* color swatch */}
                <div
                  className="w-10 h-10 rounded-xl flex-shrink-0"
                  style={{ background: cardGradient(c.id) }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white/80 truncate group-hover:text-white transition-colors">
                    {c.title}
                  </p>
                  {c.summary ? (
                    <p className="text-xs text-white/30 truncate mt-0.5">{c.summary}</p>
                  ) : (
                    <p className="text-xs text-white/20 mt-0.5">{c.messageCount ?? 0} 条消息</p>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs text-white/20">{formatDate(c.createdAt)}</span>
                  <button
                    onClick={(e) => deleteConv(e, c.id)}
                    className="opacity-0 group-hover:opacity-100 w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-all"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
