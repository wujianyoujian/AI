import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Him — AI 对话电台",
  description: "沉浸式 AI 对话，记录你的每一个想法",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh" className="dark">
      <body className="min-h-screen bg-[#0f0f13] text-gray-100 antialiased">
        {children}
      </body>
    </html>
  );
}
