"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Baby, Bookmark, MessageSquare, Plus, Settings, Star, Trash2, X, type LucideIcon } from "lucide-react";
import { C, FH, FB, INSTITUTIONS, REVIEWS } from "@/lib/data";
import { useAppState } from "@/lib/app-state";
import { chatHref } from "@/lib/chat-window";
import { useT } from "@/lib/i18n";
import { Toast } from "./Toast";

type Tab = "saved" | "reviews" | "messages" | "children" | "settings";

const MY_REVIEW_IDS = ["r1", "r3", "r6"];

export function UserCabinet({ variant }: { variant: "user" | "parent" }) {
  const router = useRouter();
  const { savedIds, toggleSaved } = useAppState();
  const t = useT();
  const [tab, setTab] = useState<Tab>("saved");
  const [toast, setToast] = useState<string | null>(null);
  const [children, setChildren] = useState<{ id: number; name: string; age: string }[]>(
    variant === "parent" ? [{ id: 1, name: "Санги Давлатов", age: t({ru:"11 лет",tg:"11-сола"}) }] : []
  );
  const [childName, setChildName] = useState("");
  const [childAge, setChildAge] = useState("");
  const [name, setName] = useState(variant === "parent" ? "Мадина Юсупова" : "Фаррух Тохиров");
  const [phone, setPhone] = useState("+992 93 000-00-00");
  const [email, setEmail] = useState("");

  const savedInstitutions = INSTITUTIONS.filter((i) => savedIds.includes(i.id));
  const myReviews = REVIEWS.filter((r) => MY_REVIEW_IDS.includes(r.id));

  const TABS: { k: Tab; label: string; icon: LucideIcon }[] =
    variant === "parent"
      ? [
          { k: "saved", label: t({ru:"Избранное",tg:"Интихобшуда"}), icon: Bookmark },
          { k: "reviews", label: t({ru:"Мои отзывы",tg:"Шарҳҳои ман"}), icon: Star },
          { k: "messages", label: t({ru:"Сообщения",tg:"Паёмҳо"}), icon: MessageSquare },
          { k: "children", label: t({ru:"Дети",tg:"Фарзандон"}), icon: Baby },
          { k: "settings", label: t({ru:"Настройки",tg:"Танзимот"}), icon: Settings },
        ]
      : [
          { k: "saved", label: t({ru:"Избранное",tg:"Интихобшуда"}), icon: Bookmark },
          { k: "reviews", label: t({ru:"Мои отзывы",tg:"Шарҳҳои ман"}), icon: Star },
          { k: "messages", label: t({ru:"Сообщения",tg:"Паёмҳо"}), icon: MessageSquare },
          { k: "settings", label: t({ru:"Настройки",tg:"Танзимот"}), icon: Settings },
        ];

  function addChild() {
    if (!childName.trim()) return;
    setChildren((prev) => [...prev, { id: Date.now(), name: childName.trim(), age: childAge.trim() || "—" }]);
    setChildName("");
    setChildAge("");
  }

  function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setToast(t("common.saved"));
  }

  return (
    <div style={{ maxWidth: 1080, margin: "0 auto", padding: "28px 28px 90px", fontFamily: FB }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: FH, fontWeight: 900, fontSize: "clamp(22px,3vw,30px)", color: C.text, letterSpacing: "-.02em" }}>
          {variant === "parent" ? t({ru:"Кабинет родителя",tg:"Кабинети волидайн"}) : t({ru:"Личный кабинет",tg:"Кабинети шахсӣ"})}
        </h1>
        <p style={{ fontSize: 14, color: C.sub, marginTop: 4 }}>{name}</p>
      </div>

      <div style={{ display: "flex", gap: 2, borderBottom: `1px solid ${C.border}`, marginBottom: 28, overflowX: "auto" }}>
        {TABS.map(({ k, label, icon: Icon }) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "12px 14px", fontFamily: FH, fontWeight: 700, fontSize: 13, color: tab === k ? C.teal : C.muted, borderBottom: `2px solid ${tab === k ? C.teal : "transparent"}`, whiteSpace: "nowrap", background: "none", borderLeft: "none", borderRight: "none", borderTop: "none", cursor: "pointer" }}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === "saved" && (
        <div>
          {savedInstitutions.length === 0 ? (
            <div style={{ padding: 48, borderRadius: 16, border: `1px dashed ${C.border}`, textAlign: "center", color: C.muted }}>
              <Bookmark size={28} style={{ color: C.dim, margin: "0 auto 12px" }} />
              <p style={{ fontFamily: FH, fontWeight: 700, fontSize: 16, color: C.text, marginBottom: 6 }}>{t({ru:"Пока пусто",tg:"Ҳоло холӣ аст"})}</p>
              <p style={{ fontSize: 13.5, marginBottom: 14 }}>{t({ru:"Нажмите на ♡ на карточке учреждения, чтобы сохранить его сюда",tg:"Дар корти муассиса ♡-ро пахш кунед, то онро дар ин ҷо нигоҳ доред"})}</p>
              <button onClick={() => router.push("/search")} style={{ padding: "9px 20px", borderRadius: 10, background: C.teal, color: C.overlay, fontFamily: FH, fontWeight: 700, fontSize: 13.5, border: "none", cursor: "pointer" }}>
                {t({ru:"Перейти к поиску",tg:"Ба ҷустуҷӯ гузаред"})}
              </button>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 14 }}>
              {savedInstitutions.map((inst) => (
                <div key={inst.id} style={{ borderRadius: 16, border: `1px solid ${C.border}`, background: C.s1, overflow: "hidden" }}>
                  <div style={{ height: 110, position: "relative" }}>
                    <img src={inst.coverPhoto} alt={t(inst.name)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <button
                      onClick={() => toggleSaved(inst.id)}
                      aria-label={t({ru:"Убрать из избранного",tg:"Аз интихобшуда бардоштан"})}
                      style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: "50%", background: "rgba(0,0,0,.5)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#fff" }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                  <div style={{ padding: "12px 14px" }}>
                    <p style={{ fontFamily: FH, fontWeight: 700, fontSize: 14, color: C.text, marginBottom: 8 }}>{t(inst.name)}</p>
                    <button
                      onClick={() => router.push(`/institutions/${inst.id}`)}
                      style={{ width: "100%", padding: "8px", borderRadius: 9, background: C.s3, color: C.text, fontFamily: FH, fontWeight: 700, fontSize: 12.5, border: "none", cursor: "pointer" }}
                    >
                      {t("common.open")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "reviews" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {myReviews.length === 0 && <p style={{ color: C.muted, fontSize: 14 }}>{t({ru:"Вы ещё не оставляли отзывов",tg:"Шумо ҳанӯз шарҳ нагузоштаед"})}</p>}
          {myReviews.map((r) => {
            const inst = INSTITUTIONS.find((i) => i.id === r.instId);
            return (
              <button key={r.id} onClick={() => inst && router.push(`/institutions/${inst.id}?tab=reviews&review=${r.id}`)}
                style={{ display: "block", width: "100%", textAlign: "left", cursor: inst ? "pointer" : "default", borderRadius: 16, border: `1px solid ${C.border}`, background: C.s1, padding: "16px 18px", font: "inherit" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <p style={{ fontFamily: FH, fontWeight: 700, fontSize: 14, color: C.text }}>{inst ? t(inst.name) : t({ru:"Учреждение",tg:"Муассиса"})}</p>
                    <p style={{ fontSize: 12, color: C.sub }}>{r.date}</p>
                  </div>
                  <span style={{ color: C.gold, fontFamily: FH, fontWeight: 700, fontSize: 13 }}>{r.score} ★</span>
                </div>
                <p style={{ fontSize: 13.5, color: C.sub, lineHeight: 1.6 }}>{t(r.text)}</p>
              </button>
            );
          })}
        </div>
      )}

      {tab === "messages" && (
        <div style={{ borderRadius: 18, border: `1px solid ${C.border}`, background: C.s1, padding: 32, textAlign: "center" }}>
          <MessageSquare size={30} style={{ color: C.teal, margin: "0 auto 14px" }} />
          <p style={{ fontFamily: FH, fontWeight: 800, fontSize: 17, color: C.text, marginBottom: 8 }}>{t({ru:"Все переписки — в чате",tg:"Ҳама мукотиба — дар чат"})}</p>
          <p style={{ fontSize: 13.5, color: C.sub, marginBottom: 18, maxWidth: 380, margin: "0 auto 18px" }}>
            {t({ru:"Сообщения с учреждениями открываются в отдельном окне чата — на любой странице сайта.",tg:"Паёмҳо бо муассисаҳо дар равзанаи алоҳидаи чат кушода мешаванд — дар ҳар саҳифаи сомона."})}
          </p>
          <button onClick={() => router.push(chatHref())} style={{ padding: "10px 22px", borderRadius: 12, background: C.teal, color: C.overlay, fontFamily: FH, fontWeight: 800, fontSize: 14, border: "none", cursor: "pointer" }}>
            {t({ru:"Открыть чат",tg:"Чатро кушодан"})}
          </button>
        </div>
      )}

      {tab === "children" && variant === "parent" && (
        <div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
            {children.map((c) => (
              <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 14, border: `1px solid ${C.border}`, background: C.s1, padding: "14px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${C.teal}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Baby size={16} style={{ color: C.teal }} />
                  </div>
                  <div>
                    <p style={{ fontFamily: FH, fontWeight: 700, fontSize: 14, color: C.text }}>{c.name}</p>
                    <p style={{ fontSize: 12.5, color: C.sub }}>{c.age}</p>
                  </div>
                </div>
                <button onClick={() => setChildren((prev) => prev.filter((x) => x.id !== c.id))} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
          <div style={{ borderRadius: 16, border: `1px solid ${C.border}`, background: C.s1, padding: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input value={childName} onChange={(e) => setChildName(e.target.value)} placeholder={t({ru:"Имя ребёнка",tg:"Номи фарзанд"})} style={{ flex: 1, minWidth: 160, padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.s2, color: C.text, fontFamily: FB, fontSize: 14, outline: "none" }} />
            <input value={childAge} onChange={(e) => setChildAge(e.target.value)} placeholder={t({ru:"Возраст",tg:"Синну сол"})} style={{ width: 120, padding: "10px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.s2, color: C.text, fontFamily: FB, fontSize: 14, outline: "none" }} />
            <button onClick={addChild} style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", borderRadius: 10, background: C.teal, color: C.overlay, fontFamily: FH, fontWeight: 700, fontSize: 13.5, border: "none", cursor: "pointer" }}>
              <Plus size={14} /> {t("common.add")}
            </button>
          </div>
        </div>
      )}

      {tab === "settings" && (
        <form onSubmit={saveSettings} style={{ borderRadius: 18, border: `1px solid ${C.border}`, background: C.s1, padding: 26, maxWidth: 480 }}>
          <h2 style={{ fontFamily: FH, fontWeight: 800, fontSize: 17, color: C.text, marginBottom: 18 }}>{t({ru:"Личные данные",tg:"Маълумоти шахсӣ"})}</h2>
          {[
            { label: t({ru:"Имя",tg:"Ном"}), value: name, set: setName, type: "text" },
            { label: t({ru:"Телефон",tg:"Телефон"}), value: phone, set: setPhone, type: "tel" },
            { label: t({ru:"Эл. почта",tg:"Почтаи электронӣ"}), value: email, set: setEmail, type: "email" },
          ].map((f) => (
            <div key={f.label} style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: C.dim, textTransform: "uppercase", letterSpacing: ".05em", fontFamily: FH, marginBottom: 6 }}>{f.label}</label>
              <input
                type={f.type}
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
                style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: `1px solid ${C.border}`, background: C.s2, color: C.text, fontFamily: FB, fontSize: 14, outline: "none", boxSizing: "border-box" }}
              />
            </div>
          ))}
          <button type="submit" style={{ marginTop: 6, padding: "11px 22px", borderRadius: 11, background: C.teal, color: C.overlay, fontFamily: FH, fontWeight: 800, fontSize: 14, border: "none", cursor: "pointer" }}>
            {t("common.save")}
          </button>
        </form>
      )}

      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
