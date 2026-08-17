"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, X, Medal, Trophy } from "lucide-react";
import { Modal } from "./ui/Modal";
import { C, FH, FB, type Achievement, type Bi } from "@/lib/data";
import { useT } from "@/lib/i18n";

const CAT_LABEL: Record<Achievement["category"], Bi> = {
  gold: { ru: "Золото", tg: "Тилло" },
  silver: { ru: "Серебро", tg: "Нуқра" },
  bronze: { ru: "Бронза", tg: "Биринҷӣ" },
  special: { ru: "Особое", tg: "Махсус" },
};
const CAT_COLOR: Record<Achievement["category"], string> = {
  gold: C.gold,
  silver: C.sub,
  bronze: C.goldD,
  special: C.teal,
};
const CAT_ICON: Record<Achievement["category"], typeof Medal> = {
  gold: Medal, silver: Medal, bronze: Medal, special: Trophy,
};
const TYPE_LABEL: Record<Achievement["type"], Bi> = {
  institution: { ru: "Учреждение", tg: "Муассиса" },
  student: { ru: "Ученик", tg: "Хонанда" },
  teacher: { ru: "Педагог", tg: "Омӯзгор" },
};

export function achievementHref(pathname: string, searchParams: URLSearchParams, id: string) {
  const params = new URLSearchParams(searchParams.toString());
  params.set("achievement", id);
  return `${pathname}?${params.toString()}`;
}

export function AchievementModal({ achievements }: { achievements: Achievement[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useT();
  const id = searchParams.get("achievement");
  const achievement = id ? achievements.find((a) => a.id === id) ?? null : null;

  const CatIcon = achievement ? CAT_ICON[achievement.category] : Trophy;

  function close() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("achievement");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <Modal open={!!achievement} onClose={close} maxWidth={480}>
      {achievement && (
        <div style={{ padding: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 12,
                background: `${CAT_COLOR[achievement.category]}22`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CatIcon size={24} style={{ color: CAT_COLOR[achievement.category] }}/>
            </div>
            <button
              onClick={close}
              aria-label="Закрыть"
              style={{ background: "none", border: "none", color: C.sub, cursor: "pointer", padding: 6 }}
            >
              <X size={20} />
            </button>
          </div>

          <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: CAT_COLOR[achievement.category],
                background: `${CAT_COLOR[achievement.category]}18`,
                padding: "4px 10px",
                borderRadius: 8,
              }}
            >
              {t(CAT_LABEL[achievement.category])}
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: C.sub,
                background: C.s3,
                padding: "4px 10px",
                borderRadius: 8,
              }}
            >
              {t(TYPE_LABEL[achievement.type])}
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, color: C.dim, alignSelf: "center" }}>{achievement.year}</span>
          </div>

          <h3 style={{ fontFamily: FH, fontSize: 22, fontWeight: 800, color: C.text, marginTop: 14, lineHeight: 1.25 }}>
            {t(achievement.title)}
          </h3>
          <p style={{ fontFamily: FB, fontSize: 15, color: C.sub, marginTop: 10, lineHeight: 1.6 }}>{t(achievement.desc)}</p>

          {achievement.links && achievement.links.length > 0 && (
            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 8 }}>
              {achievement.links.map((l) => (
                <a
                  key={l.url}
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    color: C.teal,
                    background: C.s3,
                    padding: "10px 14px",
                    borderRadius: 10,
                    textDecoration: "none",
                  }}
                >
                  <ExternalLink size={15} /> {l.label}
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
