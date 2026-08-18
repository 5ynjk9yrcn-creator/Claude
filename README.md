# OK Today

A daily check-in app for aging parents. The parent taps one big sun button each morning ("I'm OK today"). If they don't check in by their deadline, the family member and a backup contact are alerted automatically — by a server-side job that never depends on a phone being on.

**The full build plan is in [PLAN.md](./PLAN.md).**

## Status

- **Current phase:** 2 published — cloud accounts, circles, invite codes, offline-safe check-ins
- Expo project: https://expo.dev/accounts/macntyrs-team/projects/ok-today (updates publish to the `main` branch)
- Supabase project: "Ok - Today" (`lotbohsxmttxxropegkt`, us-east-1) — tables `profiles`, `circles`, `contacts`, `checkins` with row-level security; anonymous sign-in and email auto-confirm enabled
- The design prototype lives in `design/ok-today-prototype.jsx` and is the visual source of truth.
- Phase 3 (real dashboard sync + love-back) is next; Phase 4 needs Twilio + Resend + Apple Developer.

## How to test Phase 1 on your iPhone

1. Install the free **Expo Go** app from the App Store.
2. Open Expo Go and **sign in** with your Expo account (macntyrs-team).
3. The **ok-today** project appears on the home screen — tap it, then open the latest update on the **main** branch.
4. Alternative: on a computer, open the [latest update page](https://expo.dev/accounts/macntyrs-team/projects/ok-today/updates), click **Preview**, and scan the QR code with the iPhone camera.

## Manual steps log

Every account-creation or dashboard step Austin completes gets checked off here, so we always know exactly what's been done.

### Phase 0 — Accounts
- [ ] Apple Developer Program enrollment started (https://developer.apple.com/programs/enroll/) — *start first, approval takes days*
- [ ] Apple Developer Program approved
- [x] Expo account created (https://expo.dev/signup) — *2026-08-18*
- [ ] Supabase account created (https://supabase.com/dashboard/sign-up) — *in progress 2026-08-18*
- [ ] Twilio account created (https://www.twilio.com/try-twilio)
- [ ] Resend account created (https://resend.com/signup)
- [x] `ok-today-prototype.jsx` added to this repository — *2026-08-18*

### Phase 1 — Testing on Austin's iPhone
- [x] Cloud workspace network access set to Full so Claude can reach Expo/Supabase/Twilio — *2026-08-18*
- [x] Expo access token (Developer role, named `claude-build`) created and shared with Claude — *2026-08-18*
- [x] Expo project created and Phase 1 published (update group `92431918`) — *2026-08-18*
- [ ] Expo Go installed on iPhone and signed in
- [ ] App opened in Expo Go and every screen tapped through

### Phase 2 — Supabase setup
- [x] Supabase account + project "Ok - Today" created — *2026-08-18*
- [x] Publishable key shared with Claude (ships inside the app; safe to be public) — *2026-08-18*
- [x] Personal access token (`sbp_`, named `claude-build`) shared with Claude — *2026-08-18; revoke at supabase.com/dashboard/account/tokens after launch*
- [x] Database schema + privacy rules applied; anonymous sign-in and email auto-confirm enabled (done by Claude via the token) — *2026-08-18*

### Phase 4 — Twilio + Resend + Apple push setup
*(steps will be added when we get there)*

### Phase 6 — TestFlight & App Store
*(steps will be added when we get there)*
