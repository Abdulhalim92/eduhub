"use client";

import Link from "next/link";
import { C, FH, FB, CATEGORY_META, type CategoryKey } from "@/lib/data";
import { useT } from "@/lib/i18n";

const CATEGORY_KEYS: CategoryKey[] = ["cat_kg", "cat_school", "cat_center", "cat_uni"];

export function Footer() {
  const t = useT();

  return (
    <footer style={{ borderTop: `1px solid ${C.border}`, marginTop: 40 }}>
      <div style={{ maxWidth: 1260, margin: "0 auto", padding: "40px 28px", display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", gap: 24 }}>
        <div>
          <span style={{ fontFamily: FH, fontWeight: 900, fontSize: 18, color: C.text }}>
            Edu<span style={{ color: C.gold }}>Hub</span>
          </span>
          <p style={{ fontSize: 13, color: C.sub, marginTop: 10, lineHeight: 1.6, maxWidth: 280 }}>
            {t({ ru: "Национальная платформа поиска, сравнения и оценки образовательных учреждений Таджикистана.", tg: "Платформаи миллии ҷустуҷӯ, муқоиса ва бақои муассисаҳои таълимии Тоҷикистон." })}
          </p>
        </div>

        <div>
          <p style={{ fontFamily: FH, fontWeight: 700, fontSize: 12, color: C.dim, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 12 }}>
            {t("nav.categories")}
          </p>
          {CATEGORY_KEYS.map((k) => (
            <Link key={k} href={`/${CATEGORY_META[k].slug}`} style={{ display: "block", fontSize: 13.5, color: C.sub, fontFamily: FB, textDecoration: "none", marginBottom: 8 }}>
              {t(CATEGORY_META[k].plural)}
            </Link>
          ))}
        </div>

        <div>
          <p style={{ fontFamily: FH, fontWeight: 700, fontSize: 12, color: C.dim, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 12 }}>
            {t("nav.guides")}
          </p>
          <Link href="/guide/parents" style={{ display: "block", fontSize: 13.5, color: C.sub, fontFamily: FB, textDecoration: "none", marginBottom: 8 }}>{t("nav.guide.parents")}</Link>
          <Link href="/guide/students" style={{ display: "block", fontSize: 13.5, color: C.sub, fontFamily: FB, textDecoration: "none", marginBottom: 8 }}>{t("nav.guide.students")}</Link>
          <Link href="/guide/applicants" style={{ display: "block", fontSize: 13.5, color: C.sub, fontFamily: FB, textDecoration: "none", marginBottom: 8 }}>{t("nav.guide.applicants")}</Link>
          <Link href="/guide/institutions" style={{ display: "block", fontSize: 13.5, color: C.sub, fontFamily: FB, textDecoration: "none", marginBottom: 8 }}>{t("nav.guide.institutions")}</Link>
        </div>

        <div>
          <p style={{ fontFamily: FH, fontWeight: 700, fontSize: 12, color: C.dim, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 12 }}>
            {t({ ru: "Платформа", tg: "Платформа" })}
          </p>
          <Link href="/search" style={{ display: "block", fontSize: 13.5, color: C.sub, fontFamily: FB, textDecoration: "none", marginBottom: 8 }}>{t("nav.search")}</Link>
          <Link href="/vacancies" style={{ display: "block", fontSize: 13.5, color: C.sub, fontFamily: FB, textDecoration: "none", marginBottom: 8 }}>{t("nav.vacancies")}</Link>
          <Link href="/company" style={{ display: "block", fontSize: 13.5, color: C.sub, fontFamily: FB, textDecoration: "none", marginBottom: 8 }}>{t("nav.about")}</Link>
          <Link href="/account" style={{ display: "block", fontSize: 13.5, color: C.sub, fontFamily: FB, textDecoration: "none", marginBottom: 8 }}>{t("nav.cabinet")}</Link>
          <Link href="/about" style={{ display: "block", fontSize: 13.5, color: C.sub, fontFamily: FB, textDecoration: "none", marginBottom: 8 }}>{t({ ru: "Для партнёров и инвесторов", tg: "Барои шарикон ва сармоягузорон" })}</Link>
        </div>
      </div>
      <div style={{ borderTop: `1px solid ${C.border}`, padding: "16px 28px", textAlign: "center", fontSize: 12, color: C.dim }}>
        © 2026 EduHub Tajikistan · {t({ ru: "Душанбе", tg: "Душанбе" })}
      </div>
    </footer>
  );
}
