"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Send } from "lucide-react";
import { C, FH, FB, CONVS, MESSAGES } from "@/lib/data";

const LS_MESSAGES_KEY = "eduhub_chat_messages_v1";

function loadMessages(): typeof MESSAGES {
  if (typeof window === "undefined") return MESSAGES;
  try {
    const raw = localStorage.getItem(LS_MESSAGES_KEY);
    return raw ? (JSON.parse(raw) as typeof MESSAGES) : MESSAGES;
  } catch {
    return MESSAGES;
  }
}

export default function ChatWindowPage() {
  return (
    <Suspense fallback={null}>
      <ChatWindowInner />
    </Suspense>
  );
}

function ChatWindowInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialConv = Number(searchParams.get("conv")) || CONVS[0]?.id || 1;

  const [activeConv, setActiveConv] = useState(initialConv);
  const [messages, setMessages] = useState(loadMessages);
  const [text, setText] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      const channel = new BroadcastChannel("eduhub-chat");
      channel.postMessage({ type: "opened" });
      channel.close();
    }
    document.title = "EduHub — Сообщения";
  }, []);

  useEffect(() => {
    localStorage.setItem(LS_MESSAGES_KEY, JSON.stringify(messages));
  }, [messages]);

  const thread = messages.filter((m) => m.convId === activeConv);
  const conv = CONVS.find((c) => c.id === activeConv);

  function send() {
    if (!text.trim()) return;
    setMessages((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        convId: activeConv,
        from: "me" as const,
        text: text.trim(),
        time: new Date().toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    setText("");
  }

  return (
    <div style={{ height: "100vh", display: "flex", fontFamily: FB }}>
      {/* ── conversation list ── */}
      <div style={{ width: 148, borderRight: `1px solid ${C.border}`, overflowY: "auto", flexShrink: 0, background: C.s1 }}>
        <div style={{ padding: "16px 14px", borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontFamily: FH, fontWeight: 900, fontSize: 15, color: C.text }}>
            Edu<span style={{ color: C.gold }}>Hub</span>
          </span>
          <p style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>Сообщения</p>
        </div>
        {CONVS.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveConv(c.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              padding: "12px 14px",
              background: c.id === activeConv ? C.s3 : "transparent",
              border: "none",
              borderBottom: `1px solid ${C.border}`,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: c.color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: FH,
                fontWeight: 800,
                color: C.overlay,
                fontSize: 13,
                flexShrink: 0,
                position: "relative",
              }}
            >
              {c.name.ru[0]}
              {c.unread > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -2,
                    right: -2,
                    width: 9,
                    height: 9,
                    borderRadius: "50%",
                    background: C.red,
                    border: `2px solid ${C.s1}`,
                  }}
                />
              )}
            </div>
            <span style={{ fontSize: 12, color: C.text, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {c.name.ru}
            </span>
          </button>
        ))}
      </div>

      {/* ── thread ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div
          style={{
            padding: "16px 22px",
            borderBottom: `1px solid ${C.border}`,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <button
            onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: `1px solid ${C.border}`, borderRadius: 8, color: C.sub, cursor: "pointer", padding: "7px 11px", fontFamily: FH, fontWeight: 700, fontSize: 12.5, flexShrink: 0 }}
          >
            <ArrowLeft size={15} /> Назад
          </button>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              background: conv?.color ?? C.teal,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: FH,
              fontWeight: 800,
              color: C.overlay,
              fontSize: 15,
            }}
          >
            {conv?.name.ru[0]}
          </div>
          <div>
            <p style={{ fontFamily: FH, fontWeight: 700, fontSize: 15, color: C.text }}>{conv?.name.ru}</p>
            <p style={{ fontSize: 12, color: C.ok }}>● онлайн</p>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 22, display: "flex", flexDirection: "column", gap: 12 }}>
          {thread.length === 0 && (
            <div style={{ color: C.muted, fontSize: 13, textAlign: "center", marginTop: 30 }}>Начните переписку</div>
          )}
          {thread.map((m) => (
            <div key={m.id} style={{ alignSelf: m.from === "me" ? "flex-end" : "flex-start", maxWidth: "70%" }}>
              <div
                style={{
                  background: m.from === "me" ? C.teal : C.s2,
                  color: m.from === "me" ? C.bg : C.text,
                  padding: "10px 14px",
                  borderRadius: 12,
                  fontSize: 14,
                  lineHeight: 1.5,
                }}
              >
                {m.text}
              </div>
              <div style={{ fontSize: 11, color: C.dim, marginTop: 3, textAlign: m.from === "me" ? "right" : "left" }}>{m.time}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, padding: 16, borderTop: `1px solid ${C.border}` }}>
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            placeholder="Сообщение…"
            style={{
              flex: 1,
              background: C.s2,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: "12px 16px",
              color: C.text,
              fontSize: 14,
              fontFamily: FB,
              outline: "none",
            }}
          />
          <button
            onClick={send}
            aria-label="Отправить"
            style={{
              background: C.teal,
              border: "none",
              borderRadius: 12,
              width: 46,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <Send size={18} color={C.bg} />
          </button>
        </div>
      </div>
    </div>
  );
}
