"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { C } from "@/lib/data";
import { useAppState } from "@/lib/app-state";
import { chatHref } from "@/lib/chat-window";

export function ChatWidget() {
  const { unreadMessages } = useAppState();

  return (
    <Link
      href={chatHref()}
      aria-label="Открыть чат"
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 150,
        width: 58,
        height: 58,
        borderRadius: "50%",
        background: C.teal,
        border: "none",
        boxShadow: `0 10px 30px ${C.teal}66`,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textDecoration: "none",
      }}
    >
      <MessageCircle size={24} color={C.bg} />
      {unreadMessages > 0 && (
        <span
          style={{
            position: "absolute",
            top: -2,
            right: -2,
            minWidth: 20,
            height: 20,
            borderRadius: 999,
            background: C.red,
            color: "#fff",
            fontSize: 11,
            fontWeight: 800,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 5px",
            border: `2px solid ${C.bg}`,
          }}
        >
          {unreadMessages}
        </span>
      )}
    </Link>
  );
}
