import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RoleTabs, SettingsButton } from "../components/chrome";
import { Sun } from "../components/Sun";
import { FadeIn, Tappable } from "../components/ui";
import { fill, greeting, t } from "../lib/i18n";
import { calcStreak, checkInTime, todayKey, useStore } from "../lib/store";
import { F, MOODS, R, S, T, shadow, type as ty, type Mood } from "../lib/theme";
import { getWeather, type Weather } from "../lib/weather";

export default function ParentHome() {
  const { data, checkInNow, setMood } = useStore();
  const [changingMood, setChangingMood] = useState(false);
  const [weather, setWeather] = useState<Weather | null>(null);
  const tz = data?.timezone;

  useEffect(() => {
    let alive = true;
    void getWeather(tz).then((w) => alive && setWeather(w));
    return () => {
      alive = false;
    };
  }, [tz]);

  if (!data) return null;
  const L = t(data.lang);

  const rec = data.checkins[todayKey()];
  const streak = calcStreak(data.checkins);
  const name = data.myName || data.parentName || "";
  const dateLine = new Date().toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const moodLabel: Record<Mood, string> = {
    good: L.moodGood,
    okay: L.moodOkay,
    notgreat: L.moodNotGreat,
  };

  // Three stages: not checked in → pick a mood → done for the day.
  const stage: "sun" | "mood" | "done" = !rec
    ? "sun"
    : rec.mood && !changingMood
      ? "done"
      : "mood";

  const love = data.loveForMe;
  const loveLine = love
    ? fill(love.day === todayKey() ? L.loveToday : L.loveYesterday, { name: love.from })
    : null;

  return (
    <LinearGradient
      colors={rec ? [T.warm, T.warmDeep] : [T.skyMist, T.skyDeep]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }} edges={["top", "left", "right"]}>
        <SettingsButton />
        <ScrollView contentContainerStyle={styles.wrap} showsVerticalScrollIndicator={false}>
          <FadeIn>
            <Text style={styles.date}>{dateLine.toUpperCase()}</Text>
            <Text style={styles.greeting}>
              {stage === "done" ? L.thatsIt : `${greeting(data.lang)},`}
              {name ? `\n${name}.` : ""}
            </Text>
            {weather && (
              <Text style={styles.weather}>
                {weather.emoji}  {weather.tempC}° · {weather.text}
              </Text>
            )}
          </FadeIn>

          {love && stage !== "mood" && (
            <FadeIn delay={120}>
              <View style={styles.loveCard}>
                <Text style={styles.loveHeart}>❤️</Text>
                <View style={{ flex: 1 }}>
                  {love.message ? (
                    <>
                      <Text style={styles.loveMessage}>“{love.message}”</Text>
                      <Text style={styles.loveFrom}>— {love.from}</Text>
                    </>
                  ) : (
                    <Text style={styles.loveText}>{loveLine}</Text>
                  )}
                </View>
              </View>
            </FadeIn>
          )}

          <FadeIn delay={80} style={styles.sunWrap}>
            <Sun tapped={!!rec} onTap={checkInNow} labelIdle={L.sunLabel} labelDone={L.sunDone} />
          </FadeIn>

          {stage === "sun" && (
            <FadeIn delay={200}>
              <Text style={styles.hint}>{L.tapHint}</Text>
              {streak > 1 && (
                <View style={styles.streakPill}>
                  <Text style={styles.streakText}>{fill(L.streakRow, { n: streak })}</Text>
                </View>
              )}
            </FadeIn>
          )}

          {stage === "mood" && rec && (
            <FadeIn delay={120} style={{ width: "100%" }}>
              <Text style={styles.checkedText}>
                {L.checkedInAt}{" "}
                <Text style={{ fontFamily: F.extra, color: T.ink }}>{checkInTime(rec)}</Text>
              </Text>
              <Text style={styles.moodPrompt}>{L.howFeeling}</Text>
              <View style={styles.moodRow}>
                {(Object.keys(MOODS) as Mood[]).map((k) => {
                  const m = MOODS[k];
                  const on = rec.mood === k;
                  return (
                    <Tappable
                      key={k}
                      haptic="medium"
                      accessibilityLabel={moodLabel[k]}
                      onPress={() => {
                        setMood(k);
                        setChangingMood(false);
                      }}
                      style={[
                        styles.moodCard,
                        { borderColor: on ? m.color : T.line, backgroundColor: on ? m.bg : T.paper },
                        shadow(1),
                      ]}
                    >
                      <Text style={styles.moodEmoji}>{m.emoji}</Text>
                      <Text style={[styles.moodLabel, { color: on ? m.color : T.ink }]}>
                        {moodLabel[k]}
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
                  <Text style={styles.doneLabel}>{L.checkedInAt}</Text>
                  <Text style={styles.doneValue}>{checkInTime(rec)}</Text>
                </View>
                <View style={styles.doneDivider} />
                <View style={styles.doneRow}>
                  <Text style={styles.doneLabel}>{L.feeling}</Text>
                  <Text style={styles.doneValue}>
                    {MOODS[rec.mood].emoji} {moodLabel[rec.mood]}
                  </Text>
                </View>
                {streak > 1 && (
                  <>
                    <View style={styles.doneDivider} />
                    <View style={styles.doneRow}>
                      <Text style={styles.doneLabel}>{L.streak}</Text>
                      <Text style={[styles.doneValue, { color: T.leaf }]}>
                        ☀ {streak} {L.mornings}
                      </Text>
                    </View>
                  </>
                )}
              </View>

              <Text style={styles.seeYou}>{L.seeYou}</Text>

              <Tappable
                onPress={() => setChangingMood(true)}
                style={styles.changeBtn}
                accessibilityLabel={L.changeMood}
              >
                <Text style={styles.changeText}>{L.changeMood}</Text>
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
  date: { fontFamily: F.extra, fontSize: 12.5, letterSpacing: 1.6, color: T.inkFaint, textAlign: "center" },
  greeting: { ...ty.parentHero, textAlign: "center", marginTop: S.md },
  weather: {
    fontFamily: F.semi,
    fontSize: 19,
    color: T.inkSoft,
    textAlign: "center",
    marginTop: S.md,
  },
  sunWrap: { marginTop: S.sm },
  hint: { ...ty.parentBody, textAlign: "center", marginTop: S.lg },
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

  checkedText: { ...ty.parentBody, textAlign: "center", marginTop: S.lg },
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
  moodLabel: { fontFamily: F.bold, fontSize: 15, marginTop: 6, textAlign: "center" },

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
  changeText: { fontFamily: F.semi, fontSize: 15, color: T.inkFaint, textDecorationLine: "underline" },

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
  loveText: { fontFamily: F.semi, fontSize: 16.5, lineHeight: 23, color: T.clay },
  loveMessage: { fontFamily: F.semi, fontSize: 17.5, lineHeight: 25, color: T.clay },
  loveFrom: { fontFamily: F.bold, fontSize: 14, color: T.clay, marginTop: 4, opacity: 0.8 },
});
