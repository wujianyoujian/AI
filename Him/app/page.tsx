"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

// ── Particle canvas (default jellyfish + optional image upload) ──
type IP = {
  x: number; y: number;
  ox: number; oy: number; // offset from canvas center → used for breathing
  vx: number; vy: number;
  r: number; g: number; b: number;
  size: number; phase: number;
};

function drawJellyfish(): HTMLCanvasElement {
  const W = 320, H = 420;
  const off = document.createElement("canvas");
  off.width = W; off.height = H;
  const c = off.getContext("2d")!;
  c.fillStyle = "#000";
  c.fillRect(0, 0, W, H);

  const cx = W / 2, bellY = H * 0.32;

  // outer bell
  const g1 = c.createRadialGradient(cx, bellY, 0, cx, bellY, W * 0.42);
  g1.addColorStop(0, "rgba(210,180,255,0.95)");
  g1.addColorStop(0.6, "rgba(160,100,255,0.7)");
  g1.addColorStop(1, "rgba(80,40,180,0)");
  c.beginPath();
  c.ellipse(cx, bellY, W * 0.42, H * 0.30, 0, Math.PI, 0);
  c.fillStyle = g1;
  c.fill();

  // inner glow
  const g2 = c.createRadialGradient(cx, bellY - 10, 0, cx, bellY, W * 0.22);
  g2.addColorStop(0, "rgba(255,240,255,0.9)");
  g2.addColorStop(1, "rgba(180,140,255,0)");
  c.beginPath();
  c.ellipse(cx, bellY - 10, W * 0.22, H * 0.16, 0, Math.PI, 0);
  c.fillStyle = g2;
  c.fill();

  // rim
  c.beginPath();
  c.ellipse(cx, bellY, W * 0.42, H * 0.30, 0, Math.PI, 0);
  c.strokeStyle = "rgba(220,200,255,0.5)";
  c.lineWidth = 1.5;
  c.stroke();

  // tentacles — fixed positions, no random
  const tentacles = [
    { x: 0.18, len: 0.52, amp: 9,  phase: 0.0 },
    { x: 0.28, len: 0.65, amp: 7,  phase: 0.8 },
    { x: 0.38, len: 0.48, amp: 10, phase: 1.6 },
    { x: 0.48, len: 0.70, amp: 6,  phase: 0.3 },
    { x: 0.58, len: 0.55, amp: 8,  phase: 1.1 },
    { x: 0.68, len: 0.62, amp: 9,  phase: 2.0 },
    { x: 0.78, len: 0.45, amp: 7,  phase: 0.6 },
    { x: 0.88, len: 0.58, amp: 10, phase: 1.4 },
    { x: 0.33, len: 0.80, amp: 5,  phase: 2.4 },
    { x: 0.63, len: 0.75, amp: 6,  phase: 1.9 },
  ];
  tentacles.forEach((t, i) => {
    const tx = W * t.x;
    const len = H * t.len;
    const alpha = 0.25 + (i % 4) * 0.1;
    c.beginPath();
    c.moveTo(tx, bellY);
    for (let s = 0; s <= len; s += 4) {
      c.lineTo(tx + Math.sin(s * 0.07 + t.phase) * t.amp, bellY + s);
    }
    c.strokeStyle = `rgba(190,150,255,${alpha})`;
    c.lineWidth = 1.2;
    c.stroke();
  });

  return off;
}

function ParticleCanvas({ imageUrl, onClear }: { imageUrl?: string; onClear?: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const mouse = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    let raf: number;
    let t = 0;
    let particles: IP[] = [];

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    function buildParticles(src: HTMLCanvasElement) {
      particles = [];
      const sw = src.width, sh = src.height;
      const data = src.getContext("2d")!.getImageData(0, 0, sw, sh).data;
      const pcx = canvas.width / 2, pcy = canvas.height * 0.36;
      const ox0 = -sw / 2, oy0 = -sh / 2;
      const step = imageUrl ? 3 : 2;

      for (let y = 0; y < sh; y += step) {
        for (let x = 0; x < sw; x += step) {
          const i = (y * sw + x) * 4;
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 60 || (r + g + b) < 25) continue;
          const ox = ox0 + x, oy = oy0 + y;
          particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            ox, oy,
            vx: 0, vy: 0,
            r, g, b,
            size: Math.random() * 1.4 + 0.4,
            phase: Math.random() * Math.PI * 2,
          });
        }
      }
      // store center for breathing
      (canvas as any)._pcx = pcx;
      (canvas as any)._pcy = pcy;
    }

    function loadSource() {
      if (imageUrl) {
        const img = new Image();
        img.onload = () => {
          const maxDim = Math.min(window.innerWidth * 0.65, window.innerHeight * 0.65, 480);
          const scale = maxDim / Math.max(img.width, img.height);
          const sw = Math.round(img.width * scale), sh = Math.round(img.height * scale);
          const off = document.createElement("canvas");
          off.width = sw; off.height = sh;
          off.getContext("2d")!.drawImage(img, 0, 0, sw, sh);
          buildParticles(off);
        };
        img.src = imageUrl;
      } else {
        buildParticles(drawJellyfish());
      }
    }
    loadSource();

    function animate() {
      ctx.fillStyle = "rgba(7,7,13,0.15)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const pcx = (canvas as any)._pcx ?? canvas.width / 2;
      const pcy = (canvas as any)._pcy ?? canvas.height / 2;
      const mx = mouse.current.x, my = mouse.current.y;
      const MR = 100, MF = 7, K = 0.055, D = 0.82;
      const breath = 1 + 0.045 * Math.sin(t * 0.022);

      particles.forEach((p) => {
        // breathing target
        const tx = pcx + p.ox * breath;
        const ty = pcy + p.oy * breath;

        // mouse repulsion
        const dx = p.x - mx, dy = p.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MR && dist > 0) {
          const f = ((MR - dist) / MR) * MF;
          p.vx += (dx / dist) * f;
          p.vy += (dy / dist) * f;
        }

        p.vx += (tx - p.x) * K;
        p.vy += (ty - p.y) * K;
        p.vx *= D; p.vy *= D;
        p.x += p.vx; p.y += p.vy;

        // size breathes slightly per particle
        const s = p.size * (0.85 + 0.3 * Math.sin(t * 0.018 + p.phase));
        ctx.beginPath();
        ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
        ctx.fill();
      });

      t++;
      raf = requestAnimationFrame(animate);
    }
    animate();

    const onMove = (e: MouseEvent) => { mouse.current = { x: e.clientX, y: e.clientY }; };
    const onLeave = () => { mouse.current = { x: -9999, y: -9999 }; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
    };
  }, [imageUrl]);

  return <canvas ref={ref} className="absolute inset-0 w-full h-full pointer-events-none" />;
}

// ── Waveform bars (idle animation) ──────────────────────────────
function Waveform({ active }: { active: boolean }) {
  const bars = 28;
  return (
    <div className="flex items-center gap-[3px] h-10">
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "w-[2px] rounded-full transition-all",
            active ? "bg-red-400/70" : "bg-white/20"
          )}
          style={{
            height: active
              ? `${20 + Math.sin(Date.now() * 0.01 + i) * 16}px`
              : `${4 + Math.sin(i * 0.7) * 10}px`,
            animation: active
              ? `wave ${0.6 + (i % 5) * 0.1}s ease-in-out ${i * 0.04}s infinite alternate`
              : "none",
          }}
        />
      ))}
      <style>{`
        @keyframes wave {
          from { height: 4px; }
          to   { height: 32px; }
        }
      `}</style>
    </div>
  );
}

// ── Greeting ─────────────────────────────────────────────────────
function greeting() {
  const h = new Date().getHours();
  if (h < 6)  return "夜深了";
  if (h < 12) return "早上好";
  if (h < 18) return "下午好";
  return "晚上好";
}

// ── Recent conversations ─────────────────────────────────────────
type Conv = { id: string; title: string; createdAt: string };

export default function HomePage() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"voice" | "text">("voice");
  const [recents, setRecents] = useState<Conv[]>([]);
  const [particleImage, setParticleImage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setParticleImage(url);
    e.target.value = "";
  }

  useEffect(() => {
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((d: Conv[]) => setRecents(d.slice(0, 3)));
  }, []);

  async function startConversation(message?: string) {
    if (loading) return;
    setLoading(true);
    const res = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const conv = await res.json();
    router.push(`/chat/${conv.id}${message ? `?first=${encodeURIComponent(message)}` : ""}`);
  }

  async function toggleRecording() {
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
      if (transcript) startConversation(transcript);
    };
    recognition.onerror = () => { setRecording(false); setLoading(false); };
    recognition.onend = () => setRecording(false);
    recognition.start();
    recognitionRef.current = recognition;
    setRecording(true);
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden flex flex-col select-none">
      {/* dark base so canvas trail effect works */}
      <div className="absolute inset-0 bg-[#07070d]" />
      <ParticleCanvas imageUrl={particleImage ?? undefined} />
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

      {/* ── top bar ── */}
      <div className="relative z-10 flex items-center justify-between px-7 pt-7">
        <span className="text-[11px] font-medium tracking-[0.3em] text-white/30 uppercase">Him</span>
        <div className="flex items-center gap-5">
          {particleImage
            ? <button onClick={() => setParticleImage(null)} className="text-[11px] tracking-[0.15em] text-white/20 hover:text-white/50 transition-colors uppercase">重置</button>
            : <button onClick={() => fileRef.current?.click()} className="text-[11px] tracking-[0.15em] text-white/20 hover:text-white/50 transition-colors uppercase">上传</button>
          }
          <button onClick={() => router.push("/ideas")} className="text-[11px] tracking-[0.15em] text-white/20 hover:text-white/50 transition-colors uppercase">想法</button>
          <button onClick={() => router.push("/history")} className="text-[11px] tracking-[0.15em] text-white/20 hover:text-white/50 transition-colors uppercase">历史</button>
          <button onClick={() => router.push("/settings")} className="text-[11px] tracking-[0.15em] text-white/20 hover:text-white/50 transition-colors uppercase">设置</button>
        </div>
      </div>

      {/* ── main ── */}
      <div className="relative z-10 flex-1 flex flex-col justify-end pb-6 px-6">

        {/* greeting + title */}
        <div className="text-center mb-6">
          <p className="text-[11px] tracking-[0.3em] text-white/20 uppercase mb-2">{greeting()}</p>
          <h1 className="text-[2.6rem] font-extralight text-white/90 tracking-[-0.03em] leading-none">
            说点什么
          </h1>
        </div>

        {/* waveform */}
        <div className="flex justify-center mb-5">
          <Waveform active={recording} />
        </div>

        {/* mode toggle */}
        <div className="flex justify-center mb-5">
          <div className="flex items-center bg-white/[0.04] rounded-full p-[3px] border border-white/[0.07]">
            {(["voice", "text"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={cn(
                  "px-6 py-[7px] rounded-full text-[12px] tracking-wide transition-all duration-200",
                  mode === m ? "bg-white/[0.12] text-white/80" : "text-white/25 hover:text-white/45"
                )}
              >
                {m === "voice" ? "语音" : "文字"}
              </button>
            ))}
          </div>
        </div>

        {/* action */}
        {mode === "voice" ? (
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={toggleRecording}
              disabled={loading}
              className={cn(
                "relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500",
                recording
                  ? "bg-red-500/15 border border-red-400/50 scale-110"
                  : "bg-white/[0.06] border border-white/[0.15] hover:bg-white/[0.1] hover:scale-105 active:scale-95",
                loading && "opacity-40 pointer-events-none"
              )}
            >
              {recording && (
                <>
                  <span className="absolute inset-0 rounded-full border border-red-400/25 animate-ping" />
                  <span className="absolute -inset-4 rounded-full border border-red-400/10 animate-ping [animation-delay:0.4s]" />
                </>
              )}
              {loading ? (
                <span className="w-5 h-5 border border-white/20 border-t-white/60 rounded-full animate-spin" />
              ) : recording ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect x="6" y="6" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" className="text-red-300" />
                </svg>
              ) : (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                  <rect x="9" y="2" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.5" className="text-white/60" />
                  <path d="M5 10a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-white/60" />
                  <line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-white/60" />
                  <line x1="9" y1="21" x2="15" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-white/60" />
                </svg>
              )}
            </button>
            <p className="text-[11px] tracking-widest text-white/20 uppercase">
              {recording ? <span className="text-red-300/60 animate-pulse">录音中 · 点击停止</span> : "点击录音"}
            </p>
          </div>
        ) : (
          <div className="w-full max-w-sm mx-auto flex flex-col gap-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (text.trim()) startConversation(text.trim());
                }
              }}
              placeholder="输入你想说的..."
              rows={3}
              autoFocus
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3 text-white/80 placeholder-white/15 text-[13px] resize-none focus:outline-none focus:border-white/20 transition-colors leading-relaxed"
            />
            <button
              onClick={() => text.trim() && startConversation(text.trim())}
              disabled={!text.trim() || loading}
              className="flex items-center justify-center gap-2 w-full py-3 bg-white/[0.06] hover:bg-white/[0.1] disabled:opacity-20 text-white/60 text-[13px] rounded-2xl transition-all border border-white/[0.08]"
            >
              {loading
                ? <span className="w-4 h-4 border border-white/20 border-t-white/60 rounded-full animate-spin" />
                : "开始对话 →"
              }
            </button>
          </div>
        )}
      </div>

      {/* ── recent conversations ── */}
      {recents.length > 0 && (
        <div className="relative z-10 px-6 pb-8">
          <p className="text-[10px] tracking-[0.25em] text-white/15 uppercase mb-3">最近对话</p>
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
            {recents.map((c) => (
              <button
                key={c.id}
                onClick={() => router.push(`/chat/${c.id}`)}
                className="flex-shrink-0 px-4 py-2.5 bg-white/[0.04] border border-white/[0.07] rounded-xl text-left hover:bg-white/[0.07] transition-colors max-w-[160px]"
              >
                <p className="text-[12px] text-white/50 truncate">{c.title}</p>
              </button>
            ))}
            <button
              onClick={() => router.push("/history")}
              className="flex-shrink-0 px-4 py-2.5 bg-transparent border border-white/[0.05] rounded-xl text-[12px] text-white/20 hover:text-white/40 transition-colors"
            >
              全部 →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
