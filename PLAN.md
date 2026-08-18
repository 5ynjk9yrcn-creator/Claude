# OK Today — Build Plan (v1)

*Written in plain English for a non-technical founder. Last updated: 2026-08-18.*

**Decisions made:** iPhone-only for the beta (all testing through TestFlight). Phones are in **Canada**, so Twilio gets a Canadian phone number — Canada skips the slow US "A2P" registration process, though we'll still do a short number-verification step in Phase 4.

**Product additions (Austin, 2026-08-18):** send-a-❤️ back to the parent (Phase 3); "Not great" mood alerts, false-alarm flow, and callable alert texts (Phase 4); weekly story summary, photo on the sun screen, read-only circle members, and vacation pause (Phase 5). A landline/SMS-only parent mode was considered and parked for v2.

**Ideas we deliberately said no to for v1:** medication reminders, fall detection, health tracking, in-app chat — they complicate the parent's one-tap screen and drag the product toward regulated medical-alert territory. The one-tap purity is the moat.

## What we're building

A phone app with two sides:

- **Parent side:** one giant sun button. Tap it each morning to say "I'm OK today." Optionally tap a mood (Good / Okay / Not great). A streak counter shows how many days in a row they've checked in.
- **Family side:** set up the "circle" (parent's name, daily deadline in the parent's timezone, up to 2 alert contacts), invite the parent by text message, and see a dashboard with today's status and the last 14 days.

If the parent hasn't checked in by the deadline, the system escalates automatically:

1. **1 hour before deadline:** gentle reminder notification to the parent.
2. **At the deadline:** app notification + text message to the family member.
3. **20 minutes later:** text message to the backup contact.

The escalation runs on a server in the cloud — never on anyone's phone — so it works even if every phone in the family is off, dead, or offline.

## The moving parts (plain English)

| Part | What it is | Why we need it |
|---|---|---|
| **Expo** | The toolkit we use to build one app that runs on both iPhone and Android, and the service (EAS) that packages it for the App Store | It's the fastest reliable way to ship a phone app |
| **Supabase** | Our database and "backend" in the cloud. Stores accounts, circles, check-ins, and runs the escalation job on a schedule | The app's memory and its always-on brain |
| **Twilio** | A service that sends text messages from a real phone number | SMS alerts to family and the backup contact |
| **Expo push notifications** | The system that delivers app notifications | Reminders to the parent, alerts to the family member |
| **Resend** (small extra) | A simple email-sending service | Emails Austin if the escalation job itself ever fails |

## The build, phase by phase

Each phase ends with something you can test on your own phone. Nothing in a later phase blocks an earlier one.

### Phase 0 — Your homework: create accounts (you do this, ~1–2 hours total)
See "Accounts you need to create" below. **Start the Apple Developer enrollment today** — Apple can take a few days to approve it, and it's the only one with a waiting period.

### Phase 1 — App skeleton with the real look
I build the app's screens: role choice at signup, family onboarding, parent home with the sun button, family dashboard with the 14-day calendar — matching the prototype's sky-blue/sun-yellow design, giant type on parent screens. Buttons work but nothing is saved to the cloud yet.
**You test:** open the app on your phone (via Expo's free preview app, "Expo Go") and tap through every screen.
**I need from you:** the `ok-today-prototype.jsx` file, and your Expo account.

### Phase 2 — Real accounts and circles
Signing up actually creates an account. Family onboarding actually creates a circle in the database, with the parent's name, deadline, timezone, and alert contacts. The text-message invite link works: parent taps it, gets the app, and lands in the circle with no typing.
**You test:** sign up as "family" on your phone, invite a second phone (or yourself) as the "parent."
**I need from you:** Supabase keys.

### Phase 3 — Check-ins for real
The sun button records a check-in in the database. Streak counts. Mood is saved. The family dashboard shows today's real status and the real 14-day history. Parent's phone being offline is handled: the tap is saved on the phone and sent up automatically when it reconnects.

Also in this phase:
- **Love back:** after a check-in, the family member can tap "Send a ❤️" — the parent's next morning screen says "{Family member} saw you were OK and sent you love."
**You test:** check in as the parent, watch the family dashboard update, send a ❤️ back.
**I need from you:** nothing new.

### Phase 4 — Reminders, escalation, and the safety rules
The server-side brain. Every 5 minutes, a scheduled job in Supabase wakes up and asks: "Is any parent past their reminder time or deadline without a check-in today?" It then sends the reminder push, the deadline push+SMS, or the backup SMS — whichever is due.

The non-negotiables, and how each is met:
- **Server-side:** the job runs inside Supabase's cloud, not on a phone.
- **Never double-fires:** every alert is written to the database *before* it's sent, with a rule that makes a duplicate physically impossible to record. If the job runs twice, the second run sees the alert already exists and does nothing.
- **Logs every run:** each 5-minute run writes a log row — when it ran, what it checked, what it sent, any errors.
- **Emails Austin on failure:** if a run crashes or can't send an alert, an email goes to austin1254@hotmail.com with the error.
- **Timezones:** the deadline is stored as "8:00 AM in America/Chicago" (for example), not as a fixed clock time, so it's always evaluated in the parent's local day — daylight saving handled automatically.
- **Test mode:** a switch on the family dashboard sets a fake deadline a few minutes from now, so you can watch the whole reminder → alert → backup chain fire end to end without waiting a day.

Also in this phase:
- **"Not great" means something:** if the parent taps "Not great," the family member gets a gentle heads-up — "Ruth checked in but isn't feeling great today. Maybe call?"
- **False-alarm flow:** if the parent checks in *after* an alert already went out, the family instantly gets "She's OK now — checked in at 11:20."
- **Callable alerts:** every alert text includes the parent's phone number so the family can call back in one tap from the message itself.

**You test:** flip test mode on, don't check in, and watch your phone get the push and the texts on schedule — then check in late and watch the false-alarm text arrive.
**I need from you:** Twilio keys + a Twilio phone number, Resend key, Apple Developer account (for iPhone push notifications).

### Phase 5 — Polish, warmth, and edge cases
Empty states, error messages in plain language, accessibility pass on the parent screens (huge tap targets, works with large system text).

Also in this phase:
- **Weekly story:** every Sunday, the family member gets a warm summary — "Ruth checked in 7 for 7 this week, usually around 7:40am, felt good most days." Easy to screenshot and forward to siblings.
- **Photo on the sun screen:** the family can add a photo (say, the grandkids) that appears on the parent's morning screen.
- **Read-only circle members:** siblings can be invited to see the dashboard without paying — every extra watcher is word of mouth.
- **Vacation / hospital pause:** a pause switch so streaks and alerts don't misfire when the parent is away, with an auto-resume date so nobody forgets to turn it back on.

**You test:** a full realistic week of use, plus the weird cases I'll give you a checklist for.

### Phase 6 — Ship it
EAS builds the real app → upload to TestFlight → you and a few families beta test → App Store submission. I'll walk you through every click, including the App Store listing (screenshots, description, privacy questionnaire).
**I need from you:** Apple Developer account fully approved.

## Accounts you need to create (Phase 0)

| # | Account | Link | Cost | When I need the keys | Notes |
|---|---|---|---|---|---|
| 1 | **Apple Developer Program** | https://developer.apple.com/programs/enroll/ | $99/year | Phase 4 (push) and Phase 6 (TestFlight) | **Start today** — approval can take days. Enroll with your Apple ID. |
| 2 | **Expo** | https://expo.dev/signup | Free | Phase 1 | Just sign up; no keys needed yet, you'll log in when we build. |
| 3 | **Supabase** | https://supabase.com/dashboard/sign-up | Free tier is plenty for beta | Phase 2 | After signup, create one "project" (I'll tell you exactly what to click). |
| 4 | **Twilio** | https://www.twilio.com/try-twilio | ~$1.50/mo for a Canadian number + a few cents per text | Phase 4 | Trial accounts can only text phone numbers you've verified — fine for testing with your own family. We'll buy a **Canadian** number in Phase 4 and complete a short verification step so texts deliver reliably to beta families. |
| 5 | **Resend** | https://resend.com/signup | Free | Phase 4 | Sends the "job failed" emails to you. Two-minute signup. |

**How you'll give me keys safely:** never paste keys into a public place. When each phase needs one, I'll tell you exactly which page in that service's dashboard to open and which value to copy, and we'll put it in the project's secret storage (I'll walk you through it).

## What "done" looks like for v1

A family member downloads the app from TestFlight, sets up a circle in under 3 minutes, texts an invite to their parent, the parent taps one link and then one sun button each morning — and if the sun button ever isn't tapped, the right people find out within minutes, guaranteed by a server that logs its own work and tattles on itself if it breaks.
