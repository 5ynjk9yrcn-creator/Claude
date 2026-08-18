import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RoleTabs } from "../components/chrome";
import {
  Avatar,
  Card,
  FadeIn,
  GhostButton,
  SectionLabel,
  Tappable,
} from "../components/ui";
import {
  calcStreak,
  checkInTime,
  dayKeyTz,
  dayKeyTzBack,
  deadlineToday,
  fmtTime,
  usualTime,
  useStore,
  type AlertRow,
  type CheckIn,
} from "../lib/store";
import { F, MOODS, R, S, T, shadow, type as ty } from "../lib/theme";

export default function FamilyDash() {
  const { data, refresh, sendLove, startTestAlarm } = useStore();
  const router = useRouter();
  const [simMissed, setSimMissed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loveBusy, setLoveBusy] = useState(false);
  const [testBusy, setTestBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  if (!data) return null;

  // Everything on this screen is shown in the watched person's timezone,
  // which may differ from the viewer's.
  const tz = data.timezone;
  const history = data.watchedCheckins;
  const realRec = history[dayKeyTz(tz)];
  const rec = simMissed ? undefined : realRec;
  const dl = deadlineToday(data.deadline);
  const pastDeadline = simMissed || minutesNowTz(tz) >= minutesOf(data.deadline);
  const status: "in" | "missed" | "waiting" = rec ? "in" : pastDeadline ? "missed" : "waiting";
  const streak = simMissed ? 0 : calcStreak(history, tz);
  const name = data.parentName || "Your parent";
  const loveSent = data.loveSentDay === dayKeyTz(tz);
  const testActive = !!data.testDeadlineAt;

  const pullRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const onSendLove = async () => {
    if (loveBusy || loveSent) return;
    setLoveBusy(true);
    setNote(null);
    const err = await sendLove();
    setLoveBusy(false);
    if (err) setNote(err);
  };

  const onStartTest = async () => {
    if (testBusy || testActive) return;
    setTestBusy(true);
    setNote(null);
    const err = await startTestAlarm();
    setTestBusy(false);
    if (err) setNote(err);
  };

  const days: { k: string; letter: string; rec: CheckIn | undefined; isToday: boolean }[] = [];
  for (let n = 13; n >= 0; n--) {
    const k = dayKeyTzBack(tz, n);
    days.push({
      k,
      // Parse as a plain local date so the weekday letter matches the key.
      letter: new Date(`${k}T12:00:00`).toLocaleDateString([], { weekday: "narrow" }),
      rec: n === 0 && simMissed ? undefined : history[k],
      isToday: n === 0,
    });
  }

  const cfg = {
    in: {
      tint: T.leafPale,
      accent: T.leaf,
      border: "#B9DCC8",
      icon: "checkmark-circle" as const,
      title: `Checked in at ${rec ? checkInTime(rec, tz) : ""}`,
      sub:
        rec?.mood && MOODS[rec.mood]
          ? `Feeling ${MOODS[rec.mood].label.toLowerCase()} ${MOODS[rec.mood].emoji}`
          : "All quiet — nothing you need to do.",
    },
    waiting: {
      tint: T.sunPale,
      accent: T.sunDeep,
      border: "#EBCF8C",
      icon: "time-outline" as const,
      title: "No check-in yet",
      sub: `Nothing to worry about until ${fmtTime(dl)}. Usual time is ${usualTime(history, tz)}.`,
    },
    missed: {
      tint: T.clayPale,
      accent: T.clay,
      border: T.clayLine,
      icon: "alert-circle" as const,
      title: `Missed check-in`,
      sub: `Nothing since the ${fmtTime(dl)} deadline — alerts are going out.`,
    },
  }[status];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "left", "right"]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void pullRefresh()} tintColor={T.inkSoft} />
        }
      >
        {/* Header */}
        <FadeIn>
          <View style={styles.header}>
            <Avatar name={name} size={48} />
            <View style={{ flex: 1, marginLeft: S.md }}>
              <Text style={styles.headerKicker}>WATCHING OVER</Text>
              <Text style={styles.headerName} numberOfLines={1}>
                {name}
              </Text>
            </View>
            <Tappable
              onPress={() => router.push("/settings")}
              accessibilityLabel="Open settings"
              style={[styles.gear, shadow(1)]}
            >
              <Ionicons name="settings-outline" size={20} color={T.inkSoft} />
            </Tappable>
          </View>
        </FadeIn>

        {/* Today's status */}
        <FadeIn delay={60}>
          <View
            style={[
              styles.hero,
              { backgroundColor: cfg.tint, borderColor: cfg.border },
              shadow(1),
            ]}
          >
            <View style={styles.heroTop}>
              <View style={[styles.heroIcon, { backgroundColor: cfg.accent + "1F" }]}>
                <Ionicons name={cfg.icon} size={26} color={cfg.accent} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.heroTitle}>{cfg.title}</Text>
                <Text style={styles.heroSub}>{cfg.sub}</Text>
              </View>
            </View>

            {status === "in" && !simMissed && (
              <Tappable
                onPress={() => void onSendLove()}
                disabled={loveSent || loveBusy}
                haptic="medium"
                accessibilityLabel={loveSent ? "Heart already sent today" : `Send ${name} a heart`}
                style={[styles.loveBtn, loveSent ? styles.loveBtnSent : null]}
              >
                <Text style={styles.loveBtnText}>
                  {loveSent
                    ? `❤️  Sent — it'll greet ${name} on their sun`
                    : loveBusy
                      ? "Sending…"
                      : `❤️  Send ${name} a heart`}
                </Text>
              </Tappable>
            )}
          </View>
        </FadeIn>

        {/* Stats */}
        <FadeIn delay={110}>
          <View style={styles.statRow}>
            <Stat icon="flame" label="Streak" value={`${streak}`} unit={streak === 1 ? "day" : "days"} tint={T.sunDeep} />
            <Stat icon="alarm-outline" label="Usual" value={usualTime(history, tz)} tint={T.ink} />
            <Stat icon="flag-outline" label="Deadline" value={fmtTime(dl)} tint={T.ink} />
          </View>
        </FadeIn>

        {/* 14-day history */}
        <FadeIn delay={150}>
          <SectionLabel text="Last 14 mornings" style={{ marginTop: S.xxl }} />
          <Card padded={false} style={{ paddingVertical: S.lg, paddingHorizontal: S.md }}>
            <View style={styles.daysRow}>
              {days.map((d) => {
                const mood = d.rec?.mood ? MOODS[d.rec.mood] : null;
                const pending = d.isToday && !pastDeadline && !d.rec;
                const bg = d.rec ? (mood ? mood.bg : T.leafPale) : pending ? T.panel : T.clayPale;
                const fg = d.rec ? (mood ? mood.color : T.leaf) : pending ? T.inkFaint : T.clay;
                return (
                  <View key={d.k} style={styles.dayCol}>
                    <View
                      style={[
                        styles.dayCell,
                        {
                          backgroundColor: bg,
                          borderColor: d.isToday ? T.ink : "transparent",
                          borderWidth: d.isToday ? 2 : 0,
                        },
                      ]}
                    >
                      <Ionicons
                        name={d.rec ? "checkmark" : pending ? "ellipse" : "close"}
                        size={d.rec || !pending ? 17 : 6}
                        color={fg}
                      />
                    </View>
                    <Text style={[styles.dayLetter, d.isToday ? styles.dayLetterToday : null]}>
                      {d.letter}
                    </Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.legend}>
              <LegendDot color={T.leaf} label="Checked in" />
              <LegendDot color={T.clay} label="Missed" />
              <LegendDot color={T.inkFaint} label="Today, pending" />
            </View>
            {Object.keys(history).length === 0 && (
              <Text style={styles.emptyNote}>
                This fills in as {name} checks in — day one starts when they enter
                their invite code.
              </Text>
            )}
          </Card>
        </FadeIn>

        {/* What the escalation system did today */}
        {(data.todaysAlerts.length > 0 || testActive) && (
          <FadeIn delay={180}>
            <SectionLabel text="What the system did today" style={{ marginTop: S.xxl }} />
            <Card>
              {testActive && (
                <View style={styles.testBanner}>
                  <Ionicons name="flask" size={16} color={T.sunDeep} />
                  <Text style={styles.testBannerText}>
                    Test alarm running — steps appear here within a minute of each
                    other. Pull down to refresh.
                  </Text>
                </View>
              )}
              {data.todaysAlerts.map((a, i) => (
                <View key={i} style={styles.timelineRow}>
                  <View style={styles.timelineLeft}>
                    <View style={[styles.timelineDot, { backgroundColor: dotColor(a) }]} />
                    {i < data.todaysAlerts.length - 1 && <View style={styles.timelineLine} />}
                  </View>
                  <View style={{ flex: 1, paddingBottom: S.lg }}>
                    <Text style={styles.timelineTime}>
                      {new Date(a.at).toLocaleTimeString([], {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </Text>
                    <Text style={styles.timelineText}>{alertLabel(a, name)}</Text>
                    <Text style={[styles.timelineStatus, { color: statusColor(a.status) }]}>
                      {statusLabel(a.status)}
                    </Text>
                  </View>
                </View>
              ))}
            </Card>
          </FadeIn>
        )}

        {/* Testing */}
        <FadeIn delay={210}>
          <SectionLabel text="Testing" style={{ marginTop: S.xxl }} />
          <Card>
            <View style={styles.testRow}>
              <GhostButton
                label={simMissed ? "End preview" : "Preview a missed morning"}
                icon="eye-outline"
                onPress={() => setSimMissed(!simMissed)}
              />
              <GhostButton
                label={testActive ? "Test running…" : testBusy ? "Starting…" : "Test the real alarm"}
                icon="flask-outline"
                tone="clay"
                onPress={() => void onStartTest()}
              />
            </View>
            <Text style={styles.testNote}>
              <Text style={{ fontFamily: F.bold }}>Preview</Text> only changes this
              screen.{" "}
              <Text style={{ fontFamily: F.bold }}>Test the real alarm</Text> asks the
              server to run a fake missed morning — reminder, your alert, then the
              backup — compressed into about five minutes and logged above.
            </Text>
            {note && <Text style={styles.noteError}>{note}</Text>}
          </Card>
        </FadeIn>
      </ScrollView>
      <RoleTabs />
    </SafeAreaView>
  );
}

function Stat({
  icon,
  label,
  value,
  unit,
  tint,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  unit?: string;
  tint: string;
}) {
  return (
    <View style={[styles.stat, shadow(1)]}>
      <Ionicons name={icon} size={16} color={tint} />
      <Text style={styles.statValue} numberOfLines={1}>
        {value}
        {unit ? <Text style={styles.statUnit}> {unit}</Text> : null}
      </Text>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/* Current minute-of-day where the watched person lives. */
function minutesNowTz(tz?: string): number {
  try {
    const s = new Date().toLocaleTimeString("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return minutesOf(s);
  } catch {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  }
}

function alertLabel(a: AlertRow, parentName: string): string {
  const test = a.isTest ? " (test)" : "";
  switch (a.kind) {
    case "reminder":
      return `Reminder sent to ${parentName}${test}`;
    case "primary":
      return a.channel === "sms"
        ? `Alert text to ${a.target}${test}`
        : `Alert to your phone${test}`;
    case "backup":
      return `Backup text to ${a.target}${test}`;
    case "allclear":
      return a.channel === "sms"
        ? `False-alarm text to ${a.target}`
        : "False-alarm notice to your phone";
    case "notgreat":
      return `"Not great" heads-up to your phone`;
  }
}

const statusLabel = (s: string) =>
  s === "sent"
    ? "Delivered"
    : s === "skipped"
      ? "Logged — delivery arrives with Twilio / TestFlight"
      : s === "failed"
        ? "Failed"
        : "Pending";

const statusColor = (s: string) =>
  s === "sent" ? T.leaf : s === "failed" ? T.clay : T.inkFaint;

const dotColor = (a: AlertRow) =>
  a.kind === "allclear" ? T.leaf : a.kind === "reminder" ? T.sunDeep : T.clay;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.sky },
  scroll: { paddingHorizontal: S.xl, paddingTop: S.md, paddingBottom: S.xxl },

  header: { flexDirection: "row", alignItems: "center", marginBottom: S.xl },
  headerKicker: {
    fontFamily: F.extra,
    fontSize: 11,
    letterSpacing: 1.5,
    color: T.inkFaint,
  },
  headerName: { fontFamily: F.display, fontSize: 27, color: T.ink, marginTop: 2 },
  gear: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: T.paper,
    borderWidth: 1,
    borderColor: T.lineSoft,
    alignItems: "center",
    justifyContent: "center",
  },

  hero: { borderRadius: R.xl, borderWidth: 1, padding: S.xl },
  heroTop: { flexDirection: "row", alignItems: "flex-start" },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: S.lg,
  },
  heroTitle: { fontFamily: F.display, fontSize: 22, lineHeight: 28, color: T.ink },
  heroSub: {
    fontFamily: F.body,
    fontSize: 15,
    lineHeight: 21,
    color: T.inkSoft,
    marginTop: 4,
  },
  loveBtn: {
    marginTop: S.lg,
    backgroundColor: T.paper,
    borderRadius: R.pill,
    borderWidth: 1.5,
    borderColor: T.clayLine,
    paddingVertical: 12,
    alignItems: "center",
  },
  loveBtnSent: { backgroundColor: "transparent", borderStyle: "dashed" },
  loveBtnText: { fontFamily: F.bold, fontSize: 15, color: T.clay },

  statRow: { flexDirection: "row", gap: S.md, marginTop: S.lg },
  stat: {
    flex: 1,
    backgroundColor: T.paper,
    borderRadius: R.lg,
    borderWidth: 1,
    borderColor: T.lineSoft,
    paddingVertical: S.lg,
    paddingHorizontal: S.md,
    alignItems: "center",
  },
  statValue: { fontFamily: F.extra, fontSize: 20, color: T.ink, marginTop: 6 },
  statUnit: { fontFamily: F.semi, fontSize: 13, color: T.inkSoft },
  statLabel: {
    fontFamily: F.extra,
    fontSize: 10,
    letterSpacing: 1.2,
    color: T.inkFaint,
    marginTop: 3,
  },

  daysRow: { flexDirection: "row", gap: 4 },
  dayCol: { flex: 1, alignItems: "center" },
  dayCell: {
    width: "100%",
    height: 42,
    borderRadius: R.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  dayLetter: {
    fontFamily: F.semi,
    fontSize: 11,
    color: T.inkFaint,
    marginTop: 5,
  },
  dayLetterToday: { color: T.ink, fontFamily: F.extra },
  legend: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: S.md,
    marginTop: S.lg,
    paddingTop: S.md,
    borderTopWidth: 1,
    borderTopColor: T.lineSoft,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: F.body, fontSize: 12, color: T.inkSoft },
  emptyNote: { ...ty.small, marginTop: S.md },

  testBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: S.sm,
    backgroundColor: T.sunPale,
    borderRadius: R.md,
    padding: S.md,
    marginBottom: S.lg,
  },
  testBannerText: {
    fontFamily: F.semi,
    fontSize: 13.5,
    lineHeight: 19,
    color: T.sunDeep,
    flex: 1,
  },
  timelineRow: { flexDirection: "row" },
  timelineLeft: { width: 22, alignItems: "center" },
  timelineDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  timelineLine: { width: 2, flex: 1, backgroundColor: T.lineSoft, marginVertical: 3 },
  timelineTime: {
    fontFamily: F.extra,
    fontSize: 11,
    letterSpacing: 0.8,
    color: T.inkFaint,
  },
  timelineText: { fontFamily: F.semi, fontSize: 15, color: T.ink, marginTop: 2 },
  timelineStatus: { fontFamily: F.body, fontSize: 12.5, marginTop: 2 },

  testRow: { flexDirection: "row", flexWrap: "wrap", gap: S.sm },
  testNote: { ...ty.small, marginTop: S.md },
  noteError: { fontFamily: F.semi, fontSize: 13, color: T.clay, marginTop: S.sm },
});
