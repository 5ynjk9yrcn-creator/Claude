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
/* Kept outside KEY on purpose: signing out and resetting the phone should
   still remember which email to prefill next time. */
const EMAIL_KEY = "oktoday-remembered-email";

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
  loveForMe: { day: string; from: string; message: string | null } | null;
  loveSentDay: string | null; // last day this phone sent a ❤/note to its watched circle
  deadlines: Record<string, string> | null; // per-weekday overrides, 0=Sun
  parentPhone: string;
  emergencyNote: string;
  lang: string;
  ackDay: string | null; // day the family said "I've got it"
  lastCheckedAt: string | null; // heartbeat: when the server last ran this circle
  todaysAlerts: AlertRow[]; // what the escalation system did today (watched circle)
  testDeadlineAt: string | null; // when a test alarm is running, its fake deadline
};

export type AlertRow = {
  kind: "reminder" | "primary" | "backup" | "allclear" | "notgreat" | "ack";
  channel: "push" | "sms";
  target: string;
  status: string;
  isTest: boolean;
  at: string; // ISO created_at
};

export const todayKey = (d = new Date()) => d.toLocaleDateString("en-CA");

export function dateNDaysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

/* Day and time in the watched person's timezone. The family may be in a
   different one, and their calendar and times must reflect the parent's day,
   not the viewer's. Falls back to device-local if the runtime lacks tz data. */
export function dayKeyTz(tz: string | undefined, d = new Date()): string {
  if (!tz) return todayKey(d);
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return todayKey(d);
  }
}

export function dayKeyTzBack(tz: string | undefined, n: number): string {
  return dayKeyTz(tz, dateNDaysAgo(n));
}

export const fmtTime = (d: Date) =>
  d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export function fmtTimeTz(d: Date, tz?: string): string {
  if (!tz) return fmtTime(d);
  try {
    return d.toLocaleTimeString([], {
      timeZone: tz,
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return fmtTime(d);
  }
}

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

export function calcStreak(checkins: Record<string, CheckIn>, tz?: string): number {
  let s = 0;
  // If today isn't checked in yet, the streak isn't broken — start counting yesterday.
  let n = checkins[dayKeyTz(tz)] ? 0 : 1;
  for (; ; n++) {
    if (checkins[dayKeyTzBack(tz, n)]) s++;
    else break;
  }
  return s;
}

export function usualTime(checkins: Record<string, CheckIn>, tz?: string): string {
  const recs = Object.values(checkins);
  if (!recs.length) return "—";
  // Average the wall-clock minute-of-day as seen in the parent's timezone.
  const mins =
    recs.reduce((a, r) => {
      const [h, m] = fmtTimeTz24(new Date(r.iso), tz).split(":").map(Number);
      return a + h * 60 + m;
    }, 0) / recs.length;
  const d = new Date();
  d.setHours(Math.floor(mins / 60), Math.round(mins % 60), 0, 0);
  return fmtTime(d);
}

function fmtTimeTz24(d: Date, tz?: string): string {
  try {
    return d.toLocaleTimeString("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  }
}

export const checkInTime = (rec: CheckIn, tz?: string) =>
  fmtTimeTz(new Date(rec.iso), tz);

export const formatInviteCode = (code: string) =>
  code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;

/* A tappable link for the invite text. It opens a small page that hands the
   code straight to the app when it's installed, and explains how to get the
   app when it isn't — so the parent never types anything. */
export const inviteLink = (code: string) =>
  `https://lotbohsxmttxxropegkt.supabase.co/functions/v1/join?c=${code}`;

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
    loveForMe: null,
    loveSentDay: null,
    deadlines: null,
    parentPhone: "",
    emergencyNote: "",
    lang: "en",
    ackDay: null,
    lastCheckedAt: null,
    todaysAlerts: [],
    testDeadlineAt: null,
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
  test_deadline_at: string | null;
  deadlines: Record<string, string> | null;
  parent_phone: string;
  emergency_note: string;
  lang: string;
  ack_day: string | null;
  last_checked_at: string | null;
};

type Store = {
  data: AppData | null; // null while loading from disk
  sessionReady: boolean;
  hasSession: boolean;
  rememberedEmail: string | null;
  rememberEmail: (email: string | null) => void;
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
    deadlines?: Record<string, string> | null;
    parentPhone?: string;
    emergencyNote?: string;
    lang?: string;
  }) => void;
  sendLove: (message?: string) => Promise<string | null>;
  acknowledge: () => Promise<string | null>;
  startTestAlarm: () => Promise<string | null>;
  refresh: () => Promise<void>;
  eraseEverything: () => Promise<void>;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [rememberedEmail, setRememberedEmail] = useState<string | null>(null);
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
      try {
        setRememberedEmail(await AsyncStorage.getItem(EMAIL_KEY));
      } catch {
        /* nothing remembered */
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

  const rememberEmail = useCallback((email: string | null) => {
    setRememberedEmail(email);
    if (email) AsyncStorage.setItem(EMAIL_KEY, email).catch(() => {});
    else AsyncStorage.removeItem(EMAIL_KEY).catch(() => {});
  }, []);

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
        next.lang = checkinCircle.lang ?? "en";
        if (!watchCircle) {
          next.deadline = checkinCircle.deadline.slice(0, 5);
          next.deadlines = checkinCircle.deadlines ?? null;
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
        next.deadlines = watchCircle.deadlines ?? null;
        next.parentPhone = watchCircle.parent_phone ?? "";
        next.emergencyNote = watchCircle.emergency_note ?? "";
        next.lang = watchCircle.lang ?? "en";
        next.ackDay = watchCircle.ack_day ?? null;
        next.lastCheckedAt = watchCircle.last_checked_at ?? null;
        next.watchedCheckins = await loadCheckins(watchCircle.id);
      }

      // Hearts: the newest one sent to this phone's parent (last 2 days),
      // and whether this phone already sent one to its watched circle today.
      const loveSince = todayKey(dateNDaysAgo(1));
      if (checkinCircle) {
        const { data: lv } = await supabase
          .from("loves")
          .select("day, from_name, message")
          .eq("circle_id", checkinCircle.id)
          .gte("day", loveSince)
          .order("day", { ascending: false })
          .limit(1);
        next.loveForMe = lv?.[0]
          ? {
              day: lv[0].day as string,
              from: (lv[0].from_name as string) || "Your family",
              message: (lv[0].message as string | null) ?? null,
            }
          : null;
      }
      if (watchCircle) {
        const watchDay = dayKeyTz(watchCircle.timezone);
        const { data: sent } = await supabase
          .from("loves")
          .select("day")
          .eq("circle_id", watchCircle.id)
          .eq("day", watchDay)
          .limit(1);
        next.loveSentDay = sent?.[0] ? watchDay : next.loveSentDay;

        // What did the escalation system do today?
        next.testDeadlineAt = watchCircle.test_deadline_at ?? null;
        const { data: al } = await supabase
          .from("alerts")
          .select("kind, channel, target, status, run_tag, created_at")
          .eq("circle_id", watchCircle.id)
          .eq("day", watchDay)
          .order("created_at");
        next.todaysAlerts = (al ?? []).map((a) => ({
          kind: a.kind,
          channel: a.channel,
          target: a.target as string,
          status: a.status as string,
          isTest: (a.run_tag as string).startsWith("test:"),
          at: a.created_at as string,
        }));
      }
      persist(next);
    } finally {
      syncing.current = false;
    }
  }, [flushPending, persist]);

  /* Once signed in and set up, register this phone for push notifications. */
  useEffect(() => {
    if (session && dataRef.current?.setupComplete) {
      void import("./push").then((m) => m.registerForPush(session.user.id));
    }
  }, [session, data?.setupComplete]);

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
        // The parent's phone must join as its own anonymous identity — never
        // as a family account that happens to still be signed in here.
        const cur0 = sessionRef.current;
        if (cur0 && !cur0.user.is_anonymous) {
          await supabase.auth.signOut();
          sessionRef.current = null;
        }
        if (!sessionRef.current) {
          const { error } = await supabase.auth.signInAnonymously();
          if (error) return "Couldn't reach the server — check your internet and try again.";
        }
        const { data: res, error } = await supabase.rpc("claim_invite", {
          code,
          tz: deviceTimezone(),
        });
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
    (patch: {
      parentName?: string;
      deadline?: string;
      myName?: string;
      contacts?: Contact[];
      deadlines?: Record<string, string> | null;
      parentPhone?: string;
      emergencyNote?: string;
      lang?: string;
    }) => {
      const cur = dataRef.current;
      if (!cur) return;
      const next = { ...cur, ...patch };
      persist(next);
      void (async () => {
        if (next.watchCircleId) {
          const fields: Record<string, unknown> = {};
          if (patch.parentName !== undefined) fields.parent_name = next.parentName;
          if (patch.deadline !== undefined) fields.deadline = next.deadline;
          if (patch.deadlines !== undefined) fields.deadlines = next.deadlines;
          if (patch.parentPhone !== undefined) fields.parent_phone = next.parentPhone;
          if (patch.emergencyNote !== undefined)
            fields.emergency_note = next.emergencyNote;
          if (patch.lang !== undefined) fields.lang = next.lang;
          if (Object.keys(fields).length) {
            await supabase.from("circles").update(fields).eq("id", next.watchCircleId);
          }
        }
        // "Both" accounts keep their own check-in circle on the same schedule.
        if (
          next.checkinCircleId &&
          (patch.deadline !== undefined || patch.deadlines !== undefined)
        ) {
          await supabase
            .from("circles")
            .update({ deadline: next.deadline, deadlines: next.deadlines })
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

  const startTestAlarm = useCallback(async (): Promise<string | null> => {
    const cur = dataRef.current;
    if (!cur?.watchCircleId) return "No circle to test yet.";
    const at = new Date(Date.now() + 3 * 60000).toISOString();
    const { error } = await supabase
      .from("circles")
      .update({ test_deadline_at: at })
      .eq("id", cur.watchCircleId);
    if (error) return "Couldn't start the test — check your internet and try again.";
    update({ testDeadlineAt: at });
    return null;
  }, [update]);

  const sendLove = useCallback(
    async (message?: string): Promise<string | null> => {
    const cur = dataRef.current;
    if (!cur?.watchCircleId) return "No circle to send to yet.";
    const from = cur.contacts.find((c) => c.isPrimary)?.name || "Your family";
    // Recorded against the parent's day, not the sender's.
    const day = dayKeyTz(cur.timezone);
    const { error } = await supabase.from("loves").upsert(
      {
        circle_id: cur.watchCircleId,
        day,
        from_name: from,
        message: message?.trim() ? message.trim() : null,
      },
      { onConflict: "circle_id,day" }
    );
    if (error) return "Couldn't send it — check your internet and try again.";
    update({ loveSentDay: day });
    return null;
    },
    [update]
  );

  /* "I've got it" — the family is handling this morning, so the server stops
     escalating (no backup text) for the rest of the day. */
  const acknowledge = useCallback(async (): Promise<string | null> => {
    const cur = dataRef.current;
    if (!cur?.watchCircleId) return "No circle to acknowledge yet.";
    const day = dayKeyTz(cur.timezone);
    const { error } = await supabase
      .from("circles")
      .update({ ack_day: day, ack_at: new Date().toISOString() })
      .eq("id", cur.watchCircleId);
    if (error) return "Couldn't reach the server — check your internet and try again.";
    update({ ackDay: day });
    return null;
  }, [update]);

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
        rememberedEmail,
        rememberEmail,
        update,
        checkInNow,
        setMood,
        signUp,
        signIn,
        createCircles,
        claimInvite,
        saveSettings,
        sendLove,
        acknowledge,
        startTestAlarm,
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

/* ---- schedule + pattern helpers ---- */

/** Weekday index (0=Sun) for a YYYY-MM-DD key, read as a plain local date. */
export function weekdayOfKey(key: string): number {
  return new Date(`${key}T12:00:00`).getDay();
}

/** The deadline that applies on a given day, honouring per-weekday overrides. */
export function deadlineForKey(
  d: Pick<AppData, "deadline" | "deadlines">,
  dayKey: string
): string {
  return d.deadlines?.[String(weekdayOfKey(dayKey))] || d.deadline;
}

/** The deadline in force right now in the parent's timezone. */
export function deadlineNow(
  d: Pick<AppData, "deadline" | "deadlines">,
  tz?: string
): string {
  return deadlineForKey(d, dayKeyTz(tz));
}

export type Drift = { minutesLater: number; recent: string; usual: string };

/* Compare the last 7 mornings against the 3 weeks before them. A parent
   drifting steadily later is the kind of slow change nobody notices day to
   day — it is the earliest signal this app can offer. */
export function detectDrift(
  checkins: Record<string, CheckIn>,
  tz?: string
): Drift | null {
  const minutesOf = (rec: CheckIn) => {
    const [h, m] = fmtTimeTz24(new Date(rec.iso), tz).split(":").map(Number);
    return h * 60 + m;
  };
  const recent: number[] = [];
  const before: number[] = [];
  for (let n = 0; n < 28; n++) {
    const rec = checkins[dayKeyTzBack(tz, n)];
    if (!rec) continue;
    (n < 7 ? recent : before).push(minutesOf(rec));
  }
  if (recent.length < 4 || before.length < 7) return null; // not enough history
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const rAvg = avg(recent);
  const bAvg = avg(before);
  const delta = Math.round(rAvg - bAvg);
  if (delta < 30) return null; // only flag a meaningful, sustained slide
  const label = (mins: number) => {
    const d = new Date();
    d.setHours(Math.floor(mins / 60), Math.round(mins % 60), 0, 0);
    return fmtTime(d);
  };
  return { minutesLater: delta, recent: label(rAvg), usual: label(bAvg) };
}
