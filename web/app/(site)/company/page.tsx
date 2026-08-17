"use client";

import Link from "next/link";
import { Target, ShieldCheck, MapPin, Mail, ArrowRight, Users, Building2, Briefcase } from "lucide-react";
import { C, FH, FB, PHOTOS, REGION_ORDER, REGION_LABEL } from "@/lib/data";
import { SubjectMotifs } from "@/components/SubjectMotifs";
import { useT } from "@/lib/i18n";

const RATING_CATEGORIES = [
  { ru: "Качество обучения", tg: "Сифати таълим" },
  { ru: "Условия и помещения", tg: "Шароит ва биноҳо" },
  { ru: "Безопасность", tg: "Бехатарӣ" },
  { ru: "Питание", tg: "Ғизо" },
  { ru: "Развозка", tg: "Расонидан" },
  { ru: "Цена/качество", tg: "Нарх/сифат" },
  { ru: "Участие родителей", tg: "Иштироки волидайн" },
  { ru: "Инклюзивность", tg: "Фарогирӣ" },
];

const AUDIENCE_LINKS = [
  { icon: Users, label: { ru: "Родителям и студентам", tg: "Ба волидайн ва донишҷӯён" }, href: "/guide/parents" },
  { icon: Briefcase, label: { ru: "Соискателям", tg: "Ба ҷуяндагони кор" }, href: "/guide/applicants" },
  { icon: Building2, label: { ru: "Учреждениям", tg: "Ба муассисаҳо" }, href: "/guide/institutions" },
];

export default function CompanyPage() {
  const t = useT();

  return (
    <div>
      {/* ── HERO ── */}
      <div style={{ position: "relative", overflow: "hidden", padding: "72px 28px 56px", textAlign: "center" }}>
        <img src={PHOTOS.campus2} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.3 }} />
        <div style={{ position: "absolute", inset: 0, background: `linear-gradient(180deg, ${C.overlay}99 0%, ${C.overlay}CC 60%, ${C.overlay} 100%)` }} />
        <SubjectMotifs />
        <div style={{ position: "relative", maxWidth: 700, margin: "0 auto" }}>
          <span style={{ display: "inline-flex", padding: "6px 14px", borderRadius: 999, border: `1px solid ${C.teal}66`, background: `${C.teal}22`, fontSize: 12.5, fontWeight: 700, color: C.teal, fontFamily: FH, marginBottom: 18 }}>
            {t("nav.about")}
          </span>
          <h1 style={{ fontFamily: FH, fontWeight: 900, fontSize: "clamp(28px,4vw,42px)", color: "#fff", marginBottom: 16, letterSpacing: "-.02em", lineHeight: 1.15 }}>
            {t({ ru: "Национальная платформа образования Таджикистана", tg: "Платформаи миллии маорифи Тоҷикистон" })}
          </h1>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,.75)", lineHeight: 1.7 }}>
            {t({
              ru: "Сегодня выбор сада, школы или вуза — это чаты, соцсети и советы знакомых. Мы строим EduHub, чтобы у каждой семьи в Таджикистане был один надёжный каталог с объективным рейтингом и честными отзывами.",
              tg: "Имрӯз интихоби боғча, мактаб ё донишгоҳ — ин чатҳо, шабакаҳои иҷтимоӣ ва маслиҳати шиносҳо. Мо EduHub-ро месозем, то ҳар оила дар Тоҷикистон як каталоги боэътимод бо рейтинги объективӣ ва шарҳҳои ростқавлона дошта бошад.",
            })}
          </p>
        </div>
      </div>

      {/* ── HOW RATING WORKS ── */}
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "56px 28px 0" }}>
        <h2 style={{ fontFamily: FH, fontWeight: 800, fontSize: 22, color: C.text, marginBottom: 6, display: "flex", alignItems: "center", gap: 9 }}>
          <Target size={20} style={{ color: C.teal }} /> {t({ ru: "Как считается рейтинг", tg: "Рейтинг чӣ гуна ҳисоб карда мешавад" })}
        </h2>
        <p style={{ fontSize: 14, color: C.sub, marginBottom: 24, maxWidth: 640 }}>
          {t({ ru: "Каждое учреждение оценивается родителями и студентами по объективным категориям — не общий балл «нравится/не нравится», а разбивка по конкретным критериям.", tg: "Ҳар муассиса аз ҷониби волидайн ва донишҷӯён аз рӯи категорияҳои объективӣ баҳогузорӣ мешавад — на балли умумии «маъқул/номаъқул», балки тақсимот аз рӯи меъёрҳои мушаххас." })}
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
          {RATING_CATEGORIES.map((c) => (
            <div key={c.ru} style={{ borderRadius: 12, border: `1px solid ${C.border}`, background: C.s1, padding: "14px 16px", fontSize: 13.5, fontWeight: 600, color: C.text, fontFamily: FH }}>
              {t(c)}
            </div>
          ))}
        </div>
      </div>

      {/* ── TRANSPARENCY ── */}
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "48px 28px 0" }}>
        <div style={{ borderRadius: 18, border: `1px solid ${C.border}`, background: C.s1, padding: 28, display: "flex", gap: 18, alignItems: "flex-start" }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: `${C.ok}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <ShieldCheck size={21} style={{ color: C.ok }} />
          </div>
          <div>
            <h3 style={{ fontFamily: FH, fontWeight: 800, fontSize: 17, color: C.text, marginBottom: 8 }}>
              {t({ ru: "Как мы модерируем отзывы", tg: "Мо шарҳҳоро чӣ гуна модератсия мекунем" })}
            </h3>
            <p style={{ fontSize: 14, color: C.sub, lineHeight: 1.65 }}>
              {t({
                ru: "Отзывы проверяются на спам и оскорбления, но не редактируются по содержанию и не удаляются по просьбе учреждения. Учреждение может публично ответить на отзыв в своём кабинете — это тоже видно всем.",
                tg: "Шарҳҳо аз назари спам ва таҳқир санҷида мешаванд, аммо аз рӯи мазмун таҳрир намешаванд ва бо дархости муассиса нест намешаванд. Муассиса метавонад ба шарҳ дар кабинети худ оммавӣ ҷавоб диҳад — ин низ ба ҳама намоён аст.",
              })}
            </p>
          </div>
        </div>
      </div>

      {/* ── REGIONS ── */}
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "48px 28px 0" }}>
        <h2 style={{ fontFamily: FH, fontWeight: 800, fontSize: 22, color: C.text, marginBottom: 6, display: "flex", alignItems: "center", gap: 9 }}>
          <MapPin size={20} style={{ color: C.teal }} /> {t({ ru: "География", tg: "Ҷуғрофия" })}
        </h2>
        <p style={{ fontSize: 14, color: C.sub, marginBottom: 20, maxWidth: 640 }}>
          {t({ ru: "Начали с Душанбе, расширяемся по регионам Таджикистана.", tg: "Аз Душанбе оғоз кардем, дар минтақаҳои Тоҷикистон паҳн мешавем." })}
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {REGION_ORDER.map((r) => (
            <span key={r} style={{ padding: "8px 16px", borderRadius: 999, border: `1px solid ${C.border}`, background: C.s1, fontSize: 13.5, fontWeight: 600, color: C.text, fontFamily: FH }}>
              {t(REGION_LABEL[r])}
            </span>
          ))}
        </div>
      </div>

      {/* ── AUDIENCE LINKS ── */}
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "48px 28px 0" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
          {AUDIENCE_LINKS.map((a) => (
            <Link key={a.href} href={a.href} style={{ display: "flex", alignItems: "center", gap: 10, borderRadius: 14, border: `1px solid ${C.border}`, background: C.s1, padding: "16px 18px", textDecoration: "none" }}>
              <a.icon size={18} style={{ color: C.teal, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: C.text, fontFamily: FH }}>{t(a.label)}</span>
              <ArrowRight size={14} style={{ color: C.dim }} />
            </Link>
          ))}
        </div>
      </div>

      {/* ── CONTACT ── */}
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "56px 28px 80px", textAlign: "center" }}>
        <Mail size={24} style={{ color: C.teal, marginBottom: 12 }} />
        <h2 style={{ fontFamily: FH, fontWeight: 800, fontSize: 18, color: C.text, marginBottom: 8 }}>
          {t({ ru: "Есть вопросы?", tg: "Савол доред?" })}
        </h2>
        <p style={{ fontSize: 13.5, color: C.sub, marginBottom: 16 }}>
          <a href="mailto:info@eduhub.tj" style={{ color: C.teal, fontWeight: 700, textDecoration: "none" }}>info@eduhub.tj</a>
        </p>
        <Link href="/about" style={{ fontSize: 13, color: C.dim, fontFamily: FH, textDecoration: "none" }}>
          {t({ ru: "Вы инвестор или партнёр?", tg: "Шумо сармоягузор ё шарик ҳастед?" })} →
        </Link>
      </div>
    </div>
  );
}
