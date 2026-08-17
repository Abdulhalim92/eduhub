"use client";

import Link from "next/link";
import { Briefcase, Wallet, Clock, ChevronRight } from "lucide-react";
import { C, FH, PHOTOS, VACANCIES, INSTITUTIONS, CATEGORY_META } from "@/lib/data";
import { SubjectMotifs } from "@/components/SubjectMotifs";
import { useReveal, revealStyle } from "@/lib/useReveal";
import { useT } from "@/lib/i18n";

export default function VacanciesPage() {
  const t = useT();
  const { ref, visible } = useReveal<HTMLDivElement>();
  const vacancies = VACANCIES.filter(v => v.status === "published");

  return (
    <div>
      {/* ── HERO ── */}
      <div style={{ position: "relative", height: 260, overflow: "hidden" }}>
        <img src={PHOTOS.heroGuideA} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${C.overlay}55 0%, ${C.overlay}D8 75%, ${C.overlay} 100%)` }} />
        <SubjectMotifs/>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end" }}>
          <div style={{ maxWidth: 1260, margin: "0 auto", padding: "0 28px 28px", width: "100%" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: `${C.teal}22`, border: `1px solid ${C.teal}44`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Briefcase size={20} style={{ color: C.teal }}/>
            </div>
            <h1 style={{ fontFamily: FH, fontWeight: 900, fontSize: "clamp(24px,3.4vw,38px)", color: "#fff", margin: "10px 0 6px", letterSpacing: "-.02em" }}>
              {t({ ru: "Вакансии в образовательных учреждениях", tg: "Ҷойҳои холӣ дар муассисаҳои таълимӣ" })}
            </h1>
            <p style={{ fontSize: 14.5, color: "rgba(255,255,255,.72)", maxWidth: 560 }}>
              {t({ ru: "Открытые вакансии от школ, детских садов, центров и вузов Таджикистана", tg: "Ҷойҳои холии кушода аз мактабҳо, боғчаҳо, марказҳо ва донишгоҳҳои Тоҷикистон" })}
            </p>
          </div>
        </div>
      </div>

      {/* ── LIST ── */}
      <div style={{ maxWidth: 1260, margin: "0 auto", padding: "28px 28px 80px" }}>
        {vacancies.length === 0 ? (
          <div style={{ padding: 56, borderRadius: 16, border: `1px dashed ${C.border}`, textAlign: "center", color: C.muted }}>
            <p style={{ fontFamily: FH, fontWeight: 800, fontSize: 17, color: C.text }}>{t("empty.vacancies")}</p>
          </div>
        ) : (
          <div ref={ref} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {vacancies.map((v, i) => {
              const inst = INSTITUTIONS.find(x => x.id === v.instId);
              const meta = inst ? CATEGORY_META[inst.tk] : null;
              const Icon = meta?.icon;
              return (
                <Link key={v.id} href={`/vacancies/${v.id}`} style={{ ...revealStyle(visible, Math.min(i, 8) * 45), display: "flex", alignItems: "center", gap: 16, borderRadius: 16, border: `1px solid ${C.border}`, background: C.s1, padding: "18px 20px", textDecoration: "none", transition: "border-color .15s" }}>
                  {Icon && meta && (
                    <div style={{ width: 46, height: 46, borderRadius: 12, background: `${meta.color}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon size={21} style={{ color: meta.color }}/>
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: FH, fontWeight: 700, fontSize: 15, color: C.text }}>{t(v.title)}</p>
                    <p style={{ fontSize: 13, color: C.sub, marginTop: 2 }}>{inst ? t(inst.name) : ""}{inst ? ` · ${inst.area}` : ""}</p>
                    <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
                      {v.salaryFrom && (
                        <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: C.sub }}>
                          <Wallet size={12}/> {v.salaryFrom}–{v.salaryTo} {t("common.perMonth")}
                        </span>
                      )}
                      <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12.5, color: C.sub }}>
                        <Clock size={12}/> {t(v.employment)}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={18} style={{ color: C.dim, flexShrink: 0 }}/>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
