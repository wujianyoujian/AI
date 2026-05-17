"use client";
import { useEffect, useRef, useState, Suspense } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Volume2, VolumeX, Languages, Lightbulb, Trash2 } from "lucide-react";
import MessageList from "@/components/MessageList";
import ChatInput from "@/components/ChatInput";
import { cn } from "@/lib/utils";
import { ROLES, DEFAULT_ROLE } from "@/lib/roles";
import type { MessageData } from "@/lib/types";

function ChatPageInner() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [messages, setMessages] = useState<MessageData[]>([]);
  const [title, setTitle] = useState("对话");
  const [loading, setLoading] = useState(false);
  const [showSecondary, setShowSecondary] = useState(true);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [provider, setProvider] = useState("anthropic");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const firstSent = useRef(false);

  useEffect(() => {
    if (firstSent.current) return;
    fetch(`/api/conversations/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setTitle(data.title);
        setProvider(data.aiProvider || "anthropic");
        const first = searchParams.get("first");
        if (first && !firstSent.current && data.messages?.length === 0) {
          firstSent.current = true;
          console.log("[Him] auto-send:", first, "provider:", data.aiProvider || "anthropic");
          window.history.replaceState(null, "", `/chat/${id}`);
          sendMessage(first);
        } else {
          setMessages(data.messages || []);
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function playTTS(text: string) {
    if (!ttsEnabled) return;
    try {
      const res = await fetch("/api/voice/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play().catch(() => {});
      }
    } catch { /* TTS service unavailable, skip silently */ }
  }

  async function sendMessage(text: string) {
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: tempId, role: "user", contentPrimary: text, contentSecondary: "", audioUrl: "", isIdeaMarked: false, createdAt: new Date().toISOString() },
    ]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: id, message: text, provider }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      const assistantId = `ai-${Date.now()}`;
      let aiText = "";

      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", contentPrimary: "", contentSecondary: "", audioUrl: "", isIdeaMarked: false, createdAt: new Date().toISOString() },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = dec.decode(value).split("\n").filter((l) => l.startsWith("data: "));
        for (const line of lines) {
          const data = JSON.parse(line.slice(6));
          if (data.type === "text") {
            aiText += data.content;
            setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, contentPrimary: aiText } : m));
          } else if (data.type === "translation") {
            setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, contentSecondary: data.content } : m));
          } else if (data.type === "tts_text") {
            playTTS(data.content);
          } else if (data.type === "title") {
            setTitle(data.content);
          } else if (data.type === "done") {
            setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, id: data.messageId } : m));
          } else if (data.type === "error") {
            throw new Error(data.content);
          }
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "请求失败";
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: "assistant", contentPrimary: `⚠️ ${msg}`, contentSecondary: "", audioUrl: "", isIdeaMarked: false, createdAt: new Date().toISOString() },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function markIdea(text: string) {
    await fetch("/api/ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rawContent: text, conversationId: id }),
    });
  }

  async function deleteConversation() {
    if (!confirm("删除这次对话？")) return;
    await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    router.push("/");
  }

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0f]">
      {/* top bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-[#0a0a0f]/80 backdrop-blur-sm">
        <button onClick={() => router.push("/history")} className="text-white/30 hover:text-white/60 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="flex-1 text-sm text-white/70 truncate">{title}</h1>
        <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-white/50 mr-2">
          {ROLES[DEFAULT_ROLE].name}
        </span>
        <div className="flex items-center gap-1">
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="text-xs bg-transparent text-white/30 border border-white/10 rounded-lg px-2 py-1 focus:outline-none"
          >
            <option value="anthropic">Claude</option>
            {process.env.NEXT_PUBLIC_OPENAI_ENABLED === "true" && (
              <option value="openai">GPT-4o</option>
            )}
          </select>
          <button
            onClick={() => setShowSecondary((v) => !v)}
            className={cn("w-8 h-8 flex items-center justify-center rounded-lg transition-colors", showSecondary ? "text-violet-400" : "text-white/20")}
          >
            <Languages className="w-4 h-4" />
          </button>
          <button
            onClick={() => setTtsEnabled((v) => !v)}
            className={cn("w-8 h-8 flex items-center justify-center rounded-lg transition-colors", ttsEnabled ? "text-violet-400" : "text-white/20")}
          >
            {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button
            onClick={() => router.push("/ideas")}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-white/20 hover:text-amber-400 transition-colors"
          >
            <Lightbulb className="w-4 h-4" />
          </button>
          <button onClick={deleteConversation} className="w-8 h-8 flex items-center justify-center rounded-lg text-white/20 hover:text-red-400 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* messages */}
      <div className="flex-1 overflow-y-auto px-4">
        {messages.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center h-full text-white/20">
            <p>开始对话</p>
          </div>
        ) : (
          <MessageList messages={messages} showSecondary={showSecondary} />
        )}
      </div>

      <ChatInput onSend={sendMessage} onIdeaMark={markIdea} disabled={loading} />
      <audio ref={audioRef} className="hidden" />
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense>
      <ChatPageInner />
    </Suspense>
  );
}
