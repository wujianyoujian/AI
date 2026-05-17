"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Sparkles, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { IdeaData } from "@/lib/types";

export default function IdeasPage() {
  const router = useRouter();
  const [ideas, setIdeas] = useState<IdeaData[]>([]);
  const [input, setInput] = useState("");
  const [enhancing, setEnhancing] = useState<string | null>(null);
  const [enhancedText, setEnhancedText] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/ideas").then((r) => r.json()).then(setIdeas);
  }, []);

  async function addIdea() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    const res = await fetch("/api/ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawContent: text }),
    });
    const idea = await res.json();
    setIdeas((prev) => [idea, ...prev]);
  }

  async function enhance(id: string) {
    setEnhancing(id);
    setEnhancedText((prev) => ({ ...prev, [id]: "" }));
    const res = await fetch("/api/ideas", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const reader = res.body!.getReader();
    const dec = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = dec.decode(value).split("\n").filter((l) => l.startsWith("data: "));
      for (const line of lines) {
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === "text") setEnhancedText((prev) => ({ ...prev, [id]: (prev[id] || "") + data.content }));
          if (data.type === "done") setIdeas((prev) => prev.map((i) => i.id === id ? { ...i, status: "enhanced" } : i));
        } catch {}
      }
    }
    setEnhancing(null);
  }

  async function deleteIdea(id: string) {
    await fetch(`/api/ideas/${id}`, { method: "DELETE" });
    setIdeas((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
        <button onClick={() => router.push("/")} className="flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" />
          返回
        </button>
        <span className="text-sm text-white/60 tracking-widest uppercase">想法</span>
        <div className="w-16" />
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <div className="flex gap-2 mb-8">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addIdea(); } }}
            placeholder="记录一个想法..."
            rows={2}
            className="flex-1 bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 resize-none focus:outline-none focus:border-violet-400/40 transition-colors"
          />
          <button
            onClick={addIdea}
            disabled={!input.trim()}
            className="px-4 self-end py-3 bg-violet-600/70 hover:bg-violet-500/70 disabled:opacity-30 text-white text-sm rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          {ideas.length === 0 && <p className="text-center text-white/20 py-12">还没有想法</p>}
          {ideas.map((idea) => (
            <div key={idea.id} className="bg-white/3 border border-white/5 rounded-2xl p-4 group">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-white/80 leading-relaxed flex-1">{idea.rawContent}</p>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {idea.status !== "enhanced" && enhancing !== idea.id && (
                    <button onClick={() => enhance(idea.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-amber-400 hover:bg-amber-400/10 transition-colors">
                      <Sparkles className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => deleteIdea(idea.id)} className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              {(enhancing === idea.id || enhancedText[idea.id]) && (
                <div className="mt-3 pt-3 border-t border-white/5">
                  <p className="text-xs text-amber-400/60 mb-1 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> AI 完善
                    {enhancing === idea.id && <span className="inline-block w-1 h-3 bg-amber-400 animate-pulse ml-1" />}
                  </p>
                  <p className="text-sm text-white/60 leading-relaxed whitespace-pre-wrap">{enhancedText[idea.id]}</p>
                </div>
              )}
              <p className="text-[10px] text-white/20 mt-2">{formatDate(idea.createdAt)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
