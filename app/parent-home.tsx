import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RoleTabs, SettingsButton } from "../components/chrome";
import { Sun } from "../components/Sun";
import { calcStreak, checkInTime, todayKey, useStore } from "../lib/store";
import { F, MOODS, T, type Mood } from "../lib/theme";

export default function ParentHome() {
  const { data, checkInNow, setMood } = useStore();
  const [changingMood, setChangingMood] = useState(false);
  if (!data) return null;

  const rec = data.checkins[todayKey()];
  const streak = calcStreak(data.checkins);
  const name = data.myName || data.parentName || "friend";
  const dateLine = new Date().toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  // Three stages: not checked in → pick a mood → done for the day.
  const stage: "sun" | "mood" | "done" = !rec
    ? "sun"
    : rec.mood && !changingMood
      ? "done"
      : "mood";

  return (
    <LinearGradient
      colors={rec ? [T.warm, T.warmDeep] : [T.sky, T.skyDeep]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <SettingsButton />
        <ScrollView contentContainerStyle={styles.wrap}>
          <Text style={styles.date}>{dateLine}</Text>
          <Text style={styles.greeting}>
            {stage === "done" ? `That's it for today,\n${name}.` : `Good morning,\n${name}.`}
          </Text>

          <Sun tapped={!!rec} onTap={checkInNow} />

          {stage === "sun" && (
            <Text style={styles.hintBelow}>
              Tap the sun once a day —{"\n"}that's all there is to it.
            </Text>
          )}

          {stage === "mood" && rec && (
            <View style={styles.afterWrap}>
              <Text style={styles.checkedText}>
                You're all set — checked in at{" "}
                <Text style={{ fontFamily: F.extra }}>{checkInTime(rec)}</Text>.
              </Text>
              <Text style={styles.moodPrompt}>How are you feeling?</Text>
              <View style={styles.moodRow}>
                {(Object.keys(MOODS) as Mood[]).map((k) => {
                  const m = MOODS[k];
                  const on = rec.mood === k;
                  return (
                    <Pressable
                      key={k}
                      onPress={() => {
                        setMood(k);
                        setChangingMood(false);
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: on }}
                      style={[
                        styles.moodBtn,
                        {
                          borderColor: on ? m.color : T.line,
                          borderWidth: on ? 3 : 2,
                          backgroundColor: on ? m.bg : T.paper,
                        },
                      ]}
                    >
                      <Text style={[styles.moodText, { color: on ? m.color : T.ink }]}>
                        {m.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {stage === "done" && rec && rec.mood && (
            <View style={styles.afterWrap}>
              <View style={styles.doneCard}>
                <Text style={styles.doneLine}>
                  Checked in at{" "}
                  <Text style={{ fontFamily: F.extra }}>{checkInTime(rec)}</Text> ·
                  Feeling {MOODS[rec.mood].label.toLowerCase()}
                </Text>
                {streak > 1 && (
                  <Text style={styles.streak}>☀ {streak} mornings in a row</Text>
                )}
              </View>
              <Text style={styles.seeYou}>
                See you tomorrow{"\n"}morning. ☀
              </Text>
              <Pressable onPress={() => setChangingMood(true)} hitSlop={8}>
                <Text style={styles.changeLink}>Change how I'm feeling</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>
        <RoleTabs />
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 1,
    alignItems: "center",
    padding: 26,
    paddingTop: 30,
    paddingBottom: 30,
  },
  date: { fontFamily: F.body, fontSize: 21, color: T.inkSoft, letterSpacing: 0.3 },
  greeting: {
    fontFamily: F.serif,
    fontSize: 40,
    color: T.ink,
    textAlign: "center",
    lineHeight: 46,
    marginTop: 10,
    marginBottom: 28,
  },
  hintBelow: {
    fontFamily: F.body,
    fontSize: 22,
    color: T.inkSoft,
    textAlign: "center",
    lineHeight: 30,
    marginTop: 30,
  },
  afterWrap: { marginTop: 26, width: "100%", alignItems: "center" },
  checkedText: {
    fontFamily: F.body,
    fontSize: 24,
    color: T.ink,
    textAlign: "center",
    lineHeight: 32,
  },
  moodPrompt: {
    fontFamily: F.body,
    fontSize: 20,
    color: T.inkSoft,
    marginTop: 18,
    marginBottom: 12,
  },
  moodRow: { flexDirection: "row", gap: 10, justifyContent: "center" },
  moodBtn: { paddingVertical: 14, paddingHorizontal: 18, borderRadius: 999 },
  moodText: { fontFamily: F.bold, fontSize: 20 },
  doneCard: {
    backgroundColor: "rgba(255,255,255,0.75)",
    borderWidth: 1,
    borderColor: T.line,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  doneLine: { fontFamily: F.body, fontSize: 19, color: T.ink, textAlign: "center" },
  streak: { fontFamily: F.bold, fontSize: 19, color: T.leaf, marginTop: 8 },
  seeYou: {
    fontFamily: F.serif,
    fontSize: 30,
    color: T.ink,
    textAlign: "center",
    lineHeight: 38,
    marginTop: 22,
  },
  changeLink: {
    fontFamily: F.bold,
    fontSize: 15,
    color: T.inkSoft,
    textDecorationLine: "underline",
    marginTop: 20,
  },
});
