"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Calendar, Eye, Tag } from "lucide-react";
import { C, FH, FB, NEWS_ITEMS, INSTITUTIONS } from "@/lib/data";
import { useT } from "@/lib/i18n";

export default function NewsArticlePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const t = useT();
  const article = NEWS_ITEMS.find((n) => n.id === params.id);

  if (!article) {
    return (
      <div style={{ padding: 60, textAlign: "center", color: C.muted, fontFamily: FB }}>
        <p style={{ fontFamily: FH, fontWeight: 800, fontSize: 18, color: C.text, marginBottom: 8 }}>{t({ru:"Новость не найдена",tg:"Хабар ёфт нашуд"})}</p>
        <button onClick={() => router.push("/")} style={{ marginTop: 8, color: C.teal, fontFamily: FH, fontWeight: 700, fontSize: 13.5, background:"none", border:"none", cursor:"pointer" }}>
          {t("nav.home")}
        </button>
      </div>
    );
  }

  const inst = INSTITUTIONS.find((i) => i.id === article.instId);

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "24px 28px 90px", fontFamily: FB }}>
      <button
        onClick={() => (inst ? router.push(`/institutions/${inst.id}`) : router.push("/"))}
        style={{ display: "inline-flex", alignItems: "center", gap: 7, fontFamily: FH, fontWeight: 700, fontSize: 13.5, color: C.teal, marginBottom: 22, padding: "8px 14px", borderRadius: 9, border: `1px solid ${C.teal}40`, background: `${C.teal}10`, cursor:"pointer" }}
      >
        <ArrowLeft size={15} /> {inst ? `${t({ru:"К профилю",tg:"Ба профил"})} «${t(inst.name)}»` : t("common.back")}
      </button>

      {article.coverUrl && (
        <div style={{ borderRadius: 20, overflow: "hidden", height: 320, marginBottom: 24 }}>
          <img src={article.coverUrl} alt={t(article.title)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      )}

      <span style={{ fontSize: 12, fontWeight: 700, color: C.teal, fontFamily: FH, textTransform: "uppercase", letterSpacing: ".06em" }}>{t(article.category)}</span>
      <h1 style={{ fontFamily: FH, fontWeight: 900, fontSize: "clamp(22px,3vw,32px)", color: C.text, margin: "10px 0 16px", lineHeight: 1.2 }}>{t(article.title)}</h1>

      <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 26, paddingBottom: 20, borderBottom: `1px solid ${C.border}`, flexWrap: "wrap" }}>
        {inst && (
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.sub }}>
            <span style={{ width: 22, height: 22, borderRadius: "50%", background: inst.color, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: FH, fontWeight: 800, fontSize: 10, color: C.overlay }}>{t(inst.name)[0]}</span>
            {t(inst.name)}
          </span>
        )}
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.muted }}>
          <Calendar size={13} /> {article.date}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: C.muted }}>
          <Eye size={13} /> {article.views} {t({ru:"просмотров",tg:"дидан"})}
        </span>
      </div>

      <p style={{ fontSize: 15.5, color: C.text, lineHeight: 1.85, whiteSpace: "pre-line" }}>{t(article.content)}</p>

      {article.tags.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 28 }}>
          {article.tags.map((tag) => (
            <span key={tag.ru} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, padding: "5px 12px", borderRadius: 8, background: C.s2, color: C.sub, fontFamily: FH }}>
              <Tag size={11} /> {t(tag)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
