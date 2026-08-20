"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { C } from "@/lib/data";
import { useAppState } from "@/lib/app-state";
import { chatHref } from "@/lib/chat-window";

export function MessagesLink() {
  const { unreadMessages } = useAppState();

  return (
    <Link
      href={chatHref()}
      aria-label="Сообщения"
      style={{
        position: "relative",
        background: "none",
        border: `1px solid ${C.border}`,
        borderRadius: 9,
        cursor: "pointer",
        padding: 8,
        display: "flex",
        color: C.sub,
        textDecoration: "none",
      }}
    >
      <MessageCircle size={16} />
      {unreadMessages > 0 && (
        <span
          style={{
            position: "absolute",
            top: 3,
            right: 3,
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: C.red,
            border: `2px solid ${C.bg}`,
          }}
        />
      )}
    </Link>
  );
}
