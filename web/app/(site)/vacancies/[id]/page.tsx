"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Briefcase, Wallet, Clock, CalendarDays, CheckCircle2, MessageSquare, ChevronRight } from "lucide-react";
import { C, FH, VACANCIES, INSTITUTIONS, CATEGORY_META } from "@/lib/data";
import { chatHref } from "@/lib/chat-window";
import { useT } from "@/lib/i18n";

export default function VacancyDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const t = useT();
  const vacancy = VACANCIES.find(v => v.id === params.id);

  if (!vacancy) {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "80px 28px", textAlign: "center" }}>
        <p style={{ fontFamily: FH, fontWeight: 800, fontSize: 18, color: C.text, marginBottom: 16 }}>{t("empty.notFound")}</p>
        <Link href="/vacancies" style={{ color: C.teal, fontFamily: FH, fontWeight: 700, fontSize: 14, textDecoration: "none" }}>{t("common.back")}</Link>
      </div>
    );
  }

  const inst = INSTITUTIONS.find(i => i.id === vacancy.instId);
  const meta = inst ? CATEGORY_META[inst.tk] : null;
  const Icon = meta?.icon ?? Briefcase;

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "28px 28px 80px" }}>
      <button onClick={() => router.back()} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 8, background: "none", border: `1px solid ${C.border}`, color: C.sub, fontFamily: FH, fontWeight: 700, fontSize: 13, cursor: "pointer", marginBottom: 22 }}>
        <ArrowLeft size={14}/> {t("common.back")}
      </button>

      <div style={{ borderRadius: 18, border: `1px solid ${C.border}`, background: C.s1, padding: 28, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14, marginBottom: 18 }}>
          <div style={{ width: 52, height: 52, borderRadius: 12, background: `${meta?.color ?? C.teal}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon size={24} style={{ color: meta?.color ?? C.teal }}/>
          </div>
          <div>
            <h1 style={{ fontFamily: FH, fontWeight: 900, fontSize: "clamp(20px,2.6vw,28px)", color: C.text, letterSpacing: "-.01em", marginBottom: 6 }}>
              {t(vacancy.title)}
            </h1>
            {inst && (
              <Link href={`/institutions/${inst.id}`} style={{ fontSize: 14, color: C.teal, fontFamily: FH, fontWeight: 700, textDecoration: "none" }}>
                {t(inst.name)}
              </Link>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
          {vacancy.salaryFrom && (
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13.5, color: C.text }}>
              <Wallet size={15} style={{ color: C.teal }}/> {vacancy.salaryFrom}–{vacancy.salaryTo} {t("common.perMonth")}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13.5, color: C.text }}>
            <Clock size={15} style={{ color: C.teal }}/> {t(vacancy.employment)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13.5, color: C.text }}>
            <CalendarDays size={15} style={{ color: C.teal }}/> {vacancy.date}
          </div>
        </div>
      </div>

      <div style={{ borderRadius: 18, border: `1px solid ${C.border}`, background: C.s1, padding: 28, marginBottom: 20 }}>
        <h2 style={{ fontFamily: FH, fontWeight: 800, fontSize: 16, color: C.text, marginBottom: 12 }}>
          {t({ ru: "Описание", tg: "Тавсиф" })}
        </h2>
        <p style={{ fontSize: 14.5, color: C.sub, lineHeight: 1.7, marginBottom: 22 }}>{t(vacancy.description)}</p>

        <h2 style={{ fontFamily: FH, fontWeight: 800, fontSize: 16, color: C.text, marginBottom: 12 }}>
          {t({ ru: "Требования", tg: "Талабот" })}
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {vacancy.requirements.map((r, i) => (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, color: C.sub }}>
              <CheckCircle2 size={15} style={{ color: C.ok, flexShrink: 0, marginTop: 2 }}/> {t(r)}
            </div>
          ))}
        </div>
      </div>

      <Link href={chatHref(vacancy.instId)} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: 14, borderRadius: 12, background: C.teal, color: C.overlay, fontFamily: FH, fontWeight: 800, fontSize: 15, textDecoration: "none" }}>
        <MessageSquare size={17}/> {t({ ru: "Откликнуться", tg: "Ҷавоб додан" })}
      </Link>

      {inst && (
        <Link href={`/institutions/${inst.id}`} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 14, color: C.sub, fontFamily: FH, fontWeight: 700, fontSize: 13.5, textDecoration: "none" }}>
          {t({ ru: "Перейти в профиль учреждения", tg: "Ба профили муассиса гузаред" })} <ChevronRight size={14}/>
        </Link>
      )}
    </div>
  );
}
