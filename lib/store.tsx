import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import { supabase } from "./supabase";
import type { Mood } from "./theme";

/* Phase 2: Supabase is the source of truth. The phone keeps a local cache so
   the app opens instantly and check-ins work offline (they queue in
   `pendingDays` and sync as soon as the network is back). */

const KEY = "oktoday-v2";

export type CheckIn = { iso: string; mood: Mood | null };
export type Contact = { name: string; phone: string; isPrimary: boolean };
export type Role = "parent" | "family" | "both";

export type AppData = {
  role: Role | null;
  setupComplete: boolean;
  myName: string; // the person on THIS phone who taps the sun (parent/both)
  parentName: string; // the person being watched over (family/both)
  deadline: string; // "HH:MM" in the parent's timezone
  timezone: string;
  contacts: Contact[];
  checkinCircleId: string | null; // circle this phone checks in to
  watchCircleId: string | null; // circle this phone watches over
  inviteCode: string | null;
  checkins: Record<string, CheckIn>; // this phone's own check-ins, key YYYY-MM-DD
  watchedCheckins: Record<string, CheckIn>; // the watched person's history
  pendingDays: Record<string, CheckIn>; // own check-ins not yet synced
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

export const formatInviteCode = (code: string) =>
  code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;

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
    myName: "",
    parentName: "",
    deadline: "11:00",
    timezone: deviceTimezone(),
    contacts: [],
    checkinCircleId: null,
    watchCircleId: null,
    inviteCode: null,
    checkins: {},
    watchedCheckins: {},
    pendingDays: {},
  };
}

type CircleRow = {
  id: string;
  owner_id: string;
  parent_name: string;
  deadline: string;
  timezone: string;
  parent_user_id: string | null;
  invite_code: string;
  is_self: boolean;
};

type Store = {
  data: AppData | null; // null while loading from disk
  sessionReady: boolean;
  hasSession: boolean;
  update: (patch: Partial<AppData>) => void;
  checkInNow: () => void;
  setMood: (mood: Mood) => void;
  signUp: (email: string, password: string) => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<string | null>;
  createCircles: () => Promise<string | null>; // returns error message or null
  claimInvite: (code: string) => Promise<string | null>;
  saveSettings: (patch: {
    parentName?: string;
    deadline?: string;
    myName?: string;
    contacts?: Contact[];
  }) => void;
  refresh: () => Promise<void>;
  eraseEverything: () => Promise<void>;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const dataRef = useRef<AppData | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const syncing = useRef(false);
  dataRef.current = data;
  sessionRef.current = session;

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        setData(raw ? { ...emptyData(), ...JSON.parse(raw) } : emptyData());
      } catch {
        setData(emptyData());
      }
      const { data: s } = await supabase.auth.getSession();
      setSession(s.session);
      setSessionReady(true);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const persist = useCallback((next: AppData) => {
    setData(next);
    dataRef.current = next;
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

  /* ---- server sync ---- */

  const flushPending = useCallback(async () => {
    const cur = dataRef.current;
    if (!cur?.checkinCircleId || !sessionRef.current) return;
    const days = Object.entries(cur.pendingDays);
    if (!days.length) return;
    for (const [day, rec] of days) {
      const { error } = await supabase.from("checkins").upsert(
        {
          circle_id: cur.checkinCircleId,
          day,
          checked_at: rec.iso,
          mood: rec.mood,
        },
        { onConflict: "circle_id,day" }
      );
      if (!error) {
        const latest = dataRef.current;
        if (!latest) return;
        // Only clear if the queued record hasn't changed since we sent it.
        if (latest.pendingDays[day]?.iso === rec.iso && latest.pendingDays[day]?.mood === rec.mood) {
          const pendingDays = { ...latest.pendingDays };
          delete pendingDays[day];
          persist({ ...latest, pendingDays });
        }
      }
    }
  }, [persist]);

  const refresh = useCallback(async () => {
    const s = sessionRef.current;
    const cur = dataRef.current;
    if (!s || !cur || syncing.current) return;
    syncing.current = true;
    try {
      await flushPending();
      const uid = s.user.id;
      const { data: circles, error } = await supabase.from("circles").select("*");
      if (error || !circles) return;
      const rows = circles as CircleRow[];
      const checkinCircle = rows.find((c) => c.parent_user_id === uid) ?? null;
      const watchCircle = rows.find((c) => c.owner_id === uid && !c.is_self) ?? null;

      let contacts = cur.contacts;
      if (watchCircle) {
        const { data: cRows } = await supabase
          .from("contacts")
          .select("*")
          .eq("circle_id", watchCircle.id)
          .order("position");
        if (cRows) {
          contacts = cRows.map((r) => ({
            name: r.name as string,
            phone: r.phone as string,
            isPrimary: r.is_primary as boolean,
          }));
        }
      }

      const since = todayKey(dateNDaysAgo(20));
      const loadCheckins = async (circleId: string) => {
        const { data: rows2 } = await supabase
          .from("checkins")
          .select("day, checked_at, mood")
          .eq("circle_id", circleId)
          .gte("day", since);
        const out: Record<string, CheckIn> = {};
        for (const r of rows2 ?? []) {
          out[r.day as string] = {
            iso: r.checked_at as string,
            mood: (r.mood as Mood | null) ?? null,
          };
        }
        return out;
      };

      const latest = dataRef.current;
      if (!latest) return;
      const next: AppData = { ...latest };
      // Signing in on a fresh phone: rebuild role and setup state from the cloud.
      if (checkinCircle || watchCircle) {
        next.setupComplete = true;
        next.role =
          checkinCircle && watchCircle
            ? "both"
            : watchCircle
              ? "family"
              : "parent";
      }
      if (checkinCircle) {
        next.checkinCircleId = checkinCircle.id;
        next.myName = checkinCircle.parent_name;
        const server = await loadCheckins(checkinCircle.id);
        // Anything still queued locally beats the server copy.
        next.checkins = { ...server, ...next.pendingDays };
        if (!watchCircle) {
          next.deadline = checkinCircle.deadline.slice(0, 5);
          next.timezone = checkinCircle.timezone;
        }
      }
      if (watchCircle) {
        next.watchCircleId = watchCircle.id;
        next.parentName = watchCircle.parent_name;
        next.deadline = watchCircle.deadline.slice(0, 5);
        next.timezone = watchCircle.timezone;
        next.inviteCode = watchCircle.invite_code;
        next.contacts = contacts;
        next.watchedCheckins = await loadCheckins(watchCircle.id);
      }
      persist(next);
    } finally {
      syncing.current = false;
    }
  }, [flushPending, persist]);

  /* Re-sync when the app comes to the foreground, and every 30s while open. */
  useEffect(() => {
    if (!session) return;
    const sub = AppState.addEventListener("change", (st) => {
      if (st === "active") void refresh();
    });
    const iv = setInterval(() => void refresh(), 30000);
    void refresh();
    return () => {
      sub.remove();
      clearInterval(iv);
    };
  }, [session, refresh]);

  /* ---- actions ---- */

  const checkInNow = useCallback(() => {
    const cur = dataRef.current;
    if (!cur || cur.checkins[todayKey()]) return; // one per day
    const rec: CheckIn = { iso: new Date().toISOString(), mood: null };
    persist({
      ...cur,
      checkins: { ...cur.checkins, [todayKey()]: rec },
      pendingDays: { ...cur.pendingDays, [todayKey()]: rec },
    });
    void flushPending();
  }, [persist, flushPending]);

  const setMood = useCallback(
    (mood: Mood) => {
      const cur = dataRef.current;
      const rec = cur?.checkins[todayKey()];
      if (!cur || !rec) return;
      const updated: CheckIn = { ...rec, mood };
      persist({
        ...cur,
        checkins: { ...cur.checkins, [todayKey()]: updated },
        pendingDays: { ...cur.pendingDays, [todayKey()]: updated },
      });
      void flushPending();
    },
    [persist, flushPending]
  );

  const friendlyAuthError = (msg: string): string => {
    if (/invalid login credentials/i.test(msg))
      return "That email and password don't match an account.";
    if (/already registered/i.test(msg))
      return "There's already an account with that email — try signing in instead.";
    if (/password/i.test(msg)) return "Password needs at least 6 characters.";
    if (/valid email/i.test(msg)) return "That doesn't look like an email address.";
    return "Couldn't reach the server — check your internet and try again.";
  };

  const signUp = useCallback(async (email: string, password: string) => {
    const { data: res, error } = await supabase.auth.signUp({ email, password });
    if (error) return friendlyAuthError(error.message);
    if (res.user) {
      await supabase
        .from("profiles")
        .upsert({ id: res.user.id, display_name: "" });
    }
    return null;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return friendlyAuthError(error.message);
    return null;
  }, []);

  const createCircles = useCallback(async (): Promise<string | null> => {
    const cur = dataRef.current;
    const s = sessionRef.current;
    if (!cur || !s) return "You're not signed in — go back and sign in first.";
    const uid = s.user.id;
    try {
      await supabase.from("profiles").upsert({
        id: uid,
        display_name: cur.contacts.find((c) => c.isPrimary)?.name ?? "",
      });

      let watchCircleId = cur.watchCircleId;
      let inviteCode = cur.inviteCode;
      if (!watchCircleId) {
        const { data: c, error } = await supabase
          .from("circles")
          .insert({
            owner_id: uid,
            parent_name: cur.parentName,
            deadline: cur.deadline,
            timezone: cur.timezone,
          })
          .select()
          .single();
        if (error || !c) return "Couldn't save the circle — check your internet and try again.";
        watchCircleId = (c as CircleRow).id;
        inviteCode = (c as CircleRow).invite_code;
      }

      await supabase.from("contacts").delete().eq("circle_id", watchCircleId);
      if (cur.contacts.length) {
        await supabase.from("contacts").insert(
          cur.contacts.map((ct, i) => ({
            circle_id: watchCircleId,
            name: ct.name,
            phone: ct.phone,
            is_primary: ct.isPrimary,
            position: i,
          }))
        );
      }

      let checkinCircleId = cur.checkinCircleId;
      if (cur.role === "both" && !checkinCircleId) {
        const { data: sc, error: se } = await supabase
          .from("circles")
          .insert({
            owner_id: uid,
            parent_name: cur.myName || "Me",
            deadline: cur.deadline,
            timezone: cur.timezone,
            parent_user_id: uid,
            is_self: true,
          })
          .select()
          .single();
        if (se || !sc) return "Couldn't set up your own check-in — try again.";
        checkinCircleId = (sc as CircleRow).id;
      }

      persist({
        ...dataRef.current!,
        watchCircleId,
        inviteCode,
        checkinCircleId,
        setupComplete: cur.role === "family" || cur.role === "both",
      });
      return null;
    } catch {
      return "Couldn't reach the server — check your internet and try again.";
    }
  }, [persist]);

  const claimInvite = useCallback(
    async (code: string): Promise<string | null> => {
      try {
        if (!sessionRef.current) {
          const { error } = await supabase.auth.signInAnonymously();
          if (error) return "Couldn't reach the server — check your internet and try again.";
        }
        const { data: res, error } = await supabase.rpc("claim_invite", { code });
        if (error) return "Couldn't reach the server — check your internet and try again.";
        if (!res?.ok) return "That code didn't match — double-check the letters and numbers.";
        const cur = dataRef.current!;
        persist({
          ...cur,
          role: "parent",
          setupComplete: true,
          checkinCircleId: res.circle_id as string,
          myName: res.parent_name as string,
          parentName: res.parent_name as string,
          deadline: (res.deadline as string).slice(0, 5),
          timezone: res.timezone as string,
        });
        return null;
      } catch {
        return "Couldn't reach the server — check your internet and try again.";
      }
    },
    [persist]
  );

  const saveSettings = useCallback(
    (patch: { parentName?: string; deadline?: string; myName?: string; contacts?: Contact[] }) => {
      const cur = dataRef.current;
      if (!cur) return;
      const next = { ...cur, ...patch };
      persist(next);
      void (async () => {
        if (next.watchCircleId && (patch.parentName !== undefined || patch.deadline !== undefined)) {
          await supabase
            .from("circles")
            .update({ parent_name: next.parentName, deadline: next.deadline })
            .eq("id", next.watchCircleId);
        }
        if (
          next.checkinCircleId &&
          patch.deadline !== undefined &&
          next.role === "parent"
        ) {
          await supabase
            .from("circles")
            .update({ deadline: next.deadline })
            .eq("id", next.checkinCircleId);
        }
        if (next.checkinCircleId && patch.myName !== undefined) {
          await supabase
            .from("circles")
            .update({ parent_name: next.myName })
            .eq("id", next.checkinCircleId);
        }
        if (next.watchCircleId && patch.contacts !== undefined) {
          await supabase.from("contacts").delete().eq("circle_id", next.watchCircleId);
          if (next.contacts.length) {
            await supabase.from("contacts").insert(
              next.contacts.map((ct, i) => ({
                circle_id: next.watchCircleId,
                name: ct.name,
                phone: ct.phone,
                is_primary: ct.isPrimary,
                position: i,
              }))
            );
          }
        }
      })();
    },
    [persist]
  );

  const eraseEverything = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      /* offline sign-out still clears the local session */
    }
    await AsyncStorage.removeItem(KEY);
    persist(emptyData());
  }, [persist]);

  return (
    <Ctx.Provider
      value={{
        data,
        sessionReady,
        hasSession: !!session,
        update,
        checkInNow,
        setMood,
        signUp,
        signIn,
        createCircles,
        claimInvite,
        saveSettings,
        refresh,
        eraseEverything,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside StoreProvider");
  return s;
}
