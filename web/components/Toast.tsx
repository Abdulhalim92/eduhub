"use client";

import { useEffect } from "react";
import { C, FH } from "@/lib/data";
import { Check } from "lucide-react";

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, [message, onDone]);

  if (!message) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 24,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 300,
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: C.s2,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: "12px 18px",
        boxShadow: "0 16px 40px rgba(0,0,0,0.45)",
        animation: "eh-pop .2s ease-out",
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: "50%",
          background: C.ok,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Check size={13} color={C.bg} />
      </span>
      <span style={{ fontFamily: FH, fontSize: 13, fontWeight: 600, color: C.text }}>{message}</span>
    </div>
  );
}
