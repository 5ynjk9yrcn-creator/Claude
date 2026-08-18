import { LinearGradient } from "expo-linear-gradient";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Sun } from "../components/Sun";
import { calcStreak, checkInTime, todayKey, useStore } from "../lib/store";
import { F, MOODS, T, type Mood } from "../lib/theme";

export default function ParentHome() {
  const { data, checkInNow, setMood } = useStore();
  if (!data) return null;

  const rec = data.checkins[todayKey()];
  const streak = calcStreak(data.checkins);
  const dateLine = new Date().toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <LinearGradient
      colors={rec ? [T.warm, T.warmDeep] : [T.sky, T.skyDeep]}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.wrap}>
          <Text style={styles.date}>{dateLine}</Text>
          <Text style={styles.greeting}>
            Good morning,{"\n"}
            {data.parentName || "friend"}.
          </Text>

          <Sun tapped={!!rec} onTap={checkInNow} />

          {!rec && (
            <Text style={styles.hintBelow}>
              Tap the sun once a day —{"\n"}that's all there is to it.
            </Text>
          )}

          {rec && (
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
                      onPress={() => setMood(k)}
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
                      <Text
                        style={[styles.moodText, { color: on ? m.color : T.ink }]}
                      >
                        {m.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {streak > 1 && (
                <Text style={styles.streak}>☀ {streak} mornings in a row</Text>
              )}
            </View>
          )}
        </ScrollView>
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
    paddingBottom: 46,
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
  afterWrap: { marginTop: 30, width: "100%", alignItems: "center" },
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
  moodBtn: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 999,
  },
  moodText: { fontFamily: F.bold, fontSize: 20 },
  streak: { fontFamily: F.bold, fontSize: 20, color: T.leaf, marginTop: 22 },
});
