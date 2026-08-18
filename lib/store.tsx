import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Mood } from "./theme";

/* Phase 1: everything lives on-device. Phase 2 swaps this store's
   persistence for Supabase while keeping the same shape and actions. */

const KEY = "oktoday-v1";

export type CheckIn = { iso: string; mood: Mood | null };
export type Contact = { name: string; phone: string; isPrimary: boolean };

export type AppData = {
  role: "parent" | "family" | null;
  setupComplete: boolean;
  parentName: string;
  deadline: string; // "HH:MM" in the parent's timezone
  timezone: string; // IANA name, e.g. "America/Toronto"
  contacts: Contact[];
  checkins: Record<string, CheckIn>; // key: YYYY-MM-DD (parent-local)
};

export const todayKey = (d = new Date()) => d.toLocaleDateString("en-CA");

export function dateNDaysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

export const fmtTime = (d: Date) =>
  d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export const fmtDeadline = (deadline: string) => {
  const [h, m] = deadline.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return fmtTime(d);
};

export function deadlineToday(deadline: string): Date {
  const [h, m] = deadline.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

export function calcStreak(checkins: Record<string, CheckIn>): number {
  let s = 0;
  // If today isn't checked in yet, the streak isn't broken — start counting yesterday.
  let n = checkins[todayKey()] ? 0 : 1;
  for (; ; n++) {
    if (checkins[todayKey(dateNDaysAgo(n))]) s++;
    else break;
  }
  return s;
}

export function usualTime(checkins: Record<string, CheckIn>): string {
  const recs = Object.values(checkins);
  if (!recs.length) return "—";
  const mins =
    recs.reduce((a, r) => {
      const d = new Date(r.iso);
      return a + d.getHours() * 60 + d.getMinutes();
    }, 0) / recs.length;
  const d = new Date();
  d.setHours(Math.floor(mins / 60), Math.round(mins % 60), 0, 0);
  return fmtTime(d);
}

export const checkInTime = (rec: CheckIn) => fmtTime(new Date(rec.iso));

function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "America/Toronto";
  } catch {
    return "America/Toronto";
  }
}

function emptyData(): AppData {
  return {
    role: null,
    setupComplete: false,
    parentName: "",
    deadline: "11:00",
    timezone: deviceTimezone(),
    contacts: [],
    checkins: {},
  };
}

/* Demo history so the family dashboard looks alive in Phase 1.
   Mirrors the prototype: 13 days, one realistic missed morning. */
export function seedCheckins(): Record<string, CheckIn> {
  const checkins: Record<string, CheckIn> = {};
  const moods: (Mood | null)[] = ["good", "good", "good", "okay"];
  for (let n = 13; n >= 1; n--) {
    if (n === 6) continue;
    const d = dateNDaysAgo(n);
    d.setHours(7 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 60), 0, 0);
    checkins[todayKey(d)] = {
      iso: d.toISOString(),
      mood: moods[Math.floor(Math.random() * moods.length)],
    };
  }
  return checkins;
}

type Store = {
  data: AppData | null; // null while loading from disk
  update: (patch: Partial<AppData>) => void;
  checkInNow: () => void;
  setMood: (mood: Mood) => void;
  resetAll: () => void;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const dataRef = useRef<AppData | null>(null);
  dataRef.current = data;

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        setData(raw ? { ...emptyData(), ...JSON.parse(raw) } : emptyData());
      } catch {
        setData(emptyData());
      }
    })();
  }, []);

  const persist = useCallback((next: AppData) => {
    setData(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {
      /* Saving can fail if the disk is full; the in-memory state still works. */
    });
  }, []);

  const update = useCallback(
    (patch: Partial<AppData>) => {
      const cur = dataRef.current;
      if (cur) persist({ ...cur, ...patch });
    },
    [persist]
  );

  const checkInNow = useCallback(() => {
    const cur = dataRef.current;
    if (!cur || cur.checkins[todayKey()]) return; // one per day
    persist({
      ...cur,
      checkins: {
        ...cur.checkins,
        [todayKey()]: { iso: new Date().toISOString(), mood: null },
      },
    });
  }, [persist]);

  const setMood = useCallback(
    (mood: Mood) => {
      const cur = dataRef.current;
      const rec = cur?.checkins[todayKey()];
      if (!cur || !rec) return;
      persist({
        ...cur,
        checkins: { ...cur.checkins, [todayKey()]: { ...rec, mood } },
      });
    },
    [persist]
  );

  const resetAll = useCallback(() => {
    persist(emptyData());
  }, [persist]);

  return (
    <Ctx.Provider value={{ data, update, checkInNow, setMood, resetAll }}>
      {children}
    </Ctx.Provider>
  );
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside StoreProvider");
  return s;
}
