"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, MessageCircle, Star, Newspaper, Trophy, type LucideIcon } from "lucide-react";
import { C, FH, FB } from "@/lib/data";
import { useAppState } from "@/lib/app-state";

const TYPE_ICON: Record<string, LucideIcon> = {
  message: MessageCircle,
  review_reply: Star,
  news: Newspaper,
  achievement: Trophy,
};

export function NotificationBell() {
  const { notifications, unreadNotifications, markNotificationRead, markAllNotificationsRead } = useAppState();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Уведомления"
        style={{
          position: "relative",
          background: "none",
          border: `1px solid ${C.border}`,
          borderRadius: 9,
          cursor: "pointer",
          padding: 8,
          display: "flex",
          color: C.sub,
        }}
      >
        <Bell size={16} />
        {unreadNotifications > 0 && (
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
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 10px)",
            right: 0,
            width: 320,
            maxHeight: 400,
            overflowY: "auto",
            background: C.s2,
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            boxShadow: "0 20px 50px rgba(0,0,0,0.45)",
            zIndex: 120,
            animation: "eh-pop .16s ease-out",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px 14px",
              borderBottom: `1px solid ${C.border}`,
            }}
          >
            <span style={{ fontFamily: FH, fontWeight: 700, fontSize: 14, color: C.text }}>Уведомления</span>
            {unreadNotifications > 0 && (
              <button
                onClick={markAllNotificationsRead}
                style={{ background: "none", border: "none", color: C.teal, fontSize: 12, fontWeight: 600, cursor: "pointer" }}
              >
                Прочитать всё
              </button>
            )}
          </div>
          {notifications.length === 0 && (
            <div style={{ padding: 20, textAlign: "center", color: C.muted, fontSize: 13 }}>Уведомлений пока нет</div>
          )}
          {notifications.map((n) => {
            const body = (
              <div
                onClick={() => {
                  markNotificationRead(n.id);
                  setOpen(false);
                }}
                style={{
                  display: "flex",
                  gap: 10,
                  padding: "12px 14px",
                  borderBottom: `1px solid ${C.border}`,
                  cursor: "pointer",
                  background: n.read ? "transparent" : `${C.teal}0c`,
                }}
              >
                {(() => { const Icon = TYPE_ICON[n.type]; return <Icon size={16} style={{ color: C.teal, flexShrink: 0, marginTop: 1 }}/>; })()}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: C.text, fontFamily: FB, lineHeight: 1.4 }}>{n.text}</div>
                  <div style={{ fontSize: 11, color: C.dim, marginTop: 3 }}>{n.date}</div>
                </div>
                {!n.read && <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.teal, marginTop: 5, flexShrink: 0 }} />}
              </div>
            );
            return n.link ? (
              <Link key={n.id} href={n.link} style={{ textDecoration: "none", display: "block" }}>
                {body}
              </Link>
            ) : (
              <div key={n.id}>{body}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}
