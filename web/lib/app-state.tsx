"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { NOTIFICATIONS, type Notification, type Region } from "./data";
import type { Locale } from "./i18n";

export type Role = "guest" | "user" | "parent" | "institution" | "applicant";

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
}

const AppStateContext = createContext<AppStateValue | null>(null);
const LS_KEY = "eduhub_app_state_v2";

interface Stored {
  savedIds: number[];
  role: Role;
  locale: Locale;
  region: Region | null;
}

function readStored(): Stored {
  const empty: Stored = { savedIds: [], role: "guest", locale: "ru", region: null };
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

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify({ savedIds, role, locale, region }));
  }, [savedIds, role, locale, region]);

  useEffect(() => {
    if (typeof window === "undefined" || !("BroadcastChannel" in window)) return;
    const channel = new BroadcastChannel("eduhub-chat");
    channel.onmessage = (e) => {
      if (e.data?.type === "opened") setUnreadMessages(0);
    };
    return () => channel.close();
  }, []);

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
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState must be used within AppStateProvider");
  return ctx;
}
