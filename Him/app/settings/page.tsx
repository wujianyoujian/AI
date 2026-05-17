"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save } from "lucide-react";

const VOICES = [
  { value: "nova", label: "Nova — 温暖女声" },
  { value: "alloy", label: "Alloy — 中性" },
  { value: "echo", label: "Echo — 低沉男声" },
  { value: "fable", label: "Fable — 英式" },
  { value: "onyx", label: "Onyx — 深沉" },
  { value: "shimmer", label: "Shimmer — 轻柔" },
];

export default function SettingsPage() {
  const router = useRouter();
  const [defaultProvider, setDefaultProvider] = useState("anthropic");
  const [voice, setVoice] = useState("nova");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const s = localStorage.getItem("him-settings");
    if (s) {
      const p = JSON.parse(s);
      setDefaultProvider(p.defaultProvider || "anthropic");
      setVoice(p.voice || "nova");
    }
  }, []);

  function save() {
    localStorage.setItem("him-settings", JSON.stringify({ defaultProvider, voice }));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      <div className="flex items-center justify-between px-6 py-5 border-b border-white/5">
        <button onClick={() => router.push("/")} className="flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" />
          返回
        </button>
        <span className="text-sm text-white/60 tracking-widest uppercase">设置</span>
        <div className="w-16" />
      </div>

      <div className="max-w-lg mx-auto px-6 py-8 space-y-6">
        <section className="bg-white/3 border border-white/5 rounded-2xl p-5">
          <h2 className="text-sm text-white/50 mb-4 uppercase tracking-wider">AI 服务</h2>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-white/30 mb-1 block">默认服务</label>
              <select
                value={defaultProvider}
                onChange={(e) => setDefaultProvider(e.target.value)}
                className="w-full bg-[#0a0a0f] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-400/40"
              >
                <option value="openai">OpenAI GPT-4o</option>
                <option value="anthropic">Anthropic Claude</option>
              </select>
            </div>
            <p className="text-xs text-white/20">API Key 在项目根目录 .env.local 中配置</p>
          </div>
        </section>

        <section className="bg-white/3 border border-white/5 rounded-2xl p-5">
          <h2 className="text-sm text-white/50 mb-4 uppercase tracking-wider">语音</h2>
          <div>
            <label className="text-xs text-white/30 mb-1 block">AI 音色</label>
            <select
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
              className="w-full bg-[#0a0a0f] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-400/40"
            >
              {VOICES.map((v) => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
          </div>
        </section>

        <button
          onClick={save}
          className="flex items-center gap-2 px-5 py-2.5 bg-violet-600/70 hover:bg-violet-500/70 text-white text-sm rounded-xl transition-colors"
        >
          <Save className="w-4 h-4" />
          {saved ? "已保存 ✓" : "保存"}
        </button>
      </div>
    </div>
  );
}
