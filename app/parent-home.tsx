import { LinearGradient } from "expo-linear-gradient";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RoleTabs, SettingsButton } from "../components/chrome";
import { Sun } from "../components/Sun";
import { FadeIn, Tappable } from "../components/ui";
import { calcStreak, checkInTime, todayKey, useStore } from "../lib/store";
import { F, MOODS, R, S, T, greetingFor, shadow, type as ty, type Mood } from "../lib/theme";

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
      colors={rec ? [T.warm, T.warmDeep] : [T.skyMist, T.skyDeep]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <SettingsButton />
        <ScrollView
          contentContainerStyle={styles.wrap}
          showsVerticalScrollIndicator={false}
        >
          <FadeIn>
            <Text style={styles.date}>{dateLine.toUpperCase()}</Text>
            <Text style={styles.greeting}>
              {stage === "done" ? "That's it for today," : `${greetingFor()},`}
              {"\n"}
              {name}.
            </Text>
          </FadeIn>

          {data.loveForMe && stage !== "mood" && (
            <FadeIn delay={120}>
              <View style={styles.loveCard}>
                <Text style={styles.loveHeart}>❤️</Text>
                <Text style={styles.loveText}>
                  {data.loveForMe.from} saw you were OK
                  {data.loveForMe.day === todayKey() ? "" : " yesterday"} and sent
                  you love.
                </Text>
              </View>
            </FadeIn>
          )}

          <FadeIn delay={80} style={styles.sunWrap}>
            <Sun tapped={!!rec} onTap={checkInNow} />
          </FadeIn>

          {stage === "sun" && (
            <FadeIn delay={200}>
              <Text style={styles.hint}>
                Tap the sun once a day —{"\n"}that's all there is to it.
              </Text>
              {streak > 1 && (
                <View style={styles.streakPill}>
                  <Text style={styles.streakText}>☀ {streak} mornings in a row</Text>
                </View>
              )}
            </FadeIn>
          )}

          {stage === "mood" && rec && (
            <FadeIn delay={120} style={{ width: "100%" }}>
              <Text style={styles.checkedText}>
                Checked in at{" "}
                <Text style={{ fontFamily: F.extra, color: T.ink }}>
                  {checkInTime(rec)}
                </Text>
              </Text>
              <Text style={styles.moodPrompt}>How are you feeling?</Text>
              <View style={styles.moodRow}>
                {(Object.keys(MOODS) as Mood[]).map((k) => {
                  const m = MOODS[k];
                  const on = rec.mood === k;
                  return (
                    <Tappable
                      key={k}
                      haptic="medium"
                      accessibilityLabel={m.label}
                      onPress={() => {
                        setMood(k);
                        setChangingMood(false);
                      }}
                      style={[
                        styles.moodCard,
                        {
                          borderColor: on ? m.color : T.line,
                          backgroundColor: on ? m.bg : T.paper,
                        },
                        shadow(1),
                      ]}
                    >
                      <Text style={styles.moodEmoji}>{m.emoji}</Text>
                      <Text style={[styles.moodLabel, { color: on ? m.color : T.ink }]}>
                        {m.label}
                      </Text>
                    </Tappable>
                  );
                })}
              </View>
            </FadeIn>
          )}

          {stage === "done" && rec && rec.mood && (
            <FadeIn delay={120} style={{ width: "100%", alignItems: "center" }}>
              <View style={[styles.doneCard, shadow(1)]}>
                <View style={styles.doneRow}>
                  <Text style={styles.doneLabel}>Checked in</Text>
                  <Text style={styles.doneValue}>{checkInTime(rec)}</Text>
                </View>
                <View style={styles.doneDivider} />
                <View style={styles.doneRow}>
                  <Text style={styles.doneLabel}>Feeling</Text>
                  <Text style={styles.doneValue}>
                    {MOODS[rec.mood].emoji} {MOODS[rec.mood].label}
                  </Text>
                </View>
                {streak > 1 && (
                  <>
                    <View style={styles.doneDivider} />
                    <View style={styles.doneRow}>
                      <Text style={styles.doneLabel}>Streak</Text>
                      <Text style={[styles.doneValue, { color: T.leaf }]}>
                        ☀ {streak} mornings
                      </Text>
                    </View>
                  </>
                )}
              </View>

              <Text style={styles.seeYou}>See you tomorrow{"\n"}morning.</Text>

              <Tappable
                onPress={() => setChangingMood(true)}
                style={styles.changeBtn}
                accessibilityLabel="Change how I'm feeling"
              >
                <Text style={styles.changeText}>Change how I'm feeling</Text>
              </Tappable>
            </FadeIn>
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
    paddingHorizontal: S.xxl,
    paddingTop: S.xxl,
    paddingBottom: S.xxl,
  },
  date: {
    fontFamily: F.extra,
    fontSize: 12.5,
    letterSpacing: 1.6,
    color: T.inkFaint,
    textAlign: "center",
  },
  greeting: {
    ...ty.parentHero,
    textAlign: "center",
    marginTop: S.md,
  },
  sunWrap: { marginTop: S.sm },
  hint: {
    ...ty.parentBody,
    textAlign: "center",
    marginTop: S.lg,
  },
  streakPill: {
    alignSelf: "center",
    backgroundColor: T.leafPale,
    borderWidth: 1,
    borderColor: "#B9DCC8",
    borderRadius: R.pill,
    paddingVertical: 9,
    paddingHorizontal: S.xl,
    marginTop: S.xl,
  },
  streakText: { fontFamily: F.bold, fontSize: 16, color: T.leaf },

  checkedText: {
    ...ty.parentBody,
    textAlign: "center",
    marginTop: S.lg,
  },
  moodPrompt: {
    fontFamily: F.display,
    fontSize: 26,
    lineHeight: 33,
    color: T.ink,
    textAlign: "center",
    marginTop: S.xl,
    marginBottom: S.lg,
  },
  moodRow: { flexDirection: "row", gap: S.md },
  moodCard: {
    flex: 1,
    borderWidth: 2,
    borderRadius: R.lg,
    paddingVertical: S.lg,
    paddingHorizontal: S.sm,
    alignItems: "center",
  },
  moodEmoji: { fontSize: 34 },
  moodLabel: { fontFamily: F.bold, fontSize: 16, marginTop: 6, textAlign: "center" },

  doneCard: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.82)",
    borderRadius: R.xl,
    borderWidth: 1,
    borderColor: "#EEE1C6",
    paddingVertical: S.sm,
    paddingHorizontal: S.xl,
    marginTop: S.xl,
  },
  doneRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: S.md,
  },
  doneLabel: { fontFamily: F.body, fontSize: 17, color: T.inkSoft },
  doneValue: { fontFamily: F.bold, fontSize: 18, color: T.ink },
  doneDivider: { height: 1, backgroundColor: "#EEE1C6" },

  seeYou: {
    fontFamily: F.display,
    fontSize: 28,
    lineHeight: 36,
    color: T.ink,
    textAlign: "center",
    marginTop: S.xxl,
  },
  changeBtn: { paddingVertical: S.md, paddingHorizontal: S.lg, marginTop: S.sm },
  changeText: {
    fontFamily: F.semi,
    fontSize: 15,
    color: T.inkFaint,
    textDecorationLine: "underline",
  },

  loveCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: T.clayPale,
    borderWidth: 1,
    borderColor: T.clayLine,
    borderRadius: R.lg,
    paddingVertical: S.md,
    paddingHorizontal: S.lg,
    marginTop: S.lg,
    maxWidth: 360,
  },
  loveHeart: { fontSize: 22, marginRight: S.md },
  loveText: {
    fontFamily: F.semi,
    fontSize: 16.5,
    lineHeight: 23,
    color: T.clay,
    flex: 1,
  },
});
