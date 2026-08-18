import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RoleTabs, SettingsButton } from "../components/chrome";
import { GhostButton, Kicker } from "../components/ui";
import {
  calcStreak,
  checkInTime,
  dateNDaysAgo,
  deadlineToday,
  fmtTime,
  todayKey,
  usualTime,
  useStore,
  type CheckIn,
} from "../lib/store";
import { F, MOODS, T } from "../lib/theme";

export default function FamilyDash() {
  const { data, refresh } = useStore();
  const [simMissed, setSimMissed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  if (!data) return null;

  const pullRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const history = data.watchedCheckins;
  const realRec = history[todayKey()];
  const rec = simMissed ? undefined : realRec;
  const dl = deadlineToday(data.deadline);
  const pastDeadline = simMissed || new Date() > dl;
  const status: "in" | "missed" | "waiting" = rec
    ? "in"
    : pastDeadline
      ? "missed"
      : "waiting";
  const streak = simMissed ? 0 : calcStreak(history);
  const name = data.parentName || "Your parent";
  const backup = data.contacts.find((c) => !c.isPrimary);

  const days: {
    k: string;
    letter: string;
    rec: CheckIn | undefined;
    isToday: boolean;
  }[] = [];
  for (let n = 13; n >= 0; n--) {
    const d = dateNDaysAgo(n);
    const k = todayKey(d);
    days.push({
      k,
      letter: d.toLocaleDateString([], { weekday: "narrow" }),
      rec: n === 0 && simMissed ? undefined : history[k],
      isToday: n === 0,
    });
  }

  const statusCfg = {
    in: {
      bg: T.leafPale,
      border: T.leaf,
      title: `${name} checked in at ${rec ? checkInTime(rec) : ""} ✓`,
      sub:
        rec?.mood && MOODS[rec.mood]
          ? `Feeling: ${MOODS[rec.mood].label.toLowerCase()}`
          : "All quiet — nothing you need to do.",
    },
    waiting: {
      bg: T.okayPale,
      border: T.sunDeep,
      title: "No check-in yet this morning",
      sub: `Nothing to worry about until ${fmtTime(dl)} — the usual time is ${usualTime(
        history
      )}.`,
    },
    missed: {
      bg: T.clayPale,
      border: T.clay,
      title: `Missed check-in — past ${fmtTime(dl)}`,
      sub: "The escalation ladder below would now be running.",
    },
  }[status];

  const plus = (mins: number) => {
    const c = new Date(dl);
    c.setMinutes(c.getMinutes() + mins);
    return fmtTime(c);
  };
  const ladder = [
    { t: fmtTime(dl), txt: `Push + text you: “${name} hasn't checked in today.”` },
    {
      t: plus(20),
      txt: backup
        ? `Text ${backup.name} (backup contact).`
        : "Text the backup contact (none added yet).",
    },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <SettingsButton />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void pullRefresh()} />
        }
      >
        <View style={styles.card}>
          <Kicker text="Watching over" />
          <Text style={styles.h2}>{name}'s mornings</Text>

          {/* Today's status */}
          <View
            style={[
              styles.status,
              { backgroundColor: statusCfg.bg, borderColor: statusCfg.border },
            ]}
          >
            <Text style={styles.statusTitle}>{statusCfg.title}</Text>
            <Text style={styles.statusSub}>{statusCfg.sub}</Text>
          </View>

          {/* Escalation ladder, shown when missed */}
          {status === "missed" && (
            <View style={styles.ladder}>
              <Text style={styles.ladderHead}>
                ESCALATION LADDER {simMissed ? "(SIMULATED)" : ""}
              </Text>
              {ladder.map((s, i) => (
                <View key={i} style={styles.ladderRow}>
                  <Text style={styles.ladderTime}>{s.t}</Text>
                  <Text style={styles.ladderText}>{s.txt}</Text>
                </View>
              ))}
              <Text style={styles.ladderNote}>
                Real alerts arrive in Phase 4 of the build — this shows what will
                happen.
              </Text>
            </View>
          )}

          {/* 14-day history */}
          <Text style={styles.sectionLabel}>LAST 14 MORNINGS</Text>
          <View style={styles.daysRow}>
            {days.map((d) => {
              const mood = d.rec?.mood ? MOODS[d.rec.mood] : null;
              const bg = d.rec
                ? mood
                  ? mood.bg
                  : T.leafPale
                : d.isToday && !pastDeadline
                  ? T.paper
                  : T.clayPale;
              const fg = d.rec ? (mood ? mood.color : T.leaf) : T.clay;
              return (
                <View key={d.k} style={{ flex: 1, alignItems: "center" }}>
                  <View
                    style={[
                      styles.dayCell,
                      {
                        backgroundColor: bg,
                        borderColor: d.isToday ? T.ink : T.line,
                        borderWidth: d.isToday ? 2 : 1.5,
                      },
                    ]}
                  >
                    <Text style={[styles.dayMark, { color: fg }]}>
                      {d.rec ? "✓" : d.isToday && !pastDeadline ? "·" : "✕"}
                    </Text>
                  </View>
                  <Text style={styles.dayLetter}>{d.letter}</Text>
                </View>
              );
            })}
          </View>

          {Object.keys(history).length === 0 && (
            <Text style={styles.emptyNote}>
              History fills in as {name} checks in each morning — day one starts
              when they enter their invite code.
            </Text>
          )}

          {/* Stats */}
          <View style={styles.statRow}>
            <Stat label="Streak" value={`${streak} days`} />
            <Stat label="Usual time" value={usualTime(history)} />
            <Stat label="Deadline" value={fmtTime(dl)} />
          </View>

          {/* Demo controls */}
          <View style={styles.demoRow}>
            <Text style={styles.demoLabel}>DEMO</Text>
            <GhostButton
              label={simMissed ? "End simulation" : "Simulate a missed morning"}
              onPress={() => setSimMissed(!simMissed)}
            />
          </View>
        </View>
      </ScrollView>
      <RoleTabs />
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.sky },
  scroll: { padding: 16, paddingTop: 46, paddingBottom: 24 },
  card: {
    backgroundColor: T.paper,
    borderRadius: 30,
    padding: 24,
    borderWidth: 1,
    borderColor: T.line,
  },
  h2: { fontFamily: F.serif, fontSize: 30, color: T.ink, marginTop: 6, marginBottom: 18 },
  status: { borderWidth: 2, borderRadius: 18, padding: 18, marginBottom: 20 },
  statusTitle: { fontFamily: F.extra, fontSize: 21, color: T.ink, lineHeight: 27 },
  statusSub: { fontFamily: F.body, fontSize: 16, color: T.inkSoft, marginTop: 6 },
  ladder: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: T.clay,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  ladderHead: {
    fontFamily: F.extra,
    fontSize: 13,
    color: T.clay,
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  ladderRow: { flexDirection: "row", gap: 10, paddingVertical: 5 },
  ladderTime: { fontFamily: F.extra, fontSize: 15, color: T.clay, minWidth: 74 },
  ladderText: { fontFamily: F.body, fontSize: 15, color: T.ink, flex: 1 },
  ladderNote: { fontFamily: F.body, fontSize: 13, color: T.inkSoft, marginTop: 8 },
  sectionLabel: {
    fontFamily: F.bold,
    fontSize: 14,
    color: T.inkSoft,
    marginBottom: 8,
  },
  daysRow: {
    flexDirection: "row",
    gap: 5,
    backgroundColor: T.panel,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: 20,
  },
  dayCell: {
    height: 40,
    alignSelf: "stretch",
    width: "100%",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  dayMark: { fontFamily: F.serif, fontSize: 17 },
  dayLetter: { fontFamily: F.body, fontSize: 11, color: T.inkSoft, marginTop: 4 },
  statRow: { flexDirection: "row", gap: 12, marginBottom: 4 },
  stat: {
    flex: 1,
    backgroundColor: T.panel,
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  statLabel: { fontFamily: F.bold, fontSize: 12, color: T.inkSoft },
  statValue: { fontFamily: F.extra, fontSize: 18, color: T.ink, marginTop: 2 },
  demoRow: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: T.line,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
  },
  demoLabel: { fontFamily: F.bold, fontSize: 13, color: T.inkSoft },
  emptyNote: {
    fontFamily: F.body,
    fontSize: 14,
    color: T.inkSoft,
    lineHeight: 20,
    marginTop: -10,
    marginBottom: 18,
  },
});
