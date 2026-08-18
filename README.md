# OK Today

A daily check-in app for aging parents. The parent taps one big sun button each morning ("I'm OK today"). If they don't check in by their deadline, the family member and a backup contact are alerted automatically — by a server-side job that never depends on a phone being on.

**The full build plan is in [PLAN.md](./PLAN.md).**

## Status

- **Current phase:** 1 built — waiting on an Expo access token to put it on Austin's iPhone
- The design prototype lives in `design/ok-today-prototype.jsx` and is the visual source of truth.
- Phase 2 (real accounts + Supabase) starts once the Supabase project exists.

## How to test Phase 1 on your iPhone

1. Install the free **Expo Go** app from the App Store on your iPhone.
2. On a computer, sign in at https://expo.dev → click your profile picture (top right) → **Account settings** → **Access tokens** → **Create token**. Name it `claude-build` and copy the long code it shows you.
3. Paste that code to Claude in the build chat. (It lets Claude publish test versions to your Expo account. You can delete the token from that same page at any time to switch it off.)
4. Claude publishes the app and gives you a link/QR code to open in Expo Go.

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
- [ ] Expo Go installed on iPhone
- [ ] Expo access token created and shared with Claude
- [ ] App opened in Expo Go and every screen tapped through

### Phase 2 — Supabase setup
*(steps will be added when we get there)*

### Phase 4 — Twilio + Resend + Apple push setup
*(steps will be added when we get there)*

### Phase 6 — TestFlight & App Store
*(steps will be added when we get there)*
