"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ArrowRight, type LucideIcon } from "lucide-react";
import { C, FH, FB, type Bi } from "@/lib/data";
import { useT } from "@/lib/i18n";
import { SubjectMotifs } from "./SubjectMotifs";

export interface GuideStep { icon: LucideIcon; title: Bi; desc: Bi; }
export interface GuideFaq { q: Bi; a: Bi; }

export function GuidePage({
  heroPhoto, eyebrow, title, subtitle, steps, faq, ctaLabel, ctaHref, secondaryLabel, secondaryHref, accent,
}: {
  heroPhoto: string;
  eyebrow: Bi;
  title: Bi;
  subtitle: Bi;
  steps: GuideStep[];
  faq: GuideFaq[];
  ctaLabel: Bi;
  ctaHref: string;
  secondaryLabel: Bi;
  secondaryHref: string;
  accent: string;
}) {
  const t = useT();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div>
      {/* ── HERO ── */}
      <div style={{ position: "relative", overflow: "hidden", padding: "72px 28px 64px", textAlign: "center" }}>
        <img src={heroPhoto} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.24 }} />
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${C.overlay}CC 0%, ${C.overlay}EE 55%, ${C.overlay} 100%)` }} />
        <SubjectMotifs/>
        <div style={{ position: "relative", maxWidth: 680, margin: "0 auto" }}>
          <span style={{ display: "inline-flex", padding: "6px 14px", borderRadius: 999, border: `1px solid ${accent}66`, background: `${accent}22`, fontSize: 12.5, fontWeight: 700, color: accent, fontFamily: FH, marginBottom: 18 }}>
            {t(eyebrow)}
          </span>
          <h1 style={{ fontFamily: FH, fontWeight: 900, fontSize: "clamp(28px,4vw,44px)", color: "#fff", marginBottom: 14, letterSpacing: "-.02em", lineHeight: 1.15 }}>
            {t(title)}
          </h1>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,.72)", lineHeight: 1.65, marginBottom: 30 }}>{t(subtitle)}</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href={ctaHref} style={{ padding: "12px 24px", borderRadius: 12, background: accent, color: C.overlay, fontFamily: FH, fontWeight: 800, fontSize: 14, textDecoration: "none" }}>
              {t(ctaLabel)}
            </Link>
            <Link href={secondaryHref} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "12px 6px", color: "rgba(255,255,255,.75)", fontFamily: FH, fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
              {t(secondaryLabel)} <ArrowRight size={15}/>
            </Link>
          </div>
        </div>
      </div>

      {/* ── STEPS ── */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 28px 64px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {steps.map((s, i) => {
            const Icon = s.icon;
            return (
              <div key={i} style={{ display: "flex", gap: 18, alignItems: "flex-start", borderRadius: 16, border: `1px solid ${C.border}`, background: C.s1, padding: "20px 22px" }}>
                <div style={{ width: 42, height: 42, borderRadius: 12, background: `${accent}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Icon size={19} style={{ color: accent }} />
                </div>
                <div>
                  <p style={{ fontFamily: FH, fontWeight: 800, fontSize: 15.5, color: C.text, marginBottom: 5 }}>
                    {i + 1}. {t(s.title)}
                  </p>
                  <p style={{ fontSize: 13.5, color: C.sub, lineHeight: 1.6 }}>{t(s.desc)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── FAQ ── */}
      <div style={{ maxWidth: 780, margin: "0 auto", padding: "0 28px 90px" }}>
        <h2 style={{ fontFamily: FH, fontWeight: 800, fontSize: 22, color: C.text, marginBottom: 20, textAlign: "center" }}>
          {t({ ru: "Частые вопросы", tg: "Саволҳои маъмул" })}
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {faq.map((f, i) => {
            const isOpen = openFaq === i;
            return (
              <div key={i} style={{ borderRadius: 14, border: `1px solid ${C.border}`, background: C.s1, overflow: "hidden" }}>
                <button
                  onClick={() => setOpenFaq(isOpen ? null : i)}
                  style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", padding: "16px 18px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
                >
                  <span style={{ fontFamily: FH, fontWeight: 700, fontSize: 14, color: C.text }}>{t(f.q)}</span>
                  <ChevronDown size={16} style={{ color: C.muted, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform .15s", flexShrink: 0 }} />
                </button>
                {isOpen && (
                  <p style={{ padding: "0 18px 16px", fontSize: 13.5, color: C.sub, lineHeight: 1.65, fontFamily: FB }}>{t(f.a)}</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
