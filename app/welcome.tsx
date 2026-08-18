import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { SunMark } from "../components/Sun";
import { ChoiceCard, FadeIn } from "../components/ui";
import { useStore } from "../lib/store";
import { F, S, T, type as ty } from "../lib/theme";

export default function Welcome() {
  const router = useRouter();
  const { update } = useStore();

  return (
    <LinearGradient colors={[T.skyMist, T.skyDeep]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.wrap}
          showsVerticalScrollIndicator={false}
        >
          <FadeIn style={styles.hero}>
            <SunMark size={72} />
            <Text style={styles.logo}>OK Today</Text>
            <Text style={styles.tagline}>
              One tap from Mom.{"\n"}One less worry for you.
            </Text>
          </FadeIn>

          <FadeIn delay={140} style={{ width: "100%" }}>
            <Text style={styles.prompt}>Who's using this phone?</Text>

            <ChoiceCard
              icon="heart"
              accent={T.clay}
              title="I'm watching over someone"
              sub="Set up daily check-ins for a parent"
              onPress={() => {
                update({ role: "family" });
                router.push("/auth");
              }}
            />
            <ChoiceCard
              icon="sunny"
              accent={T.sunDeep}
              title="I'm checking in"
              sub="I'll tap the sun each morning"
              onPress={() => {
                update({ role: "parent" });
                router.push("/parent-join");
              }}
            />
            <ChoiceCard
              icon="people"
              accent={T.leaf}
              title="I'm doing both"
              sub="I check in, and I watch over someone too"
              onPress={() => {
                update({ role: "both" });
                router.push("/auth");
              }}
            />
          </FadeIn>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: S.xl,
    paddingVertical: S.xxl,
  },
  hero: { alignItems: "center", marginBottom: S.xxxl },
  logo: {
    fontFamily: F.display,
    fontSize: 38,
    color: T.ink,
    marginTop: S.md,
  },
  tagline: {
    ...ty.bodyLg,
    color: T.inkSoft,
    textAlign: "center",
    marginTop: S.md,
  },
  prompt: {
    fontFamily: F.display,
    fontSize: 21,
    color: T.ink,
    textAlign: "center",
    marginBottom: S.xl,
  },
});
