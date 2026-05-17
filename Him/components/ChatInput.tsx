"use client";
import { useState, useRef } from "react";
import { Mic, MicOff, Send, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  onSend: (text: string) => void;
  onIdeaMark?: (text: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, onIdeaMark, disabled }: Props) {
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  function submit() {
    const t = text.trim();
    if (!t || disabled) return;
    onSend(t);
    setText("");
  }

  function toggleRecording() {
    if (recording) {
      recognitionRef.current?.stop();
      setRecording(false);
      return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("浏览器不支持语音识别，请使用 Chrome"); return; }
    const recognition = new SR();
    recognition.lang = "en";
    recognition.interimResults = false;
    recognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      if (transcript) onSend(transcript);
    };
    recognition.onerror = () => setRecording(false);
    recognition.onend = () => setRecording(false);
    recognition.start();
    recognitionRef.current = recognition;
    setRecording(true);
  }

  return (
    <div className="flex items-end gap-2 p-4 border-t border-white/5 bg-[#16161d]">
      <div className="flex-1 relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="说点什么..."
          rows={1}
          disabled={disabled}
          className="w-full bg-[#1e1e28] border border-white/5 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder-gray-600 resize-none focus:outline-none focus:border-violet-500/50 transition-colors"
          style={{ minHeight: 44, maxHeight: 120 }}
        />
      </div>
      {onIdeaMark && text.trim() && (
        <button
          onClick={() => { onIdeaMark(text.trim()); setText(""); }}
          title="标记为想法"
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
        >
          <Lightbulb className="w-4 h-4" />
        </button>
      )}
      <button
        onClick={toggleRecording}
        className={cn(
          "w-10 h-10 flex items-center justify-center rounded-xl transition-colors",
          recording
            ? "bg-red-500/20 text-red-400 animate-pulse"
            : "bg-white/5 text-gray-400 hover:text-gray-200"
        )}
      >
        {recording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
      </button>
      <button
        onClick={submit}
        disabled={!text.trim() || disabled}
        className="w-10 h-10 flex items-center justify-center rounded-xl bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <Send className="w-4 h-4" />
      </button>
    </div>
  );
}
