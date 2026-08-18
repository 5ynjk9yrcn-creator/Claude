// OK Today — the safety brain.
// Runs every minute (pg_cron -> this function). For every circle it checks,
// in the parent's own timezone: is a reminder due? is the deadline missed?
// is a backup alert due? did a late check-in turn an alarm into a false alarm?
//
// Reliability rules, enforced here:
// - Idempotent: an alert row is inserted (unique-constrained) BEFORE sending;
//   a second run sees the row already exists and does nothing.
// - Every run writes a job_runs row, success or failure.
// - Any crash emails ALERT_EMAIL via Resend.

import { createClient } from "npm:@supabase/supabase-js@2";

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const ALERT_EMAIL = Deno.env.get("ALERT_EMAIL") ?? "";
const CRON_SECRET = Deno.env.get("CRON_SECRET") ?? "";
const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
const TWILIO_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
const TWILIO_FROM = Deno.env.get("TWILIO_FROM") ?? "";

const REMINDER_MIN = 60; // reminder this many minutes before deadline
const BACKUP_MIN = 20; // backup contact alerted this long after deadline
const TEST_REMINDER_MIN = 2; // compressed timings while test mode runs
const TEST_BACKUP_MIN = 2;

type Circle = {
  id: string;
  parent_name: string;
  deadline: string; // "HH:MM:SS"
  timezone: string;
  parent_user_id: string | null;
  owner_id: string;
  test_deadline_at: string | null;
  is_self: boolean;
  deadlines: Record<string, string> | null;
  parent_phone: string;
  emergency_note: string;
  lang: string;
  ack_day: string | null;
};

/* Reminder wording in the parent's language — the only push they ever see. */
const REMINDER: Record<string, { title: string; body: (t: string) => string }> = {
  en: { title: "Good morning ☀", body: (t) => `Don't forget to tap your sun before ${t}.` },
  fr: { title: "Bonjour ☀", body: (t) => `N'oubliez pas de toucher votre soleil avant ${t}.` },
  es: { title: "Buenos días ☀", body: (t) => `No olvide tocar su sol antes de las ${t}.` },
  pt: { title: "Bom dia ☀", body: (t) => `Não esqueça de tocar no seu sol antes das ${t}.` },
  it: { title: "Buongiorno ☀", body: (t) => `Non dimenticare di toccare il tuo sole prima delle ${t}.` },
  de: { title: "Guten Morgen ☀", body: (t) => `Denken Sie daran, vor ${t} auf Ihre Sonne zu tippen.` },
  zh: { title: "早上好 ☀", body: (t) => `别忘了在 ${t} 之前点一下您的太阳。` },
};

const reminderText = (lang: string, time: string) =>
  (REMINDER[(lang ?? "en").slice(0, 2)] ?? REMINDER.en);

/* Weekday index (0=Sunday) for a YYYY-MM-DD key. */
const weekdayOf = (dayKey: string) => new Date(`${dayKey}T12:00:00Z`).getUTCDay();

/* Minutes from `now` until `target`, wrapping across midnight so a deadline
   soon after midnight still gets its hour-before reminder the evening prior. */
function minutesUntil(nowM: number, targetM: number): number {
  const d = targetM - nowM;
  if (d > 720) return d - 1440;
  if (d < -720) return d + 1440;
  return d;
}

function localParts(tz: string, d = new Date()) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    minutes: (parseInt(p.hour) % 24) * 60 + parseInt(p.minute),
  };
}

function fmtLocal(tz: string, minutes: number) {
  const h24 = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`;
}

async function sendEmail(subject: string, html: string) {
  if (!RESEND_API_KEY || !ALERT_EMAIL) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "OK Today <onboarding@resend.dev>",
        to: [ALERT_EMAIL],
        subject,
        html,
      }),
    });
  } catch (_) {
    // Email is the last resort channel; nothing left to do if it fails.
  }
}

async function sendPush(userId: string | null, title: string, body: string) {
  if (!userId) return { ok: false, error: "no user to push to" };
  const { data: tokens } = await admin
    .from("push_tokens")
    .select("token")
    .eq("user_id", userId);
  if (!tokens?.length) {
    return {
      ok: false,
      error: "no push tokens registered (needs the TestFlight build, Phase 6)",
      skipped: true,
    };
  }
  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        tokens.map((t) => ({ to: t.token, sound: "default", title, body }))
      ),
    });
    if (!res.ok) return { ok: false, error: `push service ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `push failed: ${e}` };
  }
}

async function sendSms(to: string, body: string) {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) {
    return { ok: false, error: "Twilio not connected yet", skipped: true };
  }
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: body }),
      }
    );
    if (!res.ok) {
      const txt = await res.text();
      return { ok: false, error: `twilio ${res.status}: ${txt.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: `sms failed: ${e}` };
  }
}

/* Claim an alert slot. Returns true only for the run that inserted the row —
   every other run (or retry) gets false and must not send. */
async function claim(
  circleId: string,
  day: string,
  kind: string,
  channel: string,
  target: string,
  runTag: string
) {
  const { data, error } = await admin
    .from("alerts")
    .upsert(
      { circle_id: circleId, day, kind, channel, target, run_tag: runTag },
      {
        onConflict: "circle_id,day,kind,channel,target,run_tag",
        ignoreDuplicates: true,
      }
    )
    .select();
  if (error) throw new Error(`claim failed: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

async function setStatus(
  circleId: string,
  day: string,
  kind: string,
  channel: string,
  target: string,
  runTag: string,
  result: { ok: boolean; error?: string; skipped?: boolean }
) {
  await admin
    .from("alerts")
    .update({
      status: result.ok ? "sent" : result.skipped ? "skipped" : "failed",
      error: result.error ?? null,
    })
    .match({
      circle_id: circleId,
      day,
      kind,
      channel,
      target,
      run_tag: runTag,
    });
}

/* Everything the recipient needs to actually do something, appended to an
   alert text: who to call, and whatever the family wrote down in advance. */
function helpBlock(c: Circle): string {
  const bits: string[] = [];
  if (c.parent_phone?.trim()) bits.push(`Call them: ${c.parent_phone.trim()}`);
  if (c.emergency_note?.trim()) bits.push(c.emergency_note.trim());
  return bits.length ? ` ${bits.join(" · ")}` : " Please check on them.";
}

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-key") !== CRON_SECRET) {
    return new Response("unauthorized", { status: 401 });
  }

  let body: { selftest?: string } = {};
  try {
    body = await req.json();
  } catch (_) {
    /* empty body is fine */
  }
  if (body.selftest === "email") {
    await sendEmail(
      "OK Today: escalation system is installed ✓",
      "<p>This is the failure-alert channel testing itself. If the deadline job ever crashes, the error report will arrive exactly like this email did.</p>"
    );
    return new Response(JSON.stringify({ ok: true, sent: "selftest email" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: run } = await admin
    .from("job_runs")
    .insert({})
    .select()
    .single();
  let circlesChecked = 0;
  let alertsSent = 0;

  try {
    const { data: circles, error: cErr } = await admin
      .from("circles")
      .select(
        "id, parent_name, deadline, timezone, parent_user_id, owner_id, test_deadline_at, " +
          "is_self, deadlines, parent_phone, emergency_note, lang, ack_day"
      );
    if (cErr) throw new Error(cErr.message);

    for (const c of (circles ?? []) as Circle[]) {
      if (!c.parent_user_id) continue; // nobody has joined to check in yet
      circlesChecked++;

      const { date: today, minutes: nowM } = localParts(c.timezone);
      // Per-weekday override, falling back to the single daily deadline.
      const todaysDeadline = c.deadlines?.[String(weekdayOf(today))] ?? c.deadline;
      const [dh, dm] = todaysDeadline.split(":").map(Number);
      const dlM = dh * 60 + dm;
      const dlText = fmtLocal(c.timezone, dlM);
      const acked = c.ack_day === today;

      // Heartbeat: proof to the family that the watcher is alive right now.
      await admin
        .from("circles")
        .update({ last_checked_at: new Date().toISOString() })
        .eq("id", c.id);

      const { data: checkin } = await admin
        .from("checkins")
        .select("checked_at, mood")
        .eq("circle_id", c.id)
        .eq("day", today)
        .maybeSingle();

      const { data: contacts } = await admin
        .from("contacts")
        .select("name, phone, is_primary")
        .eq("circle_id", c.id)
        .order("position");
      const primary = contacts?.find((x) => x.is_primary) ?? contacts?.[0];
      const backup = contacts?.find((x) => !x.is_primary);

      const send = async (
        kind: string,
        channel: "push" | "sms",
        target: string,
        runTag: string,
        fn: () => Promise<{ ok: boolean; error?: string; skipped?: boolean }>
      ) => {
        if (!(await claim(c.id, today, kind, channel, target, runTag))) return;
        const result = await fn();
        if (result.ok) alertsSent++;
        await setStatus(c.id, today, kind, channel, target, runTag, result);
      };

      /* ---- test mode: pretend the morning was missed, on fast timings ---- */
      if (c.test_deadline_at && !c.is_self) {
        const t0 = new Date(c.test_deadline_at).getTime();
        const now = Date.now();
        const tag = `test:${c.test_deadline_at}`;

        if (now >= t0 - TEST_REMINDER_MIN * 60000) {
          await send("reminder", "push", "parent", tag, () =>
            sendPush(
              c.parent_user_id,
              `${reminderText(c.lang, dlText).title} (test)`,
              reminderText(c.lang, dlText).body(dlText)
            )
          );
        }
        if (now >= t0) {
          await send("primary", "push", "owner", tag, () =>
            sendPush(
              c.owner_id,
              `${c.parent_name} hasn't checked in (test)`,
              `Test alarm: no check-in by the test deadline.`
            )
          );
          if (primary) {
            await send("primary", "sms", primary.phone, tag, () =>
              sendSms(
                primary.phone,
                `OK Today TEST: ${c.parent_name} hasn't checked in. (This is the test alarm you started.)`
              )
            );
          }
        }
        if (now >= t0 + TEST_BACKUP_MIN * 60000) {
          if (backup) {
            await send("backup", "sms", backup.phone, tag, () =>
              sendSms(
                backup.phone,
                `OK Today TEST: ${c.parent_name} hasn't checked in and ${primary?.name ?? "the family"} was alerted. (Test alarm.)`
              )
            );
          }
          // Test run complete — switch test mode off.
          await admin
            .from("circles")
            .update({ test_deadline_at: null })
            .eq("id", c.id);
        }
        continue; // test mode replaces the real evaluation for this circle
      }

      /* ---- the real thing ---- */
      if (checkin) {
        if (c.is_self) continue; // nobody to notify about your own check-in
        // "Not great" heads-up
        if (checkin.mood === "notgreat") {
          await send("notgreat", "push", "owner", "", () =>
            sendPush(
              c.owner_id,
              `${c.parent_name} isn't feeling great`,
              `They checked in, but tapped "Not great". Maybe give them a call?`
            )
          );
        }
        // False alarm: they checked in after the alarm already went out
        const { data: fired } = await admin
          .from("alerts")
          .select("id")
          .match({ circle_id: c.id, day: today, kind: "primary", run_tag: "" })
          .limit(1);
        if (fired?.length) {
          const at = new Date(checkin.checked_at).toLocaleTimeString("en-US", {
            timeZone: c.timezone,
            hour: "numeric",
            minute: "2-digit",
          });
          await send("allclear", "push", "owner", "", () =>
            sendPush(
              c.owner_id,
              `${c.parent_name} is OK`,
              `False alarm — they checked in at ${at}.`
            )
          );
          if (primary) {
            await send("allclear", "sms", primary.phone, "", () =>
              sendSms(
                primary.phone,
                `OK Today: false alarm — ${c.parent_name} just checked in at ${at}. All is well.`
              )
            );
          }
        }
        continue;
      }

      // No check-in yet today:
      const untilDeadline = minutesUntil(nowM, dlM);
      if (untilDeadline > 0 && untilDeadline <= REMINDER_MIN) {
        await send("reminder", "push", "parent", "", () =>
          sendPush(
            c.parent_user_id,
            reminderText(c.lang, dlText).title,
            reminderText(c.lang, dlText).body(dlText)
          )
        );
      }

      // A self check-in circle has no one to escalate to — reminders only.
      if (c.is_self) continue;

      // "I've got it": the family is handling this morning. Log it once and
      // send nothing further today.
      if (acked) {
        await send("ack", "push", "owner", "", async () => ({ ok: true }));
        continue;
      }

      if (nowM >= dlM) {
        await send("primary", "push", "owner", "", () =>
          sendPush(
            c.owner_id,
            `${c.parent_name} hasn't checked in`,
            `No check-in by ${dlText}. Maybe give them a call?`
          )
        );
        if (primary) {
          await send("primary", "sms", primary.phone, "", () =>
            sendSms(
              primary.phone,
              `OK Today: ${c.parent_name} hasn't checked in today (deadline was ${dlText}).` +
                helpBlock(c)
            )
          );
        }
      }
      if (nowM >= dlM + BACKUP_MIN && backup) {
        await send("backup", "sms", backup.phone, "", () =>
          sendSms(
            backup.phone,
            `OK Today: ${c.parent_name} hasn't checked in today and ${primary?.name ?? "the family"} was alerted ${BACKUP_MIN} minutes ago. Please check on them.`
          )
        );
      }
    }

    if (run) {
      await admin
        .from("job_runs")
        .update({
          finished_at: new Date().toISOString(),
          circles_checked: circlesChecked,
          alerts_sent: alertsSent,
          ok: true,
        })
        .eq("id", run.id);
    }
    return new Response(
      JSON.stringify({ ok: true, circlesChecked, alertsSent }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = `${e}`;
    if (run) {
      await admin
        .from("job_runs")
        .update({ finished_at: new Date().toISOString(), ok: false, error: msg })
        .eq("id", run.id);
    }
    await sendEmail(
      "OK Today: escalation job FAILED",
      `<p>The deadline-check job crashed at ${new Date().toISOString()}:</p><pre>${msg}</pre><p>It runs every minute, so the next attempt is already scheduled. If these emails keep coming, something needs fixing.</p>`
    );
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
