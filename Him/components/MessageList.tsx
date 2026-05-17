"use client";
import { useEffect, useRef } from "react";
import { cn, formatDate } from "@/lib/utils";
import type { MessageData } from "@/lib/types";

interface Props {
  messages: MessageData[];
  showSecondary: boolean;
}

export default function MessageList({ messages, showSecondary }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col gap-4 py-4">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={cn(
            "flex flex-col max-w-[75%] gap-1",
            msg.role === "user" ? "self-end items-end" : "self-start items-start"
          )}
        >
          <div
            className={cn(
              "px-4 py-3 rounded-2xl text-sm leading-relaxed",
              msg.role === "user"
                ? "bg-violet-600/80 text-white rounded-br-sm"
                : "bg-[#1e1e28] text-gray-100 rounded-bl-sm border border-white/5"
            )}
          >
            {msg.contentPrimary || msg.role === "user" ? msg.contentPrimary : (
              <span className="flex gap-1 items-center h-4">
                <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce [animation-delay:0s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce [animation-delay:0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce [animation-delay:0.3s]" />
              </span>
            )}
          </div>
          {showSecondary && msg.contentSecondary && (
            <div className="px-3 py-1.5 text-xs text-gray-500 italic">
              {msg.contentSecondary}
            </div>
          )}
          <span className="text-[10px] text-gray-600 px-1">
            {formatDate(msg.createdAt)}
          </span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
