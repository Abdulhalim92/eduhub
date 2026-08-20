"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { NOTIFICATIONS, DEFAULT_APPLICANT, type Notification, type Region, type Applicant, type Application } from "./data";
import type { Locale } from "./i18n";

// RBAC (SRS §3): уровни доступа. "Родитель"/"соискатель" — НЕ роли, а факты о
// пользователе (children_.length>0 / applicant.visibility) — см. ChildLink и Applicant ниже.
export type Role = "guest" | "user" | "institution";

// Минимальная привязка «родитель–ребёнок–учреждение» (SRS §7, сущность Child) —
// только age/status/institution, без лишних данных о ребёнке. `name` хранится
// только локально для удобства самого родителя в его кабинете и никогда не
// попадает в отзыв/публичные данные — это не то же самое, что PII в сущности Child.
// "transferred" — ребёнок ушёл из этого учреждения не выпустившись (перевёлся в
// другое). Для верификации отзыва (FR-15/30) считается тем же, что alumnus —
// связь была реальной, просто не завершилась выпуском.
export type ChildStatus = "current" | "alumnus" | "transferred";

export interface ChildLink {
  id: number;
  name: string;
  age: string;
  instId: number | null;
  status: ChildStatus;
}

interface AppStateValue {
  savedIds: number[];
  isSaved: (id: number) => boolean;
  toggleSaved: (id: number) => void;

  notifications: Notification[];
  unreadNotifications: number;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;

  unreadMessages: number;
  setUnreadMessages: (n: number | ((prev: number) => number)) => void;

  role: Role;
  setRole: (r: Role) => void;

  locale: Locale;
  setLocale: (l: Locale) => void;

  region: Region | null;
  setRegion: (r: Region | null) => void;

  children_: ChildLink[];
  addChild: (c: Omit<ChildLink, "id">) => void;
  removeChild: (id: number) => void;

  applicant: Applicant;
  setApplicant: (a: Applicant | ((prev: Applicant) => Applicant)) => void;

  applications: Application[];
  hasApplied: (vacancyId: string) => boolean;
  addApplication: (vacancyId: string) => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);
const LS_KEY = "eduhub_app_state_v2";

interface Stored {
  savedIds: number[];
  role: Role;
  locale: Locale;
  region: Region | null;
  children_: ChildLink[];
  applicant: Applicant;
  applications: Application[];
}

// Демо-сид для нового посетителя (localStorage ещё пуст) — чтобы кабинет не
// выглядел пустым при первом знакомстве с прототипом. Реальный пользователь
// продолжит с этих же значений и может их менять как обычно.
const SEED_CHILDREN: ChildLink[] = [
  { id: 1001, name: "Амир Юсупов", age: "10 лет", instId: 1, status: "current" },
  { id: 1002, name: "Амир Юсупов", age: "10 лет", instId: 4, status: "current" }, // тот же ребёнок — школа + учебный центр
  { id: 1003, name: "Зарина Юсупова", age: "5 лет", instId: 2, status: "current" },
  { id: 1004, name: "Давлат Юсупов", age: "17 лет", instId: 3, status: "alumnus" },
];
const SEED_APPLICATIONS: Application[] = [
  { id: "app-seed-1", applicantId: "applicant-me", vacancyId: "v1", status: "viewed", createdAt: "14 июл 2026" },
  { id: "app-seed-2", applicantId: "applicant-me", vacancyId: "v4", status: "sent", createdAt: "16 июл 2026" },
];

function readStored(): Stored {
  const empty: Stored = { savedIds: [1, 3, 5], role: "guest", locale: "ru", region: null, children_: SEED_CHILDREN, applicant: DEFAULT_APPLICANT, applications: SEED_APPLICATIONS };
  if (typeof window === "undefined") return empty;
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw);
    return {
      savedIds: Array.isArray(parsed.savedIds) ? parsed.savedIds : [],
      role: typeof parsed.role === "string" ? parsed.role : "guest",
      locale: parsed.locale === "tg" ? "tg" : "ru",
      region: typeof parsed.region === "string" ? parsed.region : null,
      children_: Array.isArray(parsed.children_) ? parsed.children_ : [],
      applicant: parsed.applicant && typeof parsed.applicant === "object" ? { ...DEFAULT_APPLICANT, ...parsed.applicant } : DEFAULT_APPLICANT,
      applications: Array.isArray(parsed.applications) ? parsed.applications : [],
    };
  } catch {
    return empty;
  }
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [savedIds, setSavedIds] = useState<number[]>(() => readStored().savedIds);
  const [notifications, setNotifications] = useState<Notification[]>(NOTIFICATIONS);
  const [unreadMessages, setUnreadMessages] = useState<number>(2);
  const [role, setRole] = useState<Role>(() => readStored().role);
  const [locale, setLocale] = useState<Locale>(() => readStored().locale);
  const [region, setRegion] = useState<Region | null>(() => readStored().region);
  const [children_, setChildren_] = useState<ChildLink[]>(() => readStored().children_);
  const [applicant, setApplicant] = useState<Applicant>(() => readStored().applicant);
  const [applications, setApplications] = useState<Application[]>(() => readStored().applications);

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify({ savedIds, role, locale, region, children_, applicant, applications }));
  }, [savedIds, role, locale, region, children_, applicant, applications]);

  const isSaved = useCallback((id: number) => savedIds.includes(id), [savedIds]);
  const toggleSaved = useCallback((id: number) => {
    setSavedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const markNotificationRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);
  const markAllNotificationsRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const unreadNotifications = notifications.filter((n) => !n.read).length;

  const addChild = useCallback((c: Omit<ChildLink, "id">) => {
    setChildren_((prev) => [...prev, { ...c, id: Date.now() }]);
  }, []);
  const removeChild = useCallback((id: number) => {
    setChildren_((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const hasApplied = useCallback((vacancyId: string) => applications.some((a) => a.vacancyId === vacancyId), [applications]);
  // идемпотентно: повторный отклик на ту же вакансию не создаёт дубль
  const addApplication = useCallback((vacancyId: string) => {
    setApplications((prev) => {
      if (prev.some((a) => a.vacancyId === vacancyId)) return prev;
      return [...prev, { id: `app-${Date.now()}`, applicantId: applicant.id, vacancyId, status: "sent", createdAt: new Date().toLocaleDateString("ru-RU") }];
    });
  }, [applicant.id]);

  const value: AppStateValue = {
    savedIds,
    isSaved,
    toggleSaved,
    notifications,
    unreadNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    unreadMessages,
    setUnreadMessages,
    role,
    setRole,
    locale,
    setLocale,
    region,
    setRegion,
    children_,
    addChild,
    removeChild,
    applicant,
    setApplicant,
    applications,
    hasApplied,
    addApplication,
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
