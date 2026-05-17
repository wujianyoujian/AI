"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export default function ChatRedirect() {
  const router = useRouter();
  const created = useRef(false);
  useEffect(() => {
    if (created.current) return;
    created.current = true;
    fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
      .then((r) => r.json())
      .then((conv) => router.push(`/chat/${conv.id}`));
  }, [router]);
  return (
    <div className="flex items-center justify-center h-screen text-gray-600">
      <div className="w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
